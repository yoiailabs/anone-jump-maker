import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./layout.ts";
import {
  TEMPLATE_AUDIO_DRIFT_SEC,
  planTemplateAudio,
  templateAudioClock,
  templateAudioIsSeparate,
  templateAudioNeedsSeek,
  templatePictureMuted,
  type TemplateAudioFollow,
} from "./template-audio.ts";

function follow(patch: Partial<TemplateAudioFollow> = {}): TemplateAudioFollow {
  return {
    mode: "portrait",
    previewMuted: false,
    picturePlaying: true,
    exporting: false,
    userGesture: false,
    playBlocked: false,
    playPending: false,
    allowPlay: true,
    audioPaused: true,
    audioReady: true,
    audioTime: 0,
    videoTime: 0,
    ...patch,
  };
}

describe("template audio", () => {
  it("plays vertical.mp4 under the portrait picture and keeps landscape audio on its own file", () => {
    expect(templateAudioIsSeparate("portrait")).toBe(true);
    expect(TEMPLATES.portrait.audio).toBe("/official-assets/template/vertical.mp4");
    expect(TEMPLATES.portrait.video).toBe("/official-assets/template/landscape.mp4");
    expect(templateAudioIsSeparate("landscape")).toBe(false);
    expect(templatePictureMuted("portrait", false)).toBe(true);
    expect(templatePictureMuted("portrait", true)).toBe(true);
    expect(templatePictureMuted("landscape", false)).toBe(false);
    expect(templatePictureMuted("landscape", true)).toBe(true);
  });

  it("keeps the soundtrack on the saved time after the picture clock drops to zero", () => {
    expect(templateAudioClock(0, 2.4)).toBe(2.4);
    expect(templateAudioClock(5, 0)).toBe(0);
    expect(templateAudioClock(2.4, null)).toBe(2.4);
    expect(templateAudioClock(1, Number.NaN)).toBe(1);
  });

  it("seeks the audio element only after it drifts", () => {
    expect(TEMPLATE_AUDIO_DRIFT_SEC).toBeGreaterThan(0.03);
    expect(templateAudioNeedsSeek(1, 1.02)).toBe(false);
    expect(templateAudioNeedsSeek(1, 1.2)).toBe(true);
    expect(templateAudioNeedsSeek(Number.NaN, 1)).toBe(false);
  });

  it("starts portrait audio on the user gesture before metadata, even while muted", () => {
    const plan = planTemplateAudio(
      follow({ userGesture: true, previewMuted: true, audioReady: false, audioPaused: true }),
    );
    expect(plan.play).toBe(true);
    expect(plan.seek).toBe(false);
    expect(plan.release).toBe(false);
    expect(plan.pictureMuted).toBe(true);
    expect(plan.audioMuted).toBe(true);
  });

  it("does not retry a blocked play until the next gesture", () => {
    const blocked = planTemplateAudio(follow({ playBlocked: true, audioPaused: true, allowPlay: true }));
    expect(blocked.play).toBe(false);
    expect(blocked.seek).toBe(false);

    const unmute = planTemplateAudio(
      follow({ playBlocked: true, audioPaused: true, userGesture: true, audioTime: 1, videoTime: 1.2 }),
    );
    expect(unmute.play).toBe(true);
    expect(unmute.seek).toBe(true);
  });

  it("seeks a playing soundtrack back to the picture clock without calling play again", () => {
    const plan = planTemplateAudio(
      follow({
        allowPlay: false,
        audioPaused: false,
        audioTime: 2,
        videoTime: 2.4,
      }),
    );
    expect(plan.play).toBe(false);
    expect(plan.seek).toBe(true);
    expect(planTemplateAudio(follow({ allowPlay: false, audioPaused: false, audioTime: 2, videoTime: 2.02 })).seek).toBe(
      false,
    );
  });

  it("releases the audio element for landscape and for export", () => {
    expect(planTemplateAudio(follow({ mode: "landscape", previewMuted: false })).release).toBe(true);
    expect(planTemplateAudio(follow({ mode: "landscape", previewMuted: false })).pictureMuted).toBe(false);
    expect(planTemplateAudio(follow({ mode: "landscape", previewMuted: true })).pictureMuted).toBe(true);
    const exporting = planTemplateAudio(follow({ exporting: true, userGesture: true, picturePlaying: true }));
    expect(exporting.release).toBe(true);
    expect(exporting.play).toBe(false);
    expect(exporting.seek).toBe(false);
  });

  it("does not play while the picture is paused or a play() call is already in flight", () => {
    expect(planTemplateAudio(follow({ picturePlaying: false, userGesture: true })).play).toBe(false);
    expect(planTemplateAudio(follow({ playPending: true, audioPaused: true })).play).toBe(false);
    expect(planTemplateAudio(follow({ playPending: true, userGesture: true })).play).toBe(true);
  });

  it("does not seek a paused soundtrack that is already on the picture clock", () => {
    const plan = planTemplateAudio(
      follow({ userGesture: true, audioPaused: true, audioTime: 1.2, videoTime: 1.2 }),
    );
    expect(plan.play).toBe(true);
    expect(plan.seek).toBe(false);
    const tick = planTemplateAudio(
      follow({ allowPlay: true, audioPaused: true, audioTime: 2, videoTime: 2.02 }),
    );
    expect(tick.play).toBe(true);
    expect(tick.seek).toBe(false);
  });

  it("does not seek while the gesture play() is still pending", () => {
    const plan = planTemplateAudio(
      follow({ playPending: true, audioPaused: true, audioTime: 0, videoTime: 2.4 }),
    );
    expect(plan.play).toBe(false);
    expect(plan.seek).toBe(false);
  });
});
