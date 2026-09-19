import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { SHARE_TEXT } from "../src/share.ts";
import { blockAnalytics, jpegInput, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

test("boots the maker with preview and save disabled until a photo is chosen", async ({ page }) => {
  await expect(page.locator("html")).not.toHaveAttribute("translate", "no");
  await expect(page.locator("#status")).toHaveAttribute("translate", "no");
  await expect(page).toHaveTitle("あのねジャンプメーカー");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://anone.yoiailabs.com/",
  );
  await expect(page.locator("#playBtn")).toBeDisabled();
  await expect(page.locator("#saveBtn")).toBeDisabled();
  await expect(page.locator("#shareAppBtn")).toBeEnabled();
  await expect(page.locator("#copyHashtagsBtn")).toBeEnabled();
  await expect(page.locator("#hashtagCopyHint")).toHaveText(SHARE_TEXT);
  await expect(page.getByRole("radio", { name: "横" }).first()).toBeChecked();
  await expect(page.locator("#makerTitle")).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id ?? "")).not.toBe("makerTitle");
  await expect
    .poll(async () => page.locator("#makerTitle").evaluate((el) => getComputedStyle(el).outlineStyle))
    .toBe("none");
  await expect(page.locator("img.loop")).toHaveAttribute("src", "/jump-loop-still.png");
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute(
    "href",
    "/jump-loop-still.png",
  );
  const html = await page.request.get("/").then((response) => response.text());
  expect(html).not.toMatch(/<script[^>]+src="https:\/\/www\.googletagmanager\.com/);
  expect(html).toContain("Zen+Maru+Gothic");
  expect(html).toContain("wght@400;700");
  expect(html).not.toContain("400;500;700");
  expect(html).not.toContain("Noto+Sans+KR");
  expect(html).not.toContain("Noto+Sans+SC");
  expect(html).not.toContain("communityJumpsTitle");
  const firstLoad = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    return {
      templateVideo: resources.some((name) => /\/template\/(landscape|vertical)\.mp4/.test(name)),
      jumpLoopVideo: resources.some((name) => name.includes("jump-loop.mp4")),
      widgets: Boolean(document.getElementById("twitter-wjs")),
      gtagScript: Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')),
    };
  });
  expect(firstLoad.templateVideo).toBe(false);
  expect(firstLoad.jumpLoopVideo).toBe(false);
  expect(firstLoad.widgets).toBe(false);
});

test("loads a photo then previews, mutes, and switches aspect in Chromium and WebKit", async ({ page }) => {
  await uploadPhoto(page);
  await expect(page.locator("#thumbs img")).toHaveCount(1);
  await expect(page.locator("#playBtn")).toBeEnabled();
  await expect(page.locator("#saveBtn")).toBeEnabled();
  expect(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").some((entry) => /\/template\/(landscape|vertical)\.mp4/.test(entry.name)),
    ),
  ).toBe(true);

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

test("opens a generation modal with progress and cancel", async ({ page }) => {
  await uploadPhoto(page);
  await page.route("**/template/*.mp4", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 8_000);
    });
    try {
      await route.continue();
    } catch {
      // キャンセルで fetch が中断されると continue は失敗する
    }
  });
  const dialog = page.locator("#exportDialog");
  await page.locator("#saveBtn").click();
  try {
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  } catch {
    await expect(page.locator("#status")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }
  await expect(page.locator("#exportTitle")).toHaveText("動画を生成中");
  await expect(page.locator("#exportProgress")).toHaveAttribute("max", "100");
  await expect(page.locator("#exportProgressLabel")).toContainText("%");
  await expect(page.locator("#exportKeepOpen")).toBeVisible();
  await expect(page.locator("#exportKeepOpen")).toContainText("タブを閉じたり");
  await expect(page.locator("#cancelExportBtn")).toBeEnabled();
  await page.locator("#cancelExportBtn").click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("#status")).toHaveText("生成をキャンセルしました");
});

test("adds, reorders, and removes photos after the first pick", async ({ page }) => {
  await expect(page.locator("#pickerLabel")).toHaveText("写真を選ぶ");
  await expect(page.locator("#thumbs")).toBeHidden();
  await expect(page.locator("#thumbsHint")).toBeHidden();

  await uploadPhoto(page);
  await expect(page.locator("#pickerLabel")).toHaveText("写真を追加");
  await expect(page.locator("#thumbsHint")).toBeVisible();
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".thumb-add")).toBeVisible();

  const extra = await jpegInput("extra.jpg");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".thumb-add").click(),
  ]);
  await chooser.setFiles({ name: extra.name, mimeType: extra.mimeType, buffer: extra.buffer });
  await expect(page.locator("#status")).toContainText("1 枚を追加しました（合計 2 枚）", { timeout: 20_000 });
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2);
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");

  await page.locator(".thumb").nth(0).press("ArrowRight");
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "extra.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator(".thumb-index").nth(0)).toHaveText("1");
  await expect(page.locator(".thumb-index").nth(1)).toHaveText("2");

  await page.locator(".thumb-remove").nth(0).click();
  await expect(page.locator("#status")).toContainText("写真を外しました（残り 1 枚）");
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".thumb-add")).toBeVisible();
  await expect(page.locator("#thumbs img")).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#playBtn")).toBeEnabled();

  await page.locator(".thumb-remove").click();
  await expect(page.locator("#status")).toContainText("写真をすべて外しました");
  await expect(page.locator("#thumbs")).toBeHidden();
  await expect(page.locator(".thumb-add")).toBeHidden();
  await expect(page.locator("#pickerLabel")).toHaveText("写真を選ぶ");
  await expect(page.locator("#playBtn")).toBeDisabled();
});

test("keeps at most 32 photos and disables adding at the cap", async ({ page }) => {
  const files = await Promise.all(Array.from({ length: 33 }, (_, i) => jpegInput(`p${i}.jpg`)));
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator("#status")).toContainText("32 枚を読み込みました", { timeout: 45_000 });
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(32);
  await expect(page.locator(".thumb-add")).toBeDisabled();
  await expect(page.locator("#pickerLabel")).toHaveText("32枚まで");
  await expect(page.locator("#thumbsHint")).toContainText("32枚が上限");
  await expect(page.locator("#status")).not.toContainText("失敗");
});

test("reorders photos by drag and drop", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#picker").setInputFiles(await jpegInput("extra.jpg"));
  await expect(page.locator("#status")).toContainText("1 枚を追加しました（合計 2 枚）", { timeout: 20_000 });
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");

  const first = page.locator(".thumb[data-photo-id]").nth(0);
  const second = page.locator(".thumb[data-photo-id]").nth(1);
  await first.scrollIntoViewIfNeeded();
  const from = await first.boundingBox();
  const to = await second.boundingBox();
  expect(from && to).toBeTruthy();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width * 0.82, to!.y + to!.height / 2, { steps: 16 });
  await page.mouse.up();

  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "extra.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator(".thumb-index").nth(0)).toHaveText("1");
  await expect(page.locator(".thumb-index").nth(1)).toHaveText("2");

  const thumbsStyle = await page.locator("#thumbs").evaluate((el) => {
    const style = getComputedStyle(el);
    return { wrap: style.flexWrap, overflowX: style.overflowX };
  });
  expect(thumbsStyle.wrap).toBe("wrap");
  expect(thumbsStyle.overflowX).not.toBe("auto");
  await expect
    .poll(async () => page.locator(".thumb").first().evaluate((el) => getComputedStyle(el).touchAction))
    .toBe("pan-y");
});

test("a touch swipe does not reorder photos without a long press", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#picker").setInputFiles(await jpegInput("extra.jpg"));
  await expect(page.locator("#status")).toContainText("1 枚を追加しました（合計 2 枚）", { timeout: 20_000 });
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");

  await page.evaluate(() => {
    const first = document.querySelector<HTMLElement>(".thumb[data-photo-id]");
    const thumbs = document.querySelector("#thumbs");
    if (!first || !thumbs) throw new Error("missing thumbs");
    const start = first.getBoundingClientRect();
    const fire = (type: string, x: number, buttons: number) => {
      const target = type === "pointermove" ? thumbs : first;
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          button: 0,
          buttons,
          clientX: x,
          clientY: start.top + 10,
        }),
      );
    };
    fire("pointerdown", start.left + 8, 1);
    fire("pointermove", start.left + 90, 1);
    fire("pointerup", start.left + 90, 0);
  });

  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");
});

test("saves a short clip when an encoder plan exists, and explains when it does not", async ({ page }) => {
  await uploadPhoto(page);
  const exportDialog = page.locator("#exportDialog");
  await expect(exportDialog).toBeHidden();
  await expect(page.locator("#exportTitle")).toHaveText("動画を生成中");
  await expect(page.locator("#cancelExportBtn")).toHaveText("キャンセル");
  await expect(page.locator("#exportKeepOpen")).toContainText("タブを閉じたり");
  await expect(page.locator("#exportProgress")).toHaveAttribute("max", "100");
  await expect(page.locator("#exportProgressLabel")).toHaveText("0%");

  // VideoEncoder があっても pickOfflinePlan が null なら未対応（WebKit でよくある）。
  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  void downloadPromise.catch(() => undefined);
  await page.locator("#saveBtn").click();
  await expect(exportDialog)
    .toBeVisible({ timeout: 2_000 })
    .catch(() => undefined);
  if (await exportDialog.isVisible()) {
    await expect(page.locator("#exportProgressLabel")).toContainText("%");
  }
  await expect(page.locator("#status")).toContainText(
    new RegExp(`保存しました|${UNSUPPORTED_EXPORT_MESSAGE}`),
    { timeout: 45_000 },
  );
  const statusText = (await page.locator("#status").textContent()) ?? "";
  if (statusText.includes("保存しました")) {
    await expect(exportDialog).toBeVisible();
    await expect(page.locator("#exportDownloadHint")).toHaveText("ダウンロードが開始されませんか？");
    await expect(page.locator("#downloadExportBtn")).toBeVisible();
    await expect(page.locator("#cancelExportBtn")).toBeHidden();
    const retryDownload = page.waitForEvent("download", { timeout: 10_000 });
    await page.locator("#downloadExportBtn").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^anone-jump-16x9\.(mp4|webm)$/);
    const retry = await retryDownload;
    expect(retry.suggestedFilename()).toBe(download.suggestedFilename());
    await page.locator("#closeExportBtn").click();
    await expect(exportDialog).toBeHidden();
    return;
  }
  await expect(exportDialog).toBeHidden();
  expect(statusText).toContain(UNSUPPORTED_EXPORT_MESSAGE);
});

test("opens community jumps from the disclaimer link and returns via the back link", async ({ page }) => {
  await expect(page.locator(".app-tabs")).toHaveCount(0);
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#communityView")).toBeHidden();
  await expect(page.locator("#communityJumpsTitle")).toBeHidden();
  await expect(page.locator("#playBtn")).toBeVisible();
  await expect(page.locator("#reactionsTitle")).toBeVisible();

  const disclaimer = page.locator("#makerView .lede");
  const toCommunity = page.locator("#toCommunity");
  await expect(disclaimer).toContainText("※ファン制作の非公式アプリです。");
  await expect(toCommunity).toHaveText("みんなの #あのねジャンプ を見る");
  await expect(toCommunity).toHaveClass(/\bbtn\b/);
  const disclaimerBox = await disclaimer.boundingBox();
  const linkBox = await toCommunity.boundingBox();
  expect(disclaimerBox && linkBox && disclaimerBox.y < linkBox.y).toBe(true);

  await expect(toCommunity).toHaveAttribute("href", "/community");
  const communityBtn = await toCommunity.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      background: style.backgroundColor,
      height: el.getBoundingClientRect().height,
      radius: style.borderRadius,
    };
  });
  await toCommunity.click();
  await expect(page).toHaveURL(/\/community\/?$/);
  await expect(page).not.toHaveURL(/#community/);
  await expect(page).toHaveTitle("みんなの #あのねジャンプ");
  await expect(page.locator("#communityView")).toBeVisible();
  await expect(page.locator("#makerView")).toBeHidden();
  await expect(page.locator("#communityJumpsTitle")).toHaveText("みんなの #あのねジャンプ");
  await expect(page.locator("#communityJumpsTitle")).toBeInViewport();
  await expect
    .poll(async () =>
      page.locator("#communityJumpsTitle").evaluate((el) => getComputedStyle(el).outlineStyle),
    )
    .toBe("none");
  await expect(page.locator("#toMaker")).toBeVisible();
  await expect(page.locator("#toMaker")).toHaveClass(/\bpage-link\b/);
  await expect(page.locator("#toMaker")).not.toHaveClass(/\bbtn\b/);
  await expect(page.locator("#toMakerBottom")).toHaveClass(/\bpage-link\b/);
  await expect(page.locator("#toMakerBottom")).not.toHaveClass(/\bbtn\b/);
  const moreJumps = page.locator("#moreJumps");
  await expect(moreJumps).toHaveText("もっと見る");
  await expect(moreJumps).toHaveClass(/\bbtn\b/);
  await expect(moreJumps).toHaveClass(/\bcommunity-more-btn\b/);
  await expect(moreJumps).toHaveAttribute("target", "_blank");
  await expect(moreJumps).toHaveAttribute("rel", "noopener noreferrer");
  await expect(moreJumps).toHaveAttribute(
    "href",
    `https://x.com/search?q=${encodeURIComponent("#あのねジャンプ")}`,
  );
  await expect(page.locator("#communityJumps .community-jumps-item")).toHaveCount(10);
  await expect(page.locator("#communityJumpsPrev")).toHaveCount(0);
  await expect(page.locator("#communityJumpsMeter")).toHaveCount(0);
  await expect(page.locator("#playBtn")).toBeHidden();

  const first = page.locator("#communityJumps .community-jumps-item").nth(0);
  const second = page.locator("#communityJumps .community-jumps-item").nth(1);
  const last = page.locator("#communityJumps .community-jumps-item").nth(9);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  const lastBox = await last.boundingBox();
  expect(firstBox && secondBox && firstBox.y < secondBox.y).toBe(true);
  expect(secondBox && lastBox && secondBox.y < lastBox.y).toBe(true);

  const bottomBack = page.locator("#toMakerBottom");
  const lastAfter = page.locator("#communityJumps .community-jumps-item").nth(9);
  await lastAfter.scrollIntoViewIfNeeded();
  const lastAfterBox = await lastAfter.boundingBox();
  const moreBox = await moreJumps.boundingBox();
  const bottomBox = await bottomBack.boundingBox();
  expect(lastAfterBox && moreBox && lastAfterBox.y < moreBox.y).toBe(true);
  expect(moreBox && bottomBox && moreBox.y < bottomBox.y).toBe(true);
  expect(moreBox && moreBox.height).toBeGreaterThan(40);
  const moreStyle = await moreJumps.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      background: style.backgroundColor,
      height: el.getBoundingClientRect().height,
      radius: style.borderRadius,
      decoration: style.textDecorationLine,
    };
  });
  expect(moreStyle.background).toBe(communityBtn.background);
  expect(moreStyle.height).toBeGreaterThan(40);
  expect(moreStyle.radius).toBe(communityBtn.radius);
  expect(moreStyle.decoration).toBe("none");
  await expect(page.locator(".community-jumps-card[data-hydrated='1']")).toHaveCount(10);
  await expect(bottomBack).toHaveAttribute("href", "/");

  // widgets.js が display:none 中に測ると iframe が潰れる。戻ったら blockquote から載せ直す。
  await page.evaluate(() => {
    const reactions = document.querySelector("#reactionsEmbed");
    if (reactions) {
      reactions.innerHTML = `<iframe class="twitter-tweet-rendered" height="0"></iframe>`.repeat(3);
    }
    for (const card of document.querySelectorAll<HTMLElement>(".community-jumps-card[data-hydrated='1']")) {
      card.innerHTML = `<iframe class="twitter-tweet-rendered" height="0"></iframe>`;
    }
  });

  await bottomBack.click();
  await expect(page).not.toHaveURL(/\/community/);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#playBtn")).toBeVisible();
  await expect(page.getByRole("heading", { name: "あのねジャンプメーカー" })).toBeInViewport();
  await expect(page.locator("#communityView")).toBeHidden();
  await expect(page.locator("#reactionsTitle")).toBeVisible();
  await expect(page.locator("#reactionsEmbed blockquote.twitter-tweet")).toHaveCount(3);
  await expect(page.locator("#reactionsEmbed iframe.twitter-tweet-rendered")).toHaveCount(0);

  await page.locator("#toCommunity").click();
  await expect(page).toHaveURL(/\/community\/?$/);
  await expect(page.locator("#communityView")).toBeVisible();
  await expect(page.locator(".community-jumps-card[data-hydrated='1'] blockquote.twitter-tweet")).toHaveCount(10);
  await expect(page.locator(".community-jumps-card iframe.twitter-tweet-rendered")).toHaveCount(0);
});

test("hydrates every community card after scrolling the list", async ({ page }) => {
  await page.goto("/community");
  await waitForAppReady(page);
  const items = page.locator("#communityJumps .community-jumps-item");
  await expect(items).toHaveCount(10);
  for (let index = 0; index < 10; index += 1) {
    await items.nth(index).scrollIntoViewIfNeeded();
    await expect(items.nth(index).locator(".community-jumps-card")).toHaveAttribute("data-hydrated", "1");
    await expect(items.nth(index).locator("blockquote.twitter-tweet")).toHaveCount(1);
  }
  await page.locator("#moreJumps").scrollIntoViewIfNeeded();
  await expect(page.locator(".community-jumps-card[data-hydrated='1']")).toHaveCount(10);
});

test("opens /community directly and moves leftover hashes onto the path", async ({ page }) => {
  await page.goto("/community");
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/community\/?$/);
  await expect(page.locator("#communityView")).toBeVisible();
  await expect(page.locator("#communityJumpsTitle")).toHaveText("みんなの #あのねジャンプ");
  expect(await page.evaluate(() => document.activeElement?.id ?? "")).not.toBe("communityJumpsTitle");
  await expect
    .poll(async () =>
      page.locator("#communityJumpsTitle").evaluate((el) => getComputedStyle(el).outlineStyle),
    )
    .toBe("none");
  await expect(page).toHaveTitle("みんなの #あのねジャンプ");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "ファンが投稿したジャンプ動画です。下にスクロールして見てね。",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://anone.yoiailabs.com/community",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://anone.yoiailabs.com/og.png",
  );

  await page.goto("/#community");
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/community\/?$/);
  await expect(page).not.toHaveURL(/#community/);
  await expect(page.locator("#communityView")).toBeVisible();
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
  await expect(page.locator("#playBtn")).toBeEnabled({ timeout: 20_000 });
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
