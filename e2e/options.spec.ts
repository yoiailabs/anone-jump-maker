import { expect, test, type Page, type Locator } from "@playwright/test";
import {
  blockAnalytics,
  chooseOption,
  openEditorTab,
  PHOTO_FILE,
  stubShortTemplate,
  waitForAppReady,
  type EditorTab,
} from "./helpers.ts";
import { inspectOptions } from "./options-layout.js";

const filmSelector = 'input[name="color_filter"][value="film"]';
const filterFrame = '.studio-option-row:has(input[name="color_filter"]) .option-scroll-frame';

// 編集シートのタブごとの radio 行。向き（aspect）はシートの外、プレビュー下の切り替えにある。
const TAB_ROWS: Record<EditorTab, string[]> = {
  photos: [],
  motion: ["swap", "character"],
  look: ["color_filter", "filter"],
};

async function expectRevealed(input: Locator) {
  await expect.poll(() => input.evaluate((node) => {
    const box = node.closest("label")!.getBoundingClientRect();
    const viewport = node.closest(".option-scroll")!.getBoundingClientRect();
    return box.left >= viewport.left - 0.5 && box.right <= viewport.right + 0.5;
  })).toBe(true);
}

/** 写真を 1 枚選んで編集シートを出す。オプションは写真を選んだあとに触る。 */
async function openEditor(page: Page) {
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "edit");
}

async function openEnlarged(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/make");
  await waitForAppReady(page);
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await openEditor(page);
  await openEditorTab(page, "look");
  await expect.poll(() => page.locator(filterFrame).getAttribute("data-fade-end")).toBe("true");
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});

for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440]) {
  for (const locale of ["ja", "en", "ko", "zh"]) {
    for (const fontSize of [100, 130, 160]) {
      test(`${locale}: all A1 rows fit ${width}px with ${fontSize}% text`, async ({ page }) => {
        await page.setViewportSize({ width, height: width >= 768 ? 800 : 844 });
        await page.goto(locale === "ja" ? "/make" : `/${locale}/make`);
        await waitForAppReady(page);
        await page.addStyleTag({ content: `html { font-size: ${fontSize}% !important; }` });
        await page.evaluate(() => document.fonts.ready);
        // 写真を選ぶ前は選ぶ導線だけ。設定の行もタブも出さない。
        await expect(page.getByRole("radiogroup")).toHaveCount(0);
        await expect(page.getByRole("tab")).toHaveCount(0);
        await openEditor(page);
        await expect(page.getByRole("tab")).toHaveCount(3);
        const sheet = page.locator(".studio-sheet");
        for (const [tab, names] of Object.entries(TAB_ROWS) as [EditorTab, string[]][]) {
          await openEditorTab(page, tab);
          await expect(sheet.getByRole("radiogroup")).toHaveCount(names.length);
          for (const row of await sheet.getByRole("radiogroup").all()) {
            await expect(row).toBeVisible();
            await expect(row).toHaveAccessibleName(await row.locator(".studio-option-label").innerText());
          }
          if (names.length === 0) continue;
          await expect.poll(async () => (await page.evaluate(inspectOptions)).issues).toEqual([]);
          expect((await page.evaluate(inspectOptions)).rows.map((row) => row.name)).toEqual(names);
          if (width >= 768 && fontSize === 100) {
            await expect.poll(async () => (await page.evaluate(inspectOptions)).rows
              .filter((row) => row.scrollWidth > row.clientWidth)).toEqual([]);
            for (const frame of await page.locator(".option-scroll-frame:visible").all()) {
              await expect(frame).toHaveAttribute("data-fade-start", "false");
              await expect(frame).toHaveAttribute("data-fade-end", "false");
            }
          }
        }
        if (width >= 768) {
          // デスクトップでは中央寄せの 1 カラム。
          const geometry = await page.evaluate(() => {
            const sheet = document.querySelector(".studio-sheet")!.getBoundingClientRect();
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
            return { width: sheet.width, max: 34 * rem, center: (sheet.left + sheet.right) / 2 };
          });
          expect(geometry.width).toBeLessThanOrEqual(Math.min(geometry.max, width) + 0.5);
          expect(geometry.center).toBeCloseTo(width / 2, 0);
        }
        // シートはプレビューに重ならない。
        const gap = await page.evaluate(() =>
          document.querySelector(".studio-sheet")!.getBoundingClientRect().top -
          document.querySelector("#stage")!.getBoundingClientRect().bottom,
        );
        expect(gap).toBeGreaterThanOrEqual(0);
      });
    }
  }
}

test("only overflowing rows scroll, show edge fades and reveal the selected film without moving the page", async ({ page }) => {
  await openEnlarged(page);
  const frame = page.locator(filterFrame);
  const scroller = frame.locator(".option-scroll");
  for (const tab of ["photos", "motion"] as const) {
    await openEditorTab(page, tab);
    for (const row of (await page.evaluate(inspectOptions)).rows) {
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    }
  }
  await openEditorTab(page, "look");
  const layout = await page.evaluate(inspectOptions);
  for (const row of layout.rows.filter((row) => row.name !== "color_filter")) {
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  }
  expect(layout.rows.find((row) => row.name === "color_filter")!.scrollWidth)
    .toBeGreaterThan(layout.rows.find((row) => row.name === "color_filter")!.clientWidth);
  // A subsequent choice is partially visible, so the fade accompanies a hint of its label.
  expect(await scroller.evaluate((element) => [...element.querySelectorAll("label")].some((label) => {
    const a = label.getBoundingClientRect(), b = element.getBoundingClientRect();
    return a.left > b.left && a.left < b.right && a.right > b.right;
  }))).toBe(true);
  await expect(frame).toHaveAttribute("data-fade-start", "false");
  await expect(frame).toHaveAttribute("data-fade-end", "true");
  expect(await frame.evaluate((el) => getComputedStyle(el, "::after").opacity)).toBe("1");
  await scroller.evaluate((el) => { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; });
  await expect(frame).toHaveAttribute("data-fade-start", "true");
  await expect(frame).toHaveAttribute("data-fade-end", "true");
  await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(frame).toHaveAttribute("data-fade-end", "false");
  await page.locator('label:has(input[name="color_filter"][value="film"])').click();
  await expect(page.locator(filmSelector)).toBeChecked();
  await expectRevealed(page.locator(filmSelector));
  const pageY = await page.evaluate(() => window.scrollY);
  // Programmatic setting uses the same change contract as app integrations.
  await page.locator('input[name="color_filter"][value="none"]').evaluate((input: HTMLInputElement) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(frame).toHaveAttribute("data-fade-start", "false");
  await expect(frame).toHaveAttribute("data-fade-end", "true");
  await page.locator(filmSelector).evaluate((input: HTMLInputElement) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expectRevealed(page.locator(filmSelector));
  await expect(frame).toHaveAttribute("data-fade-start", "true");
  await expect(frame).toHaveAttribute("data-fade-end", "false");
  expect(await page.evaluate(() => window.scrollY)).toBe(pageY);
  expect(await frame.evaluate((el) => getComputedStyle(el, "::before").opacity)).toBe("1");
  expect(await frame.evaluate((el) => getComputedStyle(el, "::after").opacity)).toBe("0");
});

test("native arrow keys move checked focus into view with an unclipped ring and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openEnlarged(page);
  const inputs = page.locator('input[name="color_filter"]');
  await inputs.first().focus();
  for (let i = 1; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(inputs.nth(i)).toBeChecked();
    await expect(inputs.nth(i)).toBeFocused();
    await expectRevealed(inputs.nth(i));
    expect(await inputs.nth(i).evaluate((input) => {
      const style = getComputedStyle(input.closest("label")!);
      return style.outlineStyle !== "none" && style.outlineWidth === "3px" && parseFloat(style.outlineOffset) < 0;
    })).toBe(true);
  }
  // WebKit stops at the group's end; use native leftward movement rather than
  // imposing Chromium's wraparound behavior on every browser.
  for (let i = 2; i >= 0; i--) {
    await page.keyboard.press("ArrowLeft");
    await expect(inputs.nth(i)).toBeChecked();
    await expect(inputs.nth(i)).toBeFocused();
    await expectRevealed(inputs.nth(i));
  }
  await expect(page.locator(`${filterFrame} .option-scroll`)).toHaveCSS("scroll-behavior", "auto");
});

test("initial programmatic selection before boot reveals film", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const query = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function (selector: string) {
      const result = query.call(this, selector);
      if (this.id === "app" && selector === 'input[name="color_filter"]') {
        (Array.from(result).find((node) => (node as HTMLInputElement).value === "film") as HTMLInputElement).checked = true;
        Element.prototype.querySelectorAll = query;
      }
      return result;
    } as typeof query;
  });
  await page.goto("/make");
  await waitForAppReady(page);
  await expect(page.locator(filmSelector)).toBeChecked();
  // The selection made while the look tab was hidden is revealed when it opens.
  await openEditor(page);
  await openEditorTab(page, "look");
  await expectRevealed(page.locator(filmSelector));
  // Resizing/reflow must keep the selection visible too.
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await expectRevealed(page.locator(filmSelector));
});

test("back navigation restores landscape, jump and film and reveals the restored choice", async ({ page }) => {
  await openEnlarged(page);
  // 既定は縦。既定でない横を選び、戻ってきたときに横のままかを見る。
  await chooseOption(page, "aspect", "landscape");
  await chooseOption(page, "swap", "jump");
  await openEditorTab(page, "look");
  await page.locator(`${filterFrame} .option-scroll`).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.locator('label:has(input[name="color_filter"][value="film"])').click();
  await page.goto("/privacy");
  await page.goBack();
  await waitForAppReady(page);
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await expect(page.locator('input[name="aspect"][value="landscape"]')).toBeChecked();
  await expect(page.locator('input[name="swap"][value="jump"]')).toBeChecked();
  await expect(page.locator(filmSelector)).toBeChecked();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "landscape");
  // Photos live only in memory; without the back/forward cache they are picked again.
  if ((await page.locator("#studioView").getAttribute("data-phase")) === "pick") await openEditor(page);
  await openEditorTab(page, "look");
  await expectRevealed(page.locator(filmSelector));
  for (const tab of ["motion", "look"] as const) {
    await openEditorTab(page, tab);
    await expect.poll(async () => (await page.evaluate(inspectOptions)).issues).toEqual([]);
  }
});
