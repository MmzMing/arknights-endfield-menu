import { mulberry32 } from "./mulberry32";

export interface TopoContourOptions {
  width: number;
  height: number;
  step: number;
  levels: number;
  seed: number;
}

type Point = [number, number];

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(seed: number, cells: number) {
  const random = mulberry32(seed);
  const size = cells + 1;
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i += 1) values[i] = random();

  return (x: number, y: number) => {
    const gx = Math.min(cells - 1, Math.max(0, Math.floor(x * cells)));
    const gy = Math.min(cells - 1, Math.max(0, Math.floor(y * cells)));
    const tx = smooth(x * cells - gx);
    const ty = smooth(y * cells - gy);
    const a = values[gy * size + gx];
    const b = values[gy * size + gx + 1];
    const c = values[(gy + 1) * size + gx];
    const d = values[(gy + 1) * size + gx + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

function heightAt(x: number, y: number, n1: (x: number, y: number) => number, n2: (x: number, y: number) => number, n3: (x: number, y: number) => number, n4: (x: number, y: number) => number) {
  const broad = n1(x, y);
  const ridge = 1 - Math.abs(n2(x, y) - 0.5) * 2;
  const detail = n3(x, y) * 0.65 + n4(x, y) * 0.35;
  return Math.min(1, Math.max(0, broad * 0.44 + ridge * 0.28 + detail * 0.28));
}

function segmentStart(p: Point) {
  return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
}

function segmentEnd(p: Point) {
  return `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
}

export function createTopoContourPaths({ width, height, step, levels, seed }: TopoContourOptions): string[] {
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  const n1 = valueNoise(seed, 5);
  const n2 = valueNoise(seed + 17, 9);
  const n3 = valueNoise(seed + 31, 17);
  const n4 = valueNoise(seed + 53, 33);
  const field = new Float32Array(cols * rows);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      field[y * cols + x] = heightAt(x / (cols - 1), y / (rows - 1), n1, n2, n3, n4);
    }
  }

  const paths: string[] = [];
  for (let levelIndex = 0; levelIndex < levels; levelIndex += 1) {
    const level = 0.14 + (levelIndex / (levels - 1)) * 0.72;
    const segments: string[] = [];

    for (let y = 0; y < rows - 1; y += 1) {
      for (let x = 0; x < cols - 1; x += 1) {
        const x0 = x * step;
        const y0 = y * step;
        const x1 = x0 + step;
        const y1 = y0 + step;
        const tl = field[y * cols + x];
        const tr = field[y * cols + x + 1];
        const br = field[(y + 1) * cols + x + 1];
        const bl = field[(y + 1) * cols + x];
        const points: Point[] = [];

        const cross = (va: number, vb: number, ax: number, ay: number, bx: number, by: number) => {
          if ((va >= level) === (vb >= level)) return;
          const t = (level - va) / (vb - va);
          points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
        };

        cross(tl, tr, x0, y0, x1, y0);
        cross(tr, br, x1, y0, x1, y1);
        cross(br, bl, x1, y1, x0, y1);
        cross(bl, tl, x0, y1, x0, y0);

        if (points.length === 2) {
          segments.push(segmentStart(points[0]) + segmentEnd(points[1]));
        } else if (points.length === 4) {
          segments.push(segmentStart(points[0]) + segmentEnd(points[1]));
          segments.push(segmentStart(points[2]) + segmentEnd(points[3]));
        }
      }
    }

    paths.push(segments.join(""));
  }

  return paths;
}
