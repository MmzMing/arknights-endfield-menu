import { cssVars } from "../lib/label-svg";
import { useMenuActions } from "../menu-actions";
import "../styles/top-bar.css";

/* Top bar above the disc: two currencies and the stamina pill, each with a "+" button.
   It floats on its own layer above the dial rings. As in the game, the stamina pill lies on the floor plane
   (foreshortened with the rest of the menu) while the two currency counters face the camera like billboards:
   their group is tilted back by the camera's resting pitch, so the badge, the number and the round "+" are seen
   flat on. Badges are the game's artwork (button-art.ts); positions, sizes and number widths were measured on
   the reference screenshot, each counter in its own frame. Migrated verbatim from top-bar.js. */

/** "+" glyphs: the currencies' cross leaves a small square open in the middle; the stamina one is solid. */
const CROSS_GAP = "M-14.5 -2.1h11.9v4.2h-11.9zM2.6 -2.1h11.9v4.2h-11.9zM-2.1 -14.5h4.2v11.9h-4.2zM-2.1 2.6h4.2v11.9h-4.2z";
const CROSS_SOLID = "M-11.85 -1h23v4.4h-23zM-2.55 -10.3h4.4v23h-4.4z";

function Plus({ action, x, y, r, d }: { action: string; x: number; y: number; r: number; d: string }) {
  const { onAction } = useMenuActions();
  return (
    <button className="ef-plus" data-action={action} title="获取" style={cssVars({ left: x + "px", top: y + "px" })} onClick={() => onAction(action)}>
      <svg viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

function Badge({ kind, art, viewBox }: { kind: string; art: string; viewBox: string }) {
  return (
    <svg className={`ef-topbar__badge ef-topbar__badge--${kind}`} viewBox={viewBox} aria-hidden="true">
      <use href={`#art-${art}`} />
    </svg>
  );
}

export interface TopBarContent {
  currencyA: string;
  currencyB: string;
  stamina: string;
}

export function TopBar({ content }: { content: TopBarContent }) {
  return (
    <div className="ef-topbar">
      <div className="ef-cur ef-cur--a" style={cssVars({ left: "764.53px", top: "106.87px" })}>
        <Badge kind="a" art="counter-a" viewBox="-26 -24 52 48" />
        <b className="ef-cur__num" style={cssVars({ left: "32.45px", top: "-15.63px" })}>{content.currencyA}</b>
        <Plus action="topup-a" x={121.63} y={1.18} r={21.9} d={CROSS_GAP} />
      </div>
      <div className="ef-cur ef-cur--b" style={cssVars({ left: "968.01px", top: "100.25px" })}>
        <Badge kind="b" art="counter-b" viewBox="-26 -26 52 52" />
        <b className="ef-cur__num" style={cssVars({ left: "32.47px", top: "-15.95px" })}>{content.currencyB}</b>
        <Plus action="topup-b" x={172.34} y={1.22} r={21.9} d={CROSS_GAP} />
      </div>
      <div className="ef-stamina" style={cssVars({ left: "599.2px", top: "211.31px" })}>
        <span className="ef-stamina__pill" />
        <Badge kind="stamina" art="stamina" viewBox="-50 -50 105 95" />
        <b style={cssVars({ left: "55.79px", top: "-21.92px" })}>{content.stamina}</b>
        <i />
        <Plus action="stamina" x={236.2} y={-6.3} r={23.1} d={CROSS_SOLID} />
      </div>
    </div>
  );
}
