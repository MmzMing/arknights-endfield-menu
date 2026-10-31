import { useCallback, useEffect, useRef, useState } from "react";
import { warmDialogFonts, warmDialogImages, warmDialogRenderer, warmDialogSnapshot } from "../scene/dialog-pixel-renderer";

// 冷缓存下一次要下载 40 个字体子集（约 2MB）与全部弹窗封面：6 秒会把正常但偏慢的加载误判成失败。
const RESOURCE_TIMEOUT_MS = 20000;
const RESOURCE_COUNT = 4;

function withDeadline<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("资源加载超时")), RESOURCE_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

export function useBootResources(texts: string[], images: string[]) {
  const inputsRef = useRef({ texts, images });
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [canAnimate, setCanAnimate] = useState(false);

  const retry = useCallback(() => {
    setCompleted(0);
    setErrors([]);
    setCanAnimate(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const inputs = inputsRef.current;
    const steps: { label: string; run: () => Promise<unknown>; bestEffort?: boolean }[] = [
      // 字体只是预热：慢网络下不把整站拦在启动页（字体仍在后台继续加载，快照本身内嵌字体子集）。
      { label: "字体", bestEffort: true, run: () => warmDialogFonts(inputs.texts) },
      // 装饰性图片解码失败不应把整站拦在启动页；弹窗封面仍由 warmDialogImages 严格等待。
      { label: "图片", run: () => Promise.all([warmDialogImages(inputs.images), ...Array.from(document.images, (image) => image.decode().catch(() => undefined))]) },
      { label: "样式", run: warmDialogSnapshot },
      { label: "转场", run: async () => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        try {
          await warmDialogRenderer();
          if (!cancelled) setCanAnimate(true);
        } catch {
          if (!cancelled) setCanAnimate(false);
        }
      } },
    ];
    for (const step of steps) {
      const settle = () => {
        if (!cancelled) setCompleted((value) => value + 1);
      };
      void withDeadline(Promise.resolve().then(step.run)).then(settle, () => {
        if (cancelled) return;
        // 尽力而为的步骤超时只表示"不再等它"，不弹错误；后台加载完成后照常生效。
        if (step.bestEffort) settle();
        else setErrors((values) => [...values, step.label]);
      });
    }
    return () => { cancelled = true; };
  }, [attempt]);

  return { attempt, completed, total: RESOURCE_COUNT, errors, canAnimate, isReady: completed === RESOURCE_COUNT, retry };
}
