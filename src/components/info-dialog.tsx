import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { createTopoContourPaths } from "../lib/topo-contours";
import type { DialogContent } from "../config/menu-content";
import { TechStackIcon } from "./tech-stack-icon";
import "../styles/info-dialog.css";

const CONTOUR_PATHS = createTopoContourPaths({
  width: 600,
  height: 520,
  step: 12,
  levels: 14,
  seed: 20261024,
});

/* 上下揭示的时序资产（秒）。
   卡片被水平切成 BAND_COUNT 行，每行是一份独立的面板副本，只有 clip-path 窗口内才画像素；
   窗口从卡片垂直中心的一条横线展开成行高、同时向上下散开到各自行位，左右从固定条长补满整行。
   所有行在 BAND_LAND 同时到位（外侧先出发、行程最长），中位行随即解除裁切接管静态显示，
   最外两条再向上下边缘压缩成线条后被吸收。 */
const BAND_COUNT = 5;
const BAR_WIDTH_RATIO = 0.4;
const BAR_OFFSETS = [1, 0, 0.5, 1, 0];
const LINE_THICKNESS = 2;
const LINE_IN = 0.06;
const BAND_STAGGER = 0.04;
const BAND_LAND = 0.4;
const WIDEN_FROM = 0.55;
const ABSORB = 0.08;
const SETTLE = 0.06;
const CLOSE_ABSORB = 0.06;
const CLOSE_START = 0.1;
const CLOSE_DUR = 0.16;
const CLOSE_STAGGER = 0.02;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 每帧只在值变化时写 CSS 变量。 */
function makeWriter(el: HTMLElement) {
  const last = new Map<string, string>();
  return (name: string, value: string) => {
    if (last.get(name) === value) return;
    last.set(name, value);
    el.style.setProperty(name, value);
  };
}

function DialogFace({ content, isStatic }: { content: DialogContent; isStatic: boolean }) {
  return (
    <div className="ef-idlg__surface" aria-hidden={isStatic ? undefined : "true"}>
      <div className="ef-idlg__toplines" aria-hidden="true" />
      <div className="ef-idlg__topline" aria-hidden="true" />
      <svg className="ef-idlg__contours" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true">
        <use href="#ef-idlg-contours" />
      </svg>
      <div className="ef-idlg__brandline" aria-hidden="true">
        <strong>ENDFIELD</strong>
      </div>
      <div className="ef-idlg__content">
        <div className="ef-idlg__heading">
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
        <p className="ef-idlg__body">{content.description}</p>
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
  const cardRef = useRef<HTMLDivElement>(null);
  const bandRefs = useRef<(HTMLDivElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const closeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const entranceTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCloseRef = useRef(onClose);
  const reducedMotionRef = useRef<MediaQueryList | null>(null);
  // 窄屏的卡片是内容撑高的可滚动面板，切成多行会各自变成滚动容器，退化为单条整卡揭示。
  const [bandCount] = useState(() =>
    window.matchMedia("(max-width: 720px)").matches ? 1 : BAND_COUNT,
  );
  // 站点入口弹窗带封面媒体块、RSS/友链弹窗带外链列表：卡片按内容加高（视口封顶），桌面端以 inline style
  // 覆盖固定高度；窄屏走 CSS 的内容自适应高度，不加 inline。揭示动画的行高在挂载时实测，随卡片高度自适应。
  const cardHeight = content.image || content.links?.length || content.groups?.length
    ? Math.min(780, Math.round((window.innerHeight - 48) / 0.72))
    : 520;
  const panelHeight = Math.round(cardHeight * 0.72);

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
    if (timeline) timeline.play(0);
    else onCloseRef.current();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    const bands = bandRefs.current.slice(0, bandCount);
    if (!root || !card || bands.length !== bandCount || bands.some((b) => !b)) return;
    const dim = root.querySelector<HTMLElement>(".ef-idlg__dim");
    if (!dim) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motion;
    root.dataset.phase = "entering";
    closeRef.current?.focus({ preventScroll: true });

    // 条带与面板同框，窗口坐标一律以条带自身的布局盒为准（不受卡片 scale 影响）。
    const box = bands[0] as HTMLElement;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    const rowHeight = height / bandCount;
    const barWidth = Math.round(width * BAR_WIDTH_RATIO);
    const offsets = bandCount === 1 ? [0.5] : BAR_OFFSETS;
    const centerY = height / 2;
    const middle = (bandCount - 1) / 2;
    const hasAbsorb = bandCount > 1;

    const writers = bands.map((el) => makeWriter(el as HTMLElement));
    const writeRoot = makeWriter(root);

    type BandState = { s: number; a: number; full: boolean; hidden: boolean };
    const states: BandState[] = bands.map(() => ({ s: 0, a: 0, full: false, hidden: false }));
    const shadow = { v: 0 };

    const render = () => {
      writeRoot("--ef-idlg-shadow", shadow.v.toFixed(3));
      bands.forEach((_, k) => {
        const write = writers[k];
        const st = states[k];
        write("visibility", st.hidden ? "hidden" : "visible");
        if (st.full) {
          write("--ef-band-t", "0px");
          write("--ef-band-r", "0px");
          write("--ef-band-b", "0px");
          write("--ef-band-l", "0px");
          write("--ef-band-sheen", "0");
          write("--ef-band-absorb", "0");
          return;
        }
        const homeTop = k * rowHeight;
        const homeBottom = (k + 1) * rowHeight;
        const lineTop = centerY - LINE_THICKNESS / 2;
        const lineBottom = centerY + LINE_THICKNESS / 2;
        let top = lineTop + (homeTop - lineTop) * st.s;
        let bottom = lineBottom + (homeBottom - lineBottom) * st.s;
        if (st.a > 0) {
          if (k === 0) bottom = homeBottom + (LINE_THICKNESS - homeBottom) * st.a;
          else if (k === bandCount - 1) top = homeTop + (height - LINE_THICKNESS - homeTop) * st.a;
        }
        const widen = clamp01((st.s - WIDEN_FROM) / (1 - WIDEN_FROM));
        const offsetX = Math.round((width - barWidth) * offsets[k]);
        const left = offsetX * (1 - widen);
        const right = (width - offsetX - barWidth) * (1 - widen);
        write("--ef-band-t", `${top.toFixed(2)}px`);
        write("--ef-band-r", `${right.toFixed(2)}px`);
        write("--ef-band-b", `${(height - bottom).toFixed(2)}px`);
        write("--ef-band-l", `${left.toFixed(2)}px`);
        write("--ef-band-sheen", (1 - st.s).toFixed(3));
        write("--ef-band-absorb", st.a.toFixed(3));
      });
    };

    const handoff = (on: boolean) => {
      states.forEach((st, k) => {
        st.full = on && k === middle;
        st.hidden = on && k !== middle && !(hasAbsorb && (k === 0 || k === bandCount - 1));
        if (on && hasAbsorb && (k === 0 || k === bandCount - 1)) st.a = 0;
      });
      render();
    };

    const delayFor = (k: number) => LINE_IN + (middle - Math.abs(k - middle)) * BAND_STAGGER;
    const closeOrder = states
      .map((st, k) => ({ st, dist: Math.abs(k - middle) }))
      .sort((a, b) => a.dist - b.dist)
      .map((entry) => entry.st);

    const context = gsap.context(() => {
      gsap.set(dim, { opacity: 0 });
      gsap.set(closeRef.current, { opacity: 0 });
      render();

      const closeTimeline = gsap.timeline({
        paused: true,
        onComplete: () => onCloseRef.current(),
      });
      closeTimeline
        .add(() => {
          handoff(false);
          if (hasAbsorb) {
            states[0].a = 1;
            states[bandCount - 1].a = 1;
            render();
          }
        }, 0)
        .to(closeRef.current, { opacity: 0, duration: 0.04 }, 0)
        .to(shadow, { v: 0, duration: CLOSE_ABSORB, ease: "none", onUpdate: render }, 0)
        .to(
          states.filter((_, k) => hasAbsorb && (k === 0 || k === bandCount - 1)),
          { a: 0, duration: CLOSE_ABSORB, ease: "power2.out", onUpdate: render },
          0,
        )
        .to(
          closeOrder,
          {
            s: 0,
            duration: CLOSE_DUR,
            ease: "power2.in",
            stagger: CLOSE_STAGGER,
            onUpdate: render,
          },
          CLOSE_START,
        )
        .to(dim, { opacity: 0, duration: 0.1, ease: "none" }, CLOSE_START + CLOSE_DUR + 0.04);
      closeTimelineRef.current = closeTimeline;

      if (motion.matches) {
        gsap.set(dim, { opacity: 1 });
        shadow.v = 1;
        states.forEach((st, k) => {
          st.s = 1;
          st.full = k === middle;
          st.hidden = k !== middle;
        });
        render();
        gsap.set(closeRef.current, { opacity: 1 });
        root.dataset.phase = "open";
        return;
      }

      const entrance = gsap
        .timeline({ onComplete: () => { root.dataset.phase = "open"; } })
        .to(dim, { opacity: 1, duration: LINE_IN, ease: "none" }, 0);
      states.forEach((st, k) => {
        entrance.to(
          st,
          { s: 1, duration: BAND_LAND - delayFor(k), ease: "power2.out", onUpdate: render },
          delayFor(k),
        );
      });
      entrance.add(() => handoff(true), BAND_LAND);
      if (hasAbsorb) {
        entrance.to([states[0], states[bandCount - 1]], { a: 1, duration: ABSORB, ease: "power2.in", onUpdate: render }, BAND_LAND);
      }
      entrance
        .to(shadow, { v: 1, duration: SETTLE, ease: "none", onUpdate: render }, BAND_LAND + 0.02)
        .to(closeRef.current, { opacity: 1, duration: 0.04 }, BAND_LAND + 0.02)
        .add(() => {
          states.forEach((st) => {
            st.hidden = st.full !== true;
          });
          render();
        }, BAND_LAND + ABSORB);
      entranceTimelineRef.current = entrance;
    }, root);

    return () => {
      context.revert();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [bandCount]);

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
      <svg width="0" height="0" className="ef-idlg__defs" aria-hidden="true">
        <defs>
          <g id="ef-idlg-contours" fill="none" stroke="#8f958f" strokeWidth="1">
            {CONTOUR_PATHS.map((path, index) => (
              <path key={index} d={path} strokeOpacity={index % 4 === 0 ? 0.48 : 0.22} />
            ))}
          </g>
        </defs>
      </svg>
      <div className="ef-idlg__frame">
        <div
          className="ef-idlg__panel"
          style={bandCount === 1 ? undefined : { height: panelHeight }}
        >
          <div className="ef-idlg__card" ref={cardRef} style={bandCount === 1 ? undefined : { height: cardHeight }}>
            <div className="ef-idlg__shape">
              <div className="ef-idlg__rim" aria-hidden="true" />
              {Array.from({ length: bandCount }, (_, k) => (
                <div
                  className="ef-idlg__band"
                  key={k}
                  ref={(el) => {
                    bandRefs.current[k] = el;
                  }}
                >
                  <DialogFace content={content} isStatic={k === (bandCount - 1) / 2} />
                </div>
              ))}
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
