import { describe, expect, it } from "vitest";
import {
  PREVIEW_MUTED_DEFAULT,
  PREVIEW_PAUSE_LABEL,
  PREVIEW_PLAY_LABEL,
  PREVIEW_RESTART_LABEL,
  PREVIEW_SOUND_OFF_LABEL,
  PREVIEW_SOUND_ON_LABEL,
  playPauseLabel,
  previewSoundLabel,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
} from "./preview.ts";

describe("playPauseLabel", () => {
  it("shows play while paused and pause while playing", () => {
    expect(playPauseLabel(false)).toBe(PREVIEW_PLAY_LABEL);
    expect(playPauseLabel(true)).toBe(PREVIEW_PAUSE_LABEL);
    expect(PREVIEW_RESTART_LABEL).toBe("最初から再生");
  });
});

describe("previewSoundLabel", () => {
  it("defaults to muted and only names on/off", () => {
    expect(PREVIEW_MUTED_DEFAULT).toBe(true);
    expect(previewSoundLabel(true)).toBe(PREVIEW_SOUND_OFF_LABEL);
    expect(previewSoundLabel(false)).toBe(PREVIEW_SOUND_ON_LABEL);
    expect(PREVIEW_SOUND_OFF_LABEL).toBe("音声オフ");
    expect(PREVIEW_SOUND_ON_LABEL).toBe("音声オン");
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

describe("shouldTrackPreviewStart", () => {
  it("tracks when a preview starts, not when it ends or is stopped", () => {
    expect(shouldTrackPreviewStart({ event: "start", recording: false, trackedThisPlayback: false })).toBe(true);
    expect(shouldTrackPreviewStart({ event: "start", recording: true, trackedThisPlayback: false })).toBe(false);
    expect(shouldTrackPreviewStart({ event: "ended", recording: false, trackedThisPlayback: true })).toBe(false);
    expect(shouldTrackPreviewStart({ event: "stop", recording: false, trackedThisPlayback: true })).toBe(false);
  });

  it("does not fire twice for the same playback, but fires again after stop then restart", () => {
    expect(shouldTrackPreviewStart({ event: "start", recording: false, trackedThisPlayback: true })).toBe(false);
    expect(shouldTrackPreviewStart({ event: "stop", recording: false, trackedThisPlayback: true })).toBe(false);
    expect(shouldTrackPreviewStart({ event: "start", recording: false, trackedThisPlayback: false })).toBe(true);
  });
});
