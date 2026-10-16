import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./layout.ts";
import {
  TEMPLATE_AUDIO_DRIFT_SEC,
  templateAudioIsSeparate,
  templateAudioNeedsSeek,
  templatePictureMuted,
} from "./template-audio.ts";

describe("template audio", () => {
  it("plays vertical.mp4 under the portrait picture and keeps landscape audio on its own file", () => {
    expect(templateAudioIsSeparate("portrait")).toBe(true);
    expect(TEMPLATES.portrait.audio).toBe("/template/vertical.mp4");
    expect(TEMPLATES.portrait.video).toBe("/template/landscape.mp4");
    expect(templateAudioIsSeparate("landscape")).toBe(false);
    expect(templatePictureMuted("portrait", false)).toBe(true);
    expect(templatePictureMuted("portrait", true)).toBe(true);
    expect(templatePictureMuted("landscape", false)).toBe(false);
    expect(templatePictureMuted("landscape", true)).toBe(true);
  });

  it("seeks the audio element only after it drifts", () => {
    expect(TEMPLATE_AUDIO_DRIFT_SEC).toBeGreaterThan(0.03);
    expect(templateAudioNeedsSeek(1, 1.02)).toBe(false);
    expect(templateAudioNeedsSeek(1, 1.2)).toBe(true);
    expect(templateAudioNeedsSeek(Number.NaN, 1)).toBe(false);
  });
});
