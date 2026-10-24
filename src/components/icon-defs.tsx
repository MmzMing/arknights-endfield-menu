/* Site icon pack: reusable 1em-style icons for the integration site's own entries (site links, cards).
   Deliberately separate from the demo's extracted `art-*` groups and the HUD's `ic-*` symbols — these are
   hand-added SVG assets, kept verbatim from their source markup. The icon names are owned by
   src/config/link-config.ts (SiteIconName). Mount once via <SiteIconDefs/> next to <SpriteDefs/>, then
   reference anywhere with <use href="#si-<name>">; paths are fill="currentColor", so they theme from the
   CSS `color` of the using context (or set fill on paths that opt out). */

import type { SiteIconName } from "../config/link-config";

/** Inner SVG markup of each icon, verbatim from the source svgs (viewBox from the svg root). */
const SITE_ICONS: Record<SiteIconName, { viewBox: string; markup: string }> = {
  blog: {
    viewBox: "0 0 512 512",
    markup: `<path d="M0 0h512v512H0z" fill="none" /><path fill="currentColor" d="M172.2 226.8c-14.6-2.9-28.2 8.9-28.2 23.8V301c0 10.2 7.1 18.4 16.7 22c18.2 6.8 31.3 24.4 31.3 45c0 26.5-21.5 48-48 48s-48-21.5-48-48V120c0-13.3-10.7-24-24-24H24c-13.3 0-24 10.7-24 24v248c0 89.5 82.1 160.2 175 140.7c54.4-11.4 98.3-55.4 109.7-109.7c17.4-82.9-37-157.2-112.5-172.2M209 0c-9.2-.5-17 6.8-17 16v31.6c0 8.5 6.6 15.5 15 15.9c129.4 7 233.4 112 240.9 241.5c.5 8.4 7.5 15 15.9 15h32.1c9.2 0 16.5-7.8 16-17C503.4 139.8 372.2 8.6 209 0m.3 96c-9.3-.7-17.3 6.7-17.3 16.1v32.1c0 8.4 6.5 15.3 14.8 15.9c76.8 6.3 138 68.2 144.9 145.2c.8 8.3 7.6 14.7 15.9 14.7h32.2c9.3 0 16.8-8 16.1-17.3c-8.4-110.1-96.5-198.2-206.6-206.7" />`,
  },
  memo: {
    viewBox: "0 0 12 12",
    markup: `<path d="M0 0h12v12H0z" fill="none" /><path fill="currentColor" d="M0 12h9v-1H1V2h7v1h1V1H0Zm2-2h2V9H2Zm0-2h2V7H2Zm3 2h3V9H7V8H6V7H5ZM2 6h3V5H2Zm6 3h1V8H8ZM6 7h1V6H6ZM2 4h5V3H2Zm7 4h1V7H9ZM7 6h1V5H7Zm3 1h1V5h-1ZM8 5h2V4H8Zm0 0" />`,
  },
  status: {
    viewBox: "0 0 24 24",
    markup: `<path d="M0 0h24v24H0z" fill="none" /><g fill="none"><path fill="currentColor" fill-rule="evenodd" d="M21.94 4.9c0-.77 0-1.15-.1-1.46a2 2 0 0 0-1.26-1.27c-.31-.1-.7-.1-1.46-.1s-1.14 0-1.45.1a2 2 0 0 0-1.27 1.27c-.1.3-.1.69-.1 1.45v14.22a5 5 0 0 0 .1 1.45a2 2 0 0 0 1.27 1.27c.3.1.69.1 1.45.1c.77 0 1.15 0 1.46-.1a2 2 0 0 0 1.26-1.27c.1-.3.1-.69.1-1.45zm-7.82 5.4c0-.94 0-1.41-.29-1.7c-.3-.3-.76-.3-1.7-.3h-.25c-.95 0-1.42 0-1.71.3c-.3.29-.3.76-.3 1.7v8.91c0 .94 0 1.41.3 1.7s.76.3 1.7.3h.25c.95 0 1.42 0 1.71-.3c.3-.29.3-.76.3-1.7zM7 15.36c0-.94 0-1.42-.3-1.7c-.29-.3-.76-.3-1.7-.3h-.25c-.94 0-1.4 0-1.7.3c-.3.28-.3.76-.3 1.7v3.85c0 .94 0 1.41.3 1.7s.76.3 1.7.3H5c.94 0 1.41 0 1.7-.3c.3-.29.3-.76.3-1.7z" clip-rule="evenodd" opacity=".2" /><rect width="4.25" height="18.42" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="1" transform="matrix(-1 0 0 1 21.25 2.79)" /><rect width="4.25" height="12.91" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="1" transform="matrix(-1 0 0 1 14.12 8.3)" /><rect width="4.25" height="7.85" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="1" transform="matrix(-1 0 0 1 7 13.36)" /></g>`,
  },
  tool: {
    // full-bleed source art (16×16): the padded viewBox keeps its rendered size even with the other icons
    viewBox: "-2.6 -2.6 21.2 21.2",
    markup: `<path d="M0 0h16v16H0z" fill="none" /><path fill="currentColor" d="M1 0L0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675l-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617l.968.968l-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96l2.68-2.643A3.005 3.005 0 0 0 16 3q0-.405-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46L4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814zm9.646 10.646a.5.5 0 0 1 .708 0l2.914 2.915a.5.5 0 0 1-.707.707l-2.915-2.914a.5.5 0 0 1 0-.708M3 11l.471.242l.529.026l.287.445l.445.287l.026.529L5 13l-.242.471l-.026.529l-.445.287l-.287.445l-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471l.026-.529l.445-.287l.287-.445l.529-.026z" />`,
  },
};

/** Mounts the `si-*` sprite. `<use>` on a symbol scales it into the use's x/y/width/height box. */
export function SiteIconDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {(Object.keys(SITE_ICONS) as SiteIconName[]).map((name) => (
          <symbol key={name} id={`si-${name}`} viewBox={SITE_ICONS[name].viewBox} fill="currentColor">
            <g dangerouslySetInnerHTML={{ __html: SITE_ICONS[name].markup }} />
          </symbol>
        ))}
      </defs>
    </svg>
  );
}
