import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sitemap from "vite-plugin-sitemap";
import type { HtmlTagDescriptor, Plugin } from "vite";
import { SITE_CONFIG } from "./src/config/site-config.ts";
import { SITE_LINKS } from "./src/config/link-config.ts";

// base './' 让纯静态产物可以部署在任意子路径下

const CANONICAL_URL = `${SITE_CONFIG.siteUrl}/`;

// SEO 标签唯一数据源是 src/config/site-config.ts：dev 与 build 时注入 index.html，
// index.html 本体不再手写 title/description，避免两处维护。
function siteSeoPlugin(): Plugin {
  const tags: HtmlTagDescriptor[] = [
    { tag: "title", injectTo: "head", children: SITE_CONFIG.title },
    { tag: "meta", injectTo: "head", attrs: { name: "description", content: SITE_CONFIG.description } },
    { tag: "meta", injectTo: "head", attrs: { name: "keywords", content: SITE_CONFIG.keywords.join(", ") } },
    { tag: "meta", injectTo: "head", attrs: { name: "author", content: SITE_CONFIG.author } },
    { tag: "meta", injectTo: "head", attrs: { name: "theme-color", content: SITE_CONFIG.themeColor } },
    { tag: "meta", injectTo: "head", attrs: { name: "application-name", content: SITE_CONFIG.siteName } },
    { tag: "meta", injectTo: "head", attrs: { name: "apple-mobile-web-app-title", content: SITE_CONFIG.siteName } },
    { tag: "meta", injectTo: "head", attrs: { name: "msapplication-TileColor", content: SITE_CONFIG.themeColor } },
    { tag: "link", injectTo: "head", attrs: { rel: "canonical", href: CANONICAL_URL } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:type", content: "website" } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:title", content: SITE_CONFIG.title } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:site_name", content: SITE_CONFIG.siteName } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:description", content: SITE_CONFIG.description } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:url", content: CANONICAL_URL } },
    { tag: "meta", injectTo: "head", attrs: { property: "og:locale", content: SITE_CONFIG.locale } },
    {
      tag: "script",
      injectTo: "head",
      attrs: { type: "application/ld+json" },
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: SITE_CONFIG.siteName,
            url: CANONICAL_URL,
            description: SITE_CONFIG.description,
            inLanguage: SITE_CONFIG.locale.replace("_", "-"),
            publisher: { "@id": `${SITE_CONFIG.siteUrl}/#person` },
          },
          {
            "@type": "Person",
            "@id": `${SITE_CONFIG.siteUrl}/#person`,
            name: SITE_CONFIG.author,
            url: CANONICAL_URL,
            sameAs: SITE_LINKS.map((link) => link.url),
          },
        ],
      }),
    },
  ];
  if (SITE_CONFIG.ogImage) {
    tags.push(
      { tag: "meta", injectTo: "head", attrs: { property: "og:image", content: SITE_CONFIG.ogImage } },
      { tag: "meta", injectTo: "head", attrs: { property: "og:image:alt", content: SITE_CONFIG.ogImageAlt } },
      { tag: "meta", injectTo: "head", attrs: { property: "og:image:width", content: String(SITE_CONFIG.ogImageWidth) } },
      { tag: "meta", injectTo: "head", attrs: { property: "og:image:height", content: String(SITE_CONFIG.ogImageHeight) } },
      { tag: "meta", injectTo: "head", attrs: { name: "twitter:card", content: "summary_large_image" } },
      { tag: "meta", injectTo: "head", attrs: { name: "twitter:image", content: SITE_CONFIG.ogImage } },
    );
  } else {
    tags.push({ tag: "meta", injectTo: "head", attrs: { name: "twitter:card", content: "summary" } });
  }
  return {
    name: "site-seo",
    transformIndexHtml(html: string) {
      return { html, tags };
    },
    // llms.txt（LLM 爬虫指引，llmstxt.org 规范）同样由 SITE_CONFIG + SITE_LINKS 生成，
    // 与首页的链接卡片永远同步；不引入 vite-plugin-llms——它面向 .md 文档语料聚合，本站没有公开文档。
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: [
          `# ${SITE_CONFIG.siteName}`,
          "",
          `> ${SITE_CONFIG.description}`,
          "",
          "## 站点导航",
          "",
          ...SITE_LINKS.map((link) => `- [${link.title}](${link.url}): ${link.description}`),
          "",
        ].join("\n"),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    siteSeoPlugin(),
    // sitemap.xml + robots.txt 交给维护中的插件生成，路由发现/转义等细节不用自己兜底
    sitemap({ hostname: SITE_CONFIG.siteUrl, changefreq: "monthly", generateRobotsTxt: true }),
    react(),
  ],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
