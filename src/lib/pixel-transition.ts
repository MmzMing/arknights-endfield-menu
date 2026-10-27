// 参考页为 800ms / 36 个离散相位（约 22ms 一拍）；整体压到 400ms 的同时把相位减半，保持同一节拍密度。
export const PIXEL_TRANSITION_DURATION = 0.4;
export const PIXEL_TRANSITION_BEATS = 18;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(from: number, to: number, value: number): number {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

export function transitionState(progress: number): { phase: number; strength: number; reveal: number } {
  const phase = clamp01(progress);
  const envelope = smoothstep(0, 0.12, phase)
    * (0.42 + 0.58 * smoothstep(0.08, 0.5, phase))
    * (1 - smoothstep(0.72, 1, phase));
  const pulse = 0.72 + 0.28 * Math.sin(phase * Math.PI * 7.5 + Math.sin(9 * phase)) ** 2;
  return {
    phase,
    strength: phase > 0 && phase < 1 ? envelope * pulse : 0,
    reveal: smoothstep(0.28, 1, phase),
  };
}

export function fragmentOpacity(progress: number, threshold: number): number {
  const opening = smoothstep(0.4, 0.97, clamp01(progress));
  return 1 - smoothstep(threshold - 0.1, threshold + 0.1, opening);
}

export function pixelHash(x: number, y: number): number {
  const fract = (value: number) => value - Math.floor(value);
  let px = fract(x * 123.34);
  let py = fract(y * 456.21);
  const dot = px * (px + 45.32) + py * (py + 45.32);
  px += dot;
  py += dot;
  return fract(px * py);
}
