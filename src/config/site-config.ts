/* 站点级 SEO 配置（唯一数据源）：dev 与 build 时由 vite.config.ts 的 siteSeoPlugin 注入 index.html，
   改 SEO 只改这里，不要手写 index.html 中的 SEO 标签。站点地址与 og 封面沿袭 3D-HOME 的 site.json。 */

export interface SiteConfig {
  /** 页面 <title> 与 og:title */
  title: string;
  /** og:site_name（站点品牌名） */
  siteName: string;
  /** meta description 与 og:description */
  description: string;
  /** meta keywords */
  keywords: string[];
  /** meta author */
  author: string;
  /** 站点正式地址（含协议、不带结尾斜杠），用于 og:url 与 JSON-LD */
  siteUrl: string;
  /** og:locale */
  locale: string;
  /** 分享卡片封面图绝对地址（og:image / twitter:image）；留空则降级为 summary 卡片 */
  ogImage: string;
  /** 封面图替代文本（og:image:alt） */
  ogImageAlt: string;
  /** 封面图像素宽度（og:image:width） */
  ogImageWidth: number;
  /** 封面图像素高度（og:image:height） */
  ogImageHeight: number;
  /** 浏览器移动端地址栏主题色 */
  themeColor: string;
  /** 站点起始日期（本地日期 YYYY-MM-DD）：玩家卡片大数字与档案面板的站点运行/周年进度都从这里计算 */
  startDate: string;
}

export const SITE_CONFIG: SiteConfig = {
  title: "MmzMing 的个人主页",
  siteName: "MmzMing 的个人主页",
  description: "MmzMing 的个人站点整合主页：博客、图床、访问统计与在线工具盒子的一站式入口。",
  keywords: ["mmzhiku", "MmzMing", "个人主页", "站点导航", "博客", "图床", "统计", "工具盒子"],
  author: "MmzMing",
  siteUrl: "https://www.mmzhiku.xyz",
  locale: "zh_CN",
  ogImage: "https://www.mmzhiku.xyz/assets/images/og-cover.png",
  ogImageAlt: "MmzMing 的个人主页分享封面",
  ogImageWidth: 1200,
  ogImageHeight: 675,
  themeColor: "#101214",
  startDate: "2026-10-24",
};
