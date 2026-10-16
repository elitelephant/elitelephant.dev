// Where the CSS puts the card at a few screen sizes, as the scene reads it (offsetLeft, offsetTop, offsetWidth,
// offsetHeight). The scene's unit tests lay the bubbles out around these; tests/e2e/layout.spec.ts checks them
// against the real page, so a CSS change can't leave them stale.
export const CARDS = {
  desktop: { view: { width: 1280, height: 800 }, card: { x: 250, y: 172, w: 780, h: 456 } },
  smallDesktop: { view: { width: 1024, height: 768 }, card: { x: 122, y: 156, w: 780, h: 456 } },
  tablet: { view: { width: 768, height: 1024 }, card: { x: 16, y: 284, w: 736, h: 456 } },
  phone: { view: { width: 390, height: 844 }, card: { x: 27, y: 152, w: 335, h: 540 } },
  smallPhone: { view: { width: 320, height: 568 }, card: { x: 22, y: 64, w: 275, h: 440 } },
  landscape: { view: { width: 667, height: 375 }, card: { x: 107, y: 16, w: 454, h: 343 } },
} as const;
