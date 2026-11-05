import { expect, test, type Page } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { blockAnalytics, jpegInput, stubShortTemplate, waitForAppReady } from "./helpers.ts";

async function openEditor(page: Page, path = "/make") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await waitForAppReady(page);
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "pick");
  const files = await Promise.all([jpegInput("a.jpg"), jpegInput("b.jpg")]);
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "edit");
  await expect(page.locator("#previewSeek")).toBeEnabled();
}

/** 1 回のレイアウトで測る。シートの開閉中は位置が動くため。 */
function rects(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const { top, bottom, left, right, height, width } = document.querySelector(selector)!.getBoundingClientRect();
      return { top, bottom, left, right, height, width };
    };
    return { view: box("#studioView"), stage: box("#stage"), sheet: box(".studio-sheet"), save: box("#saveBtn") };
  });
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});

test("before photos, the picker leads and the editor sheet stays out of the way", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/make");
  await waitForAppReady(page);
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "pick");
  await expect(page.locator("#sheetHandle")).toBeHidden();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  // Only the photo picker is here, so it is not announced as the "Options" region.
  await expect(page.getByRole("region", { name: t("ja", "studioOptions") })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: t("ja", "studioOptions") })).toHaveCount(0);
  await expect(page.locator(".studio-back")).toBeHidden();
  const [label, stage] = await page.evaluate(() =>
    [".file-btn", "#stage"].map((selector) => document.querySelector(selector)!.getBoundingClientRect().toJSON()),
  );
  // The pill CTA is at least 56px tall and sits above the empty preview.
  expect(label.height).toBeGreaterThanOrEqual(56);
  expect(label.bottom).toBeLessThanOrEqual(stage.top);
  expect(label.bottom).toBeLessThanOrEqual(844);
});

test("after photos, preview and sheet share one phone screen", async ({ page }) => {
  await openEditor(page);
  await expect(page.locator(".studio-back")).toBeVisible();
  await expect(page.locator(".studio-back")).toHaveAttribute("href", "/");
  await expect(page.locator(".studio-back")).toHaveAccessibleName(t("ja", "studioBack"));
  await expect(page.locator("#saveBtn")).toBeVisible();
  await expect(page.locator(".studio-status-pill")).toHaveText(
    t("ja", "studioStatus", { n: 2, state: t("ja", "previewStopped") }),
  );
  await expect(page.getByRole("region", { name: t("ja", "studioOptions") })).toHaveCount(1);
  // Without notch or home indicator the safe-area padding adds nothing.
  await expect(page.locator(".studio-sheet")).toHaveCSS("padding-bottom", "0px");
  await expect(page.locator(".studio-player")).toHaveCSS("padding-top", "12px");
  await expect(page.locator(".studio-player")).toHaveCSS("padding-left", "20px");
  await expect(page.locator(".sheet-panels")).toHaveCSS("padding-right", "20px");
  const box = await rects(page);
  expect(box.view.top).toBeGreaterThanOrEqual(0);
  expect(box.view.bottom).toBeLessThanOrEqual(844 + 1);
  expect(box.save.top).toBeGreaterThanOrEqual(0);
  expect(box.save.height).toBeGreaterThanOrEqual(56);
  expect(box.stage.bottom).toBeLessThanOrEqual(box.sheet.top);
  expect(box.sheet.bottom).toBeLessThanOrEqual(844 + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("tabs switch panels by click and by arrow, Home and End keys", async ({ page }) => {
  await openEditor(page);
  const tabs = page.getByRole("tablist", { name: t("ja", "studioTabs") }).getByRole("tab");
  await expect(tabs).toHaveText([t("ja", "studioTabPhotos"), t("ja", "studioTabMotion"), t("ja", "studioTabLook")]);
  const photos = page.getByRole("tab", { name: t("ja", "studioTabPhotos") });
  const motion = page.getByRole("tab", { name: t("ja", "studioTabMotion") });
  const look = page.getByRole("tab", { name: t("ja", "studioTabLook") });

  await expect(photos).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName(t("ja", "studioTabPhotos"));
  await expect(page.locator(".thumb-add")).toBeVisible();
  // The aspect switch lives under the preview, not in any tab.
  await expect(page.locator('.sheet-panels input[name="aspect"]')).toHaveCount(0);
  await expect(page.locator('label:has(input[name="swap"][value="jump"])')).toBeHidden();

  await look.click();
  await expect(look).toHaveAttribute("aria-selected", "true");
  await expect(photos).toHaveAttribute("aria-selected", "false");
  await expect(page.locator('label:has(input[name="color_filter"][value="film"])')).toBeVisible();
  await expect(page.locator('label:has(input[name="filter"][value="blur-weak"])')).toBeVisible();
  await expect(page.locator(".thumb-add")).toBeHidden();

  // Roving tabindex: only the selected tab is in the Tab order.
  await expect(look).toHaveAttribute("tabindex", "0");
  await expect(photos).toHaveAttribute("tabindex", "-1");

  await look.focus();
  await page.keyboard.press("ArrowRight");
  await expect(photos).toBeFocused();
  await expect(photos).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(motion).toBeFocused();
  await expect(page.locator('label:has(input[name="swap"][value="jump"])')).toBeVisible();
  await expect(page.locator('label:has(input[name="character"][value="1.2"])')).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(photos).toBeFocused();
  await page.keyboard.press("End");
  await expect(look).toBeFocused();
  await expect(look).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(photos).toBeFocused();
  await expect(photos).toHaveAttribute("aria-selected", "true");

  // Options keep working from their tab; boot reads the same radios.
  await motion.click();
  await page.locator('label:has(input[name="swap"][value="jump"])').click();
  await expect(page.locator('input[name="swap"][value="jump"]')).toBeChecked();
  await expect(page.locator('label:has(input[name="swap"][value="jump"])')).toHaveCSS("border-top-color", "rgb(10, 111, 168)");
  // Hidden panels keep their radios mounted.
  await expect(page.locator('input[name="aspect"]')).toHaveCount(2);
  await expect(page.locator('input[name="color_filter"]')).toHaveCount(4);
});

test("the handle collapses and reopens the sheet by click and keyboard, growing the preview", async ({ page }) => {
  await openEditor(page);
  // Portrait is the default; fold in landscape first, then in portrait.
  await page.locator('label:has(input[name="aspect"][value="landscape"])').click();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "landscape");
  const handle = page.locator("#sheetHandle");
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  // The name starts with the visible hint so voice control users can say what they see,
  // then a separator (from messages) so the hint and the action are read as two phrases.
  const sep = t("ja", "studioSheetLabelSep");
  await expect(handle).toHaveAccessibleName(`${t("ja", "studioSheetHintOpen")}${sep}${t("ja", "studioSheetCollapse")}`);
  await expect(handle).toContainText(t("ja", "studioSheetHintOpen"));
  await expect(page.getByRole("button", { name: t("ja", "studioSheetHintOpen") })).toHaveAttribute("id", "sheetHandle");
  const open = await rects(page);

  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect(handle).toHaveAccessibleName(`${t("ja", "studioSheetHintClosed")}${sep}${t("ja", "studioSheetExpand")}`);
  await expect(handle).toContainText(t("ja", "studioSheetHintClosed"));
  await expect(page.locator("#studioSheetBody")).toHaveAttribute("inert", "");
  await expect(page.getByRole("tab", { name: t("ja", "studioTabPhotos") })).toBeHidden();
  await expect.poll(async () => (await rects(page)).sheet.height).toBeLessThan(open.sheet.height / 2);
  // Portrait is height-limited, so a shorter sheet makes it larger.
  await page.locator("#sheetHandle").click();
  await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await expect.poll(async () => (await rects(page)).sheet.height).toBeCloseTo(open.sheet.height, 0);
  const portraitOpen = await rects(page);

  await handle.focus();
  await page.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await rects(page)).stage.height).toBeGreaterThan(portraitOpen.stage.height + 100);
  const closed = await rects(page);
  expect(closed.view.bottom).toBeLessThanOrEqual(844 + 1);
  expect(closed.stage.bottom).toBeLessThanOrEqual(closed.sheet.top);

  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#studioSheetBody")).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("tab", { name: t("ja", "studioTabPhotos") })).toBeVisible();
});

test("dragging the handle down closes and dragging up opens; short drags do nothing", async ({ page }) => {
  await openEditor(page);
  const handle = page.locator("#sheetHandle");
  const drag = async (dy: number) => {
    // The handle moves while the sheet folds or opens; grab it only once it has settled.
    await expect.poll(() => handle.evaluate((el) => new Promise<boolean>((resolve) => {
      const before = el.getBoundingClientRect().top;
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(el.getBoundingClientRect().top === before)));
    }))).toBe(true);
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) await page.mouse.move(x, y + (dy * step) / 6);
    await page.mouse.up();
  };

  await drag(20);
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await drag(120);
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  // The click that follows a drag does not toggle the sheet a second time.
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await drag(-20);
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await drag(-90);
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".studio-sheet")).not.toHaveAttribute("style", /translate/);
});

test("focus rings are visible and reduced motion turns sheet transitions off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openEditor(page);
  const sheet = page.locator(".studio-sheet");
  await expect(sheet).toHaveCSS("transition-duration", "0s");
  await expect(page.locator(".sheet-body")).toHaveCSS("transition-duration", "0s");
  await page.locator("#sheetHandle").focus();
  await page.keyboard.press("Tab");
  const tab = page.getByRole("tab", { name: t("ja", "studioTabPhotos") });
  await expect(tab).toBeFocused();
  await expect(tab).toHaveCSS("outline-style", "solid");
  await expect(tab).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#sheetHandle")).toHaveCSS("outline-style", "solid");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(sheet).not.toHaveCSS("transition-duration", "0s");
});

test("removing every photo returns to the picker", async ({ page }) => {
  await openEditor(page);
  await page.locator(".thumb-remove").first().click();
  await page.locator(".thumb-remove").first().click();
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "pick");
  await expect(page.locator("#pickerLabel")).toHaveText(t("ja", "makerPickPhotos"));
  await expect(page.locator(".file-btn")).toBeVisible();
  await expect(page.locator("#sheetHandle")).toBeHidden();
});

/** 次に読み込む写真のデコードを止め、壊れたファイルを選ぶ。戻り値を呼ぶとデコードが進んで失敗する。 */
async function pickBrokenPhotoAndHold(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    const gate = new Promise<void>((resolve) => {
      (window as unknown as { releasePhotoDecode: () => void }).releasePhotoDecode = resolve;
    });
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await gate;
      return original(...args);
    }) as typeof createImageBitmap;
  });
  await page.locator("#picker").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("this is not a jpeg"),
  });
  await expect(page.locator("#photoFeedback")).toHaveAttribute("data-kind", "busy");
  return () => page.evaluate(() => (window as unknown as { releasePhotoDecode: () => void }).releasePhotoDecode());
}

async function expectPhotoErrorShown(page: Page) {
  const feedback = page.locator("#photoFeedback");
  await expect(feedback).toHaveAttribute("data-kind", "error");
  await expect(feedback).not.toHaveText("");
  await expect(feedback).toBeVisible();
  await expect(feedback).toBeInViewport();
  // Readable by assistive tech: not inside an inert or hidden subtree.
  await expect(page.locator("#sheetHandle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#studioSheetBody")).not.toHaveAttribute("inert");
  await expect(page.getByRole("tab", { name: t("ja", "studioTabPhotos") })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studioPanel-photos")).toBeVisible();
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2);
}

test("a photo load error that lands on another tab brings back the photos tab", async ({ page }) => {
  await openEditor(page);
  const release = await pickBrokenPhotoAndHold(page);
  await page.getByRole("tab", { name: t("ja", "studioTabMotion") }).click();
  const radio = page.locator('#studioPanel-motion input[name="swap"]').first();
  await radio.focus();
  await expect(page.locator("#photoFeedback")).toBeHidden();

  await release();
  await expectPhotoErrorShown(page);
  // Focus was in the panel that just hid, so it moves to the photos tab instead of falling to the page.
  await expect(page.getByRole("tab", { name: t("ja", "studioTabPhotos") })).toBeFocused();
});

test("a photo load error that lands while the sheet is collapsed reopens it", async ({ page }) => {
  await openEditor(page);
  const release = await pickBrokenPhotoAndHold(page);
  await page.getByRole("tab", { name: t("ja", "studioTabLook") }).click();
  const handle = page.locator("#sheetHandle");
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#photoFeedback")).toBeHidden();

  await release();
  await expectPhotoErrorShown(page);
  // Focus stays on the handle the user last pressed.
  await expect(handle).toBeFocused();
});

test("localized tabs and sheet copy", async ({ page }) => {
  await openEditor(page, "/en/make");
  await expect(page.getByRole("tab")).toHaveText([t("en", "studioTabPhotos"), t("en", "studioTabMotion"), t("en", "studioTabLook")]);
  await expect(page.locator("#sheetHandle")).toContainText(t("en", "studioSheetHintOpen"));
  await expect(page.locator("#sheetHandle")).toHaveAccessibleName(
    `${t("en", "studioSheetHintOpen")}${t("en", "studioSheetLabelSep")}${t("en", "studioSheetCollapse")}`,
  );
  await expect(page.locator(".studio-back")).toHaveAccessibleName(t("en", "studioBack"));
  await expect(page.getByRole("radiogroup", { name: t("en", "studioOptionAspect") }).getByRole("radio"))
    .toHaveCount(2);
  await expect(page.getByRole("radio", { name: t("en", "makerPortrait") })).toBeAttached();
  await expect(page.locator(".studio-back")).toHaveAttribute("href", "/en");

  const stopped = t("en", "previewStopped");
  await expect(page.locator(".studio-status-pill")).toHaveText(`2 photos · ${stopped}`);
  await page.locator(".thumb-remove").first().click();
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(1);
  await expect(page.locator(".studio-status-pill")).toHaveText(`1 photo · ${stopped}`);
});

test("on a notched phone the player and sheet keep clear of the safe-area insets", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Safe-area insets are emulated over the Chrome DevTools Protocol.");
  await openEditor(page);
  const inset = { top: 47, bottom: 34, left: 44, right: 44 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: inset });
  await expect(page.locator(".studio-sheet")).toHaveCSS("padding-bottom", `${inset.bottom}px`);

  const measure = () =>
    page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON() as DOMRect;
      return {
        view: box("#studioView"),
        save: box("#saveBtn"),
        stage: box("#stage"),
        sheet: box(".studio-sheet"),
        handle: box("#sheetHandle"),
        panels: box(".sheet-panels"),
        tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getBoundingClientRect().toJSON() as DOMRect),
        panelPad: parseFloat(getComputedStyle(document.querySelector(".sheet-panels")!).paddingBottom),
      };
    });

  const open = await measure();
  expect(open.save.top).toBeGreaterThanOrEqual(open.view.top + inset.top);
  expect(open.stage.left).toBeGreaterThanOrEqual(open.view.left + inset.left - 0.5);
  expect(open.stage.right).toBeLessThanOrEqual(open.view.right - inset.right + 0.5);
  expect(open.stage.bottom).toBeLessThanOrEqual(open.sheet.top);
  expect(open.tabs[0]!.left).toBeGreaterThanOrEqual(open.view.left + inset.left - 0.5);
  expect(open.tabs.at(-1)!.right).toBeLessThanOrEqual(open.view.right - inset.right + 0.5);
  // The panels' own bottom padding stays above the home indicator band.
  expect(open.sheet.bottom).toBeCloseTo(open.view.bottom, 0);
  expect(open.panels.bottom).toBeLessThanOrEqual(open.sheet.bottom - inset.bottom + 0.5);
  expect(open.panelPad).toBeGreaterThan(0);

  const handle = page.locator("#sheetHandle");
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  // Once folded, the handle sits right above the home indicator, not inside its swipe band.
  await expect
    .poll(async () => {
      const { view, handle: grip } = await measure();
      return view.bottom - grip.bottom;
    })
    .toBeCloseTo(inset.bottom, 0);
  const closed = await measure();
  expect(closed.sheet.bottom).toBeCloseTo(closed.view.bottom, 0);
  expect(closed.handle.height).toBeGreaterThanOrEqual(48);
});
