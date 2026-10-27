import { useCallback, useEffect, useRef, useState } from "react";
import { RSS_SNAPSHOT } from "../assets/rss-feed";
import { FEED_CONFIG, type FeedFailure, type FeedItem, type FeedSnapshot } from "../config/feeds";
import { FEED_SOURCES, feedBatch, feedBatchCount } from "../config/feed-sources";

/* 实时订阅按批拉取与增量刷新：
   - 首批加载并行请求 /api/feeds?batch=N，每批一到就合并进视图（渐进渲染），单批失败不拖累其他批；
   - 自动加载只重抓「过期（数据超过 cacheTtlSeconds）」或「没成功过」的批，其余直接复用；
   - 手动重试（重新获取 / 重试）额外重抓「带失败源」的批——失败源的常态化重试入口就在失败区；
   - 批次切分与失败源映射都来自共享的 feed-sources.ts。 */

const ENDPOINT = "/api/feeds";
/** 必须长于服务端单批的整体预算（FEED_CONFIG.edgeBudgetMs），否则客户端先 abort，永远看不到部分快照 */
const REQUEST_TIMEOUT_MS = 20_000;
/** 增量刷新阈值：批次数据生成时间超过服务端缓存 TTL 即视为过期（调 cacheTtlSeconds 即调这里） */
const STALE_AFTER_MS = FEED_CONFIG.cacheTtlSeconds * 1000;

export type FeedStatus = "loading" | "ready" | "error";

export interface FeedView {
  data: FeedSnapshot;
  isLive: boolean;
  status: FeedStatus;
  refresh: () => void;
}

/** 各批次最近一次成功的快照（undefined = 还没成功过）；增量刷新据此跳过仍新鲜的批。失败不回写，旧快照继续用。 */
let batchStore: (FeedSnapshot | undefined)[] = [];

function storeOutcomes(): (FeedSnapshot | null)[] {
  return Array.from({ length: feedBatchCount() }, (_unused, index) => batchStore[index] ?? null);
}

function batchNeedsFetch(snapshot: FeedSnapshot | undefined): boolean {
  if (snapshot === undefined) return true;
  const age = Date.now() - Date.parse(snapshot.generatedAt);
  return !Number.isFinite(age) || age >= STALE_AFTER_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFeedItem(value: unknown): value is FeedItem {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.url === "string" &&
    typeof value.date === "string" &&
    typeof value.source === "string"
  );
}

function isFeedFailure(value: unknown): value is FeedFailure {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.reason === "string" &&
    (value.url === undefined || typeof value.url === "string")
  );
}

function parseSnapshot(value: unknown): FeedSnapshot | null {
  if (!isRecord(value) || typeof value.generatedAt !== "string" || !Array.isArray(value.items)) return null;

  const items = value.items.filter(isFeedItem);
  const failures = (Array.isArray(value.failures) ? value.failures : []).filter(isFeedFailure);
  return {
    generatedAt: value.generatedAt,
    sites:
      typeof value.sites === "number"
        ? value.sites
        : new Set(items.map((item) => item.source)).size,
    total: typeof value.total === "number" ? value.total : undefined,
    items,
    failures,
  };
}

/** 把各批次的结果并成一份视图快照；索引处的 null = 这批没有可用数据（HTTP 错误 / 超时 / 从未成功）。 */
function mergeBatches(outcomes: readonly (FeedSnapshot | null)[]): FeedSnapshot | null {
  const ok = outcomes.filter((snapshot): snapshot is FeedSnapshot => snapshot !== null);
  if (ok.length === 0) return null;

  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const snapshot of ok) {
    for (const item of snapshot.items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  items.sort((left, right) => right.date.localeCompare(left.date));

  const failures: FeedFailure[] = ok.flatMap((snapshot) => snapshot.failures ?? []);
  // 整批没有数据时拿不到逐源原因，用「获取失败」补齐，保证 sites + failures = total 的口径不破
  outcomes.forEach((snapshot, index) => {
    if (snapshot === null) {
      failures.push(
        ...feedBatch(index).map((source) => ({ name: source.name, url: source.siteUrl, reason: "获取失败" })),
      );
    }
  });

  const generatedAt = ok.reduce(
    (latest, snapshot) => (snapshot.generatedAt > latest ? snapshot.generatedAt : latest),
    ok[0].generatedAt,
  );
  const sites = ok.reduce((count, snapshot) => count + snapshot.sites, 0);
  return { generatedAt, sites, total: FEED_SOURCES.length, items, failures };
}

/** active: 弹窗需要实时数据时强制刷新；enabled: 菜单入场结束后才开始首批加载，避免批量状态更新撞上圆盘入场。 */
export function useFeeds(active: boolean, enabled = true): FeedView {
  const [data, setData] = useState<FeedSnapshot>(() => mergeBatches(storeOutcomes()) ?? RSS_SNAPSHOT);
  const [isLive, setIsLive] = useState(() => storeOutcomes().some((outcome) => outcome !== null));
  const [status, setStatus] = useState<FeedStatus>(() =>
    storeOutcomes().some((outcome) => outcome !== null) ? "ready" : "loading",
  );
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (inflight.current !== null) {
      if (!force) return;
      inflight.current.abort();
    }

    const toFetch = Array.from({ length: feedBatchCount() }, (_unused, index) => index).filter((index) => {
      const snapshot = batchStore[index];
      if (batchNeedsFetch(snapshot)) return true;
      // 手动重试：新鲜但带失败源的批一并重抓；自动加载不碰（免得每次打开都为慢性失败源重跑全批）
      return force && snapshot !== undefined && (snapshot.failures?.length ?? 0) > 0;
    });

    // 增量刷新的常态路径：全部批次都还新鲜，不发任何请求
    if (toFetch.length === 0) {
      const merged = mergeBatches(storeOutcomes());
      if (merged !== null) {
        setData(merged);
        setIsLive(true);
        setStatus("ready");
      }
      return;
    }

    const sweep = new AbortController();
    inflight.current = sweep;
    setStatus("loading");
    const timer = setTimeout(() => sweep.abort(), REQUEST_TIMEOUT_MS);

    // 未被重抓的批直接沿用旧快照，重抓失败的批也退回旧快照（有旧数据就继续用）
    const outcomes = storeOutcomes();
    const pending = new Set(toFetch);

    const applyProgress = () => {
      if (inflight.current !== sweep) return;   // 被新的一轮替换或组件卸载后不再写状态
      const merged = mergeBatches(outcomes);
      if (merged !== null) {
        setData(merged);
        setIsLive(true);
        if (pending.size === 0) setStatus("ready");
      } else if (pending.size === 0) {
        setStatus("error");   // 没有任何可用数据：保留现有内容（构建快照或上一轮实时数据）
      }
    };

    const loadBatch = async (index: number) => {
      try {
        // 不写 cache: "no-store"：那会让沿途所有共享缓存都不落盘，等于把响应里的 s-maxage 作废，
        // 每个访客都重跑一次全量抓取。用默认策略，让边缘节点按 cacheTtlSeconds 直接回。
        const response = await fetch(`${ENDPOINT}?batch=${index}${force ? "&refresh=1" : ""}`, {
          headers: { accept: "application/json" },
          signal: sweep.signal,
        });
        if (!response.ok) throw new Error(`feeds api ${response.status}`);
        const snapshot = parseSnapshot(await response.json());
        if (snapshot === null) throw new Error("feeds api returned an invalid payload");
        if (sweep.signal.aborted || inflight.current !== sweep) return;
        outcomes[index] = snapshot;
        batchStore[index] = snapshot;
      } catch {
        // 重抓失败：outcomes 里保留该批旧快照（没有旧值时就是 null）
      } finally {
        pending.delete(index);
        applyProgress();
      }
    };

    await Promise.all(toFetch.map((index) => loadBatch(index)));
    clearTimeout(timer);
    if (inflight.current === sweep) inflight.current = null;
  }, []);

  useEffect(() => {
    // 抓取是外部系统同步；首批加载等菜单入场结束，入场动画期间不更新 React 状态。
    // oxlint-disable-next-line react/set-state-in-effect
    if (enabled) void load(false);
    return () => {
      inflight.current?.abort();
      inflight.current = null;
    };
  }, [enabled, load]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (active) void load(false);
  }, [active, load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { data, isLive, status, refresh };
}