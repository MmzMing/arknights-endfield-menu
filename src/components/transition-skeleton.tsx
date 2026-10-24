import { useLayoutEffect, useRef } from "react";
import { arcD } from "../lib/arc-d";
import { mulberry32 } from "../lib/mulberry32";
import { useScene } from "../scene/scene-context";
import "../styles/transition-skeleton.css";

/* Transition skeleton: the dotted disc of the game's open and close transitions. It only shows while the menu opens
   (body.ef-in) or closes (body.ef-out); at rest it is hidden. One flat SVG in the disc cylinder, just under the amber
   ring (z -62, real projection), so it tilts and shrinks with the disc's pose. Its drawing is the game's disc, scaled
   so that the game's rim (R 512.73) lands on the amber ring (r 466): K = 466 / 512.73.
   - the dots: the game's staggered rows with the same seeded jitter; they spin in on open and flicker on close;
   - the dark ring: sweeps out from a small circle on the far side and settles into the rim's dark band (open);
   - the cyan reticle: rises from the front edge to the centre while it grows (open), and shows dim on close;
   - three guide lines through the reticle's centre, ten scattered crosses and a thin outer ring (end of the close).
   Migrated verbatim from transition-skeleton.js. */

/* ---- Geometry, in viewBox units with the disc centre at the origin (the game's disc px x K) ---- */
const R = 512.73, K = 466 / 512.73;
const SKEL_Z = -62;   // just under the amber ring (-60): dots and dark ring lie on the game's disc plane like the ring
const DOT = 5.9;      // the game's 6.5 px square dots x K

/** The game's staggered dot rows (row step 96 x 0.87, column step 96, odd rows shifted half a step), jittered by
    +-9 / +-7 from seed 17, keeping only the dots within R - 30; all of them in one path (they only ever move and fade
    together, and one element instead of about a hundred keeps the page's restyles small). */
function dotsPathD(): string {
  const rand = mulberry32(17);
  let d = "", row = 0;
  for (let y = -R + 96 * 0.4; y <= R; y += 96 * 0.87, row++) {
    for (let x = -R + (row % 2 ? 48 : 0); x <= R; x += 96) {
      const px = x + (rand() - 0.5) * 18, py = y + (rand() - 0.5) * 14;
      if (px * px + py * py > (R - 30) * (R - 30)) continue;
      d += "M" + (px * K - DOT / 2).toFixed(1) + " " + (py * K - DOT / 2).toFixed(1) + "h" + DOT + "v" + DOT + "h-" + DOT + "z";
    }
  }
  return d;
}
const DOTS_D = dotsPathD();

/* Crosses: where the game's spread out (disc px x K); each glyph is drawn at the game's screen size (arms 1.2-5.4,
   slashes 1.1-4.6, turned -14deg on even and 18deg on odd ones). */
const CROSSES: [string, string][] = [
  [-413, -254], [-310, -104], [-413, 33], [-305, 136], [-302, 361],
  [412, -311], [300, -128], [437, -12], [319, 117], [337, 351],
].map((p) => [(p[0] * K).toFixed(1), (p[1] * K).toFixed(1)] as [string, string]);

function crossD(i: number): string {
  const a = ((i % 2 ? 18 : -14) * Math.PI) / 180, dx = Math.sin(a), dy = Math.cos(a);
  return (
    "M-5.4 0.2L-1.2 0M1.2 0L5.4 -0.2" +
    "M" + (-dx * 4.6).toFixed(2) + " " + (-dy * 4.6).toFixed(2) + "L" + (-dx * 1.1).toFixed(2) + " " + (-dy * 1.1).toFixed(2) +
    "M" + (dx * 1.1).toFixed(2) + " " + (dy * 1.1).toFixed(2) + "L" + (dx * 4.6).toFixed(2) + " " + (dy * 4.6).toFixed(2)
  );
}
const CROSS_PATHS = CROSSES.map((_, i) => crossD(i));

/* Guides: straight lines on the disc's plane through the reticle's centre (the game's -8 / -55 / 40deg), half length
   2000 (any longer and their front ends pass behind the camera). */
const GUIDES = [-8, -55, 40].map((deg) => {
  const a = (deg * Math.PI) / 180, x = Math.cos(a) * 2000, y = Math.sin(a) * 2000;
  return "M" + (-x).toFixed(1) + " " + (-y).toFixed(1) + "L" + x.toFixed(1) + " " + y.toFixed(1);
});

/* The reticle (the game's radii 147 / 274 x K): a thick broken inner ring, a dashed outer ring, 36 ticks (long ones
   every 90deg) and two outer arcs. */
const RET = { r1: 133.6, r2: 249, arcR: 255.4, tick0: 240.8, tickLong: 234.5, tick1: 247.2 };
const RET_ARCS: [number, number][] = [[-96, -72], [-62, 101], [117, 214], [-122, -110], [-143, -131]];

function ticksD(): string {
  let d = "";
  for (let i = 0; i < 36; i++) {
    const a = (i * 10 * Math.PI) / 180, r0 = i % 9 === 0 ? RET.tickLong : RET.tick0;
    d += "M" + (Math.cos(a) * r0).toFixed(1) + " " + (Math.sin(a) * r0).toFixed(1) + "L" + (Math.cos(a) * RET.tick1).toFixed(1) + " " + (Math.sin(a) * RET.tick1).toFixed(1);
  }
  return d;
}
const TICKS_D = ticksD();

export function TransitionSkeleton() {
  const ref = useRef<SVGSVGElement>(null);
  const scene = useScene();

  useLayoutEffect(() => {
    if (ref.current) scene.attach(ref.current, SKEL_Z, { comp: false });
  }, [scene]);

  return (
    <svg className="ef-skel" viewBox="-500 -500 1000 1000" aria-hidden="true" ref={ref}>
      <circle className="ef-skel__dark" cx={0} cy={-159.9} r={14} fill="none" stroke="#000" strokeWidth={9.1} />
      <circle className="ef-skel__outer" cx={0} cy={-480} r={885.4} fill="none" stroke="rgba(205,205,195,0.7)" strokeWidth={4.5} />
      <g className="ef-skel__dots" fill="#686a62">
        <path d={DOTS_D} />
      </g>
      <g className="ef-skel__xh" fill="none" stroke="#e4e4de" strokeWidth={1.2}>
        {CROSSES.map((p, i) => (
          <g key={i} transform={`translate(${p[0]} ${p[1]})`}>
            <path className="ef-skel__xm" d={CROSS_PATHS[i]} />
          </g>
        ))}
      </g>
      <g className="ef-skel__ret">
        <g className="ef-skel__gd" fill="none" stroke="#dcdfd8" strokeWidth={1.1}>
          {GUIDES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g className="ef-skel__rs" fill="none" stroke="currentColor">
          <g strokeWidth={6.4}>
            {RET_ARCS.map((a, i) => (
              <path key={i} d={arcD(0, 0, RET.r1, a[0], a[1])} />
            ))}
          </g>
          <circle r={RET.r2} strokeWidth={1.6} strokeDasharray="30.9 8.2 5.5 8.2" opacity={0.9} />
          <path d={TICKS_D} strokeWidth={2.7} />
          <path d={arcD(0, 0, RET.arcR, 196, 232)} strokeWidth={2.7} />
          <path d={arcD(0, 0, RET.arcR, 16, 52)} strokeWidth={2.7} />
        </g>
      </g>
    </svg>
  );
}
