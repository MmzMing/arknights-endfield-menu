// 实时订阅聚合：抓取「本站 + 全部友链」的 RSS/Atom，返回条目与抓取失败的源。
// 由 EdgeOne / Cloudflare / Vercel 的函数适配器与 Vite dev 中间件共用；快照脚本也复用它。
import { extract } from "@extractus/feed-extractor";
import {
  FEED_CONFIG,
  type FeedFailure,
  type FeedItem,
  type FeedSnapshot,
} from "../src/config/feeds.ts";
import { FRIEND_LINKS } from "../src/config/friend-links.ts";
import { SITE_CONFIG } from "../src/config/site-config.ts";
import { toFeedItems } from "../src/lib/feed.ts";

// 部分源会拦截默认 UA / 非浏览器请求，保留与快照脚本一致的浏览器 UA。
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ACCEPT = "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8";
const CACHE_KEY_PATH = "/api/feeds";

interface FeedSource {
  name: string;
  feedUrl: string;
  siteUrl: string;
}

interface SourceResult {
  items: FeedItem[];
  failure?: FeedFailure;
}

const SOURCES: FeedSource[] = [
  { name: FEED_CONFIG.selfName, feedUrl: FEED_CONFIG.selfUrl, siteUrl: SITE_CONFIG.siteUrl },
  ...FRIEND_LINKS.flatMap((friend) =>
    friend.rss ? [{ name: friend.name, feedUrl: friend.rss, siteUrl: friend.url }] : [],
  ),
].filter((source, index, all) => all.findIndex((candidate) => candidate.feedUrl === source.feedUrl) === index);

export interface FeedAggregateOptions {
  attempts: number;
  concurrency: number;
  maxPerSite: number;
  timeoutMs: number;
  onSource?: (result: { name: string; count: number; reason?: string }) => void;
}

const REALTIME_OPTIONS: FeedAggregateOptions = {
  attempts: FEED_CONFIG.edgeAttempts,
  concurrency: FEED_CONFIG.edgeConcurrency,
  maxPerSite: FEED_CONFIG.maxPerSite,
  timeoutMs: FEED_CONFIG.edgeTimeoutMs,
};

function failureReason(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "AbortError" || name === "TimeoutError") return "请求超时";
  if (message === "feed has no usable entries") return "没有可解析的条目";
  if (/not well-formed|unrecognized feed|invalid content type/i.test(message)) return "返回的不是有效订阅";
  if (/error code|failed to load/i.test(message)) return "站点返回错误";
  return "获取失败";
}

async function fetchSource(source: FeedSource, options: FeedAggregateOptions): Promise<SourceResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const feed = await extract(
        source.feedUrl,
        { descriptionMaxLen: 0, useISODateFormat: true },
        (url) =>
          fetch(url, {
            headers: { accept: ACCEPT, "user-agent": USER_AGENT },
            redirect: "follow",
            signal: controller.signal,
          }),
      );
      const items = toFeedItems(feed.entries, source.name, options.maxPerSite);
      if (items.length > 0) return { items };
      lastError = new Error("feed has no usable entries");
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn(`feed failed: ${source.name} (${source.feedUrl})`, lastError);
  return {
    items: [],
    failure: { name: source.name, url: source.siteUrl, reason: failureReason(lastError) },
  };
}

export async function aggregateFeeds(options: FeedAggregateOptions = REALTIME_OPTIONS): Promise<FeedSnapshot> {
  const results = new Array<SourceResult | undefined>(SOURCES.length);
  let cursor = 0;

  async function worker() {
    while (cursor < SOURCES.length) {
      const index = cursor;
      cursor += 1;
      const source = SOURCES[index];
      if (source === undefined) continue;
      const result = await fetchSource(source, options);
      results[index] = result;
      options.onSource?.({ name: source.name, count: result.items.length, reason: result.failure?.reason });
    }
  }

  const workers = Math.max(1, Math.min(options.concurrency, SOURCES.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  const items = results
    .flatMap((result) => result?.items ?? [])
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
  const failures = results.flatMap((result) => (result?.failure ? [result.failure] : []));

  return {
    generatedAt: new Date().toISOString(),
    sites: SOURCES.length - failures.length,
    total: SOURCES.length,
    items,
    failures,
  };
}

export interface FeedsRequestOptions {
  /** 平台提供的后台任务通道（Cloudflare / EdgeOne）；缺省时等待缓存写完再返回。 */
  waitUntil?: (promise: Promise<unknown>) => void;
}

interface CacheStorageLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

const CACHE_AGE_HEADER = "x-feeds-cached-at";
const CACHE_TTL_MS = FEED_CONFIG.cacheTtlSeconds * 1000;

let memoryCache: { key: string; expiresAt: number; response: Response } | null = null;

function platformCache(): CacheStorageLike | null {
  const globalCaches = (globalThis as { caches?: { default?: CacheStorageLike } }).caches;
  return globalCaches?.default ?? null;
}

async function readCache(key: string): Promise<Response | null> {
  const cache = platformCache();
  if (cache !== null) {
    try {
      const hit = await cache.match(new Request(key));
      if (hit === undefined) return null;

      // Cache API 不一定按 Cache-Control 过期，用写入时间兜底；没有该头则信任平台自己的 TTL。
      const cachedAt = hit.headers.get(CACHE_AGE_HEADER);
      if (cachedAt !== null) {
        const age = Date.now() - Number(cachedAt);
        if (!Number.isFinite(age) || age >= CACHE_TTL_MS) return null;
        const headers = new Headers(hit.headers);
        headers.delete(CACHE_AGE_HEADER);
        return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
      }
      return hit;
    } catch (error) {
      console.error("feeds cache read failed", error);
      return null;
    }
  }

  if (memoryCache !== null && memoryCache.key === key && memoryCache.expiresAt > Date.now()) {
    return memoryCache.response.clone();
  }
  return null;
}

async function writeCache(key: string, response: Response): Promise<void> {
  const cache = platformCache();
  if (cache !== null) {
    response.headers.set(CACHE_AGE_HEADER, String(Date.now()));
    await cache.put(new Request(key), response);
    return;
  }
  memoryCache = { key, expiresAt: Date.now() + CACHE_TTL_MS, response };
}

function jsonResponse(data: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "cache-control": cacheControl,
      "content-type": "application/json; charset=UTF-8",
    },
  });
}

export async function handleFeedsRequest(
  request: Request,
  options: FeedsRequestOptions = {},
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method-not-allowed" }, 405, "no-store");
  }

  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const cacheKey = new URL(CACHE_KEY_PATH, url.origin).toString();

  if (!refresh) {
    const cached = await readCache(cacheKey);
    if (cached !== null) return cached;
  }

  try {
    const snapshot = await aggregateFeeds();
    const response = jsonResponse(
      snapshot,
      200,
      refresh
        ? "no-store"
        : `public, s-maxage=${FEED_CONFIG.cacheTtlSeconds}, stale-while-revalidate=${FEED_CONFIG.cacheTtlSeconds * 2}`,
    );

    if (!refresh) {
      const stored = writeCache(cacheKey, response.clone()).catch((error: unknown) => {
        console.error("feeds cache write failed", error);
      });
      if (options.waitUntil !== undefined) options.waitUntil(stored);
      else await stored;
    }
    return response;
  } catch (error) {
    console.error("feeds aggregation failed", error);
    return jsonResponse({ error: "feeds-unavailable" }, 502, "no-store");
  }
}
