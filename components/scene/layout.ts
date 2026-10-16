// Where the bubbles go, in world units at z = 0, from the card's real size and position on screen.
import { MathUtils, Vector3 } from "three";
import { seeded } from "../../lib/random.ts";

export const CAM_Z = 20;
export const FOV = 35;
export const HALF_H = Math.tan(MathUtils.degToRad(FOV / 2)) * CAM_Z;
// A side needs this much room to hold a small bubble clear of the card; less, and the frame leaves it empty.
export const OPEN_ROOM = 0.65;
export const STRIP_GAP = 0.35; // in a strip, the nearest a bubble sits to the card
const R_MAX = 0.78; // the largest bubble's radius at scale 1 (see makeBalls)
const NEAR = CAM_Z / (CAM_Z - 0.5); // how much bigger the nearest seats look

export type Box = { left: number; right: number; top: number; bottom: number };
export type Side = "top" | "right" | "bottom" | "left";
// around: the crowd circles the card (desktop). strip: the screen leaves room on one or two sides only (phones,
// tablets, short landscape screens), and the crowd fills that room instead of sitting behind the card or off screen.
export type FrameShape = "around" | "strip";
// room: from each edge of the card to the edge of the screen, in world units.
export type Layout = { halfW: number; box: Box; room: Record<Side, number>; scale: number; shape: FrameShape };
export type View = { width: number; height: number };
export type CardRect = { x: number; y: number; w: number; h: number };

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
  const open = Object.values(room).filter((r) => r > OPEN_ROOM).length;
  // Rings need a few cells per bubble to read as bubbles, so small screens keep them fairly big, as long as the
  // largest one still fits the thinnest strip.
  if (open < 3) {
    const thinnest = Math.min(...Object.values(room).filter((r) => r > OPEN_ROOM));
    return { halfW, box, room, scale: Math.min(0.8, (thinnest - STRIP_GAP) / (2 * R_MAX * NEAR)), shape: "strip" };
  }
  const side = Math.min(room.left, room.right);
  return { halfW, box, room, scale: side > 2.2 ? Math.min(1, side / 4.2) : 0.7, shape: "around" };
}

export type Ball = {
  r: number;
  home: Vector3; // front: where it drifts around
  phase: number;
  slot: number; // back: its seat around the card, 0..1
  depth: number; // back: 0 near the card and forward, 1 far and deep
};

// The bubbles: scattered over the whole view, small ones more often. Their seats around the card
// come in shuffled order (sizes mix), each nudged along the edge; bigger ones lean a bit further back.
// Whether a bubble at `p`, seen from the camera, overlaps the card.
function behindCard(box: Box, p: Vector3, r: number) {
  const k = CAM_Z / (CAM_Z - p.z);
  return p.x * k > box.left - r && p.x * k < box.right + r && p.y * k < box.top + r && p.y * k > box.bottom - r;
}

export function makeBalls(layout: Layout, count: number): Ball[] {
  const r0 = seeded(7);
  const balls: Ball[] = [];
  while (balls.length < count) {
    const r = (0.18 + Math.pow(r0(), 2) * 0.6) * layout.scale;
    let home = new Vector3((r0() - 0.5) * 2 * layout.halfW * 0.95, (r0() - 0.5) * 2 * HALF_H * 0.95, -3 + r0() * 4);
    // When the card leaves room on one or two sides only, most homes would sit behind it: keep one in ten there and
    // draw the rest again (up to 12 times), so the front shows its bubbles too.
    for (let tries = 0; layout.shape === "strip" && tries < 12 && behindCard(layout.box, home, r) && r0() >= 0.1; tries++) {
      home = new Vector3((r0() - 0.5) * 2 * layout.halfW * 0.95, (r0() - 0.5) * 2 * HALF_H * 0.95, -3 + r0() * 4);
    }
    balls.push({ r, home, phase: r0() * Math.PI * 2, slot: 0, depth: 0 });
  }
  const sorted = balls.map((b) => b.r).sort((x, y) => x - y);
  const r2 = seeded(5);
  const order = balls.map((_, i) => i);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(r2() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  order.forEach((idx, k) => {
    const b = balls[idx];
    const sizeRank = sorted.indexOf(b.r) / Math.max(1, sorted.length - 1);
    b.slot = (k + 0.5 + (r2() - 0.5) * 0.9) / order.length;
    b.depth = MathUtils.clamp(0.65 * r2() + 0.35 * sizeRank, 0, 1);
  });
  return balls;
}
