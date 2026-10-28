import { cssVars } from "../lib/label-svg";
import { useMenuActions } from "../menu-actions";
import { useNetStatus } from "../hooks/use-net-status";
import { CloseIcon } from "./close-icon";
import "../styles/hud.css";

/* HUD controls: system buttons (top left), power button (bottom left), close button (top right)
   and the flat network/UID readout in the bottom-left corner of the screen.
   Migrated verbatim from hud.js. */

/** The glyph's shadow: a soft dark halo dropped slightly downwards and kept outside the glyph, so the stripes still
    show through it; the glyph itself is drawn at 78%. */
const POWER_GLOW =
  '<filter id="efPowerGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2"></feGaussianBlur><feOffset dy="1.9"></feOffset><feComposite in2="SourceAlpha" operator="out"></feComposite><feComponentTransfer result="glow"><feFuncA type="linear" slope="0.62"></feFuncA></feComponentTransfer><feComponentTransfer in="SourceGraphic"><feFuncA type="linear" slope="0.78"></feFuncA></feComponentTransfer><feMerge><feMergeNode in="glow"></feMergeNode><feMergeNode></feMergeNode></feMerge></filter>';

export function Hud() {
  const { onAction, requestClose } = useMenuActions();
  return (
    <>
      <div className="ef-sysbtns">
        <button className="ef-sysbtn" data-action="settings" title="设置" onClick={() => onAction("settings")}>
          <svg className="ef-icon">
            <use href="#ic-gear-f" />
          </svg>
        </button>
        <button className="ef-sysbtn" data-action="mail" title="邮件" onClick={() => onAction("mail")}>
          <svg className="ef-icon">
            <use href="#ic-mail-f" />
          </svg>
        </button>
        <button className="ef-sysbtn" data-action="alerts" title="警报" onClick={() => onAction("alerts")}>
          <svg className="ef-icon">
            <use href="#ic-warn-f" />
          </svg>
          <i className="ef-dot" />
        </button>
      </div>
      <button className="ef-power" data-action="close" title="关闭菜单" onClick={requestClose}>
        <i className="ef-power__sh" data-ef-shadow="" />
        <i className="ef-power__plate" />
        <svg className="ef-icon">
          <defs dangerouslySetInnerHTML={{ __html: POWER_GLOW }} />
          <use href="#ic-power" x="2.7" y="2.52" width="48" height="48" filter="url(#efPowerGlow)" />
        </svg>
      </button>
    </>
  );
}

export function CloseButton() {
  const { requestClose } = useMenuActions();
  return (
    <button
      className="ef-close"
      data-action="close"
      title="关闭"
      style={cssVars({ "--x": "1803px", "--y": "92px" })}
      onClick={requestClose}
    >
      <span>
        <CloseIcon className="ef-icon" />
      </span>
    </button>
  );
}

export function NetInfo({ netUid }: { netUid: string }) {
  const status = useNetStatus();
  const readout =
    status === null
      ? "--ms"
      : status.mode === "latency"
        ? `${status.latency}ms`
        : status.fps === null
          ? "-- FPS"
          : `${status.fps} FPS`;
  return (
    <div className="ef-netinfo">
      <svg className="ef-icon">
        <use href="#ic-signal" />
      </svg>
      <span>{readout}</span>
      <span>UID: {netUid}</span>
    </div>
  );
}
