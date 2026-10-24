// Generates the Android maskable launcher icons from the favicon SVG source (vite-pwa assets-generator).
// Only the maskable pair is generated here: the rest of the favicon set in public/favicon/ is a hand-curated
// realfavicongenerator output and is intentionally left untouched. Rerun via `pnpm icons:generate` after
// replacing the source art.
import { join } from "node:path";
import { generateMaskableAsset } from "@vite-pwa/assets-generator/api";

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "public", "favicon", "favicon.svg");
const OUT = join(ROOT, "public", "favicon");

const options = {
  // padding is a canvas fraction: 0.1 keeps the artwork inside the maskable safe zone (the inner 80%
  // circle Android masks with); flattened onto the site's dark background so the transparent source
  // doesn't show the launcher wallpaper through
  padding: 0.1,
  resizeOptions: { fit: "contain", background: "#101214" },
  outputOptions: { compressionLevel: 9 },
};

for (const size of [192, 512]) {
  const sharp = await generateMaskableAsset("png", SOURCE, size, options);
  await sharp.toFile(join(OUT, `maskable-${size}x${size}.png`));
  console.log(`ok  maskable-${size}x${size}.png`);
}
