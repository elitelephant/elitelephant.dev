import { test, expect, type Page } from "@playwright/test";
import { site } from "../../content/site";
import { expectAngle, moveAway, text } from "./helpers";

// Headless WebKit draws in software, so its waits get plenty of time.
const SLOW = 30_000;

const style = (page: Page, selector: string, prop: "opacity" | "backgroundColor" | "backgroundImage") =>
  page.locator(selector).evaluate((el, p) => getComputedStyle(el)[p], prop);

test.describe("turning the card", () => {
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

  // The flip button stays under the card while it turns. Its label switches with the face, edge-on, where neither face
  // can be seen; its name switches on the click, since focus may land on it while the card is still heading back.
  test("the flip button's label follows the face, and its name the click", async ({ page }) => {
    await page.goto("/?quality=low");
    const button = page.locator("[data-flip]");
    await expect(button).toHaveText(site.front.flip, { useInnerText: true });
    await expect(button).toHaveAccessibleName(site.front.flip);
    // The click below comes straight from the page. React replays a click that arrives before it hydrates, and the
    // frames read until then would show the card at rest with its old name.
    await expect(page.locator("#card")).toHaveAttribute("data-ready", "");

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
});

// Both faces are the same card stock, painted in the card's colour, so on a phone the back is no lighter or clearer.
// Once the headline's line is cut out of it, the front's paper is a layer under its text.
test("on a phone the back is the same card stock as the front", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?quality=low");
  await expect(page.locator("#front")).toHaveAttribute("data-cut", "", { timeout: SLOW });
  const front = await page.locator("#front").evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
  expect(front).toContain("%230b100e");
  expect(await style(page, "#back", "backgroundImage")).toBe(front);
});

// The colour drawn at a point of the page, in CSS pixels, read from the middle device pixel of a one-pixel screenshot.
async function colorAt(page: Page, x: number, y: number) {
  const png = (await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })).toString("base64");
  return page.evaluate(async (png) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    // A plain canvas, since WebKit on Windows has no OffscreenCanvas.
    const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const [r, g, b] = context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
    return { r, g, b };
  }, png);
}

// The middle of a letter's box. For an I or an l that is inside its stem.
const letterAt = (page: Page, selector: string, letter: string) => page.locator(selector).evaluate((el, letter) => {
  const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.includes(letter))!;
  const range = document.createRange();
  const i = node.textContent!.indexOf(letter);
  range.setStart(node, i);
  range.setEnd(node, i + 1);
  const r = range.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, letter);

const red = (c: { r: number; g: number; b: number }) => c.r > 200 && c.g < 70 && c.b < 70;
const white = (c: { r: number; g: number; b: number }) => c.r > 200 && c.g > 200 && c.b > 200;

// The mask is drawn at the screen's pixel ratio, up to 2x, so the cut is checked at an iPhone's 3x.
test.describe("the headline's cut", () => {
  test.use({ deviceScaleFactor: 3 });

  // The headline's second line is cut out of the card's paper, so the page and its bubbles show through its letters;
  // the first line stays white on the card. The page is painted red here, so what shows through can't be mistaken for
  // the line's own mint.
  test("the headline's second line is cut out of the card, and the first stays on it", async ({ page }) => {
    await page.goto("/?quality=low");
    await expect(page.locator("#front")).toHaveAttribute("data-cut", "", { timeout: SLOW });
    await page.addStyleTag({ content: "body { background: #f00 !important } body::before { display: none !important }" });
    const stem = await letterAt(page, "#front h1 .now", "l");
    expect(red(await colorAt(page, stem.x, stem.y)), "the page through the l of building").toBe(true);
    const first = await letterAt(page, "#front h1", "I");
    expect(white(await colorAt(page, first.x, first.y)), "the I of the first line").toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${site.front.watching} ${site.front.building}`);
  });

  // The letters are cut where the browser lays them out, so a change of size (the window, the text) cuts them again.
  test("the cut follows the headline when the window changes size", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?quality=low");
    await expect(page.locator("#front")).toHaveAttribute("data-cut", "", { timeout: SLOW });
    await page.addStyleTag({ content: "body { background: #f00 !important } body::before { display: none !important }" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => {
      const stem = await letterAt(page, "#front h1 .now", "l");
      return red(await colorAt(page, stem.x, stem.y));
    }, { message: "the page through the l of building, at the new size", timeout: SLOW }).toBe(true);
  });
});
