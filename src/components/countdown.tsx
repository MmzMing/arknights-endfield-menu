import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { CountdownContent } from "../config/menu-content";
import "../styles/countdown.css";

/* Landing clock, traced from the reference strip. Everything below is measured in the reference's own 832 x 249
   canvas (the screenshot is a 791 px crop of that canvas, so its right ornaments are cut off); the SVG scales the
   whole canvas as one piece. The clock reads the local time, so the four slots always carry a real HH:MM. */

const VIEW_W = 832;
const VIEW_H = 249;

/** The outlined slots, as [left, top, right, bottom] outer edges. */
const SLOTS: readonly (readonly [number, number, number, number])[] = [
  [60, 67, 227, 99], [242, 67, 408, 99], [424, 67, 590, 99], [606, 67, 771, 99],
  [60, 111, 132, 142], [155, 111, 227, 142], [242, 111, 280, 142], [552, 111, 590, 142], [606, 111, 771, 142],
  [60, 155, 227, 186], [242, 155, 313, 186], [336, 155, 407, 186], [424, 155, 590, 186], [606, 155, 677, 186], [700, 155, 771, 186],
];

/** Corner-glyph tiles: a 19 px square with a quarter disc (r 12) cut from one corner; the arc keeps to the
    tile's inner side (sweep flags trace the 90 deg quarter, not the outer 270 deg). */
const GLYPH = {
  tl: "M12 0A12 12 0 0 1 0 12V19H19V0Z",
  tr: "M7 0A12 12 0 0 0 19 12V19H0V0Z",
  bl: "M0 0H19V19H12A12 12 0 0 0 0 7Z",
  br: "M0 0H19V7A12 12 0 0 0 7 19H0Z",
} as const;

/** Each cluster's two left tiles then two right tiles, in the reference's arrangement. */
const CORNER_TILES = {
  tl: ["tl", "tl", "br", "br"],
  tr: ["br", "br", "tl", "tl"],
  bl: ["bl", "bl", "tr", "tr"],
  br: ["tr", "tr", "bl", "bl"],
} as const;

const GLYPH_X = [0, 21, 43, 63] as const;

function Corner({ x, y, tiles }: { x: number; y: number; tiles: readonly (keyof typeof GLYPH)[] }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 21].map((dy) =>
        GLYPH_X.map((dx, i) => (
          <path key={`${dx}-${dy}`} d={GLYPH[tiles[i]]} transform={`translate(${dx} ${dy})`} />
        )),
      )}
    </g>
  );
}

const SLASH_X = Array.from({ length: 13 }, (_, i) => 578 + i * 6.6);

function Telemetry() {
  return (
    <g className="ef-cd__telemetry" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M543 204.5l4 4-4 4M549 204.5l4 4-4 4" />
      <path d="M560 210.5h16" strokeDasharray="4 2" />
      {SLASH_X.map((x, i) => (
        <path key={i} d={`M${x.toFixed(1)} 214l3.3 -9.5`} />
      ))}
      <path d="M543 220.5l3.5 3.5-3.5 3.5M549 220.5l3.5 3.5-3.5 3.5" />
      <path d="M560 223.5h16" strokeDasharray="4 2" />
      <path d="M578 227l2.8 -9M584 227l2.8 -9" />
    </g>
  );
}

function currentClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The four digit centres in the reference. DM Serif Display's widest figures (the 0s, 6s and 9s) would just
    touch in the hour pair's measured 62.5 spacing, so each digit is condensed 5% about its own centre; the
    minutes' 70 spacing has room to spare either way. */
const DIGIT_X = [290.5, 353, 457.5, 527.5];

/** Loading reels: each digit rolls vertically like a mechanical counter before locking onto the clock value.
    The four slots carry different step counts so their gears come to rest one after another. */
const REEL_LINE = 150;
const REEL_STEPS = [14, 20, 16, 22] as const;

function Reel({
  x,
  value,
  steps,
  reelRef,
}: {
  x: number;
  value: string;
  steps: number;
  reelRef: (el: SVGGElement | null) => void;
}) {
  const digits = Array.from({ length: steps + 1 }, (_, i) => String((Number(value) - i + 100) % 10));
  return (
    <g transform={`translate(${x} 0)`}>
      <g ref={reelRef}>
        {digits.map((digit, i) => (
          <text key={i} className="ef-cd__digit" y={168.5 - i * REEL_LINE} transform="scale(0.95 1)">
            {digit}
          </text>
        ))}
      </g>
    </g>
  );
}

export function Countdown({ content }: { content: CountdownContent }) {
  const [clock, setClock] = useState(currentClock);
  const reelRefs = useRef<(SVGGElement | null)[]>([]);

  // the landing load: all four reels spin up together, then drop into the real time one slot after another
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tweens = reelRefs.current.map((reel, i) =>
      reel
        ? gsap.fromTo(
            reel,
            { y: REEL_STEPS[i] * REEL_LINE },
            { y: 0, duration: 1.3 + i * 0.12, ease: "power4.out", delay: 0.08 + i * 0.06 },
          )
        : null,
    );
    return () => {
      tweens.forEach((tween) => tween?.kill());
    };
  }, []);

  // wake on the next minute boundary; background tabs throttle timers, so also refresh when the tab returns
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      const now = new Date();
      timer = window.setTimeout(() => {
        setClock(currentClock());
        arm();
      }, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
    };
    arm();
    const onVisibility = () => {
      if (!document.hidden) setClock(currentClock());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const digits = clock.split("");

  return (
    <div className="ef-countdown">
      <svg
        className="ef-countdown__art"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={`COUNTDOWN ${clock}`}
      >
        <defs>
          <clipPath id="ef-cd-reel-clip">
            <rect x={210} y={54} width={390} height={150} />
          </clipPath>
        </defs>

        <g className="ef-cd__slots">
          {SLOTS.map(([l, t, r, b], i) => (
            <rect key={i} x={l + 0.5} y={t + 0.5} width={r - l - 1} height={b - t - 1} />
          ))}
        </g>

        <g className="ef-cd__ornaments">
          <Corner x={62} y={21} tiles={CORNER_TILES.tl} />
          <Corner x={688} y={21} tiles={CORNER_TILES.tr} />
          <Corner x={62} y={193} tiles={CORNER_TILES.bl} />
          <Corner x={688} y={193} tiles={CORNER_TILES.br} />
        </g>

        <rect className="ef-cd__bar" x={171.5} y={28.5} width={489} height={18} />
        <text className="ef-cd__bar-label" x={416} y={44.2} textAnchor="middle" textLength={429} lengthAdjust="spacing">
          {content.title}
        </text>

        <path className="ef-cd__bracket" d="M218 86H200V167H218V161H207V92H218Z" />
        <path className="ef-cd__bracket" d="M615 86H634V167H615V161H627V92H615Z" />

        <g className="ef-cd__clock">
          <g clipPath="url(#ef-cd-reel-clip)">
            <Reel x={DIGIT_X[0]} value={digits[0]} steps={REEL_STEPS[0]} reelRef={(el) => { reelRefs.current[0] = el; }} />
            <Reel x={DIGIT_X[1]} value={digits[1]} steps={REEL_STEPS[1]} reelRef={(el) => { reelRefs.current[1] = el; }} />
            <circle cx={404.5} cy={109.5} r={10.5} />
            <circle cx={404.5} cy={159.5} r={10.5} />
            <Reel x={DIGIT_X[2]} value={digits[3]} steps={REEL_STEPS[2]} reelRef={(el) => { reelRefs.current[2] = el; }} />
            <Reel x={DIGIT_X[3]} value={digits[4]} steps={REEL_STEPS[3]} reelRef={(el) => { reelRefs.current[3] = el; }} />
          </g>
        </g>

        <g className="ef-cd__meta">
          <text className="ef-cd__brand" x={186} y={214} textLength={116} lengthAdjust="spacingAndGlyphs">
            {content.brand}
          </text>
          <g className="ef-cd__source">
            <rect x={174} y={219} width={10.5} height={8.5} rx={0.5} />
            <rect x={177.8} y={222.5} width={2.4} height={2.4} />
            <path d="M190 222.7h5.4" />
            <text x={196} y={224.6} textLength={37} lengthAdjust="spacing">
              {content.source}
            </text>
          </g>
          <Telemetry />
        </g>
      </svg>
    </div>
  );
}
