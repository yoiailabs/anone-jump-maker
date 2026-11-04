import { expect, test, type Page } from "@playwright/test";
import { blockAnalytics, chooseOption, PHOTO_FILE, waitForAppReady } from "./helpers.ts";

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 375, height: 480 },
  { width: 812, height: 375 },
  { width: 1280, height: 480 },
];

/** 1 回のレイアウトで測る。向きの切替やシートの開閉でスクロール位置が動くため。 */
function measure(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#stage canvas.stage-canvas")!;
    const frame = canvas.parentElement!;
    const rect = canvas.getBoundingClientRect();
    const border = getComputedStyle(frame);
    const borderX = parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth);
    const borderY = parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
    const wrap = document.querySelector(".stage-wrap")!.getBoundingClientRect();
    const box = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      width: rect.width,
      height: rect.height,
      frameHeight: frame.getBoundingClientRect().height,
      availableWidth: wrap.width - borderX,
      availableHeight: wrap.height - borderY,
      borderY,
      scrollWidth: document.documentElement.scrollWidth,
      stage: box("#stage"),
      sheet: box(".studio-sheet"),
      view: box("#studioView"),
      play: box("#previewToggle"),
      seek: box("#previewSeek"),
      mute: box("#muteBtn"),
    };
  });
}

for (const locale of ["ja", "en", "ko", "zh"]) {
  for (const viewport of viewports) {
    test(`${locale}: preview fits available width and player height at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await blockAnalytics(page);
      await page.goto(locale === "ja" ? "/make" : `/${locale}/make`);
      await waitForAppReady(page);
      // Reserve the empty preview's height even before its canvas is created lazily.
      const emptyFrame = await page.locator("#stage").boundingBox();
      expect(emptyFrame!.height).toBeGreaterThan(100);
      expect(emptyFrame!.height).toBeLessThanOrEqual(viewport.height * 0.75 + 1);
      await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
      const canvas = page.locator("#stage canvas.stage-canvas");
      await expect(canvas).toBeVisible();
      await expect(page.locator("#previewSeek")).toBeEnabled();
      await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "edit");

      for (const aspect of ["landscape", "portrait", "landscape"] as const) {
        await chooseOption(page, "aspect", aspect);
        await expect(page.locator("#stage")).toHaveAttribute("data-aspect", aspect);
        await expect(canvas).toHaveAttribute("width", aspect === "landscape" ? "640" : "360");
        await expect(canvas).toHaveAttribute("height", aspect === "landscape" ? "360" : "640");
        const size = await measure(page);
        const ratio = aspect === "landscape" ? 16 / 9 : 9 / 16;
        expect(Math.abs(size.width - size.height * ratio)).toBeLessThan(1);
        expect(size.scrollWidth).toBeLessThanOrEqual(viewport.width);
        // The preview fills the player area along whichever side limits it.
        const expected = Math.min(size.availableWidth, size.availableHeight * ratio);
        expect(Math.abs(size.width - expected)).toBeLessThan(2);
        expect(size.width).toBeGreaterThan(100);
        // The frame must wrap the canvas exactly, without a border-sized gap.
        expect(Math.abs(size.frameHeight - size.height - size.borderY)).toBeLessThan(1);
        // The editor sheet never covers the preview.
        expect(size.stage.y + size.stage.height).toBeLessThanOrEqual(size.sheet.y + 0.5);
        if (viewport.height >= 600) {
          // Tall screens show preview and sheet together in one screen.
          expect(size.view.y).toBeGreaterThanOrEqual(-0.5);
          expect(size.view.y + size.view.height).toBeLessThanOrEqual(viewport.height + 1);
        }
        if (aspect === "landscape" && viewport.width < 600) {
          // Phones: the landscape preview spans the column (minus its 20px padding).
          expect(size.width).toBeGreaterThanOrEqual(viewport.width - 41);
        }
        await expect(page.locator("#previewTransport")).toBeVisible();
        // Transport and play button remain inside the frame and do not overlap.
        const { stage: frame, play, seek, mute } = size;
        for (const control of [play, seek, mute]) {
          expect(control.x).toBeGreaterThanOrEqual(frame.x);
          expect(control.x + control.width).toBeLessThanOrEqual(frame.x + frame.width);
          expect(control.y + control.height).toBeLessThanOrEqual(frame.y + frame.height);
        }
        expect(seek.x + seek.width).toBeLessThan(mute.x);
        expect(play.y + play.height).toBeLessThan(seek.y);
        await expect(page.locator("#saveBtn")).toBeEnabled();
      }

      // Portrait is height-limited on phones; folding the sheet gives it the room.
      await chooseOption(page, "aspect", "portrait");
      const open = await measure(page);
      await page.locator("#sheetHandle").click();
      await expect(page.locator("#sheetHandle")).toHaveAttribute("aria-expanded", "false");
      await expect.poll(async () => (await measure(page)).sheet.height).toBeLessThan(open.sheet.height / 2);
      const closed = await measure(page);
      expect(closed.width).toBeGreaterThanOrEqual(open.width - 0.5);
      expect(Math.abs(closed.width - Math.min(closed.availableWidth, closed.availableHeight * 9 / 16))).toBeLessThan(2);
      if (viewport.height >= 800) expect(closed.height).toBeGreaterThan(viewport.height * 0.55);
    });
  }
}
