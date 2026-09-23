import { describe, expect, it } from "vitest";
import {
  PREVIEW_MUTE_HINT,
  PREVIEW_MUTED_DEFAULT,
  PREVIEW_PAUSE_LABEL,
  PREVIEW_PLAY_LABEL,
  PREVIEW_RESTART_LABEL,
  PREVIEW_SOUND_OFF_LABEL,
  PREVIEW_SOUND_ON_LABEL,
  muteButtonHtml,
  formatPreviewClock,
  playPauseButtonHtml,
  playPauseLabel,
  previewSoundLabel,
  restartButtonHtml,
  previewSurfaceChromeAction,
  shouldLoopPreviewPlayback,
  shouldRevealPreviewChrome,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
  syncMuteControl,
  syncPlayPauseControl,
} from "./preview.ts";

describe("formatPreviewClock", () => {
  it("shows the current second, and the duration when the clip length is known", () => {
    expect(formatPreviewClock(0, 0)).toBe("0:00");
    expect(formatPreviewClock(Number.NaN, Number.NaN)).toBe("0:00");
    expect(formatPreviewClock(1.26, 8)).toBe("0:01 / 0:08");
    expect(formatPreviewClock(65.9, 90)).toBe("1:05 / 1:30");
    expect(formatPreviewClock(-1, 4)).toBe("0:00 / 0:04");
    expect(formatPreviewClock(9, 4)).toBe("0:04 / 0:04");
  });
});

describe("playPauseLabel", () => {
  it("shows play while paused and pause while playing", () => {
    expect(playPauseLabel(false)).toBe(PREVIEW_PLAY_LABEL);
    expect(playPauseLabel(true)).toBe(PREVIEW_PAUSE_LABEL);
    expect(PREVIEW_RESTART_LABEL).toBe("最初から");
  });
});

describe("previewSoundLabel", () => {
  it("defaults to sound on and only names on/off", () => {
    expect(PREVIEW_MUTED_DEFAULT).toBe(false);
    expect(previewSoundLabel(true)).toBe(PREVIEW_SOUND_OFF_LABEL);
    expect(previewSoundLabel(false)).toBe(PREVIEW_SOUND_ON_LABEL);
    expect(PREVIEW_SOUND_OFF_LABEL).toBe("音声オフ");
    expect(PREVIEW_SOUND_ON_LABEL).toBe("音声オン");
  });
});

describe("preview control markup", () => {
  it("keeps both play and pause icons in the tree and only flips hidden", () => {
    expect(playPauseButtonHtml(false)).toContain('data-preview-icon="play"');
    expect(playPauseButtonHtml(false)).toContain('data-preview-icon="pause"');
    expect(playPauseButtonHtml(false)).toContain(" hidden");
    expect(playPauseButtonHtml(false)).toContain(PREVIEW_PLAY_LABEL);
    expect(playPauseButtonHtml(true)).toContain(PREVIEW_PAUSE_LABEL);
    expect(playPauseButtonHtml(false)).toContain('translate="no"');
    expect(playPauseButtonHtml(false)).not.toBe(playPauseButtonHtml(true));
    expect(restartButtonHtml()).toContain("<svg");
    expect(restartButtonHtml()).toContain("M19 20 9 12 19 4");
    expect(restartButtonHtml()).toContain("M5 5v14");
    expect(restartButtonHtml()).not.toContain("M21 3v5h-5");
    expect(restartButtonHtml()).not.toContain("M3 12a9");
    expect(restartButtonHtml()).toContain("最初から");
    expect(restartButtonHtml()).not.toContain("最初から再生");
    expect(muteButtonHtml(false)).toContain('data-preview-icon="sound-on"');
    expect(muteButtonHtml(true)).toContain('data-preview-icon="sound-off"');
    expect(muteButtonHtml(false)).not.toBe(muteButtonHtml(true));
    expect(muteButtonHtml(false)).toContain("preview-mute-hint");
    expect(muteButtonHtml(false)).toContain(PREVIEW_MUTE_HINT);
    expect(PREVIEW_MUTE_HINT).toBe("プレビュー時のみ");
  });
});

describe("syncPlayPauseControl", () => {
  it("toggles hidden and skips the label write when the text is unchanged", () => {
    let labelWrites = 0;
    const play = {
      hidden: false,
      textContent: null as string | null,
      toggleAttribute: (_name: string, force?: boolean) => {
        play.hidden = Boolean(force);
        return play.hidden;
      },
    };
    const pause = {
      hidden: true,
      textContent: null as string | null,
      toggleAttribute: (_name: string, force?: boolean) => {
        pause.hidden = Boolean(force);
        return pause.hidden;
      },
    };
    const label = {
      current: PREVIEW_PLAY_LABEL,
      get textContent() {
        return this.current;
      },
      set textContent(value: string) {
        labelWrites += 1;
        this.current = value;
      },
      toggleAttribute: () => false,
    };
    const root = {
      querySelector(selector: string) {
        if (selector.includes('"play"')) return play;
        if (selector.includes('"pause"')) return pause;
        if (selector.includes("preview-ctrl-label")) return label;
        return null;
      },
    };
    syncPlayPauseControl(root, false);
    expect(labelWrites).toBe(0);
    syncPlayPauseControl(root, true);
    expect(play.hidden).toBe(true);
    expect(pause.hidden).toBe(false);
    expect(label.textContent).toBe(PREVIEW_PAUSE_LABEL);
    expect(labelWrites).toBe(1);
    syncPlayPauseControl(root, true);
    expect(labelWrites).toBe(1);
  });
});

describe("syncMuteControl", () => {
  it("toggles sound icons without replacing the hint", () => {
    const soundOn = {
      hidden: false,
      textContent: null as string | null,
      toggleAttribute: (_name: string, force?: boolean) => {
        soundOn.hidden = Boolean(force);
        return soundOn.hidden;
      },
    };
    const soundOff = {
      hidden: true,
      textContent: null as string | null,
      toggleAttribute: (_name: string, force?: boolean) => {
        soundOff.hidden = Boolean(force);
        return soundOff.hidden;
      },
    };
    const label = { textContent: PREVIEW_SOUND_ON_LABEL, toggleAttribute: () => false };
    const root = {
      querySelector(selector: string) {
        if (selector.includes("sound-on")) return soundOn;
        if (selector.includes("sound-off")) return soundOff;
        if (selector.includes("preview-ctrl-label")) return label;
        return null;
      },
    };
    syncMuteControl(root, true);
    expect(soundOn.hidden).toBe(true);
    expect(soundOff.hidden).toBe(false);
    expect(label.textContent).toBe(PREVIEW_SOUND_OFF_LABEL);
  });
});

describe("shouldSeekPreviewToStart", () => {
  it("toggles the player chrome from the preview surface only while playing", () => {
    expect(previewSurfaceChromeAction({ chromeOpen: true, playing: false })).toBe("keep");
    expect(previewSurfaceChromeAction({ chromeOpen: false, playing: false })).toBe("show");
    expect(previewSurfaceChromeAction({ chromeOpen: true, playing: true })).toBe("hide");
    expect(previewSurfaceChromeAction({ chromeOpen: false, playing: true })).toBe("show");
  });

  it("shows the player chrome when the preview is ready and stopped", () => {
    expect(shouldRevealPreviewChrome({ ready: true, playing: false, recording: false })).toBe(true);
    expect(shouldRevealPreviewChrome({ ready: true, playing: true, recording: false })).toBe(false);
    expect(shouldRevealPreviewChrome({ ready: false, playing: false, recording: false })).toBe(false);
    expect(shouldRevealPreviewChrome({ ready: true, playing: false, recording: true })).toBe(false);
  });

  it("loops studio preview playback and leaves export alone", () => {
    expect(shouldLoopPreviewPlayback({ playing: true, recording: false })).toBe(true);
    expect(shouldLoopPreviewPlayback({ playing: false, recording: false })).toBe(false);
    expect(shouldLoopPreviewPlayback({ playing: true, recording: true })).toBe(false);
  });

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
