/** SVG path for a circular arc from a0 to a1 (degrees, clockwise from +x). Migrated verbatim from shared-geometry.js. */
export function arcD(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = (a0 * Math.PI) / 180, e = (a1 * Math.PI) / 180;
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    "M" + (cx + Math.cos(s) * r).toFixed(1) + " " + (cy + Math.sin(s) * r).toFixed(1) +
    "A" + r + " " + r + " 0 " + large + " 1 " + (cx + Math.cos(e) * r).toFixed(1) + " " + (cy + Math.sin(e) * r).toFixed(1)
  );
}
