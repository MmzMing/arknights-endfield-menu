import type { NewsSlide } from "../components/news-panel";

/** 右上角公告轮播内容：image 可省略，省略时面板使用 /assets/default.webp；
    title / detail / link 为点击公告后弹窗中展示的详情。 */
export const ANNOUNCEMENTS: NewsSlide[] = [
  {
    caption: "GitHub // MmzMing/arknights-endfield-menu",
    image: "/assets/images/og-cover.png",
    c1: "#3f3a55",
    c2: "#17151f",
    title: "项目开源",
    detail: "本站为《明日方舟：终末地》主菜单的复刻与再实现。原项目：https://github.com/ccdr4gon/endfield_menu。项目已开源，欢迎 Star、提交 Issue 或一起完善细节。",
    link: {
      label: "开源地址",
      value: "github.com/MmzMing/arknights-endfield-menu",
      href: "https://github.com/MmzMing/arknights-endfield-menu",
    },
  },
  {
    caption: "新文章 // 在像素与代码之间",
    image: "/assets/images/links/blog.webp",
    c1: "#7e3d49",
    c2: "#23191f",
    title: "新文章",
    detail: "记录把终末地主菜单搬进浏览器的过程：从逐像素测量坐标、还原毫秒级时序，到把内容拆成可编辑配置。",
  },
  {
    caption: "3D 线描房子 // 场景更新",
    image: "/assets/images/links/home.webp",
    c1: "#3d4f63",
    c2: "#161c24",
    title: "3D 线描房子",
    detail: "线描场景更新了等高线地形与旋转金弧，点击左侧「3D线描房子」卡片即可进入查看。",
  },
  {
    caption: "工具盒子 // 新工具上线",
    image: "/assets/images/links/tool.webp",
    c1: "#4f5a3d",
    c2: "#1a2016",
    title: "工具盒子",
    detail: "新增一组在线小工具，常用的格式化、编码与图片处理都收进了一个盒子。",
  },
  {
    caption: "站点维护预告 · 02:00",
    c1: "#5a4a2f",
    c2: "#221c12",
    title: "维护预告",
    detail: "站点将于 02:00 进行短暂维护，期间部分页面可能无法访问，完成后会自动恢复。",
  },
];
