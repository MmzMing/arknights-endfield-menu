import { useLayoutEffect, useRef } from "react";
import { LAYERS, PARTS, useScene } from "../scene/scene-context";
import "../styles/level-pill.css";

/* Exploration level pill. It rides on the lower-left of the disc rim, inside the disc cylinder.
   Everything is laid out in the pill's own px, measured on the reference screenshot: one translucent capsule
   carrying the yellow tab, the radar (the game's artwork, button-art), the label, a band of dim stripes under
   the level number and the round "i" button at the right end. The game draws the pill slightly askew on the disc
   rim; the face's lean matrix reproduces that. Migrated verbatim from level-pill.js. */

export function LevelPill({
  label,
  level,
  onAction,
}: {
  label: string;
  level: string;
  onAction: (action: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useScene();

  useLayoutEffect(() => {
    // floats as high as the top bar's readouts, but stays where the disc rim puts it at rest
    if (ref.current) scene.attach(ref.current, LAYERS.top, { rest: PARTS.level });
  }, [scene]);

  return (
    <div className="ef-core__lvl" ref={ref}>
      <div className="ef-lvl__face">
        <i className="ef-lvl__bar" />
        <svg className="ef-lvl__icon" viewBox="10 6 46 30" aria-hidden="true">
          <use href="#art-level-radar" />
        </svg>
        <span className="ef-lvl__label">{label}</span>
        <i className="ef-lvl__hatch" />
        <b>{level}</b>
        <button
          className="ef-lvl__info"
          data-action="level-info"
          title="说明"
          aria-label="说明"
          data-ef-shadow=""
          onClick={() => onAction("level-info")}
        />
      </div>
    </div>
  );
}
