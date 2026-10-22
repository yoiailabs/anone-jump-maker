import { expect, test } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test("the short template supports paused seeks across its buffered duration", async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
  const video = page.locator("video.offscreen-video");
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) =>
    el.readyState >= 2 && el.buffered.length > 0 && el.buffered.end(el.buffered.length - 1) >= el.duration,
  )).toBe(true);
  const ranges = await video.evaluate((el: HTMLVideoElement) => ({
    duration: el.duration,
    seekableEnd: el.seekable.length ? el.seekable.end(el.seekable.length - 1) : 0,
  }));
  expect(ranges.seekableEnd).toBe(ranges.duration);
  await video.evaluate((el: HTMLVideoElement) => new Promise<void>((resolve) => {
    el.addEventListener("seeked", () => resolve(), { once: true });
    el.currentTime = 0.3;
  }));
  expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(0.3, 2);
});
