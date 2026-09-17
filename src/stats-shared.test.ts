import { describe, expect, it } from "vitest";
import {
  formatCountLabel,
  parseStatsCount,
  sanitizeGenerateAttrs,
  shouldCountPreview,
  summarizeUserAgent,
} from "./stats-shared.ts";

describe("formatCountLabel", () => {
  it("uses the short product tone", () => {
    expect(formatCountLabel(0)).toBe("0回作られたよ");
    expect(formatCountLabel(12)).toBe("12回作られたよ");
    expect(formatCountLabel(null)).toBe("—回作られたよ");
    expect(formatCountLabel(Number.NaN)).toBe("—回作られたよ");
  });
});

describe("summarizeUserAgent", () => {
  it("keeps only coarse browser / OS / device families", () => {
    expect(summarizeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36")).toEqual({
      browser: "chrome",
      os: "macos",
      device: "desktop",
    });
    expect(summarizeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toEqual({
      browser: "safari",
      os: "ios",
      device: "mobile",
    });
  });
});

describe("sanitizeGenerateAttrs", () => {
  it("drops identifying extras and invalid values", () => {
    const clean = sanitizeGenerateAttrs({
      browser: "chrome",
      os: "linux",
      device: "desktop",
      language: "ja",
      timezone: "Asia/Tokyo",
      screenW: 1440,
      screenH: 900,
      dpr: 2,
      exportMode: "record",
      mime: "video/mp4",
      width: 720,
      height: 1280,
      action: "save",
      ip: "1.2.3.4",
      email: "a@b.c",
      userAgent: "raw-ua-should-not-pass",
    });
    expect(clean).toEqual({
      browser: "chrome",
      os: "linux",
      device: "desktop",
      language: "ja",
      timezone: "Asia/Tokyo",
      screenW: 1440,
      screenH: 900,
      dpr: 2,
      exportMode: "record",
      mime: "video/mp4",
      width: 720,
      height: 1280,
      action: "save",
    });
    expect(sanitizeGenerateAttrs({ exportMode: "offline" }).exportMode).toBe("offline");
    expect(sanitizeGenerateAttrs({ action: "preview" }).action).toBe("preview");
    expect(sanitizeGenerateAttrs({ action: "save" }).action).toBe("save");
    expect(sanitizeGenerateAttrs({ action: "download" })).toEqual({});
    expect(sanitizeGenerateAttrs({ browser: "netscape", mime: "not a mime" })).toEqual({});
  });
});

describe("shouldCountPreview", () => {
  it("counts only a finished preview, not a mid-play stop or a save recording", () => {
    expect(shouldCountPreview({ event: "ended", playing: true, recording: false })).toBe(true);
    expect(shouldCountPreview({ event: "ended", playing: true, recording: true })).toBe(false);
    expect(shouldCountPreview({ event: "ended", playing: false, recording: false })).toBe(false);
    expect(shouldCountPreview({ event: "stop", playing: true, recording: false })).toBe(false);
  });
});

describe("parseStatsCount", () => {
  it("reads a non-negative integer count", () => {
    expect(parseStatsCount({ count: 3 })).toBe(3);
    expect(parseStatsCount({ count: 3.9 })).toBe(3);
    expect(parseStatsCount({ count: -2 })).toBe(0);
    expect(parseStatsCount({})).toBeNull();
  });
});
