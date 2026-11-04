import { expect, test, type Page } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { blockAnalytics, jpegInput, stubShortTemplate, waitForAppReady } from "./helpers.ts";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };

async function openEditor(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/make");
  await waitForAppReady(page);
  const files = await Promise.all([jpegInput("a.jpg"), jpegInput("b.jpg")]);
  await page.locator("#picker").setInputFiles(files);
  await expect(page.locator(".thumb[data-photo-id]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("#studioView")).toHaveAttribute("data-phase", "edit");
  await expect(page.locator("#previewSeek")).toBeEnabled();
}

function box(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
}

/** 1 回のレイアウトで、ページのスクロールとプレイヤーの位置を測る。 */
function pagePosition(page: Page) {
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    stageTop: document.querySelector("#stage")!.getBoundingClientRect().top,
    playerTop: document.querySelector(".studio-player")!.getBoundingClientRect().top,
  }));
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});

for (const viewport of [PHONE, DESKTOP, PHONE_LANDSCAPE]) {
  const size = `${viewport.width}x${viewport.height}`;

  test(`${size}: back is a small icon button far from the save button`, async ({ page }) => {
    await openEditor(page, viewport);
    const back = page.getByRole("link", { name: t("ja", "studioBack") });
    await expect(back).toHaveClass(/studio-back/);
    await expect(back).toHaveAttribute("href", "/");
    // No visible words: the name comes from aria-label, the face is an icon.
    await expect(back).toHaveText("");
    const [backBox, saveBox] = [await box(page, ".studio-back"), await box(page, "#saveBtn")];
    // Easy to hit (44px) but no larger, and clearly lighter than the primary save.
    for (const side of [backBox.width, backBox.height]) {
      expect(side).toBeGreaterThanOrEqual(44 - 0.5);
      expect(side).toBeLessThanOrEqual(48);
    }
    expect(saveBox.height).toBeGreaterThan(backBox.height);
    expect(saveBox.width * saveBox.height).toBeGreaterThan(backBox.width * backBox.height * 2.5);
    // Opposite ends of the same row, with a wide gap so one is not tapped for the other.
    expect(Math.abs(backBox.y + backBox.height / 2 - (saveBox.y + saveBox.height / 2))).toBeLessThan(8);
    expect(saveBox.x - (backBox.x + backBox.width)).toBeGreaterThanOrEqual(96);
  });

  test(`${size}: the aspect switch sits outside the sheet and works from any tab`, async ({ page }) => {
    await openEditor(page, viewport);
    const group = page.getByRole("radiogroup", { name: t("ja", "studioOptionAspect") });
    const landscape = group.getByRole("radio", { name: t("ja", "makerLandscape") });
    const portrait = group.getByRole("radio", { name: t("ja", "makerPortrait") });
    // Right after the photos arrive, with the photos tab open.
    await expect(group).toBeVisible();
    await expect(group).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".studio-sheet .aspect-switch")).toHaveCount(0);
    await expect(landscape).toBeChecked();
    const [switchBox, stageBox, sheetBox] = [
      await box(page, ".aspect-switch"),
      await box(page, "#stage"),
      await box(page, ".studio-sheet"),
    ];
    // Next to the preview, never under the sheet.
    if (sheetBox.x > stageBox.x + stageBox.width - 0.5) {
      expect(switchBox.x + switchBox.width).toBeLessThanOrEqual(sheetBox.x + 0.5);
    } else {
      expect(switchBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 0.5);
      expect(switchBox.y + switchBox.height).toBeLessThanOrEqual(sheetBox.y + 0.5);
    }
    expect(switchBox.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("tab", { name: t("ja", "studioTabLook") }).click();
    await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
    await expect(portrait).toBeChecked();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
    // The chosen side reads as selected: a white pill with the accent label.
    await expect(page.locator('label:has(input[name="aspect"][value="portrait"])')).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );

    const handle = page.locator("#sheetHandle");
    if (await handle.isVisible()) {
      await handle.click();
      await expect(handle).toHaveAttribute("aria-expanded", "false");
    }
    // Still there with the sheet folded (or beside the sheet on low landscape screens).
    await expect(group).toBeInViewport({ ratio: 1 });
    await page.locator('label:has(input[name="aspect"][value="landscape"])').click();
    await expect(landscape).toBeChecked();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "landscape");

    // Keyboard: arrows move the choice, with a visible ring on the focused pill.
    await landscape.focus();
    await page.keyboard.press("ArrowRight");
    await expect(portrait).toBeChecked();
    await expect(portrait).toBeFocused();
    await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
    await expect(page.locator('label:has(input[name="aspect"][value="portrait"])')).toHaveCSS("outline-style", "solid");
  });

  test(`${size}: wheel and scroll over the preview move neither the page nor the player`, async ({ page, browserName, isMobile }) => {
    await openEditor(page, viewport);
    // Playwright cannot send wheel events to mobile WebKit; scrollBy and the layout checks still run there.
    const wheel = !(browserName === "webkit" && isMobile);
    const before = await pagePosition(page);
    expect(before.scrollY).toBe(0);
    // One screen: there is nothing below the editor to scroll to.
    expect(before.scrollHeight).toBeLessThanOrEqual(before.innerHeight);

    if (wheel) {
      const stage = (await page.locator("#stage").boundingBox())!;
      await page.mouse.move(stage.x + stage.width / 2, stage.y + 12);
      await page.mouse.wheel(0, 600);
      // The dark player area between the top buttons and the preview.
      const save = (await page.locator("#saveBtn").boundingBox())!;
      await page.mouse.move(save.x - 8, save.y + save.height + 4);
      await page.mouse.wheel(0, 600);
    }
    await page.evaluate(() => window.scrollBy(0, 400));
    await expect.poll(async () => (await pagePosition(page)).scrollY).toBe(0);
    const after = await pagePosition(page);
    expect(after.stageTop).toBeCloseTo(before.stageTop, 0);
    expect(after.playerTop).toBeCloseTo(before.playerTop, 0);

    // Touch pans do not start on the player (pinch zoom stays where supported).
    expect(["none", "pinch-zoom"]).toContain(
      await page.locator(".studio-player").evaluate((el) => getComputedStyle(el).touchAction),
    );
    await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "none");
  });
}

test("a touch swipe on the preview leaves the page and player in place", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Touch gestures are synthesized over the Chrome DevTools Protocol.");
  await openEditor(page, PHONE);
  const before = await pagePosition(page);
  const stage = (await page.locator("#stage").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: Math.round(stage.x + stage.width / 2),
    y: Math.round(stage.y + 16),
    yDistance: -300,
    gestureSourceType: "touch",
    speed: 1200,
  });
  await cdp.send("Input.synthesizeScrollGesture", {
    x: Math.round(stage.x + stage.width / 2),
    y: Math.round(stage.y + 16),
    yDistance: 300,
    gestureSourceType: "touch",
    speed: 1200,
  });
  const after = await pagePosition(page);
  expect(after.scrollY).toBe(0);
  expect(after.stageTop).toBeCloseTo(before.stageTop, 0);
  expect(after.playerTop).toBeCloseTo(before.playerTop, 0);
});

test("the seek bar still seeks and the sheet panel still scrolls on its own", async ({ page, browserName, isMobile }) => {
  await openEditor(page, PHONE);
  const seek = page.locator("#previewSeek");
  const track = (await seek.boundingBox())!;
  // The stub clip cannot really seek, so record what the drag asked for rather than where the video landed.
  await seek.evaluate((input: HTMLInputElement) => {
    input.addEventListener("input", () => {
      (window as unknown as { seekAsked: number }).seekAsked = Number(input.value);
    });
  });
  await page.mouse.click(track.x + track.width * 0.6, track.y + track.height / 2);
  const max = Number(await seek.getAttribute("max"));
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { seekAsked?: number }).seekAsked ?? 0))
    .toBeGreaterThan(max * 0.4);

  // Enlarged text makes the photos panel taller than the sheet, so it scrolls inside.
  await page.addStyleTag({ content: "html { font-size: 160% !important; }" });
  const panels = page.locator(".sheet-panels");
  await expect.poll(() => panels.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(panels).toHaveCSS("overflow-y", "auto");
  if (!(browserName === "webkit" && isMobile)) {
    const panelBox = (await panels.boundingBox())!;
    await page.mouse.move(panelBox.x + panelBox.width / 2, panelBox.y + panelBox.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => panels.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
