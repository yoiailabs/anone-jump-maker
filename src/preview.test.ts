import { describe, expect, it } from "vitest";
import {
  PREVIEW_CLOSE_LABEL,
  PREVIEW_PAUSE_LABEL,
  PREVIEW_PLAY_LABEL,
  PREVIEW_RESTART_LABEL,
  previewStateLabel,
  previewTransportState,
  shouldSeekPreviewToStart,
} from "./preview.ts";

describe("preview labels", () => {
  it("keeps the Japanese transport copy", () => {
    expect(PREVIEW_PLAY_LABEL).toBe("再生");
    expect(PREVIEW_PAUSE_LABEL).toBe("一時停止");
    expect(PREVIEW_RESTART_LABEL).toBe("最初から再生");
    expect(PREVIEW_CLOSE_LABEL).toBe("閉じる");
  });
});

describe("previewTransportState", () => {
  it("enables play and restart while paused, and pause only while playing", () => {
    expect(previewTransportState({ ready: true, recording: false, playing: false })).toEqual({
      playDisabled: false,
      pauseDisabled: true,
      restartDisabled: false,
    });
    expect(previewTransportState({ ready: true, recording: false, playing: true })).toEqual({
      playDisabled: true,
      pauseDisabled: false,
      restartDisabled: false,
    });
  });

  it("disables every control while recording or before photos are ready", () => {
    expect(previewTransportState({ ready: false, recording: false, playing: false })).toEqual({
      playDisabled: true,
      pauseDisabled: true,
      restartDisabled: true,
    });
    expect(previewTransportState({ ready: true, recording: true, playing: true })).toEqual({
      playDisabled: true,
      pauseDisabled: true,
      restartDisabled: true,
    });
  });
});

describe("previewStateLabel", () => {
  it("distinguishes playing, paused in-session, and fully stopped", () => {
    expect(previewStateLabel({ playing: true, pausedInSession: false })).toBe("再生中");
    expect(previewStateLabel({ playing: false, pausedInSession: true })).toBe("一時停止中");
    expect(previewStateLabel({ playing: false, pausedInSession: false })).toBe("停止中");
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
