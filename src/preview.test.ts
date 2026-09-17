import { describe, expect, it } from "vitest";
import {
  PREVIEW_PAUSE_LABEL,
  PREVIEW_PLAY_LABEL,
  PREVIEW_RESTART_LABEL,
  playPauseLabel,
  shouldSeekPreviewToStart,
} from "./preview.ts";

describe("playPauseLabel", () => {
  it("shows play while paused and pause while playing", () => {
    expect(playPauseLabel(false)).toBe(PREVIEW_PLAY_LABEL);
    expect(playPauseLabel(true)).toBe(PREVIEW_PAUSE_LABEL);
    expect(PREVIEW_RESTART_LABEL).toBe("最初から再生");
  });
});

describe("shouldSeekPreviewToStart", () => {
  it("seeks when the caller asked to restart or the clip already ended", () => {
    expect(
      shouldSeekPreviewToStart({ fromStart: true, ended: false, currentTime: 1.2, duration: 8 }),
    ).toBe(true);
    expect(
      shouldSeekPreviewToStart({ fromStart: false, ended: true, currentTime: 8, duration: 8 }),
    ).toBe(true);
  });

  it("resumes from the current time after a mid-clip pause", () => {
    expect(
      shouldSeekPreviewToStart({ fromStart: false, ended: false, currentTime: 2.4, duration: 8 }),
    ).toBe(false);
  });

  it("treats the last sliver of the duration as the end", () => {
    expect(
      shouldSeekPreviewToStart({ fromStart: false, ended: false, currentTime: 7.98, duration: 8 }),
    ).toBe(true);
  });
});
