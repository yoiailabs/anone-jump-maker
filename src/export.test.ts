import { describe, expect, it } from "vitest";
import { PAINT_CLOCK } from "./playback.ts";
import { prepareRealtimeClock, RECORD_AUDIO_SOURCE, RECORD_START_ORDER } from "./export.ts";

describe("record sync plan", () => {
  it("uses the video element as the only clock and audio source", () => {
    expect(PAINT_CLOCK).toBe("video.currentTime");
    expect(RECORD_AUDIO_SOURCE).toBe("media-element-source");
    expect(RECORD_START_ORDER).toEqual([
      "seek",
      "unmute",
      "paint-loop",
      "play",
      "first-frame",
      "audio-tap",
      "media-recorder",
    ]);
  });

  it("starts the paint loop and play before the first presented frame", async () => {
    const order: string[] = [];
    await prepareRealtimeClock({
      startLoop: async () => {
        order.push("paint-loop");
      },
      play: async () => {
        order.push("play");
      },
      waitForFrame: async () => {
        order.push("first-frame");
      },
    });
    order.push("media-recorder");
    expect(order).toEqual(["paint-loop", "play", "first-frame", "media-recorder"]);
  });
});
