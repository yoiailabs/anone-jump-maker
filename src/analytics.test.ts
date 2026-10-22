import { afterEach, describe, expect, it, vi } from "vitest";
import { UNSUPPORTED_EXPORT_MESSAGE } from "./export.ts";
import retiredColorFilters from "../tests/fixtures/retired-color-filters.json" with { type: "json" };
import type { ColorFilter } from "./color-filter.ts";
import {
  GENERATE_CANCEL_EVENT,
  GENERATE_FAIL_EVENT,
  GENERATE_START_EVENT,
  generateFailReason,
  PHOTO_PICKER_OPEN_EVENT,
  PHOTOS_REJECTED_EVENT,
  PHOTOS_SELECTED_EVENT,
  resetTrackDebounce,
  trackEvent,
  videoEventParams,
  VIDEO_PREVIEW_EVENT,
  VIDEO_SAVE_EVENT,
} from "./analytics.ts";

afterEach(() => {
  resetTrackDebounce();
  vi.unstubAllGlobals();
});

describe("videoEventParams", () => {
  it("sends only settings, never identifying extras", () => {
    expect(videoEventParams("portrait", "jump")).toEqual({
      aspect: "portrait",
      effect: "jump",
      swap: "jump",
      filter: "none",
      color_filter: "none",
    });
    expect(videoEventParams("landscape", "zoom")).toEqual({
      aspect: "landscape",
      effect: "zoom",
      swap: "zoom",
      filter: "none",
      color_filter: "none",
    });
    expect(videoEventParams("portrait", "spin")).toEqual({
      aspect: "portrait",
      effect: "spin",
      swap: "spin",
      filter: "none",
      color_filter: "none",
    });
    expect(videoEventParams("landscape", "spin")).toEqual({
      aspect: "landscape",
      effect: "spin",
      swap: "spin",
      filter: "none",
      color_filter: "none",
    });
    expect(Object.keys(videoEventParams("portrait", "jump")).sort()).toEqual(["aspect", "color_filter", "effect", "filter", "swap"]);
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

  it.each([...retiredColorFilters, "future-filter"])("normalizes a stale color %s passed directly to trackEvent", (color) => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    const params = { ...videoEventParams("landscape", "zoom", "blur-strong"), color_filter: color as ColorFilter };
    trackEvent(VIDEO_SAVE_EVENT, params);
    expect(gtag).toHaveBeenCalledWith("event", "video_save", { ...params, color_filter: "none" });
    expect(params.color_filter).toBe(color);
  });

  it("forwards funnel events and drops a duplicate picker open", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    trackEvent(PHOTO_PICKER_OPEN_EVENT, undefined, { debounceMs: 600 });
    trackEvent(PHOTO_PICKER_OPEN_EVENT, undefined, { debounceMs: 600 });
    trackEvent(PHOTOS_SELECTED_EVENT, { count: 3 });
    trackEvent(PHOTOS_REJECTED_EVENT, { reason: "not_image" });
    trackEvent(GENERATE_START_EVENT, { count: 3 });
    trackEvent(GENERATE_FAIL_EVENT, { reason: "unsupported" });
    trackEvent(GENERATE_CANCEL_EVENT);
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      "photo_picker_open",
      "photos_selected",
      "photos_rejected",
      "generate_start",
      "generate_fail",
      "generate_cancel",
    ]);
    expect(gtag).toHaveBeenCalledWith("event", "photos_selected", { count: 3 });
    expect(gtag).toHaveBeenCalledWith("event", "photos_rejected", { reason: "not_image" });
    expect(gtag).toHaveBeenCalledWith("event", "generate_fail", { reason: "unsupported" });
  });

  it("no-ops funnel events when gtag is missing", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent(GENERATE_START_EVENT, { count: 1 })).not.toThrow();
    expect(() => trackEvent(PHOTO_PICKER_OPEN_EVENT)).not.toThrow();
  });
});

describe("generateFailReason", () => {
  it("maps known export errors to short codes and hides unknown text", () => {
    expect(generateFailReason(new Error(UNSUPPORTED_EXPORT_MESSAGE))).toBe("unsupported");
    expect(generateFailReason(new Error("テンプレ動画を読み込めませんでした (4)"))).toBe("template");
    expect(generateFailReason(new Error("failed to read IMG_0001.jpg"))).toBe("export_failed");
    expect(generateFailReason("nope")).toBe("export_failed");
  });
});
