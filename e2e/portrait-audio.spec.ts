import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { blockAnalytics, openStudio, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

test("portrait preview keeps the soundtrack playing on iOS Safari and Android Chrome", async ({ page }) => {
  await uploadPhoto(page);
  await switchAspect(page, "portrait");
  await expect(page.locator("#previewToggle")).toBeEnabled();
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expectSoundtrackMoving(page);
});

test("switching from landscape to portrait keeps the soundtrack on the picture clock", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await switchAspect(page, "portrait");
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expectSoundtrackMoving(page);
});

test("portrait soundtrack plays again after export", async ({ page }) => {
  await uploadPhoto(page);
  await switchAspect(page, "portrait");
  await page.locator("#saveBtn").click();
  const outcome = await waitForExportOutcome(page);
  if (outcome !== "ready") {
    await expect(page.locator("#saveFeedback")).toContainText(UNSUPPORTED_EXPORT_MESSAGE);
    return;
  }
  await page.locator("#closeExportBtn").click();
  await expect(page.locator("#exportPanel")).toBeHidden();
  await expect(page.locator("#previewToggle")).toBeEnabled();
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expectSoundtrackMoving(page);
});

async function uploadPhoto(page: Page): Promise<void> {
  await openStudio(page);
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("#previewSeek")).toBeEnabled({ timeout: 20_000 });
}

async function switchAspect(page: Page, value: "portrait" | "landscape"): Promise<void> {
  await page.locator("#aspectTab").click();
  await page.locator(`#studioView label:has(input[name="aspect"][value="${value}"])`).click();
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", value);
}

async function expectSoundtrackMoving(page: Page): Promise<{ time: number; seeks: number }> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audio = document.querySelector<HTMLVideoElement>('video[data-soundtrack="portrait"]');
        if (!audio || audio.paused) return "";
        return `${audio.currentTime}`;
      }),
    )
    .not.toBe("");
  const started = await soundtrackSample(page);
  await expect
    .poll(async () => {
      const now = await soundtrackSample(page);
      return now && !now.paused && now.time > started.time + 0.12 ? "moving" : "";
    })
    .toBe("moving");
  const after = await soundtrackSample(page);
  expect(after.seeks).toBeLessThan(3);
  expect(after.paused).toBe(false);
  return after;
}

async function soundtrackSample(page: Page): Promise<{ time: number; paused: boolean; seeks: number }> {
  return page.evaluate(() => {
    const audio = document.querySelector<HTMLVideoElement>('video[data-soundtrack="portrait"]');
    if (!audio) return { time: 0, paused: true, seeks: 0 };
    const watched = audio as HTMLVideoElement & { __seekCount?: number };
    if (watched.__seekCount == null) {
      watched.__seekCount = 0;
      watched.addEventListener("seeking", () => {
        watched.__seekCount = (watched.__seekCount ?? 0) + 1;
      });
    }
    return { time: audio.currentTime, paused: audio.paused, seeks: watched.__seekCount ?? 0 };
  });
}

async function waitForExportOutcome(page: Page): Promise<"ready" | "unsupported"> {
  let outcome: "ready" | "unsupported" | "" = "";
  await expect
    .poll(
      async () => {
        if (await page.locator("#downloadExportBtn").isVisible()) {
          outcome = "ready";
          return outcome;
        }
        const feedback = ((await page.locator("#saveFeedback").textContent()) ?? "").trim();
        if (feedback.includes(UNSUPPORTED_EXPORT_MESSAGE)) {
          outcome = "unsupported";
          return outcome;
        }
        return "";
      },
      { timeout: 45_000 },
    )
    .not.toBe("");
  if (outcome === "") throw new Error("export outcome was empty");
  return outcome;
}
