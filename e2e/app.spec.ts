import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { t, type Locale } from "../src/i18n.ts";
import { PHOTO_MAX_COUNT } from "../src/photo-list.ts";
import { playbackPositions } from "../src/timeline.ts";
import { MORE_JUMPS_HREF, SHARE_TEXT } from "../src/share.ts";
import { blockAnalytics, expectVisibleText, fileChooserFor, jpegInput, openStudio, PHOTO_FILE, stubShortTemplate, stripZwsp, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

for (const [locale, label] of [["ja", "グリッチ"], ["en", "Glitch"]] as const) {
  test(`${locale}: selects glitch after zoom and jump`, async ({ page }) => {
    if (locale === "en") {
      await page.goto("/en/make");
      await waitForAppReady(page);
    } else {
      await openStudio(page);
    }
    await page.locator("#swapTab").click();
    const choices = page.locator('#studioView input[name="swap"]');
    expect(await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)))
      .toEqual(["zoom", "jump", "glitch"]);
    const option = page.locator('#studioView label:has(input[name="swap"][value="glitch"])');
    await expect(option).toContainText(label);
    await option.click();
    await expect(page.locator('#studioView input[name="swap"][value="glitch"]')).toBeChecked();
    await page.locator("#aspectTab").click();
    await page.locator('#studioView label:has(input[name="aspect"][value="portrait"])').click();
    await page.locator("#swapTab").click();
    await expect(page.locator('#studioView input[name="swap"][value="glitch"]')).toBeChecked();
  });
}

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
  await expect(page.locator("img.loop")).toHaveAttribute("src", "/official-assets/jump-loop-still.png");
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute(
    "href",
    "/official-assets/jump-loop-still.png",
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
  expect(html).not.toContain('src="/official-assets/jump-loop.mp4"');
  expect(html).not.toContain("youtube-nocookie.com");
  expect(html).not.toContain("youtube.com/embed");
  const firstLoad = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    return {
      templateVideo: resources.some((name) => /\/official-assets\/template\/(landscape|vertical)\.mp4/.test(name)),
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
  const chooser = await fileChooserFor(page, () => page.keyboard.press("Enter"));
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
  await expect(page.locator("#aspectTab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('#studioView input[name="aspect"][value="landscape"]')).toBeVisible();
  await expect(page.locator('#studioView input[name="swap"][value="zoom"]')).toBeChecked();
  await expect(page.locator('#studioView input[name="swap"][value="jump"]')).toBeHidden();
  await expect(page.locator("#aspectPopover")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").some((entry) => /\/official-assets\/template\/(landscape|vertical)\.mp4/.test(entry.name)),
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

  await page.locator("#aspectTab").click();
  await page.locator('#studioView label:has(input[name="aspect"][value="portrait"])').click();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await page.locator("#swapTab").click();
  const zoomOption = page.locator('#studioView label:has(input[name="swap"][value="zoom"])');
  const jumpOption = page.locator('#studioView label:has(input[name="swap"][value="jump"])');
  await expect(zoomOption).toBeVisible();
  await expect(jumpOption).toBeVisible();
  expect((await zoomOption.boundingBox())?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(
    (await jumpOption.boundingBox())?.x ?? 0,
  );
  await jumpOption.click();
  await expect(page.locator('#studioView input[name="swap"][value="jump"]')).toBeChecked();
  await page.locator("#blurTab").click();
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
  let releaseTemplate!: () => void;
  const templateGate = new Promise<void>((resolve) => { releaseTemplate = resolve; });
  await page.route("**/official-assets/template/*.mp4", async (route) => {
    await templateGate;
    await route.fallback();
  });
  const dialog = page.locator("#exportPanel");
  await page.locator("#saveBtn").click();
  try {
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  } catch {
    releaseTemplate();
    await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }
  await expect(page.locator("#exportTitle")).toHaveText("動画を生成中");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(dialog).toHaveAttribute("aria-labelledby", "exportTitle");
  await expect(dialog).toHaveAttribute("aria-describedby", "exportKeepOpen");
  await expect(page.locator("#saveBtn")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-export-phase", "busy");
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
  releaseTemplate();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(dialog).not.toHaveAttribute("data-open");
  await expect(page.locator("#saveBtn")).toBeFocused();
  await expect(page.locator("#saveFeedback")).toBeHidden();
  await expect(page.locator("#saveFeedback")).not.toContainText("生成をキャンセルしました");
});

test("adds, reorders, and removes photos after the first pick", async ({ page }) => {
  await openStudio(page);
  await expect(page.locator("#pickerLabel")).toHaveText("写真を選ぶ");
  await expect(page.locator("#pickHint")).toBeVisible();
  await expect(page.locator("#pickHint")).toHaveText(t("ja", "makerPhotoCountHint"));
  await expect(page.locator("#pickHint")).toHaveClass(/\bmake-note\b/);
  const hintType = await page.locator("#pickHint").evaluate((hint) => {
    const note = document.querySelector("#onDeviceNote");
    if (!note) return null;
    const hintStyle = getComputedStyle(hint);
    const noteStyle = getComputedStyle(note);
    return {
      fontSize: hintStyle.fontSize === noteStyle.fontSize,
      fontWeight: hintStyle.fontWeight === noteStyle.fontWeight,
      color: hintStyle.color === noteStyle.color,
      lineHeight: hintStyle.lineHeight === noteStyle.lineHeight,
    };
  });
  expect(hintType).toEqual({ fontSize: true, fontWeight: true, color: true, lineHeight: true });
  const labelBox = await page.locator("#pickerLabel").boundingBox();
  const hintBox = await page.locator("#pickHint").boundingBox();
  expect(labelBox && hintBox && hintBox.y >= labelBox.y + labelBox.height - 2).toBe(true);
  expect(
    labelBox &&
      hintBox &&
      hintBox.x < labelBox.x + labelBox.width &&
      hintBox.x + hintBox.width > labelBox.x,
  ).toBe(true);
  await expect(page.locator("#thumbs")).toBeHidden();
  await expect(page.locator("#thumbsHint")).toBeHidden();

  await uploadPhoto(page);
  await expect(page.locator("#pickerLabel")).toHaveText("写真を追加");
  await expect(page.locator("#pickHint")).toHaveText(t("ja", "makerPhotoCountHint"));
  await expectVisibleText(page.locator("#thumbsHint"), "長押しして画像の順序を変更できます。");
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".thumb-add")).toBeVisible();

  const extra = await jpegInput("extra.jpg");
  const chooser = await fileChooserFor(page, () => page.locator(".thumb-add").click());
  await chooser.setFiles({ name: extra.name, mimeType: extra.mimeType, buffer: extra.buffer });
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "extra.jpg");

  await page.locator(".thumb").nth(0).press("ArrowRight");
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "extra.jpg");
  await expect(page.locator("#thumbs img").nth(1)).toHaveAttribute("alt", "photo.jpg");
  await expect(page.locator(".thumb").nth(0).locator(".thumb-index")).toHaveText(
    playbackPositions(0, 2).map(String),
  );
  await expect(page.locator(".thumb").nth(1).locator(".thumb-index")).toHaveText(
    playbackPositions(1, 2).map(String),
  );

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
  const files = await Promise.all(Array.from({ length: PHOTO_MAX_COUNT + 1 }, (_, i) => jpegInput(`p${i}.jpg`)));
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(PHOTO_MAX_COUNT, { timeout: 45_000 });
  await expect(page.locator("#thumbs img").nth(0)).toHaveAttribute("alt", "p0.jpg");
  await expect(page.locator("#thumbs img").nth(PHOTO_MAX_COUNT - 1)).toHaveAttribute("alt", `p${PHOTO_MAX_COUNT - 1}.jpg`);
  await expect(page.locator(".thumb-add")).toBeDisabled();
  await expect(page.locator("#pickerLabel")).toHaveText(t("ja", "makerPhotosFull", { n: PHOTO_MAX_COUNT }));
  await expect
    .poll(async () => stripZwsp((await page.locator("#thumbsHint").textContent()) ?? ""))
    .toBe(t("ja", "makerThumbsHintFull", { n: PHOTO_MAX_COUNT }));
  await expect(page.locator("#photoFeedback")).not.toContainText("失敗");
});

test("shows each photo's playback positions on its thumbnail", async ({ page }) => {
  await openStudio(page);
  const files = await Promise.all([jpegInput("a.jpg"), jpegInput("b.jpg"), jpegInput("c.jpg")]);
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator(".thumb").nth(0).locator(".thumb-index")).toHaveText(
    playbackPositions(0, 3).map(String),
  );
  await expect(page.locator(".thumb").nth(1).locator(".thumb-index")).toHaveText(
    playbackPositions(1, 3).map(String),
  );
  await expect(page.locator(".thumb").nth(2).locator(".thumb-index")).toHaveText(
    playbackPositions(2, 3).map(String),
  );
  const clip = await page.locator(".thumb").nth(0).evaluate((thumb) => {
    const row = thumb.querySelector(".thumb-indexes");
    const badges = [...thumb.querySelectorAll(".thumb-index")];
    if (!row || badges.length < 2) return null;
    const rowStyle = getComputedStyle(row);
    const badgeStyle = getComputedStyle(badges[0]!);
    const rowBox = row.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();
    const first = badges[0]!.getBoundingClientRect();
    const second = badges[1]!.getBoundingClientRect();
    return {
      display: rowStyle.display,
      flexWrap: rowStyle.flexWrap,
      overflow: rowStyle.overflow,
      clipped: row.scrollWidth > row.clientWidth + 1,
      inside:
        rowBox.left >= thumbBox.left - 1 &&
        rowBox.right <= thumbBox.right + 1 &&
        rowBox.bottom <= thumbBox.bottom + 1,
      separate: second.left >= first.right - 1,
      badgeMinWidth: badgeStyle.minWidth,
      badgeHeight: badgeStyle.height,
      badgeRadius: badgeStyle.borderRadius,
      badgeAlign: badgeStyle.textAlign,
      rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });
  expect(clip?.display).toBe("flex");
  expect(clip?.flexWrap).toBe("nowrap");
  expect(clip?.overflow).toBe("hidden");
  expect(clip?.clipped).toBe(true);
  expect(clip?.inside).toBe(true);
  expect(clip?.separate).toBe(true);
  expect(clip && Math.abs(parseFloat(clip.badgeMinWidth) - clip.rootPx * 1.2)).toBeLessThan(0.5);
  expect(clip && Math.abs(parseFloat(clip.badgeHeight) - clip.rootPx * 1.2)).toBeLessThan(0.5);
  expect(clip && Math.abs(parseFloat(clip.badgeRadius) - clip.rootPx * 0.4)).toBeLessThan(0.5);
  expect(clip?.badgeAlign).toBe("center");
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
  await expect(page.locator(".thumb").nth(0).locator(".thumb-index")).toHaveText(
    playbackPositions(0, 2).map(String),
  );
  await expect(page.locator(".thumb").nth(1).locator(".thumb-index")).toHaveText(
    playbackPositions(1, 2).map(String),
  );

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
    expect(download.suggestedFilename()).toMatch(/^anone-zoom-16x9\.(mp4|webm)$/);
    await expect(page.locator("#exportStatus")).toBeHidden();
    await expect(page.locator("#exportStatus")).toHaveText("");
    await expect(page.locator("#saveFeedback")).toBeHidden();
    await page.locator("#closeExportBtn").click();
    await expect(exportDialog).toBeHidden();
    await expect(exportDialog).not.toHaveAttribute("data-open");
    await expect(page.locator("#saveBtn")).toBeFocused();
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
  expect(payload?.name).toMatch(/^anone-zoom-16x9\.(mp4|webm)$/);
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

test("keeps the hashtag search button on the maker and leaves reactions in place", async ({ page }) => {
  await expect(page.locator(".app-tabs")).toHaveCount(0);
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#communityView")).toHaveCount(0);
  await expect(page.locator("#toStudio")).toBeVisible();
  await expect(page.locator("#makerView #picker")).toHaveCount(0);
  await expect(page.locator("#reactionsTitle")).toBeVisible();
  await expect(page.locator("#officialMvTitle")).toHaveText("「あのね」MV");
  await expect(page.locator("#makerView .loop-link")).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=M-IayQIR0XA&t=63s",
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#reactionsEmbed")).toBeAttached();
});

test("opens retired community URLs on the locale top page", async ({ page }) => {
  const cases = [
    ["/community", "/"],
    ["/community/", "/"],
    ["/ja/community", "/"],
    ["/en/community", "/en"],
    ["/ko/community/", "/ko"],
    ["/zh/community", "/zh"],
  ] as const;
  for (const [from, expected] of cases) {
    await page.goto(from);
    await expect.poll(() => new URL(page.url()).pathname.replace(/\/$/, "") || "/").toBe(expected);
    await waitForAppReady(page);
    await expect(page.locator("#makerView")).toBeVisible();
    await expect(page.locator("#communityView")).toHaveCount(0);
    await expect(page.locator("#toCommunity")).toHaveAttribute("href", MORE_JUMPS_HREF);
    await expect(page.locator("#toCommunity")).toHaveAttribute("target", "_blank");
  }
});

test("drops a leftover #community hash back on the maker", async ({ page }) => {
  await page.goto("/#community");
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/#community/);
  await expect(page.locator("#makerView")).toBeVisible();
  await expect(page.locator("#toCommunity")).toHaveAttribute("href", MORE_JUMPS_HREF);
  await expect(page.locator("#toCommunity")).toHaveAttribute("target", "_blank");
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

async function uploadPhoto(page: Page, file: string | Awaited<ReturnType<typeof jpegInput>> = PHOTO_FILE.path): Promise<void> {
  await openStudio(page);
  await page.locator("#picker").setInputFiles(file);
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

async function waitForExportOutcome(page: Page, locale: Locale = "ja"): Promise<"ready" | "unsupported"> {
  let outcome: "ready" | "unsupported" | "" = "";
  await expect
    .poll(
      async () => {
        if (await page.locator("#downloadExportBtn").isVisible()) {
          outcome = "ready";
          return outcome;
        }
        const feedback = stripZwsp((await page.locator("#saveFeedback").textContent()) ?? "").trim();
        if (feedback.includes(t(locale, "errorUnsupportedExport"))) {
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

for (const locale of ["ja", "en"] as const) {
  test(`${locale}: combines color filters and blur at 375px and names the saved clip`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // A single cut keeps transition effects out of the photo/filter comparison.
    await page.route("**/official-assets/template/landscape-cuts.json", (route) => route.fulfill({
      json: { duration: 0.5, fps: 30, slots: [0] },
    }));
    await page.goto(locale === "ja" ? "/make" : "/en/make");
    await waitForAppReady(page);
    // Stripes make both the photo layer and changes in blur observable.
    const photo = await page.evaluate(() => {
      const image = document.createElement("canvas");
      image.width = 96;
      image.height = 64;
      const ctx = image.getContext("2d")!;
      ctx.fillStyle = "rgb(204, 84, 49)";
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.fillStyle = "#f0dca0";
      for (let x = 0; x < image.width; x += 16) ctx.fillRect(x, 0, 8, image.height);
      return image.toDataURL("image/png").split(",")[1]!;
    });
    await uploadPhoto(page, { name: "striped-photo.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") });
    await expect(page.locator("#saveBtn")).toBeEnabled();
    await expect(page.locator(".studio-option-tab")).toHaveCount(5);
    const tabs = page.locator(".studio-option-tabs");
    expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const tab of await page.locator(".studio-option-tab").all()) {
      const box = await tab.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
      expect(await tab.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await expect(page.locator("#blurTab")).toHaveText(locale === "ja" ? "ブラー" : "Blur");
    await expect(page.locator('input[name="filter"][value="none"]')).toBeChecked();
    await expect(page.locator('input[name="color_filter"][value="none"]')).toBeChecked();
    const canvas = page.locator("canvas.stage-canvas");
    // Sample photo detail through the fixture's static green bar. Its moving
    // horizontal band lies outside this rectangle: pausing the media clock does
    // not guarantee the decoder's last frame was already copied to the canvas.
    // Whole-canvas PNG equality can therefore fail on a later filter repaint.
    const photoPixels = () => canvas.evaluate((el: HTMLCanvasElement) => Array.from(
      el.getContext("2d")!.getImageData(
        Math.floor(el.width * 0.65), Math.floor(el.height * 0.25), Math.floor(el.width * 0.07), 1,
      ).data,
    ));
    // The initial WebKit canvas can still be black. Wait for photo detail.
    await page.locator("#previewToggle").click();
    await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
    const expectPhotoDrawn = async () => {
      await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => {
        // This rectangle is inside the fixture video's solid green bar. Only
        // the striped photo underneath can add horizontal contrast here, even
        // with the character keyer's partial alpha.
        const { data } = el.getContext("2d")!.getImageData(
          Math.floor(el.width * 0.65), Math.floor(el.height * 0.25), Math.floor(el.width * 0.07), 1,
        );
        let min = 255;
        let max = 0;
        for (let i = 0; i < data.length; i += 4) {
          min = Math.min(min, data[i]!);
          max = Math.max(max, data[i]!);
        }
        return max - min;
      })).toBeGreaterThan(5);
    };
    await expectPhotoDrawn();
    await showPreviewChrome(page);
    await page.locator("#previewToggle").click();
    await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
    await expectPhotoDrawn();
    const video = page.locator("video.offscreen-video");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused && !el.seeking)).toBe(true);
    const pausedTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    const original = await photoPixels();
    await page.locator("#filterTab").click();
    await expect(page.locator('#filterPanel input[type="radio"]')).toHaveCount(4);
    expect(await page.locator('input[name="color_filter"]').evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    )).toEqual(["none", "dynamic", "dramatic", "film"]);
    await page.locator('label:has(input[name="color_filter"][value="film"])').click();
    await expect.poll(photoPixels).not.toEqual(original);
    const film = await photoPixels();
    await page.locator('label:has(input[name="color_filter"][value="none"])').click();
    await expect.poll(photoPixels).toEqual(original);
    await page.locator('label:has(input[name="color_filter"][value="film"])').click();
    await expect.poll(photoPixels).toEqual(film);
    await page.locator("#blurTab").click();
    await page.locator('label:has(input[name="filter"][value="blur-weak"])').click();
    await expect.poll(photoPixels).not.toEqual(film);
    await page.locator('label:has(input[name="filter"][value="none"])').click();
    await expect.poll(photoPixels).toEqual(film);
    await page.locator('label:has(input[name="filter"][value="blur-weak"])').click();
    await expect.poll(photoPixels).not.toEqual(film);
    expect(await video.evaluate((el: HTMLVideoElement) => ({ time: el.currentTime, paused: el.paused, seeking: el.seeking })))
      .toEqual({ time: pausedTime, paused: true, seeking: false });
    await page.locator("#aspectTab").click();
    await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
    await page.locator('label:has(input[name="aspect"][value="landscape"])').click();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "landscape");
    await expect(page.locator('input[name="filter"][value="blur-weak"]')).toBeChecked();
    await expect(page.locator('input[name="color_filter"][value="film"]')).toBeChecked();
    await page.evaluate(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }));
    await page.locator("#saveBtn").click();
    const outcome = await waitForExportOutcome(page, locale);
    if (outcome === "unsupported") {
      await expect(page.locator("#exportPanel")).toBeHidden();
      await expect(page.locator("#saveFeedback")).toBeVisible();
      await expectVisibleText(page.locator("#saveFeedback"), t(locale, "errorUnsupportedExport"));
      return;
    }
    await expect(page.locator("#exportPanel")).toHaveAttribute("data-export-phase", "done");
    const download = page.waitForEvent("download");
    await page.locator("#downloadExportBtn").click();
    expect((await download).suggestedFilename()).toMatch(/^anone-zoom-16x9-blur-weak-film\.(mp4|webm)$/);
  });
}
