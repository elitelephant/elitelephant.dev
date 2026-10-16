// The bubbles, their physics and the pointer, outside React. Front: scattered, drifting, pushed by the cursor,
// grabbed and thrown. Back: a loose crowd around the card that holds still and breathes.
import * as THREE from "three";
import { createOwnEngine } from "@/components/physics/own";
import type { Engine } from "@/components/physics/engine";
import { flipStore } from "@/lib/flip-store";
import { seeded } from "@/lib/random";
import { BREATH_SCALE, breath, frameTarget, frontTarget } from "./frame";
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

  let layout: Layout;
  let balls: Ball[] = [];
  let meshes: THREE.Mesh[] = [];
  let engine: Engine;
  let targets: THREE.Vector3[] = [];
  let mode: Mode = flipStore.get().flipped ? "gather" : "scatter";
  let breathAmount = 0;
  let time = 0;
  let still = false; // reduced motion: positions are worked out once per change, then left alone

  const cardRect = (): CardRect => {
    const el = flipStore.get().cardEl ?? document.getElementById("card");
    return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 };
  };
  const view = () => ({ width: canvas.clientWidth || innerWidth, height: canvas.clientHeight || innerHeight });

  function updateTargets(t: number) {
    for (let i = 0; i < balls.length; i++) {
      if (mode === "gather") frameTarget(balls[i], layout, reduce ? 0 : breath(balls[i], t, breathAmount), targets[i]);
      else frontTarget(balls[i], reduce ? 0 : t, targets[i]);
    }
  }

  function build() {
    layout = computeLayout(view(), cardRect());
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
    // Rebuilt while the back shows (a resize): start in the seats, apart, instead of flying in from the front.
    if (mode === "gather") {
      updateTargets(time);
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
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---------- Resize: keep the bubbles unless the layout really changed ----------
  let rebuildTimer = 0;
  function resize() {
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      const next = computeLayout(view(), cardRect());
      if (next.shape !== layout.shape || Math.abs(next.halfW - layout.halfW) > 0.5) build();
      else layout = next;
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
      updateTargets(t);
      engine.setTargets(targets);
      engine.setPointer(hover && grabbing < 0 ? scratch.copy(world) : null, 2.6 * Math.max(layout.scale, 0.6), 60);
      engine.step(dt);
      for (let i = 0; i < meshes.length; i++) engine.getPosition(i, meshes[i].position);
      // Breathing fades in when the frame forms and out when it breaks, so sizes never jump.
      const framed = mode === "gather";
      breathAmount += ((framed ? 1 : 0) - breathAmount) * Math.min(1, dt * 1.5);
      if (breathAmount > 0.001 || framed) {
        for (let i = 0; i < meshes.length; i++) meshes[i].scale.setScalar(balls[i].r * (1 + breath(balls[i], t, breathAmount) * BREATH_SCALE));
      }
    }
    rings.render(scene, camera);
    if (root.dataset.scene !== "ready") root.dataset.scene = "ready";
  }

  build();
  root.dataset.sceneMode = mode;
  root.dataset.bubbles = String(count);

  // Nothing is drawn until the shaders are compiled; the first frame then sets data-scene="ready",
  // which fades the canvas in over the static rings (app/globals.css).
  let compiled = false;
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
      clearTimeout(rebuildTimer);
      unsubscribe();
      unkick();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onOut);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      scene.remove(group);
      geometry.dispose();
      light.dispose();
      rings.dispose();
      delete root.dataset.scene;
      delete root.dataset.sceneMode;
      delete root.dataset.bubbles;
    },
  };
}
