export function terrainHeight(x: number, z: number): number {
  const main = 108 * Math.exp(-(((x - 108) / 112) ** 2 + ((z - 64) / 98) ** 2));
  const west = 67 * Math.exp(-(((x + 132) / 126) ** 2 + ((z + 70) / 110) ** 2));
  const south = 43 * Math.exp(-(((x + 18) / 88) ** 2 + ((z - 158) / 74) ** 2));
  const waves = 6.5 * Math.sin(x * 0.038) * Math.cos(z * 0.034)
    + 3.5 * Math.sin((x + z) * 0.052)
    + 4.2 * Math.sin(x * 0.013 + z * 0.021);
  return main + west + south + waves;
}
