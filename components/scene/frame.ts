// Where each bubble goes. Front: it drifts around its home. Back: it holds a seat around the card,
// clear of its edge, watching it, and breathes.
import type { Vector3 } from "three";
import { CAM_Z, HALF_H, OPEN_ROOM, STRIP_GAP, type Ball, type Layout, type Side } from "./layout.ts";

const GAP = [0.5, 2.6] as const; // around: from the card's edge
const FRAME_Z = [0.5, -2] as const; // near seats sit a little forward, far ones deeper
const BREATH = (2 * Math.PI) / 5; // one slow breath every ~5 s
export const BREATH_SCALE = 0.06; // swells and shrinks ±6%
const BREATH_LEAN = 0.08; // and leans out a little as it swells

// Motion that starts by itself has to stop within 5 s (WCAG 2.2.2). After the last mouse move, touch or turn, the
// front's drift and the frame's breathing keep going for SETTLE_HOLD seconds, then slow to a stop over SETTLE_EASE.
export const SETTLE_HOLD = 3.5;
export const SETTLE_EASE = 1.5;
// How fast the drift and breathing run, `idle` seconds after the last interaction: full speed, then down to still.
export const pace = (idle: number) => Math.min(1, Math.max(0, 1 - (idle - SETTLE_HOLD) / SETTLE_EASE));

export function frontTarget(b: Ball, t: number, out: Vector3) {
  return out.set(b.home.x + Math.sin(t * 0.4 + b.phase) * 0.45, b.home.y + Math.cos(t * 0.33 + b.phase) * 0.35, b.home.z);
}

// -1..1, each bubble out of step with its neighbours; `amount` fades it in and out as the frame forms.
export const breath = (b: Ball, t: number, amount: number) => Math.sin(t * BREATH + b.phase) * amount;

export function frameTarget(b: Ball, layout: Layout, lean: number, out: Vector3) {
  const l = lean * BREATH_LEAN;
  if (layout.shape !== "strip" || !stripSeat(b, layout, l, out)) aroundSeat(b, layout, l, out);
  // Push the deeper seats outward so that, seen in perspective, they still sit where planned.
  const z = FRAME_Z[0] + (FRAME_Z[1] - FRAME_Z[0]) * b.depth;
  out.multiplyScalar((CAM_Z - z) / CAM_Z);
  out.z = z;
  return out;
}

// A loose ring around the card, each bubble at its own distance from the edge.
function aroundSeat(b: Ball, { box }: Layout, l: number, out: Vector3) {
  const [g0, g1] = GAP;
  const m = g0 + (g1 - g0) * b.depth + b.r;
  const w = box.right - box.left + 2 * m;
  const h = box.top - box.bottom + 2 * m;
  // Distance along the edge, clockwise from the top-left corner.
  let d = ((b.slot + 1) % 1) * 2 * (w + h);
  if (d < w) out.set(box.left - m + d, box.top + m + l, 0);
  else if ((d -= w) < h) out.set(box.right + m + l, box.top + m - d, 0);
  else if ((d -= h) < w) out.set(box.right + m - d, box.bottom - m - l, 0);
  else out.set(box.left - m - l, box.bottom - m + (d - w), 0);
}

const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

// Seats only where the screen has room, spread over it from near the card out to the edge of the screen, with more
// seats where there is more room. Returns false when no side has room, so the caller falls back to the ring.
function stripSeat(b: Ball, { box, room, halfW }: Layout, l: number, out: Vector3) {
  const across = box.right - box.left;
  const down = box.top - box.bottom;
  const length: Record<Side, number> = { top: across, bottom: across, right: down, left: down };
  const weight = SIDES.map((side) => length[side] * Math.min(1, Math.max(0, room[side] - OPEN_ROOM) / (GAP[1] - STRIP_GAP)));
  const total = weight.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return false;
  let s = ((b.slot + 1) % 1) * total;
  let i = 0;
  while (i < SIDES.length - 1 && s >= weight[i]) s -= weight[i++];
  const side = SIDES[i];
  const f = s / weight[i];
  // Sizes as the camera sees them at this seat's depth, so the bubble stays on screen however near it sits, with
  // room for a breath to lean it out.
  const z = FRAME_Z[0] + (FRAME_Z[1] - FRAME_Z[0]) * b.depth;
  const r = b.r * (CAM_Z / (CAM_Z - z));
  const near = STRIP_GAP + r;
  const m = near + (Math.max(near, room[side] - r - BREATH_LEAN) - near) * b.depth;
  const x = (v: number) => Math.max(-halfW + r, Math.min(halfW - r, v));
  const y = (v: number) => Math.max(-HALF_H + r, Math.min(HALF_H - r, v));
  if (side === "top") out.set(x(box.left - m + f * (across + 2 * m)), box.top + m + l, 0);
  else if (side === "bottom") out.set(x(box.right + m - f * (across + 2 * m)), box.bottom - m - l, 0);
  else if (side === "right") out.set(box.right + m + l, y(box.top + m - f * (down + 2 * m)), 0);
  else out.set(box.left - m - l, y(box.bottom - m + f * (down + 2 * m)), 0);
  return true;
}
