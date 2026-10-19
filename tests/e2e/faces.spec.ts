import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { expectAngle, moveAway, text } from "./helpers";

// Headless WebKit draws the turned card in software at about 10 fps, so the spring takes several seconds to settle.
const SLOW = 30_000;

const style = (page: Page, selector: string, prop: "opacity" | "backgroundColor" | "backgroundImage") =>
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

// Both faces are the same card stock, painted in the card's colour: on a phone the back is no lighter or clearer.
test("on a phone the back is the same card stock as the front", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?quality=low");
  const front = await style(page, "#front", "backgroundImage");
  expect(front).toContain("%230b100e");
  expect(await style(page, "#back", "backgroundImage")).toBe(front);
});

// The flip button stays under the card while it turns. Its label switches with the face, edge-on, where neither face
// can be seen; its name switches on the click, since focus may land on it while the card is still heading back.
test("the flip button's label follows the face, and its name the click", async ({ page }) => {
  await page.goto("/?quality=low");
  const button = page.locator("[data-flip]");
  await expect(button).toHaveText(site.front.flip, { useInnerText: true });
  await expect(button).toHaveAccessibleName(site.front.flip);

  // Every frame of the turn: the angle drawn, the label shown and the button's name, read together.
  const frames = await page.evaluate(() => new Promise<[number, string, string | null][]>((done) => {
    const card = document.getElementById("card")!;
    const button = document.querySelector<HTMLElement>("[data-flip]")!;
    const frames: [number, string, string | null][] = [];
    button.click();
    const read = () => {
      const angle = Number(/rotateY\((-?[\d.]+)deg\)/.exec(card.style.transform)?.[1] ?? 0);
      frames.push([angle, button.innerText.trim(), button.getAttribute("aria-label")]);
      if (angle < 170 && frames.length < 300) requestAnimationFrame(read);
      else done(frames);
    };
    requestAnimationFrame(read);
  }));
  expect(frames.some(([angle]) => angle > 0 && angle < 89.5), "frames before edge-on").toBe(true);
  expect(frames.some(([angle]) => angle > 90.5), "frames after edge-on").toBe(true);
  for (const [angle, label, name] of frames) {
    if (Math.abs(angle - 90) < 0.5) continue; // the label switches on the exact angle; the transform shows it rounded
    expect(label, `label at ${angle}°`).toBe(angle < 90 ? site.front.flip : site.back.flip);
    expect(name, `name at ${angle}°`).toBe(site.back.flipLabel);
  }

  await moveAway(page);
  await expectAngle(page, 180, SLOW);
  await expect(button).toHaveText(site.back.flip, { useInnerText: true });
  await page.keyboard.press("Escape");
  await expect(button).toHaveAccessibleName(site.front.flip);
  await expectAngle(page, 0, SLOW);
  await expect(button).toHaveText(site.front.flip, { useInnerText: true });
});
