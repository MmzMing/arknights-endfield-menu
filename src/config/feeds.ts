/* 顶栏 RSS 聚合的数据源与抓取参数。
   快照（src/assets/rss-feed.ts）由 scripts/fetch-feeds.mjs 用 @extractus/feed-extractor 抓取「本站 + 全部友链」
   的 RSS 生成；40+ 个源在浏览器里都会被 CORS 挡住，所以聚合放在构建/更新脚本里完成（pnpm feeds:update）。 */

export interface FeedItem {
  title: string;
  url: string;
  /** ISO 时间，列表里只展示日期部分 */
  date: string;
  /** 来源站点名，订阅列表右侧标注 */
  source: string;
}

export interface FeedSnapshot {
  generatedAt: string;
  /** 成功抓到条目的站点数 */
  sites: number;
  items: FeedItem[];
}

export const FEED_CONFIG = {
  /** 本站博客的 RSS */
  selfUrl: "https://tblog.mmzhiku.xyz/rss.xml",
  /** 本站博客在订阅列表里的来源名 */
  selfName: "MmzMing的博客",
  /** 每个站点最多收录的条目数 */
  maxPerSite: 5,
  /** 单源抓取超时（毫秒） */
  timeoutMs: 40000,
  /** 并发抓取的源数 */
  concurrency: 8,
  /** 单个源的尝试次数（大源或偶发网络失败时重试） */
  attempts: 2,
};
