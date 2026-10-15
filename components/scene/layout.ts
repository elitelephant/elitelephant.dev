// Where the bubbles go, in world units at z = 0, from the card's real size and position on screen.
import { MathUtils, Vector3 } from "three";
import { seeded } from "../../lib/random.ts";

export const CAM_Z = 20;
export const FOV = 35;
export const HALF_H = Math.tan(MathUtils.degToRad(FOV / 2)) * CAM_Z;

export type Box = { left: number; right: number; top: number; bottom: number };
// around: the crowd circles the card (desktop). top: phones in portrait, where the free room is the strip
// above the card. sides: short landscape screens, with no room above or below.
export type FrameShape = "around" | "top" | "sides";
export type Layout = { halfW: number; box: Box; scale: number; shape: FrameShape };
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
  const side = Math.min(box.left + halfW, halfW - box.right);
  const above = HALF_H - box.top;
  const below = box.bottom + HALF_H;
  // Rings need a few cells per bubble to read as bubbles, so phones keep them fairly big.
  if (above > side && below < above / 2) return { halfW, box, scale: 0.8, shape: "top" };
  const shape = Math.min(above, below) < 1 ? "sides" : "around";
  return { halfW, box, scale: side > 2.2 ? Math.min(1, side / 4.2) : 0.7, shape };
}

export type Ball = {
  r: number;
  home: Vector3; // front: where it drifts around
  phase: number;
  slot: number; // back: its seat around the card, 0..1
  depth: number; // back: 0 near the card and forward, 1 far and deep
};

// The mockup's bubbles: scattered over the whole view, small ones more often. Their seats around the card
// come in shuffled order (sizes mix), each nudged along the edge; bigger ones lean a bit further back.
export function makeBalls(layout: Layout, count: number): Ball[] {
  const r0 = seeded(7);
  const balls: Ball[] = [];
  while (balls.length < count) {
    const r = (0.18 + Math.pow(r0(), 2) * 0.6) * layout.scale;
    const home = new Vector3((r0() - 0.5) * 2 * layout.halfW * 0.95, (r0() - 0.5) * 2 * HALF_H * 0.95, -3 + r0() * 4);
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
