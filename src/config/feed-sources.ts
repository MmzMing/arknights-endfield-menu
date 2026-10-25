/* 实时订阅的源列表与批次切分：服务端（server/feeds.ts）与客户端（分批拉取）共用同一份，
   保证两端算出的批次数量与切片完全一致。
   批次 = 源数组按 batchSize 定长切分；切片顺序必须确定（本站在前、友链保持原顺序）——
   客户端要靠序号拼 `/api/feeds?batch=N`，顺序一变缓存键就错位。 */
import { FEED_CONFIG } from "./feeds.ts";
import { FRIEND_LINKS } from "./friend-links.ts";
import { SITE_CONFIG } from "./site-config.ts";

export interface FeedSource {
  name: string;
  feedUrl: string;
  siteUrl: string;
}

export const FEED_SOURCES: FeedSource[] = [
  { name: FEED_CONFIG.selfName, feedUrl: FEED_CONFIG.selfUrl, siteUrl: SITE_CONFIG.siteUrl },
  ...FRIEND_LINKS.flatMap((friend) =>
    friend.rss ? [{ name: friend.name, feedUrl: friend.rss, siteUrl: friend.url }] : [],
  ),
].filter((source, index, all) => all.findIndex((candidate) => candidate.feedUrl === source.feedUrl) === index);

export function feedBatchCount(): number {
  return Math.max(1, Math.ceil(FEED_SOURCES.length / FEED_CONFIG.batchSize));
}

export function feedBatch(index: number): FeedSource[] {
  const size = FEED_CONFIG.batchSize;
  return FEED_SOURCES.slice(index * size, (index + 1) * size);
}