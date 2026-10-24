import { useLayoutEffect, useRef } from "react";
import { cssVars, labelText, type LabelLayout } from "../lib/label-svg";
import { useMenuActions } from "../menu-actions";
import { useScene } from "../scene/scene-context";
import { DISC, R_EDGE } from "../scene/geometry";
import "../styles/right-tiles.css";

/* Right column: two tiles per row, rows running along the right edge of the disc.
   The column scrolls by angle: wheel scrolling eases towards a target, dragging follows the pointer
   with rubber-band overscroll, a flick keeps coasting, and any overscroll springs back.
   Tile icons are the game's artwork traced from a screenshot (button-art.ts) and labels are Noto Sans SC laid out
   where the game puts them, both in the 107 × 104 face's coordinates.
   The layout/physics loop is the demo's right-tiles.js verbatim, as an imperative island over refs: a scroll frame
   writes CSS variables directly and re-renders nothing. */

export interface TileSpec {
  id: string;
  label: string;
  art: string;
  dot?: boolean;
  text: LabelLayout;
}

/* Rows sit on the R_EDGE circle by polar angle; scrolling shifts every row's angle. */
const VISIBLE_ROWS = 5;
const ROW_STEP = 15.5;              // angle between rows, deg
const FIRST_ROW_ANGLE = 22.52;      // angle of the first row at scroll 0, deg
const ARC_Y = 490;                  // vertical travel per radian, px
const LIFT = 50;
const VIEWPORT = { x: 1290, y: 200 };
const SHADOW_X = [-12.5, -0.024];   // back-plate offset as a linear function of the row position
const SHADOW_Y = [16.17, -0.0207];
const PX_PER_DEG = (ARC_Y * Math.PI) / 180;

/** Page arrow pointing away from its divider, origin on the middle of the line: a triangle and a chevron.
    The top one's triangle is a little shorter and its chevron a little thicker, as measured. */
const NAV_ARROW = {
  dn: ["M-11.55 0H11.55L0 9.92Z", "M-10.51 4.71L0 15.22 10.51 4.71 13.25 7.45 0 20.7-13.25 7.45Z"],
  up: ["M-11.55 0H11.55L0 9.42Z", "M-10.46 4.66L0 15.12 11.06 4.06 13.85 6.85 0 20.7-13.25 7.45Z"],
} as const;

function ArrowSvg({ dir }: { dir: "up" | "dn" }) {
  return (
    <svg aria-hidden="true" viewBox="-16 -24 32 48">
      <path d={NAV_ARROW[dir][0]} />
      <path d={NAV_ARROW[dir][1]} />
    </svg>
  );
}

/** A divider with its arrow (dir "up" or "dn"); the back plate repeats the same flow, so it lines up. */
function Nav({ dir, navRef }: { dir: "up" | "dn"; navRef: React.RefObject<HTMLDivElement | null> }) {
  const inner =
    dir === "up" ? (
      <>
        <span>
          <ArrowSvg dir={dir} />
        </span>
        <i />
      </>
    ) : (
      <>
        <i />
        <span>
          <ArrowSvg dir={dir} />
        </span>
      </>
    );
  return (
    <div className={`ef-right__nav ef-right__nav--${dir}`} ref={navRef}>
      <div className="ef-right__navsh" data-ef-shadow="">
        {inner}
      </div>
      <div className="ef-right__navfg">{inner}</div>
    </div>
  );
}

function Tile({ t, onAction }: { t: TileSpec; onAction: (a: string) => void }) {
  return (
    <button className="ef-rtile" data-action={t.id} aria-label={t.label} onClick={() => onAction(t.id)}>
      <i className="ef-rtile__shadow" data-ef-shadow="" />
      <span className="ef-rtile__face">
        <svg className="ef-rtile__art" viewBox="0 0 107 104" aria-hidden="true">
          <use href={`#${t.art}`} />
          <text {...labelText(t.text)}>{t.label}</text>
        </svg>
      </span>
      {t.dot ? <i className="ef-dot" /> : null}
    </button>
  );
}

interface TileMeta {
  row: number;
  right: boolean;
  x: string;
  y: string;
}

export function RightTiles({ tiles: tileSpecs }: { tiles: TileSpec[] }) {
  const { onAction } = useMenuActions();
  const scene = useScene();
  const vpRef = useRef<HTMLDivElement>(null);
  const navUpRef = useRef<HTMLDivElement>(null);
  const navDnRef = useRef<HTMLDivElement>(null);

  const ROWS = Math.ceil(tileSpecs.length / 2);
  const MAX_SCROLL = Math.max(0, ROWS - VISIBLE_ROWS) * ROW_STEP;
  const MAX_OVERSCROLL = 354 / PX_PER_DEG;

  useLayoutEffect(() => {
    const vpEl = vpRef.current, navUpEl = navUpRef.current, navDnEl = navDnRef.current;
    if (!vpEl || !navUpEl || !navDnEl) return;
    const vp = vpEl, navUp = navUpEl, navDn = navDnEl;

    const rows = Array.prototype.slice.call(vp.children) as HTMLElement[];
    const rowPlates = rows.map((row) => Array.prototype.slice.call(row.querySelectorAll(".ef-rtile__shadow")) as HTMLElement[]);
    const written = rows.map(() => ({}) as Record<string, string>);   // values this loop last wrote per row
    const tiles = new Map<HTMLElement, TileMeta>();
    rows.forEach((row, i) => {
      Array.prototype.forEach.call(row.querySelectorAll(".ef-rtile"), (tile: HTMLElement) => {
        tiles.set(tile, { row: i, right: tile.matches(":last-of-type"), x: "", y: "" });
      });
    });
    let lifted: HTMLElement | null = null;   // the tile that is (or was last) lifted on hover, focus or press
    let scroll = 0;                          // current scroll angle, deg (0 … MAX_SCROLL, beyond while overscrolled)

    function rowPosition(row: number) {
      const a = ((FIRST_ROW_ANGLE - row * ROW_STEP + scroll) * Math.PI) / 180;
      return {
        x: DISC.cx + R_EDGE * Math.cos(a) - VIEWPORT.x,
        y: DISC.cy - LIFT - ARC_Y * a - 22 - VIEWPORT.y,
      };
    }

    function setIfChanged(el: HTMLElement, w: Record<string, string>, name: string, value: string) {
      if (w[name] === value) return;
      w[name] = value;
      el.style.setProperty(name, value);
    }

    /** The lift's offset for a tile, from its row's place: the game lifts a tile 11 px along the floor's normal, which
        the perspective turns into about (4.1, -6.1) px on screen at the top row and (4.4, -1.7) px at the bottom half
        row, about 1 px further right in the right column, fitted here as a linear function of the row position (within
        0.2 px of the game in every slot). Only the tile being lifted gets it, refreshed by layout() while the column
        scrolls, so a scroll frame does not restyle every tile; the last one keeps its values while it settles back. */
    function writeLift(tile: HTMLElement) {
      const t = tiles.get(tile);
      if (!t) return;
      const p = rowPosition(t.row);
      const x = ((t.right ? 4.73 : 3.71) + p.x * 0.0067).toFixed(2) + "px";
      const y = (p.y * 0.0076 - 6.75).toFixed(2) + "px";
      if (x !== t.x) tile.style.setProperty("--ef-lift-x", (t.x = x));
      if (y !== t.y) tile.style.setProperty("--ef-lift-y", (t.y = y));
    }

    function lift(tile: HTMLElement) {
      lifted = tile;
      writeLift(tile);
    }

    function layout() {
      rows.forEach((el, i) => {
        const p = rowPosition(i), w = written[i];
        setIfChanged(el, w, "--ef-row-tx", p.x.toFixed(1) + "px");
        setIfChanged(el, w, "--ef-row-ty", p.y.toFixed(1) + "px");
        // the plate offset goes on the two plates themselves: set on the row, it would inherit to everything in it
        const shx = (SHADOW_X[0] + SHADOW_X[1] * p.x).toFixed(2), shy = (SHADOW_Y[0] + SHADOW_Y[1] * p.y).toFixed(2);
        if (shx !== w.shx || shy !== w.shy) {
          w.shx = shx;
          w.shy = shy;
          rowPlates[i].forEach((plate) => {
            plate.style.setProperty("--ef-row-shx", shx);
            plate.style.setProperty("--ef-row-shy", shy);
          });
        }
      });
      if (lifted) writeLift(lifted);
      navUp.classList.toggle("is-active", scroll > 0.3);
      navDn.classList.toggle("is-active", scroll < MAX_SCROLL - 0.3);
    }

    /** Each row's screen slot for the transitions (see the CSS): its place minus the rows scrolled past, rounded and
        kept within 0-5. */
    function setSlots() {
      rows.forEach((el, i) => {
        const slot = String(Math.max(0, Math.min(5, Math.round(i - scroll / ROW_STEP))));
        if (el.getAttribute("data-ef-slot") !== slot) el.setAttribute("data-ef-slot", slot);
      });
    }

    /** Sets the slots whenever a transition starts (body.ef-in or body.ef-out added) and holds them while it plays, as
        the game times every row by where it is when the transition starts: scrolling meanwhile only moves the rows, as
        a new slot would restart a row's animation or change its delay (a half-faded face would come back). Removing and
        adding the class within one task (a replayed entrance, a reopen during the exit) also starts a new one. Every
        entrance starts from the top row, as the game's menu does on every open. */
    function watchTransitions(toTop: () => void) {
      const phaseOf = (cls: string | null | undefined) =>
        /(^|\s)ef-out(\s|$)/.test(cls || "") ? "out" : /(^|\s)ef-in(\s|$)/.test(cls || "") ? "in" : "";
      let phase = phaseOf(document.body.className);
      const observer = new MutationObserver((records) => {
        const now = phaseOf(document.body.className);
        const fresh = now !== phase || records.some((r) => phaseOf(r.oldValue) !== now);
        phase = now;
        if (!fresh || !now) return;
        if (now === "in") toTop();
        setSlots();
        layout();
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
      return observer;
    }

    function overshoot() {
      return scroll < 0 ? scroll : scroll > MAX_SCROLL ? scroll - MAX_SCROLL : 0;
    }

    /** Wires wheel / drag / flick scrolling and the tiles' hover lift and press onto the viewport; returns toTop(),
        which stops any motion and puts the column back at its first row. */
    function bindScrolling() {
      let target = 0;                                    // wheel target angle
      let easeRaf = 0, springRaf = 0, coastRaf = 0, springTimer = 0;
      let dragging = false, dragged = false, dragStartY = 0, dragStartScroll = 0;
      let lastY = 0, lastT = 0, velocity = 0, stageScale = 1;
      let pressed: HTMLElement | null = null;            // the tile marked data-ef-press, see the hover in the CSS

      function press(tile: HTMLElement | null) {
        if (pressed === tile) return;
        if (pressed) pressed.removeAttribute("data-ef-press");
        pressed = tile;
        if (tile) {
          lift(tile);
          tile.setAttribute("data-ef-press", "");
        }
      }

      function stopMotion() {
        cancelAnimationFrame(easeRaf);
        cancelAnimationFrame(springRaf);
        cancelAnimationFrame(coastRaf);
        clearTimeout(springTimer);
      }

      function springBack() {
        cancelAnimationFrame(springRaf);
        (function step() {
          const rest = scroll < 0 ? 0 : MAX_SCROLL;
          const off = scroll - rest;
          if (Math.abs(off) < 0.02) {
            scroll = target = rest;
            layout();
            return;
          }
          scroll = rest + off * 0.8;
          layout();
          springRaf = requestAnimationFrame(step);
        })();
      }

      function easeToTarget() {
        cancelAnimationFrame(easeRaf);
        (function step() {
          const d = target - scroll;
          if (Math.abs(d) < 0.02) {
            scroll = target;
            layout();
            if (overshoot() !== 0) springTimer = window.setTimeout(springBack, 60);
            return;
          }
          scroll += d * 0.18;
          layout();
          easeRaf = requestAnimationFrame(step);
        })();
      }

      function coast(v: number) {
        (function step() {
          if (Math.abs(v) < 2e-3) {
            target = scroll;
            return;
          }
          scroll += v;
          if (scroll < 0 || scroll > MAX_SCROLL) {
            scroll = target = Math.max(-MAX_OVERSCROLL, Math.min(MAX_SCROLL + MAX_OVERSCROLL, scroll));
            springBack();
            return;
          }
          v *= 0.92;
          layout();
          coastRaf = requestAnimationFrame(step);
        })();
      }

      /** Rubber band: past either end, the column follows the pointer with diminishing returns. */
      function rubberBand(raw: number) {
        if (raw < 0) return -MAX_OVERSCROLL * (1 - Math.exp(0.5 * (raw / MAX_OVERSCROLL)));
        if (raw > MAX_SCROLL) return MAX_SCROLL + MAX_OVERSCROLL * (1 - Math.exp(-0.5 * ((raw - MAX_SCROLL) / MAX_OVERSCROLL)));
        return raw;
      }

      function endDrag(withInertia: boolean) {
        press(null);
        if (!dragging) return;
        dragging = false;
        vp.classList.remove("is-drag");
        setTimeout(() => { dragged = false; }, 0);   // let the click that ends this drag be swallowed first
        if (overshoot() !== 0) springBack();
        else if (withInertia) coast((-velocity * 16) / (PX_PER_DEG * stageScale));
        else target = scroll;
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        stopMotion();
        let d = e.deltaY * 0.062;
        const over = target < 0 ? target : target > MAX_SCROLL ? target - MAX_SCROLL : 0;
        if (over !== 0) d *= Math.max(0.04, Math.pow(1 - Math.abs(over) / MAX_OVERSCROLL, 2));
        target = Math.max(-MAX_OVERSCROLL, Math.min(MAX_SCROLL + MAX_OVERSCROLL, target + d));
        easeToTarget();
      };

      const onPointerDown = (e: PointerEvent) => {
        press(e.button === 0 ? ((e.target as HTMLElement).closest(".ef-rtile") as HTMLElement | null) : null);
        stopMotion();
        dragging = true;
        dragged = false;
        dragStartY = lastY = e.clientY;
        dragStartScroll = target = scroll;
        lastT = performance.now();
        velocity = 0;
        stageScale = scene.stageScale.value || 1;
        vp.classList.add("is-drag");
        vp.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dy) > 6) {
          dragged = true;
          press(null);
        }
        const now = performance.now();
        velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY;
        lastT = now;
        scroll = target = rubberBand(dragStartScroll - dy / (PX_PER_DEG * stageScale));
        layout();
      };

      const onPointerUp = () => endDrag(true);
      const onPointerCancel = () => endDrag(false);
      const onLostCapture = () => endDrag(false);

      // A drag must not also click the tile it started on.
      const onClickCapture = (e: Event) => {
        if (!dragged) return;
        e.stopPropagation();
        e.preventDefault();
      };

      // the tile under the pointer or with the keyboard focus gets its lift's offset (see lift()); pointerover also
      // comes when the column scrolls under a resting pointer
      const liftTarget = (e: Event) => {
        const tile = (e.target as HTMLElement).closest ? ((e.target as HTMLElement).closest(".ef-rtile") as HTMLElement | null) : null;
        if (tile) lift(tile);
      };

      vp.addEventListener("wheel", onWheel, { passive: false });
      vp.addEventListener("pointerdown", onPointerDown);
      vp.addEventListener("pointermove", onPointerMove);
      vp.addEventListener("pointerup", onPointerUp);
      vp.addEventListener("pointercancel", onPointerCancel);
      vp.addEventListener("lostpointercapture", onLostCapture);
      vp.addEventListener("click", onClickCapture, true);
      vp.addEventListener("pointerover", liftTarget);
      vp.addEventListener("focusin", liftTarget);

      return function toTop() {
        stopMotion();
        scroll = target = 0;
      };
    }

    const observer = watchTransitions(bindScrolling());
    layout();

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the column is built once from the tile list
  }, [tileSpecs, scene]);

  const rows: React.ReactNode[] = [];
  for (let r = 0; r < Math.ceil(tileSpecs.length / 2); r += 1) {
    rows.push(
      <div className="ef-rrow" key={r} style={cssVars({ zIndex: 40 + r })}>
        {tileSpecs.slice(r * 2, r * 2 + 2).map((t) => (
          <Tile key={t.id} t={t} onAction={onAction} />
        ))}
      </div>,
    );
  }

  return (
    <div className="ef-right">
      <Nav dir="up" navRef={navUpRef} />
      <div className="ef-right__viewport" ref={vpRef}>
        {rows}
      </div>
      <Nav dir="dn" navRef={navDnRef} />
    </div>
  );
}
