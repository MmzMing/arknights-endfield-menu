/** SVG path for a circular arc from a0 to a1 (degrees, clockwise from +x). Migrated verbatim from shared-geometry.js. */
export function arcD(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = (a0 * Math.PI) / 180, e = (a1 * Math.PI) / 180;
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    "M" + (cx + Math.cos(s) * r).toFixed(1) + " " + (cy + Math.sin(s) * r).toFixed(1) +
    "A" + r + " " + r + " 0 " + large + " 1 " + (cx + Math.cos(e) * r).toFixed(1) + " " + (cy + Math.sin(e) * r).toFixed(1)
  );
}

/** SVG path for a ring segment (annular sector): the outer arc from a0 to a1, a radial cut in to r0, the inner arc
    back and the closing cut, as one filled piece. Same angle convention as arcD; a1 may wrap past 360. */
export function sectorD(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const s = (a0 * Math.PI) / 180, e = (a1 * Math.PI) / 180;
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
  const at = (r: number, a: number) => (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1);
  return (
    "M" + at(r1, s) +
    "A" + r1 + " " + r1 + " 0 " + large + " 1 " + at(r1, e) +
    "L" + at(r0, e) +
    "A" + r0 + " " + r0 + " 0 " + large + " 0 " + at(r0, s) + "Z"
  );
}
