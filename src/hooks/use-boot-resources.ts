import { useCallback, useEffect, useRef, useState } from "react";
import { warmDialogFonts, warmDialogImages, warmDialogRenderer, warmDialogSnapshot } from "../scene/dialog-pixel-renderer";

const RESOURCE_TIMEOUT_MS = 6000;
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
    const steps: { label: string; run: () => Promise<unknown> }[] = [
      { label: "字体", run: () => warmDialogFonts(inputs.texts).then(() => document.fonts.ready) },
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
      void withDeadline(Promise.resolve().then(step.run)).then(() => {
        if (!cancelled) setCompleted((value) => value + 1);
      }, () => {
        if (!cancelled) setErrors((values) => [...values, step.label]);
      });
    }
    return () => { cancelled = true; };
  }, [attempt]);

  return { attempt, completed, total: RESOURCE_COUNT, errors, canAnimate, isReady: completed === RESOURCE_COUNT, retry };
}
