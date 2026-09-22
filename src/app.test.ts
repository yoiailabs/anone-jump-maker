import { describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "./layout.ts";
import { loadTimeline, loadTimelines } from "./app.ts";

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
