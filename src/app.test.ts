import { describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "./layout.ts";
import { loadTimeline, loadTimelines } from "./app.ts";
import appSrc from "./app.ts?raw";
import makerSrc from "./components/MakerApp.tsx?raw";

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
    expect(makerSrc).toContain('id="previewSaveBtn"');
    expect(makerSrc).toContain('id="restartBtn"');
    expect(makerSrc).toContain('id="muteBtn"');
    expect(makerSrc).not.toContain('id="modalPlayBtn"');
    expect(makerSrc).not.toContain('id="previewState"');
    expect(makerSrc).not.toContain('id="slotMeter"');
    expect(makerSrc.indexOf('id="stage"')).toBeLessThan(makerSrc.indexOf('id="restartBtn"'));
    expect(makerSrc.indexOf('id="restartBtn"')).toBeLessThan(makerSrc.indexOf('id="muteBtn"'));
    expect(makerSrc).not.toContain('id="previewMuteHint"');
    expect(makerSrc.indexOf('id="muteBtn"')).toBeLessThan(makerSrc.indexOf('id="previewSaveBtn"'));
    expect(appSrc).toContain("saveBtn.disabled = saveDisabled");
    expect(appSrc).toContain("previewSaveBtn.disabled = saveDisabled");
    expect(appSrc.match(/void startSave\(\)/g)).toHaveLength(2);
    expect(appSrc).toContain("trackEvent(VIDEO_SAVE_EVENT");
  });
});
