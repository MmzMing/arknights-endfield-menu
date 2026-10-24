import { useState } from "react";
import { cssVars } from "../lib/label-svg";
import { yearDay } from "../lib/calendar-days";
import { useMenuActions } from "../menu-actions";
import "../styles/top-bar.css";

/* Top bar above the disc: the friend-link count, the RSS count and the year-progress pill, each with a "+" button.
   It floats on its own layer above the dial rings. As in the game, the stamina pill lies on the floor plane
   (foreshortened with the rest of the menu) while the two currency counters face the camera like billboards:
   their group is tilted back by the camera's resting pitch, so the badge, the number and the round "+" are seen
   flat on. Badges are the game's artwork (button-art.ts); positions, sizes and number widths were measured on
   the reference screenshot, each counter in its own frame. Migrated verbatim from top-bar.js; the two counters
   now carry the friend-link and RSS counts (both open their lists), and the pill carries the year's days. */

/** "+" glyphs: the currencies' cross leaves a small square open in the middle; the stamina one is solid. */
const CROSS_GAP = "M-14.5 -2.1h11.9v4.2h-11.9zM2.6 -2.1h11.9v4.2h-11.9zM-2.1 -14.5h4.2v11.9h-4.2zM-2.1 2.6h4.2v11.9h-4.2z";
const CROSS_SOLID = "M-11.85 -1h23v4.4h-23zM-2.55 -10.3h4.4v23h-4.4z";

function Plus({ action, x, y, r, d, tip = "获取" }: { action: string; x: number; y: number; r: number; d: string; tip?: string }) {
  const { onAction } = useMenuActions();
  return (
    <button className="ef-plus" data-action={action} title={tip} style={cssVars({ left: x + "px", top: y + "px" })} onClick={() => onAction(action)}>
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

/** Read once per page load; the config's year summary uses the same helper, so both agree until reload. */
function currentYearDay() {
  return yearDay(new Date());
}

export function TopBar({ friendCount, rssCount }: { friendCount: number; rssCount: number }) {
  const [day] = useState(currentYearDay);
  return (
    <div className="ef-topbar">
      <div className="ef-cur ef-cur--a" style={cssVars({ left: "764.53px", top: "106.87px" })}>
        <Badge kind="a" art="counter-a" viewBox="-26 -24 52 48" />
        <b className="ef-cur__num" style={cssVars({ left: "32.45px", top: "-15.63px" })}>{friendCount}</b>
        <Plus action="friends" x={121.63} y={1.18} r={21.9} d={CROSS_GAP} tip="查看友链" />
      </div>
      <div className="ef-cur ef-cur--b" style={cssVars({ left: "968.01px", top: "100.25px" })}>
        <Badge kind="b" art="counter-b" viewBox="-26 -26 52 52" />
        <b className="ef-cur__num" style={cssVars({ left: "32.47px", top: "-15.95px" })}>{rssCount}</b>
        <Plus action="rss" x={172.34} y={1.22} r={21.9} d={CROSS_GAP} tip="查看 RSS" />
      </div>
      <div className="ef-stamina" style={cssVars({ left: "599.2px", top: "211.31px" })}>
        <span className="ef-stamina__pill" />
        <Badge kind="stamina" art="stamina" viewBox="-50 -50 105 95" />
        <b style={cssVars({ left: "55.79px", top: "-21.92px" })}>{day.elapsed}/{day.total}</b>
        <i />
        <Plus action="year" x={236.2} y={-6.3} r={23.1} d={CROSS_SOLID} tip="查看" />
      </div>
    </div>
  );
}
