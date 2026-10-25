import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CAM, LAYERS, stageScale, type LayerName } from "./scene-constants";
import "../styles/scene.css";

/* 3D scene: one perspective camera looking down at a tilted "world" plane.
   Components mount into flat layers that float at different heights above that plane (React portals into the
   layer divs). Each layer is compensated (translateY + scale) so its content still lands on its 2D layout
   coordinates when seen from the default pitch. Moving the mouse sways the camera through a small spring, and
   every element tagged data-ef-shadow leans its drop shadow with the view angle.
   Camera math migrated verbatim from the demo's shared-scene.js; the measured constants live in
   scene-constants.ts. */

const SHADOW_STEPS = 100;   // shadow lean is quantized, so a settled camera restyles nothing

/** The camera in the world's own coordinates at the resting pitch: undo the world's offset, roll and pitch on
    the eye point (the scene's centre, CAM.D in front of it). */
const EYE = (() => {
  const r = (-CAM.roll * Math.PI) / 180, p = (-CAM.pitch * Math.PI) / 180;
  const x0 = -CAM.shift[0], y0 = -CAM.shift[1];
  const x1 = x0 * Math.cos(r) - y0 * Math.sin(r), y1 = x0 * Math.sin(r) + y0 * Math.cos(r);
  return { x: 960 + x1, y: 540 + y1 * Math.cos(p) - CAM.D * Math.sin(p), z: y1 * Math.sin(p) + CAM.D * Math.cos(p) };
})();

export interface AttachOpts {
  /** opt out of the perspective compensation, so the part stacks like a real cylinder (disc parts) */
  comp?: boolean;
  /** float at z while still looking at rest as if it stood at height h */
  rest?: number;
}

export interface SceneApi {
  /** the world element, for parts that mount straight into it (the backdrop's decorations) */
  world: () => HTMLElement | null;
  /** a scene layer element, for React portals */
  layer: (name: LayerName) => HTMLElement | null;
  /** lifts an element to height z with the demo's resting-pitch compensation (shared-scene.js attach);
      svg elements join the cylinder too — their missing offsetWidth yields NaN compensation exactly as in the
      demo, which CSS then drops, leaving the plain translateZ */
  attach: (el: HTMLElement | SVGElement, z: number, opts?: AttachOpts) => void;
  pause: () => void;
  resume: () => void;
  /** the stage scale last written by useStageScale; the tile column's drag reads it */
  stageScale: { value: number };
}

const SceneContext = createContext<SceneApi | null>(null);

// this module is the scene's context+provider+hook+portal by design (one cohesive unit); the fast-refresh
// boundary purity rule is traded away for that cohesion
// oxlint-disable-next-line react/only-export-components
export function useScene(): SceneApi {
  const api = useContext(SceneContext);
  if (!api) throw new Error("useScene outside SceneProvider");
  return api;
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const worldRef = useRef<HTMLDivElement>(null);
  // layer elements live in state: SceneLayer portals need them to exist before they can render into them
  const [layerEls, setLayerEls] = useState<Partial<Record<LayerName, HTMLDivElement | null>>>({});

  /** Lifts an element to height z. Compensation keeps it on its 2D coordinates at the resting pitch: the lift is
      undone by scaling towards the camera, so every point of the element still lies on the same line of sight.
      Parts inside the disc cylinder opt out ({ comp: false }) so they stack like a real cylinder, and { rest: h }
      makes a part float at z while still looking at rest as if it stood at height h. */
  const attach = useCallback((el: HTMLElement | SVGElement, z: number, opts?: AttachOpts) => {
    const worldEl = worldRef.current;
    if (!worldEl) return;
    const rest = opts && opts.comp === false ? z : opts && opts.rest != null ? opts.rest : 0;
    const k = (EYE.z - z) / (EYE.z - rest);
    const el0 = el as unknown as HTMLElement;   // svg elements: NaN compensation, as in the demo
    let ox = el0.offsetWidth / 2, oy = el0.offsetHeight / 2;   // its transform origin, in world coordinates
    for (let n: HTMLElement | null = el0; n && n !== worldEl; n = n.offsetParent as HTMLElement | null) { ox += n.offsetLeft; oy += n.offsetTop; }
    el.setAttribute("data-ef-z", "");
    el.style.setProperty("--z", String(z));
    el.style.setProperty("--ctx", ((1 - k) * (EYE.x - ox)).toFixed(2));
    el.style.setProperty("--cty", ((1 - k) * (EYE.y - oy)).toFixed(2));
    el.style.setProperty("--cs", k.toFixed(4));
  }, []);

  // ---- camera spring (mousemove sway), verbatim from shared-scene.js ----
  const cam = useRef({ rx: CAM.pitch, ry: 0 });
  const vel = useRef({ rx: 0, ry: 0 });
  const target = useRef({ rx: CAM.pitch, ry: 0 });
  const writtenLean = useRef({ x: "", y: "" });
  const rafId = useRef(0);
  const listening = useRef(false);
  const reducedMotion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  const applyCamera = useCallback(() => {
    const worldEl = worldRef.current;
    if (!worldEl) return;
    worldEl.style.setProperty("--ef-cam-rx", cam.current.rx.toFixed(3) + "deg");
    worldEl.style.setProperty("--ef-cam-ry", cam.current.ry.toFixed(3) + "deg");
    const leanX = -Math.tan((cam.current.ry * Math.PI) / 180) * 1.6;
    const leanY = Math.tan(((cam.current.rx - CAM.pitch) * Math.PI) / 180) * 1.6;
    const qx = (Math.round(leanX * SHADOW_STEPS) / SHADOW_STEPS).toFixed(3);
    const qy = (Math.round(leanY * SHADOW_STEPS) / SHADOW_STEPS).toFixed(3);
    if (qx === writtenLean.current.x && qy === writtenLean.current.y) return;
    writtenLean.current.x = qx;
    writtenLean.current.y = qy;
    worldEl.querySelectorAll<HTMLElement>("[data-ef-shadow]").forEach((el) => {
      el.style.setProperty("--ef-swx", qx);
      el.style.setProperty("--ef-swy", qy);
    });
  }, []);

  const tick = useCallback(() => {
    const dx = target.current.rx - cam.current.rx, dy = target.current.ry - cam.current.ry;
    vel.current.rx = (vel.current.rx + dx * CAM.springK) * CAM.springDamp;
    vel.current.ry = (vel.current.ry + dy * CAM.springK) * CAM.springDamp;
    const settled = Math.abs(dx) < 2e-3 && Math.abs(dy) < 2e-3 && Math.abs(vel.current.rx) < 6e-4 && Math.abs(vel.current.ry) < 6e-4;
    if (settled) {
      cam.current.rx = target.current.rx;
      cam.current.ry = target.current.ry;
      vel.current.rx = 0;
      vel.current.ry = 0;
      applyCamera();
      rafId.current = 0;
      return;
    }
    cam.current.rx += vel.current.rx;
    cam.current.ry += vel.current.ry;
    applyCamera();
    // the spring loop re-arms itself; assigning its own handle here is the demo's exact structure
    // oxlint-disable-next-line react/immutability
    rafId.current = requestAnimationFrame(tick);
  }, [applyCamera]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = (e.clientY / window.innerHeight) * 2 - 1;
      target.current.rx = CAM.pitch + my * CAM.maxPitch;
      target.current.ry = -mx * CAM.maxYaw;
      if (!rafId.current) rafId.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  const resume = useCallback(() => {
    if (listening.current || (reducedMotion && reducedMotion.matches)) return;   // reduced motion: keep the camera still
    document.addEventListener("mousemove", onMouseMove);
    listening.current = true;
  }, [onMouseMove, reducedMotion]);

  const pause = useCallback(() => {
    document.removeEventListener("mousemove", onMouseMove);
    listening.current = false;
    cancelAnimationFrame(rafId.current);
    rafId.current = 0;
    vel.current.rx = 0;
    vel.current.ry = 0;
  }, [onMouseMove]);

  const api = useMemo<SceneApi>(
    () => ({
      world: () => worldRef.current,
      layer: (name) => layerEls[name] ?? null,
      attach,
      pause,
      resume,
      stageScale,
    }),
    [attach, pause, resume, layerEls],
  );

  // shared-scene.js init(): attach every layer at its height, then face the resting camera and listen;
  // pause() again on unmount
  const pausedRef = useRef(pause);
  useLayoutEffect(() => {
    pausedRef.current = pause;
  }, [pause]);
  useLayoutEffect(
    () => () => {
      pausedRef.current();
    },
    [],
  );

  useLayoutEffect(() => {
    const allMounted = (Object.keys(LAYERS) as LayerName[]).every((name) => layerEls[name]);
    if (!allMounted) return;
    (Object.keys(LAYERS) as LayerName[]).forEach((name) => {
      const el = layerEls[name];
      if (el) attach(el, LAYERS[name]);
    });
    applyCamera();
    resume();
  }, [attach, applyCamera, resume, layerEls]);

  // stable per-layer ref callbacks: inline arrows would be re-created every render, and React would then
  // detach/re-attach each layer's ref, churning layerEls state (a memoized map, not a ref, so reading it
  // during render is fine)
  const layerRefCallbacks = useMemo(() => {
    const map = new Map<LayerName, (el: HTMLDivElement | null) => void>();
    for (const name of Object.keys(LAYERS) as LayerName[]) {
      map.set(name, (el) => {
        setLayerEls((prev) => (prev[name] === el ? prev : { ...prev, [name]: el }));
      });
    }
    return (n: LayerName) => map.get(n)!;
  }, []);

  return (
    <SceneContext.Provider value={api}>
      <div className="ef-scene">
        <div className="ef-world" id="efWorld" ref={worldRef}>
          {(Object.keys(LAYERS) as LayerName[]).map((name) => (
            <div key={name} className="ef-lyr" data-lyr={name} ref={layerRefCallbacks(name)} />
          ))}
          {children}
        </div>
      </div>
    </SceneContext.Provider>
  );
}

/** Renders children into one of the scene's flat layers (a React portal; children land in tree order, which
    reproduces the demo's mount order inside each layer). */
export function SceneLayer({ name, children }: { name: LayerName; children: ReactNode }) {
  const scene = useScene();
  const el = scene.layer(name);
  if (!el) return null;
  return createPortal(children, el);
}
