import type { DialogContent } from "../config/menu-content";

/* 弹窗快照缓存：像素入场的 400ms 窗口容不下现做快照——订阅弹窗光可见区就有约 900 个汉字，
   内嵌字体近 2MB、SVG 解码 230ms 以上，等它就绪时动效早已播完。因此把栅格化提前到空闲期，
   打开时直接取用。只留一份：一张卡片画布按设备像素算是十几 MB。 */

const NARROW_MAX_WIDTH = 720;
const CARD_MAX_HEIGHT = 780;
const CARD_VIEWPORT_PADDING = 48;
const PANEL_SCALE = 0.72;

/** 卡片是否带需要加高的扩展块（封面 / 外链列表 / 分组 / 状态提示 / 失败区）。 */
function hasExtendedBody(content: DialogContent): boolean {
  return Boolean(
    content.image ||
      content.links?.length ||
      content.groups?.length ||
      content.notice !== undefined ||
      content.failures?.length,
  );
}

/** 桌面端卡片高度：窄屏走 CSS 自适应，宽屏按内容加高并以视口封顶（与弹窗的 inline style 同源）。 */
export function dialogCardHeight(content: DialogContent): number {
  if (!hasExtendedBody(content)) return 520;
  return Math.min(
    CARD_MAX_HEIGHT,
    Math.round((window.innerHeight - CARD_VIEWPORT_PADDING) / PANEL_SCALE),
  );
}

export function dialogPanelHeight(cardHeight: number): number {
  return Math.round(cardHeight * PANEL_SCALE);
}

export function dialogIsNarrow(): boolean {
  return window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH}px)`).matches;
}

/** 快照的身份：文字、状态与影响版式的尺寸/像素比全部参与，任一项变了都必须重做。 */
export function dialogRasterKey(content: DialogContent, cardHeight: number): string {
  const rows: string[] = [
    content.title,
    content.subtitle,
    content.description,
    content.image ?? "",
    content.notice ? `${content.notice.tone}:${content.notice.text}` : "",
    content.isRetrying ? "retrying" : "idle",
    String(cardHeight),
    String(window.devicePixelRatio),
    dialogIsNarrow() ? "narrow" : "wide",
  ];
  for (const row of content.meta) rows.push(`m|${row.label}|${row.value}`);
  for (const link of content.links ?? []) rows.push(`l|${link.source ?? ""}|${link.title}|${link.note ?? ""}`);
  for (const group of content.groups ?? []) {
    rows.push(`g|${group.label}`);
    for (const item of group.items) rows.push(`i|${item.name}|${item.level ?? ""}|${item.icon ?? ""}`);
  }
  for (const failure of content.failures ?? []) rows.push(`f|${failure.name}|${failure.reason}`);
  return rows.join(String.fromCharCode(31));
}

type CacheEntry = { key: string; raster: Promise<HTMLCanvasElement> };

let entry: CacheEntry | null = null;

/** 取已栅格化的快照；身份不匹配（文字或版式变了）时返回 null，由调用方现做。 */
export function peekDialogRaster(key: string): Promise<HTMLCanvasElement> | null {
  return entry !== null && entry.key === key ? entry.raster : null;
}

export function rememberDialogRaster(key: string, raster: Promise<HTMLCanvasElement>): void {
  entry = { key, raster };
  void raster.catch(() => {
    // 失败的快照不留在缓存里，下次打开重新栅格化。
    if (entry !== null && entry.key === key) entry = null;
  });
}
