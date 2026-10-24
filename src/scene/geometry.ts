/* Shared geometry of the central disc, in 1920×1080 stage pixels. Migrated verbatim from shared-geometry.js:
   every component that hugs the disc (left cards, right tiles, dial rings, disc buttons) derives its layout
   from these measured numbers. */

export const DISC = { cx: 960, cy: 540, bezelR: 492 * 0.96 };
export const GAP_BAND = 110;                    // empty band between the bezel and the button columns
export const R_EDGE = DISC.bezelR + GAP_BAND;   // radius the inner edge of both columns follows
