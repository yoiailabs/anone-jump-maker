import { expect, test, type Page } from "@playwright/test";
import { UNSUPPORTED_EXPORT_MESSAGE } from "../src/export.ts";
import { blockAnalytics, openStudio, PHOTO_FILE, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/");
  await waitForAppReady(page);
});

test("portrait preview plays landscape audio on the picture element", async ({ page }) => {
  await uploadPhoto(page);
  await switchAspect(page, "portrait");
  await expect(page.locator("#previewToggle")).toBeEnabled();
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await expectPictureAudible(page);
  const fetched = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(fetched.some((name) => name.endsWith("/official-assets/template/vertical.mp4"))).toBe(false);
  expect(fetched.some((name) => name.endsWith("/official-assets/template/cuts.json"))).toBe(false);
});

test("switching from landscape to portrait keeps the picture clock and its own audio", async ({ page }) => {
  await uploadPhoto(page);
  await page.locator("#previewToggle").click();
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await switchAspect(page, "portrait");
  await expect(page.locator("#stage")).toHaveAttribute("data-aspect", "portrait");
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "true");
  await expectPictureAudible(page);
});

test("portrait picture audio plays again after export", async ({ page }) => {
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
  await expectPictureAudible(page);
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

async function expectPictureAudible(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const companion = document.querySelector('video[data-soundtrack="portrait"]');
        const video = document.querySelector<HTMLVideoElement>("video.offscreen-video");
        if (companion || !video || video.paused || video.muted) return "";
        if (!video.dataset.templateSrc?.endsWith("/landscape.mp4")) return "";
        if (video.dataset.templateAudio !== video.dataset.templateSrc) return "";
        return `${video.currentTime}`;
      }),
    )
    .not.toBe("");
  const started = await pictureSample(page);
  await expect
    .poll(async () => {
      const now = await pictureSample(page);
      return now && !now.paused && !now.muted && now.time > started.time + 0.12 ? "moving" : "";
    })
    .toBe("moving");
  const after = await pictureSample(page);
  expect(after.seeks).toBeLessThan(3);
  expect(after.paused).toBe(false);
  expect(after.muted).toBe(false);
}

async function pictureSample(page: Page): Promise<{ time: number; paused: boolean; muted: boolean; seeks: number }> {
  return page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("video.offscreen-video");
    if (!video) return { time: 0, paused: true, muted: true, seeks: 0 };
    const watched = video as HTMLVideoElement & { __seekCount?: number };
    if (watched.__seekCount == null) {
      watched.__seekCount = 0;
      watched.addEventListener("seeking", () => {
        watched.__seekCount = (watched.__seekCount ?? 0) + 1;
      });
    }
    return { time: video.currentTime, paused: video.paused, muted: video.muted, seeks: watched.__seekCount ?? 0 };
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
