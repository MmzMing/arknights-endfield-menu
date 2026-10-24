import { useLayoutEffect, useRef } from "react";
import { useScene } from "../scene/scene-context";
import "../styles/player-badge.css";

/* Player badge in the bottom-left: avatar placeholder, name, level, UID and permission tier.
   All personal details are masked as "xxxxx" in the config module. Migrated verbatim from player-badge.js. */

export interface PlayerContent {
  avatarLabel: string;
  name: string;
  sub: string;
  level: string;
  uid: string;
  permLabel: string;
  permTier: string;
}

export function PlayerBadge({ content }: { content: PlayerContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useScene();

  useLayoutEffect(() => {
    if (ref.current) scene.attach(ref.current, 30);
  }, [scene]);

  return (
    <div className="ef-badge" ref={ref}>
      <div className="ef-badge__plate" data-ef-shadow="" />
      <div className="ef-badge__streak" />
      <div className="ef-badge__rim" />
      <div className="ef-badge__inner">
        <div className="ef-badge__avatar">
          {content.avatarLabel}
          <i className="ef-badge__scan" />
          <i className="ef-badge__chip" />
        </div>
        <div className="ef-badge__mid">
          <div className="ef-badge__name">{content.name}</div>
          <div className="ef-badge__sub">{content.sub}</div>
          <div className="ef-badge__lv">{content.level}</div>
          <div className="ef-badge__bar" />
          <div className="ef-badge__uid">{content.uid}</div>
        </div>
        <div className="ef-badge__perm">
          <i className="ef-badge__pill" />
          <div className="ef-badge__permtxt">
            <small>{content.permLabel}</small>
            <b>{content.permTier}</b>
          </div>
          <svg className="ef-badge__tier" viewBox="0 0 60 56" aria-hidden="true">
            <use href="#art-badge-tier" />
            <path d="M39.15 22.55L49.35 28.45L39.15 34.35Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
