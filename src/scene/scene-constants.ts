/* Measured constants of the 3D scene, migrated verbatim from the demo's shared-scene.js.
   Split out of scene-context.tsx so the component module only exports components (fast refresh),
   and so these numbers stay greppable on their own. */

export const CAM = {
  D: 1600,          // perspective distance in px (same as .ef-scene)
  pitch: 20,        // resting rotateX of the world plane, deg
  shift: [29, -40] as const, // the world's resting offset and roll (same as .ef-world's transform)
  roll: -1,
  maxYaw: 4,        // mouse sway range, deg
  maxPitch: 2.5,
  springK: 8e-3,
  springDamp: 0.8,
};
/** Heights of the parts that live inside the disc cylinder (disc); level = where the level pill appears at rest. */
export const PARTS = { well: -130, level: 60 };
/** Layers from back to front, with their height above the plane. The news frame sits just above the dial's
    white arcs (50) and the tips of its flags (about 70), which it covers in the game; the readouts on top
    (currencies, stamina, like the exploration level pill) are the highest parts and drift the most when the
    camera sways. */
export const LAYERS = { deck: 0, core: 0, btns: 26, tiles: 28, cards: 34, news: 72, top: 144 } as const;
export type LayerName = keyof typeof LAYERS;

/** The stage scale last written by useStageScale; the tile column's drag reads it (the demo kept this on
    its EF global — a module singleton is the React-world equivalent, and stays lint-clean). */
export const stageScale = { value: 1 };
