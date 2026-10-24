import type { CSSProperties } from "react";

/** A button label laid out like the game's: each character's origin (x[i], y[i] on the baseline, in the button's
    coordinates before `matrix`) and font size; `matrix` = [a, b, c, d] of an SVG matrix that leans the label with its
    button (omitted when upright); `anchor` = text-anchor for a single, centred origin.
    geometricPrecision: under the scene's 3D transform Chromium otherwise rasterizes SVG glyphs soft.
    (React version of EF.labelSVG: same attributes, as props for <text>.) */
export interface LabelLayout {
  size: number;
  matrix?: [number, number, number, number];
  anchor?: string;
  x: number[];
  y: number[];
}

export function labelText(t: LabelLayout): {
  "text-rendering": string;
  "font-size": number;
  transform?: string;
  "text-anchor"?: string;
  x: string;
  y: string;
} {
  return {
    "text-rendering": "geometricPrecision",
    "font-size": t.size,
    ...(t.matrix ? { transform: "matrix(" + t.matrix.join(" ") + " 0 0)" } : {}),
    ...(t.anchor ? { "text-anchor": t.anchor } : {}),
    x: t.x.join(" "),
    y: t.y.join(" "),
  };
}

/** CSS custom properties don't typecheck as React styles; this cast is the standard escape hatch. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}
