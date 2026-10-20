import { expect, test } from "@playwright/test";
import { blockAnalytics, openStudio, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

for (const aspect of ["landscape", "portrait"] as const) {
  test(`${aspect}: selects flip and plays the preview`, async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
    await page.goto("/");
    await waitForAppReady(page);
    await openStudio(page);
    await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
    await expect(page.locator("#thumbs img")).toHaveCount(1);
    await expect(page.locator("#previewSeek")).toBeEnabled();
    await page.locator("#swapTab").click();
    const values = await page.locator('input[name="swap"]').evaluateAll(
      (inputs) => inputs.map((input) => (input as HTMLInputElement).value),
    );
    expect(values).toEqual(["zoom", "jump", "flip"]);
    const flip = page.locator('label:has(input[name="swap"][value="flip"])');
    await expect(flip).toHaveText("フリップ");
    await flip.click();
    await expect(page.locator('input[name="swap"][value="flip"]')).toBeChecked();
    await page.locator("#aspectTab").click();
    await page.locator(`label:has(input[name="aspect"][value="${aspect}"])`).click();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", aspect);
    const canvas = page.locator("#stage canvas.stage-canvas");
    await expect(canvas).toBeVisible();
    const before = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    await page.locator("#previewToggle").click();
    await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
    // 固定時刻へのシークではなく、ユーザーと同じ再生操作でフレーム更新を確かめる。
    await expect.poll(async () => (await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())) !== before).toBe(true);
    await expect(page.locator("#saveBtn")).toBeEnabled();
  });
}
