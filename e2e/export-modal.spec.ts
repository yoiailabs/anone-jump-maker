import { expect, test, type Locator, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { blockAnalytics, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

async function prepareExport(page: Page) {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  // サムネイル列の描画でレイアウトが変わるため、保存ボタンへスクロールする前に待つ。
  await expect(page.locator("#thumbs img")).toHaveCount(1);
  await expect(page.locator("#saveBtn")).toBeEnabled();

  return pauseExport(page);
}

async function pauseExport(page: Page): Promise<(() => void) | null> {
  // 経過時間に依存せず、生成処理の fetch をテストから再開する。
  let release!: () => void;
  let requested = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/official-assets/template/landscape.mp4", async (route) => {
    if (route.request().resourceType() === "fetch") {
      requested = true;
      await gate;
    }
    await route.fallback();
  });
  try {
    await page.locator("#saveBtn").click();
    // VideoEncoder が無い／エンコードプランが無い場合は fetch より先に未対応になる。
    // 一方だけを待つ Promise を残さず、どちらの結果も確認する。
    const feedback = page.locator("#saveFeedback");
    await expect.poll(async () =>
      requested || ((await feedback.textContent()) ?? "").includes(UNSUPPORTED_EXPORT_MESSAGE),
      { timeout: 45_000 },
    ).toBe(true);
    if (!requested) {
      await expect(feedback).toBeVisible();
      await expect(feedback).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
      release();
      return null;
    }
    return release;
  } catch (error) {
    release();
    throw error;
  }
}

async function expectModalFocus(dialog: Locator) {
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
}

async function expectWithinViewport(dialog: Locator, page: Page) {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  expect(box!.width).toBeLessThanOrEqual(26 * 16);
}

test("generation blocks Escape, backdrop clicks and background focus until cancelled", async ({ page }) => {
  const release = await prepareExport(page);
  if (!release) return;
  const dialog = page.locator("#exportPanel");
  try {
    await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
    await expectModalFocus(dialog);
    for (const key of ["Tab", "Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      await expectModalFocus(dialog);
    }
    await page.locator("#filterTab").evaluate((el) => el.focus());
    await expectModalFocus(dialog);
    await page.mouse.click(1, 1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveAttribute("data-export-phase", "busy");
    await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
    await expect(page.locator("#saveBtn")).toBeDisabled();
    await expect(page.locator("#aspectTab")).toHaveAttribute("aria-selected", "true");
    await page.setViewportSize({ width: 412, height: 200 });
    await expectWithinViewport(dialog, page);
    expect(await dialog.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.locator("#cancelExportBtn").click();
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute("data-open");
    await expect(page.locator("#saveBtn")).toBeEnabled();
    await expect(page.locator("#saveBtn")).toBeFocused();
    await page.locator("#filterTab").click();
    await expect(page.locator("#filterTab")).toHaveAttribute("aria-selected", "true");
  } finally {
    release();
  }
});

test("generation survives three consecutive Escape presses and finishes with download focus", async ({ page }) => {
  const release = await prepareExport(page);
  if (!release) return;
  const dialog = page.locator("#exportPanel");
  try {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Escape");
      await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
      await expect(dialog).toHaveAttribute("data-export-phase", "busy");
      await expectModalFocus(dialog);
    }
    release();
    await expect(page.locator("#downloadExportBtn")).toBeFocused();
    await expect(dialog).toHaveAttribute("data-export-phase", "done");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute("data-open");
    await expect(page.locator("#saveBtn")).toBeFocused();
  } finally {
    release();
  }
});

test("leaving the studio while busy closes the modal without reopening it", async ({ page }) => {
  const release = await prepareExport(page);
  if (!release) return;
  const dialog = page.locator("#exportPanel");
  try {
    await page.evaluate(() => new Promise<void>((resolve) => {
      document.querySelector("#exportPanel")!.addEventListener("close", () => {
        requestAnimationFrame(() => resolve());
      }, { once: true });
      // ブラウザの戻る操作と同じ画面遷移を、生成中に発生させる。
      history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }));
    await expect(page.locator("#makerView")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute("data-open");
  } finally {
    release();
  }
});

test("native close restores a busy modal and clears a ready export without closing twice", async ({ page }) => {
  const release = await prepareExport(page);
  if (!release) return;
  const dialog = page.locator("#exportPanel");
  // close は非同期に届くため、イベント処理後のフレームまで待って状態を確認する。
  const nativeClose = (reopen = false) => dialog.evaluate((el, reopen) => new Promise<number>((resolve) => {
    const dialog = el as HTMLDialogElement;
    let count = 0;
    const onClose = () => {
      count++;
      requestAnimationFrame(() => {
        dialog.removeEventListener("close", onClose);
        resolve(count);
      });
    };
    dialog.addEventListener("close", onClose);
    dialog.close();
    if (reopen) {
      dialog.showModal();
      dialog.focus();
    }
  }), reopen);
  try {
    expect(await nativeClose()).toBe(1);
    await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
    await expect(dialog).toHaveAttribute("data-open", "true");
    await expect(dialog).toHaveAttribute("data-export-phase", "busy");
    await expectModalFocus(dialog);
    release();
    await expect(page.locator("#downloadExportBtn")).toBeFocused();
    // 開き直した後に届く古い close が完了済みの動画を破棄しないことも確認する。
    expect(await nativeClose(true)).toBe(1);
    await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
    await expect(dialog).toHaveAttribute("data-open", "true");
    const download = page.waitForEvent("download");
    await page.locator("#downloadExportBtn").click();
    await download;
    expect(await nativeClose()).toBe(1);
    await expect(dialog).toBeHidden();
    await expect(dialog).not.toHaveAttribute("data-open");
    await expect(page.locator("#saveBtn")).toBeFocused();
    const releaseNext = await pauseExport(page);
    if (!releaseNext) return;
    try {
      await expect(dialog).toHaveAttribute("data-export-phase", "busy");
      const closed = dialog.evaluate((el) => new Promise<void>((resolve) => {
        el.addEventListener("close", () => requestAnimationFrame(() => resolve()), { once: true });
      }));
      await page.locator("#cancelExportBtn").click();
      await closed;
      await expect(dialog).toBeHidden();
      await expect(dialog).not.toHaveAttribute("data-open");
      await expect(page.locator("#saveBtn")).toBeFocused();
    } finally {
      releaseNext();
    }
  } finally {
    release();
  }
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 412, height: 839 }, { width: 863, height: 360 }]) {
  test(`generation continues after Escape and closes on Escape when ready at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const release = await prepareExport(page);
    if (!release) return;
    const dialog = page.locator("#exportPanel");
    try {
      await expectWithinViewport(dialog, page);
      await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath("progress.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveAttribute("data-export-phase", "busy");
      release();
      await expect(page.locator("#downloadExportBtn")).toBeVisible();
      await expect(page.locator("#exportPanel:modal")).toHaveCount(1);
      await expect(dialog).not.toHaveAttribute("aria-describedby");
      await expect(page.locator("#exportProgressLabel")).toHaveText("100%");
      await expect(page.locator("#downloadExportBtn")).toBeFocused();
      await expectWithinViewport(dialog, page);
      await page.screenshot({ path: testInfo.outputPath("done.png") });
      await page.keyboard.press("Tab");
      await expect(page.locator("#closeExportBtn")).toBeFocused();
      await page.keyboard.press("Tab");
      await expectModalFocus(dialog);
      await page.mouse.click(1, 1);
      await expect(dialog).toBeVisible();
      const download = page.waitForEvent("download");
      await page.locator("#downloadExportBtn").click();
      expect((await download).suggestedFilename()).toMatch(/^anone-zoom-16x9\.(mp4|webm)$/);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(dialog).not.toHaveAttribute("data-open");
      await expect(page.locator("#saveBtn")).toBeFocused();
      const releaseNext = await pauseExport(page);
      if (!releaseNext) return;
      try {
        await expect(dialog).toHaveAttribute("data-export-phase", "busy");
        await expect(dialog).toHaveAttribute("aria-describedby", "exportKeepOpen");
        await expect(page.locator("#downloadExportBtn")).toBeHidden();
        await page.locator("#cancelExportBtn").click();
        await expect(dialog).toBeHidden();
      } finally {
        releaseNext();
      }
    } finally {
      release();
    }
  });
}

test("export errors close the modal and leave the feedback and page accessible", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "VideoEncoder", { configurable: true, value: undefined });
  });
  // 共通ヘルパーも fetch を待ち続けず、未対応の結果を返すことを確認する。
  expect(await prepareExport(page)).toBeNull();
  await expect(page.locator("#exportPanel")).toBeHidden();
  await expect(page.locator("#exportPanel")).not.toHaveAttribute("data-open");
  await expect(page.locator("#saveBtn")).toBeFocused();
  await page.locator("#filterTab").click();
  await expect(page.locator("#filterTab")).toHaveAttribute("aria-selected", "true");
});
