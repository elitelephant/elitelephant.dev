import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { site } from "../../content/site";

// Names the tests find things by. They come from the site's copy, so a text edit doesn't break the tests.
export const text = {
  flip: site.front.flip,
  flipBack: site.back.flipLabel,
  dots: site.back.dotsLabel,
  // One per dot: the three panels and "Say hi".
  labels: [...site.back.panels.map((p) => p.label), site.back.sayHi.label],
};

// The back's dot for panel `index`, in the order of text.labels.
export const dot = (page: Page, index: number) => page.getByRole("list", { name: text.dots }).getByRole("button", { name: text.labels[index] });

// What axe finds, one line per rule with the elements it hit, so a failure names them.
export const axeViolations = async (page: Page) =>
  (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);

// The page's uncaught errors and console errors, from now on.
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

// Turns the card with the front button and waits until the back is the visible face, at rest.
export async function turnOver(page: Page) {
  await page.getByRole("button", { name: text.flip }).click();
  await moveAway(page);
  await expect(page.locator("#back")).not.toHaveAttribute("inert");
  await expectAngle(page, 180);
}

// With a mouse over the card, the hover tilt adds up to 3.5° to the angle; move it off to read the turn alone.
export async function moveAway(page: Page) {
  await page.mouse.move(1, 1);
}

// The card's turn (rotateY) and hover tilt (rotateX), in degrees, as last drawn.
export async function cardTransform(page: Page) {
  return page.locator("#card").evaluate((el) => {
    const t = (el as HTMLElement).style.transform;
    const read = (axis: string) => Number(new RegExp(`rotate${axis}\\((-?[\\d.]+)deg\\)`).exec(t)?.[1] ?? 0);
    return { angle: read("Y"), tilt: read("X") };
  });
}

export async function cardAngle(page: Page) {
  return (await cardTransform(page)).angle;
}

// Waits until the card has stopped at `angle`. The spring overshoots, so passing through it is not enough.
// Clicking a moving card can press on one element and release on another. At rest the spring snaps to the exact
// angle, which also tells "stopped" apart from two reads within one slow frame. Without a timeout it waits as long as
// the project's expect timeout, which is longer for WebKit, since it draws in software.
export async function expectAngle(page: Page, angle: number, timeout?: number) {
  let last = NaN;
  await expect
    .poll(async () => {
      const now = await cardAngle(page);
      const still = now === last;
      last = now;
      return still ? now : NaN;
    }, { intervals: [80], timeout })
    .toBe(angle);
}

// Index of the panel at the top of the panels box, once scrolling has stopped.
export async function panelAtTop(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const top = await page.locator("#panels").evaluate((el) => el.scrollTop);
      const settled = top === last;
      last = top;
      return settled;
    }, { intervals: [120] })
    .toBe(true);
  return page.locator("#panels").evaluate((box) => {
    const panels = [...box.querySelectorAll<HTMLElement>(".panel")];
    return panels.findLastIndex((p) => p.offsetTop <= box.scrollTop + 2);
  });
}

// Loads `url` with ?debug and waits for the panel it shows once the page has picked its tier. Until then the tier
// is undecided, so checking for "no scene" any earlier would pass for the wrong reason.
export async function loadWithTier(page: Page, url: string, tier: "high" | "medium" | "low") {
  await page.goto(url + (url.includes("?") ? "&debug" : "?debug"));
  await expect(page.locator(".debug")).toHaveText(new RegExp(`^${tier}\\b`), { timeout: 15_000 });
}

// How much the static rings show (the body's ::before): 1 once a page stays without the scene, 0 while it has one.
export const ringsShown = (page: Page) => page.evaluate(() => Number(getComputedStyle(document.body, "::before").opacity));

// Sets the browser's default text size, as a reader does in the settings (and Chrome on Android does from the
// system's, given the text-scale meta tag). Call it before loading the page. It goes through Chromium's DevTools
// protocol, so in other browsers the test is skipped.
export async function setTextSize(page: Page, px: number) {
  test.skip(page.context().browser()?.browserType().name() !== "chromium", "Only Chromium lets a test set the browser's text size.");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px, fixed: 13 } });
}

// three.js marks the window when it loads, so without the mark the 3D chunk was never downloaded.
export const threeLoaded = (page: Page) => page.evaluate(() => "__THREE__" in window);
