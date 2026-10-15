// Where each bubble goes. Front: it drifts around its home. Back (D-0232): it holds a seat around the card,
// clear of its edge, watching it, and breathes.
import type { Vector3 } from "three";
import { CAM_Z, type Ball, type Layout } from "./layout.ts";

const GAP = { around: [0.5, 2.6], sides: [0.5, 2.6], top: [0.25, 1.5] } as const; // from the card's edge
const FRAME_Z = [0.5, -2] as const; // near seats sit a little forward, far ones deeper
const TOP_SHARE = 0.35; // phones: the sides and bottom are mostly hidden, so the top gets more seats
const BREATH = (2 * Math.PI) / 5; // one slow breath every ~5 s
export const BREATH_SCALE = 0.06; // swells and shrinks ±6%
const BREATH_LEAN = 0.08; // and leans out a little as it swells

export function frontTarget(b: Ball, t: number, out: Vector3) {
  return out.set(b.home.x + Math.sin(t * 0.4 + b.phase) * 0.45, b.home.y + Math.cos(t * 0.33 + b.phase) * 0.35, b.home.z);
}

// -1..1, each bubble out of step with its neighbours; `amount` fades it in and out as the frame forms.
export const breath = (b: Ball, t: number, amount: number) => Math.sin(t * BREATH + b.phase) * amount;

export function frameTarget(b: Ball, layout: Layout, lean: number, out: Vector3) {
  const { box, shape } = layout;
  const [g0, g1] = GAP[shape];
  const m = g0 + (g1 - g0) * b.depth + b.r;
  const w = box.right - box.left + 2 * m;
  const h = box.top - box.bottom + 2 * m;
  const l = lean * BREATH_LEAN;
  const s = (b.slot + 1) % 1;
  if (shape === "sides") {
    const f = (s < 0.5 ? s : s - 0.5) * 2;
    out.set(s < 0.5 ? box.left - m - l : box.right + m + l, box.top + m - f * h, 0);
  } else {
    // Distance along the edge, clockwise from the top-left corner.
    let d = shape === "around" ? s * 2 * (w + h)
      : s < TOP_SHARE ? (s / TOP_SHARE) * w
      : w + ((s - TOP_SHARE) / (1 - TOP_SHARE)) * (w + 2 * h);
    if (d < w) out.set(box.left - m + d, box.top + m + l, 0);
    else if ((d -= w) < h) out.set(box.right + m + l, box.top + m - d, 0);
    else if ((d -= h) < w) out.set(box.right + m - d, box.bottom - m - l, 0);
    else out.set(box.left - m - l, box.bottom - m + (d - w), 0);
  }
  // Push the deeper seats outward so that, seen in perspective, they still sit where planned.
  const z = FRAME_Z[0] + (FRAME_Z[1] - FRAME_Z[0]) * b.depth;
  out.multiplyScalar((CAM_Z - z) / CAM_Z);
  out.z = z;
  return out;
}
