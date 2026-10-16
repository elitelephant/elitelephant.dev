import { test, expect, type Page } from "@playwright/test";
import { expectAngle, moveAway, text, turnOver } from "./helpers";

// Headless WebKit draws the turned card in software at about 10 fps, so the spring takes several seconds to settle.
const SLOW = 30_000;

const style = (page: Page, selector: string, prop: "opacity" | "backgroundColor") =>
  page.locator(selector).evaluate((el, p) => getComputedStyle(el)[p], prop);

// WebKit ignores backface-visibility, even on a bare two-face card, and shows the other face mirrored through.
test("only the face looking at you can be seen", async ({ page }, testInfo) => {
  await page.goto("/?quality=low");
  expect(await style(page, "#front", "opacity")).toBe("1");
  expect(await style(page, "#back", "opacity")).toBe("0");
  await testInfo.attach("front", { body: await page.screenshot(), contentType: "image/png" });

  await page.getByRole("button", { name: text.flip }).click();
  await moveAway(page);
  await expectAngle(page, 180, SLOW);
  expect(await style(page, "#front", "opacity")).toBe("0");
  expect(await style(page, "#back", "opacity")).toBe("1");
  await testInfo.attach("back", { body: await page.screenshot(), contentType: "image/png" });

  await page.keyboard.press("Escape");
  await expect.poll(() => style(page, "#front", "opacity"), { timeout: SLOW }).toBe("1");
  expect(await style(page, "#back", "opacity")).toBe("0");
});

test("on a phone the back is as dark and opaque as the front", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?quality=low");
  expect(await style(page, "#front", "backgroundColor")).toBe("rgb(11, 16, 14)");
  expect(await style(page, "#back", "backgroundColor")).toBe("rgb(11, 16, 14)");
});

test.describe("the Back button", () => {
  test.use({ reducedMotion: "reduce" });

  // 390x664 is an iPhone 13 with Safari's bars showing; 390x844, the same phone with them hidden.
  for (const [width, height] of [[320, 568], [390, 664], [390, 844], [844, 390]] as const) {
    test(`covers no panel text at ${width}x${height}, at either end of each panel`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/?quality=low");
      await turnOver(page);
      const covered = await page.evaluate(async () => {
        const box = document.querySelector<HTMLElement>("#panels")!;
        const button = document.querySelector('[data-flip="back"]')!.getBoundingClientRect();
        box.style.scrollSnapType = "none"; // exact scroll positions; snapping is not what this checks
        const settle = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const found: string[] = [];
        for (const panel of box.querySelectorAll<HTMLElement>(".panel")) {
          for (const top of new Set([panel.offsetTop, panel.offsetTop + panel.offsetHeight - box.clientHeight])) {
            box.scrollTop = top;
            await settle();
            const view = box.getBoundingClientRect();
            const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const line of range.getClientRects()) {
                // The part of the line the scrolling box lets through.
                const lineTop = Math.max(line.top, view.top);
                const lineBottom = Math.min(line.bottom, view.bottom);
                if (lineBottom <= lineTop) continue;
                const under = lineBottom > button.top && lineTop < button.bottom && line.right > button.left && line.left < button.right;
                if (under) found.push(`${panel.id} at ${Math.round(top)}: "${node.textContent.trim().slice(0, 40)}"`);
              }
            }
          }
        }
        return found;
      });
      expect(covered).toEqual([]);
    });
  }
});
