import { expect, test } from "@playwright/test";
import { blockAnalytics, PHOTO_FILE, waitForAppReady } from "./helpers.ts";

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 375, height: 480 },
  { width: 812, height: 375 },
  { width: 1280, height: 480 },
];

for (const locale of ["ja", "en", "ko", "zh"]) {
  for (const viewport of viewports) {
    test(`${locale}: preview fits available width and viewport height at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await blockAnalytics(page);
      await page.goto(locale === "ja" ? "/make" : `/${locale}/make`);
      await waitForAppReady(page);
      // Reserve the preview's height even before its canvas is created lazily.
      const emptyFrame = await page.locator("#stage").boundingBox();
      expect(emptyFrame!.height).toBeGreaterThan(100);
      expect(emptyFrame!.height).toBeLessThanOrEqual(viewport.height * 0.75 + 1);
      await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
      const canvas = page.locator("#stage canvas.stage-canvas");
      await expect(canvas).toBeVisible();
      await expect(page.locator("#previewSeek")).toBeEnabled();

      for (const aspect of ["landscape", "portrait", "landscape"] as const) {
        await page.locator(`label:has(input[name="aspect"][value="${aspect}"])`).click();
        await expect(page.locator("#stage")).toHaveAttribute("data-aspect", aspect);
        await expect(canvas).toHaveAttribute("width", aspect === "landscape" ? "640" : "360");
        await expect(canvas).toHaveAttribute("height", aspect === "landscape" ? "360" : "640");
        const size = await canvas.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const frame = element.parentElement!;
          const border = getComputedStyle(frame);
          const borderX = parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth);
          const borderY = parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
          return {
            width: rect.width, height: rect.height,
            frameHeight: frame.getBoundingClientRect().height,
            available: document.querySelector(".stage-wrap")!.getBoundingClientRect().width - borderX,
            borderY,
            pageContent: document.querySelector(".studio-photos")!.getBoundingClientRect().width,
            scrollWidth: document.documentElement.scrollWidth,
          };
        });
        const ratio = aspect === "landscape" ? 16 / 9 : 9 / 16;
        expect(Math.abs(size.width - size.height * ratio)).toBeLessThan(1);
        expect(size.width).toBeLessThanOrEqual(size.available + 1);
        expect(size.scrollWidth).toBeLessThanOrEqual(viewport.width);
        const heightLimitedWidth = (viewport.height * 0.75 - size.borderY) * ratio;
        const expected = Math.min(size.available, heightLimitedWidth);
        expect(Math.abs(size.width - expected)).toBeLessThan(2);
        expect(size.frameHeight).toBeLessThanOrEqual(viewport.height * 0.75 + 1);
        // The frame must wrap the canvas exactly, without a border-sized gap.
        expect(Math.abs(size.frameHeight - size.height - size.borderY)).toBeLessThan(1);
        if (aspect === "landscape" && heightLimitedWidth >= size.available) {
          expect(size.width).toBeGreaterThan(size.pageContent);
          expect(size.width).toBeGreaterThanOrEqual(viewport.width === 1280 ? 640 : viewport.width - 24);
        } else if (aspect === "portrait") {
          // Growth at the three reference sizes; short screens deliberately shrink.
          if (viewport.height >= 800) expect(size.width).toBeGreaterThan(320);
        }
        await expect(page.locator("#previewTransport")).toBeVisible();
        // Transport and play button remain inside the frame and do not overlap.
        // Read all positions in one layout snapshot: aspect changes can trigger
        // scroll anchoring between separate boundingBox round trips.
        const [frame, play, seek, mute] = await page.evaluate(() =>
          ["#stage", "#previewToggle", "#previewSeek", "#muteBtn"].map((selector) => {
            const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
        for (const control of [play, seek, mute]) {
          expect(control.x).toBeGreaterThanOrEqual(frame.x);
          expect(control.x + control.width).toBeLessThanOrEqual(frame.x + frame.width);
          expect(control.y + control.height).toBeLessThanOrEqual(frame.y + frame.height);
        }
        expect(seek.x + seek.width).toBeLessThan(mute.x);
        expect(play.y + play.height).toBeLessThan(seek.y);
        await expect(page.locator("#saveBtn")).toBeEnabled();
      }
    });
  }
}
