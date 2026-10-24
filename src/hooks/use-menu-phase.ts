import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/* Menu phase orchestration, migrated from the demo's app.js (setClosed / playEntrance) with this site's landing
   state: the page boots closed on the wallpaper and its countdown, and the first entrance only plays when the
   closed hint (or Escape) opens the menu. The three body classes drive every entrance/exit keyframe in the CSS
   (kept on <body> on purpose), so this hook owns the exact sequencing: ef-in for ENTRANCE_MS, ef-out until the
   backdrop's cut-back reports animationend (with the demo's fallback timer), then ef-closed. Reopening during the
   exit cancels it. */

const ENTRANCE_MS = 900;   // every entrance animation finishes within this (the last, the slide of the cards and tiles, by ~890 ms)
const EXIT_MS = 500;       // every exit animation finishes within this; the backdrop's cut back to the wallpaper is the last
const EXIT_FALLBACK_MS = EXIT_MS + 250;   // closes anyway when that cut never reports its end (hidden page, cancelled animation)

export type MenuPhase = "entering" | "open" | "exiting" | "closed";

export interface MenuPhaseApi {
  phase: MenuPhase;
  /** the demo's playEntrance + setClosed(false) */
  open: () => void;
  /** the demo's setClosed(true) */
  close: () => void;
}

export function useMenuPhase(onPhase?: (phase: MenuPhase) => void): MenuPhaseApi {
  const [phase, setPhase] = useState<MenuPhase>("closed");
  const entranceTimer = useRef(0);
  const exitTimer = useRef(0);
  const reducedMotion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  // closeNow / onExitEnd / stopExitWait reference each other; a ref breaks the cycle with stable identities
  const stopExitWaitRef = useRef<() => void>(() => {});

  const playEntrance = useCallback(() => {
    clearTimeout(entranceTimer.current);
    document.body.classList.remove("ef-in");
    void document.body.offsetWidth;   // restart the CSS animations
    document.body.classList.add("ef-in");
    setPhase("entering");
    entranceTimer.current = window.setTimeout(() => {
      document.body.classList.remove("ef-in");
      setPhase((p) => (p === "entering" ? "open" : p));
    }, ENTRANCE_MS);
  }, []);

  /** adds body.ef-closed; only the backdrop's cut ends the exit, every other part has finished before it */
  const closeNow = useCallback(() => {
    stopExitWaitRef.current();
    document.body.classList.add("ef-closed");
    setPhase("closed");
  }, []);

  const onExitEnd = useCallback(
    (e: AnimationEvent) => {
      if (e.animationName === "efBackdropOut") closeNow();
    },
    [closeNow],
  );

  const stopExitWait = useCallback(() => {
    clearTimeout(exitTimer.current);
    exitTimer.current = 0;
    document.removeEventListener("animationend", onExitEnd);
  }, [onExitEnd]);
  useLayoutEffect(() => {
    stopExitWaitRef.current = stopExitWait;
  }, [stopExitWait]);

  /** Closing plays the exit (body.ef-out) and adds body.ef-closed once the backdrop has cut back to the wallpaper.
      That waits for the cut's animationend: CSS animations only start counting on the first frame after the class
      is added (7-42 ms after a timer would), so a 500 ms timer would chop off the end of the cut. body.ef-out stays
      until the menu reopens, holding every part on its last exit frame, so the closed state's own fade has nothing
      left to show. Reopening during the exit cancels it; with reduced motion the menu closes at once. */
  const close = useCallback(() => {
    const body = document.body;
    if (body.classList.contains("ef-closed") || body.classList.contains("ef-out")) return;
    clearTimeout(entranceTimer.current);
    body.classList.remove("ef-in");
    if (reducedMotion && reducedMotion.matches) {
      closeNow();
      return;
    }
    void body.offsetWidth;   // restart the exit animations
    body.classList.add("ef-out");
    setPhase("exiting");
    document.addEventListener("animationend", onExitEnd);
    exitTimer.current = window.setTimeout(closeNow, EXIT_FALLBACK_MS);
  }, [closeNow, onExitEnd, reducedMotion]);

  const open = useCallback(() => {
    stopExitWait();   // reopening during the exit cancels it
    document.body.classList.remove("ef-out", "ef-closed");
    playEntrance();
  }, [playEntrance, stopExitWait]);

  // the static page ships with body.ef-closed (so the wallpaper paints before React); this keeps the class in
  // sync for any other document, and the cleanup releases every timer/listener on unmount
  useLayoutEffect(() => {
    document.body.classList.add("ef-closed");
    return () => {
      clearTimeout(entranceTimer.current);
      stopExitWait();
    };
  }, [stopExitWait]);

  useEffect(() => {
    onPhase?.(phase);
  }, [phase, onPhase]);

  return { phase, open, close };
}
