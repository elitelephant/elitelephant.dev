import { defineConfig, devices } from "@playwright/test";

// The e2e suite runs against the production build (`next start`), never the dev server.
const PORT = 3100;
const SCENE = /scene\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}` },
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
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
