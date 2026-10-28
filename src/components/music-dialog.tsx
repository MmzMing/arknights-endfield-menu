import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { createTopoContourPaths } from "../lib/topo-contours";
import { formatMusicTime } from "../lib/music";
import { MUSIC_DIALOG_COPY } from "../config/music-config";
import type { MusicPlayerApi, MusicTimeSnapshot } from "../hooks/use-music-player";
import { CloseIcon } from "./close-icon";
import "../styles/music-dialog.css";

/* 音乐终端弹窗：从主菜单的圆盘语言演进而来——
   左侧是唱片转盘：黑胶唱片 + 方形封面 + 由真实音频频谱驱动的连续波形环；
   右侧是一张完整面板（右上斜切缺口）：斜纹标题、信号条、走带键与音频波形进度条同处一张纸；
   下方曲目是一排带封面的卡片，左缘贴时间轴圆点，选中/悬停时斜纹黄块从左滑入；
   歌单 / 歌词由卡片右缘的磁带签切换，歌词模式压缩标题区并把当前行放大成黄色高亮。 */

const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 780;
const CONTOUR_PATHS = createTopoContourPaths({
  width: 620,
  height: 680,
  step: 12,
  levels: 15,
  seed: 20261025,
});

const WAVE_BARS = Array.from({ length: 64 }, (_, index) => {
  const group = [0.38, 0.82, 0.58, 0.74, 0.32, 0.66, 0.9, 0.48][index % 8];
  const arch = 0.58 + 0.42 * Math.sin((index / 63) * Math.PI);
  return Number((0.18 + group * arch * 0.82).toFixed(3));
});

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 画板按 1200×780 设计，整体等比缩放到视口内；窄屏改为纵向排布。 */
function useBoardScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      if (window.innerWidth <= 900) {
        setScale(1);
        return;
      }
      const gutter = 28;
      setScale(
        Math.min(1, (window.innerWidth - gutter * 2) / BOARD_WIDTH, (window.innerHeight - gutter * 2) / BOARD_HEIGHT),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

function Equalizer({ small }: { small?: boolean }) {
  return (
    <span className={`ef-mus__eq${small ? " ef-mus__eq--small" : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18.4a3 3 0 1 1-2-2.82V6.1L19 3.6v11.4a3 3 0 1 1-2-2.82V7.1L9 9.1Z" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h8" />
      <path d="M3.6 5.2v3.1l2.6-1.55ZM3.6 10.4v3.1l2.6-1.55ZM3.6 15.9v3.1l2.6-1.55Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LyricIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <path d="M4 5.5h16v10.5H10.5L4 20Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5 20 12 6.5 20.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 4h4.5v16H5.5zM14 4h4.5v16H14z" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h2.4v16H6zM19.5 4.5 10 12l9.5 7.5Z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.6 4H18v16h-2.4zM4.5 4.5 14 12l-9.5 7.5Z" />
    </svg>
  );
}

function ModeIcon({ mode }: { mode: number }) {
  if (mode === 1) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M17 3.5 21 7.5 17 11.5M3.5 7.5H21M7 20.5 3 16.5 7 12.5M20.5 16.5H3" />
        <path d="M10.6 10.2 12.6 9.4v5.4" />
      </svg>
    );
  }
  if (mode === 2) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M3.5 7h3.2l9.8 10h4M17 13.5l3.5 3.5L17 20.5M3.5 17h3.2l3.1-3.2M14 7h2.5l3.5 3.5L16.5 14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M17 3.5 21 7.5 17 11.5M3.5 7.5H21M7 20.5 3 16.5 7 12.5M20.5 16.5H3" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.2h3.6L12.8 5v14l-5.2-4.2H4Z" />
      {muted ? (
        <path d="m16 9.4 5 5.2m0-5.2-5 5.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
      ) : (
        <path
          d="M15.6 9.1a4.2 4.2 0 0 1 0 5.8M18.3 6.6a7.8 7.8 0 0 1 0 10.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function MusicDialog({ player, onClose }: { player: MusicPlayerApi; onClose: () => void }) {
  const copy = MUSIC_DIALOG_COPY;
  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const infoRef = useRef<HTMLElement>(null);
  const transportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const seekRailRef = useRef<HTMLDivElement>(null);
  const seekCanvasRef = useRef<HTMLCanvasElement>(null);
  const seekThumbRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const timeCurrentRef = useRef<HTMLSpanElement>(null);
  const timeTotalRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const lyricListRef = useRef<HTMLDivElement>(null);
  const lyricHoldRef = useRef(0);
  const closingRef = useRef(false);
  const entranceRef = useRef<gsap.core.Timeline | null>(null);
  const closeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCloseRef = useRef(onClose);
  const [tab, setTab] = useState<"playlist" | "lyrics">("playlist");
  const scale = useBoardScale();

  const { onTime, seekRatio, setVolume, onSpectrum } = player;
  const progress = player.isMuted ? 0 : player.volume;
  const track = player.track;
  const indexLabel = track ? String(player.currentIndex + 1).padStart(2, "0") : "--";
  const modeLabel = player.playMode === 1 ? "单曲循环" : player.playMode === 2 ? "随机播放" : "列表循环";
  const statusLabel = player.status === "ready" ? "NOW PLAYING" : player.status === "error" ? "OFFLINE" : "STANDBY";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    const root = rootRef.current;
    if (!root || closingRef.current) return;
    closingRef.current = true;
    root.dataset.phase = "closing";
    entranceRef.current?.kill();
    if (prefersReducedMotion() || !closeTimelineRef.current) {
      onCloseRef.current();
      return;
    }
    closeTimelineRef.current.play(0);
  }, []);

  // 进度与时间由播放引擎直接写 DOM，不进 React state。
  useEffect(() => {
    return onTime((snapshot: MusicTimeSnapshot) => {
      durationRef.current = snapshot.duration;
      currentTimeRef.current = snapshot.currentTime;
      progressRef.current = snapshot.progress;
      seekRailRef.current?.setAttribute("aria-valuenow", String(Math.round(snapshot.progress)));
      if (seekingRef.current) return;
      if (seekThumbRef.current) seekThumbRef.current.style.left = `${snapshot.progress}%`;
      if (timeCurrentRef.current) timeCurrentRef.current.textContent = snapshot.currentTimeStr;
      if (timeTotalRef.current) timeTotalRef.current.textContent = snapshot.durationStr;
    });
  }, [onTime]);

  // 真实频谱驱动两处可视化：唱片外圈的连续波形环 + 走带区的实时频谱进度。
  useEffect(() => {
    const ringCanvas = waveCanvasRef.current;
    const ring = ringCanvas?.getContext("2d");
    const seekCanvas = seekCanvasRef.current;
    const seek = seekCanvas?.getContext("2d");
    if (!ringCanvas || !ring || !seekCanvas || !seek) return;

    const ringSize = 560;
    const center = ringSize / 2;
    const baseRadius = 212;
    const amplitude = 42;
    const ringPoints = 160;
    const bands = 64;
    const reduced = prefersReducedMotion();

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    ringCanvas.width = ringSize * ratio;
    ringCanvas.height = ringSize * ratio;
    ring.scale(ratio, ratio);

    const seekWidth = 1280;
    const seekHeight = 64;
    seekCanvas.width = seekWidth;
    seekCanvas.height = seekHeight;

    const samples = new Float32Array(bands);
    const bandValues = new Float32Array(bands);
    const ringValues = new Float32Array(ringPoints);
    const ringGoals = new Float32Array(ringPoints);
    const ringX = new Float32Array(ringPoints);
    const ringY = new Float32Array(ringPoints);
    const seekValues = new Float32Array(ringPoints);
    for (let point = 0; point < ringPoints; point += 1) {
      seekValues[point] = (WAVE_BARS[Math.floor((point / ringPoints) * WAVE_BARS.length)] ?? 0) * 0.3;
    }

    const paintRingBase = () => {
      ring.clearRect(0, 0, ringSize, ringSize);
      ring.beginPath();
      ring.arc(center, center, baseRadius, 0, Math.PI * 2);
      ring.strokeStyle = "rgba(242, 241, 233, 0.16)";
      ring.lineWidth = 1;
      ring.stroke();
    };

    // 同一个频谱包络转成横向波形，左侧已播放为墨色，右侧未播放为浅灰。
    const staticValue = (point: number) =>
      WAVE_BARS[Math.floor((point / ringPoints) * WAVE_BARS.length)] ?? 0;

    const paintSeek = () => {
      const progress = progressRef.current / 100;
      seek.clearRect(0, 0, seekWidth, seekHeight);
      const mid = seekHeight / 2;
      const path = new Path2D();
      path.moveTo(0, mid);
      for (let point = 0; point < ringPoints; point += 1) {
        const value = reduced ? staticValue(point) : seekValues[point];
        const x = (point / (ringPoints - 1)) * seekWidth;
        path.lineTo(x, mid - (2 + value * (mid - 5)));
      }
      for (let point = ringPoints - 1; point >= 0; point -= 1) {
        const value = reduced ? staticValue(point) : seekValues[point];
        const x = (point / (ringPoints - 1)) * seekWidth;
        path.lineTo(x, mid + (2 + value * (mid - 5)));
      }
      path.closePath();

      seek.fillStyle = "rgba(21, 23, 14, 0.18)";
      seek.fill(path);
      if (progress > 0) {
        seek.save();
        seek.beginPath();
        seek.rect(0, 0, seekWidth * Math.min(1, progress), seekHeight);
        seek.clip();
        seek.fillStyle = "rgba(21, 23, 14, 0.88)";
        seek.fill(path);
        seek.restore();
      }
    };

    paintRingBase();
    paintSeek();

    const draw = (spectrum: Uint8Array) => {
      for (let band = 0; band < bands; band += 1) {
        const start = 2 + Math.floor(Math.pow(band / bands, 1.55) * 176);
        const end = 2 + Math.floor(Math.pow((band + 1) / bands, 1.55) * 176);
        let sum = 0;
        let count = 0;
        for (let bin = start; bin < end && bin < spectrum.length; bin += 1) {
          sum += spectrum[bin];
          count += 1;
        }
        const average = count > 0 ? sum / count / 255 : 0;
        samples[band] = Math.min(1, average * (0.72 + (band / bands) * 0.9));
      }
      for (let band = 0; band < bands; band += 1) {
        const previous = samples[(band - 1 + bands) % bands];
        const next = samples[(band + 1) % bands];
        bandValues[band] = (previous + samples[band] * 2 + next) / 4;
      }
      let peak = 0;
      for (const sample of bandValues) peak = Math.max(peak, sample);
      const scale = 1 / Math.max(peak, 0.26);

      if (!reduced) {
        for (let point = 0; point < ringPoints; point += 1) {
          const position = (point / ringPoints) * bands;
          const lower = Math.floor(position);
          const fraction = position - lower;
          const first = bandValues[lower] ?? 0;
          const second = bandValues[Math.min(lower + 1, bands - 1)] ?? first;
          const value = first + (second - first) * fraction;
          ringGoals[point] = Math.pow(Math.min(1, value * scale), 1.35);
        }
        for (let point = 0; point < ringPoints; point += 1) {
          const goal = ringGoals[point];
          ringValues[point] += (goal - ringValues[point]) * (goal > ringValues[point] ? 0.16 : 0.07);
          seekValues[point] += (goal - seekValues[point]) * (goal > seekValues[point] ? 0.32 : 0.12);
        }

        paintRingBase();
        for (let point = 0; point < ringPoints; point += 1) {
          const angle = (point / ringPoints) * Math.PI * 2 - Math.PI / 2;
          const radius = baseRadius + ringValues[point] * amplitude;
          ringX[point] = center + Math.cos(angle) * radius;
          ringY[point] = center + Math.sin(angle) * radius;
        }
        const last = ringPoints - 1;
        ring.beginPath();
        ring.moveTo((ringX[last] + ringX[0]) / 2, (ringY[last] + ringY[0]) / 2);
        for (let point = 0; point < ringPoints; point += 1) {
          const next = (point + 1) % ringPoints;
          ring.quadraticCurveTo(
            ringX[point],
            ringY[point],
            (ringX[point] + ringX[next]) / 2,
            (ringY[point] + ringY[next]) / 2,
          );
        }
        ring.closePath();
        ring.strokeStyle = "rgba(245, 246, 75, 0.92)";
        ring.lineWidth = 2.2;
        ring.lineJoin = "round";
        ring.lineCap = "round";
        ring.shadowColor = "rgba(245, 246, 75, 0.55)";
        ring.shadowBlur = 12;
        ring.stroke();
        ring.shadowBlur = 0;
      }

      paintSeek();
    };

    return onSpectrum(draw);
  }, [onSpectrum]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const dim = dimRef.current;
    const panel = panelRef.current;
    const stage = stageRef.current;
    const cover = coverRef.current;
    const badge = badgeRef.current;
    const info = infoRef.current;
    const transport = transportRef.current;
    const list = listRef.current;
    const close = closeRef.current;
    if (!root || !dim || !panel || !stage || !cover || !badge || !info || !transport || !list || !close) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const reduced = prefersReducedMotion();
    root.dataset.phase = "entering";
    close.focus({ preventScroll: true });

    const title = info.querySelector<HTMLElement>(".ef-mus__title-inner");
    const controls = transport.querySelectorAll<HTMLElement>(".ef-mus__ctl");
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".ef-mus__row")).slice(0, 14);

    const context = gsap.context(() => {
      if (reduced) {
        gsap.set([dim, panel, stage, badge, info, transport, list, close, title, ...controls, ...rows], { opacity: 1, x: 0, y: 0, scale: 1, yPercent: 0 });
        root.dataset.phase = "open";
        return;
      }

      gsap.set(dim, { opacity: 0 });
      gsap.set(panel, { opacity: 0, y: 14 });
      gsap.set(stage, { opacity: 0, scale: 0.84, transformOrigin: "50% 50%" });
      gsap.set(cover, { opacity: 0, scale: 0.92 });
      gsap.set(badge, { opacity: 0, y: -12 });
      gsap.set(info, { opacity: 0, x: 30 });
      gsap.set(transport, { opacity: 0, y: 16 });
      gsap.set(list, { opacity: 0, y: 26 });
      gsap.set(close, { opacity: 0 });
      gsap.set(title, { yPercent: 120 });
      gsap.set(controls, { opacity: 0, y: 10 });
      gsap.set(rows, { opacity: 0, y: 8 });

      const entrance = gsap
        .timeline({ onComplete: () => { root.dataset.phase = "open"; } })
        .to(dim, { opacity: 1, duration: 0.22, ease: "none" }, 0)
        .to(panel, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.04)
        .to(stage, { opacity: 1, scale: 1, duration: 0.62, ease: "power3.out" }, 0)
        .to(cover, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, 0.12)
        .to(badge, { opacity: 1, y: 0, duration: 0.34, ease: "power3.out" }, 0.2)
        .to(info, { opacity: 1, x: 0, duration: 0.52, ease: "power3.out" }, 0.12)
        .to(title, { yPercent: 0, duration: 0.5, ease: "power4.out" }, 0.2)
        .to(transport, { opacity: 1, y: 0, duration: 0.46, ease: "power3.out" }, 0.24)
        .to(controls, { opacity: 1, y: 0, duration: 0.38, stagger: 0.035, ease: "power2.out" }, 0.3)
        .to(list, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.28)
        .to(close, { opacity: 1, duration: 0.22, ease: "none" }, 0.38);
      if (rows.length > 0) {
        entrance.to(rows, { opacity: 1, y: 0, duration: 0.26, stagger: 0.02, ease: "power2.out" }, 0.4);
      }
      entranceRef.current = entrance;

      const closeTimeline = gsap.timeline({ paused: true, onComplete: () => onCloseRef.current() });
      closeTimeline
        .to(close, { opacity: 0, duration: 0.08, ease: "none" }, 0)
        .to([badge, info, transport, list], { opacity: 0, x: 12, duration: 0.18, stagger: 0.02, ease: "power2.in" }, 0.02)
        .to(panel, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0.08)
        .to([stage, cover], { opacity: 0, scale: 0.96, duration: 0.26, ease: "power2.in" }, 0)
        .to(dim, { opacity: 0, duration: 0.16, ease: "none" }, 0.16);
      closeTimelineRef.current = closeTimeline;
    }, root);

    return () => {
      context.revert();
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

  useEffect(() => {
    if (tab !== "lyrics" || player.currentLrcIndex < 0) return;
    if (Date.now() < lyricHoldRef.current) return;
    const list = lyricListRef.current;
    const line = list?.querySelector<HTMLElement>(`[data-line="${player.currentLrcIndex}"]`);
    if (!list || !line) return;
    // 等卡片完成高度过渡后再居中，否则会按旧高度计算滚动位置。
    const timer = window.setTimeout(() => {
      if (Date.now() < lyricHoldRef.current) return;
      list.scrollTo({
        top: line.offsetTop - list.clientHeight / 2 + line.offsetHeight / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }, 360);
    return () => window.clearTimeout(timer);
  }, [player.currentLrcIndex, tab]);

  const startSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    const rail = seekRailRef.current;
    if (!rail) return;
    event.preventDefault();
    const rect = rail.getBoundingClientRect();
    seekingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const apply = (clientX: number) => {
      const ratio = clamp01((clientX - rect.left) / (rect.width || 1));
      progressRef.current = ratio * 100;
      if (seekThumbRef.current) seekThumbRef.current.style.left = `${ratio * 100}%`;
      if (timeCurrentRef.current) timeCurrentRef.current.textContent = formatMusicTime(ratio * durationRef.current);
      return ratio;
    };
    apply(event.clientX);
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => apply(moveEvent.clientX);
    const end = (upEvent: PointerEvent) => {
      seekingRef.current = false;
      seekRatio(apply(upEvent.clientX));
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  const startVolume = (event: React.PointerEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;
    event.preventDefault();
    const rect = rail.getBoundingClientRect();
    rail.setPointerCapture(event.pointerId);
    const apply = (clientY: number) => clamp01((rect.bottom - clientY) / (rect.height || 1));
    const fill = rail.firstElementChild as HTMLElement | null;
    const paint = (ratio: number) => {
      if (fill) fill.style.height = `${ratio * 100}%`;
    };
    paint(apply(event.clientY));
    const move = (moveEvent: PointerEvent) => paint(apply(moveEvent.clientY));
    const end = (upEvent: PointerEvent) => {
      setVolume(apply(upEvent.clientY));
      rail.removeEventListener("pointermove", move);
      rail.removeEventListener("pointerup", end);
      rail.removeEventListener("pointercancel", end);
    };
    rail.addEventListener("pointermove", move);
    rail.addEventListener("pointerup", end);
    rail.addEventListener("pointercancel", end);
  };

  return (
    <div
      className="ef-mus"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="音乐终端"
      data-phase="entering"
      data-playing={player.isPlaying ? "true" : "false"}
      data-status={player.status}
      data-tab={tab}
      style={{ "--ef-mus-scale": scale } as CSSProperties}
    >
      <div className="ef-mus__dim" ref={dimRef} onClick={requestClose} />
      <svg width="0" height="0" className="ef-mus__defs" aria-hidden="true">
        <defs>
          <g id="ef-mus-contours" fill="none" stroke="#c9cbb8" strokeWidth="1">
            {CONTOUR_PATHS.map((path, index) => (
              <path key={index} d={path} strokeOpacity={index % 4 === 0 ? 0.5 : 0.22} />
            ))}
          </g>
        </defs>
      </svg>

      <div className="ef-mus__frame">
        <div className="ef-mus__fit">
          <div className="ef-mus__board">
            <span className="ef-mus__glow" aria-hidden="true" />

            <div className="ef-mus__deck" ref={stageRef}>
              <span className="ef-mus__watermark" aria-hidden="true">
                {copy.titleEn}
              </span>
              <span className="ef-mus__badge" ref={badgeRef}>
                <NoteIcon />
                {copy.title}
                <small>TALOS-II</small>
              </span>
              <canvas className="ef-mus__spectrum" ref={waveCanvasRef} width={560} height={560} aria-hidden="true" />
              <button
                className="ef-mus__player"
                type="button"
                aria-label={player.isPlaying ? "暂停" : "播放"}
                onClick={player.toggle}
              >
                <span className="ef-mus__vinyl" aria-hidden="true">
                  <svg className="ef-mus__vinyl-lines" viewBox="0 0 560 560" preserveAspectRatio="none">
                    <use href="#ef-mus-contours" />
                  </svg>
                </span>
              </button>
              <span className="ef-mus__cover" ref={coverRef}>
                <span className="ef-mus__cover-fallback" aria-hidden="true">
                  <Equalizer />
                  <b>{copy.titleEn}</b>
                </span>
                {track?.pic && (
                  <img
                    key={track.url}
                    src={track.pic}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <span className="ef-mus__cover-bar">
                  <b>NO. {indexLabel}</b>
                </span>
              </span>
              <span className="ef-mus__vinyl-label" aria-hidden="true">
                <b>EF</b>
                {track?.pic && (
                  <img
                    key={`label-${track.url}`}
                    src={track.pic}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <i className="ef-mus__label-hole" />
              </span>
            </div>

            <div className="ef-mus__panel" ref={panelRef}>
            <section className="ef-mus__info" ref={infoRef} aria-label="当前曲目">
              <span className="ef-mus__info-mark" aria-hidden="true">
                AUDIO
              </span>
              <div className="ef-mus__info-head">
                <span className="ef-mus__info-kicker">// MUSIC +</span>
                <div className="ef-mus__title-band">
                  <div className="ef-mus__title-mask">
                    <h2 className="ef-mus__title-inner">
                      <i aria-hidden="true">[</i>
                      {track?.name ?? "等待信号"}
                      <i aria-hidden="true">]</i>
                    </h2>
                  </div>
                </div>
              </div>
              <span className="ef-mus__info-rule" aria-hidden="true" />
              <div className="ef-mus__info-chips">
                <span className="ef-mus__chip">
                  <b>ARTIST</b>
                  <i>{track?.artist ?? "—"}</i>
                </span>
                <span className="ef-mus__chip">
                  <b>STATUS</b>
                  <i>{statusLabel}</i>
                </span>
              </div>
            </section>

            <div className="ef-mus__transport" ref={transportRef} role="group" aria-label="播放控制">
              <div className="ef-mus__transport-body">
                <div className="ef-mus__seek">
                  <span className="ef-mus__time" ref={timeCurrentRef}>
                    0:00
                  </span>
                  <div
                    className="ef-mus__seekrail"
                    ref={seekRailRef}
                    role="slider"
                    aria-label="播放进度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={0}
                    tabIndex={0}
                    onPointerDown={startSeek}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") player.seekTime(currentTimeRef.current + 5);
                      if (event.key === "ArrowLeft") player.seekTime(currentTimeRef.current - 5);
                    }}
                  >
                    <canvas className="ef-mus__seekwave" ref={seekCanvasRef} width={1280} height={64} aria-hidden="true" />
                    <i className="ef-mus__seekrail-thumb" ref={seekThumbRef} aria-hidden="true" />
                  </div>
                  <span className="ef-mus__time" ref={timeTotalRef}>
                    0:00
                  </span>
                </div>

                <div className="ef-mus__controls">
                  <button
                    className="ef-mus__ctl ef-mus__ctl--mode"
                    type="button"
                    data-tip={modeLabel}
                    aria-label={modeLabel}
                    onClick={player.cycleMode}
                  >
                    <ModeIcon mode={player.playMode} />
                  </button>
                  <button
                    className="ef-mus__ctl"
                    type="button"
                    data-tip="上一首"
                    aria-label="上一首"
                    onClick={player.prev}
                  >
                    <PrevIcon />
                  </button>
                  <button
                    className="ef-mus__ctl ef-mus__ctl--play"
                    type="button"
                    data-tip={player.isPlaying ? "暂停" : "播放"}
                    aria-label={player.isPlaying ? "暂停" : "播放"}
                    onClick={player.toggle}
                  >
                    {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <button
                    className="ef-mus__ctl"
                    type="button"
                    data-tip="下一首"
                    aria-label="下一首"
                    onClick={player.next}
                  >
                    <NextIcon />
                  </button>
                  <div className="ef-mus__volume">
                    <button
                      className="ef-mus__vbtn"
                      type="button"
                      data-tip={player.isMuted || player.volume === 0 ? "取消静音" : "静音"}
                      aria-label={player.isMuted ? "取消静音" : "静音"}
                      onClick={player.toggleMute}
                    >
                      <VolumeIcon muted={player.isMuted || player.volume === 0} />
                    </button>
                    <div
                      className="ef-mus__vrail"
                      role="slider"
                      aria-label="音量"
                      aria-orientation="vertical"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      tabIndex={0}
                      onPointerDown={startVolume}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowRight") setVolume(progress + 0.05);
                        if (event.key === "ArrowDown" || event.key === "ArrowLeft") setVolume(progress - 0.05);
                      }}
                    >
                      <i style={{ height: `${progress * 100}%` }} aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ef-mus__tabs" role="tablist" aria-label="音乐面板">
              <button
                className="ef-mus__tab"
                type="button"
                role="tab"
                aria-selected={tab === "playlist"}
                data-active={tab === "playlist" ? "true" : undefined}
                onClick={() => setTab("playlist")}
              >
                <PlaylistIcon />
                <b>{copy.playlistTab}</b>
              </button>
              <button
                className="ef-mus__tab"
                type="button"
                role="tab"
                aria-selected={tab === "lyrics"}
                data-active={tab === "lyrics" ? "true" : undefined}
                onClick={() => setTab("lyrics")}
              >
                <LyricIcon />
                <b>{copy.lyricsTab}</b>
              </button>
            </div>

            <section className="ef-mus__list" ref={listRef} aria-label="歌单与歌词">
              <div className="ef-mus__views">
                <span className="ef-mus__list-mark" aria-hidden="true">
                  {tab === "lyrics" ? "LYRICS" : "INDEX"}
                </span>
                <div className="ef-mus__view" data-active={tab === "playlist" ? "true" : undefined}>
                  {player.status === "loading" && (
                    <div className="ef-mus__placeholder">
                      <span className="ef-mus__spinner" aria-hidden="true" />
                      <b>正在连接音乐档案库…</b>
                    </div>
                  )}
                  {player.status === "error" && (
                    <div className="ef-mus__placeholder">
                      <b>SIGNAL LOST</b>
                      <span>{player.error}</span>
                      <button type="button" onClick={() => player.init(true)}>
                        重新连接
                      </button>
                    </div>
                  )}
                  {player.status === "ready" && player.playlist.length === 0 && (
                    <div className="ef-mus__placeholder">
                      <b>NO TRACKS</b>
                      <span>歌单为空。</span>
                    </div>
                  )}
                  {player.playlist.map((item, index) => (
                    <button
                      key={`${item.url}-${index}`}
                      className="ef-mus__row"
                      type="button"
                      data-active={index === player.currentIndex ? "true" : undefined}
                      aria-current={index === player.currentIndex ? "true" : undefined}
                      onClick={() => player.playAt(index)}
                    >
                      <span className="ef-mus__row-no">{String(index + 1).padStart(2, "0")}</span>
                      <span className="ef-mus__row-text">
                        <b className="ef-mus__row-name">{item.name}</b>
                        <span className="ef-mus__row-slash" aria-hidden="true">/</span>
                        <i className="ef-mus__row-artist">{item.artist}</i>
                        {index === player.currentIndex ? (
                          <span className="ef-mus__row-mark" aria-hidden="true">
                            <Equalizer small />
                          </span>
                        ) : null}
                      </span>
                      <span className="ef-mus__row-art">
                        {item.pic ? <img src={item.pic} alt="" loading="lazy" /> : null}
                      </span>
                    </button>
                  ))}
                </div>

                <div
                  className="ef-mus__view"
                  data-active={tab === "lyrics" ? "true" : undefined}
                  ref={lyricListRef}
                  onWheel={() => {
                    lyricHoldRef.current = Date.now() + 3000;
                  }}
                >
                  {player.lyricsStatus === "loading" && <p className="ef-mus__lrc-note">正在解析歌词…</p>}
                  {player.lyricsStatus === "failed" && <p className="ef-mus__lrc-note">歌词获取失败。</p>}
                  {player.lyricsStatus === "none" && <p className="ef-mus__lrc-note">这首歌没有附带歌词。</p>}
                  {player.lyrics.map((line, index) => (
                    <button
                      key={`${line.time}-${index}`}
                      className="ef-mus__lrc"
                      type="button"
                      data-line={index}
                      data-active={index === player.currentLrcIndex ? "true" : undefined}
                      onClick={() => player.seekTime(line.time)}
                    >
                      {line.text}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            </div>

            <button
              className="ef-mus__close"
              ref={closeRef}
              type="button"
              title="关闭"
              aria-label="关闭音乐终端"
              onClick={requestClose}
            >
              <CloseIcon />
            </button>

            <span className="ef-mus__hint">ESC // CLOSE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
