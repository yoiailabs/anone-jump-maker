import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { SHARE_TEXT } from "../src/share.ts";
import { blockAnalytics, goToWizardStep, jpegInput, PHOTO_FILE, stubShortTemplate, stripZwsp, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
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
  await goToWizardStep(page, 3);
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
  await expect(page.locator(".wizard-photos .step-note")).toBeVisible();
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
  expect(thumbsStyle.overflowX).toBe("visible");
  await expect
    .poll(async () => page.locator(".thumb").first().evaluate((el) => getComputedStyle(el).touchAction))
    .toBe("auto");
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
  await goToWizardStep(page, 3);
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

test("copies hashtags from the panel", async ({ page, context, browserName }) => {
  await uploadPhoto(page);
  await goToWizardStep(page, 3);
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.locator("#copyHashtagsBtn").click();
  await expect(page.locator("#status")).toContainText(/コピーしました|コピーできません/);
});

test("share button sends hashtag text only", async ({ page }) => {
  await uploadPhoto(page);
  await goToWizardStep(page, 3);
  await page.evaluate(() => {
    const calls: ShareData[] = [];
    Object.assign(window, { __shareCalls: calls });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        calls.push(data);
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  });
  await page.locator("#shareAppBtn").click();
  await expect(page.locator("#status")).toContainText("ハッシュタグを共有先に渡しました");
  const payload = await page.evaluate(() => (window as unknown as { __shareCalls: ShareData[] }).__shareCalls[0]);
  expect(payload).toEqual({ text: SHARE_TEXT });
  expect(payload).not.toHaveProperty("url");
  expect(payload).not.toHaveProperty("title");
});

test("share fallback copies hashtags instead of a URL", async ({ page, context, browserName }) => {
  await uploadPhoto(page);
  await goToWizardStep(page, 3);
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  });
  await page.locator("#shareAppBtn").click();
  await expect(page.locator("#status")).toContainText(/ハッシュタグをコピーしました|コピーしてください|コピーできません/);
  if (browserName === "chromium") {
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(SHARE_TEXT);
  }
});

async function uploadPhoto(page: Page): Promise<void> {
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#status")).toContainText("1 枚を読み込みました", { timeout: 20_000 });
  await expect(page.locator("#playBtn")).toBeEnabled({ timeout: 20_000 });
  await goToWizardStep(page, 1);
}

async function settlePreviewPlayback(page: Page): Promise<void> {
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();
  if ((await page.locator("#status").textContent())?.includes("再生できませんでした")) {
    await page.locator("#muteBtn").click();
    await page.locator("#stage").click();
  }
  await expect(page.locator("#stage canvas.stage-canvas")).toBeVisible();
}
