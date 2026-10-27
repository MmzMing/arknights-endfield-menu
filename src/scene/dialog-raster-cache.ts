import type { DialogContent } from "../config/menu-content";

/* 弹窗快照缓存：像素入场的 400ms 窗口容不下现做快照——订阅弹窗光可见区就有约 900 个汉字，
   内嵌字体近 2MB、SVG 解码 230ms 以上，等它就绪时动效早已播完。因此把栅格化提前到空闲期，
   打开时直接取用。一张卡片画布按设备像素算是十几 MB；多项缓存按预算释放解码副本，保留 PNG。 */

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
  const hasRetry = Boolean(content.onRetry) && !content.isRetrying;
  return JSON.stringify({
    title: content.title,
    subtitle: content.subtitle,
    description: content.description,
    image: content.image ?? "",
    notice: content.notice ? [content.notice.tone, content.notice.text] : null,
    isRetrying: Boolean(content.isRetrying),
    hasNoticeRetry: hasRetry && content.notice?.tone === "error",
    hasFailureRetry: hasRetry && Boolean(content.failures?.length) && content.notice?.tone !== "error",
    cardHeight,
    viewport: [window.innerWidth, window.innerHeight],
    // 与 rasterizeDialog 的有效像素比一致，超过上限不产生重复快照。
    ratio: Math.min(2, window.devicePixelRatio || 1),
    isNarrow: dialogIsNarrow(),
    meta: content.meta.map((row) => [row.label, row.value, Boolean(row.href)]),
    links: (content.links ?? []).map((link) => [link.source ?? "", link.title, link.note ?? ""]),
    groups: (content.groups ?? []).map((group) => [
      group.label,
      group.items.map((item) => [item.name, item.level ?? "", item.icon ?? ""]),
    ]),
    failures: (content.failures ?? []).map((failure) => [failure.name, failure.reason, Boolean(failure.url)]),
  });
}

const MAX_ENTRIES = 48;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;
const MAX_BLOB_BYTES = 24 * 1024 * 1024;

type CacheEntry = {
  pending: Promise<HTMLCanvasElement> | null;
  encoding: Promise<Blob> | null;
  canvas: HTMLCanvasElement | null;
  blob: Blob | null;
  decodedBytes: number;
};

// Map 的迭代顺序即访问 LRU；异步完成不算新的访问。
const ENTRIES = new Map<string, CacheEntry>();

function removeEntry(key: string, entry: CacheEntry): void {
  if (ENTRIES.get(key) !== entry) return;
  ENTRIES.delete(key);
  // 在途回调仍可持有 entry，但不应因此继续持有已淘汰的像素或压缩数据。
  entry.pending = null;
  entry.encoding = null;
  entry.canvas = null;
  entry.blob = null;
  entry.decodedBytes = 0;
}

function trimCache(): void {
  for (const [key, entry] of ENTRIES) {
    if (ENTRIES.size <= MAX_ENTRIES) break;
    removeEntry(key, entry);
  }
  let decodedBytes = 0;
  let blobBytes = 0;
  for (const entry of ENTRIES.values()) {
    decodedBytes += entry.decodedBytes;
    blobBytes += entry.blob?.size ?? 0;
  }
  for (const entry of ENTRIES.values()) {
    if (decodedBytes <= MAX_DECODED_BYTES) break;
    decodedBytes -= entry.decodedBytes;
    entry.decodedBytes = 0;
    // 只释放缓存引用，不能重设 width/height：使用方可能正在播放这张画布。
    entry.canvas = null;
  }
  for (const [key, entry] of ENTRIES) {
    if (blobBytes <= MAX_BLOB_BYTES) break;
    if (!entry.blob) continue;
    blobBytes -= entry.blob.size;
    removeEntry(key, entry);
  }
}

function createEntry(key: string): CacheEntry {
  const previous = ENTRIES.get(key);
  if (previous) removeEntry(key, previous);
  const entry: CacheEntry = { pending: null, encoding: null, canvas: null, blob: null, decodedBytes: 0 };
  ENTRIES.set(key, entry);
  trimCache();
  return entry;
}

function rasterBytes(width: number, height: number): number {
  const bytes = width * height * 4;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || !Number.isSafeInteger(bytes)) {
    throw new Error("Invalid dialog raster dimensions");
  }
  return bytes;
}

function encodeRaster(canvas: HTMLCanvasElement): Promise<Blob> {
  // toBlob 的回调仅为原生 resolve，不捕获 canvas；结果 Promise 也只持有 Blob。
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")).then((blob) => {
    if (!blob || blob.size <= 0) throw new Error("Dialog raster compression failed");
    return blob;
  });
}

function rememberEncoding(key: string, entry: CacheEntry, encoded: Promise<Blob>): void {
  entry.encoding = encoded.then((blob) => {
    if (ENTRIES.get(key) === entry) {
      entry.encoding = null;
      // 单项就超过预算时只丢弃自己，不能为了它逐一淘汰其他条目。
      if (blob.size > MAX_BLOB_BYTES) removeEntry(key, entry);
      else {
        entry.blob = blob;
        trimCache();
      }
    }
    return blob;
  }, (error: unknown) => {
    removeEntry(key, entry);
    throw error;
  });
  // 编码不阻塞第一次交付；失败仍须清缓存，且无人 peek 时也不产生未处理拒绝。
  void entry.encoding.catch(() => {});
}

async function decodeRaster(encoded: Promise<Blob>): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(await encoded);
  try {
    rasterBytes(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Dialog raster decoding is unavailable");
    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

function trackRaster(
  key: string,
  entry: CacheEntry,
  create: () => Promise<HTMLCanvasElement>,
  shouldEncode: boolean,
): Promise<HTMLCanvasElement> {
  // 先登记 Promise，再在微任务调用工厂；同步重入也只能拿到同一任务。
  const pending = Promise.resolve().then(create).then((canvas) => {
    if (!canvas) throw new Error("Invalid dialog raster");
    const bytes = rasterBytes(canvas.width, canvas.height);
    if (ENTRIES.get(key) === entry) {
      // 已完成 Promise 会永久钉住 canvas，不能留在缓存中冒充可驱逐副本。
      entry.pending = null;
      if (bytes <= MAX_DECODED_BYTES) {
        entry.canvas = canvas;
        entry.decodedBytes = bytes;
      }
      if (shouldEncode) rememberEncoding(key, entry, encodeRaster(canvas));
      trimCache();
    }
    return canvas;
  }).catch((error: unknown) => {
    // 仅按 entry identity 清理；相同 key 的旧任务绝不能影响新的任务/成品。
    removeEntry(key, entry);
    throw error;
  });
  entry.pending = pending;
  void pending.catch(() => {});
  return pending;
}

/** 取进行中或已栅格化的快照；冷副本从 PNG 恢复，同一 key 的恢复任务也去重。 */
export function peekDialogRaster(key: string): Promise<HTMLCanvasElement> | null {
  const entry = ENTRIES.get(key);
  if (!entry) return null;
  ENTRIES.delete(key);
  ENTRIES.set(key, entry);
  if (entry.pending) return entry.pending;
  if (entry.canvas) return Promise.resolve(entry.canvas);
  const encoded = entry.blob ? Promise.resolve(entry.blob) : entry.encoding;
  if (!encoded) return null;
  return trackRaster(key, entry, () => decodeRaster(encoded), false);
}

/** 原子取得/创建快照，预热与弹窗同时请求时也只栅格化一次。 */
export function getDialogRaster(key: string, create: () => Promise<HTMLCanvasElement>): Promise<HTMLCanvasElement> {
  return peekDialogRaster(key) ?? trackRaster(key, createEntry(key), create, true);
}

/** 保留已有调用方的写入接口；显式写入可替换同 key 的旧任务。 */
export function rememberDialogRaster(key: string, raster: Promise<HTMLCanvasElement>): void {
  void trackRaster(key, createEntry(key), () => raster, true);
}
