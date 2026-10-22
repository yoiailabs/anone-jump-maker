import { expect, test, type Page, type Locator } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";
import { inspectOptions } from "./options-layout.js";

const filmSelector = 'input[name="color_filter"][value="film"]';
const filterFrame = '.studio-option-row:has(input[name="color_filter"]) .option-scroll-frame';

async function expectRevealed(input: Locator) {
  await expect.poll(() => input.evaluate((node) => {
    const box = node.closest("label")!.getBoundingClientRect();
    const viewport = node.closest(".option-scroll")!.getBoundingClientRect();
    return box.left >= viewport.left - 0.5 && box.right <= viewport.right + 0.5;
  })).toBe(true);
}

async function openEnlarged(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/make");
  await waitForAppReady(page);
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(filterFrame).getAttribute("data-fade-end")).toBe("true");
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});

for (const width of [320, 360, 375, 390, 414, 1024, 1280]) {
  for (const locale of ["ja", "en", "ko", "zh"]) {
    for (const fontSize of [100, 130, 160]) {
      test(`${locale}: all A1 rows fit ${width}px with ${fontSize}% text`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(locale === "ja" ? "/make" : `/${locale}/make`);
        await waitForAppReady(page);
        await page.addStyleTag({ content: `html { font-size: ${fontSize}% !important; }` });
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole("radiogroup")).toHaveCount(5);
        await expect(page.getByRole("tab")).toHaveCount(0);
        for (const row of await page.getByRole("radiogroup").all()) {
          await expect(row).toBeVisible();
          await expect(row).toHaveAccessibleName(await row.locator(".studio-option-label").innerText());
        }
        await expect.poll(async () => (await page.evaluate(inspectOptions)).issues).toEqual([]);
        const gap = await page.evaluate(() =>
          document.querySelector("#studioOptionsTitle")!.getBoundingClientRect().top -
          document.querySelector("#stage")!.getBoundingClientRect().bottom,
        );
        expect(gap).toBeGreaterThan(8);
      });
    }
  }
}

test("only overflowing rows scroll, show edge fades and reveal the selected film without moving the page", async ({ page }) => {
  await openEnlarged(page);
  const frame = page.locator(filterFrame);
  const scroller = frame.locator(".option-scroll");
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
  await expectRevealed(page.locator(filmSelector));
  // Resizing/reflow must keep the selection visible too.
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await expectRevealed(page.locator(filmSelector));
});

test("back navigation restores portrait, jump and film and reveals the restored choice", async ({ page }) => {
  await openEnlarged(page);
  await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
  await page.locator('label:has(input[name="swap"][value="jump"])').click();
  await page.locator(`${filterFrame} .option-scroll`).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.locator('label:has(input[name="color_filter"][value="film"])').click();
  await page.goto("/privacy");
  await page.goBack();
  await waitForAppReady(page);
  await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
  await expect(page.locator('input[name="aspect"][value="portrait"]')).toBeChecked();
  await expect(page.locator('input[name="swap"][value="jump"]')).toBeChecked();
  await expect(page.locator(filmSelector)).toBeChecked();
  await expectRevealed(page.locator(filmSelector));
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await expect.poll(async () => (await page.evaluate(inspectOptions)).issues).toEqual([]);
});
