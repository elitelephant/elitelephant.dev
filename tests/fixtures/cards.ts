// Where the CSS puts the card at a few screen sizes, as the scene reads it: offsets summed up to the fixed stage, the
// card's offsetWidth and offsetHeight, and the row the flip button takes under it. The scene's unit tests lay the
// bubbles out around these; tests/e2e/layout.spec.ts checks them against the real page, so a CSS change can't leave
// them stale.
export const CARDS = {
  desktop: { view: { width: 1280, height: 800 }, card: { x: 250, y: 144, w: 780, h: 456, below: 56 } },
  smallDesktop: { view: { width: 1024, height: 768 }, card: { x: 122, y: 128, w: 780, h: 456, below: 56 } },
  tablet: { view: { width: 768, height: 1024 }, card: { x: 16, y: 256, w: 736, h: 456, below: 56 } },
  phone: { view: { width: 390, height: 844 }, card: { x: 27, y: 124, w: 335, h: 540, below: 56 } },
  smallPhone: { view: { width: 320, height: 568 }, card: { x: 22, y: 36, w: 275, h: 440, below: 56 } },
  landscape: { view: { width: 667, height: 375 }, card: { x: 107, y: 16, w: 454, h: 287, below: 56 } },
} as const;
