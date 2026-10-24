import type { ReactNode } from "react";
import { cssVars, labelText, type LabelLayout } from "../lib/label-svg";
import { useMenuActions } from "../menu-actions";
import "../styles/disc-buttons.css";

/* The two yellow buttons that hug the bottom of the disc. Migrated verbatim from disc-buttons.js:
   both are drawn in one SVG, their outlines stage px turned onto the stage by DCBTN; a copy of the outlines
   behind them is the back plate leaning with the camera; icons, labels and decals sit in a second SVG, the icons
   traced from the game (button-art.ts) and the labels Noto Sans SC laid out where the game puts them. */

/** Button space → stage: the outlines are stage px turned by rot degrees about (cx, cy), the middle of the gap
    between the buttons, so their top edges climb to the right and their inner sides lean as in the game. */
const DCBTN = { rot: -1.817, cx: 968.8, cy: 918 };

interface ButtonSpec {
  tab: "plan" | "brief";
  decal: string;
  action: string;
  label: string;
  art: string;
  top: number;
  side: number;
  band: number;
  plate: { at: [number, number]; sx: number; shear: number; sy: number };
  shadow: { art: [number, number]; text: [number, number] };
  text: LabelLayout;
  path: string;
}

/* Measured on the game: each button is a straight top edge (top), an arc of r 395.42 centred on the gap that
   drops to the inner side, a straight inner side and a curve back to the sharp tip, with corners of r 3.6 and 5.6.
   The right button nearly mirrors the left one about the gap and sits 1.5 px lower; side = its inner side,
   band = where the bright band starts.
   plate = the back plate, as a lower copy of the button looks from the game's camera: the outline narrowed towards
   the gap (sx about the inner side), its lower parts slid sideways (shear) and squashed towards the top edge (sy),
   then pushed down by at = [dx, dy]; it peeks out under the lower curve, hugging it, and hides under the right tip.
   shadow = offsets of the icon's dark and the label's pale shadow, which lean towards the gap as the plate does. */
const BUTTONS: ButtonSpec[] = [
  {
    tab: "plan", decal: "art-disc-square",
    action: "plan", label: "工业计划", art: "art-disc-plan", top: 857.93, side: 959.23, band: 927.83,
    plate: { at: [5.3, 5.74], sx: 0.9714, shear: 0, sy: 0.98875 }, shadow: { art: [0.31, 0.52], text: [0.38, 1.58] },
    text: { size: 24.03, matrix: [1.0099, -0.0141, 0.024, 0.9998], x: [812.04, 836.44, 860.76, 884.82], y: [924.66, 923.98, 924.08, 922.98] },
    path: "M 664.87 857.93 L 868.36 857.93 A 395.42 395.42 0 0 0 955.75 870.68 A 3.6 3.6 0 0 1 959.23 874.28 L 959.23 957.79 A 5.6 5.6 0 0 1 953.55 963.39 C 853.66 961.98 739.35 925.45 664.87 857.93 Z",
  },
  {
    tab: "brief", decal: "art-disc-decal",
    action: "brief", label: "工业简报", art: "art-disc-brief", top: 859.43, side: 978.37, band: 929.42,
    plate: { at: [1.48, 4.27], sx: 0.9681, shear: -0.0159, sy: 0.98775 }, shadow: { art: [-0.73, 0.63], text: [-1.13, 1.7] },
    text: { size: 23.65, matrix: [1.0198, -0.0196, 0.0322, 0.9996], x: [949.53, 973.67, 998.29, 1022.58], y: [927.15, 926.73, 926.26, 926.12] },
    path: "M 1273.78 859.43 L 1069.24 859.43 A 395.42 395.42 0 0 1 981.85 872.18 A 3.6 3.6 0 0 0 978.37 875.78 L 978.37 959.29 A 5.6 5.6 0 0 0 984.05 964.89 C 1087.69 963.43 1200.22 925.6 1273.78 859.43 Z",
  },
];

/** Markup drawn in the plate's place: its static shift, narrowing, shear and squash; .ef-dcsh-move adds the lean
    with the camera. */
function plateShape(b: ButtonSpec, body: ReactNode) {
  const p = b.plate;
  const m = [p.sx, 0, p.shear, p.sy, b.side * (1 - p.sx) - p.shear * b.top, b.top * (1 - p.sy)];
  return (
    <g
      className="ef-dcsh-move"
      data-ef-shadow=""
      style={cssVars({ "--ef-shx0": p.at[0], "--ef-shy0": p.at[1] })}
    >
      <g transform={`matrix(${m.map((v) => +v.toFixed(4)).join(" ")})`}>{body}</g>
    </g>
  );
}

function BackPlate(b: ButtonSpec) {
  return plateShape(
    b,
    <path d={b.path} fill="none" stroke="rgba(247,215,39,0.35)" strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" />,
  );
}

/** The dark top of the face is see-through in the game: where the plate lies behind it, the face is lighter and
    the plate's edge shows as a pale inner rim. Drawn inside the face so the plate stays faint outside it.
    The face is drawn in the game tab's layers (the transitions fade each one on its own): the bottom layer (the
    top half and the plate's rim showing through it), the bright band and the stroke layer (grid, inner dark
    stroke, outer stroke and hit area), each clipped to the face. */
function ButtonFace({ b, i, onClick }: { b: ButtonSpec; i: number; onClick: () => void }) {
  const clip = { clipPath: `url(#dcClip${i})`, pointerEvents: "none" as const };
  return (
    <g className="ef-discbtn" data-action={b.action} role="button" aria-label={b.label} onClick={onClick}>
      <g className="ef-dclayer" {...clip}>
        <rect x={640} y={840} width={660} height={(b.band - 840).toFixed(2)} fill="url(#dcTopFill)" />
        {plateShape(b, (
          <>
            <path d={b.path} fill="rgba(255,211,26,0.13)" />
            <path d={b.path} fill="none" stroke="rgba(26,23,8,0.13)" strokeWidth={4.4} clipPath={`url(#dcClip${i})`} />
            <path d={b.path} fill="none" stroke="rgba(247,215,39,0.27)" strokeWidth={1.7} />
          </>
        ))}
      </g>
      <g className="ef-dcband" {...clip}>
        <rect x={640} y={b.band} width={660} height={(990 - b.band).toFixed(2)} fill="#FFE128" />
      </g>
      <g className="ef-dclayer">
        <g {...clip}>
          <rect x={640} y={840} width={660} height={150} fill="url(#dcGrid)" />
          <path d={b.path} fill="none" stroke="rgba(80,72,24,0.8)" strokeWidth={4.6} />
        </g>
        <path d={b.path} fill="none" stroke="#FDDC28" strokeWidth={2} pointerEvents="none" />
        <path d={b.path} fill="transparent" pointerEvents="visible" />
      </g>
    </g>
  );
}

/** Shadow group at a button's offset (shadow.art or shadow.text); the class adds the lean with the camera. */
function shadowGroup(cls: string, at: [number, number], body: ReactNode) {
  return (
    <g className={cls} data-ef-shadow="" style={cssVars({ "--ef-shx0": at[0], "--ef-shy0": at[1] })}>
      {body}
    </g>
  );
}

function TabGroup({ tab, children }: { tab: string; children: ReactNode }) {
  return <g className={`ef-dctab ef-dctab--${tab}`}>{children}</g>;
}

export function DiscButtons() {
  const { onAction } = useMenuActions();
  const rotate = `rotate(${DCBTN.rot} ${DCBTN.cx} ${DCBTN.cy})`;
  return (
    <>
      <svg className="ef-discbtns" viewBox="0 0 1920 1080">
        <defs>
          {/* the top's colour drifts along the buttons as the game's see-through face does over its backdrop */}
          <linearGradient id="dcTopFill" gradientUnits="userSpaceOnUse" x1={700} y1={0} x2={1260} y2={0}>
            <stop offset={0} stopColor="rgba(137,129,57,0.9)" />
            <stop offset={0.214} stopColor="rgba(159,145,54,0.9)" />
            <stop offset={0.464} stopColor="rgba(171,156,55,0.9)" />
            <stop offset={0.536} stopColor="rgba(165,150,51,0.9)" />
            <stop offset={0.75} stopColor="rgba(159,145,47,0.9)" />
            <stop offset={1} stopColor="rgba(143,136,51,0.9)" />
          </linearGradient>
          <pattern id="dcGrid" width={2.48} height={2.48} patternUnits="userSpaceOnUse">
            <path d="M 0 0.25 H 2.48 M 0.25 0 V 2.48" stroke="#1a1707" strokeWidth={0.5} opacity={0.035} />
          </pattern>
          {BUTTONS.map((b, i) => (
            <clipPath key={i} id={`dcClip${i}`}>
              <path d={b.path} />
            </clipPath>
          ))}
        </defs>
        {BUTTONS.map((b, i) => (
          <TabGroup key={b.tab} tab={b.tab}>
            <g transform={rotate}>
              <g className="ef-dclayer">
                <BackPlate {...b} />
              </g>
              <ButtonFace b={b} i={i} onClick={() => onAction(b.action)} />
            </g>
            <g className="ef-dclayer ef-discdecor">
              <use href={`#${b.decal}`} />
            </g>
          </TabGroup>
        ))}
      </svg>
      <svg className="ef-disclabels" viewBox="0 0 1920 1080" aria-hidden="true">
        <defs>
          <filter id="dcIconBlur" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation={1.15} />
          </filter>
        </defs>
        {BUTTONS.map((b) => (
          <TabGroup key={b.tab} tab={b.tab}>
            {shadowGroup("ef-discicon-sh", b.shadow.art, <use href={`#${b.art}`} filter="url(#dcIconBlur)" />)}
            {shadowGroup("ef-disclab-sh", b.shadow.text, <text {...labelText(b.text)}>{b.label}</text>)}
            <g className="ef-disclab">
              <use href={`#${b.art}`} />
              <text {...labelText(b.text)}>{b.label}</text>
            </g>
          </TabGroup>
        ))}
      </svg>
    </>
  );
}
