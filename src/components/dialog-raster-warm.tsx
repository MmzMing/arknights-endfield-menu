import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DialogContent } from "../config/menu-content";
import { rasterizeDialog } from "../scene/dialog-pixel-renderer";
import { dialogCardHeight, dialogIsNarrow, dialogPanelHeight, dialogRasterKey, getDialogRaster } from "../scene/dialog-raster-cache";
import { DialogFace } from "./info-dialog";

export type DialogWarmProgress = { completed: number; total: number; errors: string[] };

/** 菜单空闲预热延迟：避开启动退场与用户刚进入菜单的首次点击。 */
const IDLE_WARM_DELAY_MS = 1800;

/* 逐份栅格化真实弹窗画面：启动页要求全部完成后退出；菜单空闲时只为尚未命中的弹窗补拍。 */
export const DialogRasterWarm = memo(function DialogRasterWarm({ contents, idle = false, onProgress }: {
  contents: readonly DialogContent[];
  idle?: boolean;
  onProgress?: (progress: DialogWarmProgress) => void;
}) {
  // 预热输入在挂载时定格：启动页期间抓取更新不能打乱正在逐份栅格化的队列。
  const [frozenContents] = useState(contents);
  const [index, setIndex] = useState(0);
  const shapeRef = useRef<HTMLDivElement>(null);
  const errorsRef = useRef<string[]>([]);
  const startedRef = useRef(!idle);
  const content = frozenContents[index];
  const cardHeight = content ? dialogCardHeight(content) : 0;
  const panelHeight = dialogPanelHeight(cardHeight);
  const isNarrow = dialogIsNarrow();
  const key = content ? dialogRasterKey(content, cardHeight) : "";

  useEffect(() => {
    if (!content) return;
    let cancelled = false;
    let idleHandle = 0;
    let timer = 0;
    const run = () => {
      const shape = shapeRef.current;
      if (!shape || cancelled) return;
      void getDialogRaster(key, () => rasterizeDialog(shape)).catch((error: unknown) => {
        console.warn("Dialog raster preparation failed", content.subtitle, error);
        if (!cancelled) errorsRef.current.push(content.subtitle);
      }).then(() => {
        if (cancelled) return;
        onProgress?.({ completed: index + 1, total: frozenContents.length, errors: [...errorsRef.current] });
        setIndex(index + 1);
      });
    };
    const frame = requestAnimationFrame(() => {
      if (!idle || startedRef.current) {
        if (idle && typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(run, { timeout: 3000 });
        } else {
          timer = window.setTimeout(run, idle ? 300 : 0);
        }
        return;
      }
      timer = window.setTimeout(() => {
        timer = 0;
        startedRef.current = true;
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(run, { timeout: 3000 });
        } else {
          timer = window.setTimeout(run, 300);
        }
      }, IDLE_WARM_DELAY_MS);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      if (idleHandle) window.cancelIdleCallback(idleHandle);
    };
  }, [content, frozenContents.length, idle, index, key, onProgress]);

  if (!content) return null;
  return (
    <div className="ef-idlg ef-idlg--warm" data-phase="open" style={{ "--ef-idlg-shadow": "1" } as CSSProperties} inert aria-hidden="true">
      <div className="ef-idlg__frame">
        <div className="ef-idlg__panel" style={isNarrow ? undefined : { height: panelHeight }}>
          <div className="ef-idlg__card" style={isNarrow ? undefined : { height: cardHeight }}>
            <div className="ef-idlg__shape" ref={shapeRef}>
              <div className="ef-idlg__rim" aria-hidden="true" />
              <DialogFace content={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
