// The frame-check fixture server: serves the demo, the built app and the local fonts from one origin.
// The demo's index.html is rewritten in flight: its Google Fonts <link>s become the same-origin
// /fonts/fonts.css (the identical woff2 set the app ships), so both sides of the comparison render
// identical glyphs with no network dependency. Zero dependencies (node:http).
// Usage: node src/test/frame/serve-fixture.mjs <port>

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");   // src/test/frame
const PROJECT = join(HERE, "..", "..", "..");
const DEMO = "D:/my-blog/endfield_menu";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

const port = Number(process.argv[2] ?? 8096);

function rewriteDemoFonts(html) {
  return html
    .replace(/<link rel="preconnect"[^>]*fonts\.[^>]*>\r?\n?/g, "")
    .replace(
      /<link [^>]*href="https:\/\/fonts\.googleapis\.com\/[^"]*"[^>]*>/,
      '<link href="/fonts/fonts.css" rel="stylesheet" />',
    );
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const seg = url.pathname.split("/")[1];
    let root, rel;
    if (seg === "fonts") {
      // /fonts/fonts.css → .fonts/fonts.css; /fonts/<file>.woff2 → .fonts/fonts/<file>.woff2
      rel = url.pathname.slice("/fonts".length) || "/fonts.css";
      root = join(HERE, ".fonts", rel === "/fonts.css" ? "" : "fonts");
    } else if (seg === "app") {
      root = join(PROJECT, "dist");
      rel = url.pathname.slice("/app".length) || "/";
      if (rel === "/") rel = "/index.html";
    } else {
      root = DEMO;
      rel = url.pathname.slice("/demo".length) || "/";
      if (rel === "/") rel = "/index.html";
    }
    const file = normalize(join(root, decodeURIComponent(rel)));
    const body = await readFile(file);
    const out = seg !== "fonts" && seg !== "app" && file.endsWith("index.html")
      ? Buffer.from(rewriteDemoFonts(body.toString("utf8")))
      : body;
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      // the harness reloads the same pages dozens of times; cached fonts keep loads fast and flake-free
      "cache-control": "public, max-age=3600",
    });
    res.end(out);
  } catch {
    res.writeHead(404);
    res.end("not found: " + req.url);
  }
}).listen(port, "127.0.0.1", () => console.log(`fixture on http://127.0.0.1:${port}/ (demo|app|fonts)`));
