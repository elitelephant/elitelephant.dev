import { expect, type Page } from "@playwright/test";

// Turns the card with the front button and waits until the back is the visible face, at rest.
export async function turnOver(page: Page) {
  await page.getByRole("button", { name: "Who's behind this?" }).click();
  await moveAway(page);
  await expect(page.locator("#back")).not.toHaveAttribute("inert");
  await expectAngle(page, 180);
}

// With a mouse over the card, the hover tilt adds up to 3.5° to the angle; move it off to read the turn alone.
export async function moveAway(page: Page) {
  await page.mouse.move(1, 1);
}

export async function cardAngle(page: Page) {
  return page.locator("#card").evaluate((el) => {
    const m = /rotateY\((-?[\d.]+)deg\)/.exec((el as HTMLElement).style.transform);
    return m ? Number(m[1]) : 0;
  });
}

// Waits until the card has stopped at `angle`. The spring overshoots, so passing through it is not enough:
// clicking a moving card can press on one element and release on another.
export async function expectAngle(page: Page, angle: number, timeout = 5_000) {
  let last = NaN;
  await expect
    .poll(async () => {
      const now = await cardAngle(page);
      const still = now === last;
      last = now;
      return still ? now : NaN;
    }, { intervals: [80], timeout })
    .toBeCloseTo(angle, 0);
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
