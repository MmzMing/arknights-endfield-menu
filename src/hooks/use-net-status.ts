import { useEffect, useState } from "react";

/* HUD network readout: a real round trip to the site's own static host, with a render-rate fallback for offline
   or blocked requests. The per-frame count lives in the rAF closure; React only sees the once-a-second result. */

const FIRST_PING_DELAY_MS = 800;
const PING_INTERVAL_MS = 10_000;
const PING_RETRY_MS = 2_000;
const PING_TIMEOUT_MS = 4_000;
const MAX_PING_FAILURES = 2;
const FPS_WINDOW_MS = 1_000;

export type NetStatus =
  | { mode: "latency"; latency: number }
  | { mode: "fps"; fps: number | null };

async function pingOrigin(): Promise<number | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const started = performance.now();
  const url = `${import.meta.env.BASE_URL}favicon/favicon.ico?ping=${Date.now()}`;
  try {
    await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal });
    // resource timing stops at responseEnd, so a busy main thread after the response cannot inflate the readout
    const entry = performance.getEntriesByName(url).at(-1) as PerformanceResourceTiming | undefined;
    const elapsed = entry && entry.responseEnd > 0 ? entry.responseEnd - entry.requestStart : performance.now() - started;
    return Math.max(1, Math.round(elapsed));
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useNetStatus(): NetStatus | null {
  const [status, setStatus] = useState<NetStatus | null>(null);

  useEffect(() => {
    let disposed = false;
    let failures = 0;
    let timer = 0;

    const tick = async () => {
      const latency = await pingOrigin();
      if (disposed) return;
      if (latency === null) {
        failures += 1;
        if (failures >= MAX_PING_FAILURES) {
          setStatus({ mode: "fps", fps: null });
          return;
        }
        timer = window.setTimeout(tick, PING_RETRY_MS);
        return;
      }
      failures = 0;
      setStatus({ mode: "latency", latency });
      timer = window.setTimeout(tick, PING_INTERVAL_MS);
    };

    // let the landing page finish its own asset traffic, or the first sample measures the queue, not the link
    timer = window.setTimeout(tick, FIRST_PING_DELAY_MS);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, []);

  const fpsMode = status?.mode === "fps";
  useEffect(() => {
    if (!fpsMode) return;
    let frames = 0;
    let windowStart = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= FPS_WINDOW_MS) {
        setStatus({ mode: "fps", fps: Math.round((frames * 1000) / elapsed) });
        frames = 0;
        windowStart = now;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [fpsMode]);

  return status;
}
