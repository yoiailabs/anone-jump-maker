import { describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "./layout.ts";
import { loadTimeline, loadTimelines } from "./app.ts";
import appSrc from "./app.ts?raw";
import compositorSrc from "./compositor.ts?raw";
import makerSrc from "./components/MakerApp.tsx?raw";
import offlineSrc from "./offline-encode.ts?raw";

describe("loadTimeline", () => {
  it("parses a cuts table", async () => {
    const cuts = { duration: 1, fps: 30, slots: [0, 0.5] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(cuts), { status: 200 })),
    );
    try {
      await expect(loadTimeline("/template/cuts.json")).resolves.toEqual(cuts);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails when the cuts table is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    try {
      await expect(loadTimeline("/missing.json")).rejects.toThrow("カット表を読み込めませんでした");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("loadTimelines", () => {
  it("loads portrait and landscape tables", async () => {
    const portrait = { duration: 1, slots: [0] };
    const landscape = { duration: 2, slots: [0, 1] };
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      const body = url.includes("landscape") ? landscape : portrait;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(loadTimelines()).resolves.toEqual({ portrait, landscape });
      expect(fetchMock).toHaveBeenCalledWith(TEMPLATES.portrait.cuts);
      expect(fetchMock).toHaveBeenCalledWith(TEMPLATES.landscape.cuts);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("preview save CTA", () => {
  it("keeps the panel save button and wires preview save to the same export path", () => {
    expect(makerSrc).toContain('id="saveBtn"');
    expect(makerSrc).not.toContain('id="previewSaveBtn"');
    expect(makerSrc).not.toContain('id="previewDialog"');
    expect(makerSrc).toContain('id="previewSeek"');
    expect(makerSrc).toContain('id="previewTime"');
    expect(makerSrc).toContain('className="studio-options"');
    expect(makerSrc).toContain('id="studioOptionsTitle"');
    expect(makerSrc).toContain('className="studio-option-panels"');
    expect(makerSrc).toContain('role="tab"');
    expect(makerSrc).toContain('id={`${id}Tab`}');
    expect(makerSrc).not.toContain("popoverTarget");
    expect(makerSrc.indexOf('id="onDeviceNote"')).toBeLessThan(makerSrc.indexOf('id="picker"'));
    expect(makerSrc.indexOf('id="picker"')).toBeLessThan(makerSrc.indexOf('id="stage"'));
    expect(makerSrc.indexOf('id="previewSeek"')).toBeLessThan(makerSrc.indexOf('name="aspect"'));
    expect(appSrc).toContain("formatPreviewClock");
    expect(makerSrc).not.toContain('id="restartBtn"');
    expect(makerSrc).toContain('id="previewToggle"');
    expect(makerSrc).toContain('id="previewStatus"');
    expect(makerSrc).toContain('className="preview-dim"');
    expect(makerSrc).toContain('id="muteBtn"');
    expect(makerSrc).not.toContain('id="playBtn"');
    expect(makerSrc).not.toContain('id="modalPlayBtn"');
    expect(makerSrc).not.toContain('id="previewState"');
    expect(makerSrc).not.toContain('id="slotMeter"');
    expect(makerSrc).not.toContain("makerStatusIdle");
    expect(makerSrc).toContain('id="photoFeedback"');
    expect(makerSrc).toContain('id="previewFeedback"');
    expect(makerSrc).toContain('id="saveFeedback"');
    expect(makerSrc).toContain('id="landingHashtags"');
    expect(makerSrc).not.toContain('id="shareFeedback"');
    expect(makerSrc).not.toContain('id="shareAppBtn"');
    expect(makerSrc).not.toContain('id="copyHashtagsBtn"');
    expect(appSrc).not.toContain('msg("statusExportSharing")');
    expect(appSrc).not.toContain('msg("exportShareHint")');
    expect(appSrc).not.toContain('msg("exportDownloadHint")');
    expect(makerSrc).not.toContain('id="exportDownloadHint"');
    expect(makerSrc).not.toContain('id="fanNote"');
    expect(makerSrc).not.toContain("makerFanNote");
    expect(appSrc).not.toContain('msg("statusShareCancelled")');
    expect(appSrc).not.toContain('msg("statusExportShareCancelled")');
    expect(appSrc).not.toContain('msg("statusHashtagsCopied")');
    expect(appSrc).not.toContain('msg("statusShared")');
    expect(appSrc).not.toContain('msg("statusSaved")');
    expect(appSrc).not.toContain('msg("statusCopyUnsupported")');
    expect(appSrc).not.toContain('msg("statusShareUnsupported")');
    expect(appSrc).not.toContain('msg("statusExportPreparing")');
    expect(appSrc).not.toContain('msg("statusGenerating")');
    expect(appSrc).not.toContain('msg("statusExportCancelled")');
    expect(appSrc).not.toContain('msg("statusExportReadyDownload")');
    expect(appSrc).not.toContain("保存しました");
    expect(appSrc).toContain('setErrorFeedback("save", error, "statusSaveFailed")');
    expect(makerSrc).toContain('id="exportStatus"');
    expect(makerSrc).not.toContain("statusExportPreparing");
    expect(makerSrc).toContain('id="exportKeepOpen"');
    expect(makerSrc).toContain('id="previewSaveHint"');
    expect(makerSrc).toContain('id="studioHome"');
    expect(makerSrc).not.toContain("anone-logo-stacked");
    expect(makerSrc).toContain('useState<OptionTab>("swap")');
    expect(makerSrc.indexOf('["aspect", "studioTabAspect"')).toBeLessThan(makerSrc.indexOf('["swap", "studioTabEffect"'));
    expect(makerSrc.indexOf('["swap", "studioTabEffect"')).toBeLessThan(makerSrc.indexOf('["filter", "studioTabFilter"'));
    expect(makerSrc.indexOf('["filter", "studioTabFilter"')).toBeLessThan(
      makerSrc.indexOf('["character", "studioTabCharacter"'),
    );
    expect(appSrc).not.toContain('msg("statusPaused")');
    expect(appSrc).not.toContain('msg("statusPreviewing")');
    expect(appSrc).not.toContain('msg("statusPreviewEnded")');
    expect(appSrc).not.toContain('msg("statusPhotoRemoved"');
    expect(appSrc).not.toContain('msg("statusPhotosCleared"');
    expect(appSrc).not.toContain('msg("statusPhotosLoaded"');
    expect(makerSrc.indexOf('id="previewStatus"')).toBeLessThan(makerSrc.indexOf('id="previewSeek"'));
    expect(makerSrc.indexOf('id="previewSeek"')).toBeLessThan(makerSrc.indexOf('id="previewTime"'));
    expect(makerSrc.indexOf('id="previewTime"')).toBeLessThan(makerSrc.indexOf('id="muteBtn"'));
    expect(makerSrc.indexOf('id="stage"')).toBeLessThan(makerSrc.indexOf("<PreviewChrome"));
    expect(makerSrc.indexOf("<PreviewChrome")).toBeLessThan(makerSrc.indexOf('id="previewTransport"'));
    expect(makerSrc).not.toContain('id="previewStatusLabel"');
    expect(appSrc).toContain("previewSurfaceChromeAction");
    expect(appSrc).toContain("shouldRevealPreviewChrome");
    expect(appSrc).toContain("shouldLoopPreviewPlayback");
    expect(appSrc).not.toContain('must(root, "#restartBtn")');
    expect(makerSrc).not.toContain('id="previewMuteHint"');
    expect(makerSrc.indexOf('id="muteBtn"')).toBeLessThan(makerSrc.indexOf('id="saveBtn"'));
    expect(makerSrc).toContain('className="preview-transport"');
    expect(makerSrc).toContain('<div className="stage" id="stage"');
    expect(makerSrc).not.toContain("<BrowsersNote");
    expect(makerSrc).not.toContain('id="browsersNote"');
    expect(makerSrc).not.toContain("previewStageAria");
    expect(appSrc).toContain('stage.addEventListener("click"');
    expect(makerSrc).toContain('<button type="button" className="studio-empty" id="studioEmpty"');
    expect(makerSrc).not.toContain(">{t(locale, \"studioEmpty\")}");
    expect(appSrc).toContain('studioEmpty.addEventListener("click"');
    expect(appSrc).toContain("saveBtn.disabled = saveDisabled");
    expect(makerSrc).not.toContain("<dialog");
    expect(makerSrc).toContain('id="exportPanel"');
    expect(makerSrc.indexOf('id="saveBtn"')).toBeLessThan(makerSrc.indexOf('id="exportPanel"'));
    expect(makerSrc.indexOf('id="exportPanel"')).toBeLessThan(makerSrc.indexOf('id="saveFeedback"'));
    expect(appSrc).not.toContain("showModal");
    expect(appSrc).toContain("exportPanel.scrollIntoView");
    expect(appSrc).toContain("trackEvent(MAKE_OPEN_EVENT");
    expect(appSrc.match(/void startSave\(\)/g)).toHaveLength(1);
    expect(appSrc).toContain("trackEvent(VIDEO_SAVE_EVENT");
    expect(appSrc.match(/trackEvent\(VIDEO_SAVE_EVENT/g)).toHaveLength(1);
    expect(appSrc).toContain("trackEvent(PHOTO_PICKER_OPEN_EVENT");
    expect(appSrc).toContain("trackEvent(PHOTOS_SELECTED_EVENT");
    expect(appSrc).toContain("trackEvent(PHOTOS_REJECTED_EVENT");
    expect(appSrc).toContain("trackEvent(GENERATE_START_EVENT");
    expect(appSrc).toContain("trackEvent(GENERATE_FAIL_EVENT");
    expect(appSrc).toContain("trackEvent(GENERATE_CANCEL_EVENT");
    expect(appSrc).not.toContain("fetchSamplePhotoFiles");
    expect(appSrc).not.toContain("samplePhotosBtn");
    expect(makerSrc).not.toContain('id="shareExportBtn"');
    expect(makerSrc).toContain('id="downloadExportBtn"');
    expect(appSrc).not.toContain("shareExportBtn");
    expect(appSrc).toContain("shareVideoFile");
    expect(appSrc).toContain("downloadBlob(pending.blob, pending.filename)");
    expect(appSrc).not.toContain("downloadBlob(result.blob, filename)");
    expect(appSrc).not.toContain("sharePendingExport");
  });

  it("rewinds the character and drops the keyed texture before another export or preview", () => {
    expect(appSrc).toContain("compositor?.resetCharacter()");
    expect(appSrc).toContain("await rewindCharacterVideo(video)");
    expect(appSrc).toContain("comp.resetCharacter()");
    expect(appSrc).toContain("if (recording) return;");
    expect(offlineSrc).toContain("await rewindCharacterVideo(video)");
    expect(offlineSrc).toContain("markCharacterVideoUsed(video)");
    expect(compositorSrc).toContain("resetCharacter()");
    expect(compositorSrc).toContain("dropGpuKeyer()");
  });
});
