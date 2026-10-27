import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { DialogContent } from "../config/menu-content";
import { rasterizeDialog } from "../scene/dialog-pixel-renderer";
import {
  dialogCardHeight,
  dialogIsNarrow,
  dialogPanelHeight,
  dialogRasterKey,
  peekDialogRaster,
  rememberDialogRaster,
} from "../scene/dialog-raster-cache";
import { DialogContourDefs, DialogFace } from "./info-dialog";

/* 空闲期把弹窗快照预先栅格化好：像素入场只有 400ms，而文字量大的弹窗（订阅）现做快照要
   几百毫秒，永远来不及接入。这里渲染一份与弹窗同尺寸的同款结构，在浏览器空闲时跑一次
   rasterizeDialog 存进缓存，真正打开时直接取用。inert + 移出视口，不参与交互与无障碍树。 */

export function DialogRasterWarm({ content }: { content: DialogContent }) {
  const shapeRef = useRef<HTMLDivElement>(null);
  const cardHeight = dialogCardHeight(content);
  const panelHeight = dialogPanelHeight(cardHeight);
  const isNarrow = dialogIsNarrow();
  const key = dialogRasterKey(content, cardHeight);

  useEffect(() => {
    if (peekDialogRaster(key) !== null) return;
    let idle = 0;
    let timer = 0;
    const warm = () => {
      const shape = shapeRef.current;
      if (shape === null) return;
      rememberDialogRaster(key, rasterizeDialog(shape));
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(warm, { timeout: 3000 });
      } else {
        timer = window.setTimeout(warm, 300);
      }
    };
    // 字体与布局落位后再拍，栅格化出来的才是最终画面。
    const raf = requestAnimationFrame(schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [key]);

  return (
    <>
      <DialogContourDefs />
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
    </>
  );
}
