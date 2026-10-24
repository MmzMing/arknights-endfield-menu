import { cssVars } from "../lib/label-svg";
import { sectorD } from "../lib/arc-d";
import { createTopoContourPaths } from "../lib/topo-contours";
import "../styles/backdrop.css";

/* Backdrop: the flat monochrome wallpaper, the procedural contour field, and the thin decorations floating in the 3D scene.
   The wallpaper is a solid paper tone; its contour paths come from a deterministic value-noise field. The decorations live in
   the scene's world, each with its own 3D placement, so they move with the camera like the rest of the menu:
     - four large arcs and a straight line lying flat on a plane ARC_Z px below the floor, with three solid ring
       segments (arc strips) on the same radii; the arcs and the strips slide round the disc's centre together,
     - a small yellow ring tilted in space,
     - nine "+" marks standing upright at different heights (horizontal arm along the floor, vertical arm along
       "up"; the camera's perspective makes the vertical arms lean towards one vanishing point).
   Positions were measured from the reference screenshot and solved against this scene's projection.
   Migrated verbatim from backdrop.js. */

const ARC_Z = -37.7;   // height of the plane the circles and the line lie on
/** The four large arcs on that plane, in its own coordinates (= stage px): path, stroke width, opacity. They slide
    round the disc together with the strips below (see .ef-decor__orbit). */
const ARCS = [
  { d: "M1711.9 184.1A811.8 811.8 0 0 1 1561.1 1109.2", w: 2.5, a: 0.135 },   // right, around the disc
  { d: "M1470.9 -101.6A1323.8 1323.8 0 0 1 1889.6 517.4", w: 3.9, a: 0.148 },   // top right
  { d: "M226.2 175.6A798.5 798.5 0 0 1 490.9 -120.7", w: 2, a: 0.125 },   // top left
  { d: "M50 813.9A753.3 753.3 0 0 1 190.8 229", w: 2, a: 0.122 },   // left edge
] as const;
/** The straight chord at the lower right is not one of the disc's rings, so it stays where it is. */
const CHORD = { d: "M1607.8 909.4L1755.7 1011.5", w: 3.6, a: 0.155 };
/** The arc strips on those rings: solid ring segments (the outer and inner arc closed by two radial cuts), laid
    about the disc's centre (960, 540) on the radii the hairlines run. */
const STRIPS = [
  { r0: 762, r1: 830, a0: 150, a1: 178 },   // lower left, on the 798 ring
  { r0: 880, r1: 940, a0: 186, a1: 212 },   // upper left, a ring further out
  { r0: 762, r1: 830, a0: 342, a1: 14 },   // right, around the disc
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

const TOPOGRAPHY_CONTOURS = createTopoContourPaths({
  width: 1920,
  height: 1080,
  step: 14,
  levels: 18,
  seed: 20261024,
});

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
            <g className="ef-decor__orbit">
              {ARCS.map((l, i) => (
                <path key={i} className="ef-decor__stroke" d={l.d} strokeWidth={l.w} strokeOpacity={l.a} />
              ))}
              {STRIPS.map((s, i) => (
                <path
                  key={i}
                  className="ef-decor__strip"
                  d={sectorD(960, 540, s.r0, s.r1, s.a0, s.a1)}
                  fill="#fff"
                  fillOpacity={0.16}
                  strokeWidth={1.25}
                  strokeOpacity={0.42}
                />
              ))}
            </g>
            <path className="ef-decor__stroke" d={CHORD.d} strokeWidth={CHORD.w} strokeOpacity={CHORD.a} />
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

function Topography() {
  return (
    <svg className="ef-topography" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="ef-topography__accent" fill="none" stroke="#FFDE00" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M0 300H96V276H208V288H274" strokeWidth="4" />
        <path d="M96 276H164" strokeWidth="12" />
        <path d="M1920 616H1818V590H1736V614H1662V602H1598" strokeWidth="4" />
        <path d="M1736 614H1688" strokeWidth="12" />
        <path d="M118 1080V1008H148V962H210" strokeWidth="4" />
        <path d="M1290 0V54H1322V86H1394" strokeWidth="4" />
        <path d="M267 280H281V294H267ZM1591 595H1605V609H1591ZM203 955H217V969H203Z" fill="#FFDE00" stroke="none" />
      </g>
      <g className="ef-topography__contours" fill="none" stroke="#101214">
        {TOPOGRAPHY_CONTOURS.map((path, index) => (
          <path
            key={index}
            d={path}
            strokeWidth={index % 4 === 0 ? 1.2 : 0.68}
            strokeOpacity={index % 4 === 0 ? 0.48 : 0.26}
          />
        ))}
      </g>
      <g className="ef-topography__marks" fill="none" stroke="#101214" strokeWidth="1">
        <path d="M360 148H376M368 140V156M1450 202H1466M1458 194V210M1040 844H1056M1048 836V852M1810 710H1826M1818 702V718" />
        <path d="M305 276V288M319 280V284M333 280V284M1550 598V610M1564 602V606M1578 602V606" />
      </g>
    </svg>
  );
}

/** The flat wallpaper and its technical contour overlay. */
export function Wallpaper({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <>
      <div className="ef-wallpaper" ref={ref} />
      <Topography />
    </>
  );
}
