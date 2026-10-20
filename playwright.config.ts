import { defineConfig, devices } from "@playwright/test";

const port = 4173;
// 既にビルド済みの専用 preview を指定すると、別 worktree のサーバーを参照せずに検証できる。
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // ローカルのソフトウェア描画では複数の1080pエンコーダが資源を奪い合うため直列化する。
  workers: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "ja-JP",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    video: "off",
  },
  webServer: externalBaseURL ? undefined : {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], locale: "ja-JP" },
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], locale: "ja-JP" },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], locale: "ja-JP" },
    },
    {
      name: "ios-safari",
      use: { ...devices["iPhone 13"], locale: "ja-JP" },
    },
  ],
});
