import { expect, test, type Page } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

// 固定の最低間隔で、トークン自体を縮めた場合の詰めすぎも検出する。
async function expectVerticalGaps(page: Page, selectors: string[], minimums: number[]) {
  const boxes = await page.evaluate((selectors) => selectors.map((selector) => {
    const { top, bottom } = document.querySelector(selector)!.getBoundingClientRect();
    return { top, bottom };
  }), selectors);
  minimums.forEach((minimum, index) => {
    expect(boxes[index + 1].top - boxes[index].bottom,
      `${selectors[index]} → ${selectors[index + 1]}`).toBeGreaterThanOrEqual(minimum - 0.5);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`vertical rhythm at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: "reduce" });
    test.beforeEach(async ({ page }) => {
      await blockAnalytics(page);
      await stubShortTemplate(page);
    });

    for (const locale of ["ja", "en", "ko", "zh"]) {
      const base = locale === "ja" ? "" : `/${locale}`;

      test(`${locale} landing leaves room around the loop and both CTAs`, async ({ page }) => {
        await page.goto(base || "/");
        await waitForAppReady(page);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("#makerView .hero .lang-switch")).toHaveCount(0);
        await expect(page.locator("#makerView .lang-switch")).toHaveCount(1);
        await expect(page.locator("#makerView .notes .lang-switch")).toHaveCount(1);
        await expectVerticalGaps(page, [
          "#makerTitle .hero-logo", ".loop-link", "#toStudio", "#toCommunity",
          "#landingHashtags", "#makerView .notes",
        ], [16, 38, 32, 24, 48]);
        // ループの下は傾き込みで 38px 以上（影 14px ＋空き 24px）。
        await expect(page.locator("#toStudio")).toBeInViewport({ ratio: 1 });
      });

      test(`${locale} pick spaces the heading, picker, preview and final languages in order`, async ({ page }) => {
        await page.goto(`${base}/make`);
        await waitForAppReady(page);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "pick");
        await expect(page.locator("#studioView .lang-switch")).toHaveCount(1);
        await expect(page.locator("#studioView .lang-switch")).toHaveCSS("order", "3");
        await expectVerticalGaps(page, [
          "#studioHome", "#studioTitle", "#onDeviceNote", "#studioView .file-btn",
          "#pickHint", "#stage", "#studioView .lang-switch",
        ], [16, 16, 32, 16, 32, 32]);
        await expect(page.locator("#studioView .file-btn")).toBeInViewport({ ratio: 1 });
      });
    }
  });
}
