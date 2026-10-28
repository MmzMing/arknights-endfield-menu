import { useEffect, useMemo, useRef, useState } from "react";
import type { DialogContent } from "../config/menu-content";
import {
  HOME_LOGO_BLACK_PATH,
  HOME_LOGO_PLATE,
  HOME_LOGO_VIEWBOX,
  HOME_LOGO_WHITE_PATH,
} from "../assets/home-logo";
import { useBootResources } from "../hooks/use-boot-resources";
import { DialogRasterWarm, type DialogWarmProgress } from "./dialog-raster-warm";
import "../styles/boot-screen.css";

const MIN_SHOW_MS = 900;
const HOLD_DONE_MS = 420;
const EXIT_MS = 2400;
const EXIT_REDUCED_MS = 220;
const TWEEN_EPS = 0.004;
const REDUCED_SCALE = 0.4;
// 真实进度是离散的任务完成数；等待订阅时会长时间不动。用一条时间曲线做保底爬升，
// 资源完成只作为更快的前进量，保证条形始终平滑滑动，未完成前最高爬到 94%。
const SMOOTH_MS = 7000;
const SMOOTH_CAP = 0.94;
const COAST_TAU_MS = 180;
const FINISH_TAU_MS = 90;

/* 全屏加载页：复刻《明日方舟：终末地》的加载界面。资源与真实弹窗快照都完成后才退出；
   进度条从上往下伸展，背景等高线随进度由模糊渐清（右侧渐入），文字随进度条末端下移；
   完成时黄色自左向右覆盖，随后整页渐出。失败可重试或以基础模式进入。
   布局数值取自官方加载页的样式表，按 2560×1440 设计稿缩放（见 boot-screen.css）。 */

export function BootScreen({
  texts,
  images,
  contents,
  onDone,
}: {
  texts: string[];
  images: string[];
  contents: readonly DialogContent[] | null;
  onDone: (canAnimate: boolean) => void;
}) {
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // 预设输入只取挂载时那一份：动态订阅更新不能把用户重新关回加载页。
  const [inputs] = useState(() => ({ texts, images }));
  const [basicMode, setBasicMode] = useState(false);
  const [warmAttempt, setWarmAttempt] = useState(0);
  const [runEpoch, setRunEpoch] = useState(0);
  const [warm, setWarm] = useState<DialogWarmProgress>({ completed: 0, total: 0, errors: [] });
  const resources = useBootResources(inputs.texts, inputs.images);
  const canAnimate = resources.canAnimate && !basicMode;
  const pendingWarm = canAnimate && contents !== null && (warm.total === 0 || warm.completed < warm.total);
  const errors = [...resources.errors, ...warm.errors];
  const isReady = basicMode || (resources.isReady && (!canAnimate ||
    (warm.total > 0 && warm.completed === warm.total && warm.errors.length === 0)));
  const progress = resources.completed / resources.total * 0.35 +
    (canAnimate ? (warm.total > 0 ? warm.completed / warm.total : 0) * 0.65 : 0);

  const retry = () => {
    setBasicMode(false);
    setWarm({ completed: 0, total: 0, errors: [] });
    setWarmAttempt((value) => value + 1);
    setRunEpoch((value) => value + 1);
    resources.retry();
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const [exiting, setExiting] = useState(false);
  const stateRef = useRef({ progress, isReady, canAnimate, onDone });
  useEffect(() => {
    stateRef.current = { progress, isReady, canAnimate, onDone };
  }, [canAnimate, isReady, onDone, progress]);

  useEffect(() => {
    const started = performance.now();
    let displayed = 0;
    let lastShown = -1;
    let lastFrame = 0;
    let frame = 0;
    let readyAt = 0;
    let exitAt = 0;
    // 进度变量、读数文本与 aria 值在同一帧直写（条形高度、读数位置、背景模糊同源），不走 React state。
    const tween = (now: number) => {
      const state = stateRef.current;
      const dt = lastFrame ? Math.min(64, now - lastFrame) : 16;
      lastFrame = now;
      const t = Math.min(1, (now - started) / SMOOTH_MS);
      const timeTarget = (1 - (1 - t) ** 3) * SMOOTH_CAP;
      const target = state.isReady ? 1 : Math.max(Math.min(0.99, state.progress), timeTarget);
      const tau = state.isReady ? FINISH_TAU_MS : COAST_TAU_MS;
      displayed += reduced ? target - displayed : (target - displayed) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - displayed) < TWEEN_EPS) displayed = target;
      rootRef.current?.style.setProperty("--ef-boot-progress", displayed.toFixed(4));
      const next = Math.min(state.isReady ? 100 : 99, Math.round(displayed * 100));
      if (next !== lastShown) {
        lastShown = next;
        if (valueRef.current) valueRef.current.textContent = String(next);
        progressRef.current?.setAttribute("aria-valuenow", String(next));
      }
      if (!state.isReady) {
        readyAt = 0;
        if (exitAt) { exitAt = 0; setExiting(false); }
      } else if (displayed >= 0.999 && now - started >= (reduced ? MIN_SHOW_MS * REDUCED_SCALE : MIN_SHOW_MS)) {
        if (!readyAt) readyAt = now;
        if (!exitAt && now - readyAt >= (reduced ? 0 : HOLD_DONE_MS)) {
          exitAt = now;
          setExiting(true);
        }
        if (exitAt && now - exitAt >= (reduced ? EXIT_REDUCED_MS : EXIT_MS)) {
          state.onDone(state.canAnimate);
          return;
        }
      }
      frame = requestAnimationFrame(tween);
    };
    frame = requestAnimationFrame(tween);
    return () => cancelAnimationFrame(frame);
  }, [reduced, runEpoch]);

  return (
    <div
      className="ef-boot"
      ref={rootRef}
      data-exiting={exiting ? "true" : "false"}
    >
      <div className="ef-boot__bg" aria-hidden="true" />
      <div className="ef-boot__logo" aria-hidden="true">
        <svg viewBox={HOME_LOGO_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
          <rect
            x={HOME_LOGO_PLATE.x}
            y={HOME_LOGO_PLATE.y}
            width={HOME_LOGO_PLATE.width}
            height={HOME_LOGO_PLATE.height}
            fill="currentColor"
          />
          <path fillRule="evenodd" fill="currentColor" d={HOME_LOGO_WHITE_PATH} />
          <path fillRule="evenodd" fill="#141414" d={HOME_LOGO_BLACK_PATH} />
        </svg>
      </div>
      <div className="ef-boot__more" aria-hidden="true">
        <div className="ef-boot__deco" />
        <div className="ef-boot__divider" />
        <p className="ef-boot__slogan">OVER THE FRONTIER / INTO THE FRONT</p>
        <div className="ef-boot__triangles" />
      </div>
      <div
        className="ef-boot__progress"
        ref={progressRef}
        role="progressbar"
        aria-label="正在加载站点预设"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <div className="ef-boot__bar" />
        <div className="ef-boot__readout">
          <div className="ef-boot__core">
            <span className="ef-boot__value" ref={valueRef}>0</span>
            <span className="ef-boot__symbol">%</span>
          </div>
          <div className="ef-boot__updating">Updating...</div>
        </div>
      </div>
      {errors.length > 0 && !basicMode && (
        <div className="ef-boot__error" role="alert">
          <p>{errors.join("、")}准备未完成，请重试或以无像素转场的基础模式进入。</p>
          <div className="ef-boot__actions">
            <button type="button" onClick={retry}>重试加载</button>
            <button type="button" onClick={() => setBasicMode(true)}>以基础模式进入</button>
          </div>
        </div>
      )}
      {contents !== null && pendingWarm && (
        <DialogRasterWarm
          key={`${resources.attempt}:${warmAttempt}`}
          contents={contents}
          onProgress={setWarm}
        />
      )}
    </div>
  );
}
