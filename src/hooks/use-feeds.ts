import { useCallback, useEffect, useRef, useState } from "react";
import { RSS_SNAPSHOT } from "../assets/rss-feed";
import type { FeedFailure, FeedItem, FeedSnapshot } from "../config/feeds";

const ENDPOINT = "/api/feeds";
const CLIENT_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 25_000;

export type FeedStatus = "loading" | "ready" | "error";

export interface FeedView {
  data: FeedSnapshot;
  isLive: boolean;
  status: FeedStatus;
  refresh: () => void;
}

let cachedLive: { data: FeedSnapshot; at: number } | null = null;

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

export function useFeeds(active: boolean): FeedView {
  const [data, setData] = useState<FeedSnapshot>(() => cachedLive?.data ?? RSS_SNAPSHOT);
  const [isLive, setIsLive] = useState(() => cachedLive !== null);
  const [status, setStatus] = useState<FeedStatus>(() => (cachedLive === null ? "loading" : "ready"));
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (inflight.current !== null) {
      if (!force) return;
      inflight.current.abort();
    }

    if (!force && cachedLive !== null && Date.now() - cachedLive.at < CLIENT_TTL_MS) {
      setData(cachedLive.data);
      setIsLive(true);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    inflight.current = controller;
    setStatus("loading");
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(force ? `${ENDPOINT}?refresh=1` : ENDPOINT, {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`feeds api ${response.status}`);

      const live = parseSnapshot(await response.json());
      if (live === null) throw new Error("feeds api returned an invalid payload");
      if (controller.signal.aborted) return;

      cachedLive = { data: live, at: Date.now() };
      setData(live);
      setIsLive(true);
      setStatus("ready");
    } catch {
      if (controller.signal.aborted && inflight.current !== controller) return;
      setStatus("error");
    } finally {
      clearTimeout(timer);
      if (inflight.current === controller) inflight.current = null;
    }
  }, []);

  useEffect(() => {
    // 抓取是外部系统同步；首次加载需要立即进入 loading 状态。
    // oxlint-disable-next-line react/set-state-in-effect
    void load(false);
    return () => {
      inflight.current?.abort();
      inflight.current = null;
    };
  }, [load]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (active) void load(false);
  }, [active, load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { data, isLive, status, refresh };
}
