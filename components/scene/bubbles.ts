// The bubbles, their physics and the pointer, outside React. Front: scattered, drifting, pushed by the cursor,
// grabbed and thrown. Back: a loose crowd around the card that holds still and breathes. Drifting and breathing settle
// a few seconds after the last interaction (see pace in ./frame), and once nothing moves the scene stops drawing.
import * as THREE from "three";
import { createOwnEngine } from "@/components/physics/own";
import type { Engine } from "@/components/physics/engine";
import { flipStore } from "@/lib/flip-store";
import { seeded } from "@/lib/random";
import { BREATH_SCALE, breath, frameTarget, frontTarget, pace } from "./frame";
import { bubbleCount, computeLayout, makeBalls, type Ball, type CardRect, type Layout } from "./layout";
import { createRings } from "./rings";
import { lightFrag, lightVert } from "./shaders";

type Options = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  count: number;
  reduce: boolean;
  invalidate: () => void;
  // The renderer's frame loop, which draws every frame while "always" and only when asked while "demand".
  loop: { get: () => string; set: (frameloop: "always" | "demand") => void };
};

type Mode = "scatter" | "gather";
const KICK = 2.5; // the card passing edge-on pushes the air
const REBUILD_MS = 150;
const MAX_DT = 1 / 20; // a long frame never moves the physics further than this
// A longer gap between frames (a paused loop, a hidden tab) adds no more than this to the scene's clock.
const MAX_GAP = 0.25;
// Once nothing has moved for this long, the scene stops drawing and the canvas keeps its last frame. A still frame
// costs the GPU as much as a moving one.
const QUIET_S = 0.5;
const STILL = 2e-5 ** 2; // the most a resting bubble moves in a frame, squared, in world units (far under a pixel)
// When the scene first shows, each bubble inflates from nothing in its own place, at its own moment, over the plain
// mint the page starts on. It overshoots its size by about 17 % and settles, done within two seconds, well before the
// scene settles at five. With reduced motion they are there from the start.
const GROW_S = 0.85;
const GROW_SPREAD = 1.1;
const OVERSHOOT = 2.3; // the ease-out-back's constant, for a swing of about 17 % past full size
const inflate = (x: number) => 1 + (OVERSHOOT + 1) * Math.pow(x - 1, 3) + OVERSHOOT * Math.pow(x - 1, 2);

export function createBubbles({ gl, scene, camera, count, reduce, invalidate, loop }: Options) {
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
  // Every bubble in one draw call. A rebuild may draw fewer (a phone's strips), never more than the tier's count.
  const instances = new THREE.InstancedMesh(geometry, light, count);
  // The bubbles move every frame and fill the view, so there's nothing to cull.
  instances.frustumCulled = false;
  group.add(instances);
  let positions: THREE.Vector3[] = [];
  let sizes: number[] = [];
  let engine: Engine;
  let targets: THREE.Vector3[] = [];
  let mode: Mode = flipStore.get().flipped ? "gather" : "scatter";
  let breathAmount = 0;
  // The scene's clock, in seconds, which runs only while it draws. three's clock starts over whenever the frame loop
  // changes, so the time since the last interaction would come out wrong after a pause or a hidden tab.
  let time = 0;
  // The drift and breathing run on their own clock, which slows to a stop when nothing happens (see pace).
  let motionTime = 0;
  let activeAt = 0;
  let moving = true;
  let quietFor = 0;
  const pause = () => {
    loop.set("demand");
    root.dataset.sceneLoop = "paused";
  };
  // Draws again after a pause. A hidden tab stays stopped, and reduced motion only ever draws on demand.
  const resume = () => {
    quietFor = 0;
    if (reduce || document.hidden || loop.get() === "always") return;
    loop.set("always");
    root.dataset.sceneLoop = "running";
  };
  const wake = () => {
    activeAt = time;
    resume();
  };
  let still = false; // with reduced motion, positions are worked out once per change, then left alone

  // Offsets ignore the card's turn and tilt. They're summed up to the fixed stage, because the card's own offset
  // parent (the box with the perspective) doesn't start at the screen's corner. Less what each parent has scrolled,
  // since a card taller than the screen scrolls the stage and the frame follows it there.
  const onPage = (el: HTMLElement) => {
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
      const parent = n.offsetParent as HTMLElement | null;
      x += n.offsetLeft - (parent?.scrollLeft ?? 0);
      y += n.offsetTop - (parent?.scrollTop ?? 0);
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

  // Tells tests how the frame sits around the card (a ring, or strips where the screen has room), and where the scene
  // measured the card.
  function setLayout(card: CardRect) {
    layout = computeLayout(view(), card);
    root.dataset.sceneShape = layout.shape;
    root.dataset.sceneCard = `${card.x} ${card.y} ${card.w} ${card.h}`;
  }

  // Writes each bubble's whole model-view matrix into its instance, and the scale of its normal matrix, both worked out
  // here in double precision the way three works them out for a single mesh. Worked out on the GPU instead, in single
  // precision, a few ring edges came out a shade different from the scene drawn one mesh per bubble.
  const model = new THREE.Matrix4();
  const modelView = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const normalScale = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute("normalScale", normalScale);
  function place() {
    camera.updateMatrixWorld();
    for (let i = 0; i < balls.length; i++) {
      model.makeScale(sizes[i], sizes[i], sizes[i]).setPosition(positions[i]);
      instances.setMatrixAt(i, modelView.multiplyMatrices(camera.matrixWorldInverse, model));
      normalScale.setX(i, normalMatrix.getNormalMatrix(modelView).elements[0]);
    }
    instances.instanceMatrix.needsUpdate = true;
    normalScale.needsUpdate = true;
  }

  function build() {
    setLayout(cardRect());
    balls = makeBalls(layout, bubbleCount(layout, count));
    root.dataset.bubbles = String(balls.length);
    targets = balls.map((b) => b.home.clone());
    instances.count = balls.length;
    positions = balls.map((b) => b.home.clone());
    sizes = balls.map((b) => b.r);
    place();
    engine = createOwnEngine(balls);
    const growRnd = seeded(13);
    growDelay.length = 0;
    for (let i = 0; i < balls.length; i++) growDelay.push(growRnd() * GROW_SPREAD);
    // Rebuilt while the back shows (a resize), so start in the seats, apart, instead of flying in from the front.
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
  const sphere = new THREE.Sphere();
  const hitPoint = new THREE.Vector3();
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
  // relatedTarget is null when the pointer leaves the window, so stop pushing bubbles from the edge.
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget) return;
    hover = false;
    resume();
  };
  const onDown = (e: PointerEvent) => {
    wake();
    if (reduce || !toWorld(e)) return;
    touchDown = e.pointerType !== "mouse";
    lastWorld.copy(world);
    lastTime = e.timeStamp;
    pointerVel.set(0, 0, 0);
    // The nearest bubble the ray meets. The instances hold model-view matrices (see place), so three can't raycast them.
    let nearest = Infinity;
    for (let i = 0; i < balls.length; i++) {
      if (!ray.ray.intersectSphere(sphere.set(positions[i], sizes[i]), hitPoint)) continue;
      const d = hitPoint.distanceTo(ray.ray.origin);
      if (d < nearest) {
        nearest = d;
        grabbing = i;
      }
    }
    if (grabbing < 0) return;
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
    resume();
  };
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerout", onOut);
  // A touch anywhere counts, not only on the bubbles, since on a phone a tap is often the only move there is.
  addEventListener("pointerdown", wake);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---------- Resize: keep the bubbles unless the layout really changed ----------
  // The window resizing reaches here through World; the card and its button can also change size on their own (a
  // larger text size, a font that arrives late), so their box is watched too. A card taller than the screen also
  // moves when the stage scrolls.
  const deck = (flipStore.get().cardEl ?? document.getElementById("card"))?.parentElement;
  const deckWatch = new ResizeObserver(() => resize());
  if (deck) deckWatch.observe(deck);
  const stage = deck?.parentElement;
  stage?.addEventListener("scroll", resize, { passive: true });
  let rebuildTimer = 0;
  function resize() {
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      const card = cardRect();
      const next = computeLayout(view(), card);
      if (next.shape !== layout.shape || Math.abs(next.halfW - layout.halfW) > 0.5) build();
      else setLayout(card);
      still = false;
      resume();
      invalidate();
    }, REBUILD_MS);
  }

  // ---------- Frame ----------
  const scratch = new THREE.Vector3();
  const before = new THREE.Vector3();
  function frame(delta: number) {
    const dt = Math.min(delta, MAX_DT);
    const step = Math.min(delta, MAX_GAP);
    time += step;
    if (!compiled) return;
    if (reduce) {
      if (!still) {
        updateTargets(0);
        engine.teleport(targets);
        engine.settle();
        for (let i = 0; i < balls.length; i++) {
          engine.getPosition(i, positions[i]);
          sizes[i] = balls[i].r;
        }
        still = true;
      }
    } else {
      const speed = pace(time - activeAt);
      motionTime += dt * speed;
      // Tells tests whether the drift and breathing have settled.
      if (moving !== speed > 0) {
        moving = speed > 0;
        root.dataset.sceneMotion = moving ? "moving" : "still";
      }
      updateTargets(motionTime);
      engine.setTargets(targets);
      engine.setPointer(hover && grabbing < 0 ? scratch.copy(world) : null, 2.6 * Math.max(layout.scale, 0.6), 60);
      engine.step(dt);
      let moved = 0;
      for (let i = 0; i < balls.length; i++) {
        before.copy(positions[i]);
        engine.getPosition(i, positions[i]);
        moved = Math.max(moved, before.distanceToSquared(positions[i]));
      }
      // Breathing fades in when the frame forms and out when it breaks, so sizes never jump.
      const framed = mode === "gather";
      breathAmount += ((framed ? 1 : 0) - breathAmount) * Math.min(1, dt * 1.5);
      if (growFrom < 0) growFrom = time;
      if (breathAmount > 0.001 || framed || !grown) {
        let full = true;
        for (let i = 0; i < balls.length; i++) {
          const g = grown ? 1 : Math.min(1, Math.max(0, (time - growFrom - growDelay[i]) / GROW_S));
          if (g < 1) full = false;
          sizes[i] = balls[i].r * (1 + breath(balls[i], motionTime, breathAmount) * BREATH_SCALE) * Math.max(1e-4, inflate(g));
        }
        if (full && !grown) {
          grown = true;
          root.dataset.sceneGrowth = "done";
        }
      }
      const settled = speed === 0 && grown && grabbing < 0 && moved < STILL && Math.abs((framed ? 1 : 0) - breathAmount) < 1e-3;
      quietFor = settled ? quietFor + step : 0;
      // Drawing again after the tab showed, which restarts the loop without a wake.
      if (root.dataset.sceneLoop === "paused" && loop.get() === "always") root.dataset.sceneLoop = "running";
    }
    place();
    rings.render(scene, camera);
    if (quietFor >= QUIET_S && loop.get() === "always") pause();
    // Only on the first frame. When the scene steps down, SceneLoader sets "off" so the canvas fades out.
    if (!shown) {
      shown = true;
      root.dataset.scene = "ready";
    }
  }

  build();
  root.dataset.sceneMode = mode;
  root.dataset.sceneMotion = "moving";
  // Tells tests whether the scene draws every frame or has paused, settled.
  if (!reduce) root.dataset.sceneLoop = "running";
  // Tells tests whether the bubbles are still growing in. With reduced motion they are there from the start.
  root.dataset.sceneGrowth = reduce ? "done" : "growing";

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
      stage?.removeEventListener("scroll", resize);
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
      instances.dispose();
      geometry.dispose();
      light.dispose();
      rings.dispose();
      delete root.dataset.scene;
      delete root.dataset.sceneMode;
      delete root.dataset.sceneMotion;
      delete root.dataset.sceneLoop;
      delete root.dataset.sceneGrowth;
      delete root.dataset.sceneShape;
      delete root.dataset.sceneCard;
      delete root.dataset.bubbles;
    },
  };
}
