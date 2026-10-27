import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { createTopoContourPaths } from "../lib/topo-contours";
import type { DialogContent } from "../config/menu-content";
import { TechStackIcon } from "./tech-stack-icon";
import { createDialogPixelRenderer, rasterizeDialog, type DialogPixelRenderer } from "../scene/dialog-pixel-renderer";
import {
  dialogCardHeight,
  dialogIsNarrow,
  dialogPanelHeight,
  dialogRasterKey,
  peekDialogRaster,
  rememberDialogRaster,
} from "../scene/dialog-raster-cache";
import { PIXEL_TRANSITION_DURATION } from "../lib/pixel-transition";
import "../styles/info-dialog.css";

const CONTOUR_PATHS = createTopoContourPaths({
  width: 600,
  height: 520,
  step: 12,
  levels: 14,
  seed: 20261024,
});

/** 入场起播前最多等快照的时间：超过就照常开跑，避免慢快照把弹窗拖成"点了没反应"。 */
const ENTRANCE_GRACE_MS = 450;
/** 快照晚到时留给组装段的最短可见时长：不足就把剩余相位放慢到这个长度。 */
const ENTRANCE_MIN_TAIL_MS = 240;

/** 弹窗等高线 defs：DialogFace 用 `<use>` 引用它，弹窗本体与空闲期的预栅格化各挂一份（两者不同时在场）。 */
export function DialogContourDefs() {
  return (
    <svg width="0" height="0" className="ef-idlg__defs" aria-hidden="true">
      <defs>
        <g id="ef-idlg-contours" fill="none" stroke="#8f958f" strokeWidth="1">
          {CONTOUR_PATHS.map((path, index) => (
            <path key={index} d={path} strokeOpacity={index % 4 === 0 ? 0.48 : 0.22} />
          ))}
        </g>
      </defs>
    </svg>
  );
}

export function DialogFace({ content }: { content: DialogContent }) {
  // pattern 必须用独立 id，避免整页其他副本引用到同一份。
  const wordUid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const wordLineId = `ef-idlg-wordline-${wordUid}`;
  return (
    <div className="ef-idlg__surface">
      <div className="ef-idlg__toplines" aria-hidden="true" />
      <div className="ef-idlg__topword" aria-hidden="true">
        <svg viewBox="0 0 1032 160" preserveAspectRatio="none">
          <defs>
            <pattern
              id={wordLineId}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke="#10120d" strokeOpacity="0.85" strokeWidth="3" />
            </pattern>
          </defs>
          <text x="0" y="124" textLength="1032" lengthAdjust="spacingAndGlyphs" fill={`url(#${wordLineId})`}>
            ENDFIELD
          </text>
        </svg>
      </div>
      <div className="ef-idlg__topline" aria-hidden="true" />
      <svg className="ef-idlg__contours" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true">
        <use href="#ef-idlg-contours" />
      </svg>
      <div className="ef-idlg__content">
        <div className="ef-idlg__heading">
          <span className="ef-idlg__plate-tag" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeDasharray="34 8"
                transform="rotate(-50 12 12)"
              />
            </svg>
          </span>
          <span className="ef-idlg__meta-note" aria-hidden="true">
            ARKNIGHTS: ENDFIELD
          </span>
          <div className="ef-idlg__plate">
            <h2 className="ef-idlg__title">{content.title}</h2>
            <div className="ef-idlg__subtitle">
              <span>{content.subtitle}</span>
              <i className="ef-idlg__marks" aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
            </div>
          </div>
        </div>
        <p className="ef-idlg__body">{content.description}</p>
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
        {content.image && (
          <div className="ef-idlg__media">
            <img src={content.image} alt={content.subtitle} />
          </div>
        )}
        {content.meta.length > 0 && (
          <div className="ef-idlg__meta">
            {content.meta.map((row) => (
              <div className="ef-idlg__row" key={row.label}>
                <b>{row.label}</b>
                <i />
                <span className="ef-idlg__value">{row.value}</span>
                {row.href && (
                  <button
                    className="ef-idlg__jump"
                    title="打开链接"
                    aria-label="打开链接"
                    onClick={() => window.open(row.href, "_blank", "noopener,noreferrer")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {content.links && content.links.length > 0 && (
          <div className="ef-idlg__links">
            {content.links.map((link) => (
              <a
                className="ef-idlg__link"
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.source && <b className="ef-idlg__link-source">【{link.source}】</b>}
                <span>{link.title}</span>
                {link.note && <small>{link.note}</small>}
              </a>
            ))}
          </div>
        )}
        {content.failures && content.failures.length > 0 && (
          <section className="ef-idlg__failures">
            <header className="ef-idlg__failures-head">
              <b>暂时无法获取</b>
              <span>{content.failures.length}</span>
              {content.onRetry && !content.isRetrying && content.notice?.tone !== "error" && (
                <button type="button" className="ef-idlg__retry" onClick={content.onRetry}>
                  重新获取
                </button>
              )}
            </header>
            <div className="ef-idlg__failures-list">
              {content.failures.map((failure, index) =>
                failure.url ? (
                  <a
                    className="ef-idlg__failure"
                    href={failure.url}
                    key={`${failure.name}:${index}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <b>{failure.name}</b>
                    <span>{failure.reason}</span>
                  </a>
                ) : (
                  <div className="ef-idlg__failure" key={`${failure.name}:${index}`}>
                    <b>{failure.name}</b>
                    <span>{failure.reason}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}
        {content.groups && content.groups.length > 0 && (
          <div className="ef-idlg__groups">
            {content.groups.map((group) => (
              <section className="ef-idlg__group" key={group.label}>
                <h3 className="ef-idlg__group-label">{group.label}</h3>
                <ul className="ef-idlg__group-items">
                  {group.items.map((item) => (
                    <li key={item.name} data-level={item.level}>
                      {item.icon && <TechStackIcon name={item.icon} />}
                      <span className="ef-idlg__group-body">
                        <span className="ef-idlg__group-name">{item.name}</span>
                        {item.level && <small>{item.level}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <footer className="ef-idlg__hint">
          <span>ESC // CLOSE</span>
          <div className="ef-idlg__chips" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </footer>
      </div>
    </div>
  );
}

export function InfoDialog({
  content,
  onClose,
}: {
  content: DialogContent;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const closeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const entranceTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCloseRef = useRef(onClose);
  const reducedMotionRef = useRef<MediaQueryList | null>(null);
  const pixelPhaseRef = useRef(1);
  const closeStartPhaseRef = useRef(0);
  const [isNarrow] = useState(dialogIsNarrow);
  // 站点入口弹窗带封面媒体块、RSS/友链弹窗带外链列表：卡片按内容加高（视口封顶），桌面端以 inline style
  // 覆盖固定高度；窄屏走 CSS 的内容自适应高度，不加 inline。尺寸口径与空闲期的预栅格化同源（scene/dialog-raster-cache.ts）。
  const cardHeight = dialogCardHeight(content);
  const panelHeight = dialogPanelHeight(cardHeight);
  // 快照身份在挂载时定格：编排只跑一次，抓取中途更新的内容不进这份快照（与栅格化时机一致）。
  const rasterKeyRef = useRef(dialogRasterKey(content, cardHeight));

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
    let renderer: DialogPixelRenderer | null = null;

    const showStatic = () => {
      pixelPhaseRef.current = 0;
      gsap.set([shape, close, dim], { opacity: 1 });
      gsap.set(canvas, { opacity: 0 });
      root.style.setProperty("--ef-idlg-shadow", "1");
      root.dataset.phase = "open";
    };

    // 快照准备期间先让遮罩立刻反馈点击，但不盖住后续转场的时间线。
    gsap.to(dim, { opacity: 1, duration: 0.12, ease: "none" });
    gsap.set(close, { opacity: 0 });
    if (motion.matches) {
      showStatic();
      return () => {
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
        const cached = peekDialogRaster(rasterKeyRef.current);
        let raster: HTMLCanvasElement;
        if (cached !== null) {
          raster = await cached;
        } else {
          raster = await rasterizeDialog(shape);
          rememberDialogRaster(rasterKeyRef.current, Promise.resolve(raster));
        }
        if (disposed || closingRef.current) return;
        renderer = createDialogPixelRenderer(canvas, raster);
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
        if (disposed) return;
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
      renderer?.destroy();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div className="ef-idlg" ref={rootRef} role="dialog" aria-modal="true" aria-label={content.subtitle} data-phase="entering">
      <div className="ef-idlg__dim" onClick={requestClose} />
      <DialogContourDefs />
      <div className="ef-idlg__frame">
        <div className="ef-idlg__panel" style={isNarrow ? undefined : { height: panelHeight }}>
          <div className="ef-idlg__card" style={isNarrow ? undefined : { height: cardHeight }}>
            <canvas className="ef-idlg__pixels" ref={canvasRef} aria-hidden="true" />
            <div className="ef-idlg__shape" ref={shapeRef}>
              <div className="ef-idlg__rim" aria-hidden="true" />
              <DialogFace content={content} />
            </div>
            <button className="ef-idlg__close" ref={closeRef} title="关闭" aria-label="关闭" onClick={requestClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 5L19 19M19 5L5 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
