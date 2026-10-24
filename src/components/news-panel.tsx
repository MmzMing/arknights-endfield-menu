import { useEffect, useRef, useState } from "react";
import "../styles/news-panel.css";

/* "Breaking News" carousel in the top-right corner. Slides carry a caption over their artwork; they rotate every
   8 s, the page bars switch slides, and clicking the frame opens the current announcement's detail dialog.
   Dragging the panel sideways pulls the neighbour slide in under the pointer and either completes the push or
   springs back on release. Migrated verbatim from news-panel.js except for that detail callback; the push
   animation stays on the Web Animations API, exactly as the demo drove it. `paused` reproduces the demo's
   pause()/resume() (the menu holds the carousel while it closes and while the info dialog is open). */

export interface NewsSlide {
  caption: string;
  /** 公告配图（public 下的站点根路径）；省略时使用默认图 /assets/default.webp */
  image?: string;
  c1: string;
  c2: string;
  /** 公告详情弹窗的副标题 */
  title: string;
  /** 公告详情弹窗的正文 */
  detail: string;
  /** 详情中的跳转链接（可选） */
  link?: { label: string; value: string; href: string };
}

const DEFAULT_NEWS_IMAGE = "/assets/default.webp";
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const PUSH_MS = 170;   // slide change, measured on the game: the new slide pushes the old one out sideways
const PUSH_EASE = "cubic-bezier(.25,.7,.35,1)";
const INTERVAL_MS = 8000;
const DRAG_SLOP = 6;      // px of pointer travel before a press becomes a drag (right-tiles uses the same slop)
const DRAG_COMMIT = 0.3;  // how far across the panel a drag must pull the next slide to keep it
const FLICK_V = 0.5;      // px/ms: a release faster than this commits however far the pointer got

/** An active horizontal drag; null while the pointer is up or has not passed the slop. */
type Drag = {
  id: number;              // the captured pointer
  x0: number;              // where it went down
  dir: number;             // 1 forward (pulled to the left), -1 back; 0 until the slop is passed
  dx: number;              // pointer travel since x0, px
  v: number;               // last pointer speed, px/ms
  lastX: number;
  lastT: number;
  ghost: HTMLDivElement | null;   // the neighbour slide pulled in from the side being dragged towards
};

function slideBackground(s: NewsSlide): string {
  return (
    "linear-gradient(90deg, rgba(8,10,12,0.74) 0%, rgba(8,10,12,0.34) 52%, rgba(8,10,12,0.1) 100%)," +
    "linear-gradient(0deg, rgba(8,10,12,0.5) 0%, rgba(8,10,12,0) 60%)," +
    `url("${assetUrl(s.image ?? DEFAULT_NEWS_IMAGE)}") center / cover no-repeat,` +
    "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06) 0 1px, rgba(255,255,255,0) 1px 4px)," +
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 6px, rgba(255,255,255,0) 6px 12px)," +
    `linear-gradient(115deg,${s.c1} 0%,${s.c2} 72%)`
  );
}

/** Builds a slide's element; the drag's neighbour and the push effect's incoming are made the same way, so a
    dragged-in slide and a pushed one are indistinguishable. */
function makeSlide(slide: NewsSlide): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "ef-news__img";
  el.style.background = slideBackground(slide);
  el.textContent = slide.caption;
  return el;
}

export function NewsPanel({
  slides,
  paused,
  onOpen,
}: {
  slides: NewsSlide[];
  paused: boolean;
  onOpen: (slide: NewsSlide) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);   // the slide currently shown
  const [index, setIndex] = useState(0);
  const [epoch, setEpoch] = useState(0);                // bumped to restart the autoplay interval (demo resume())
  const dirRef = useRef(1);                             // push direction of the change in flight
  const instantRef = useRef(true);                      // the first slide just appears
  const indexRef = useRef(0);                           // what the imperative drag loop reads
  const dragRef = useRef<Drag | null>(null);
  const draggedRef = useRef(false);                     // a drag just ended: swallow the click it produced
  const reducedMotion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /** Push choreography (the demo's show()): whenever index changes, the new slide comes in from one side and
      pushes the old one out the other way, decelerating like the game's carousel; with reduced motion it swaps
      at once. */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    indexRef.current = index;
    const slide = slides[index];

    // finish a push in flight: only the slide the loop tracks may stay
    Array.prototype.slice.call(body.children).forEach((el) => {
      if (el !== imgRef.current) (el as HTMLElement).remove();
    });

    const incoming = makeSlide(slide);
    body.appendChild(incoming);

    const outgoing = imgRef.current;
    imgRef.current = incoming;
    if (instantRef.current || !outgoing || (reducedMotion && reducedMotion.matches)) {
      if (outgoing) outgoing.remove();
      return;
    }
    const ease = { duration: PUSH_MS, easing: PUSH_EASE, fill: "forwards" as const };
    incoming.animate([{ transform: `translateX(${100 * dirRef.current}%)` }, { transform: "translateX(0)" }], ease);
    const outAnim = outgoing.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-100 * dirRef.current}%)` }], ease);
    outAnim.onfinish = () => outgoing.remove();
  }, [index, slides, reducedMotion]);

  // autoplay (demo resume()/pause(); a manual move restarts the interval)
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      if (dragRef.current) return;   // a drag under way holds the carousel; releasing restarts the interval
      instantRef.current = false;
      dirRef.current = 1;
      setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, epoch, slides.length]);

  /* Drag to slide, on the image only (the head and the page bars keep their own clicks). The panel follows the
     pointer and the neighbour it is heading for comes in behind it, both as a translate of their own width, so the
     stage's scale cancels out and no scale factor is needed. Releasing past DRAG_COMMIT (or flicking faster than
     FLICK_V) finishes the push and hands the new slide to the loop above; anything else runs back. */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    /** -1..1: how far the drag has carried the column, +1 being exactly one slide to the left. */
    const shiftOf = (dx: number) => {
      const w = body.getBoundingClientRect().width || 1;
      return Math.max(-1, Math.min(1, -dx / w));
    };

    const paint = (d: Drag, s: number) => {
      if (imgRef.current) imgRef.current.style.transform = `translateX(${-s * 100}%)`;
      if (d.ghost) d.ghost.style.transform = `translateX(${(d.dir - s) * 100}%)`;
    };

    /** Pulls in the neighbour on the side the pointer is now heading for; a reversal swaps it. */
    const ghostFor = (d: Drag, dir: number) => {
      if (d.ghost && d.dir === dir) return;
      d.ghost?.remove();
      d.dir = dir;
      d.ghost = makeSlide(slides[(indexRef.current + dir + slides.length) % slides.length]);
      body.appendChild(d.ghost);
      body.classList.add("is-drag");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || dragRef.current) return;
      dragRef.current = { id: e.pointerId, x0: e.clientX, dir: 0, dx: 0, v: 0, lastX: e.clientX, lastT: e.timeStamp, ghost: null };
      body.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      d.v = (e.clientX - d.lastX) / Math.max(1, e.timeStamp - d.lastT);
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
      d.dx = e.clientX - d.x0;
      if (!d.ghost) {
        if (Math.abs(d.dx) <= DRAG_SLOP) return;
        // let a push that is still in flight land, so its fill-forwards transform cannot outrank the drag's
        body.getAnimations({ subtree: true }).forEach((a) => a.finish());
      }
      ghostFor(d, d.dx < 0 ? 1 : -1);
      paint(d, shiftOf(d.dx));
      e.preventDefault();
    };

    const end = (e: PointerEvent, flick: boolean) => {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      dragRef.current = null;
      body.classList.remove("is-drag");
      const ghost = d.ghost;
      if (!ghost) return;   // never passed the slop: the press was a click
      draggedRef.current = true;
      window.setTimeout(() => { draggedRef.current = false; }, 0);   // let the click that ends this drag be swallowed first
      const cur = imgRef.current;
      const s = shiftOf(d.dx);
      const to = flick && (Math.abs(s) >= DRAG_COMMIT || Math.abs(d.v) >= FLICK_V) ? d.dir : 0;
      const ease = { duration: Math.max(70, Math.round(PUSH_MS * Math.abs(to - s))), easing: PUSH_EASE, fill: "forwards" as const };
      if (cur) cur.animate([{ transform: cur.style.transform }, { transform: `translateX(${-to * 100}%)` }], ease);
      ghost.animate([{ transform: ghost.style.transform }, { transform: `translateX(${(d.dir - to) * 100}%)` }], ease).onfinish = () => {
        if (to === 0) {
          ghost.remove();
          if (cur) {
            cur.style.transform = "";
            cur.getAnimations().forEach((a) => a.cancel());
          }
          return;
        }
        // the slide is already sitting where the next one is shown: hand it over without a second push
        instantRef.current = true;
        setIndex((indexRef.current + d.dir + slides.length) % slides.length);
        setEpoch((v) => v + 1);   // the demo restarts autoplay on every manual move
      };
    };

    const onPointerUp = (e: PointerEvent) => end(e, true);
    const onPointerCancel = (e: PointerEvent) => end(e, false);
    const onLostCapture = (e: PointerEvent) => end(e, false);

    body.addEventListener("pointerdown", onPointerDown);
    body.addEventListener("pointermove", onPointerMove);
    body.addEventListener("pointerup", onPointerUp);
    body.addEventListener("pointercancel", onPointerCancel);
    body.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      body.removeEventListener("pointerdown", onPointerDown);
      body.removeEventListener("pointermove", onPointerMove);
      body.removeEventListener("pointerup", onPointerUp);
      body.removeEventListener("pointercancel", onPointerCancel);
      body.removeEventListener("lostpointercapture", onLostCapture);
    };
  }, [slides]);

  const goTo = (i: number) => {
    instantRef.current = false;
    dirRef.current = i >= index ? 1 : -1;
    setIndex((i + slides.length) % slides.length);
    setEpoch((e) => e + 1);   // the demo restarts autoplay on every manual move
  };

  return (
    <div className="ef-news">
      <div
        className="ef-news__frame"
        data-action="news"
        data-ef-shadow=""
        onClick={() => {
          if (draggedRef.current) return;   // a drag must not also open the dialog
          onOpen(slides[index]);
        }}
      >
        <div className="ef-news__head">
          Breaking News
          <svg width="12" height="15" viewBox="0 0 12 15" aria-hidden="true">
            <path d="M1.5 2 6 5.6 10.5 2" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path d="M2 8.4h8L6 13.6Z" fill="#fff" />
          </svg>
        </div>
        <div className="ef-news__body" ref={bodyRef} />
        <div className="ef-news__bars">
          {slides.map((slide, k) => (
            <i
              key={k}
              className={`ef-news__bar${k === index ? " is-on" : ""}`}
              title={slide.caption}
              onClick={(e) => {
                e.stopPropagation();
                goTo(k);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The orange belt: four strands on the floor that come out from under the frame and run down to the disc rim
    (measured on the screenshot: a shared centreline, parallel strands 5.7 px apart); the gradient keeps them
    hidden under the frame and its page bars and dims them towards the rim. Rendered on the deck layer. */
export function NewsBelt() {
  return (
    <svg className="ef-news__belt" viewBox="0 0 1920 1080" aria-hidden="true">
      <defs>
        <linearGradient id="efNewsBelt" gradientUnits="userSpaceOnUse" x1={0} y1={200} x2={0} y2={293}>
          <stop offset={0.237} stopColor="#EBA118" stopOpacity={0} />
          <stop offset={0.366} stopColor="#EBA118" />
          <stop offset={0.538} stopColor="#EBA118" stopOpacity={0.97} />
          <stop offset={0.796} stopColor="#EBA118" stopOpacity={0.85} />
          <stop offset={1} stopColor="#EBA118" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <path d="M1488.64 193.04L1436.18 230.51A48.55 48.55 0 0 0 1429.75 236.01L1387.56 279" />
      <path d="M1491.95 197.68L1439.5 235.15A42.85 42.85 0 0 0 1433.82 240L1389.65 285" />
      <path d="M1495.27 202.32L1442.81 239.79A37.15 37.15 0 0 0 1437.89 244L1393.71 289" />
      <path d="M1498.58 206.96L1446.12 244.43A31.45 31.45 0 0 0 1441.96 247.99L1397.77 293" />
    </svg>
  );
}
