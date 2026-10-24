import { useLayoutEffect, useRef } from "react";
import { BACKDROP_FIELD } from "../assets/backdrop-field";
import { cssVars } from "../lib/label-svg";
import "../styles/backdrop.css";

/* Backdrop: the coloured haze behind the menu and the thin decorations floating in the 3D scene.
   The haze is a smooth colour field (backdrop-field.ts) painted on the fixed wallpaper. The decorations live in
   the scene's world, each with its own 3D placement, so they move with the camera like the rest of the menu:
     - four large thin circles and a straight line lying flat on a plane ARC_Z px below the floor,
     - a small yellow ring tilted in space,
     - nine "+" marks standing upright at different heights (horizontal arm along the floor, vertical arm along
       "up"; the camera's perspective makes the vertical arms lean towards one vanishing point).
   Positions were measured from the reference screenshot and solved against this scene's projection.
   Migrated verbatim from backdrop.js. */

const ARC_Z = -37.7;   // height of the plane the circles and the line lie on
/** Flat strokes on that plane, in its own coordinates (= stage px): path, stroke width, opacity. */
const FLOOR = [
  { d: "M1711.9 184.1A811.8 811.8 0 0 1 1561.1 1109.2", w: 2.5, a: 0.135 },   // right, around the disc
  { d: "M1470.9 -101.6A1323.8 1323.8 0 0 1 1889.6 517.4", w: 3.9, a: 0.148 },   // top right
  { d: "M226.2 175.6A798.5 798.5 0 0 1 490.9 -120.7", w: 2, a: 0.125 },   // top left
  { d: "M50 813.9A753.3 753.3 0 0 1 190.8 229", w: 2, a: 0.122 },   // left edge
  { d: "M1607.8 909.4L1755.7 1011.5", w: 3.6, a: 0.155 },   // straight line
] as const;

/** The upright "+" marks: placement (local x = horizontal arm, local y = down the vertical arm), arms
    [gap, bar length] horizontally then vertically (each arm leaves a gap at the centre), opacity, bar widths. */
interface MarkSpec {
  m: string;
  g: [number, number, number, number];
  a: number;
  wh: number;
  wv: number;
}
const MARKS: MarkSpec[] = [
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,552.58,321.64,400.18,1)", g: [2.21, 9.01, 2.46, 10.46], a: 1, wh: 1.74, wv: 1.46 },   // top left
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,555.62,403.45,-2.28,1)", g: [2.35, 8.88, 2.59, 10.84], a: 0.5, wh: 1.68, wv: 1.41 },   // left of the dial
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,567.41,752.3,75.35,1)", g: [2.55, 8.67, 2.87, 10.72], a: 0.47, wh: 1.49, wv: 1.29 },   // lower left of the dial
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1066.56,577.79,510,1)", g: [3.14, 10.76, 2.53, 9.75], a: 0.81, wh: 1.47, wv: 1.56 },   // over the disc
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1363.12,368.46,23.39,1)", g: [2.33, 8.89, 2.7, 10.09], a: 0.51, wh: 1.76, wv: 1.51 },   // upper right of the disc
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1359.33,638.07,507.77,1)", g: [2.31, 8.91, 2.51, 10.04], a: 1, wh: 1.53, wv: 1.16 },   // on the first tile
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1366.15,723.62,114.34,1)", g: [2.43, 8.79, 2.86, 10.56], a: 0.51, wh: 1.61, wv: 1.25 },   // right of the disc
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1362.66,950.41,580,1)", g: [2.91, 8.31, 3.42, 9], a: 1, wh: 1.61, wv: 1.41 },   // on a lower tile
  { m: "matrix3d(0.9997,-0.0256,-0.0021,0,0.0025,0.1787,-0.9839,0,0.0256,0.9836,0.1787,0,1383.69,1033.13,151.61,1)", g: [2.39, 8.84, 2.27, 11.51], a: 0.49, wh: 1.37, wv: 1.07 },   // bottom right
];
const RING = { m: "matrix3d(-0.4919,-0.8564,-0.1568,0,0.3794,-0.373,0.8467,0,-0.7836,0.357,0.5084,0,1706.99,905.47,-37.7,1)", r: 7.4 };

function Mark(k: MarkSpec) {
  const s = 16, g = k.g;
  const bars = (
    <>
      <rect x={g[0]} y={-k.wh / 2} width={g[1]} height={k.wh} />
      <rect x={-g[0] - g[1]} y={-k.wh / 2} width={g[1]} height={k.wh} />
      <rect x={-k.wv / 2} y={g[2]} width={k.wv} height={g[3]} />
      <rect x={-k.wv / 2} y={-g[2] - g[3]} width={k.wv} height={g[3]} />
    </>
  );
  return (
    <div className="ef-decor__item" style={{ transform: k.m }}>
      <svg
        className="ef-decor__art"
        width={2 * s}
        height={2 * s}
        viewBox={`${-s} ${-s} ${2 * s} ${2 * s}`}
        style={{ left: -s, top: -s }}
      >
        <g fill="#fff" fillOpacity={k.a}>
          {bars}
        </g>
      </svg>
    </div>
  );
}

/** The decorations, straight into the world (they mount after the scene's layers, as in the demo). */
export function BackdropDecor() {
  const r = RING.r + 2;
  return (
    <div className="ef-decor" aria-hidden="true">
      <div className="ef-decor__item" style={cssVars({ width: "1920px", height: "1080px", transform: `translateZ(${ARC_Z}px)` })}>
        <svg className="ef-decor__art" width={1920} height={1080} viewBox="0 0 1920 1080" style={{ left: 0, top: 0 }}>
          <g fill="none" stroke="#fff">
            {FLOOR.map((l, i) => (
              <path key={i} className="ef-decor__stroke" d={l.d} strokeWidth={l.w} strokeOpacity={l.a} />
            ))}
          </g>
        </svg>
      </div>
      <div className="ef-decor__item" style={{ transform: RING.m }}>
        <svg className="ef-decor__art" width={2 * r} height={2 * r} viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} style={{ left: -r, top: -r }}>
          <circle r={RING.r} fill="none" stroke="#FFDE00" strokeWidth={1.4} strokeOpacity={0.55} />
        </svg>
      </div>
      {MARKS.map((k, i) => (
        <Mark key={i} {...k} />
      ))}
    </div>
  );
}

/** The wallpaper haze: the colour field stretched over the stage plus a margin, following the stage scale. */
export function Wallpaper({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  const innerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const wp = innerRef.current, F = BACKDROP_FIELD;
    if (!wp) return;
    wp.style.backgroundColor = F.edge;
    wp.style.backgroundImage = `url(${F.src})`;
    wp.style.backgroundRepeat = "no-repeat";
    wp.style.backgroundPosition = "center";
    wp.style.backgroundSize = `calc(${F.width}px * var(--ef-stage-scale)) calc(${F.height}px * var(--ef-stage-scale))`;
  }, []);
  return <div className="ef-wallpaper" ref={(el) => {
    (innerRef as { current: HTMLDivElement | null }).current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as { current: HTMLDivElement | null }).current = el;
  }} />;
}
