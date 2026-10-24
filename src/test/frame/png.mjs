// A hand-rolled PNG decoder for the frame comparison: parses the chunks, inflates the scanlines and
// reverses the per-line filters (including Paeth). Supports exactly what Chromium screenshots are:
// 8-bit RGBA or RGB, non-interlaced. Zero dependencies (node:zlib only).

import { inflateSync } from "node:zlib";

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported png: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    raw.copy(out, y * stride, src, src + stride);
    src += stride;
    const row = y * stride;
    const up = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[row + x - channels] : 0;   // left
      const b = y > 0 ? out[up + x] : 0;                       // above
      const c = y > 0 && x >= channels ? out[up + x - channels] : 0; // upper-left
      if (filter === 1) out[row + x] = (out[row + x] + a) & 0xff;
      else if (filter === 2) out[row + x] = (out[row + x] + b) & 0xff;
      else if (filter === 3) out[row + x] = (out[row + x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        out[row + x] = (out[row + x] + pred) & 0xff;
      } // filter 0: none
    }
  }
  return { width, height, channels, data: out };
}

/** per-pixel max channel delta stats between two decoded screenshots */
export function diffPng(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const n = a.width * a.height;
  const ca = a.channels, cb = b.channels;
  let bad = 0, worst = 0, worstAt = [0, 0];
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const ia = (y * a.width + x) * ca;
      const ib = (y * b.width + x) * cb;
      let d = 0;
      for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(a.data[ia + k] - b.data[ib + k]));
      if (ca === 4 && cb === 4) d = Math.max(d, Math.abs(a.data[ia + 3] - b.data[ib + 3]));
      if (d > worst) { worst = d; worstAt = [x, y]; }
      if (d > 2) bad++;
    }
  }
  return { ratio: bad / n, worst, worstAt };
}
