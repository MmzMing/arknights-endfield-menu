import { useEffect, useRef, useState } from "react";
import { useMenuActions } from "../menu-actions";
import "../styles/news-panel.css";

/* "Breaking News" carousel in the top-right corner. Slides carry a caption over a placeholder gradient;
   they rotate every 8 s, and clicking the frame or a page bar switches slides.
   Migrated verbatim from news-panel.js; the push animation stays on the Web Animations API, exactly as the demo
   drove it. `paused` reproduces the demo's pause()/resume() (the menu holds the carousel while it closes and
   while the info dialog is open). */

export interface NewsSlide {
  caption: string;
  c1: string;
  c2: string;
}

const PUSH_MS = 170;   // slide change, measured on the game: the new slide pushes the old one out sideways
const INTERVAL_MS = 8000;

function slideBackground(s: NewsSlide): string {
  return (
    "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06) 0 1px, rgba(255,255,255,0) 1px 4px)," +
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 6px, rgba(255,255,255,0) 6px 12px)," +
    `linear-gradient(115deg,${s.c1} 0%,${s.c2} 72%)`
  );
}

export function NewsPanel({ slides, paused }: { slides: NewsSlide[]; paused: boolean }) {
  const { onAction } = useMenuActions();
  const bodyRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);   // the slide currently shown
  const [index, setIndex] = useState(0);
  const [epoch, setEpoch] = useState(0);                // bumped to restart the autoplay interval (demo resume())
  const dirRef = useRef(1);                             // push direction of the change in flight
  const instantRef = useRef(true);                      // the first slide just appears
  const reducedMotion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /** Push choreography (the demo's show()): whenever index changes, the new slide comes in from one side and
      pushes the old one out the other way, decelerating like the game's carousel; with reduced motion it swaps
      at once. */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const slide = slides[index];

    // finish a push in flight: only the slide the loop tracks may stay
    Array.prototype.slice.call(body.children).forEach((el) => {
      if (el !== imgRef.current) (el as HTMLElement).remove();
    });

    const incoming = document.createElement("div");
    incoming.className = "ef-news__img";
    incoming.style.background = slideBackground(slide);
    incoming.textContent = slide.caption;
    body.appendChild(incoming);

    const outgoing = imgRef.current;
    imgRef.current = incoming;
    if (instantRef.current || !outgoing || (reducedMotion && reducedMotion.matches)) {
      if (outgoing) outgoing.remove();
      return;
    }
    const ease = { duration: PUSH_MS, easing: "cubic-bezier(.25,.7,.35,1)", fill: "forwards" as const };
    incoming.animate([{ transform: `translateX(${100 * dirRef.current}%)` }, { transform: "translateX(0)" }], ease);
    const outAnim = outgoing.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-100 * dirRef.current}%)` }], ease);
    outAnim.onfinish = () => outgoing.remove();
  }, [index, slides, reducedMotion]);

  // autoplay (demo resume()/pause(); a manual move restarts the interval)
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      instantRef.current = false;
      dirRef.current = 1;
      setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, epoch, slides.length]);

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
          goTo(index + 1);
          onAction("news");
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
