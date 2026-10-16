import path from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    name: "browser",
    include: ["src/**/*.browser.test.ts"],
    testTimeout: 30_000,
    // One browser at a time. Chromium and WebKit both drawing 1080p canvases
    // in parallel aborts the WebKit process on a smaller CI runner.
    fileParallelism: false,
    maxWorkers: 1,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }, { browser: "webkit" }],
    },
  },
});
