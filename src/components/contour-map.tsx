import { useEffect, useRef } from "react";
import { createContourTerrain, type ContourTerrainController } from "../scene/contour-terrain";
import "../styles/contour-map.css";

export function ContourMap({ paused, entering }: { paused: boolean; entering: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ContourTerrainController | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    controllerRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = createContourTerrain(host, pausedRef.current);
    controllerRef.current = controller;
    if (!controller) host.dataset.ready = "fallback";
    return () => {
      controller?.dispose();
      controllerRef.current = null;
      delete host.dataset.ready;
    };
  }, []);

  // declared after the mount effect so the controller already exists when the first entrance is armed
  useEffect(() => {
    if (entering) controllerRef.current?.playEntrance();
  }, [entering]);

  return (
    <div className="ef-contour-map" ref={hostRef} aria-hidden="true">
      <div className="ef-contour-map__telemetry">
        <span>TERRAIN // LIVE SCAN</span>
        <b>ALT 000—114</b>
      </div>
      <div className="ef-contour-map__north"><i />N</div>
      <div className="ef-contour-map__scale"><span>040</span><i /><span>080</span><i /><span>120</span></div>
      <div className="ef-contour-map__reticle" />
      <div className="ef-contour-map__sweep" />
    </div>
  );
}
