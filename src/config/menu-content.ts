import type { EnergyContent } from "../components/energy-pill";
import type { PlayerContent } from "../components/player-badge";
import type { CardSpec } from "../components/left-cards";
import type { TileSpec } from "../components/right-tiles";
import type { NewsSlide } from "../components/news-panel";
import { ANNOUNCEMENTS } from "./announcement-config";
import type { LabelLayout } from "../lib/label-svg";
import { yearDay } from "../lib/calendar-days";
import type { ProfilePanelContent } from "./profile-panel-config";
import { PLAYER_CONFIG } from "./player-config";
import { PROFILE_PANEL_CONFIG, TECH_STACK_COUNT, TECH_STACK_GROUPS } from "./profile-panel-config";
import { SITE_CONFIG } from "./site-config";
import { SITE_LINKS } from "./link-config";
import { FRIEND_LINKS } from "./friend-links";
import type { FeedSnapshot } from "./feeds";

/* All editable content of the menu in one typed module. Coordinates and timings are NOT content — they are
   measured assets and live inside the components. The per-glyph `text` layouts are measured against the exact
   label strings: changing a label here requires re-measuring its layout. */

export interface DialogMetaRow {
  label: string;
  value: string;
  /** 设置后该行末尾渲染跳转图标按钮（新标签页打开） */
  href?: string;
}

export interface DialogLink {
  title: string;
  url: string;
  /** 右侧附注（RSS 条目为日期，友链为描述） */
  note?: string;
  /** 左侧来源标签（RSS 条目显示为【站点名】） */
  source?: string;
}

export interface DialogGroupItem {
  name: string;
  /** 等级（技术栈的 low/medium/high/xhigh/max/ultra），决定卡片配色并显示在名字右侧 */
  level?: string;
  /** 品牌图标键（技术栈用，见 components/tech-stack-icon.tsx） */
  icon?: string;
}

export interface DialogGroup {
  label: string;
  items: DialogGroupItem[];
}

/** 实时数据状态提示（RSS 弹窗）：抓取中或接口不可用。 */
export interface DialogNotice {
  tone: "loading" | "error";
  text: string;
}

/** 抓取失败的数据源（RSS 弹窗的独立失败区）。 */
export interface DialogFailure {
  name: string;
  reason: string;
  url?: string;
}

export interface DialogContent {
  title: string;
  subtitle: string;
  description: string;
  meta: DialogMetaRow[];
  /** 站点入口弹窗扩展：封面图（描述后的媒体块） */
  image?: string;
  /** 可滚动外链列表（RSS 条目 / 友链），点击新标签页打开 */
  links?: DialogLink[];
  /** 分组卡片（技术栈）：每组一行 label + 多列 items 卡片 */
  groups?: DialogGroup[];
  /** 实时数据状态提示（RSS 弹窗）：抓取中 / 接口不可用 */
  notice?: DialogNotice;
  /** 抓取失败的数据源列表（RSS 弹窗） */
  failures?: DialogFailure[];
  /** 失败区与错误提示的重试动作 */
  onRetry?: () => void;
  /** 重试请求进行中：按钮暂不渲染 */
  isRetrying?: boolean;
}

/** 关闭态落地时钟的文案；时间本身读取本地时间，不在这里配置。 */
export interface CountdownContent {
  /** 顶部红条标题 */
  title: string;
  /** 左下公司标牌 */
  brand: string;
  /** 标牌下方来源行 */
  source: string;
}

export interface MenuContent {
  countdown: CountdownContent;
  player: PlayerContent;
  /** 点击左下角玩家卡片打开的档案弹窗内容（技术栈 / 音乐占位 / 面板文案） */
  profilePanel: ProfilePanelContent;
  /** 站点起始日期，档案面板据此计算运行天数与周年进度（源头在 site-config.ts） */
  siteStartDate: string;
  energy: EnergyContent;
  news: { slides: NewsSlide[] };
  leftCards: CardSpec[];
  rightTiles: TileSpec[];
  net: { uid: string };
  dialogs: Record<string, DialogContent>;
}

const dialog = (title: string, subtitle: string, description: string, meta: DialogMetaRow[]): DialogContent => ({
  title, subtitle, description, meta,
});

/** 左侧四卡的逐字文案布局，顺序与 SITE_LINKS 一一对应（博客 / memos / 3D线描房子 / 工具盒子）。
    labelDx / iconDx / iconDy 为用户指定的光学微调（负值左移/上移），补偿图标墨迹重心与文字矩阵渲染偏移。 */
const CARD_TEXT: LabelLayout[] = [
  // 博客 ← 原「干员」的实测布局（同为 2 字）
  { size: 22.62, matrix: [1.0392, -0.0417, -0.0168, 1.0015], x: [203.11, 226.39], y: [145.07, 145.3] },
  // memos ← canvas 实测合成的拉丁布局（原「活动」卡的字号/矩阵/中心/斜率，见上方 leftCards 注释）
  { size: 24.07, matrix: [0.9983, -0.0576, -0.0123, 1.0024], x: [198.07, 220.89, 234.58, 257.4, 272.25], y: [148.37, 148.91, 149.24, 149.78, 150.13] },
  // 3D线描房子 ← 沿用原「寻访」卡的字号/矩阵/墨迹中心(224.93, 146.58)与斜率；逐字 advance 由 canvas 实测
  //   （Noto Sans SC 550 @ 24.2px：3 13.91、D 17.01、线/描/房/子 24.2，合计 127.73），整串居中于原中心
  { size: 24.2, matrix: [1.0678, -0.0186, 0.0015, 1.0001], x: [161.07, 174.98, 191.99, 216.19, 240.39, 264.59], y: [149.21, 148.64, 147.94, 146.94, 145.94, 144.95] },
  // 工具盒子 ← 原「采购中心」的实测布局（同为 4 字）
  { size: 24.52, matrix: [0.9796, -0.0274, -0.0261, 1.0011], x: [193.01, 218.59, 243.56, 268.83], y: [132.78, 132.55, 133.08, 132.58] },
];

/** 与 CARD_TEXT 对齐的每卡光学微调（px）：labelDx 平移文字，iconDx / iconDy 在矩阵对齐基础上补偿图标墨迹
    重心与用户目测偏好（博客图标持续偏左 → 累计 +18；工具盒子标签按用户指向 +6；3D线描房子图标按用户指向左下）。 */
const CARD_NUDGE: Pick<CardSpec, "labelDx" | "iconDx" | "iconDy">[] = [
  { labelDx: -6, iconDx: 21 },
  {},
  { iconDx: -6, iconDy: 7 },
  { labelDx: 15, iconDx: -15 },
];

/** 顶部胶囊 + 号打开的年度总结：数值按当天算（与胶囊读数同一函数 yearDay），内容即本站唯一的年总结文案。 */
const TODAY = new Date();
const YEAR_DAY = yearDay(TODAY);
const YEAR_SUMMARY: DialogContent = dialog("YEAR SUMMARY", "年总结", "本年已过去的天数、剩余天数与全年天数一览。", [
  { label: "年份", value: String(TODAY.getFullYear()) },
  { label: "已过", value: `${YEAR_DAY.elapsed} 天` },
  { label: "剩余", value: `${YEAR_DAY.total - YEAR_DAY.elapsed} 天` },
  { label: "全年", value: `${YEAR_DAY.total} 天` },
  { label: "进度", value: `${((YEAR_DAY.elapsed / YEAR_DAY.total) * 100).toFixed(1)}%` },
]);

export const MENU_CONTENT: MenuContent = {
  countdown: {
    title: "COUNTDOWN",
    brand: "ENDFIELD INDUSTRIES",
    source: "FROM TALOS-II",
  },
  player: PLAYER_CONFIG,
  profilePanel: PROFILE_PANEL_CONFIG,
  siteStartDate: SITE_CONFIG.startDate,
  energy: { current: "7200", max: "9800", percent: "100" },
  news: { slides: ANNOUNCEMENTS },
  /* 左侧四张卡 = 四个兄弟站点入口：标题/地址/图标来自 SITE_LINKS，点击走弹窗展示介绍/地址/封面图。
     text 是逐字符 origin 的实测资产：「博客/工具盒子」逐字复用原同字数文案（干员/采购中心）的实测布局；
     「memos」「3D线描房子」为 canvas 实测合成的布局——各自沿用原卡（活动/寻访）的字号、矩阵、墨迹中心与
     斜率，逐字 advance 由 canvas 实测（memos：Noto Sans SC 550 @ 24.07px，m 22.82、e 13.70、o 14.85、
     s 11.63；3D线描房子：@ 24.2px，3 13.91、D 17.01、线/描/房/子 24.2），整串居中于原卡的实测中心。 */
  leftCards: SITE_LINKS.map((link, i): CardSpec => ({
    action: link.id,
    label: link.title,
    art: `si-${link.icon}`,
    text: CARD_TEXT[i],
    ...CARD_NUDGE[i],
  })),
  rightTiles: [
    { id: "handbook", label: "行动手册", art: "art-tile-handbook",
      text: { size: 22.1, matrix: [1.003, -0.0018, -0.0043, 1], x: [9.07, 31.66, 54.16, 76.9], y: [91.43, 91.41, 91.7, 91] } },
    { id: "pass", label: "通行证", art: "art-tile-pass",
      text: { size: 21.39, matrix: [1.05, 0.0055, -0.0152, 0.9999], x: [20.26, 41.56, 62.87], y: [90.33, 90.65, 90.1] } },
    { id: "region", label: "地区建设", art: "art-tile-region", dot: true,
      text: { size: 21.74, matrix: [1.0199, -0.016, 0.0057, 1], x: [7.79, 30.72, 52.49, 74.55], y: [91.43, 91.55, 92.07, 92.15] } },
    { id: "friends", label: "好友", art: "art-tile-friends",
      text: { size: 22.14, matrix: [1.0298, 0.018, -0.0105, 1], x: [31.45, 53.15], y: [90.31, 89.27] } },
    { id: "crafting", label: "装备加工", art: "art-tile-crafting",
      text: { size: 22.41, matrix: [0.9999, 0.0122, -0.0052, 1], x: [9.8, 31.56, 54.46, 76.52], y: [86.85, 86.99, 86.96, 86.63] } },
    { id: "squad", label: "编队", art: "art-tile-squad",
      text: { size: 21.64, matrix: [1.02, 0, -0.003, 1], x: [30.63, 52.91], y: [90.69, 90.88] } },
    { id: "wiki", label: "百科", art: "art-tile-wiki",
      text: { size: 21.61, matrix: [1.03, 0.0036, -0.0005, 1], x: [30.2, 52.17], y: [90.64, 90.81] } },
    { id: "vault", label: "贵重品库", art: "art-tile-vault",
      text: { size: 20.57, matrix: [1.05, 0.0055, -0.0052, 1], x: [10.27, 31.11, 51.64, 72.17], y: [90.97, 90.33, 89.97, 89.86] } },
    { id: "exchange", label: "塔晶集换", art: "art-tile-exchange",
      text: { size: 21.95, matrix: [1.0129, -0.0159, 0.0057, 1], x: [7.84, 30.54, 52.63, 74.72], y: [88.31, 88.5, 88.84, 89.79] } },
    { id: "archive", label: "档案库", art: "art-tile-archive",
      text: { size: 21.84, matrix: [1.023, 0.0054, 0.0018, 1], x: [19.7, 41.94, 63.99], y: [91.42, 91.77, 91.36] } },
    { id: "backpack", label: "背包", art: "art-tile-backpack",
      text: { size: 22.29, matrix: [1.02, -0.0053, -0.0148, 1.0001], x: [31.29, 53.18], y: [91.47, 91.12] } },
    { id: "glory", label: "光荣之路", art: "art-tile-glory",
      text: { size: 21.07, matrix: [1.04, -0.0073, 0, 1], x: [8.6, 30.35, 51.45, 73.14], y: [88, 88.51, 87.62, 87.92] } },
    { id: "etching", label: "基质蚀刻", art: "art-tile-etching",
      text: { size: 21.28, matrix: [1.03, 0.0054, 0.0048, 1], x: [8.26, 30.04, 51.47, 73.61], y: [90.51, 90.69, 89.84, 90.35] } },
    { id: "missions", label: "任务", art: "art-tile-missions",
      text: { size: 22.43, matrix: [0.992, 0.0035, -0.0075, 1], x: [31.9, 54.45], y: [90.89, 90.88] } },
    { id: "map", label: "地图", art: "art-tile-map",
      text: { size: 21.59, matrix: [1.0124, -0.0336, 0.0202, 0.9999], x: [29.15, 51.86], y: [92.42, 92.77] } },
    { id: "baker", label: "Baker", art: "art-tile-baker",
      text: { size: 20.95, matrix: [1.0368, -0.0181, 0.0045, 1.0001], x: [22.03, 36.68, 48.19, 60.19, 71.82], y: [92, 92.09, 92.1, 92.4, 92.42] } },
    { id: "survey", label: "问卷中心", art: "art-tile-survey",
      text: { size: 20.87, matrix: [1, 0.007, 0.006, 1.0001], x: [10.27, 31.76, 53.21, 74.72], y: [90.61, 90.75, 90.31, 89.73] } },
    { id: "tools", label: "游戏工具", art: "art-tile-tools",
      text: { size: 22.26, matrix: [1.01, -0.0071, -0.003, 1], x: [8.58, 30.87, 53.3, 75.65], y: [91.25, 91.28, 91.55, 91.65] } },
  ],
  net: { uid: "114514" },
  dialogs: {
    /* 四个站点入口的弹窗从 SITE_LINKS 生成：标题 = 站点 id 大写，地址作为 meta 行并带跳转按钮。 */
    ...Object.fromEntries(
      SITE_LINKS.map((link): [string, DialogContent] => [link.id, {
        title: link.id.toUpperCase(),
        subtitle: link.title,
        description: link.description,
        meta: [{ label: "地址", value: link.url, href: link.url }],
        image: link.image,
      }]),
    ),
    brief: dialog("INDUSTRIAL BRIEF", "工业简报", "工业区运转状况的实时简报：产出、消耗与异常事件汇总。", [
      { label: "效率", value: "—" }, { label: "告警", value: "0" },
    ]),
    settings: dialog("SETTINGS", "设置", "画面、音频与操作偏好设置。", [
      { label: "版本", value: "—" },
    ]),
    mail: dialog("MAIL", "邮件", "系统与运营方发来的邮件，附件记得领取。", [
      { label: "未读", value: "1" },
    ]),
    alerts: dialog("ALERTS", "警报", "塔卫区域的异常事件警报。", [
      { label: "级别", value: "关注" },
    ]),
    year: YEAR_SUMMARY,
    "tech-stack": {
      title: "TECH STACK",
      subtitle: "技术栈",
      description: `当前在用的技术栈，按类别共 ${TECH_STACK_COUNT} 项。`,
      meta: [],
      groups: TECH_STACK_GROUPS.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({ name: item.name, level: item.level, icon: item.icon })),
      })),
    },
  },
};

/** 友链弹窗：条目来自 FRIEND_LINKS（顶栏计数同源）。 */
export function friendsDialog(): DialogContent {
  return {
    title: "FRIEND LINKS",
    subtitle: "友链",
    description:
      FRIEND_LINKS.length > 0
        ? "常去的站点与朋友们的博客。"
        : "尚未收录友链；在 src/config/friend-links.ts 中添加后这里会自动列出。",
    meta: [],
    links: FRIEND_LINKS.map((link) => ({ title: link.name, url: link.url, note: link.description })),
  };
}

function formatFeedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** RSS 弹窗：实时接口聚合的条目与失败源；接口不可用时回退到构建期快照。 */
export function feedDialog(
  feed: FeedSnapshot,
  status: "loading" | "ready" | "error",
  isLive: boolean,
  onRetry: () => void,
): DialogContent {
  const failures = feed.failures ?? [];
  const total = feed.total ?? feed.sites + failures.length;
  const updated = formatFeedTime(feed.generatedAt);
  const summary = [
    `已获取 ${feed.sites}/${total} 个站点，共 ${feed.items.length} 篇更新`,
    failures.length > 0 ? `${failures.length} 个源暂时无法获取` : "",
    updated.length > 0 ? `更新于 ${updated}` : "",
  ].filter((part) => part.length > 0);

  const notice: DialogNotice | undefined =
    status === "loading"
      ? { tone: "loading", text: isLive ? "正在刷新订阅…" : "正在获取最新订阅…" }
      : status === "error"
        ? {
            tone: "error",
            text: isLive ? "刷新失败，当前显示上次获取的数据。" : "实时订阅接口不可用，当前显示构建时快照。",
          }
        : undefined;

  return {
    title: "RSS FEED",
    subtitle: "订阅更新",
    description: `${summary.join("，")}。`,
    meta: [],
    links: feed.items.map((item) => ({
      title: item.title,
      url: item.url,
      note: item.date,
      source: item.source,
    })),
    notice,
    failures: failures.map((failure) => ({ ...failure })),
    onRetry,
    isRetrying: status === "loading",
  };
}

/** 公告弹窗：标题固定为栏目名，副标题 / 正文 / 跳转链接来自当前这条公告的配置。 */
export function announcementDialog(slide: NewsSlide): DialogContent {
  return {
    title: "BREAKING NEWS",
    subtitle: slide.title,
    description: slide.detail,
    meta: slide.link ? [{ label: slide.link.label, value: slide.link.value, href: slide.link.href }] : [],
  };
}

/** Every actionable id that should open a dialog (cards, tiles, disc buttons, HUD and readouts).
    Missing entries fall back to a generic panel. */
export function dialogFor(action: string, content: MenuContent): DialogContent {
  return (
    content.dialogs[action] ??
    dialog(action.toUpperCase(), action, "该功能尚在整备中。", [])
  );
}
