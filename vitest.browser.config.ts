import path from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

// Vitest 4.1 clones every browser.instances entry into its own project and
// starts those projects with Promise.all when the provider supports
// parallelism. fileParallelism and maxWorkers only cap workers inside one
// browser, so Chromium and WebKit have to be separate processes.
const browser = process.env.ANONE_BROWSER;
if (browser !== "chromium" && browser !== "webkit") {
  throw new Error(
    "Set ANONE_BROWSER to chromium or webkit. pnpm test:browser runs them one after another.",
  );
}

export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    name: "browser",
    include: ["src/**/*.browser.test.ts"],
    testTimeout: 30_000,
    // One file at a time inside this browser, so 1080p canvases do not overlap.
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser }],
    },
  },
});
