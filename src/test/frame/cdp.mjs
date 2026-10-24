// A hand-rolled Chrome DevTools Protocol client: launch a headless Chromium, speak JSON-RPC over WebSocket.
// Zero dependencies — Node's global WebSocket, child_process and fs only. (Project rule: no test frameworks.)

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function findExecutable() {
  const candidates = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const ms = join(local, "ms-playwright");
    // playwright-installed chromium first (already on this machine), then its headless shell
    for (const entry of existsSync(ms) ? readdirSync(ms) : []) {
      if (entry.startsWith("chromium-")) {
        const guess = join(ms, entry, "chrome-win64", "chrome.exe");
        if (existsSync(guess)) candidates.push(guess);
      }
      if (entry.startsWith("chromium_headless_shell-")) {
        const guess = join(ms, entry, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
        if (existsSync(guess)) candidates.push(guess);
      }
    }
  }
  candidates.push(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  );
  const found = candidates.find(existsSync);
  if (!found) throw new Error("no chromium/chrome/edge executable found");
  return found;
}

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      }
    });
  }

  static async launch() {
    const exe = findExecutable();
    const userDataDir = mkdtempSync(join(tmpdir(), "endfield-cdp-"));
    const args = [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--font-render-hinting=none",
      "about:blank",
    ];
    const proc = spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] });
    const wsUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("chromium did not expose a DevTools websocket")), 15000);
      const onChunk = (chunk) => {
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(String(chunk));
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      };
      proc.stderr.on("data", onChunk);
      proc.stdout.on("data", onChunk);
      proc.on("exit", (code) => reject(new Error(`chromium exited early (${code})`)));
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("websocket connect failed")), { once: true });
    });
    const cdp = new Cdp(ws);
    cdp.proc = proc;
    return cdp;
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  /** opens a tab and returns its flat session id */
  async newTab() {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    await this.send("Page.enable", {}, sessionId);
    await this.send("Runtime.enable", {}, sessionId);
    return { targetId, sessionId };
  }

  async closeTab(targetId) {
    await this.send("Target.closeTarget", { targetId });
  }

  /** evaluates an (optionally async) expression in the page and resolves its value */
  async evaluate(sessionId, expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) {
      throw new Error("page eval failed: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result?.value;
  }

  async screenshot(sessionId) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" }, sessionId);
    return Buffer.from(data, "base64");
  }

  kill() {
    this.ws.close();
    this.proc.kill();
  }
}
