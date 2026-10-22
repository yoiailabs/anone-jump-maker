import { expect, test } from "@playwright/test";
import retiredColorFilters from "../tests/fixtures/retired-color-filters.json" with { type: "json" };
import { blockAnalytics, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

for (const invalid of [...retiredColorFilters, "future-filter"]) {
  test(`falls back to none for stale initial and changed color ${invalid}`, async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((value) => {
      // Inject a restored radio value at boot's actual initial-value read.
      const query = Element.prototype.querySelectorAll;
      Element.prototype.querySelectorAll = function (this: Element, selector: string) {
        const result = query.call(this, selector);
        if (this.id === "app" && selector === 'input[name="color_filter"]') {
          const input = Array.from(result).find((el) => (el as HTMLInputElement).value === "dynamic") as HTMLInputElement;
          input.value = value;
          input.checked = true;
          input.dataset.staleColor = "1";
          this.setAttribute("data-injected-color", value);
          Element.prototype.querySelectorAll = query;
        }
        return result;
      } as typeof query;
    }, invalid);
    await page.goto("/make");
    await waitForAppReady(page);
    await expect(page.locator("#app")).toHaveAttribute("data-injected-color", invalid);
    const none = page.locator('input[name="color_filter"][value="none"]');
    await expect(none).toBeChecked();
    await expect(page.locator('input[name="color_filter"]:checked')).toHaveCount(1);
    await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
    await expect(page.locator("#saveBtn")).toBeEnabled();
    await page.locator("#filterTab").click();

    // Exercise both changing an active color and an already-none state.
    await page.locator('label:has(input[name="color_filter"][value="film"])').click();
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator('input[data-stale-color="1"]').evaluate((el, value) => {
        const input = el as HTMLInputElement;
        input.value = value;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, invalid);
      await expect(none).toBeChecked();
      await expect(page.locator('input[name="color_filter"]:checked')).toHaveCount(1);
    }
    // The preview event reads app state, independently of the checked radio.
    await page.evaluate(() => {
      window.gtag = (_command, name, params) => {
        if (name === "video_preview") document.querySelector("#app")!.setAttribute("data-preview-params", JSON.stringify(params));
      };
    });
    await page.locator("#previewToggle").click();
    await expect(page.locator("#app")).toHaveAttribute("data-preview-params", /"color_filter":"none"/);
    await expect(page.locator("#app")).toHaveAttribute("data-preview-params", /"filter":"none"/);
    expect(errors).toEqual([]);
  });
}
