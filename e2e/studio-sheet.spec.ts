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
  await expect(page.locator("#saveBtn")).toBeVisible();
  await expect(page.locator(".studio-status-pill")).toHaveText(
    t("ja", "studioStatus", { n: 2, state: t("ja", "previewStopped") }),
  );
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
  await expect(page.locator('label:has(input[name="aspect"][value="portrait"])')).toBeVisible();
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
  const handle = page.locator("#sheetHandle");
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(handle).toHaveAccessibleName(t("ja", "studioSheetCollapse"));
  await expect(handle).toContainText(t("ja", "studioSheetHintOpen"));
  const open = await rects(page);

  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect(handle).toHaveAccessibleName(t("ja", "studioSheetExpand"));
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

test("localized tabs and sheet copy", async ({ page }) => {
  await openEditor(page, "/en/make");
  await expect(page.getByRole("tab")).toHaveText([t("en", "studioTabPhotos"), t("en", "studioTabMotion"), t("en", "studioTabLook")]);
  await expect(page.locator("#sheetHandle")).toContainText(t("en", "studioSheetHintOpen"));
  await expect(page.locator(".studio-back")).toHaveText(t("en", "studioBack"));
  await expect(page.locator(".studio-back")).toHaveAttribute("href", "/en");
});
