// Hand-written sphere physics: fixed 120 Hz step, springs toward targets, mass-weighted collisions. Spheres on the
// same spot part in a seeded random direction, and settle() runs the simulation offline (reduced motion, rebuilds).
import { Vector3 } from "three";
import { seeded } from "../../lib/random.ts";
import type { Body, Engine } from "./engine.ts";

const H = 1 / 120;
const MAX_SUBSTEPS = 8;
const K = 6; // spring toward target (1/s²)
const C = 2.2; // damping (1/s); with K = 6 this overshoots a little
const GRAB_K = 220;
const GRAB_C = 22;
const RESTITUTION = 0.45;
const ITERATIONS = 3;
const SETTLE_STEPS = 240;

export function createOwnEngine(bodies: readonly Body[], seed = 1): Engine {
  const n = bodies.length;
  const pos = bodies.map((b) => b.home.clone());
  const vel = bodies.map(() => new Vector3());
  const r = bodies.map((b) => b.r);
  const invMass = r.map((x) => 1 / (x * x * x));
  const targets = bodies.map((b) => b.home.clone());
  const grabPoint = new Vector3();
  const f = new Vector3();
  const d = new Vector3();
  const part = seeded(seed);
  let pointer: Vector3 | null = null;
  let pointerR = 0;
  let pointerF = 0;
  let grabbed = -1;
  let acc = 0;

  function substep() {
    for (let i = 0; i < n; i++) {
      if (i === grabbed) {
        f.subVectors(grabPoint, pos[i]).multiplyScalar(GRAB_K).addScaledVector(vel[i], -GRAB_C);
      } else {
        f.subVectors(targets[i], pos[i]).multiplyScalar(K).addScaledVector(vel[i], -C);
        if (pointer) {
          d.subVectors(pos[i], pointer);
          d.z = 0;
          const dist = d.length();
          if (dist < pointerR && dist > 1e-4) f.addScaledVector(d, (pointerF * (1 - dist / pointerR)) / dist);
        }
      }
      vel[i].addScaledVector(f, H);
      pos[i].addScaledVector(vel[i], H);
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          d.subVectors(pos[j], pos[i]);
          const min = r[i] + r[j];
          const d2 = d.lengthSq();
          if (d2 >= min * min) continue;
          let dist = Math.sqrt(d2);
          if (dist < 1e-6) {
            // On the same spot there's no direction to push along, so pick one.
            d.set(part() - 0.5, part() - 0.5, (part() - 0.5) * 0.5).normalize();
            dist = 0;
          } else {
            d.multiplyScalar(1 / dist);
          }
          const wi = invMass[i];
          const wj = invMass[j];
          const w = wi + wj;
          const overlap = min - dist;
          pos[i].addScaledVector(d, (-overlap * wi) / w);
          pos[j].addScaledVector(d, (overlap * wj) / w);
          const vn = f.subVectors(vel[j], vel[i]).dot(d);
          if (vn < 0) {
            const jImp = (-(1 + RESTITUTION) * vn) / w;
            vel[i].addScaledVector(d, -jImp * wi);
            vel[j].addScaledVector(d, jImp * wj);
          }
        }
      }
    }
  }

  return {
    setTargets(list) {
      for (let i = 0; i < n; i++) targets[i].copy(list[i]);
    },
    setPointer(point, radius, force) {
      pointer = point;
      pointerR = radius;
      pointerF = force;
    },
    grab(i, point) {
      grabbed = i;
      grabPoint.copy(point);
    },
    drag(point) {
      grabPoint.copy(point);
    },
    release(velocity) {
      if (grabbed >= 0) vel[grabbed].copy(velocity);
      grabbed = -1;
    },
    kick(strength, rnd) {
      for (let i = 0; i < n; i++) {
        vel[i].x += (rnd() - 0.5) * 2 * strength;
        vel[i].y += (rnd() - 0.5) * 2 * strength;
        vel[i].z += (rnd() - 0.5) * strength;
      }
    },
    teleport(list) {
      for (let i = 0; i < n; i++) {
        pos[i].copy(list[i]);
        vel[i].set(0, 0, 0);
      }
    },
    step(dt) {
      acc = Math.min(acc + dt, H * MAX_SUBSTEPS);
      while (acc >= H) {
        substep();
        acc -= H;
      }
    },
    settle(steps = SETTLE_STEPS) {
      const saved = pointer;
      pointer = null;
      for (let s = 0; s < steps; s++) substep();
      pointer = saved;
      for (let i = 0; i < n; i++) vel[i].set(0, 0, 0);
      acc = 0;
    },
    getPosition(i, out) {
      return out.copy(pos[i]);
    },
  };
}
