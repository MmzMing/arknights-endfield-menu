import { useLayoutEffect, useRef, type ReactNode } from "react";
import { PARTS } from "../scene/scene-constants";
import { useScene } from "../scene/scene-context";
import "../styles/disc.css";

/* Central disc: the dark circular well that the dial rings, level pill and flags sit around.
   The game shows a map in here; this recreation leaves the map (.ef-core__map) empty but for a faint grid.
   Opening and closing pose the whole disc on its layer: it grows in flat and tilts up to face the camera, and on
   close it tips back and shrinks away.
   The ring components (skeleton, dial, level pill) render as this component's children, so they mount into the
   same cylinder — the React equivalent of the demo's mount() returning the disc element. */

export function Disc({ children }: { children?: ReactNode }) {
  const winRef = useRef<HTMLDivElement>(null);
  const scene = useScene();

  useLayoutEffect(() => {
    if (winRef.current) scene.attach(winRef.current, PARTS.well, { comp: false });
  }, [scene]);

  return (
    <div className="ef-core">
      <div className="ef-core__win" ref={winRef}>
        <div className="ef-core__map" />
      </div>
      {children}
    </div>
  );
}
