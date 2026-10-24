/** Outline of a card shape grown outwards by `pad` px, with corners rounded over `rc` px.
    Edges: top/bottom are lines y = a + b·x, left/right sides are x = a + b·y + c·y².
    Migrated verbatim from left-cards.js (shapePathD). */

export type EdgeLine = [a: number, b: number];       // y = a + b·x
export type EdgeQuad = [a: number, b: number, c: number]; // x = a + b·y + c·y²

export interface CardShape {
  top: EdgeLine;
  bottom: EdgeLine;
  left: EdgeQuad;
  right: EdgeQuad;
}

const lineY = (c: EdgeLine, x: number) => c[0] + c[1] * x;
const sideX = (q: EdgeQuad, y: number) => q[0] + q[1] * y + q[2] * y * y;
const slope = (q: EdgeQuad, y: number) => q[1] + 2 * q[2] * y;

export function shapePathD(s: CardShape, pad: number, rc: number): string {
  const ym = (lineY(s.top, 250) + lineY(s.bottom, 250)) / 2;
  const top: EdgeLine = [s.top[0] - pad * Math.hypot(1, s.top[1]), s.top[1]];
  const bottom: EdgeLine = [s.bottom[0] + pad * Math.hypot(1, s.bottom[1]), s.bottom[1]];
  const left: EdgeQuad = [s.left[0] - pad * Math.hypot(1, slope(s.left, ym)), s.left[1], s.left[2]];
  const right: EdgeQuad = [s.right[0] + pad * Math.hypot(1, slope(s.right, ym)), s.right[1], s.right[2]];

  function corner(edge: EdgeLine, side: EdgeQuad): [number, number] {  // intersection of an edge line with a side curve
    let y = lineY(edge, 250);
    for (let k = 0; k < 40; k += 1) y = lineY(edge, sideX(side, y));
    return [sideX(side, y), y];
  }
  function along(p: [number, number], edge: EdgeLine, dir: number): [number, number] {  // rc px from a corner along an edge line
    const n = Math.hypot(1, edge[1]);
    return [p[0] + (dir * rc) / n, p[1] + (dir * rc * edge[1]) / n];
  }
  function down(p: [number, number], side: EdgeQuad, dir: number): [number, number] {   // rc px from a corner along a side curve
    const y = p[1] + (dir * rc) / Math.hypot(1, slope(side, p[1]));
    return [sideX(side, y), y];
  }
  function ctrl(side: EdgeQuad, y1: number, y2: number): [number, number] {             // quadratic control point approximating a side curve
    return [sideX(side, y1) + (slope(side, y1) * (y2 - y1)) / 2, (y1 + y2) / 2];
  }
  const f = (p: [number, number]) => p[0].toFixed(1) + " " + p[1].toFixed(1);

  const TL = corner(top, left), TR = corner(top, right), BR = corner(bottom, right), BL = corner(bottom, left);
  const t1 = along(TL, top, 1), t2 = along(TR, top, -1), r1 = down(TR, right, 1), r2 = down(BR, right, -1);
  const b1 = along(BR, bottom, -1), b2 = along(BL, bottom, 1), l1 = down(BL, left, -1), l2 = down(TL, left, 1);
  return (
    "M" + f(t1) + " L" + f(t2) + " Q" + f(TR) + " " + f(r1) + " Q" + f(ctrl(right, r1[1], r2[1])) + " " + f(r2) +
    " Q" + f(BR) + " " + f(b1) + " L" + f(b2) + " Q" + f(BL) + " " + f(l1) + " Q" + f(ctrl(left, l1[1], l2[1])) + " " + f(l2) +
    " Q" + f(TL) + " " + f(t1) + " Z"
  );
}
