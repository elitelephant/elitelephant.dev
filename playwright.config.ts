import { defineConfig, devices } from "@playwright/test";

// The e2e suite runs against the production build (`next start`), never the dev server.
const PORT = 3100;
const SCENE = /scene\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
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
    // Safari's engine on an iPhone, for what WebKit renders its own way: the card's faces.
    { name: "webkit", testMatch: /faces\.spec\.ts/, use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
