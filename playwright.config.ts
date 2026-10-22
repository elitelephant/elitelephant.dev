import { defineConfig, devices } from "@playwright/test";

// The e2e suite runs against the production build (`next start`), never the dev server.
const PORT = 3100;
const SCENE = /scene\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Four at a time on a developer's machine. With six, the browsers starting together (WebKit's among them) can leave
  // Chromium unable to take a screenshot, and the scene, which runs in series, takes as long either way. CI keeps
  // Playwright's default, half the cores.
  workers: process.env.CI ? undefined : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that passes only on its retry is unreliable, and fails the run.
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // A test that fails in CI runs again with a trace, so there is something to open when it fails twice.
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    // Everything that works without WebGL.
    { name: "chromium", testIgnore: SCENE, use: { ...devices["Desktop Chrome"] } },
    // The 3D scene, on a GPU emulated by SwiftShader, with the quality forced in the URL.
    {
      name: "chromium-gl",
      testMatch: SCENE,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
      },
    },
    // Safari's engine on an iPhone, for everything but the scene. Headless WebKit draws in software, so it renders at
    // 1x (a turn at 3x takes about 5 s) and gets longer waits, and what these tests check doesn't depend on the pixel
    // ratio. Its screenshots aren't compared, since the pixels WebKit draws its own way (the faces, the headline's cut,
    // the paper's contrast) are checked in faces.spec.ts and a11y.spec.ts. Two at a time, as a WebKit page takes about
    // 0.7 GB of memory.
    {
      name: "webkit",
      testIgnore: SCENE,
      use: { ...devices["iPhone 13"], deviceScaleFactor: 1 },
      ignoreSnapshots: true,
      timeout: 60_000,
      expect: { timeout: 15_000 },
      workers: 2,
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
