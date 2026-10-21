import { expect, test, type Page } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

// Check text ranges as well as boxes: overflow:hidden must not hide a regression.
async function expectOptionsFit(page: Page) {
  const issues = await page.locator(".studio-options").evaluate((section) => {
    const problems: string[] = [];
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport) problems.push("page scrolls horizontally");
    for (const element of section.querySelectorAll<HTMLElement>(".studio-option-tab, label")) {
      if (!element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      const text = element.textContent?.trim();
      if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
        problems.push(`${text}: overflows its box`);
      }
      if (box.left < 0 || box.right > viewport + 0.5) problems.push(`${text}: outside viewport`);
      if (box.height < 44) problems.push(`${text}: target below 44px`);
      for (const span of element.querySelectorAll("span")) {
        if (getComputedStyle(span).visibility === "hidden") continue;
        const range = document.createRange();
        range.selectNodeContents(span);
        for (const rect of range.getClientRects()) {
          if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5 ||
              rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5) {
            problems.push(`${text}: clipped text`);
          }
        }
      }
    }
    return problems;
  });
  expect(issues).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});

for (const width of [320, 375]) {
  for (const locale of ["ja", "en", "ko", "zh"]) {
    for (const fontSize of [100, 150]) {
      test(`${locale}: options fit ${width}px with ${fontSize}% text`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(locale === "ja" ? "/make" : `/${locale}/make`);
        await waitForAppReady(page);
        await page.addStyleTag({ content: `html { font-size: ${fontSize}% !important; }` });
        await page.evaluate(() => document.fonts.ready);
        for (const tab of await page.getByRole("tab").all()) {
          await tab.click();
          await expectOptionsFit(page);
        }
        // The stage's 8px shadow must end before the options heading starts.
        const gap = await page.evaluate(() =>
          document.querySelector("#studioOptionsTitle")!.getBoundingClientRect().top -
          document.querySelector("#stage")!.getBoundingClientRect().bottom,
        );
        expect(gap).toBeGreaterThan(8);
      });
    }
  }
}

test("tabs automatically select with arrows, Home and End and keep one tab stop", async ({ page }) => {
  await page.goto("/make");
  await waitForAppReady(page);
  const ids = ["aspect", "swap", "filter", "blur", "character"];
  await page.locator("#aspectTab").focus();
  for (const [key, id] of [
    ["ArrowRight", "swap"], ["ArrowDown", "filter"], ["End", "character"],
    ["ArrowRight", "aspect"], ["ArrowLeft", "character"], ["Home", "aspect"],
    ["ArrowUp", "character"],
  ]) {
    await page.keyboard.press(key!);
    for (const candidate of ids) {
      const selected = candidate === id;
      await expect(page.locator(`#${candidate}Tab`)).toHaveAttribute("tabindex", selected ? "0" : "-1");
      await expect(page.locator(`#${candidate}Tab`)).toHaveAttribute("aria-selected", String(selected));
      if (selected) {
        await expect(page.locator(`#${candidate}Tab`)).toBeFocused();
        await expect(page.locator(`#${candidate}Panel`)).toBeVisible();
      } else {
        await expect(page.locator(`#${candidate}Panel`)).toBeHidden();
      }
    }
  }
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="character"]:checked')).toBeFocused();
});

test("each summary follows the checked radio and tab changes preserve inputs", async ({ page }) => {
  await page.goto("/en/make");
  await waitForAppReady(page);
  const inputs = await page.locator('.studio-options input').elementHandles();
  for (const id of ["aspect", "swap", "filter", "blur", "character"]) {
    const tab = page.locator(`#${id}Tab`);
    await tab.click();
    for (const label of await page.locator(`#${id}Panel label`).all()) {
      await label.click();
      await expect(label.locator("input")).toBeChecked();
      const text = (await label.locator("span:not([aria-hidden])").textContent())!;
      await expect(tab.locator(".studio-option-tab-value")).toHaveText(text);
      const category = await tab.locator(".studio-option-tab-label").textContent();
      await expect(tab).toHaveAccessibleName(`${category} ${text}`);
      await expect(label.locator(".option-choice-check")).toHaveCSS("visibility", "visible");
    }
  }
  for (const input of inputs) expect(await input.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator('.studio-options input')).toHaveCount(inputs.length);
});

test("ten effects fit narrow enlarged text and reduced motion disables movement", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/make");
  await waitForAppReady(page);
  await page.addStyleTag({ content: "html { font-size: 160% !important; }" });
  await page.locator("#swapTab").click();
  // Temporary future options exercise the existing layout without shipping new effects.
  await page.locator("#swapPanel .aspect-toggle").evaluate((group) => {
    for (let i = 2; i < 10; i++) {
      const label = group.firstElementChild!.cloneNode(true) as HTMLElement;
      const input = label.querySelector("input")!;
      input.value = `future-${i}`;
      input.defaultChecked = false;
      input.checked = false;
      label.querySelector("span:last-child")!.textContent = `Future dramatic effect ${i}`;
      group.append(label);
    }
  });
  await expect(page.locator("#swapPanel label")).toHaveCount(10);
  await expectOptionsFit(page);
  for (const selector of ["#swapTab", "#swapPanel label:first-child"]) {
    const target = page.locator(selector);
    await target.hover();
    await expect(target).toHaveCSS("transform", "none");
    await expect(target).toHaveCSS("transition-duration", "0s");
  }
});

test("summaries match radios the browser restores on back navigation", async ({ page }) => {
  await page.goto("/make");
  await waitForAppReady(page);
  await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
  await page.locator("#swapTab").click();
  await page.locator('label:has(input[name="swap"][value="jump"])').click();
  await page.goto("/privacy");
  await page.goBack();
  await waitForAppReady(page);
  // Prove the browser actually restored the non-default choices first;
  // otherwise a reset to defaults would also pass the agreement checks below.
  await expect(page.locator('input[name="aspect"][value="portrait"]')).toBeChecked();
  await expect(page.locator('input[name="swap"][value="jump"]')).toBeChecked();
  // Restored radios, app state and the tab summaries must agree.
  for (const [name, tab, panel] of [["aspect", "#aspectTab", "#aspectPanel"], ["swap", "#swapTab", "#swapPanel"]] as const) {
    const checked = page.locator(`input[name="${name}"]:checked`);
    await expect(checked).toHaveCount(1);
    const label = await page.locator(`${panel} label:has(input:checked) span:not([aria-hidden])`).textContent();
    await expect(page.locator(`${tab} .studio-option-tab-value`)).toHaveText(label!);
  }
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", await page.locator('input[name="aspect"]:checked').inputValue());
});
