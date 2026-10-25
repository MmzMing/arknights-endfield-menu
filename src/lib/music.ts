/* 音乐终端的纯函数：Meting 响应归一化、LRC 解析、播放模式与时间格式化。
   网络请求与 <audio> 生命周期在 hooks/use-music-player.ts，这里不产生副作用。 */

import type { MusicMetingConfig } from "../config/music-config";

export interface MusicTrack {
  name: string;
  artist: string;
  url: string;
  pic?: string;
  lrc?: string;
}

export interface MusicLyricLine {
  time: number;
  text: string;
}

export type MusicPlayMode = 0 | 1 | 2;

const LRC_TIME = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function playModeFromName(name: string): MusicPlayMode {
  return name === "one" ? 1 : name === "random" ? 2 : 0;
}

/** 把 Meting 的 :server / :type / :id / :r 占位符换成配置值（r 为缓存击穿参数）。 */
export function buildMetingUrl(api: string, meting: MusicMetingConfig, nonce: number): string {
  let url = api
    .replaceAll(":server", meting.server)
    .replaceAll(":type", meting.type)
    .replaceAll(":id", meting.id)
    .replaceAll(":r", String(nonce));
  if (meting.auth) url += `${url.includes("?") ? "&" : "?"}auth=${encodeURIComponent(meting.auth)}`;
  return url;
}

function readString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/** Meting 各镜像的字段名不一致（name/title、artist/author、pic/cover），统一成 MusicTrack。 */
export function normalizeMetingTrack(value: unknown): MusicTrack | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const url = readString(item, ["url", "link"]);
  if (!url) return null;
  const pic = readString(item, ["pic", "cover"]);
  const lrc = readString(item, ["lrc", "lyric"]);
  return {
    name: readString(item, ["name", "title"]) ?? "未知曲目",
    artist: readString(item, ["artist", "author"]) ?? "未知艺术家",
    url,
    ...(pic ? { pic } : {}),
    ...(lrc ? { lrc } : {}),
  };
}

export function formatMusicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 解析 [mm:ss.xx] 歌词；一行多时间戳会展开成多条，按时间排序。 */
export function parseLrc(source: string): MusicLyricLine[] {
  const lines: MusicLyricLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(LRC_TIME)];
    if (stamps.length === 0) continue;
    const text = raw.replace(LRC_TIME, "").trim();
    if (!text) continue;
    for (const stamp of stamps) {
      const minutes = Number.parseInt(stamp[1], 10);
      const seconds = Number.parseInt(stamp[2], 10);
      const fraction = stamp[3] ?? "";
      const millis = fraction.length === 0 ? 0 : Number.parseInt(fraction, 10) / (fraction.length === 3 ? 1000 : 100);
      lines.push({ time: minutes * 60 + seconds + millis, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function findLyricIndex(lines: MusicLyricLine[], time: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (time >= lines[i].time) index = i;
    else break;
  }
  return index;
}
