import { expect, test } from "@playwright/test";
import { blockAnalytics, openStudio, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

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
  await openStudio(page);

  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("#previewToggle")).toBeEnabled({ timeout: 20_000 });

  const stage = page.locator("#previewToggle");
  await stage.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __heldMediaPlayCalls?: () => number }).__heldMediaPlayCalls?.() ?? 0,
      ),
    )
    .toBeGreaterThan(0);

  await stage.click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");

  await stage.click();

  await page.evaluate(() => {
    const release = (window as Window & { __releaseHeldMediaPlay?: () => void }).__releaseHeldMediaPlay;
    release?.();
  });
});
