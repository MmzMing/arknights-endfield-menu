import { useEffect } from "react";
import type { DialogContent } from "../config/menu-content";
import "../styles/info-dialog.css";

/* Info dialog: the unified Endfield-styled panel every [data-action] button opens. The menu holds still while
   it is up (App pauses the camera and the carousel); ESC, the overlay or the × closes it. */

export interface DialogArt {
  /** an <use> target from button-art.ts, with the viewBox it was drawn in */
  href: string;
  viewBox: string;
}

export function InfoDialog({
  content,
  art,
  onClose,
}: {
  content: DialogContent;
  art?: DialogArt;
  onClose: () => void;
}) {
  // ESC closes the dialog (App's own handler stays quiet while the dialog is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ef-idlg" role="dialog" aria-modal="true" aria-label={content.subtitle}>
      <div className="ef-idlg__dim" onClick={onClose} />
      <div className="ef-idlg__panel">
        <div className="ef-idlg__head">
          <div className="ef-idlg__icon">
            {art ? (
              <svg viewBox={art.viewBox} aria-hidden="true">
                <use href={art.href} />
              </svg>
            ) : (
              <svg viewBox="-24 -24 48 48" aria-hidden="true" fill="none" stroke="#D5B983" strokeWidth={2}>
                <path d="M0 -18 L18 0 L0 18 L-18 0 Z" />
                <path d="M0 -9 L9 0 L0 9 L-9 0 Z" />
              </svg>
            )}
          </div>
          <div>
            <div className="ef-idlg__title">{content.title}</div>
            <div className="ef-idlg__subtitle">{content.subtitle}</div>
          </div>
          <button className="ef-idlg__close" title="关闭" aria-label="关闭" onClick={onClose}>
            <span>
              <svg className="ef-icon">
                <use href="#ic-x" />
              </svg>
            </span>
          </button>
        </div>
        <div className="ef-idlg__body">{content.description}</div>
        {content.meta.length > 0 && (
          <div className="ef-idlg__meta">
            {content.meta.map((row) => (
              <div className="ef-idlg__row" key={row.label}>
                <b>{row.label}</b>
                <i />
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ef-idlg__hint">
          <span>FAN RECREATION · NON-COMMERCIAL</span>
          <span>TAP ANYWHERE TO CONTINUE</span>
        </div>
      </div>
    </div>
  );
}
