import { useEffect, useRef } from "react";

/* The map sits inside the recessed disc well, so the scene camera alone moves it a little less than the dial.
   This adds the old contour map's own pointer parallax as an imperative island: a smoothed 2D offset written to
   two CSS variables on the core and read by the map art. The Guangdong pin lives inside that art, so it tracks
   the map exactly. */
const MAX_X = 22;
const MAX_Y = 12;
const DRIFT_X = 2;

export function useMapParallax(paused: boolean) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const current = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const canRun = () => !pausedRef.current && !motion.matches && !document.hidden;
    const write = (x: number, y: number) => {
      el.style.setProperty("--ef-par-x", `${x.toFixed(2)}px`);
      el.style.setProperty("--ef-par-y", `${y.toFixed(2)}px`);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const tick = (now: number) => {
      raf = 0;
      if (!canRun()) return;
      const dt = Math.min(Math.max(now - last, 0), 50);
      last = now;
      elapsed += dt / 1000;
      const ease = 1 - Math.pow(0.94, dt / 16.667);
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;
      write(current.x + Math.sin(elapsed * 0.6) * DRIFT_X, current.y);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!canRun()) {
        stop();
        return;
      }
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    syncRef.current = sync;

    const onPointerMove = (event: PointerEvent) => {
      const px = (event.clientX / window.innerWidth) * 2 - 1;
      const py = (event.clientY / window.innerHeight) * 2 - 1;
      target.x = -px * MAX_X;
      target.y = -py * MAX_Y;
      sync();
    };
    const onMotionChange = () => {
      if (motion.matches) {
        current.x = 0;
        current.y = 0;
        target.x = 0;
        target.y = 0;
        write(0, 0);
      }
      sync();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", onMotionChange);
    sync();

    return () => {
      stop();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return host;
}
