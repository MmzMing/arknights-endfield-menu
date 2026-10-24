/* 站点导航链接配置：本站是整合主页，兄弟站点的跳转入口集中在这里管理。
   image 为部署根路径，对应 public/assets/images/ 下的封面图文件；icon 指向 si-* 图标包
   （src/components/icon-defs.tsx 按 SiteIconName 渲染同名 symbol）。 */

export type SiteIconName = "blog" | "memo" | "status" | "tool";

export interface SiteLink {
  /** 稳定 id，供代码引用（路由/高亮/埋点） */
  id: string;
  title: string;
  /** 封面图路径（public/ 下，站点根路径） */
  image: string;
  /** 跳转地址 */
  url: string;
  description: string;
  tags: string[];
  /** 行动按钮文案 */
  ctaLabel: string;
  /** 图标包里的图标名（渲染为 #si-<icon>） */
  icon: SiteIconName;
}

export const SITE_LINKS: SiteLink[] = [
  {
    id: "blog",
    title: "博客",
    image: "/assets/images/links/blog.webp",
    url: "https://tblog.mmzhiku.xyz",
    description: "个人博客与文章归档。",
    tags: ["博客", "文章"],
    ctaLabel: "访问博客",
    icon: "blog",
  },
  {
    id: "memos",
    title: "memos",
    image: "/assets/images/links/img.webp",
    url: "https://memos.mmzhiku.xyz/",
    description: "基于 Memos 的碎语与灵感记录。",
    tags: ["备忘", "碎语"],
    ctaLabel: "打开 memos",
    icon: "memo",
  },
  {
    id: "analytics",
    title: "统计",
    image: "/assets/images/links/stats.webp",
    url: "https://stats.mmzhiku.xyz/share/uAfsjwbIKgVPjxtc",
    description: "查看网站访问统计数据。",
    tags: ["统计", "数据"],
    ctaLabel: "查看统计",
    icon: "status",
  },
  {
    id: "toolbox",
    title: "工具盒子",
    image: "/assets/images/links/tool.webp",
    url: "https://tool.mmzhiku.xyz",
    description: "收集了一些常用的工具。",
    tags: ["工具", "盒子"],
    ctaLabel: "打开工具盒子",
    icon: "tool",
  },
];
