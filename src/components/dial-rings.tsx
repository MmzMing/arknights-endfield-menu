import { useLayoutEffect, useRef } from "react";
import { arcD } from "../lib/arc-d";
import { cssVars } from "../lib/label-svg";
import { useScene } from "../scene/scene-context";
import "../styles/dial-rings.css";

/* Dial rings around the disc. Each ring is its own SVG plane at a different height inside the disc
   cylinder (rim band at the bottom, white arcs on top), so the camera sway separates them in depth.
   The five yellow flags stand upright on the bezel and slowly sway back and forth.
   Migrated verbatim from dial-rings.js. */

function RimBand() {
  const annulus = "M500 -177 A677 677 0 1 0 500.01 -177 Z M500 -70 A570 570 0 1 1 499.99 -70 Z";
  return <path d={annulus} fillRule="evenodd" fill="#0e1012" opacity={0.72} />;
}

function AmberRing() {
  return (
    <>
      <path d={arcD(500, 500, 466, 44, 137)} fill="none" stroke="#F08D36" strokeWidth={1.1} />
      <path d={arcD(500, 500, 466, 160, 380)} fill="none" stroke="#F08D36" strokeWidth={1.1} />
      {([[20, 44], [137, 160]] as [number, number][]).map((seg, i) => (
        <path key={i} d={arcD(500, 500, 466, seg[0], seg[1])} fill="none" stroke="#F59C48" strokeWidth={1.6} strokeDasharray="2 5" strokeLinecap="round" />
      ))}
    </>
  );
}

function Grooves() {
  return (
    <>
      {[472, 476, 480, 484].map((r, i) => (
        <circle key={r} cx={500} cy={500} r={r} fill="none" stroke={`rgba(255,255,255,${i % 2 ? 0.05 : 0.08})`} strokeWidth={0.75} />
      ))}
    </>
  );
}

function GoldArcs() {
  const segments: [number, number][] = [[163, 191], [343, 371]];
  return (
    <>
      {segments.map(([start, end]) => (
        <g key={start}>
          <path d={arcD(500, 500, 450, start, end)} fill="none" stroke="rgba(255,222,0,0.08)" strokeWidth={12} strokeLinecap="square" />
          <path d={arcD(500, 500, 450, start, end)} fill="none" stroke="rgba(255,222,0,0.48)" strokeWidth={5} strokeLinecap="square" />
        </g>
      ))}
    </>
  );
}

/** The white arcs, each named after the game's segment it plays (U upper right, R right, C lower left, B left,
    A upper left); pathLength 1 lets the transitions draw them out and back by fraction. */
function WhiteArcs() {
  const segs: [number, number, string][] = [[-40.5, -10, "U"], [-4, 44, "R"], [138, 168, "C"], [174, 204, "B"], [210, 234, "A"]];
  return (
    <>
      {segs.map((seg) => (
        <path
          key={seg[2]}
          className="ef-dial__seg"
          data-seg={seg[2]}
          pathLength={1}
          d={arcD(500, 500, 492.5, seg[0], seg[1])}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={9.8}
          strokeLinecap="butt"
        />
      ))}
    </>
  );
}

/** Ring planes from bottom to top; h is the height inside the disc cylinder. */
const RINGS: { id: string; h: number; draw: () => React.ReactNode }[] = [
  { id: "rim-band", h: -112, draw: RimBand },
  { id: "amber-ring", h: -60, draw: AmberRing },
  { id: "grooves", h: 10, draw: Grooves },
  { id: "gold-arcs", h: 44, draw: GoldArcs },
  { id: "white-arcs", h: 50, draw: WhiteArcs },
];
const FLAG_ANGLES = [-101, -162, -37, 29, 141];
const FLAG_R = 462;

function Flags({ flagsRef }: { flagsRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ef-core__flags" ref={flagsRef}>
      <div className="ef-flags-rot">
        {FLAG_ANGLES.map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x = 500 + Math.cos(a) * FLAG_R, y = 500 + Math.sin(a) * FLAG_R;
          return (
            <div
              key={deg}
              className="ef-flag"
              style={cssVars({
                left: (x / 10).toFixed(2) + "%",
                top: (y / 10).toFixed(2) + "%",
                transform: `rotate(${(deg + 90).toFixed(1)}deg)`,
              })}
            >
              <svg viewBox="-32 -64 64 64">
                <path d="M0 0 L22 -48 L-22 -48 Z" fill="none" stroke="#FFDE00" strokeWidth={2.55} strokeLinejoin="round" />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DialRings() {
  const scene = useScene();
  const ringRefs = useRef<(SVGSVGElement | null)[]>([]);
  const flagsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ringRefs.current.forEach((el, i) => {
      if (el) scene.attach(el, RINGS[i].h, { comp: false });
    });
    if (flagsRef.current) scene.attach(flagsRef.current, 22, { comp: false });
  }, [scene]);

  return (
    <>
      {RINGS.map((ring, i) => (
        <svg
          key={ring.id}
          className="ef-core__dial"
          data-ring={ring.id}
          viewBox="0 0 1000 1000"
          ref={(el) => { ringRefs.current[i] = el; }}
        >
          <g className="ef-dial__ink">
            {ring.id === "gold-arcs" ? (
              <g className={`ef-dial__orbit ef-dial__orbit--${ring.id}`}>{ring.draw()}</g>
            ) : ring.draw()}
          </g>
        </svg>
      ))}
      <Flags flagsRef={flagsRef} />
    </>
  );
}
