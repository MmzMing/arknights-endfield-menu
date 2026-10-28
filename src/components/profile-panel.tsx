import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { createTopoContourPaths } from "../lib/topo-contours";
import { cssVars } from "../lib/label-svg";
import { formatMonthDay, getSiteCycle, type SiteCycle } from "../lib/site-time";
import type { MusicPlayerApi } from "../hooks/use-music-player";
import type { MusicPlaceholder, ProfilePanelContent, TechStackMetric } from "../config/profile-panel-config";
import type { PlayerContent } from "./player-badge";
import { CloseIcon } from "./close-icon";
import "../styles/profile-panel.css";

/* 个人档案弹窗：点击左下角玩家卡片展开。参考图的四层水平构图——
   左侧黄色竖条（贴合主面板、无边框、内含白色脊线）→ 深色半透明技能手册 → 左下深色等高线暂停卡 → 右下黑黄档案卡。
   底部两张卡压住手册页下沿但绝不遮挡黄条；入场/退场由 GSAP 按 黄条 → 手册 → 暂停卡 → 档案卡 的顺序逐张完成。 */

const BOARD_WIDTH = 1160;
const BOARD_HEIGHT = 740;
const CONTOUR_PATHS = createTopoContourPaths({ width: 620, height: 460, step: 12, levels: 12, seed: 20261024 });

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

/** 弹窗按 1160×740 的画板设计，整体等比缩放到视口内；窄屏改由 CSS 切换为纵向流式布局。 */
function useBoardScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      const gutter = window.innerWidth <= 780 ? 12 : 32;
      setScale(Math.min(1, (window.innerWidth - gutter * 2) / BOARD_WIDTH, (window.innerHeight - gutter * 2) / BOARD_HEIGHT));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

function TechIcon({ id }: { id: string }) {
  switch (id) {
    case "java":
      return (
        <svg viewBox="0 0 1024 1024" fill="none">
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M394.68 756.99s-34.325 19.95 24.343 26.6c71.1 8.05 107.351 7 185.632-7.874c0 0 20.665 12.949 49.385 24.149c-175.475 75.074-397.184-4.375-259.36-42.875m-21.366-98.173s-38.352 28.35 20.315 34.475c75.83 7.875 135.897 8.4 239.571-11.55c0 0 14.36 14.525 36.952 22.4c-212.427 62.123-448.846 5.075-296.838-45.325m180.73-166.422c43.256 49.699-11.384 94.498-11.384 94.498s109.804-56.7 59.368-127.573c-47.11-66.15-83.185-99.049 112.255-212.273c.175 0-306.819 76.65-160.24 245.348M786.26 829.439s25.393 20.825-27.846 37.1c-101.397 30.625-421.7 39.9-510.664 1.225c-32.048-13.825 28.02-33.25 46.934-37.275c19.613-4.2 30.997-3.5 30.997-3.5c-35.551-25.025-229.94 49.175-98.771 70.35c357.605 58.1 652.165-26.075 559.35-67.9M411.142 557.144S248.1 595.818 353.35 609.818c44.482 5.95 133.095 4.55 215.58-2.275c67.423-5.6 135.196-17.85 135.196-17.85s-23.818 10.15-40.98 21.875c-165.493 43.575-485.096 23.275-393.156-21.175c77.93-37.45 141.151-33.25 141.151-33.25M703.6 720.416c168.296-87.324 90.365-171.322 36.077-159.948c-13.31 2.8-19.264 5.25-19.264 5.25s4.903-7.7 14.36-11.025c107.351-37.8 190.01 111.299-34.675 170.273c0-.175 2.627-2.45 3.502-4.55M602.028 64s93.166 93.1-88.438 236.246c-145.53 114.8-33.274 180.424 0 255.148c-84.936-76.65-147.28-144.024-105.425-206.848C469.634 256.672 639.68 211.873 602.028 64m-174.25 893.188c161.466 10.325 409.443-5.775 415.222-82.075c0 0-11.208 28.875-133.445 51.975c-137.824 25.9-307.87 22.925-408.567 6.3c0-.175 20.665 16.975 126.79 23.8"
          />
        </svg>
      );
    case "python":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            fill="currentColor"
            d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969s3.403 5.96 3.403 5.96h2.03v-2.867s-.109-3.42 3.35-3.42h5.766s3.24.052 3.24-3.148V3.202S18.28 0 11.913 0M8.708 1.85c.578 0 1.046.47 1.046 1.052c0 .581-.468 1.051-1.046 1.051s-1.046-.47-1.046-1.051c0-.582.467-1.052 1.046-1.052"
          />
          <path
            fill="currentColor"
            d="M12.087 24c6.092 0 5.712-2.656 5.712-2.656l-.007-2.752h-5.814v-.826h8.123s3.9.445 3.9-5.735s-3.404-5.96-3.404-5.96h-2.03v2.867s.109 3.42-3.35 3.42H9.452s-3.24-.052-3.24 3.148v5.292S5.72 24 12.087 24m3.206-1.85c-.579 0-1.046-.47-1.046-1.052c0-.581.467-1.051 1.046-1.051c.578 0 1.046.47 1.046 1.051c0 .582-.468 1.052-1.046 1.052"
          />
        </svg>
      );
    case "agent":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="10.47" height="8.14" x="6.77" y="8.75" fill="currentColor" opacity=".2" rx="2" />
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M10.28 11.54v1.68m3.61-1.68v1.68m3.58-.24h1.42m-13.78 0h1.42m5.66-4.23c0-.76 0-1.14-.14-1.44a1.5 1.5 0 0 0-.74-.74c-.3-.14-.68-.14-1.45-.14"
          />
          <rect
            width="10.47"
            height="8.14"
            x="6.77"
            y="8.75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            rx="2"
          />
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M15.91 21.27c2.24 0 3.36 0 4.14-.56a3 3 0 0 0 .69-.68c.56-.79.56-1.9.56-4.15M15.95 2.76c2.2 0 3.3 0 4.08.55a3 3 0 0 1 .72.72c.55.78.55 1.88.55 4.09M8.1 21.27c-2.25 0-3.37 0-4.16-.56a3 3 0 0 1-.67-.68c-.57-.78-.57-1.9-.57-4.15M8.1 2.76c-2.25 0-3.37 0-4.16.57a3 3 0 0 0-.67.67c-.57.79-.57 1.91-.57 4.16"
          />
        </svg>
      );
    case "frontend":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            fill="currentColor"
            d="M24 11.689c0-1.59-1.991-3.097-5.044-4.031c.705-3.111.392-5.587-.988-6.38a2.15 2.15 0 0 0-1.096-.273v1.09c.225 0 .406.045.558.128c.665.382.954 1.834.729 3.703c-.054.46-.142.944-.25 1.438a24 24 0 0 0-3.106-.533a24 24 0 0 0-2.035-2.446c1.595-1.482 3.092-2.294 4.11-2.294V1c-1.346 0-3.107.959-4.888 2.622C10.21 1.97 8.448 1.02 7.103 1.02v1.09c1.013 0 2.515.808 4.11 2.28c-.685.72-1.37 1.536-2.021 2.441a23 23 0 0 0-3.111.538q-.168-.734-.255-1.418c-.23-1.87.054-3.322.715-3.708c.146-.088.337-.128.562-.128v-1.09c-.41 0-.783.088-1.105.273c-1.375.793-1.683 3.263-.974 6.365C1.981 8.603 0 10.104 0 11.689c0 1.59 1.991 3.097 5.044 4.03c-.705 3.112-.392 5.588.988 6.38c.318.186.69.274 1.1.274c1.346 0 3.107-.959 4.888-2.622c1.78 1.653 3.541 2.602 4.887 2.602a2.2 2.2 0 0 0 1.105-.274c1.375-.792 1.683-3.262.974-6.364C22.019 14.781 24 13.274 24 11.689m-6.37-3.263a22 22 0 0 1-.66 1.932a26 26 0 0 0-1.345-2.319q1.044.153 2.006.387m-2.24 5.21a26 26 0 0 1-1.179 1.869a25.5 25.5 0 0 1-4.412.005a25.5 25.5 0 0 1-2.201-3.806a26 26 0 0 1 2.192-3.82a25.5 25.5 0 0 1 4.411-.006q.61.875 1.184 1.86q.557.961 1.018 1.946a27 27 0 0 1-1.013 1.952M16.97 13c.264.656.49 1.311.675 1.947c-.64.157-1.316.289-2.015.391A27 27 0 0 0 16.97 13m-4.96 5.22q-.684-.706-1.36-1.566c.44.02.89.035 1.345.035q.691.001 1.36-.035c-.44.573-.895 1.096-1.345 1.566m-3.64-2.882a22 22 0 0 1-2.006-.386c.181-.631.406-1.282.66-1.932c.201.39.412.782.642 1.174q.345.587.704 1.144m3.615-10.18q.684.706 1.36 1.566c-.44-.02-.89-.035-1.345-.035q-.691-.001-1.36.035c.44-.573.895-1.096 1.345-1.566M8.365 8.04a27 27 0 0 0-1.34 2.333a21 21 0 0 1-.675-1.947c.64-.152 1.316-.284 2.015-.386m-4.427 6.124c-1.732-.738-2.852-1.707-2.852-2.475s1.12-1.742 2.852-2.475c.42-.181.88-.343 1.355-.494c.279.958.646 1.956 1.1 2.979a23 23 0 0 0-1.085 2.964a15 15 0 0 1-1.37-.499m2.632 6.99c-.665-.38-.954-1.834-.729-3.702c.054-.46.142-.945.25-1.439c.958.235 2.005.416 3.106.534a24 24 0 0 0 2.035 2.446c-1.595 1.482-3.092 2.294-4.11 2.294a1.2 1.2 0 0 1-.552-.132m11.604-3.727c.23 1.869-.054 3.322-.715 3.708c-.146.088-.337.127-.562.127c-1.013 0-2.515-.807-4.11-2.28a23 23 0 0 0 2.021-2.44a23 23 0 0 0 3.111-.538q.171.74.255 1.423m1.883-3.263c-.42.181-.88.343-1.355.494a23.5 23.5 0 0 0-1.1-2.979c.45-1.017.811-2.01 1.085-2.964q.728.227 1.375.499c1.732.738 2.852 1.707 2.852 2.475c-.005.768-1.125 1.742-2.857 2.475"
          />
          <path fill="currentColor" d="M11.995 13.925a2.236 2.236 0 1 0 0-4.472a2.236 2.236 0 0 0 0 4.472" />
        </svg>
      );
    default:
      return null;
  }
}

function TechRow({ item }: { item: TechStackMetric }) {
  const percent = Math.max(0, Math.min(1, item.value / item.max));
  const cellCount = 20;
  const litCells = Math.round(percent * cellCount);
  return (
    <div className="ef-prof__stat">
      <div className="ef-prof__stat-lead">
        <span className="ef-prof__stat-art" aria-hidden="true">
          <TechIcon id={item.id} />
        </span>
        <span className="ef-prof__stat-label">
          <span className="ef-prof__stat-copy">
            <b>{item.label}</b>
            <small>{item.subLabel}</small>
          </span>
        </span>
      </div>
      <div className="ef-prof__bar-group">
        <div className="ef-prof__bar-top">
          <span className="ef-prof__matrix" aria-hidden="true">
            {Array.from({ length: cellCount }, (_, cell) => (
              <i key={cell} className={cell < litCells ? "is-on" : undefined} />
            ))}
          </span>
          <span className="ef-prof__max">MAX {item.max}</span>
          <b className="ef-prof__val" data-count={item.value}>{String(item.value).padStart(2, "0")}</b>
        </div>
        <span
          className="ef-prof__bar"
          role="progressbar"
          aria-label={`${item.label} 技术栈进度`}
          aria-valuemin={0}
          aria-valuemax={item.max}
          aria-valuenow={item.value}
        >
          <i style={cssVars({ width: `${percent * 100}%` })} />
        </span>
      </div>
    </div>
  );
}

function MusicCard({
  music,
  player,
  cardRef,
}: {
  music: MusicPlaceholder;
  player: MusicPlayerApi;
  cardRef: RefObject<HTMLButtonElement | null>;
}) {
  const playing = player.isPlaying;
  const track = player.track;
  return (
    <button
      className="ef-prof__music"
      ref={cardRef}
      type="button"
      aria-label={playing ? `${music.label}：${track?.name ?? music.title}` : `${music.labelIdle}：${track?.name ?? music.title}`}
      onClick={player.toggle}
    >
      <span className="ef-prof__music-inner">
        <svg className="ef-prof__music-lines" viewBox="0 0 620 460" preserveAspectRatio="none" aria-hidden="true">
          <use href="#ef-prof-contours" />
        </svg>
        <span className="ef-prof__pause" aria-hidden="true">
          {playing ? (
            <>
              <i />
              <i />
            </>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M7 4.2 19.5 12 7 19.8Z" />
            </svg>
          )}
        </span>
        <span className="ef-prof__music-copy">
          <b>{playing ? music.label : music.labelIdle}</b>
          <small>{playing ? music.labelEn : music.labelEnIdle}</small>
          <span>
            {track ? `${track.name} · ${track.artist}` : `${music.title} · ${music.artist}`}
          </span>
        </span>
      </span>
    </button>
  );
}

function ProfileCard({
  player,
  panel,
  cycle,
  cardRef,
}: {
  player: PlayerContent;
  panel: ProfilePanelContent;
  cycle: SiteCycle;
  cardRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section className="ef-prof__card" ref={cardRef} aria-label="个人信息与站点周年进度">
      <svg className="ef-prof__card-lines" viewBox="0 0 620 460" preserveAspectRatio="none" aria-hidden="true">
        <use href="#ef-prof-contours" />
      </svg>
      <div className="ef-prof__card-left">
        <div className="ef-prof__days">
          <b>{String(cycle.daysOnline).padStart(3, "0")}</b>
          <span>
            / {panel.siteLabel}
            <small>DAYS ONLINE</small>
          </span>
        </div>
      </div>
      <div className="ef-prof__card-mid">
        <div className="ef-prof__card-name">{player.name}</div>
        <div className="ef-prof__card-sub">{player.sub}</div>
        <div className="ef-prof__card-uid">{player.uid}</div>
      </div>
      <b className="ef-prof__card-max">:: MAX {cycle.cycleDays}</b>
      <div className="ef-prof__portrait">
        {player.avatar ? <img src={assetUrl(player.avatar)} alt={player.avatarLabel} /> : player.avatarLabel}
        <i className="ef-prof__portrait-corner ef-prof__portrait-corner--gray" aria-hidden="true" />
        <i className="ef-prof__portrait-corner ef-prof__portrait-corner--black" aria-hidden="true" />
      </div>
      <div className="ef-prof__card-bio">{panel.bio}</div>
      <div
        className="ef-prof__card-bar"
        role="progressbar"
        aria-label={`站点周年进度：已过去 ${cycle.cycleDay} 天，距下一周年 ${cycle.daysLeft} 天`}
        aria-valuemin={0}
        aria-valuemax={cycle.cycleDays}
        aria-valuenow={cycle.cycleDay}
      >
        <i style={cssVars({ width: `${cycle.progress * 100}%` })} />
      </div>
    </section>
  );
}

export function ProfilePanel({
  player,
  panel,
  music,
  startDate,
  onClose,
}: {
  player: PlayerContent;
  panel: ProfilePanelContent;
  music: MusicPlayerApi;
  startDate: string;
  onClose: () => void;
}) {
  const dimRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const musicRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const entranceRef = useRef<gsap.core.Timeline | null>(null);
  const closingRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scale = useBoardScale();
  const cycle = getSiteCycle(startDate);
  const startLabel = formatMonthDay(startDate);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    entranceRef.current?.kill();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    const rail = railRef.current;
    const page = pageRef.current;
    const music = musicRef.current;
    const card = cardRef.current;
    const dim = dimRef.current;
    if (!rail || !page || !music || !card || !dim) return;
    const timeline = gsap.timeline({ onComplete: onClose });
    timeline
      .to(card, { opacity: 0, y: 18, duration: 0.16, ease: "power2.in" }, 0)
      .to(music, { opacity: 0, y: 18, duration: 0.16, ease: "power2.in" }, 0.05)
      .to(page, { opacity: 0, y: 14, duration: 0.16, ease: "power2.in" }, 0.1)
      .to(rail, { opacity: 0, x: -18, duration: 0.16, ease: "power2.in" }, 0.14)
      .to(dim, { opacity: 0, duration: 0.14, ease: "none" }, 0.16);
    if (closeRef.current) timeline.to(closeRef.current, { opacity: 0, duration: 0.12, ease: "none" }, 0.1);
  }, [onClose]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const page = pageRef.current;
    const music = musicRef.current;
    const card = cardRef.current;
    const close = closeRef.current;
    const dim = dimRef.current;
    if (!rail || !page || !music || !card || !close || !dim) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bars = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(".ef-prof__bar i, .ef-prof__card-bar i") ?? [],
    );
    const counters = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(".ef-prof__val") ?? []).map((el) => ({
      el,
      end: Number(el.dataset.count ?? 0),
      state: { value: 0 },
    }));
    if (reduced) {
      gsap.set([dim, rail, page, music, card, close], { opacity: 1, x: 0, y: 0 });
      return;
    }

    gsap.set(dim, { opacity: 0 });
    gsap.set(rail, { opacity: 0, x: -26 });
    gsap.set(page, { opacity: 0, y: 28 });
    gsap.set(music, { opacity: 0, y: 30 });
    gsap.set(card, { opacity: 0, y: 34 });
    gsap.set(close, { opacity: 0 });
    gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
    counters.forEach(({ el }) => {
      el.textContent = "00";
    });

    const timeline = gsap.timeline();
    timeline
      .to(dim, { opacity: 1, duration: 0.18, ease: "none" }, 0)
      .to(rail, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, 0.04)
      .to(page, { opacity: 1, y: 0, duration: 0.34, ease: "power2.out" }, 0.14)
      .to(music, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.26)
      .to(card, { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" }, 0.36)
      .to(close, { opacity: 1, duration: 0.2, ease: "none" }, 0.46)
      .to(bars, { scaleX: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" }, 0.3);
    counters.forEach(({ el, end, state }, i) => {
      timeline.to(
        state,
        {
          value: end,
          duration: 0.55,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(state.value)).padStart(2, "0");
          },
          onComplete: () => {
            el.textContent = String(end).padStart(2, "0");
          },
        },
        0.3 + i * 0.06,
      );
    });
    entranceRef.current = timeline;

    return () => {
      timeline.kill();
    };
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [requestClose]);

  return (
    <div
      className="ef-prof"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="个人档案"
      tabIndex={-1}
      style={cssVars({ "--ef-prof-scale": scale })}
    >
      <div className="ef-prof__dim" ref={dimRef} onClick={requestClose} />
      <svg width="0" height="0" className="ef-prof__defs" aria-hidden="true">
        <defs>
          <g id="ef-prof-contours" fill="none" stroke="#c9cbb8" strokeWidth="1">
            {CONTOUR_PATHS.map((path, index) => (
              <path key={index} d={path} strokeOpacity={index % 4 === 0 ? 0.5 : 0.22} />
            ))}
          </g>
        </defs>
      </svg>
      <div className="ef-prof__frame">
        <div className="ef-prof__fit">
          <div className="ef-prof__board">
            <aside className="ef-prof__rail" ref={railRef} aria-hidden="true">
              <div className="ef-prof__rail-meta">
                <span>EF // PERSONAL FILE</span>
                <span>NO. {player.uid.replace("UID:", "")}</span>
                <span>EST. {startLabel}</span>
              </div>
              <div className="ef-prof__rail-copy">
                <span>{panel.railSmall}</span>
                <b>{panel.railBig}</b>
              </div>
              <div className="ef-prof__spine">
                <i />
              </div>
            </aside>

            <section className="ef-prof__page" ref={pageRef} aria-label="技术栈档案">
              <svg className="ef-prof__contours" viewBox="0 0 620 460" preserveAspectRatio="none" aria-hidden="true">
                <use href="#ef-prof-contours" />
              </svg>
              <div className="ef-prof__page-inner">
                <div className="ef-prof__stats">
                  {panel.techStack.map((item) => (
                    <TechRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </section>

            <MusicCard music={panel.music} player={music} cardRef={musicRef} />
            <ProfileCard player={player} panel={panel} cycle={cycle} cardRef={cardRef} />

            <button className="ef-prof__close" ref={closeRef} type="button" onClick={requestClose} title="关闭" aria-label="关闭个人档案">
              <CloseIcon className="ef-prof__close-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
