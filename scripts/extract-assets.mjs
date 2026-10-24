// One-off extractor: pulls the measured art data out of the demo sources byte-exactly
// (a hand transcription of megabytes of path data would risk typos; this cannot).
// Run: node scripts/extract-assets.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const DEMO = "D:/my-blog/endfield_menu/components";
const OUT = "src/assets";
mkdirSync(OUT, { recursive: true });

// ---- backdrop-field.js: { width, height, edge, src } ----
{
  const js = readFileSync(`${DEMO}/backdrop-field.js`, "utf8");
  const width = js.match(/width: (\d+)/)[1];
  const height = js.match(/height: (\d+)/)[1];
  const edge = js.match(/edge: ("[^"]+")/)[1];
  const src = js.match(/src: ("[^"]+")/)[1];
  const ts = `/* Colour field of the backdrop haze, sampled from a screenshot of the Arknights: Endfield main menu.
   Extracted verbatim from the demo's backdrop-field.js. Derived from the game's imagery:
   NOT covered by the project's license; see README.md. */
export const BACKDROP_FIELD = {
  width: ${width},
  height: ${height},
  edge: ${edge},
  src: ${src},
} as const;
`;
  writeFileSync(`${OUT}/backdrop-field.ts`, ts);
}

// ---- card-contours.js: EF.CARD_CONTOURS (array of arrays of number[]) ----
{
  const js = readFileSync(`${DEMO}/card-contours.js`, "utf8");
  const json = js.match(/EF\.CARD_CONTOURS = ([\s\S]*?\]);\s*\}\)\(\);/)[1];
  // not plain JSON: the literal keeps its per-card comments, so evaluate it as JS to validate the slice
  const parsed = new Function("return " + json)();
  const ts = `/* Contour lines on the top two left cards, traced line by line from a screenshot of the Arknights: Endfield
   main menu. One entry per polyline: [strokeWidth, strokeOpacity, x0, y0, x1, y1, ...] in card-local px (440 x 172).
   Extracted verbatim from the demo's card-contours.js. Derived from the game's imagery:
   NOT covered by the project's license; see README.md. */
export type ContourLine = number[];

export const CARD_CONTOURS: ContourLine[][] = ${json};
`;
  writeFileSync(`${OUT}/card-contours.ts`, ts);
}

// ---- button-art.js: DEFS string + ART record of path markup ----
{
  const js = readFileSync(`${DEMO}/button-art.js`, "utf8");
  const defs = js.match(/const DEFS = '([\s\S]*?)';\r?\n/)[1];
  const entries = [...js.matchAll(/\r?\n\s{4}"([a-z0-9-]+)": '([\s\S]*?)',(?=\r?\n)/g)];
  if (entries.length < 25) throw new Error("button-art extraction found only " + entries.length + " entries");
  const lines = entries.map((m) => `  "${m[1]}": ${JSON.stringify(m[2])},`);
  const ts = `/* Artwork of the menu buttons, redrawn as SVG from a screenshot of the Arknights: Endfield main menu.
   Extracted verbatim from the demo's button-art.js. (c) Hypergryph. This file is NOT covered by the project's
   license; see README.md.
   Each piece is in its own button's coordinates; shapes are filled with fill-rule evenodd and take their colour
   from the <use> that draws them, except the counter badges, which carry their own colours. */
export const ART_DEFS = ${JSON.stringify(defs)};

export const BUTTON_ART: Record<string, string> = {
${lines.join("\n")}
};
`;
  writeFileSync(`${OUT}/button-art.ts`, ts);
  console.log("button-art entries:", entries.length);
}

console.log("done");
