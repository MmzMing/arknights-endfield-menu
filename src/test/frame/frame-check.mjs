// The acceptance harness of the "pixel-perfect, millisecond-exact" claim — hand-rolled, no test framework
// (project rule). Renders the demo and the built app in one headless Chromium via raw CDP, freezes every
// CSS animation at the same currentTime and diffs the PNGs (hand-rolled decoder).
//
//   node src/test/frame/frame-check.mjs            full run (entrance 17 / exit 12 / steady / camera frames)
//   node src/test/frame/frame-check.mjs steady     only the cheap steady frame (quick health check)
//
// One tab only, loading demo and app sequentially per frame: in headless Chromium a background tab's
// compositor may not produce fresh frames, and a screenshot of it can return a stale pre-seek frame
// (observed as bimodal whole-screen mismatches). Screenshots are taken after a double-rAF flush.
//
// Tolerance: a pixel counts as differing when any channel moves by more than CHANNEL_TOL; a frame passes
// while at most MAX_DIFF_RATIO of pixels differ (font rasterization jitter, mostly). Failing frames are
// written to src/test/frame/.artifacts/ for inspection. Exit code 1 on any failure.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Cdp } from "./cdp.mjs";
import { decodePng, diffPng } from "./png.mjs";

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");   // src/test/frame
const PROJECT = join(HERE, "..", "..", "..");
const ART = join(HERE, ".artifacts");
const PORT = 8096;
const DEMO_URL = `http://127.0.0.1:${PORT}/demo/`;
const APP_URL = `http://127.0.0.1:${PORT}/app/`;

// entrance samples: the beats the timeline hits (backdrop cut, disc pose, rings, readouts, cards/tiles slide)
const ENTRANCE_TIMES = [0, 50, 100, 150, 200, 250, 300, 355, 400, 450, 500, 560, 620, 700, 780, 860, 950];
const EXIT_TIMES = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550];
const CHANNEL_TOL = 2;
const MAX_DIFF_RATIO = 0.005;
const ONLY = process.argv[2] ?? "all";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function navigate(cdp, sessionId, url) {
  await cdp.send("Page.navigate", { url }, sessionId);
  for (let i = 0; i < 200; i++) {
    const ready = await cdp.evaluate(sessionId, "document.readyState === 'complete' ? 1 : 0").catch(() => 0);
    if (ready) return;
    await sleep(50);
  }
  throw new Error("page never reached load state: " + url);
}

async function waitFor(cdp, sessionId, expression, timeoutMs) {
  for (let i = 0; i < timeoutMs / 40; i++) {
    if (await cdp.evaluate(sessionId, expression).catch(() => 0)) return;
    await sleep(40);
  }
  throw new Error("timeout waiting for: " + expression);
}

/** freezes every animation at exactly t ms into its (current) timeline, then lets the compositor produce frames */
async function pauseAndSeek(cdp, sessionId, t) {
  await cdp.evaluate(sessionId, `(() => {
    document.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = ${t}; });
  })()`);
  // three rAFs + a beat: headless compositors occasionally still hold the pre-seek surface otherwise
  await cdp.evaluate(sessionId, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))");
  await sleep(80);
}

/** load `url` in the tab, drive it to the phase the frame needs, return the screenshot */
async function frameAt(cdp, sessionId, url, phase, t) {
  await navigate(cdp, sessionId, url);
  await waitFor(cdp, sessionId, "document.body.classList.contains('ef-in')", 15000);
  await cdp.evaluate(sessionId, "document.fonts.ready.then(() => 1)");
  if (phase === "entrance") {
    await pauseAndSeek(cdp, sessionId, t);
  } else {
    // wait for the entrance choreography to finish (the class drops at 900 ms) before settling or exiting
    await waitFor(cdp, sessionId, "!document.body.classList.contains('ef-in')", 5000);
    await sleep(700);
    if (phase === "exit") {
      await cdp.evaluate(sessionId, "document.querySelector('.ef-power').click()");
      await waitFor(cdp, sessionId, "document.body.classList.contains('ef-out')", 5000);
      await sleep(120);   // let the exit animations be created and one frame produced before the seek
      await pauseAndSeek(cdp, sessionId, t);
    } else if (phase === "camera") {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 200, y: 150 }, sessionId);
      await sleep(2000);   // let the spring settle on its target
      await pauseAndSeek(cdp, sessionId, 60000);
    } else {
      await pauseAndSeek(cdp, sessionId, 60000);
    }
  }
  return cdp.screenshot(sessionId);
}

const results = [];
async function compare(cdp, sessionId, name, phase, t) {
  // mismatches are re-captured (up to 3 tries): the headless compositor occasionally hands back a stale
  // pre-seek surface although every animation state is identical — verified by probing computed styles,
  // row transforms and animation lists, which all match byte-for-byte when this happens
  for (let attempt = 1; attempt <= 3; attempt++) {
    const demoBuf = await frameAt(cdp, sessionId, DEMO_URL, phase, t);
    const appBuf = await frameAt(cdp, sessionId, APP_URL, phase, t);
    const r = diffPng(decodePng(demoBuf), decodePng(appBuf));
    const pass = r.ratio <= MAX_DIFF_RATIO;
    if (pass || attempt === 3) {
      results.push({ name, ...r, pass });
      console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(16)} diff ${(r.ratio * 100).toFixed(3)}%  worst Δ${r.worst} @(${r.worstAt})${pass && attempt > 1 ? "  (retry)" : ""}`);
      if (!pass) {
        mkdirSync(ART, { recursive: true });
        writeFileSync(join(ART, `${name}-demo.png`), demoBuf);
        writeFileSync(join(ART, `${name}-app.png`), appBuf);
      }
      return;
    }
  }
}

// ---- run ----
if (!existsSync(join(PROJECT, "dist", "index.html"))) {
  console.error("dist/ missing — run `pnpm build` first");
  process.exit(2);
}

const server = spawn(process.execPath, ["serve-fixture.mjs", String(PORT)], { cwd: HERE, stdio: "inherit" });
await sleep(600);

const cdp = await Cdp.launch();
let failed = 0;
try {
  const { targetId, sessionId } = await cdp.newTab();
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
  }, sessionId);

  await compare(cdp, sessionId, "steady", "steady", 0);
  if (ONLY === "all") {
    for (const t of ENTRANCE_TIMES) await compare(cdp, sessionId, `entrance-${t}`, "entrance", t);
    for (const t of EXIT_TIMES) await compare(cdp, sessionId, `exit-${t}`, "exit", t);
    await compare(cdp, sessionId, "camera", "camera", 0);
  }
  await cdp.closeTab(targetId);
} catch (err) {
  console.error(String(err.message ?? err));
  failed += 1;
} finally {
  cdp.kill();
  server.kill();
}

const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} frames matched (tolerance: Δ${CHANNEL_TOL} per channel, ≤${(MAX_DIFF_RATIO * 100).toFixed(1)}% pixels)`);
if (bad.length) console.log("failing frames saved to src/test/frame/.artifacts/");
process.exit(bad.length + failed > 0 ? 1 : 0);
