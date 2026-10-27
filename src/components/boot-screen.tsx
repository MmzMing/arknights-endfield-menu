import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  warmDialogFonts,
  warmDialogImages,
  warmDialogRenderer,
  warmDialogSnapshot,
} from "../scene/dialog-pixel-renderer";
import "../styles/boot-screen.css";

/* 每次进入页面都跑的全屏预设：大字号百分比读数，完成后四象限各自朝本角滑出。
   进度取真实任务权重，单项超时按已完成计，绝不把人锁在启动页。这里的毫秒数是本界面自己的
   节奏，不是 demo 迁移的测量资产。 */

const MIN_SHOW_MS = 900;
const HOLD_DONE_MS = 420;
const EXIT_MS = 760;
const TASK_TIMEOUT_MS = 6000;
const TWEEN_EPS = 0.4;
const REDUCED_SCALE = 0.4;

type PresetStep = {
  weight: number;
  run: (texts: string[], images: string[]) => Promise<void>;
};

/** 弹窗像素转场真正依赖的东西：字体子集、样式索引、封面缓存、着色器与文档字体就绪。 */
const PRESETS: PresetStep[] = [
  { weight: 3, run: (texts) => warmDialogFonts(texts) },
  { weight: 1, run: () => warmDialogSnapshot() },
  { weight: 2, run: (_texts, images) => warmDialogImages(images) },
  { weight: 2, run: () => warmDialogRenderer() },
  { weight: 1, run: () => document.fonts.ready.then(() => undefined) },
];

export function BootScreen({
  texts,
  images,
  identity,
  onDone,
}: {
  texts: string[];
  images: string[];
  identity: { name: string; code: string };
  onDone: () => void;
}) {
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // 预设输入只取挂载时那一份：texts/images 会随订阅抓取更新，重启启动页等于把用户重新关回加载页。
  const inputsRef = useRef({ texts, images, reduced });

  const [shown, setShown] = useState(0);
  const [exiting, setExiting] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const { texts: presetTexts, images: presetImages, reduced: motionReduced } = inputsRef.current;
    let cancelled = false;
    let target = 0;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, ms);
        timers.add(timer);
      });

    const totalWeight = PRESETS.reduce((sum, step) => sum + step.weight, 0);
    const doneWeight = { value: 0 };
    PRESETS.forEach((step) => {
      void Promise.race([
        step.run(presetTexts, presetImages),
        wait(TASK_TIMEOUT_MS).then(() => undefined),   // 单项卡住按完成计，缺的预设由按需路径兜底
      ])
        .catch(() => undefined)
        .then(() => {
          doneWeight.value += step.weight;
          target = doneWeight.value / totalWeight;
        });
    });

    // 读数用 rAF 追真实进度：任务按权重跳变，直接显示会一格一格地蹦。
    let displayed = 0;
    let frame = 0;
    const tween = () => {
      if (cancelled) return;
      displayed += (target - displayed) * (motionReduced ? 1 : 0.14);
      if (target - displayed < TWEEN_EPS / 100) displayed = target;
      setShown(Math.min(100, Math.round(displayed * 100)));
      if (displayed < 0.999 || target < 1) frame = requestAnimationFrame(tween);
    };
    frame = requestAnimationFrame(tween);

    const run = async () => {
      const started = performance.now();
      while (target < 1 && !cancelled) await wait(80);
      if (cancelled) return;
      const elapsed = performance.now() - started;
      const minimum = motionReduced ? MIN_SHOW_MS * REDUCED_SCALE : MIN_SHOW_MS;
      if (elapsed < minimum) await wait(minimum - elapsed);
      if (cancelled) return;
      // 收尾：让读数追到 100 再退场。
      const settle = performance.now();
      while (displayed < 0.999 && performance.now() - settle < 1200 && !cancelled) await wait(60);
      if (cancelled) return;
      setShown(100);
      await wait(motionReduced ? 0 : HOLD_DONE_MS);
      if (cancelled) return;
      setExiting(true);
      await wait(motionReduced ? 180 : EXIT_MS);
      if (!cancelled) onDoneRef.current();
    };
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <div
      className="ef-boot"
      data-exiting={exiting ? "true" : "false"}
      style={{ "--ef-boot-progress": shown / 100 } as CSSProperties}
      role="progressbar"
      aria-label="正在加载站点预设"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
    >
      <div className="ef-boot__quads" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="ef-boot__readout">
        <b>{String(shown).padStart(3, "0")}</b>
        <span>%</span>
      </div>
      <div className="ef-boot__meta">
        <p className="ef-boot__label">ENDFIELD TERMINAL // 预设加载</p>
        <p className="ef-boot__id">
          {identity.name} · ID {identity.code}
        </p>
      </div>
      <div className="ef-boot__rule" aria-hidden="true">
        <i />
      </div>
    </div>
  );
}
