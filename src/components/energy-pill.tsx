import "../styles/energy-pill.css";

/* Energy readout pill that sits just above the two yellow disc buttons. Migrated verbatim from energy-pill.js;
   the numbers come from the config module. */

export interface EnergyContent {
  current: string;
  max: string;
  percent: string;
}

export function EnergyPill({ content }: { content: EnergyContent }) {
  return (
    <div className="ef-energy">
      <span className="ef-energy__ic">
        <svg className="ef-icon">
          <use href="#ic-bolt" />
        </svg>
      </span>
      <b>{content.current}</b>
      <small>/{content.max}</small>
      <b className="ef-energy__pct">{content.percent}</b>
      <small className="ef-energy__unit">%</small>
      <span className="ef-energy__cell">
        <svg className="ef-icon">
          <use href="#ic-bolt" />
        </svg>
      </span>
    </div>
  );
}
