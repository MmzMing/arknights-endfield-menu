// Hand-rolled unit checks (project rule: no test frameworks, node:assert only).
// Each check extracts the demo's own implementation of a pure function and compares it byte-for-byte
// with src/lib on identical inputs — the golden values come from the demo itself, live.
// Run: node src/test/lib/check-libs.mjs

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const DEMO = "D:/my-blog/endfield_menu/components";

function grab(file, startMarker) {
  const js = readFileSync(`${DEMO}/${file}`, "utf8");
  const i = js.indexOf(startMarker);
  if (i < 0) throw new Error(`marker not found in ${file}: ${startMarker}`);
  const j = js.indexOf("\n  }", i);   // the function's 2-space-indented closing brace, included
  if (j < 0) throw new Error(`closing brace not found in ${file}`);
  return js.slice(i, j + 4);
}

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

// ---- arcD: demo's shared-geometry.js vs src/lib/arc-d.ts ----
{
  const demoArcD = new Function(`${grab("shared-geometry.js", "function arcD(")}; return arcD;`)();
  const { arcD } = await import("../../lib/arc-d.ts");
  const cases = [
    [500, 500, 466, 44, 137],
    [500, 500, 466, 160, 380],
    [500, 500, 492.5, -40.5, -10],
    [500, 500, 492.5, 210, 234],
    [0, 0, 133.6, -96, -72],
    [0, 0, 255.4, 16, 52],
  ];
  check("arcD matches the demo on the menu's own arcs", () => {
    for (const c of cases) assert.equal(arcD(...c), demoArcD(...c), `arcD(${c.join(",")})`);
  });
}

// ---- mulberry32: demo's transition-skeleton.js vs src/lib/mulberry32.ts ----
{
  const demoMul = new Function(`${grab("transition-skeleton.js", "function mulberry32(")}; return mulberry32;`)();
  const { mulberry32 } = await import("../../lib/mulberry32.ts");
  check("mulberry32 reproduces the skeleton's seeded dot stream", () => {
    const a = demoMul(17), b = mulberry32(17);
    for (let i = 0; i < 500; i++) assert.equal(a(), b(), `draw ${i}`);
  });
}

// ---- shapePathD: demo's left-cards.js vs src/lib/shape-path-d.ts, on all four card shapes ----
{
  const demoShape = new Function(`${grab("left-cards.js", "function shapePathD(")}; return shapePathD;`)();
  const { shapePathD } = await import("../../lib/shape-path-d.ts");
  const cards = [
    { top: [22.19, -0.03542], bottom: [168.99, -0.03362], left: [173.3, -0.54768, 6.5769e-4], right: [399.48, -0.61494, 3.6623e-4] },
    { top: [17.81, -0.03285], bottom: [170.39, -0.03319], left: [156.26, -0.40245, 1.4242e-3], right: [362.1, -0.28868, 6.3431e-4] },
    { top: [16.02, -0.03221], bottom: [175.66, -0.0329], left: [125.98, -0.15145, 1.4506e-3], right: [330.5, 0.01888, 1.0545e-3] },
    { top: [34.97, -0.02944], bottom: [153.99, -0.03242], left: [99.86, 0.28886, 3.757e-4], right: [320.36, 0.33845, 8.8469e-4] },
  ];
  check("shapePathD matches the demo on every card outline, glow and ring", () => {
    for (const [i, card] of cards.entries()) {
      for (const pad of [0, 2, 4]) {
        assert.equal(shapePathD(card, pad, 12), demoShape(card, pad, 12), `card ${i + 1} pad ${pad}`);
      }
    }
  });
}

console.log(`\n${passed} checks passed`);
