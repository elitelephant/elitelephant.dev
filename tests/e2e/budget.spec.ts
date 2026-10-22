import { test, expect, type Page } from "@playwright/test";
import { brotliCompressSync, constants } from "node:zlib";

// Weighs the JavaScript the site sends, as Brotli at its highest quality, and fails on nothing. There's no fixed
// limit yet, so the numbers are only written down, to watch them move from one change to the next.

// Every script the page asks for until the network goes quiet, keyed by URL.
async function scriptsOf(page: Page, path: string, settled: (urls: Set<string>) => boolean) {
  const urls = new Set<string>();
  page.on("response", (response) => {
    if (response.request().resourceType() === "script" && response.ok()) urls.add(response.url());
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect.poll(() => settled(urls), { timeout: 15_000 }).toBe(true);
  return urls;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

test("the JavaScript's weight, written down", async ({ page, request, browserName }) => {
  test.skip(browserName === "webkit", "The bytes a server sends are the same in every browser.");

  const weigh = async (urls: Iterable<string>) => {
    let raw = 0;
    let brotli = 0;
    for (const url of urls) {
      const body = await (await request.get(url)).body();
      raw += body.length;
      brotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
    }
    return { raw, brotli };
  };

  // What every visit loads, with the scene left out.
  const initial = await scriptsOf(page, "/?scene=0", (urls) => urls.size > 0);
  // The scene, forced on, downloads its chunk when the browser goes idle after the load. Its chunk is what's new.
  const withScene = await scriptsOf(await page.context().newPage(), "/?quality=medium&lock", (urls) =>
    [...urls].some((url) => !initial.has(url)),
  );
  const scene = [...withScene].filter((url) => !initial.has(url));

  const rows = [
    ["Initial JS (?scene=0)", initial.size, await weigh(initial)],
    ["3D chunk", scene.length, await weigh(scene)],
  ] as const;
  for (const [name, files, { raw, brotli }] of rows) {
    const line = `${name}: ${files} files, ${kb(raw)} minified, ${kb(brotli)} Brotli`;
    test.info().annotations.push({ type: "budget", description: line });
    console.log(line);
  }
});
