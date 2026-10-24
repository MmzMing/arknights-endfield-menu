import * as THREE from "three";
import { terrainHeight } from "../lib/contour-field";

export interface ContourTerrainController {
  setPaused: (paused: boolean) => void;
  /** restarts the marker lighting sequence, anchored to the disc's own entrance timeline */
  playEntrance: () => void;
  dispose: () => void;
}

const VERTEX_SHADER = `
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vLocal;

  void main() {
    vHeight = position.y;
    vNormal = normalize(normalMatrix * normal);
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float uTime;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vLocal;

  float contourLine(float interval, float width) {
    float level = vHeight / interval;
    float distanceToLine = abs(fract(level + 0.5) - 0.5);
    float antialias = max(fwidth(level), 0.0001);
    return 1.0 - smoothstep(width * antialias, (width + 1.0) * antialias, distanceToLine);
  }

  void main() {
    float elevation = smoothstep(-14.0, 114.0, vHeight);
    float layers = floor(elevation * 7.0) / 7.0;
    vec3 ink = mix(vec3(0.34, 0.37, 0.36), vec3(0.94, 0.95, 0.92), smoothstep(0.08, 0.92, elevation));

    float light = dot(normalize(vNormal), normalize(vec3(-0.35, 0.85, 0.4))) * 0.5 + 0.5;
    float toon = floor(light * 3.0) / 3.0;
    vec3 base = mix(vec3(0.018, 0.022, 0.022), vec3(0.15, 0.16, 0.155), toon * 0.54 + layers * 0.34);
    base += ink * elevation * 0.018;

    float minor = contourLine(5.5, 0.58);
    float major = contourLine(27.5, 0.9);
    float line = max(minor * 0.63, major);
    float boundary = contourLine(16.5, 1.15);
    float scanZ = mod(uTime * 42.0, 760.0) - 380.0;
    float scan = exp(-pow((vLocal.z - scanZ) / 22.0, 2.0));
    float pulse = 0.93 + 0.07 * sin(uTime * 1.2);
    vec3 color = mix(base, ink * pulse, max(line, boundary * 0.22));
    color += ink * scan * (0.025 + line * 0.22);

    gl_FragColor = vec4(color, 0.94);
    #include <colorspace_fragment>
  }
`;

/* Marker entrance, anchored to the disc's own timeline: the disc finishes growing in at 558 ms (disc.css
   efDiscScaleIn) and the map mask is fully open from 510 ms, so the markers start lighting at 560 ms — the ground
   ring pops in with a ripple, then the beam pulls up out of it. Yellow (the current sector) leads, white and grey
   follow 110 ms apart. Everything settles back onto the resting breathing values, so the handover is seamless. */
const BEACON_ANCHOR_MS = 560;
const RING_MS = 180;
const RIPPLE_MS = 420;
const BEAM_WAIT_MS = 140;
const BEAM_MS = 260;
const BEAM_HEIGHT = 78;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function createContourTerrain(host: HTMLElement, initiallyPaused: boolean): ContourTerrainController | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }

  const disposables: { dispose: () => void }[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-360, 360, 360, -360, 1, 1600);
  const canvas = renderer.domElement;
  canvas.className = "ef-contour-map__canvas";
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  host.appendChild(canvas);

  const geometry = new THREE.PlaneGeometry(1600, 1600, 280, 280);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const time = { value: 0 };
  const terrainMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: { uTime: time },
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  scene.add(terrain);
  disposables.push(geometry, terrainMaterial);

  const dotPositions: number[] = [];
  for (let x = -648; x <= 648; x += 54) {
    for (let z = -648; z <= 648; z += 54) {
      dotPositions.push(x, terrainHeight(x, z) + 1.8, z);
    }
  }
  const dotsGeometry = new THREE.BufferGeometry();
  dotsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
  const dotsMaterial = new THREE.PointsMaterial({ color: 0xd4d8d5, size: 1.4, transparent: true, opacity: 0.22, depthWrite: false });
  scene.add(new THREE.Points(dotsGeometry, dotsMaterial));
  disposables.push(dotsGeometry, dotsMaterial);

  type Beacon = {
    group: THREE.Group;
    cone: THREE.Mesh;
    coneMaterial: THREE.MeshBasicMaterial;
    beam: THREE.Mesh;
    beamMaterial: THREE.MeshBasicMaterial;
    ring: THREE.Mesh;
    ringMaterial: THREE.MeshBasicMaterial;
    ripple: THREE.Mesh;
    rippleMaterial: THREE.MeshBasicMaterial;
    phase: number;
    delay: number;
  };
  const beacons: Beacon[] = [];
  const markers = [
    { x: -132, z: -70, color: 0xdce1de, phase: 0, delay: 110 },
    { x: 108, z: 64, color: 0xffdf38, phase: 2.1, delay: 0 },
    { x: -18, z: 158, color: 0xaeb5b1, phase: 4.2, delay: 220 },
  ];
  for (const marker of markers) {
    const group = new THREE.Group();
    group.visible = false;
    group.position.set(marker.x, terrainHeight(marker.x, marker.z) + 4, marker.z);

    const coneGeometry = new THREE.ConeGeometry(13, 28, 3);
    const coneMaterial = new THREE.MeshBasicMaterial({ color: marker.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.y = 15;
    cone.rotation.y = Math.PI / 6;
    group.add(cone);

    const beamGeometry = new THREE.CylinderGeometry(2, 7, 128, 6, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: marker.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = BEAM_HEIGHT;
    group.add(beam);

    const ringGeometry = new THREE.RingGeometry(15, 18, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: marker.color, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);

    const rippleGeometry = new THREE.RingGeometry(15, 17, 48);
    const rippleMaterial = new THREE.MeshBasicMaterial({ color: marker.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = 0.6;
    group.add(ripple);

    scene.add(group);
    beacons.push({ group, cone, coneMaterial, beam, beamMaterial, ring, ringMaterial, ripple, rippleMaterial, phase: marker.phase, delay: marker.delay });
    disposables.push(coneGeometry, coneMaterial, beamGeometry, beamMaterial, ringGeometry, ringMaterial, rippleGeometry, rippleMaterial);
  }

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = initiallyPaused;
  let disposed = false;
  let rafId = 0;
  let elapsed = 0;
  let last = performance.now();
  // -1 until the entrance is armed; Infinity once the markers must hold their final state (paused, or the loop
  // never runs because of reduced motion), so a single painted frame always shows a settled map
  let entranceClock = -1;
  const settled = () => paused || motion.matches || document.hidden;

  const render = () => {
    pointer.x += (pointer.targetX - pointer.x) * 0.045;
    pointer.y += (pointer.targetY - pointer.y) * 0.045;
    const drift = motion.matches || paused ? 0 : Math.sin(elapsed * 0.18) * 7;
    camera.position.set(pointer.x * 24 + drift, 420 - pointer.y * 13, 480);
    camera.lookAt(pointer.x * 12, 20, pointer.y * 12);
    time.value = elapsed;
    for (const beacon of beacons) {
      const local = entranceClock - BEACON_ANCHOR_MS - beacon.delay;
      beacon.group.visible = local > 0;
      if (local <= 0) continue;
      const ring = easeOutExpo(clamp01(local / RING_MS));
      const grow = easeOutCubic(clamp01((local - BEAM_WAIT_MS) / BEAM_MS));
      const ripple = clamp01(local / RIPPLE_MS);
      beacon.ring.scale.setScalar(ring * (1 + Math.sin(elapsed * 2.1 + beacon.phase) * 0.16));
      beacon.ringMaterial.opacity = ring * 0.68;
      beacon.cone.scale.setScalar(ring);
      beacon.coneMaterial.opacity = ring * 0.9;
      beacon.beam.scale.set(1, grow, 1);
      beacon.beam.position.y = BEAM_HEIGHT * grow;
      beacon.beamMaterial.opacity = grow * (0.13 + (Math.sin(elapsed * 1.7 + beacon.phase) * 0.5 + 0.5) * 0.09);
      beacon.ripple.visible = ripple < 1;
      if (ripple < 1) {
        beacon.ripple.scale.setScalar(1 + 2.2 * easeOutCubic(ripple));
        beacon.rippleMaterial.opacity = 0.5 * (1 - ripple) ** 2;
      }
    }
    renderer.render(scene, camera);
    host.dataset.ready = "true";
  };

  const shouldRun = () => !disposed && !paused && !document.hidden && !motion.matches;
  const stop = () => {
    cancelAnimationFrame(rafId);
    rafId = 0;
  };
  const tick = (now: number) => {
    rafId = 0;
    if (!shouldRun()) return;
    // a rAF timestamp is the start of its frame, so it can land before the `last` that start() just stamped
    const dt = Math.min(Math.max(now - last, 0), 50);
    last = now;
    elapsed += dt / 1000;
    if (entranceClock >= 0) entranceClock += dt;
    render();
    rafId = requestAnimationFrame(tick);
  };
  const start = () => {
    if (rafId || !shouldRun()) return;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  };
  const syncPlayback = () => {
    // a loop that is about to stop never gets another frame, so hand the markers their final pose here: the frozen
    // frame shows a settled map, and resuming cannot shrink a beam back down mid-entrance
    if (entranceClock >= 0 && settled()) entranceClock = Number.POSITIVE_INFINITY;
    host.dataset.paused = String(!shouldRun());
    stop();
    render();
    start();
  };
  const onPointerMove = (event: PointerEvent) => {
    pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const onVisibilityChange = () => syncPlayback();
  const onMotionChange = () => syncPlayback();
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.left = -360 * aspect;
    camera.right = 360 * aspect;
    camera.updateProjectionMatrix();
    render();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  motion.addEventListener("change", onMotionChange);
  resize();
  syncPlayback();

  return {
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      syncPlayback();
    },
    playEntrance() {
      entranceClock = settled() ? Number.POSITIVE_INFINITY : 0;
      render();
    },
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motion.removeEventListener("change", onMotionChange);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
