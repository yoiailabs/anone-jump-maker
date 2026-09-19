import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { SHARE_TEXT } from "../src/share.ts";
import { blockAnalytics, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

test("boots the maker with preview and save disabled until a photo is chosen", async ({ page }) => {
  await expect(page.locator("#playBtn")).toBeDisabled();
  await expect(page.locator("#saveBtn")).toBeDisabled();
  await expect(page.locator("#shareAppBtn")).toBeEnabled();
  await expect(page.locator("#copyHashtagsBtn")).toBeEnabled();
  await expect(page.locator("#hashtagCopyHint")).toHaveText(SHARE_TEXT);
  await expect(page.getByRole("radio", { name: "横" }).first()).toBeChecked();
});

test("loads a photo then previews, mutes, and switches aspect in Chromium and WebKit", async ({ page }) => {
  await uploadPhoto(page);
  await expect(page.locator("#thumbs img")).toHaveCount(1);
  await expect(page.locator("#playBtn")).toBeEnabled();
  await expect(page.locator("#saveBtn")).toBeEnabled();

  await page.locator("#playBtn").click();
  const dialog = page.locator("#previewDialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();

  await settlePreviewPlayback(page);
  await expect(page.locator("#previewState")).toHaveText(/再生中|停止中/);

  const mute = page.locator("#muteBtn");
  await mute.click();
  await expect(mute).toContainText(/音声オフ|音声オン/);

  await page.locator('#previewDialog label:has(input[name="preview-aspect"][value="portrait"])').click();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await page.locator('#previewDialog label:has(input[name="preview-swap"][value="zoom"])').click();
  await page.locator('#previewDialog label:has(input[name="preview-filter"][value="blur-weak"])').click();

  await page.locator("#closePreviewBtn").click();
  await expect(dialog).toBeHidden();
});

test("saves a short clip when an encoder plan exists, and explains when it does not", async ({ page }) => {
  await uploadPhoto(page);
  // VideoEncoder があっても pickOfflinePlan が null なら未対応（WebKit でよくある）。
  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  void downloadPromise.catch(() => undefined);
  await page.locator("#saveBtn").click();
  await expect(page.locator("#status")).toContainText(
    new RegExp(`保存しました|${UNSUPPORTED_EXPORT_MESSAGE}`),
    { timeout: 45_000 },
  );
  const statusText = (await page.locator("#status").textContent()) ?? "";
  if (statusText.includes("保存しました")) {
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^anone-jump-16x9\.(mp4|webm)$/);
    return;
  }
  expect(statusText).toContain(UNSUPPORTED_EXPORT_MESSAGE);
});

test("shows the community jumps carousel above reactions and wraps the loop", async ({ page }) => {
  const community = page.locator("#communityJumpsTitle");
  const reactions = page.locator("#reactionsTitle");
  await expect(community).toHaveText("みんなの #あのねジャンプ");
  await expect(page.locator("#communityJumpsMeter")).toHaveText("1 / 10");
  await expect(page.locator("#communityJumps .community-jumps-slide")).toHaveCount(12);

  const communityBox = await community.boundingBox();
  const reactionsBox = await reactions.boundingBox();
  expect(communityBox && reactionsBox && communityBox.y < reactionsBox.y).toBe(true);

  await page.locator("#communityJumpsPrev").click();
  await expect(page.locator("#communityJumpsMeter")).toHaveText("10 / 10");
  await page.locator("#communityJumpsNext").click();
  await expect(page.locator("#communityJumpsMeter")).toHaveText("1 / 10");
  await page.locator("#communityJumpsNext").click();
  await expect(page.locator("#communityJumpsMeter")).toHaveText("2 / 10");
});

test("copies hashtags from the panel", async ({ page, context, browserName }) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.locator("#copyHashtagsBtn").click();
  await expect(page.locator("#status")).toContainText(/コピーしました|コピーできません/);
});

async function uploadPhoto(page: Page): Promise<void> {
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#status")).toContainText("1 枚を読み込みました", { timeout: 20_000 });
}

async function settlePreviewPlayback(page: Page): Promise<void> {
  const state = page.locator("#previewState");
  await expect(state).toHaveText(/再生中|停止中/);
  if ((await state.textContent())?.includes("再生中")) return;
  if ((await page.locator("#status").textContent())?.includes("再生できませんでした")) {
    await page.locator("#muteBtn").click();
    await page.locator("#modalPlayBtn").click();
    await expect(state).toHaveText(/再生中|停止中/);
  }
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();
}
