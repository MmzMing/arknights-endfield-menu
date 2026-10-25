import { useId } from "react";
import { CHINA_MAP } from "../assets/china-map-data";
import "../styles/china-map.css";

/*
 * China map, migrated from the reference demo: the country (including Taiwan) sits filled in the middle, the
 * outlines of the neighbouring countries fade out towards the edges and a soft pastel band travels along the
 * outer border. The region switcher is dropped — the map is fixed on China, and a white arrow marks Guangdong.
 * Drawn on a 540 x 440 viewBox from Natural Earth country shapes (public domain).
 */

export function ChinaMap() {
  const id = "ef-cnmap" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const map = CHINA_MAP;
  const [cx, cy, r] = map.fade;

  return (
    <div className="ef-cnmap">
      <div className="ef-cnmap__art" role="img" aria-label="Map of China, marking Guangdong">
        <svg className="ef-cnmap__svg" viewBox="0 0 540 440" aria-hidden="true">
          <defs>
            <filter id={`${id}-shadow`} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow className="ef-cnmap__drop" dx="0" dy="3" stdDeviation="3.5" floodColor="#1F2128" floodOpacity="0.07" />
            </filter>
            {/* Colors of the band that travels along the outer border */}
            <linearGradient id={`${id}-shine`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="540" y2="220">
              <stop offset="0%" stopColor="#FFA0AB" />
              <stop offset="33%" stopColor="#FFB89E" />
              <stop offset="66%" stopColor="#C8A8E5" />
              <stop offset="100%" stopColor="#A8B5FF" />
            </linearGradient>
            <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            {/* Hides the glow inside the country, so it only spreads outwards from the border */}
            <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="440">
              <rect x="0" y="0" width="540" height="440" fill="#FFFFFF" />
              {map.land.map((d, i) => (
                <path key={i} d={d} fill="#000000" />
              ))}
            </mask>
            {/* Neighbouring countries are visible near the map and fade out towards the edges */}
            <radialGradient id={`${id}-fade`} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <stop offset="90%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <mask id={`${id}-neighbors`} maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="440">
              <rect x="0" y="0" width="540" height="440" fill={`url(#${id}-fade)`} />
            </mask>
          </defs>

          {/* Neighbouring countries: outlines only */}
          <g
            mask={`url(#${id}-neighbors)`}
            className="ef-cnmap__neighbors"
            fill="none"
            strokeWidth="0.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {map.neighbors.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* China */}
          <g className="ef-cnmap__land" filter={`url(#${id}-shadow)`} strokeWidth="0.9" strokeLinejoin="round">
            {map.land.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Band on the outer border: a blurred glow underneath, three sharp layers with shorter dashes on top */}
          <g fill="none" stroke={`url(#${id}-shine)`} strokeLinecap="round" strokeLinejoin="round">
            <path
              className="ef-cnmap__band"
              d={map.perimeter}
              pathLength={1000}
              strokeWidth="6"
              strokeDasharray="180 820"
              filter={`url(#${id}-blur)`}
              mask={`url(#${id}-outside)`}
              opacity="0.45"
            />
            <path className="ef-cnmap__band" d={map.perimeter} pathLength={1000} strokeWidth="1.4" strokeDasharray="200 800" opacity="0.32" />
            <path
              className="ef-cnmap__band ef-cnmap__band--1"
              d={map.perimeter}
              pathLength={1000}
              strokeWidth="1.4"
              strokeDasharray="140 860"
              strokeDashoffset="-30"
              opacity="0.55"
            />
            <path
              className="ef-cnmap__band ef-cnmap__band--2"
              d={map.perimeter}
              pathLength={1000}
              strokeWidth="1.4"
              strokeDasharray="80 920"
              strokeDashoffset="-60"
            />
          </g>

          {/* Guangdong marker: white arrow pointing at the map point */}
          <path className="ef-cnmap__arrow" transform="translate(393 367)" d="M-12 -17 L0 0 L12 -17 Z" />
        </svg>
      </div>
      <i className="ef-cnmap__scan" />
    </div>
  );
}
