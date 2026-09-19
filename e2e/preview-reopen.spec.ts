import { expect, test } from "@playwright/test";
import { blockAnalytics, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test("reopens preview immediately after close during playback start", async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.addInitScript(() => {
    const proto = HTMLMediaElement.prototype;
    const originalPlay = proto.play;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let playCalls = 0;
    Object.assign(window, {
      __releaseHeldMediaPlay: release,
      __heldMediaPlayCalls: () => playCalls,
    });
    proto.play = function play(this: HTMLMediaElement) {
      playCalls += 1;
      return held.then(() => originalPlay.apply(this));
    };
  });
  await page.goto("/");
  await waitForAppReady(page);

  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#status")).toContainText("1 枚を読み込みました", { timeout: 20_000 });

  const playBtn = page.locator("#playBtn");
  const dialog = page.locator("#previewDialog");
  await playBtn.click();
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __heldMediaPlayCalls?: () => number }).__heldMediaPlayCalls?.() ?? 0,
      ),
    )
    .toBeGreaterThan(0);

  await page.locator("#closePreviewBtn").click();
  await expect(dialog).toBeHidden();

  await playBtn.click();
  await expect(dialog).toBeVisible();

  await page.evaluate(() => {
    const release = (window as Window & { __releaseHeldMediaPlay?: () => void }).__releaseHeldMediaPlay;
    release?.();
  });
});
