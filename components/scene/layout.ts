// Where the bubbles go, in world units at z = 0, from the card's real size and position on screen.
import { MathUtils, Vector3 } from "three";
import { seeded } from "../../lib/random.ts";

export const CAM_Z = 20;
export const FOV = 35;
export const HALF_H = Math.tan(MathUtils.degToRad(FOV / 2)) * CAM_Z;
// A side needs this much room to hold a small bubble clear of the card; less, and the frame leaves it empty.
export const OPEN_ROOM = 0.65;
const STRIP_GAP = 0.35; // how much of a strip the bubbles leave clear when they are sized for it
const R_MAX = 0.78; // the largest bubble's radius at scale 1 (see makeBalls)
const NEAR = CAM_Z / (CAM_Z - 0.5); // how much bigger the nearest seats look
// Under this the rings read as dots, not bubbles. A strip thinner than that (a short phone upright) keeps the bubbles
// at this size; they sit partly behind the card and past the screen's edge instead (see freeSeat in ./frame).
const MIN_STRIP_SCALE = 0.7;
// Where the frame is a strip, the room around the card is a thin margin or two, and the 44 or 64 bubbles the quality
// tiers draw crowded it. It gets STRIP_BUBBLES, and STRIP_SEATS of them frame the back while the rest wait behind
// the card. With 12 seats on a phone upright, the strips are about as full as the ring around the card on a desktop.
export const STRIP_BUBBLES = 24;
export const STRIP_SEATS = 12;

export type Box = { left: number; right: number; top: number; bottom: number };
export type Side = "top" | "right" | "bottom" | "left";
// around: the crowd circles the card (desktop). strip: the screen leaves room on one or two sides only (phones,
// tablets, short landscape screens), with fewer bubbles, and the back's frame loosens to all four sides (see ./frame).
export type FrameShape = "around" | "strip";
// room: from each edge of the card to the edge of the screen, in world units. free: the same, less the row the flip
// button takes under the card; it decides which sides the frame uses.
export type Layout = { halfW: number; box: Box; room: Record<Side, number>; free: Record<Side, number>; scale: number; shape: FrameShape };
export type View = { width: number; height: number };
// below: the height the flip button takes under the card, its gap included, in px.
export type CardRect = { x: number; y: number; w: number; h: number; below?: number };

export function computeLayout(view: View, card: CardRect): Layout {
  const unit = (2 * HALF_H) / view.height;
  const halfW = HALF_H * (view.width / view.height);
  const box = {
    left: (card.x - view.width / 2) * unit,
    right: (card.x + card.w - view.width / 2) * unit,
    top: -(card.y - view.height / 2) * unit,
    bottom: -(card.y + card.h - view.height / 2) * unit,
  };
  const room = { top: HALF_H - box.top, right: halfW - box.right, bottom: box.bottom + HALF_H, left: box.left + halfW };
  // Bubbles may pass behind the flip button, but its row is no side to frame the card from. On a phone on its side,
  // counting it would turn the side strips into a ring and hide most of the front's bubbles behind the card.
  const free = { ...room, bottom: room.bottom - (card.below ?? 0) * unit };
  const open = Object.values(free).filter((r) => r > OPEN_ROOM).length;
  // Rings need a few cells per bubble to read as bubbles, so small screens keep them as big as the thinnest strip
  // holds, up to 0.8 and never under MIN_STRIP_SCALE.
  if (open < 3) {
    const thinnest = Math.min(...Object.values(free).filter((r) => r > OPEN_ROOM));
    const fits = (thinnest - STRIP_GAP) / (2 * R_MAX * NEAR);
    return { halfW, box, room, free, scale: Math.max(MIN_STRIP_SCALE, Math.min(0.8, fits)), shape: "strip" };
  }
  const side = Math.min(room.left, room.right);
  return { halfW, box, room, free, scale: side > 2.2 ? Math.min(1, side / 4.2) : 0.7, shape: "around" };
}

export type Ball = {
  r: number;
  home: Vector3; // front: where it drifts around
  phase: number;
  seated: boolean; // back: whether it takes a seat in the frame, or waits behind the card
  slot: number; // back: its seat around the card, 0..1
  depth: number; // back: 0 near the card and forward, 1 far and deep
};

// How many bubbles a layout gets out of the `tier` the quality allows.
export const bubbleCount = (layout: Layout, tier: number) => (layout.shape === "strip" ? Math.min(tier, STRIP_BUBBLES) : tier);

// The bubbles scatter over the whole view, small ones more often. On a phone the card covers most of it, so many
// start behind the card, where the headline's cut-out line shows them drift past. Their seats around the card come in
// shuffled order (sizes mix), each nudged along the edge; bigger ones lean a bit further back.
export function makeBalls(layout: Layout, count: number): Ball[] {
  const r0 = seeded(7);
  const balls: Ball[] = [];
  while (balls.length < count) {
    const r = (0.18 + Math.pow(r0(), 2) * 0.6) * layout.scale;
    const home = new Vector3((r0() - 0.5) * 2 * layout.halfW * 0.95, (r0() - 0.5) * 2 * HALF_H * 0.95, -3 + r0() * 4);
    balls.push({ r, home, phase: r0() * Math.PI * 2, seated: true, slot: 0, depth: 0 });
  }
  const sorted = balls.map((b) => b.r).sort((x, y) => x - y);
  const r2 = seeded(5);
  const order = balls.map((_, i) => i);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(r2() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  // Where the frame is a strip, only the first STRIP_SEATS in that order take a seat.
  const seats = layout.shape === "strip" ? Math.min(STRIP_SEATS, count) : count;
  order.forEach((idx, k) => {
    const b = balls[idx];
    const sizeRank = sorted.indexOf(b.r) / Math.max(1, sorted.length - 1);
    b.seated = k < seats;
    if (b.seated) b.slot = (k + 0.5 + (r2() - 0.5) * 0.9) / seats;
    b.depth = MathUtils.clamp(0.65 * r2() + 0.35 * sizeRank, 0, 1);
  });
  return balls;
}
