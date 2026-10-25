import { SITE_NOTICE, SITE_RECORDS } from "../config/site-records";
import "../styles/legal-footer.css";

/* Site records: ICP / police filing on the left, main-menu replica notice on the right. Rendered inside the stage
   for the open menu and as a fixed copy for the closed landing, so the filing stays visible in both states. */
export function LegalFooter({ variant = "stage" }: { variant?: "stage" | "fixed" }) {
  return (
    <div className={`ef-legal ef-legal--${variant}`}>
      <div className="ef-legal__left">
        <span className="ef-legal__copyright">{SITE_RECORDS.copyright}</span>
        <a className="ef-legal__link" href={SITE_RECORDS.icp.url} target="_blank" rel="noopener noreferrer">
          {SITE_RECORDS.icp.label}
        </a>
        <a className="ef-legal__link ef-legal__police" href={SITE_RECORDS.police.url} target="_blank" rel="noopener noreferrer">
          <img className="ef-legal__police-icon" src={SITE_RECORDS.police.icon} alt="" />
          <span>{SITE_RECORDS.police.label}</span>
        </a>
      </div>
      <p className="ef-legal__notice">{SITE_NOTICE}</p>
    </div>
  );
}
