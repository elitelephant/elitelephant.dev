// The bubbles, their physics and the pointer, outside React. Front: scattered, drifting, pushed by the cursor,
// grabbed and thrown. Back: a loose crowd around the card that holds still and breathes. Drifting and breathing settle
// a few seconds after the last interaction (see pace in ./frame).
import * as THREE from "three";
import { createOwnEngine } from "@/components/physics/own";
import type { Engine } from "@/components/physics/engine";
import { flipStore } from "@/lib/flip-store";
import { seeded } from "@/lib/random";
import { BREATH_SCALE, breath, frameTarget, frontTarget, pace } from "./frame";
import { computeLayout, makeBalls, type Ball, type CardRect, type Layout } from "./layout";
import { createRings } from "./rings";
import { lightFrag, lightVert } from "./shaders";

type Options = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  count: number;
  reduce: boolean;
  invalidate: () => void;
};

type Mode = "scatter" | "gather";
const KICK = 2.5; // the card passing edge-on pushes the air
const REBUILD_MS = 150;
// When the scene first shows, each bubble grows from nothing in its own place, at its own moment, over the plain mint
// the page starts on. With reduced motion they are simply there.
const GROW_S = 0.7;
const GROW_SPREAD = 1.1;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export function createBubbles({ gl, scene, camera, count, reduce, invalidate }: Options) {
  const canvas = gl.domElement;
  const root = document.documentElement;
  const rings = createRings(gl);
  const geometry = new THREE.SphereGeometry(1, 40, 40);
  // Light adds up, so overlapping bubbles get brighter.
  const light = new THREE.ShaderMaterial({
    vertexShader: lightVert, fragmentShader: lightFrag, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const group = new THREE.Group();
  scene.add(group);
  const kickRnd = seeded(42);
  const growDelay: number[] = [];
  let growFrom = -1;
  let grown = false;

  let layout: Layout;
  let balls: Ball[] = [];
  let meshes: THREE.Mesh[] = [];
  let engine: Engine;
  let targets: THREE.Vector3[] = [];
  let mode: Mode = flipStore.get().flipped ? "gather" : "scatter";
  let breathAmount = 0;
  let time = 0;
  // The drift and breathing run on their own clock, which slows to a stop when nothing happens (see pace).
  let motionTime = 0;
  let activeAt = 0;
  let moving = true;
  const wake = () => {
    activeAt = time;
  };
  let still = false; // reduced motion: positions are worked out once per change, then left alone

  // Offsets ignore the card's turn and tilt. They're summed up to the fixed stage, because the card's own offset
  // parent (the box with the perspective) doesn't start at the screen's corner.
  const onPage = (el: HTMLElement) => {
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { x, y };
  };
  const cardRect = (): CardRect => {
    const el = flipStore.get().cardEl ?? document.getElementById("card");
    if (!el) return { x: 0, y: 0, w: 0, h: 0 };
    const { x, y } = onPage(el);
    // The flip button's row under the card (see computeLayout); a hidden button has no offset parent and takes none.
    const button = document.querySelector<HTMLElement>("[data-flip]");
    const below = button?.offsetParent ? Math.max(0, onPage(button).y + button.offsetHeight - (y + el.offsetHeight)) : 0;
    return { x, y, w: el.offsetWidth, h: el.offsetHeight, below };
  };
  const view = () => ({ width: canvas.clientWidth || innerWidth, height: canvas.clientHeight || innerHeight });

  function updateTargets(t: number) {
    for (let i = 0; i < balls.length; i++) {
      if (mode === "gather") frameTarget(balls[i], layout, reduce ? 0 : breath(balls[i], t, breathAmount), targets[i]);
      else frontTarget(balls[i], reduce ? 0 : t, targets[i]);
    }
  }

  // For tests: how the frame sits around the card (a ring, or strips where the screen has room), and where the scene
  // measured the card.
  function setLayout(card: CardRect) {
    layout = computeLayout(view(), card);
    root.dataset.sceneShape = layout.shape;
    root.dataset.sceneCard = `${card.x} ${card.y} ${card.w} ${card.h}`;
  }

  function build() {
    setLayout(cardRect());
    balls = makeBalls(layout, count);
    targets = balls.map((b) => b.home.clone());
    group.clear();
    meshes = balls.map((b) => {
      const mesh = new THREE.Mesh(geometry, light);
      mesh.scale.setScalar(b.r);
      mesh.position.copy(b.home);
      group.add(mesh);
      return mesh;
    });
    engine = createOwnEngine(balls);
    const growRnd = seeded(13);
    growDelay.length = 0;
    for (let i = 0; i < balls.length; i++) growDelay.push(growRnd() * GROW_SPREAD);
    // Rebuilt while the back shows (a resize): start in the seats, apart, instead of flying in from the front.
    if (mode === "gather") {
      updateTargets(motionTime);
      engine.teleport(targets);
      engine.settle();
    }
    still = false;
  }

  // ---------- Card ----------
  const setMode = (next: Mode) => {
    if (next === mode) return;
    mode = next;
    root.dataset.sceneMode = mode;
    still = false;
    wake();
    invalidate();
  };
  const unsubscribe = flipStore.subscribe(() => setMode(flipStore.get().flipped ? "gather" : "scatter"));
  const unkick = flipStore.onKick((flipped) => {
    setMode(flipped ? "gather" : "scatter");
    if (!reduce) engine.kick(KICK, kickRnd);
  });

  // ---------- Pointer: a world point on z = 0, from listeners on the window ----------
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const world = new THREE.Vector3();
  const lastWorld = new THREE.Vector3();
  const pointerVel = new THREE.Vector3();
  let lastTime = 0;
  let hover = false;
  let grabbing = -1;
  let touchDown = false;

  const toWorld = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, world);
  };
  const trackVelocity = (now: number) => {
    const dt = Math.max(1 / 240, (now - lastTime) / 1000);
    pointerVel.subVectors(world, lastWorld).multiplyScalar(1 / dt).clampLength(0, 18);
    lastWorld.copy(world);
    lastTime = now;
  };
  const onMove = (e: PointerEvent) => {
    wake();
    if (!toWorld(e)) return;
    trackVelocity(e.timeStamp);
    if (grabbing >= 0) return engine.drag(world);
    hover = e.pointerType === "mouse" || touchDown;
  };
  // relatedTarget is null when the pointer leaves the window: stop pushing bubbles from the edge.
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) hover = false;
  };
  const onDown = (e: PointerEvent) => {
    wake();
    if (reduce || !toWorld(e)) return;
    touchDown = e.pointerType !== "mouse";
    lastWorld.copy(world);
    lastTime = e.timeStamp;
    pointerVel.set(0, 0, 0);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return;
    grabbing = meshes.indexOf(hit.object as THREE.Mesh);
    engine.grab(grabbing, world);
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("grabbing");
  };
  const onUp = () => {
    touchDown = false;
    if (grabbing >= 0) {
      engine.release(pointerVel);
      grabbing = -1;
      canvas.classList.remove("grabbing");
    }
    hover = false;
  };
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerout", onOut);
  // A touch anywhere counts, not only on the bubbles: on a phone a tap is often the only move there is.
  addEventListener("pointerdown", wake);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---------- Resize: keep the bubbles unless the layout really changed ----------
  // The window resizing reaches here through World; the card and its button can also change size on their own (a
  // larger text size, a font that arrives late), so their box is watched too.
  const deck = (flipStore.get().cardEl ?? document.getElementById("card"))?.parentElement;
  const deckWatch = new ResizeObserver(() => resize());
  if (deck) deckWatch.observe(deck);
  let rebuildTimer = 0;
  function resize() {
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      const card = cardRect();
      const next = computeLayout(view(), card);
      if (next.shape !== layout.shape || Math.abs(next.halfW - layout.halfW) > 0.5) build();
      else setLayout(card);
      still = false;
      invalidate();
    }, REBUILD_MS);
  }

  // ---------- Frame ----------
  const scratch = new THREE.Vector3();
  function frame(dt: number, t: number) {
    time = t;
    if (!compiled) return;
    if (reduce) {
      if (!still) {
        updateTargets(0);
        engine.teleport(targets);
        engine.settle();
        for (let i = 0; i < meshes.length; i++) {
          engine.getPosition(i, meshes[i].position);
          meshes[i].scale.setScalar(balls[i].r);
        }
        still = true;
      }
    } else {
      const speed = pace(t - activeAt);
      motionTime += dt * speed;
      // For tests: whether the drift and breathing have settled.
      if (moving !== speed > 0) {
        moving = speed > 0;
        root.dataset.sceneMotion = moving ? "moving" : "still";
      }
      updateTargets(motionTime);
      engine.setTargets(targets);
      engine.setPointer(hover && grabbing < 0 ? scratch.copy(world) : null, 2.6 * Math.max(layout.scale, 0.6), 60);
      engine.step(dt);
      for (let i = 0; i < meshes.length; i++) engine.getPosition(i, meshes[i].position);
      // Breathing fades in when the frame forms and out when it breaks, so sizes never jump.
      const framed = mode === "gather";
      breathAmount += ((framed ? 1 : 0) - breathAmount) * Math.min(1, dt * 1.5);
      if (growFrom < 0) growFrom = t;
      if (breathAmount > 0.001 || framed || !grown) {
        let full = true;
        for (let i = 0; i < meshes.length; i++) {
          const g = grown ? 1 : Math.min(1, Math.max(0, (t - growFrom - growDelay[i]) / GROW_S));
          if (g < 1) full = false;
          meshes[i].scale.setScalar(balls[i].r * (1 + breath(balls[i], motionTime, breathAmount) * BREATH_SCALE) * Math.max(1e-4, easeOut(g)));
        }
        grown ||= full;
      }
    }
    rings.render(scene, camera);
    // Only the first frame: when the scene steps down, SceneLoader sets "off" so the canvas fades out.
    if (!shown) {
      shown = true;
      root.dataset.scene = "ready";
    }
  }

  build();
  root.dataset.sceneMode = mode;
  root.dataset.sceneMotion = "moving";
  root.dataset.bubbles = String(count);

  // Nothing is drawn until the shaders are compiled; the first frame then sets data-scene="ready", which shows the
  // canvas and keeps the static rings away (app/globals.css).
  let compiled = false;
  let shown = false;
  let disposed = false;
  rings
    .compile(scene, camera)
    .catch(() => {})
    .finally(() => {
      if (disposed) return;
      compiled = true;
      invalidate();
    });

  return {
    frame,
    resize,
    dispose() {
      disposed = true;
      deckWatch.disconnect();
      clearTimeout(rebuildTimer);
      unsubscribe();
      unkick();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onOut);
      removeEventListener("pointerdown", wake);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      scene.remove(group);
      geometry.dispose();
      light.dispose();
      rings.dispose();
      delete root.dataset.scene;
      delete root.dataset.sceneMode;
      delete root.dataset.sceneMotion;
      delete root.dataset.sceneShape;
      delete root.dataset.sceneCard;
      delete root.dataset.bubbles;
    },
  };
}
