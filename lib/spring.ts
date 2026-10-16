// The card flip spring: the card turns with some weight and overshoots a little before it settles.
export const K = 140; // stiffness
export const C = 15; // damping; with K = 140 it overshoots a few degrees
export const TILT = 3.5; // max hover tilt, in degrees
const MAX_DT = 1 / 30; // a long frame never takes a bigger step than this

export type Spring = { angle: number; vel: number };

export function step(s: Spring, target: number, dt: number): Spring {
  const h = Math.min(dt, MAX_DT);
  const vel = s.vel + (K * (target - s.angle) - C * s.vel) * h;
  return { angle: s.angle + vel * h, vel };
}

export const atRest = (s: Spring, target: number) => Math.abs(target - s.angle) < 0.05 && Math.abs(s.vel) < 0.05;

// The card is edge-on at 90°. Checked by side, not by a window around 90°, so a slow frame can't jump over it.
export const pastEdge = (angle: number, target: number) => (target === 180 ? angle >= 90 : angle <= 90);
