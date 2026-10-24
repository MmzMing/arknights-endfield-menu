import { cssVars, labelText, type LabelLayout } from "../lib/label-svg";
import { shapePathD, type CardShape } from "../lib/shape-path-d";
import { useMenuActions } from "../menu-actions";
import { CARD_CONTOURS } from "../assets/card-contours";
import { DISC, R_EDGE } from "../scene/geometry";
import "../styles/left-cards.css";

/* Left column: four cards fanned along the left edge of the disc.
   Each card outline is a quad with curved sides (CARD_SHAPES) and is drawn in layers, back to front:
   a back plate that leans with the camera (shadow), a soft glow, the frosted face clipped to the
   outline (with a raised inner plate edged by a lip and a groove, and contour lines traced from the game),
   the icon and label, and a thin outer ring. On hover the card lifts and brightens. Thin cables run from every card
   to the disc bezel. Migrated verbatim from left-cards.js; icons/labels come from the config module. */

export interface CardSpec {
  action: string;
  label: string;
  art: string;
  /** 光学微调（px）：labelDx 平移整行文字，iconDx 平移 si-* 图标盒；实测 text.x 数组保持不动 */
  labelDx?: number;
  iconDx?: number;
  noted?: boolean;
  sheen?: boolean;
  text: LabelLayout;
}

const CARD_W = 440, CARD_H = 172;
const ANCHOR_X = 350;                          // card-local x that sits on the R_CARD circle
const R_CARD = R_EDGE + 16;
const ANGLES = [28.02, 10.52, -6.22, -21.56];  // polar angle of each card anchor, deg (0 = due left)

/** Card outlines in card-local px: top/bottom edges y = a + b·x, left/right sides x = a + b·y + c·y².
    plate = outer edge of the raised inner plate (its top edge and left side; the right and bottom run off the
    face, so only a dark band shows along the top and left); shadow = resting offset of the back plate. */
const CARD_SHAPES: (CardShape & {
  plate: { top: [number, number]; left: [number, number, number] };
  shadow: [number, number];
})[] = [
  { top: [22.19, -0.03542], bottom: [168.99, -0.03362], left: [173.3, -0.54768, 6.5769e-4], right: [399.48, -0.61494, 3.6623e-4], plate: { top: [38.65, -0.0352], left: [196.74, -0.56595, 6.3797e-4] }, shadow: [14, 20.3] },
  { top: [17.81, -0.03285], bottom: [170.39, -0.03319], left: [156.26, -0.40245, 1.4242e-3], right: [362.1, -0.28868, 6.3431e-4], plate: { top: [31.58, -0.03529], left: [176.6, -0.41875, 1.2589e-3] }, shadow: [15.9, 16.2] },
  { top: [16.02, -0.03221], bottom: [175.66, -0.0329], left: [125.98, -0.15145, 1.4506e-3], right: [330.5, 0.01888, 1.0545e-3], plate: { top: [26.28, -0.0346], left: [143.06, -0.1786, 1.3852e-3] }, shadow: [16.5, 12] },
  { top: [34.97, -0.02944], bottom: [153.99, -0.03242], left: [99.86, 0.28886, 3.757e-4], right: [320.36, 0.33845, 8.8469e-4], plate: { top: [41.71, -0.03279], left: [113.23, 0.2459, 5.216e-4] }, shadow: [15, 8.6] },
];
/** The plate's edge, measured on the game: a raised lip as bright as the plate, then a groove showing the dark band. */
const PLATE_LIP = 2.35, PLATE_GROOVE = 2.9;

/** Outline path of card `index`, grown outwards by `pad` px, with 12 px rounded corners. */
const cardPathD = (index: number, pad: number) => shapePathD(CARD_SHAPES[index], pad, 12);

/** The inner plate as three nested outlines (lip outer edge, lip inner edge, groove inner edge) filled evenodd:
    lip + plate are filled, the groove between them stays open. */
function platePathD(index: number): string {
  const s = CARD_SHAPES[index];
  const plate: CardShape = {
    top: s.plate.top,
    left: s.plate.left,
    right: [s.right[0] + 30, s.right[1], s.right[2]],
    bottom: [s.bottom[0] + 30, s.bottom[1]],
  };
  return [0, PLATE_LIP, PLATE_LIP + PLATE_GROOVE]
    .map((inset) => shapePathD(plate, -inset, 12 - inset))
    .join(" ");
}

/** Centre of card `index`'s face in the card box: the middle of its top and bottom edges at x = 250, and of its sides
    at that height. */
function cardCentre(index: number): [number, number] {
  const s = CARD_SHAPES[index];
  const ym = (s.top[0] + s.top[1] * 250 + s.bottom[0] + s.bottom[1] * 250) / 2;
  const sideX = (q: [number, number, number]) => q[0] + q[1] * ym + q[2] * ym * ym;
  return [(sideX(s.left) + sideX(s.right)) / 2, ym];
}

/* The entrance lights, one per card: the card's outline scaled about its centre by (sx, sy) and moved by (dx, dy)
   as measured, filled #f2f4ee and blurred by 40 (the filter sits on an untransformed group, so the scaling does not
   stretch the blur). [dx, dy, sx, sy] per card. */
const FLASH_BLOBS: [number, number, number, number][] = [[-28, 6, 0.74, 0.95], [-28, 6, 0.74, 0.95], [-6, 0, 0.76, 1.2], [-24, 4, 0.74, 1.12]];

/** Static per-card layout, computed once at module load (deterministic, config-independent). */
const LAYOUTS = ANGLES.map((_, i) => {
  const a = (ANGLES[i] * Math.PI) / 180;
  const ax = DISC.cx - R_CARD * Math.cos(a), ay = DISC.cy - R_CARD * Math.sin(a);
  return {
    cx: (ax - ANCHOR_X).toFixed(1),
    cy: (ay - CARD_H / 2).toFixed(1),
    outline: cardPathD(i, 0),
    glow: cardPathD(i, 2),
    ring: cardPathD(i, 4),
    plate: platePathD(i),
  };
});

function contoursMarkup(index: number) {
  return (CARD_CONTOURS[index] || []).map((ln, k) => {
    let d = "M" + ln[2] + " " + ln[3];
    for (let i = 4; i < ln.length; i += 2) d += " L" + ln[i] + " " + ln[i + 1];
    return <path key={k} d={d} strokeWidth={ln[0]} strokeOpacity={ln[1]} />;
  });
}

function CardMarkup({ card, i, onAction }: { card: CardSpec; i: number; onAction: (a: string) => void }) {
  const shape = CARD_SHAPES[i];
  const L = LAYOUTS[i];
  const box = { viewBox: `0 0 ${CARD_W} ${CARD_H}` } as const;
  // icon-pack cards (`si-*` symbols) scale into a square box centred above the label's RENDERED ink centre:
  // the label's local ink centre (first origin + last origin + last glyph width, CJK glyph ≈ its advance,
  // plus labelDx) pushed through the label's matrix — without this the matrix's x-shift makes the icon sit
  // off the label by up to ~15 px on strongly tilted cards; iconDx stays as the per-card optical nudge for
  // asymmetric art. The demo's extracted art-* groups are absolutely positioned markup and render at their
  // authored coordinates.
  const iconBox = (() => {
    if (!card.art.startsWith("si-")) return null;
    const size = 64;
    const xs = card.text.x;
    const adv = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : 0;
    const inkX = (xs[0] + xs[xs.length - 1] + adv) / 2 + (card.labelDx ?? 0);
    const inkY = card.text.y.length > 1 ? (card.text.y[0] + card.text.y[card.text.y.length - 1]) / 2 : card.text.y[0];
    const m = card.text.matrix;
    const cx = m ? m[0] * inkX + m[2] * inkY : inkX;
    return { x: cx + (card.iconDx ?? 0) - size / 2, y: 30, size };
  })();
  const labelDx = card.labelDx ?? 0;
  return (
    <div
      className="ef-card-shadow"
      style={cssVars({
        zIndex: 5 + i,
        "--cx": L.cx + "px",
        "--cy": L.cy + "px",
        "--ef-card-shx": shape.shadow[0],
        "--ef-card-shy": shape.shadow[1],
      })}
    >
      <svg className="ef-card__sh" {...box} data-ef-shadow="">
        <path className="sh-ring" d={L.ring} />
        <path className="sh-fill" d={L.outline} />
      </svg>
      <svg className="ef-card__glowsvg" {...box}>
        <defs>
          <filter id={`efCardGlow${i}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
        </defs>
        <path fill="rgba(255,255,255,0.34)" filter={`url(#efCardGlow${i})`} d={L.glow} />
      </svg>
      <button
        className="ef-card"
        data-action={card.action}
        aria-label={card.label}
        onClick={() => onAction(card.action)}
        style={cssVars({ "--ef-card-hit": `path('${L.outline}')` })}
      >
        <span className="ef-card__face" style={{ clipPath: `path('${L.outline}')` }}>
          <svg className="ef-card__panel" {...box}>
            <path className="ef-card__plate" d={L.plate} />
            <g className="ef-card__contour">{contoursMarkup(i)}</g>
            <path className="ef-card__hl" d={L.outline} />
          </svg>
          <svg className="ef-card__art" {...box} aria-hidden="true">
            {card.noted ? <use href={`#${card.art}-ring`} fill="#FDEF00" /> : null}
            {iconBox
              ? <use href={`#${card.art}`} x={iconBox.x} y={iconBox.y} width={iconBox.size} height={iconBox.size} />
              : <use href={`#${card.art}`} />}
            {card.sheen ? <use href={`#${card.art}-sheen`} fill="#575757" /> : null}
            <text
              {...labelText(labelDx ? { ...card.text, x: card.text.x.map((v) => v + labelDx) } : card.text)}
            >
              {card.label}
            </text>
          </svg>
        </span>
        <svg className="ef-card__ring" {...box}>
          <path className="ef-card__ringpath" d={L.ring} />
        </svg>
      </button>
    </div>
  );
}

/** Cables from each card to the bezel: four strands per card, in one group per card (.ef-links__b) that swings in
    about the card's end of the cables (--ef-lnk-x / y) on open. */
function Links() {
  const DX = 3, DY = 13;   // where the cables drop onto the bezel, they kink down slightly
  const stops = (
    <>
      <stop offset={0} stopColor="rgba(255,255,255,0.06)" />
      <stop offset={0.22} stopColor="rgba(255,255,255,0.5)" />
      <stop offset={0.75} stopColor="rgba(255,255,255,0.5)" />
      <stop offset={1} stopColor="rgba(255,255,255,0.04)" />
    </>
  );
  const pt = (x: number, y: number) => x.toFixed(1) + " " + y.toFixed(1);
  const gradients: React.ReactNode[] = [];
  const groups: React.ReactNode[] = [];
  ANGLES.forEach((phi, i) => {
    const a = (phi * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a);
    const px = (r: number, o: number) => DISC.cx - r * ux + o * tx;
    const py = (r: number, o: number) => DISC.cy - r * uy + o * ty;
    const rOut = R_CARD - 20, rTop = DISC.bezelR + 80, rFoot = DISC.bezelR + 34, rEnd = DISC.bezelR + 10;
    gradients.push(
      <linearGradient
        key={i}
        id={`lnkg${i}`}
        gradientUnits="userSpaceOnUse"
        x1={px(rOut, 0).toFixed(1)}
        y1={py(rOut, 0).toFixed(1)}
        x2={(px(rEnd, 0) + DX).toFixed(1)}
        y2={(py(rEnd, 0) + DY).toFixed(1)}
      >
        {stops}
      </linearGradient>,
    );
    groups.push(
      <g key={i} className="ef-links__b" style={cssVars({ "--ef-lnk-x": px(rOut, 0).toFixed(1) + "px", "--ef-lnk-y": py(rOut, 0).toFixed(1) + "px" })}>
        {[-6.9, -2.3, 2.2, 6.8].map((o, k) => (
          <path
            key={k}
            d={`M${pt(px(rOut, o), py(rOut, o))} L${pt(px(rTop, o), py(rTop, o))} L${pt(px(rFoot, o) + DX, py(rFoot, o) + DY)} L${pt(px(rEnd, o) + DX, py(rEnd, o) + DY)}`}
            fill="none"
            stroke={`url(#lnkg${i})`}
            strokeWidth={2.7}
            strokeLinejoin="miter"
            strokeLinecap="round"
          />
        ))}
      </g>,
    );
  });
  return (
    <svg className="ef-links" viewBox="0 0 1920 1080" aria-hidden="true">
      <defs>{gradients}</defs>
      {groups}
    </svg>
  );
}

/** The entrance lights, one per card (see FLASH_BLOBS above). */
function Flash() {
  return (
    <svg className="ef-left__flash" viewBox="0 0 1920 1080" aria-hidden="true">
      <defs>
        <filter id="efCardFlash" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={40} />
        </filter>
      </defs>
      {ANGLES.map((phi, i) => {
        const a = (phi * Math.PI) / 180, c = cardCentre(i), b = FLASH_BLOBS[i];
        const x = DISC.cx - R_CARD * Math.cos(a) - ANCHOR_X, y = DISC.cy - R_CARD * Math.sin(a) - CARD_H / 2;   // the card box's place (--cx / --cy)
        const tx = x + c[0] + b[0] - b[2] * c[0], ty = y + c[1] + b[1] - b[3] * c[1];
        return (
          <g key={i} className="ef-left__flashb" filter="url(#efCardFlash)">
            <path fill="#f2f4ee" transform={`matrix(${b[2]} 0 0 ${b[3]} ${tx.toFixed(1)} ${ty.toFixed(1)})`} d={cardPathD(i, 0)} />
          </g>
        );
      })}
    </svg>
  );
}

export function LeftCards({ cards }: { cards: CardSpec[] }) {
  const { onAction } = useMenuActions();
  return (
    <div className="ef-left">
      <Flash />
      <div className="ef-left__slide">
        {cards.map((card, i) => (
          <CardMarkup key={card.action} card={card} i={i} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

export { Links as CardLinks };
