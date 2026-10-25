/* 顶栏 RSS 聚合的数据源与抓取参数。
   实时数据由 /api/feeds 在请求时聚合「本站 + 全部友链」的 RSS：
   EdgeOne / Cloudflare / Vercel 共用 server/feeds.ts，本地 dev 走 Vite 中间件（40+ 个源会被浏览器 CORS 挡住）。
   src/assets/rss-feed.ts 的构建快照只在接口不可用时兜底，用 pnpm feeds:update 刷新。 */

export interface FeedItem {
  title: string;
  url: string;
  /** ISO 时间，列表里只展示日期部分 */
  date: string;
  /** 来源站点名，订阅列表右侧标注 */
  source: string;
}

/** 实时接口抓取失败的源，直接展示在 RSS 弹窗的失败区。 */
export interface FeedFailure {
  name: string;
  /** 站点主页；失败条目可点击跳转 */
  url?: string;
  /** 简短原因（请求超时 / 没有可解析的条目 / 获取失败） */
  reason: string;
}

export interface FeedSnapshot {
  generatedAt: string;
  /** 成功抓到条目的站点数 */
  sites: number;
  /** 参与抓取的源总数；旧快照可能没有 */
  total?: number;
  items: FeedItem[];
  /** 抓取失败的源；旧快照可能没有 */
  failures?: FeedFailure[];
}

export const FEED_CONFIG = {
  /** 本站博客的 RSS */
  selfUrl: "https://tblog.mmzhiku.xyz/rss.xml",
  /** 本站博客在订阅列表里的来源名 */
  selfName: "MmzMing的博客",
  /** 每个站点最多收录的条目数 */
  maxPerSite: 5,
  /** 快照脚本的单源抓取超时（毫秒） */
  timeoutMs: 40000,
  /** 快照脚本的并发源数 */
  concurrency: 8,
  /** 快照脚本单个源的尝试次数（大源或偶发网络失败时重试） */
  attempts: 2,
  /** 实时接口的单源超时（毫秒）：比快照脚本短，保证函数在平台时限内返回 */
  edgeTimeoutMs: 8000,
  /** 实时接口的并发源数：44 个源两批跑完，最坏等待约 16s */
  edgeConcurrency: 22,
  /** 实时接口单源尝试次数 */
  edgeAttempts: 1,
  /** 实时接口的边缘缓存秒数；refresh=1 可绕过 */
  cacheTtlSeconds: 300,
};
