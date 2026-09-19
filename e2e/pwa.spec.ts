import { expect, test } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("PWA installability", () => {
  test.use({ serviceWorkers: "allow" });

  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("links a manifest, icons, and a controlling service worker", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      "content",
      "yes",
    );
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/icons/apple-touch-icon.png",
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      "content",
      "あのねジャンプ",
    );

    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      display: string;
      start_url: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png")).toBe(
      true,
    );
    expect(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png")).toBe(
      true,
    );

    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(icon.src);
      expect(iconResponse.ok(), icon.src).toBe(true);
      expect(iconResponse.headers()["content-type"]).toMatch(/image\/png/);
    }

    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return Boolean(registration.active);
        }),
      )
      .toBe(true);
  });

  test("keeps the same install tags on a prefixed locale", async ({ page }) => {
    await page.goto("/en");
    await waitForAppReady(page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      "content",
      "Anone Jump",
    );
  });
});
