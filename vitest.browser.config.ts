/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "browser",
    include: ["src/**/*.browser.test.ts"],
    testTimeout: 30_000,
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }, { browser: "webkit" }],
    },
  },
});
