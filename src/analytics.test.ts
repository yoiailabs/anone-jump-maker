import { afterEach, describe, expect, it, vi } from "vitest";
import {
  trackEvent,
  videoEventParams,
  VIDEO_PREVIEW_EVENT,
  VIDEO_SAVE_EVENT,
} from "./analytics.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("videoEventParams", () => {
  it("sends only aspect and effect/swap, never identifying extras", () => {
    expect(videoEventParams("portrait", "jump")).toEqual({
      aspect: "portrait",
      effect: "jump",
      swap: "jump",
    });
    expect(videoEventParams("landscape", "zoom")).toEqual({
      aspect: "landscape",
      effect: "zoom",
      swap: "zoom",
    });
    expect(Object.keys(videoEventParams("portrait", "jump")).sort()).toEqual(["aspect", "effect", "swap"]);
  });
});

describe("trackEvent", () => {
  it("no-ops when window is missing", () => {
    expect(() => trackEvent(VIDEO_PREVIEW_EVENT, videoEventParams("portrait", "jump"))).not.toThrow();
  });

  it("no-ops when gtag is missing", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent(VIDEO_SAVE_EVENT, videoEventParams("landscape", "zoom"))).not.toThrow();
  });

  it("forwards video_preview to gtag", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    const params = videoEventParams("portrait", "jump");
    trackEvent(VIDEO_PREVIEW_EVENT, params);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "video_preview", params);
  });

  it("forwards video_save to gtag", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    const params = videoEventParams("landscape", "zoom");
    trackEvent(VIDEO_SAVE_EVENT, params);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "video_save", params);
  });
});
