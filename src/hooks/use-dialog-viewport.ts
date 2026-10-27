import { useEffect, useState } from "react";

function viewportKey(): string {
  return `${window.innerWidth}:${window.innerHeight}:${window.devicePixelRatio}`;
}

export function useDialogViewport(): string {
  const [viewport, setViewport] = useState(viewportKey);
  useEffect(() => {
    let timer = 0;
    let resolution: MediaQueryList;
    const listenResolution = () => {
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener("change", handleResolution, { once: true });
    };
    const handleResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setViewport(viewportKey()), 120);
    };
    const handleResolution = () => {
      handleResize();
      listenResolution();
    };
    listenResolution();
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      resolution.removeEventListener("change", handleResolution);
    };
  }, []);
  return viewport;
}
