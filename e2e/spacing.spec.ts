import { expect, test, type Page } from "@playwright/test";
import { PHOTO_FILE, blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

for (const path of ["/terms", "/privacy"]) {
  test(`${path} keeps the original legal page spacing`, async ({ page }) => {
    await blockAnalytics(page);
    await page.goto(path);
    const app = page.locator(".app.privacy-app");
    // 既定の 16px/rem で、トップ・pick のスケールを導入する前の値を守る。
    const spacing = await app.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        paddingTop: parseFloat(style.paddingTop),
        paddingBottom: parseFloat(style.paddingBottom),
        gap: parseFloat(style.gap),
      };
    });
    // WebKit はレイアウト単位（1/64px）で丸めるので、小数第1位まで比べる。
    expect(spacing.paddingTop).toBeCloseTo(29.6, 1);
    expect(spacing.paddingBottom).toBeCloseTo(60.8, 1);
    expect(spacing.gap).toBeCloseTo(37.6, 1);
  });
}

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

async function expectSharedPageSpacing(page: Page) {
  await expect(page.locator(".app")).toHaveCSS("padding-top", "32px");
  await expect(page.locator(".app")).toHaveCSS("padding-bottom", "64px");
  await expect(page.locator(".app")).toHaveCSS("gap", "48px");
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
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
        await expectSharedPageSpacing(page);
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
        await expectSharedPageSpacing(page);
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

    test("switching from pick to edit restores the compact editor spacing", async ({ page }) => {
      await page.goto("/make");
      await waitForAppReady(page);
      const studio = page.locator("#studioView");
      const top = studio.locator(".studio-top");
      await expect(studio).toHaveAttribute("data-phase", "pick");
      await expect(studio).toHaveCSS("gap", "32px");
      await expect(top).toHaveCSS("display", "flex");
      await expect(top).toHaveCSS("gap", "16px");

      await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
      await expect(studio).toHaveAttribute("data-phase", "edit");
      // 写真投入前の pick 指定が残らないことを、既存 edit の実測値で固定する。
      await expect(studio).toHaveCSS("gap", "0px");
      await expect(top).toHaveCSS("display", "block");
      await expect(top).toHaveCSS("gap", "normal");
      await expect(top).toHaveCSS("position", "absolute");
      await expect(page.locator(".app")).toHaveCSS("padding-top", viewport.width >= 640 ? "16px" : "0px");
      await expect(page.locator(".app")).toHaveCSS("padding-bottom", "0px");
    });
  });
}
