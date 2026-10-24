import { useEffect, type RefObject } from "react";

/** Scales the 1920×1080 stage to the window, migrated verbatim from the demo's app.js fit().
    The rounded scale goes to the stage and the wallpaper (the only readers of --ef-stage-scale; it does not
    inherit) and to the scene's stageScale for the tile column's drag, so all of them see the same 4-decimal value. */
export function useStageScale(
  stageRef: RefObject<HTMLElement | null>,
  wallpaperRef: RefObject<HTMLElement | null>,
  onScale: (value: number) => void,
) {
  useEffect(() => {
    function fit() {
      const stage = stageRef.current, wp = wallpaperRef.current;
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      if (!stage || !wp || !vw || !vh) return;
      const s = Math.min(vw / 1920, vh / 1080).toFixed(4);
      stage.style.setProperty("--ef-stage-scale", s);
      wp.style.setProperty("--ef-stage-scale", s);
      onScale(Number(s));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [stageRef, wallpaperRef, onScale]);
}
