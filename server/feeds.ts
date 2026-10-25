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
// 预算耗尽时根本没开抓的源，原因要和"抓到了但没解析出来"分开，否则失败列表读起来像源坏了。
const SKIPPED_REASON = "未抓取（整体超时）";

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
  /** 整体预算（毫秒），缺省=不限：快照脚本要全量，实时接口必须给，否则会被平台的函数时限掐掉 */
  budgetMs?: number;
  /** 单源最多下载的字节数，缺省=整份下载 */
  maxBytes?: number;
  onSource?: (result: { name: string; count: number; reason?: string }) => void;
}

const REALTIME_OPTIONS: FeedAggregateOptions = {
  attempts: FEED_CONFIG.edgeAttempts,
  concurrency: FEED_CONFIG.edgeConcurrency,
  maxPerSite: FEED_CONFIG.maxPerSite,
  timeoutMs: FEED_CONFIG.edgeTimeoutMs,
  budgetMs: FEED_CONFIG.edgeBudgetMs,
  maxBytes: FEED_CONFIG.edgeMaxBytes,
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

/** 截断的文档得自己闭合：XML 解析器碰到没闭合的根标签会直接报错，整源就白抓了。
    在最后一个完整条目之后收尾，条目中间的内容被砍掉不影响，解析器只在乎结构。 */
function closeTruncated(text: string): string {
  const rss = text.indexOf("<rss") !== -1;
  const closing = rss ? "</item>" : "</entry>";
  const last = text.lastIndexOf(closing);
  if (last === -1) return text;

  const head = text.slice(0, last + closing.length);
  return rss ? `${head}</channel></rss>` : `${head}</feed>`;
}

/** 按字节上限读流。友链里有 1 MB 级的全内容源，而 maxPerSite 只用头部几条，
    提前断流把 44 个源合计的十几 MB 压到边缘 isolate 解析得完的量。 */
async function fetchCapped(url: string | URL, init: RequestInit, maxBytes?: number): Promise<Response> {
  const response = await fetch(url, init);
  if (maxBytes === undefined || response.body === null) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  let complete = false;
  try {
    while (received < maxBytes) {
      const chunk = await reader.read();
      if (chunk.done === true) {
        complete = true;
        break;
      }
      received += chunk.value.byteLength;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    // 提前收工必须把连接取消，否则 isolate 会一直等那条流的剩余部分
    if (complete) reader.releaseLock();
    else await reader.cancel().catch(() => undefined);
  }

  const body = complete ? `${text}${decoder.decode()}` : closeTruncated(text);
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType !== null) headers.set("content-type", contentType);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchSource(
  source: FeedSource,
  options: FeedAggregateOptions,
  budget?: AbortSignal,
): Promise<SourceResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    const onBudget = () => controller.abort();
    budget?.addEventListener("abort", onBudget, { once: true });
    try {
      const feed = await extract(
        source.feedUrl,
        { descriptionMaxLen: 0, useISODateFormat: true },
        (url) =>
          fetchCapped(
            url,
            { headers: { accept: ACCEPT, "user-agent": USER_AGENT }, redirect: "follow", signal: controller.signal },
            options.maxBytes,
          ),
      );
      const items = toFeedItems(feed.entries, source.name, options.maxPerSite);
      if (items.length > 0) return { items };
      lastError = new Error("feed has no usable entries");
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
      budget?.removeEventListener("abort", onBudget);
    }
    if (budget !== undefined && budget.aborted) break;   // 预算已尽，重试只是拖死返回
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
  const budget = new AbortController();
  const budgetTimer = options.budgetMs === undefined ? null : setTimeout(() => budget.abort(), options.budgetMs);

  async function worker() {
    while (cursor < SOURCES.length) {
      if (budget.signal.aborted) return;
      const index = cursor;
      cursor += 1;
      const source = SOURCES[index];
      if (source === undefined) continue;
      const result = await fetchSource(source, options, budget.signal);
      results[index] = result;
      options.onSource?.({ name: source.name, count: result.items.length, reason: result.failure?.reason });
    }
  }

  const workers = Math.max(1, Math.min(options.concurrency, SOURCES.length));
  try {
    await Promise.all(Array.from({ length: workers }, () => worker()));
  } finally {
    if (budgetTimer !== null) clearTimeout(budgetTimer);
  }

  // 没开抓的源没有 result，不显式记成失败就会被算进"成功站点"，快照读起来就一切正常了
  const skipped = SOURCES.filter((_source, index) => results[index] === undefined);
  const items = results
    .flatMap((result) => result?.items ?? [])
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
  const failures: FeedFailure[] = [
    ...results.flatMap((result) => (result?.failure ? [result.failure] : [])),
    ...skipped.map((source) => ({ name: source.name, url: source.siteUrl, reason: SKIPPED_REASON })),
  ];

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

interface CacheHit {
  response: Response;
  stale: boolean;
}

const CACHE_AGE_HEADER = "x-feeds-cached-at";
const CACHE_TTL_MS = FEED_CONFIG.cacheTtlSeconds * 1000;
const SHARED_CACHE_CONTROL = `public, s-maxage=${FEED_CONFIG.cacheTtlSeconds}, stale-while-revalidate=${
  FEED_CONFIG.cacheTtlSeconds * 2
}`;

let memoryCache: { key: string; storedAt: number; response: Response } | null = null;
let revalidating: Promise<void> | null = null;

function platformCache(): CacheStorageLike | null {
  const globalCaches = (globalThis as { caches?: { default?: CacheStorageLike } }).caches;
  return globalCaches?.default ?? null;
}

async function readCache(key: string): Promise<CacheHit | null> {
  const cache = platformCache();
  if (cache !== null) {
    try {
      const hit = await cache.match(new Request(key));
      if (hit === undefined) return null;

      // Cache API 不一定按 Cache-Control 过期，用写入时间判断新旧；没有该头则信任平台自己的 TTL。
      const cachedAt = hit.headers.get(CACHE_AGE_HEADER);
      const age = cachedAt === null ? null : Date.now() - Number(cachedAt);
      const stale = age === null ? false : !Number.isFinite(age) || age >= CACHE_TTL_MS;
      const headers = new Headers(hit.headers);
      headers.delete(CACHE_AGE_HEADER);
      return { response: new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers }), stale };
    } catch (error) {
      console.error("feeds cache read failed", error);
      return null;
    }
  }

  if (memoryCache !== null && memoryCache.key === key) {
    return {
      response: memoryCache.response.clone(),
      stale: Date.now() - memoryCache.storedAt >= CACHE_TTL_MS,
    };
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
  memoryCache = { key, storedAt: Date.now(), response };
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

async function writeSnapshot(key: string): Promise<void> {
  await writeCache(key, jsonResponse(await aggregateFeeds(), 200, SHARED_CACHE_CONTROL));
}

/** 后台补缓存：同一 isolate 内只放一个在跑，免得并发请求一起抓 44 个源；失败只记日志。 */
function revalidateInBackground(key: string, options: FeedsRequestOptions): void {
  if (revalidating !== null) return;
  revalidating = writeSnapshot(key)
    .catch((error: unknown) => {
      console.error("feeds revalidate failed", error);
    })
    .finally(() => {
      revalidating = null;
    });
  if (options.waitUntil !== undefined) options.waitUntil(revalidating);
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
  const hit = await readCache(cacheKey);

  // 过期也先把旧快照给出去：全量抓取最坏要十几秒，让访客干等不如先看几分钟前的列表。
  if (hit !== null && !refresh) {
    if (!hit.stale) return hit.response;
    revalidateInBackground(cacheKey, options);
    return hit.response;
  }

  try {
    const response = jsonResponse(await aggregateFeeds(), 200, refresh ? "no-store" : SHARED_CACHE_CONTROL);

    // 手动刷新同样写缓存：不写的话缓存永远是冷的，每个访客都得重跑一次全量抓取。
    const stored = writeCache(cacheKey, response.clone()).catch((error: unknown) => {
      console.error("feeds cache write failed", error);
    });
    if (options.waitUntil !== undefined) options.waitUntil(stored);
    else await stored;
    return response;
  } catch (error) {
    console.error("feeds aggregation failed", error);
    if (hit !== null) return hit.response;   // 刷新失败退回旧数据，别把手头有的内容弄没
    return jsonResponse({ error: "feeds-unavailable" }, 502, "no-store");
  }
}
