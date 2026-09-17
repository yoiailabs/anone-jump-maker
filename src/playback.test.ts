import { describe, expect, it } from "vitest";
import { PAINT_CLOCK, startVideoPaintLoop, waitForPresentedFrame } from "./playback.ts";

describe("PAINT_CLOCK", () => {
  it("is the media element's currentTime, not a wall clock", () => {
    expect(PAINT_CLOCK).toBe("video.currentTime");
  });
});

describe("startVideoPaintLoop", () => {
  it("paints immediately then follows requestVideoFrameCallback", () => {
    const pending: Array<() => void> = [];
    const video = {
      currentTime: 0,
      requestVideoFrameCallback(cb: () => void) {
        pending.push(cb);
        return pending.length;
      },
      cancelVideoFrameCallback() {
        pending.length = 0;
      },
    };
    const previousRaf = globalThis.requestAnimationFrame;
    const previousCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as unknown as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      expect(pending).toHaveLength(1);
      video.currentTime = 0.03;
      pending.shift()?.();
      expect(paints).toBe(2);
      expect(pending).toHaveLength(1);
      stop();
      pending.shift()?.();
      expect(paints).toBe(2);
    } finally {
      globalThis.requestAnimationFrame = previousRaf;
      globalThis.cancelAnimationFrame = previousCancel;
    }
  });

  it("watchdog paints when currentTime moves without a video frame callback", () => {
    const rafs: Array<() => void> = [];
    const previousRaf = globalThis.requestAnimationFrame;
    const previousCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafs.push(() => cb(0));
      return rafs.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {
      rafs.length = 0;
    }) as typeof cancelAnimationFrame;
    const video = { currentTime: 0 };
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      rafs.shift()?.();
      expect(paints).toBe(1);
      video.currentTime = 0.2;
      rafs.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      globalThis.requestAnimationFrame = previousRaf;
      globalThis.cancelAnimationFrame = previousCancel;
    }
  });

  it("falls back to requestAnimationFrame when rVFC is missing", () => {
    const pending: Array<() => void> = [];
    const previous = globalThis.requestAnimationFrame;
    const previousCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      pending.push(() => cb(0));
      return pending.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {
      pending.length = 0;
    }) as typeof cancelAnimationFrame;
    const video = { currentTime: 0 };
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      video.currentTime = 0.04;
      pending.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      globalThis.requestAnimationFrame = previous;
      globalThis.cancelAnimationFrame = previousCancel;
    }
  });
});

describe("waitForPresentedFrame", () => {
  it("resolves on the next video frame callback", async () => {
    let cb: (() => void) | undefined;
    const video = {
      requestVideoFrameCallback(next: () => void) {
        cb = next;
        return 1;
      },
      cancelVideoFrameCallback() {
        cb = undefined;
      },
    };
    const wait = waitForPresentedFrame(video as unknown as HTMLVideoElement, 50);
    expect(cb).toBeTypeOf("function");
    cb?.();
    await wait;
  });
});
