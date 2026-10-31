import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { createTopoContourPaths } from "../lib/topo-contours";
import type { DialogContent, DialogGroupItem } from "../config/menu-content";
import { TechStackIcon } from "./tech-stack-icon";
import { acquireDialogPixelRenderer, rasterizeDialog } from "../scene/dialog-pixel-renderer";
import {
  dialogCardHeight,
  dialogIsNarrow,
  dialogPanelHeight,
  dialogRasterKey,
  getDialogRaster,
} from "../scene/dialog-raster-cache";
import { PIXEL_TRANSITION_DURATION } from "../lib/pixel-transition";
import { CloseIcon } from "./close-icon";
import "../styles/info-dialog.css";

const CONTOUR_PATHS = createTopoContourPaths({
  width: 600,
  height: 520,
  step: 12,
  levels: 14,
  seed: 20261024,
});
/** 黑条专用的稀疏等高线：线条更少、更粗更亮，横条上也看得清。 */
const BAR_CONTOUR_PATHS = createTopoContourPaths({
  width: 780,
  height: 64,
  step: 24,
  levels: 10,
  seed: 20261030,
});

/** 入场起播前最多等快照的时间：超过就照常开跑，避免慢快照把弹窗拖成"点了没反应"。 */
const ENTRANCE_GRACE_MS = 450;
/** 快照晚到时留给组装段的最短可见时长：不足就把剩余相位放慢到这个长度。 */
const ENTRANCE_MIN_TAIL_MS = 240;

/** 弹窗与预热快照共用页面中唯一一份等高线定义。 */
export function DialogContourDefs() {
  return (
    <svg width="0" height="0" className="ef-idlg__defs" aria-hidden="true">
      <defs>
        <g id="ef-idlg-contours" fill="none" stroke="#8f958f" strokeWidth="1">
          {CONTOUR_PATHS.map((path, index) => (
            <path key={index} d={path} strokeOpacity={index % 4 === 0 ? 0.48 : 0.22} />
          ))}
        </g>
        <g id="ef-idlg-bar-contours" fill="none" stroke="#b3b7ab" strokeWidth="1.6">
          {BAR_CONTOUR_PATHS.map((path, index) => (
            <path key={index} d={path} strokeOpacity={index % 2 === 0 ? 0.85 : 0.6} />
          ))}
        </g>
      </defs>
    </svg>
  );
}

type ChapterCardSpec = {
  tag: string;
  title: string;
  /** 卡片右侧的附注：地址、日期或等级 */
  value?: string;
  /** 有链接时整卡可点，新标签页打开 */
  href?: string;
  /** 站点封面：放在标题卡下方的内容区 */
  image?: string;
  /** 说明正文：与配图同一行铺在内容区（文案约 70%，配图约 30%） */
  body?: string;
  /** 分组卡片（技术栈）：组内条目以旧版小卡形式铺在标题卡下方 */
  items?: DialogGroupItem[];
};

type ChapterCardEntry = ChapterCardSpec & { no: string; key: string };

/** 把弹窗内容按图二章节卡排列：说明正文、meta 行、外链、技术栈条目依次编号；
    说明卡自带配图，不再单独生成预览卡；失败源不进章节卡，统一由顶部的失败区（FailurePanel）展示。 */
function buildChapterCards(content: DialogContent): ChapterCardEntry[] {
  const cards: ChapterCardSpec[] = [];
  if (content.body) cards.push({ tag: "NOTES", title: "公告信息", body: content.body, image: content.image });
  else if (content.image) cards.push({ tag: "PREVIEW", title: "预览", image: content.image });
  for (const row of content.meta) {
    cards.push({ tag: "CHAPTER", title: row.label, value: row.value, href: row.href });
  }
  for (const link of content.links ?? []) {
    cards.push({
      tag: "CHAPTER",
      title: link.title,
      value: [link.source, link.note].filter((part): part is string => Boolean(part)).join(" · "),
      href: link.url,
    });
  }
  for (const group of content.groups ?? []) {
    cards.push({ tag: "GROUP", title: group.label, items: group.items });
  }
  return cards.map((card, index) => ({
    ...card,
    no: String(index + 1).padStart(2, "0"),
    key: `${index}:${card.title}`,
  }));
}

/** 章节卡右上角黄色书签里的默认图记：两栏书页，对应图二的黄色小图标。 */
function ChapterGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.4" y="2.4" width="4" height="11.2" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.2" y="2.4" width="4.4" height="11.2" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ChapterCard({ card }: { card: ChapterCardEntry }) {
  const isGroup = Boolean(card.items?.length);
  const inner = (    <span className={`ef-idlg__chapter${isGroup ? " ef-idlg__chapter--group" : ""}`}>
      <span className="ef-idlg__chapter-head">
        <span className="ef-idlg__chapter-rail" aria-hidden="true" />
        <span className="ef-idlg__chapter-no" aria-hidden="true">
          <i className="ef-idlg__chapter-plate" />
          <span className="ef-idlg__chapter-num">
            <b>{card.no}</b>
            <em className="ef-idlg__chapter-tag">{card.tag}</em>
          </span>
        </span>
        <span className="ef-idlg__chapter-body">
          <span className="ef-idlg__chapter-titlewrap">
            <span className="ef-idlg__chapter-title">
              <i aria-hidden="true">[</i>
              <span>{card.title}</span>
              <i aria-hidden="true">]</i>
            </span>
            <span className="ef-idlg__chapter-rule" aria-hidden="true" />
          </span>
        </span>
        <span className="ef-idlg__chapter-side">
          <span className="ef-idlg__chapter-arrow" aria-hidden="true" />
        </span>
      </span>
      <span className="ef-idlg__chapter-icon" aria-hidden="true">
        <ChapterGlyph />
      </span>
      {(card.items || card.image || card.value || card.body) && (
        <span className="ef-idlg__chapter-content">
          {card.items && (
            <span className="ef-idlg__group-items">
              {card.items.map((item) => (
                <span className="ef-idlg__group-item" key={item.name} data-level={item.level}>
                  {item.icon && <TechStackIcon name={item.icon} />}
                  <span className="ef-idlg__group-item-body">
                    <span className="ef-idlg__group-item-name">{item.name}</span>
                    {item.level && <small>{item.level}</small>}
                  </span>
                </span>
              ))}
            </span>
          )}
          {card.body && (
            <span className="ef-idlg__notes">
              <span className="ef-idlg__notes-text">{card.body}</span>
              {card.image && <img className="ef-idlg__notes-shot" src={card.image} alt="" />}
            </span>
          )}
          {!card.body && card.image && <img className="ef-idlg__chapter-shot" src={card.image} alt="" />}
          {card.value && <span className="ef-idlg__chapter-note">{card.value}</span>}
        </span>
      )}
    </span>
  );
  if (card.href) {
    return (
      <a className="ef-idlg__entry" href={card.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <div className="ef-idlg__entry" data-static="true">
      {inner}
    </div>
  );
}

/** 顶部失败区（RSS）：获取失败的源用红框常驻在内容区顶部，增量重新获取按钮就在这里，
    不再作为章节卡沉到上百条更新后面。 */
function FailurePanel({ content }: { content: DialogContent }) {
  const failures = content.failures ?? [];
  const retry = content.onRetry;
  if (failures.length === 0) return null;
  return (
    <section className="ef-idlg__fails" role="status" aria-label="获取失败的订阅源">
      <div className="ef-idlg__fails-head">
        <span className="ef-idlg__fails-tag">// FETCH FAILED</span>
        <span className="ef-idlg__fails-count">{failures.length} 个源暂时无法获取</span>
        {retry && content.notice?.tone !== "error" && (
          <button
            type="button"
            className="ef-idlg__fails-retry"
            onClick={retry}
            disabled={content.isRetrying}
          >
            {content.isRetrying ? "正在重新获取…" : "增量重新获取"}
          </button>
        )}
      </div>
      <ul className="ef-idlg__fails-list">
        {failures.map((failure, index) => {
          const body = (
            <>
              <span className="ef-idlg__fails-name">{failure.name}</span>
              <small className="ef-idlg__fails-reason">{failure.reason}</small>
            </>
          );
          return (
            <li key={`${index}:${failure.name}`}>
              {failure.url ? (
                <a className="ef-idlg__fails-item" href={failure.url} target="_blank" rel="noopener noreferrer">
                  {body}
                </a>
              ) : (
                <span className="ef-idlg__fails-item">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DialogFace({ content }: { content: DialogContent }) {
  const cards = buildChapterCards(content);
  return (
    <div className="ef-idlg__surface">
      <header className="ef-idlg__head">
        <div className="ef-idlg__bar">
          <svg className="ef-idlg__bar-tex" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true">
            <use href="#ef-idlg-contours" />
          </svg>
          <span className="ef-idlg__bar-title">// {content.title}</span>
        </div>
        <div className="ef-idlg__titleband">
          <h2 className="ef-idlg__title" title={content.subtitle}>
            <i aria-hidden="true">[</i>
            <span>{content.subtitle}</span>
            <i aria-hidden="true">]</i>
          </h2>
        </div>
        {/* 分界线（图一）：黑条内放 READ ME. 与介绍，三色条贴在黑条下缘，右端留三角戳。 */}
        <div className="ef-idlg__divider">
          <span className="ef-idlg__divider-bar">
            <svg className="ef-idlg__divider-tex" viewBox="0 0 780 64" preserveAspectRatio="none" aria-hidden="true">
              <use href="#ef-idlg-bar-contours" />
            </svg>
            <span className="ef-idlg__lead-tag" aria-hidden="true">
              // READ ME.
            </span>
            <span className="ef-idlg__lead-text" title={content.description}>
              {content.description}
            </span>
          </span>
          <span className="ef-idlg__divider-marks" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="ef-idlg__divider-colors" aria-hidden="true" />
        </div>
      </header>
      <div className="ef-idlg__board">
        <FailurePanel content={content} />
        {content.notice && (
          <div className={`ef-idlg__notice ef-idlg__notice--${content.notice.tone}`} role="status">
            <span>{content.notice.text}</span>
            {content.notice.tone === "error" && content.onRetry && !content.isRetrying && (
              <button type="button" className="ef-idlg__retry" onClick={content.onRetry}>
                重试
              </button>
            )}
          </div>
        )}
        <div className="ef-idlg__chapters">
          {cards.map((card) => (
            <ChapterCard key={card.key} card={card} />
          ))}
        </div>
        <div className="ef-idlg__progressrow" aria-hidden="true">
          <span className="ef-idlg__progress">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}

export function InfoDialog({
  content,
  canAnimate,
  onClose,
}: {
  content: DialogContent;
  canAnimate: boolean;
  onClose: () => void;
}) {
  const [initialContent] = useState(content);
  const [hasEntered, setHasEntered] = useState(false);
  const displayContent = hasEntered ? content : initialContent;
  const rootRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const closeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const entranceTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCloseRef = useRef(onClose);
  const reducedMotionRef = useRef<MediaQueryList | null>(null);
  const pixelPhaseRef = useRef(1);
  const closeStartPhaseRef = useRef(0);
  const [isNarrow] = useState(dialogIsNarrow);
  // 外链/分组/状态提示弹窗按内容加高（视口封顶），桌面端以 inline style 覆盖固定高度；
  // 窄屏走 CSS 的内容自适应高度，不加 inline。尺寸口径与空闲期的预栅格化同源（scene/dialog-raster-cache.ts）。
  const cardHeight = dialogCardHeight(displayContent);
  const panelHeight = dialogPanelHeight(cardHeight);
  // 快照身份在挂载时定格：编排只跑一次，抓取中途更新的内容不进这份快照（与栅格化时机一致）。
  const [rasterKey] = useState(() => dialogRasterKey(initialContent, cardHeight));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    const root = rootRef.current;
    if (!root || closingRef.current) return;
    closingRef.current = true;
    root.dataset.phase = "closing";
    entranceTimelineRef.current?.kill();
    if (reducedMotionRef.current?.matches) {
      onCloseRef.current();
      return;
    }
    const timeline = closeTimelineRef.current;
    if (timeline) {
      // 入场中关闭时从当前碎片相位继续，而不是跳回完整面板再消融。
      closeStartPhaseRef.current = pixelPhaseRef.current;
      timeline.play(0);
    } else onCloseRef.current();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const shape = shapeRef.current;
    const canvas = canvasRef.current;
    const close = closeRef.current;
    const dim = root?.querySelector<HTMLElement>(".ef-idlg__dim");
    if (!root || !shape || !canvas || !close || !dim) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motion;
    root.dataset.phase = "entering";
    close.focus({ preventScroll: true });
    let disposed = false;
    let renderer: ReturnType<typeof acquireDialogPixelRenderer> | null = null;

    const showStatic = () => {
      if (disposed || closingRef.current) return;
      setHasEntered(true);
      pixelPhaseRef.current = 0;
      gsap.set([shape, close, dim], { opacity: 1 });
      gsap.set(canvas, { opacity: 0 });
      root.style.setProperty("--ef-idlg-shadow", "1");
      root.dataset.phase = "open";
    };

    // 快照准备期间先让遮罩立刻反馈点击，但不盖住后续转场的时间线。
    const dimTween = gsap.to(dim, { opacity: 1, duration: 0.12, ease: "none" });
    gsap.set(close, { opacity: 0 });
    if (motion.matches || !canAnimate) {
      showStatic();
      return () => {
        disposed = true;
        dimTween.kill();
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      };
    }

    // 时间线挂载即建，但延迟到快照就绪再起播：碎片相位 1 附近本就画不出东西，等它不产生空白，
    // 却能让重文字量的弹窗（订阅）也播满整段；最多等 ENTRANCE_GRACE_MS，超时照常开跑。
    const playhead = { progress: 0 };
    const entrance = gsap.timeline({
      paused: true,
      onComplete: () => {
        entranceTimelineRef.current = null;
        showStatic();
      },
    });
    entrance
      .to(close, { opacity: 1, duration: 0.12, ease: "none" }, 0.08)
      .to(playhead, {
        progress: 1,
        duration: PIXEL_TRANSITION_DURATION,
        ease: "none",
        onUpdate: () => {
          pixelPhaseRef.current = 1 - playhead.progress;
          renderer?.draw(pixelPhaseRef.current);
        },
      }, 0);
    entranceTimelineRef.current = entrance;
    let entranceStarted = false;
    const startEntrance = () => {
      if (entranceStarted || disposed || closingRef.current) return;
      entranceStarted = true;
      window.clearTimeout(graceTimer);
      entrance.play();
    };
    const graceTimer = window.setTimeout(startEntrance, ENTRANCE_GRACE_MS);

    const prepare = async () => {
      try {
        // 同一份内容在空闲期已预栅格化时直接取用：现做快照要 200-500ms，赶不上 400ms 的入场窗口。
        const raster = await getDialogRaster(rasterKey, () => rasterizeDialog(shape));
        if (disposed || closingRef.current) return;
        renderer = acquireDialogPixelRenderer(canvas, raster);
        if (entranceTimelineRef.current && playhead.progress < 1) {
          // 快照到得晚时把剩下的相位放慢到至少 MIN_TAIL：只剩几十毫秒的话用户等于没看到动效。
          const remainingMs = PIXEL_TRANSITION_DURATION * (1 - playhead.progress) * 1000;
          if (remainingMs < ENTRANCE_MIN_TAIL_MS) {
            entrance.timeScale(remainingMs / ENTRANCE_MIN_TAIL_MS);
          }
          startEntrance();
          gsap.set(shape, { opacity: 0 });
          gsap.set(canvas, { opacity: 1 });
          renderer.draw(pixelPhaseRef.current);
        }
        // 入场已结束则保持静态面板；关闭时间线仍接管，退出时从相位 0 播完整消融。
        const closeDriver = { value: 0 };
        const closeTimeline = gsap.timeline({
          paused: true,
          onComplete: () => onCloseRef.current(),
        });
        closeTimeline
          .set(shape, { opacity: 0 }, 0)
          .set(canvas, { opacity: 1 }, 0)
          .to(close, { opacity: 0, duration: 0.08, ease: "none" }, 0)
          .to(closeDriver, {
            value: 1,
            duration: PIXEL_TRANSITION_DURATION,
            ease: "none",
            onUpdate: () => {
              const start = closeStartPhaseRef.current;
              pixelPhaseRef.current = start + (1 - start) * closeDriver.value;
              renderer?.draw(pixelPhaseRef.current);
            },
          }, 0)
          .to(dim, { opacity: 0, duration: 0.12, ease: "none" }, PIXEL_TRANSITION_DURATION - 0.12);
        closeTimelineRef.current = closeTimeline;
      } catch (error) {
        if (disposed || closingRef.current) return;
        console.warn("InfoDialog pixel transition unavailable", error);
        window.clearTimeout(graceTimer);
        entranceTimelineRef.current?.kill();
        entranceTimelineRef.current = null;
        showStatic();
        closeTimelineRef.current = null;
      }
    };
    void prepare();

    return () => {
      disposed = true;
      window.clearTimeout(graceTimer);
      entranceTimelineRef.current?.kill();
      closeTimelineRef.current?.kill();
      entranceTimelineRef.current = null;
      closeTimelineRef.current = null;
      dimTween.kill();
      renderer?.release();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [canAnimate, rasterKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div className="ef-idlg" ref={rootRef} role="dialog" aria-modal="true" aria-label={displayContent.subtitle} data-phase="entering">
      <div className="ef-idlg__dim" onClick={requestClose} />
      <div className="ef-idlg__frame">
        <div className="ef-idlg__panel" style={isNarrow ? undefined : { height: panelHeight }}>
          <div className="ef-idlg__card" style={isNarrow ? undefined : { height: cardHeight }}>
            <div className="ef-idlg__pixels" ref={canvasRef} aria-hidden="true" />
            <div className="ef-idlg__shape" ref={shapeRef}>
              <div className="ef-idlg__rim" aria-hidden="true" />
              <DialogFace content={displayContent} />
            </div>
            <button className="ef-idlg__close" ref={closeRef} title="关闭" aria-label="关闭" onClick={requestClose}>
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}