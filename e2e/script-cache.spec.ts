import { expect, test } from "@playwright/test";
import { blockAnalytics, openStudio, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("script responses stay executable with the service worker", () => {
  test.use({ serviceWorkers: "allow" });

  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("does not cache an HTML body for a same-origin fetch", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.evaluate(async () => {
      await fetch("/", { cache: "no-store" });
    });

    const cachedHtml = await page.evaluate(async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const hit = await cache.match("/");
        if (!hit) continue;
        const type = hit.headers.get("content-type") ?? "";
        if (type.includes("text/html")) return type;
      }
      return null;
    });
    expect(cachedHtml).toBeNull();
  });

  test("loads a selected photo while the service worker controls the page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await waitForAppReady(page);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await openStudio(page);
    await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
    await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator("#previewSeek")).toBeEnabled({ timeout: 20_000 });
    expect(errors.filter((message) => /text\/html|mime/i.test(message))).toEqual([]);
  });
});
