import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DialogContent } from "../config/menu-content";
import { useBootResources } from "../hooks/use-boot-resources";
import { DialogRasterWarm, type DialogWarmProgress } from "./dialog-raster-warm";
import "../styles/boot-screen.css";

const MIN_SHOW_MS = 900;
const HOLD_DONE_MS = 420;
const EXIT_MS = 760;
const TWEEN_EPS = 0.4;
const REDUCED_SCALE = 0.4;

/* 全屏预设加载页：资源与真实弹窗快照都完成后才退出；失败可重试或以基础模式进入。
   这里的动画节奏属于该界面自身，不是 demo 迁移的测量资产。 */

export function BootScreen({
  texts,
  images,
  contents,
  identity,
  onDone,
}: {
  texts: string[];
  images: string[];
  contents: readonly DialogContent[] | null;
  identity: { name: string; code: string };
  onDone: (canAnimate: boolean) => void;
}) {
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // 预设输入只取挂载时那一份：动态订阅更新不能把用户重新关回加载页。
  const [inputs] = useState(() => ({ texts, images }));
  const [basicMode, setBasicMode] = useState(false);
  const [warmAttempt, setWarmAttempt] = useState(0);
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
    resources.retry();
  };

  const [shown, setShown] = useState(0);
  const [exiting, setExiting] = useState(false);
  const stateRef = useRef({ progress, isReady, canAnimate, onDone });
  useEffect(() => {
    stateRef.current = { progress, isReady, canAnimate, onDone };
  }, [canAnimate, isReady, onDone, progress]);

  useEffect(() => {
    const started = performance.now();
    let displayed = 0;
    let frame = 0;
    let readyAt = 0;
    let exitAt = 0;
    const tween = (now: number) => {
      const state = stateRef.current;
      const target = state.isReady ? 1 : Math.min(0.99, state.progress);
      displayed += (target - displayed) * (reduced ? 1 : 0.14);
      if (Math.abs(target - displayed) < TWEEN_EPS / 100) displayed = target;
      setShown(Math.min(state.isReady ? 100 : 99, Math.round(displayed * 100)));
      if (!state.isReady) {
        readyAt = 0;
        if (exitAt) { exitAt = 0; setExiting(false); }
      } else if (displayed >= 0.999 && now - started >= (reduced ? MIN_SHOW_MS * REDUCED_SCALE : MIN_SHOW_MS)) {
        if (!readyAt) readyAt = now;
        if (!exitAt && now - readyAt >= (reduced ? 0 : HOLD_DONE_MS)) {
          exitAt = now;
          setExiting(true);
        }
        if (exitAt && now - exitAt >= (reduced ? 180 : EXIT_MS)) {
          state.onDone(state.canAnimate);
          return;
        }
      }
      frame = requestAnimationFrame(tween);
    };
    frame = requestAnimationFrame(tween);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  return (
    <div
      className="ef-boot"
      data-exiting={exiting ? "true" : "false"}
      style={{ "--ef-boot-progress": shown / 100 } as CSSProperties}
    >
      <div className="ef-boot__quads" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div
        className="ef-boot__readout"
        role="progressbar"
        aria-label="正在加载站点预设"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
      >
        <b>{String(shown).padStart(3, "0")}</b>
        <span>%</span>
      </div>
      <div className="ef-boot__meta">
        <p className="ef-boot__label">
          ENDFIELD TERMINAL // {!canAnimate && resources.isReady ? "基础模式就绪" : "预设加载"}
        </p>
        <p className="ef-boot__id">
          {identity.name} · ID {identity.code}
        </p>
        {errors.length > 0 && !basicMode && (
          <div className="ef-boot__error" role="alert">
            <p>{errors.join("、")}准备未完成，请重试或以无像素转场的基础模式进入。</p>
            <div className="ef-boot__actions">
              <button type="button" onClick={retry}>重试加载</button>
              <button type="button" onClick={() => setBasicMode(true)}>以基础模式进入</button>
            </div>
          </div>
        )}
      </div>
      <div className="ef-boot__rule" aria-hidden="true">
        <i />
      </div>
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
