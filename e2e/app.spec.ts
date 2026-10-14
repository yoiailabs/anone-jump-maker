import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { MORE_JUMPS_HREF, SHARE_TEXT } from "../src/share.ts";
import { blockAnalytics, expectVisibleText, jpegInput, openStudio, PHOTO_FILE, selectAspect, stubShortTemplate, stripZwsp, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

test("boots the maker with preview and save disabled until a photo is chosen", async ({ page }) => {
  await expect(page.locator("html")).not.toHaveAttribute("translate", "no");
  await expect(page.locator("#shareFeedback")).toHaveCount(0);
  await expect(page.locator("#saveFeedback")).toHaveAttribute("translate", "no");
  await expect(page.locator("#photoFeedback")).toHaveAttribute("translate", "no");
  await expect(page).toHaveTitle("あのねジャンプメーカー");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://anone.yoiailabs.com/",
  );
  await expect(page.locator("#toStudio")).toBeVisible();
  await expect(page.locator("#toStudio")).toHaveText("動画をつくる");
  await expect(page.locator("#makerView #picker")).toHaveCount(0);
  await expect(page.locator("#studioView")).toBeHidden();
  await expect(page.locator("#shareAppBtn")).toHaveCount(0);
  await expect(page.locator("#copyHashtagsBtn")).toHaveCount(0);
  await expect(page.locator("#landingHashtags")).toHaveText(SHARE_TEXT);
  await expect(page.locator("#makerTitle")).toBeVisible();
  const heroLogo = page.locator("#makerTitle .hero-logo");
  await expect(heroLogo).toBeVisible();
  await expect(heroLogo).toHaveAttribute("src", "/brand/anone-logo-stacked.svg");
  await expect(heroLogo).toHaveAttribute("alt", "あのねジャンプメーカー");
  await expect(page.locator("#makerView .eyebrow")).toHaveCount(0);
  const logoBox = await heroLogo.boundingBox();
  const heroBoxOnBoot = await page.locator("#makerView .hero").boundingBox();
  expect(logoBox && heroBoxOnBoot && logoBox.width <= heroBoxOnBoot.width + 1).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.id ?? "")).not.toBe("makerTitle");
  await expect
    .poll(async () => page.locator("#makerTitle").evaluate((el) => getComputedStyle(el).outlineStyle))
    .toBe("none");
  await expect(page.locator("img.loop")).toHaveAttribute("src", "/jump-loop-still.png");
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute(
    "href",
    "/jump-loop-still.png",
  );
  await expect(page.locator("#samplePhotosBtn")).toHaveCount(0);
  const makeCta = page.locator("#toStudio");
  const loop = page.locator("#makerView .loop-wrap");
  await expect(makeCta).toBeVisible();
  await expect(loop).toBeVisible();
  const viewport = page.viewportSize();
  const ctaBoxOnBoot = await makeCta.boundingBox();
  const loopBoxOnBoot = await loop.boundingBox();
  expect(
    viewport && ctaBoxOnBoot && ctaBoxOnBoot.y >= 0 && ctaBoxOnBoot.y + ctaBoxOnBoot.height <= viewport.height,
  ).toBe(true);
  expect(
    viewport && loopBoxOnBoot && loopBoxOnBoot.y >= 0 && loopBoxOnBoot.y + loopBoxOnBoot.height <= viewport.height,
  ).toBe(true);
  expect(loopBoxOnBoot && ctaBoxOnBoot && loopBoxOnBoot.y + loopBoxOnBoot.height <= ctaBoxOnBoot.y + 1).toBe(true);
  const html = await page.request.get("/").then((response) => response.text());
  expect(html).not.toMatch(/<script[^>]+src="https:\/\/www\.googletagmanager\.com/);
  expect(html).toContain("Zen+Maru+Gothic");
  expect(html).toContain("wght@400;700");
  expect(html).not.toContain("400;500;700");
  expect(html).not.toContain("Noto+Sans+KR");
  expect(html).not.toContain("Noto+Sans+SC");
  expect(html).not.toContain("communityJumpsTitle");
  expect(html).not.toContain('src="/jump-loop.mp4"');
  expect(html).not.toContain("youtube-nocookie.com");
  expect(html).not.toContain("youtube.com/embed");
  const firstLoad = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    return {
      templateVideo: resources.some((name) => /\/template\/(landscape|vertical)\.mp4/.test(name)),
      widgets: Boolean(document.getElementById("twitter-wjs")),
      gtagScript: Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')),
      officialMv: Boolean(document.querySelector("#officialMv iframe")),
    };
  });
  expect(firstLoad.templateVideo).toBe(false);
  expect(firstLoad.widgets).toBe(false);
  expect(firstLoad.officialMv).toBe(false);
  await expect
    .poll(async () =>
      page.locator("video.loop-video").evaluate((el) => {
        const video = el as HTMLVideoElement;
        return video.currentSrc.includes("jump-loop.mp4") || video.src.includes("jump-loop.mp4");
      }),
    )
    .toBe(true);
});

test("empty preview opens the photo picker and does not start playback", async ({ page }) => {
  await openStudio(page);
  const empty = page.locator("#studioEmpty");
  await expect(empty).toBeVisible();
  await expect(empty).toHaveText("");
  await empty.focus();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.keyboard.press("Enter")]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(PHOTO_FILE.path);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("#photoFeedback")).toHaveText("");
  await expect(empty).toBeHidden();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
});

test("loads a photo then previews, mutes, and switches aspect in Chromium and WebKit", async ({ page }) => {
  await uploadPhoto(page);
  await expect(page.locator("#thumbs img")).toHaveCount(1);
  await expect(page.locator("#playBtn")).toHaveCount(0);
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await expect(page.locator("#previewSeek")).toBeEnabled();
  await expect(page.locator("#previewTime")).toHaveText(/\d+:\d{2}/);
  await expect(page.locator("#previewTransport")).toBeVisible();
  await expect(page.locator("#previewDim")).toBeVisible();
  await expect(page.locator("#previewToggle")).toBeVisible();
  await expect(page.locator("#previewStatus")).toHaveAttribute("data-state", "stopped");
  await expect(page.locator("#previewStatus")).toHaveAttribute("aria-label", "停止中");
  await expect(page.locator(".preview-status-icon-pause")).toBeVisible();
  await expect(page.locator(".preview-status-icon-play")).toBeHidden();
  await expect(page.locator("#previewStatusLabel")).toHaveCount(0);
  await expect(page.locator("#restartBtn")).toHaveCount(0);
  await expect(page.locator('#studioView input[name="swap"][value="jump"]')).toBeVisible();
  await expect(page.locator("#aspectPopover")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").some((entry) => /\/template\/(landscape|vertical)\.mp4/.test(entry.name)),
    ),
  ).toBe(true);

  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#previewToggle").click();
  await expect(page.locator("#previewDialog")).toHaveCount(0);
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();

  await settlePreviewPlayback(page);
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#previewStatus")).toHaveAttribute("data-state", "playing");
  await expect(page.locator(".preview-status-icon-play")).toBeVisible();
  await expect(page.locator(".preview-status-icon-pause")).toBeHidden();
  await showPreviewChrome(page);
  await page.locator("#stage").click({ position: { x: 10, y: 14 } });
  await expect(page.locator("#previewTransport")).toBeHidden();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#stage").click({ position: { x: 10, y: 14 } });
  await expect(page.locator("#previewTransport")).toBeVisible();
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#saveBtn")).toBeVisible();
  await expect(page.locator("#saveBtn")).toHaveText("動画を保存");
  await expectVisibleText(
    page.locator("#previewSaveHint"),
    "端末上で動画を生成します。数十秒かかることがあります。",
  );
  await expect(page.locator("#previewTransport")).toBeVisible();
  await expect(page.locator("#previewStatus")).toHaveAttribute("data-state", "stopped");
  await expect(page.locator("#previewStatus")).toHaveAttribute("aria-label", "停止中");
  await expect(page.locator(".preview-status-icon-pause")).toBeVisible();
  await expect(page.locator(".preview-status-icon-play")).toBeHidden();
  await expect(page.locator("#previewStatusLabel")).toHaveCount(0);
  await page.locator("#stage").click({ position: { x: 10, y: 14 } });
  await expect(page.locator("#previewTransport")).toBeVisible();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#muteBtn")).toBeVisible();
  await expect(page.locator("#muteBtn .preview-mute-hint")).toHaveText("プレビュー時のみ");
  await expect(page.locator("#modalPlayBtn")).toHaveCount(0);
  await expect(page.locator("#previewState")).toHaveCount(0);
  await expect(page.locator("#slotMeter")).toHaveCount(0);

  const mute = page.locator("#muteBtn");
  await mute.click();
  await expect(mute).toContainText(/音声オフ|音声オン/);

  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await page.locator("#aspectTab").click();
  await expect(page.locator('#studioView input[name="aspect"]').nth(0)).toHaveAttribute("value", "portrait");
  await expect(page.locator('#studioView input[name="aspect"]').nth(1)).toHaveAttribute("value", "landscape");
  await expect(page.locator('#studioView input[name="aspect"][value="portrait"]')).toBeChecked();
  await selectAspect(page, "landscape");
  await page.locator("#swapTab").click();
  await page.locator('#studioView label:has(input[name="swap"][value="zoom"])').click();
  await page.locator("#filterTab").click();
  await page.locator('#studioView label:has(input[name="filter"][value="blur-weak"])').click();
  await page.locator("#characterTab").click();
  await page.locator('#studioView label:has(input[name="character"][value="1.2"])').click();
  await expect(page.locator('#studioView input[name="character"][value="1.2"]')).toBeChecked();
  await expect(page.locator("#stage")).toBeVisible();
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await expect(page.locator("#previewDialog")).toHaveCount(0);
});

test("opens a generation modal from the preview save button", async ({ page }) => {
  await uploadPhoto(page);
  await expect(page.locator("#saveBtn")).toBeEnabled();

  const exportDialog = page.locator("#exportPanel");
  await page.locator("#saveBtn").click();
  try {
    await expect(exportDialog).toBeVisible({ timeout: 3_000 });
  } catch {
    await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }
  await expect(page.locator("#exportTitle")).toHaveText(/動画を生成中|生成が完了しました/);
  await expect(page.locator("#saveBtn")).toBeVisible();
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
  const dialog = page.locator("#exportPanel");
  await page.locator("#saveBtn").click();
  try {
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  } catch {
    await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }
  await expect(page.locator("#exportTitle")).toHaveText("動画を生成中");
  await expect(page.locator("dialog")).toHaveCount(0);
  const saveBox = await page.locator("#saveBtn").boundingBox();
  const panelBox = await page.locator("#exportPanel").boundingBox();
  expect(saveBox && panelBox && panelBox.y > saveBox.y).toBe(true);
  await expect(page.locator("#exportProgress")).toHaveAttribute("max", "100");
  await expect(page.locator("#exportProgressLabel")).toContainText("%");
  await expect(page.locator("#exportKeepOpen")).toBeVisible();
  await expectVisibleText(
    page.locator("#exportKeepOpen"),
    "端末上で動画を生成します。数十秒かかることがあります。",
  );
  await expect(page.locator("#cancelExportBtn")).toBeEnabled();
  await expect(page.locator("#exportStatus")).toBeHidden();
  await expect(page.locator("#exportStatus")).toHaveText("");
  await expect(page.locator("#exportProgress")).toBeVisible();
  await page.locator("#cancelExportBtn").click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("#saveFeedback")).toBeHidden();
  await expect(page.locator("#saveFeedback")).not.toContainText("生成をキャンセルしました");
});

test("adds, reorders, and removes photos after the first pick", async ({ page }) => {
  await expect(page.locator("#pickerLabel")).toHaveText("写真を選ぶ");
  await expect(page.locator("#thumbs")).toBeHidden();
  await expect(page.locator("#thumbsHint")).toBeHidden();

  await uploadPhoto(page);
  await expect(page.locator("#pickerLabel")).toHaveText("写真を追加");
  await expectVisibleText(page.locator("#thumbsHint"), "長押しして画像の順序を変更できます。");
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".thumb-add")).toBeVisible();

  const extra = await jpegInput("extra.jpg");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".thumb-add").click(),
  ]);
  await chooser.setFiles({ name: extra.name, mimeType: extra.mimeType, buffer: extra.buffer });
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");

  await page.locator(".thumb").nth(0).press("ArrowRight");
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "extra.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator(".thumb-index").nth(0)).toHaveText("1");
  await expect(page.locator(".thumb-index").nth(1)).toHaveText("2");

  await page.locator(".thumb-remove").nth(0).click();
  await expect(page.locator("#photoFeedback")).toHaveText("");
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".thumb-add")).toBeVisible();
  await expect(page.locator("#thumbs img")).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#previewTransport")).toBeVisible();
  await expect(page.locator("#previewSeek")).toBeEnabled();

  await page.locator(".thumb-remove").click();
  await expect(page.locator("#photoFeedback")).toHaveText("");
  await expect(page.locator("#thumbs")).toBeHidden();
  await expect(page.locator(".thumb-add")).toBeHidden();
  await expect(page.locator("#pickerLabel")).toHaveText("写真を選ぶ");
  await expect(page.locator("#previewTransport")).toBeHidden();
});

test("keeps at most 32 photos and disables adding at the cap", async ({ page }) => {
  await openStudio(page);
  const files = await Promise.all(Array.from({ length: 33 }, (_, i) => jpegInput(`p${i}.jpg`)));
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(32, { timeout: 45_000 });
  await expect(page.locator(".thumb-add")).toBeDisabled();
  await expect(page.locator("#pickerLabel")).toHaveText("32枚まで");
  await expect
    .poll(async () => stripZwsp((await page.locator("#thumbsHint").textContent()) ?? ""))
    .toContain("32枚が上限");
  await expect(page.locator("#photoFeedback")).not.toContainText("失敗");
});

test("reorders photos by drag and drop", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#picker").setInputFiles(await jpegInput("extra.jpg"));
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
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
  expect(thumbsStyle.wrap).toBe("nowrap");
  expect(thumbsStyle.overflowX).toBe("auto");
  await expect
    .poll(async () => page.locator(".thumb").first().evaluate((el) => getComputedStyle(el).touchAction))
    .toBe("pan-x");
});

test("a touch swipe does not reorder photos without a long press", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#picker").setInputFiles(await jpegInput("extra.jpg"));
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
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
  const exportDialog = page.locator("#exportPanel");
  await expect(exportDialog).toBeHidden();
  await expect(page.locator("#exportTitle")).toHaveText("動画を生成中");
  await expect(page.locator("#cancelExportBtn")).toHaveText("キャンセル");
  await expectVisibleText(
    page.locator("#exportKeepOpen"),
    "端末上で動画を生成します。数十秒かかることがあります。",
  );
  await expect(page.locator("#exportProgress")).toHaveAttribute("max", "100");
  await expect(page.locator("#exportProgressLabel")).toHaveText("0%");
  await selectAspect(page, "landscape");

  // VideoEncoder があっても pickOfflinePlan が null なら未対応（WebKit でよくある）。
  let autoDownloaded = false;
  page.on("download", () => {
    autoDownloaded = true;
  });
  await page.locator("#saveBtn").click();
  await expect(exportDialog)
    .toBeVisible({ timeout: 2_000 })
    .catch(() => undefined);
  if (await exportDialog.isVisible()) {
    await expect(page.locator("#exportProgressLabel")).toContainText("%");
  }
  const outcome = await waitForExportOutcome(page);
  expect(autoDownloaded).toBe(false);
  if (outcome === "ready") {
    await expect(exportDialog).toBeVisible();
    await expect(page.locator("#exportDownloadHint")).toHaveCount(0);
    await expect(page.locator("#exportStatus")).toBeHidden();
    await expect(page.locator("#exportStatus")).toHaveText("");
    await expect(page.locator("#exportProgressLabel")).toHaveText("100%");
    await expect(page.locator("#downloadExportBtn")).toBeVisible();
    await expect(page.locator("#downloadExportBtn")).toHaveText("ダウンロード");
    await expect(page.locator("#shareExportBtn")).toHaveCount(0);
    await expect(page.locator("#cancelExportBtn")).toBeHidden();
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.locator("#downloadExportBtn").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^anone-jump-16x9\.(mp4|webm)$/);
    await expect(page.locator("#exportStatus")).toBeHidden();
    await expect(page.locator("#exportStatus")).toHaveText("");
    await expect(page.locator("#saveFeedback")).toBeHidden();
    await page.locator("#closeExportBtn").click();
    await expect(exportDialog).toBeHidden();
    return;
  }
  await expect(exportDialog).toBeHidden();
  await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
});

test("download opens a file share sheet when the browser can share files", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { text?: string; name?: string; type?: string; size?: number; keys: string[] }[] = [];
    Object.assign(window, { __fileShareCalls: calls });
    let releaseShare: () => void = () => {};
    Object.assign(window, {
      __releaseFileShare: () => {
        releaseShare();
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const pending = new Promise<void>((resolve) => {
          releaseShare = resolve;
        });
        const file = data.files?.[0];
        calls.push({
          text: data.text,
          name: file?.name,
          type: file?.type,
          size: file?.size,
          keys: Object.keys(data),
        });
        await pending;
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
  });
  await page.goto("/");
  await waitForAppReady(page);
  await uploadPhoto(page);
  await selectAspect(page, "landscape");
  await expect(page.locator("#shareExportBtn")).toHaveCount(0);
  await expect(page.locator("#downloadExportBtn")).toBeHidden();

  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });
  await page.locator("#saveBtn").click();
  const outcome = await waitForExportOutcome(page);
  expect(downloaded).toBe(false);
  if (outcome !== "ready") {
    await expect(page.locator("#exportPanel")).toBeHidden();
    await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }

  await expect(page.locator("#exportPanel")).toBeVisible();
  await expect(page.locator("#downloadExportBtn")).toBeVisible();
  await expect(page.locator("#downloadExportBtn")).toHaveText("ダウンロード");
  await expect(page.locator("#downloadExportBtn")).not.toHaveClass(/ghost/);
  await expect(page.locator("#exportDownloadHint")).toHaveCount(0);
  await expect(page.locator("#exportStatus")).toBeHidden();
  await expect(page.locator("#exportStatus")).toHaveText("");
  expect(
    await page.evaluate(() => (window as unknown as { __fileShareCalls: unknown[] }).__fileShareCalls.length),
  ).toBe(0);

  await page.locator("#downloadExportBtn").click();
  await expect
    .poll(async () =>
      page.evaluate(() => (window as unknown as { __fileShareCalls: unknown[] }).__fileShareCalls.length),
    )
    .toBe(1);
  await expect(page.locator("#exportStatus")).toBeHidden();
  await expect(page.locator("#exportStatus")).toHaveText("");
  await expect(page.locator("#saveFeedback")).toBeHidden();
  await page.evaluate(() => (window as unknown as { __releaseFileShare: () => void }).__releaseFileShare());
  expect(downloaded).toBe(false);
  const payload = await page.evaluate(
    () =>
      (
        window as unknown as {
          __fileShareCalls: { text?: string; name?: string; type?: string; size?: number; keys: string[] }[];
        }
      ).__fileShareCalls[0],
  );
  expect(payload?.name).toMatch(/^anone-jump-16x9\.(mp4|webm)$/);
  expect(payload?.type).toMatch(/^video\/(mp4|webm)$/);
  expect(payload?.size ?? 0).toBeGreaterThan(0);
  expect(payload?.text).toBe(SHARE_TEXT);
  expect(payload?.keys).not.toContain("url");
  expect(payload?.keys).not.toContain("title");
  await expect(page.locator("#exportStatus")).toBeHidden();
  await expect(page.locator("#exportStatus")).toHaveText("");
  await expect(page.locator("#saveFeedback")).toBeHidden();
  await expect(page.locator("#exportPanel")).toBeVisible();
});

test("cancelling the share sheet stays on the export dialog", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw Object.assign(new Error("share canceled"), { name: "AbortError" });
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
  });
  await page.goto("/");
  await waitForAppReady(page);
  await uploadPhoto(page);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });
  await page.locator("#saveBtn").click();
  const outcome = await waitForExportOutcome(page);
  if (outcome !== "ready") return;
  expect(downloaded).toBe(false);
  await page.locator("#downloadExportBtn").click();
  await expect(page.locator("#exportStatus")).toBeHidden();
  await expect(page.locator("#exportStatus")).toHaveText("");
  await expect(page.locator("#saveFeedback")).toBeHidden();
  await expect(page.locator("#saveFeedback")).not.toContainText("共有をやめました");
  expect(downloaded).toBe(false);
  await expect(page.locator("#exportPanel")).toBeVisible();
  await expect(page.locator("#downloadExportBtn")).toBeEnabled();
});

test("opens community jumps from the disclaimer link and returns via the back link", async ({ page }) => {
  await expect(page.locator(".app-tabs")).toHaveCount(0);
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#communityView")).toBeHidden();
  await expect(page.locator("#communityJumpsTitle")).toBeHidden();
  await expect(page.locator("#toStudio")).toBeVisible();
  await expect(page.locator("#makerView #picker")).toHaveCount(0);
  await expect(page.locator("#reactionsTitle")).toBeVisible();
  await expect(page.locator("#officialMvTitle")).toHaveText("「あのね」MV");
  await expect(page.locator("#makerView .loop-link")).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=M-IayQIR0XA&t=60s",
  );
  const bannersBox = await page.locator("#makerView nav.links .link-banners").boundingBox();
  const mvBox = await page.locator("#officialMv").boundingBox();
  const reactionsBox = await page.locator("#makerView .reactions").boundingBox();
  expect(bannersBox && mvBox && bannersBox.y < mvBox.y).toBe(true);
  expect(mvBox && reactionsBox && mvBox.y < reactionsBox.y).toBe(true);
  await page.locator("#officialMv").scrollIntoViewIfNeeded();
  await expect(page.locator("#officialMvEmbed")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/M-IayQIR0XA",
  );
  await expect(page.locator("#officialMvEmbed")).toHaveAttribute(
    "title",
    "「あのね」の公式ミュージックビデオ",
  );
  await expect(page.locator("#officialMvEmbed")).toHaveAttribute("loading", "lazy");

  const toCommunity = page.locator("#toCommunity");
  await expect(page.locator("#makerView .lede")).toHaveCount(0);
  const makerText = stripZwsp((await page.locator("#makerView").innerText()) ?? "");
  expect(makerText).not.toContain("写真を何枚か選択するだけで");
  expect(makerText).not.toContain("動画生成はすべて端末内で完結するため");
  expect(makerText).not.toContain("※ファン制作の非公式アプリです。");
  expect(makerText).not.toContain("※ファン制作の非公式サイトです");
  await expect(page.locator("#fanNote")).toHaveCount(0);
  expect(makerText).not.toContain("動画生成は端末内で行われます。外部に画像が送信されることはありません。");
  expect(makerText).not.toContain("ダウンロードを押すと共有シートが開きます");
  await expectVisibleText(
    page.locator("#studioView #onDeviceNote"),
    "動画生成は端末内で行われます。外部に画像が送信されることはありません。",
  );
  await expect(toCommunity).toHaveText("みんなの #あのねジャンプ を見る");
  await expect(toCommunity).toHaveClass(/\bbtn\b/);

  await expect(page.locator("#browsersNote")).toHaveCount(0);
  const heroBox = await page.locator("#makerView .hero").boundingBox();
  const ctaBox = await page.locator("#toStudio").boundingBox();
  expect(heroBox && ctaBox && ctaBox.y >= heroBox.y && ctaBox.y < heroBox.y + heroBox.height).toBe(true);

  await expect(toCommunity).toHaveAttribute("href", MORE_JUMPS_HREF);
  await expect(toCommunity).toHaveAttribute("target", "_blank");
  await expect(toCommunity).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("#landingHashtags")).toHaveText(SHARE_TEXT);
  await openCommunityInApp(page);
  await expect(page).not.toHaveURL(/#community/);
  await expect(page).toHaveTitle("みんなの #あのねジャンプ");
  await expect(page.locator("#communityView")).toBeVisible();
  await expect(page.locator("#makerView")).toBeHidden();
  await expect(page.locator("#communityJumpsTitle")).toHaveText("みんなの #あのねジャンプ");
  await expect(page.locator("#communityJumpsTitle a")).toHaveCount(0);
  await expect(page.locator("#communityHashtag")).toHaveCount(0);
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
  const search = page.locator("#communityHashtagSearch");
  const searchX = page.locator('#communityHashtagSearch a[data-service="x"]');
  const searchIg = page.locator('#communityHashtagSearch a[data-service="instagram"]');
  const searchYt = page.locator('#communityHashtagSearch a[data-service="youtube"]');
  const searchTt = page.locator('#communityHashtagSearch a[data-service="tiktok"]');
  await expect(search).toBeVisible();
  await expect(page.locator("#communityHashtagSearch a.link-banner")).toHaveCount(4);
  await expect(searchX).toHaveAttribute(
    "href",
    `https://x.com/search?q=${encodeURIComponent("#あのねジャンプ")}`,
  );
  await expect(searchIg).toHaveAttribute(
    "href",
    `https://www.instagram.com/explore/tags/${encodeURIComponent("あのねジャンプ")}/`,
  );
  await expect(searchYt).toHaveAttribute(
    "href",
    `https://www.youtube.com/results?search_query=${encodeURIComponent("#あのねジャンプ")}`,
  );
  await expect(searchTt).toHaveAttribute(
    "href",
    `https://www.tiktok.com/tag/${encodeURIComponent("あのねジャンプ")}`,
  );
  for (const link of [searchX, searchIg, searchYt, searchTt]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(searchX).toHaveAttribute("aria-label", "Xで #あのねジャンプ を検索する（新しいタブ）");
  await expect(page.locator("#communityHashtagSearchHeading")).toHaveText("こっちにもあるよ");
  await expect(page.locator("#makerView .eyebrow")).toHaveCount(0);
  await expect(page.locator("#communityJumps .eyebrow")).toHaveCount(0);
  await expect(page.locator("#moreJumps")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "もっと見る" })).toHaveCount(0);
  const titleBox = await page.locator("#communityJumpsTitle").boundingBox();
  const ledeBox = await page.locator("#communityJumps .lede").boundingBox();
  const sortBox = await page.locator("#communitySort").boundingBox();
  const listBox = await page.locator("#communityJumpsList").boundingBox();
  expect(titleBox && ledeBox && titleBox.y < ledeBox.y).toBe(true);
  expect(ledeBox && sortBox && ledeBox.y < sortBox.y).toBe(true);
  expect(sortBox && listBox && sortBox.y < listBox.y).toBe(true);
  expect(titleBox && listBox && titleBox.y < listBox.y).toBe(true);
  await expect(page.locator("#communityJumps .community-jumps-item")).toHaveCount(50);
  await expect(page.locator("#communityJumpsList")).toHaveClass(/community-jumps-masonry/);
  await expect(page.locator("#communitySortNewest")).toBeChecked();
  await expect(page.locator("#communityJumps .community-jumps-item").first()).toHaveAttribute(
    "data-post-id",
    "2101803923954970918",
  );
  await expect(page.locator(".community-jumps-card[data-media='video']")).toHaveCount(50);
  await expect(page.locator("#communityJumpsPrev")).toHaveCount(0);
  await expect(page.locator("#communityPager")).toBeVisible();
  await expect(page.locator("#communityPagePrev")).toBeDisabled();
  await expect(page.locator("#communityPageNext")).toBeEnabled();
  await expect(page.locator(".community-page-num")).toHaveCount(0);
  await expect(page.locator("#communityPager [aria-current='page']")).toHaveCount(0);
  await expect(page.locator("#playBtn")).toBeHidden();

  const masonryCols = await page.locator("#communityJumpsList").evaluate((el) => {
    const n = Number(getComputedStyle(el).getPropertyValue("--community-masonry-cols"));
    return n === 2 || n === 3 ? n : 1;
  });
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const expectedCols = viewportWidth >= 768 ? 3 : viewportWidth >= 640 ? 2 : 1;
  expect(masonryCols).toBe(expectedCols);
  await expect(page.locator("#communityJumpsList")).toHaveAttribute("data-masonry-cols", String(expectedCols));

  const first = page.locator("#communityJumps .community-jumps-item").nth(0);
  const second = page.locator("#communityJumps .community-jumps-item").nth(1);
  const last = page.locator("#communityJumps .community-jumps-item").nth(49);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  const lastBox = await last.boundingBox();
  expect(firstBox && secondBox && lastBox).toBeTruthy();
  if (expectedCols === 1) {
    expect(firstBox && secondBox && firstBox.y < secondBox.y).toBe(true);
    expect(secondBox && lastBox && secondBox.y < lastBox.y).toBe(true);
  } else {
    expect(firstBox && secondBox && secondBox.x > firstBox.x + 40).toBe(true);
    expect(firstBox && secondBox && Math.abs(firstBox.y - secondBox.y) < 48).toBe(true);
    expect(firstBox && lastBox && lastBox.y > firstBox.y + 40).toBe(true);
  }

  if (viewportWidth >= 640) {
    const communityAppWidth = await page.locator(".app").evaluate((el) => el.getBoundingClientRect().width);
    expect(communityAppWidth).toBeGreaterThan(28 * 16);
  }

  const bottomBack = page.locator("#toMakerBottom");
  const lastAfter = page.locator("#communityJumps .community-jumps-item").nth(49);
  await lastAfter.scrollIntoViewIfNeeded();
  const lastAfterBox = await lastAfter.boundingBox();
  const pagerBox = await page.locator("#communityPager").boundingBox();
  const searchBox = await search.boundingBox();
  const bottomBox = await bottomBack.boundingBox();
  expect(lastAfterBox && pagerBox && lastAfterBox.y < pagerBox.y).toBe(true);
  expect(pagerBox && searchBox && pagerBox.y < searchBox.y).toBe(true);
  expect(searchBox && bottomBox && searchBox.y < bottomBox.y).toBe(true);
  await expect(page.locator(".community-jumps-card[data-hydrated='1']")).toHaveCount(50);
  await expect(bottomBack).toHaveAttribute("href", "/");

  // widgets.js が display:none 中に測ると iframe が潰れる。戻ったら blockquote から載せ直す。
  await page.evaluate(() => {
    const reactions = document.querySelector("#reactionsEmbed");
    if (reactions) {
      reactions.innerHTML = `<iframe class="twitter-tweet-rendered" height="0"></iframe>`.repeat(9);
    }
    for (const card of document.querySelectorAll<HTMLElement>(".community-jumps-card[data-hydrated='1']")) {
      card.innerHTML = `<iframe class="twitter-tweet-rendered" height="0"></iframe>`;
    }
  });

  await bottomBack.click();
  await expect(page).not.toHaveURL(/\/community/);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#toStudio")).toBeVisible();
  await expect(page.locator("#playBtn")).toBeHidden();
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    const makerAppWidth = await page.locator(".app").evaluate((el) => el.getBoundingClientRect().width);
    expect(makerAppWidth).toBeLessThanOrEqual(28 * 16 + 2);
  }
  await expect(page.getByRole("heading", { name: "あのねジャンプメーカー" })).toBeInViewport();
  await expect(page.locator("#communityView")).toBeHidden();
  await expect(page.locator("#reactionsTitle")).toBeVisible();
  await expect(page.locator("#reactionsEmbed blockquote.twitter-tweet")).toHaveCount(9);
  await expect(page.locator("#reactionsEmbed iframe.twitter-tweet-rendered")).toHaveCount(0);

  await openCommunityInApp(page);
  await expect(page.locator(".community-jumps-card[data-hydrated='1'] blockquote.twitter-tweet")).toHaveCount(50);
  await expect(page.locator(".community-jumps-card iframe.twitter-tweet-rendered")).toHaveCount(0);
});

test("hydrates community cards on the visible page after scrolling", async ({ page }) => {
  await page.goto("/community");
  await waitForAppReady(page);
  const items = page.locator("#communityJumps .community-jumps-item");
  await expect(items).toHaveCount(50);
  await expect(page.locator("#communityJumpsList")).toHaveClass(/community-jumps-masonry/);
  for (const index of [0, 1, 2, 25, 49]) {
    await items.nth(index).scrollIntoViewIfNeeded();
    await expect(items.nth(index).locator(".community-jumps-card")).toHaveAttribute("data-hydrated", "1");
    await expect(items.nth(index).locator("blockquote.twitter-tweet")).toHaveCount(1);
  }
  await page.locator("#toMakerBottom").scrollIntoViewIfNeeded();
  await expect(page.locator(".community-jumps-card[data-hydrated='1']")).toHaveCount(50);
});

test("pages 50 community posts with prev/next only and resets to page 1 when sorting", async ({ page }) => {
  await page.goto("/community");
  await waitForAppReady(page);
  const items = page.locator("#communityJumps .community-jumps-item");
  await expect(items).toHaveCount(50);
  await expect(page.locator("#communityPagePrev")).toBeDisabled();
  await expect(page.locator("#communityPageNext")).toBeEnabled();
  await expect(page.locator(".community-page-num")).toHaveCount(0);
  await expect(page.locator("#communityPager [aria-current='page']")).toHaveCount(0);
  await expect(items.first()).toHaveAttribute("data-post-id", "2101803923954970918");

  await page.locator("#communityPageNext").click();
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "2");
  await expect(items).toHaveCount(50);
  await expect(items.first()).not.toHaveAttribute("data-post-id", "2101803923954970918");
  await expect(page.locator("#communityPagePrev")).toBeEnabled();
  await expect(page.locator("#communityPageNext")).toBeEnabled();
  await expect(page.locator(".community-page-num")).toHaveCount(0);

  while (await page.locator("#communityPageNext").isEnabled()) {
    await page.locator("#communityPageNext").click();
  }
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "11");
  await expect(items).toHaveCount(15);
  await expect(items.last()).toHaveAttribute("data-post-id", "2009475998488961327");
  await expect(page.locator("#communityPageNext")).toBeDisabled();
  await expect(page.locator("#communityPagePrev")).toBeEnabled();
  await page.locator("#toMakerBottom").scrollIntoViewIfNeeded();
  await expect(page.locator(".community-jumps-card[data-hydrated='1']")).toHaveCount(15);

  await page.locator("#communitySort").scrollIntoViewIfNeeded();
  await page.locator("label:has(#communitySortPopular)").click();
  await expect(page.locator("#communitySortPopular")).toBeChecked();
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "1");
  await expect(page.locator("#communityPagePrev")).toBeDisabled();
  await expect(page.locator("#communityPageNext")).toBeEnabled();
  await expect(items).toHaveCount(50);
  await expect(items.first()).toHaveAttribute("data-post-id", "2084205622862725181");
});

test("uses three masonry columns on iPad-sized viewports and can sort by popularity", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/community");
  await waitForAppReady(page);
  await expect(page.locator("#communityJumpsList")).toHaveAttribute("data-masonry-cols", "3");
  const first = page.locator("#communityJumps .community-jumps-item").nth(0);
  const second = page.locator("#communityJumps .community-jumps-item").nth(1);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox && secondBox && secondBox.x > firstBox.x + 40).toBe(true);
  await expect(page.locator("#communityJumps .community-jumps-item").first()).toHaveAttribute(
    "data-post-id",
    "2101803923954970918",
  );
  await page.locator("#communityPageNext").click();
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "2");
  await page.locator("#communitySort").scrollIntoViewIfNeeded();
  await page.locator("label:has(#communitySortPopular)").click();
  await expect(page.locator("#communitySortPopular")).toBeChecked();
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "1");
  await expect(page.locator("#communityJumps .community-jumps-item").first()).toHaveAttribute(
    "data-post-id",
    "2084205622862725181",
  );
  await page.locator("label:has(#communitySortNewest)").click();
  await expect(page.locator("#communityJumps .community-jumps-item").first()).toHaveAttribute(
    "data-post-id",
    "2101803923954970918",
  );
  await expect(page.locator("#communityJumps")).toHaveAttribute("data-page", "1");
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

test("studio header uses the stacked hero logo and keeps language links at the bottom", async ({ page }) => {
  await page.goto("/make");
  await waitForAppReady(page);
  const lockup = page.locator("#studioHome");
  const landingLogo = page.locator("#makerTitle .hero-logo");
  await expect(lockup).toBeVisible();
  await expect(lockup).toHaveAttribute("href", "/");
  await expect(lockup.locator("img")).toHaveAttribute("src", "/brand/anone-logo-stacked.svg");
  await expect(lockup.locator("img")).toHaveAttribute("src", (await landingLogo.getAttribute("src")) ?? "");
  await expect(lockup.locator("img")).toHaveAttribute("width", (await landingLogo.getAttribute("width")) ?? "");
  await expect(lockup.locator("img")).toHaveAttribute("height", (await landingLogo.getAttribute("height")) ?? "");
  await expect(lockup.locator("img")).toHaveClass(/hero-logo/);
  await expect(lockup.locator("img")).toHaveAttribute("alt", "あのねジャンプメーカー");
  await expect(page.locator("#studioView .header-lockup")).toHaveCount(0);
  await expect(page.locator("#toLanding")).toHaveCount(0);
  await expect(page.locator("#studioView .studio-top .lang-switch")).toHaveCount(0);
  await expect(page.locator("#studioView .lang-switch")).toHaveCount(1);
  const lockupBox = await lockup.boundingBox();
  const langBox = await page.locator("#studioView .lang-switch").boundingBox();
  expect(lockupBox && lockupBox.width > 200).toBe(true);
  expect(lockupBox && langBox && langBox.y > lockupBox.y + lockupBox.height).toBe(true);
  const studioAlign = await headerAlign(page, ".studio-top", "#studioHome img", "#studioTitle");
  const noteBox = await page.locator("#onDeviceNote").boundingBox();
  const titleBox = await page.locator("#studioTitle").boundingBox();
  const noteGap = (noteBox?.y ?? 0) - ((titleBox?.y ?? 0) + (titleBox?.height ?? 0));
  expect(noteGap).toBeGreaterThan(0);
  expect(noteGap).toBeLessThan(22);
  await page.goto("/terms");
  const termsAlign = await headerAlign(page, "header.hero", "#legalHome", "#termsTitle");
  expect(studioAlign.headAlign).toBe("center");
  expect(studioAlign.titleAlign).toBe("center");
  expect(studioAlign.headAlign).toBe(termsAlign.headAlign);
  expect(studioAlign.titleAlign).toBe(termsAlign.titleAlign);
  expect(studioAlign.titleMarginTop).toBe(termsAlign.titleMarginTop);
  expect(studioAlign.titleMarginLeft).toBe(termsAlign.titleMarginLeft);
  expect(studioAlign.titleMarginRight).toBe(termsAlign.titleMarginRight);
  expect(studioAlign.titleMarginBottom).toBe(termsAlign.titleMarginBottom);
  expect(Math.abs(studioAlign.headMid - studioAlign.markMid)).toBeLessThan(2);
  expect(Math.abs(termsAlign.headMid - termsAlign.markMid)).toBeLessThan(2);
  await page.goto("/make");
  await waitForAppReady(page);
  await lockup.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("src", "/brand/anone-logo-stacked.svg");
});

async function headerAlign(page: Page, header: string, lockupSel: string, titleSel: string) {
  const metrics = await page.evaluate(
    ({ header, lockupSel, titleSel }) => {
      const head = document.querySelector(header);
      const mark = document.querySelector(lockupSel);
      const title = document.querySelector(titleSel);
      if (!head || !mark || !title) return null;
      const headBox = head.getBoundingClientRect();
      const markBox = mark.getBoundingClientRect();
      return {
        headAlign: getComputedStyle(head).textAlign,
        titleAlign: getComputedStyle(title).textAlign,
        markMargin: getComputedStyle(mark).margin,
        titleMarginTop: Number.parseFloat(getComputedStyle(title).marginTop),
        titleMarginRight: Number.parseFloat(getComputedStyle(title).marginRight),
        titleMarginBottom: Number.parseFloat(getComputedStyle(title).marginBottom),
        titleMarginLeft: Number.parseFloat(getComputedStyle(title).marginLeft),
        headMid: headBox.left + headBox.width / 2,
        markMid: markBox.left + markBox.width / 2,
      };
    },
    { header, lockupSel, titleSel },
  );
  expect(metrics).not.toBeNull();
  return metrics!;
}

async function openCommunityInApp(page: Page): Promise<void> {
  await page.evaluate(() => {
    history.pushState({}, "", "/community");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/community\/?$/);
  await expect(page.locator("#communityView")).toBeVisible();
}

async function uploadPhoto(page: Page): Promise<void> {
  await openStudio(page);
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("#previewSeek")).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("#previewTransport")).toBeVisible();
}

async function showPreviewChrome(page: Page): Promise<void> {
  if (await page.locator("#previewTransport").isHidden()) {
    await page.locator("#stage").click();
  }
  await expect(page.locator("#previewTransport")).toBeVisible();
}

async function settlePreviewPlayback(page: Page): Promise<void> {
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();
  if ((await page.locator("#previewFeedback").textContent())?.includes("再生できませんでした")) {
    await showPreviewChrome(page);
    await page.locator("#muteBtn").click();
    await page.locator("#previewToggle").click();
  }
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();
}

async function waitForExportOutcome(page: Page): Promise<"ready" | "unsupported"> {
  let outcome: "ready" | "unsupported" | "" = "";
  await expect
    .poll(
      async () => {
        if (await page.locator("#downloadExportBtn").isVisible()) {
          outcome = "ready";
          return outcome;
        }
        const feedback = ((await page.locator("#saveFeedback").textContent()) ?? "").trim();
        if (feedback.includes(UNSUPPORTED_EXPORT_MESSAGE)) {
          outcome = "unsupported";
          return outcome;
        }
        return "";
      },
      { timeout: 45_000 },
    )
    .not.toBe("");
  if (outcome === "") throw new Error("export outcome was empty");
  return outcome;
}
