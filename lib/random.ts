// Small seeded generator (the mockup's LCG), so the scene draws the same bubbles on every visit.
export function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
