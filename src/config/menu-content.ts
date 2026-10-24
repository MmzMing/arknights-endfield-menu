import type { EnergyContent } from "../components/energy-pill";
import type { TopBarContent } from "../components/top-bar";
import type { PlayerContent } from "../components/player-badge";
import type { CardSpec } from "../components/left-cards";
import type { TileSpec } from "../components/right-tiles";
import type { NewsSlide } from "../components/news-panel";

/* All editable content of the menu in one typed module. Coordinates and timings are NOT content — they are
   measured assets and live inside the components. The per-glyph `text` layouts are measured against the exact
   label strings: changing a label here requires re-measuring its layout. */

export interface DialogMetaRow {
  label: string;
  value: string;
}

export interface DialogContent {
  title: string;
  subtitle: string;
  description: string;
  meta: DialogMetaRow[];
}

export interface MenuContent {
  player: PlayerContent;
  topBar: TopBarContent;
  energy: EnergyContent;
  levelPill: { label: string; level: string };
  news: { slides: NewsSlide[] };
  leftCards: CardSpec[];
  rightTiles: TileSpec[];
  net: { delay: string; uid: string };
  dialogs: Record<string, DialogContent>;
}

const dialog = (title: string, subtitle: string, description: string, meta: DialogMetaRow[]): DialogContent => ({
  title, subtitle, description, meta,
});

export const MENU_CONTENT: MenuContent = {
  player: {
    avatarLabel: "avatar",
    name: "xxxxx",
    sub: "[ X · · · ]",
    level: "60",
    uid: "UID:xxxxx",
    permLabel: "权限等阶",
    permTier: "满级",
  },
  topBar: {
    currencyA: "355",
    currencyB: "123040",
    stamina: "178/360",
  },
  energy: { current: "7200", max: "9800", percent: "100" },
  levelPill: { label: "探索等级", level: "07" },
  news: {
    slides: [
      { caption: "版本前瞻 // 敬请期待", c1: "#7e3d49", c2: "#23191f" },
      { caption: "限时活动 · 进行中", c1: "#3d4f63", c2: "#161c24" },
      { caption: "新功能上线预告", c1: "#4f5a3d", c2: "#1a2016" },
      { caption: "系统维护预告 · 02:00", c1: "#5a4a2f", c2: "#221c12" },
      { caption: "终末地补给 · 限时供应", c1: "#5c5420", c2: "#1d1a0b" },
    ],
  },
  leftCards: [
    {
      action: "operators", label: "干员", art: "art-card-operators",
      text: { size: 22.62, matrix: [1.0392, -0.0417, -0.0168, 1.0015], x: [203.11, 226.39], y: [145.07, 145.3] },
    },
    {
      action: "events", label: "活动", art: "art-card-events",
      text: { size: 24.07, matrix: [0.9983, -0.0576, -0.0123, 1.0024], x: [216.09, 240.97], y: [148.8, 149.39] },
    },
    {
      action: "headhunt", label: "寻访", art: "art-card-headhunt", noted: true, sheen: true,
      text: { size: 24.2, matrix: [1.0678, -0.0186, 0.0015, 1.0001], x: [202.57, 224.93], y: [147.04, 146.12] },
    },
    {
      action: "shop", label: "采购中心", art: "art-card-shop",
      text: { size: 24.52, matrix: [0.9796, -0.0274, -0.0261, 1.0011], x: [193.01, 218.59, 243.56, 268.83], y: [132.78, 132.55, 133.08, 132.58] },
    },
  ],
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
  net: { delay: "82ms", uid: "xxxxx" },
  dialogs: {
    operators: dialog("OPERATORS", "干员", "查看并管理你签署的干员队伍，配置技能与装备，准备迎接塔卫的每一次行动。", [
      { label: "编制", value: "—" }, { label: "状态", value: "待命" },
    ]),
    events: dialog("EVENTS", "活动", "进行中与即将开启的限时活动一览。完成活动任务可获得丰厚补给。", [
      { label: "当前", value: "进行中" }, { label: "剩余", value: "—" },
    ]),
    headhunt: dialog("HEADHUNT", "寻访", "使用寻访凭证扩充你的干员阵容。新的相遇，或许就在下一次。", [
      { label: "凭证", value: "—" }, { label: "保底", value: "—" },
    ]),
    shop: dialog("SHOP", "采购中心", "塔卫物资的交易枢纽：补给、凭证与限定商品均可在此兑换。", [
      { label: "货币", value: "—" }, { label: "刷新", value: "每日 04:00" },
    ]),
    plan: dialog("INDUSTRIAL PLAN", "工业计划", "规划塔卫工业区的生产线与资源调度，让每一份原料都物尽其用。", [
      { label: "产能", value: "—" }, { label: "队列", value: "—" },
    ]),
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
    news: dialog("BREAKING NEWS", "公告", "最新的运营公告与版本情报。", [
      { label: "来源", value: "官方" },
    ]),
    stamina: dialog("STAMINA", "理智", "行动所消耗的理智值，随时间自然恢复。", [
      { label: "上限", value: "360" },
    ]),
    "topup-a": dialog("TOP UP", "补充", "获取更多货币的途径。", [
      { label: "余额", value: "355" },
    ]),
    "topup-b": dialog("TOP UP", "补充", "获取更多货币的途径。", [
      { label: "余额", value: "123040" },
    ]),
    "level-info": dialog("EXPLORATION", "探索等级", "提升探索等级以解锁更多区域与功能。", [
      { label: "等级", value: "07" },
    ]),
  },
};

/** Every actionable id that should open a dialog (cards, tiles, disc buttons, HUD and readouts).
    Missing entries fall back to a generic panel. */
export function dialogFor(action: string, content: MenuContent): DialogContent {
  return (
    content.dialogs[action] ??
    dialog(action.toUpperCase(), action, "该功能尚在整备中。", [])
  );
}
