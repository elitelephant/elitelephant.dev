// Where each bubble goes. Front: it drifts around its home. Back: it holds a seat around the card, watching it, and
// breathes, or waits behind the card.
import type { Vector3 } from "three";
import { CAM_Z, OPEN_ROOM, type Ball, type Layout, type Side } from "./layout.ts";

const GAP = [0.5, 2.6] as const; // around: from the card's edge
const FRAME_Z = [0.5, -2] as const; // near seats sit a little forward, far ones deeper
const BREATH = (2 * Math.PI) / 5; // one slow breath every ~5 s
export const BREATH_SCALE = 0.06; // swells and shrinks ±6%
const BREATH_LEAN = 0.08; // and leans out a little as it swells

// Motion that starts by itself has to stop within 5 s (WCAG 2.2.2). After the last mouse move, touch or turn, the
// front's drift and the frame's breathing keep going for SETTLE_HOLD seconds, then slow to a stop over SETTLE_EASE.
export const SETTLE_HOLD = 3.5;
export const SETTLE_EASE = 1.5;
// How fast the drift and breathing run, `idle` seconds after the last interaction, from full speed down to still.
export const pace = (idle: number) => Math.min(1, Math.max(0, 1 - (idle - SETTLE_HOLD) / SETTLE_EASE));

export function frontTarget(b: Ball, t: number, out: Vector3) {
  return out.set(b.home.x + Math.sin(t * 0.4 + b.phase) * 0.45, b.home.y + Math.cos(t * 0.33 + b.phase) * 0.35, b.home.z);
}

// -1..1, each bubble out of step with its neighbours; `amount` fades it in and out as the frame forms.
export const breath = (b: Ball, t: number, amount: number) => Math.sin(t * BREATH + b.phase) * amount;

// How deep a bubble's seat is, and how big it looks there from the camera.
const seatZ = (b: Ball) => FRAME_Z[0] + (FRAME_Z[1] - FRAME_Z[0]) * b.depth;
const seenRadius = (b: Ball) => b.r * (CAM_Z / (CAM_Z - seatZ(b)));

export function frameTarget(b: Ball, layout: Layout, lean: number, out: Vector3) {
  const l = lean * BREATH_LEAN;
  if (!b.seated) waitSeat(b, layout, out);
  else if (layout.shape === "strip") freeSeat(b, layout, l, out);
  else aroundSeat(b, layout, l, out);
  // Push the deeper seats outward so that, seen in perspective, they still sit where planned.
  const z = seatZ(b);
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

// A loose frame where the screen leaves room on one or two sides only. The seats go on all four sides. A side with
// room takes them by its length, a thin one (the sides of a phone upright, the top and bottom of one on its side) by
// half of it, and a bubble there shows as a slice between the card's edge and the screen's. Each sits from a third
// of the way behind the card's edge (from the edge itself on a thin side, so its slice is more than a sliver) out to
// partly past the screen's, further out the deeper it sits, so the frame doesn't line up in rows. The flip button's
// row counts as room, since bubbles may pass behind it.
const THIN_SIDE = 0.5;
function freeSeat(b: Ball, { box, room, free }: Layout, l: number, out: Vector3) {
  const across = box.right - box.left;
  const down = box.top - box.bottom;
  const length: Record<Side, number> = { top: across, bottom: across, right: down, left: down };
  const weight = SIDES.map((side) => length[side] * (free[side] > OPEN_ROOM ? 1 : THIN_SIDE));
  const total = weight.reduce((sum, w) => sum + w, 0);
  let s = ((b.slot + 1) % 1) * total;
  let i = 0;
  while (i < SIDES.length - 1 && s >= weight[i]) s -= weight[i++];
  const side = SIDES[i];
  const f = s / weight[i];
  // Sizes as the camera sees them at this seat's depth.
  const r = seenRadius(b);
  const open = free[side] > OPEN_ROOM;
  const inner = open ? -0.35 * r : 0;
  // On a side with room the farthest seats leave about a third of the bubble past the screen's edge; on a thin one
  // the middle may pass it, since the slice that shows is the one next to the card.
  const outer = Math.max(inner, room[side] + (open ? -0.35 : 0.25) * r);
  const m = inner + (outer - inner) * b.depth;
  if (side === "top") out.set(box.left - r + f * (across + 2 * r), box.top + m + l, 0);
  else if (side === "bottom") out.set(box.right + r - f * (across + 2 * r), box.bottom - m - l, 0);
  else if (side === "right") out.set(box.right + m + l, box.top - f * down, 0);
  else out.set(box.left - m - l, box.bottom + f * down, 0);
}

// A bubble without a seat waits behind the card, its home pulled inside the card's edges, and comes back out when
// the front returns.
function waitSeat(b: Ball, { box }: Layout, out: Vector3) {
  const r = seenRadius(b);
  out.set(Math.max(box.left + r, Math.min(box.right - r, b.home.x)), Math.max(box.bottom + r, Math.min(box.top - r, b.home.y)), 0);
}
