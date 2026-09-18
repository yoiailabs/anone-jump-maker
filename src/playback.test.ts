import { describe, expect, it } from "vitest";
import { EXPORT_FPS } from "./export.ts";
import {
  PAINT_CLOCK,
  PREVIEW_FPS,
  PREVIEW_FRAME_INTERVAL,
  shouldPaintPreviewFrame,
  startVideoPaintLoop,
  waitForPresentedFrame,
} from "./playback.ts";

function stubRaf() {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
  return () => {
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
  };
}

function stubQueuedRaf() {
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
  return {
    rafs,
    restore() {
      globalThis.requestAnimationFrame = previousRaf;
      globalThis.cancelAnimationFrame = previousCancel;
    },
  };
}

describe("PAINT_CLOCK", () => {
  it("is the media element's currentTime, not a wall clock", () => {
    expect(PAINT_CLOCK).toBe("video.currentTime");
  });
});

describe("PREVIEW_FPS", () => {
  it("is 24 and leaves export at 30", () => {
    expect(PREVIEW_FPS).toBe(24);
    expect(PREVIEW_FRAME_INTERVAL).toBeCloseTo(1 / 24, 10);
    expect(EXPORT_FPS).toBe(30);
    expect(PREVIEW_FPS).not.toBe(EXPORT_FPS);
  });
});

describe("shouldPaintPreviewFrame", () => {
  it("paints the first frame and after a preview interval", () => {
    expect(shouldPaintPreviewFrame(0, Number.NaN)).toBe(true);
    expect(shouldPaintPreviewFrame(1 / 30, 0)).toBe(false);
    expect(shouldPaintPreviewFrame(PREVIEW_FRAME_INTERVAL, 0)).toBe(true);
  });

  it("paints immediately on rewind, time jumps, or pause/scrub", () => {
    expect(shouldPaintPreviewFrame(0.2, 0.5)).toBe(true);
    expect(shouldPaintPreviewFrame(1.2, 1.0, { lastSeenTime: 1.0 })).toBe(true);
    expect(shouldPaintPreviewFrame(1.02, 1.0, { paused: true })).toBe(true);
  });
});

describe("startVideoPaintLoop", () => {
  it("paints immediately then follows requestVideoFrameCallback at preview fps", () => {
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
    const restore = stubRaf();
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as unknown as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      expect(pending).toHaveLength(1);
      video.currentTime = 1 / 30;
      pending.shift()?.();
      expect(paints).toBe(1);
      expect(pending).toHaveLength(1);
      video.currentTime = PREVIEW_FRAME_INTERVAL;
      pending.shift()?.();
      expect(paints).toBe(2);
      expect(pending).toHaveLength(1);
      stop();
      pending.shift()?.();
      expect(paints).toBe(2);
    } finally {
      restore();
    }
  });

  it("throttles ~30fps presented frames to 24fps while playing", () => {
    const pending: Array<() => void> = [];
    const video = {
      currentTime: 0,
      paused: false,
      requestVideoFrameCallback(cb: () => void) {
        pending.push(cb);
        return pending.length;
      },
      cancelVideoFrameCallback() {
        pending.length = 0;
      },
    };
    const restore = stubRaf();
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as unknown as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      video.currentTime = 1 / 30;
      pending.shift()?.();
      expect(paints).toBe(1);
      video.currentTime = 1 / 24;
      pending.shift()?.();
      expect(paints).toBe(2);
      video.currentTime = 1 / 24 + 1 / 30;
      pending.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      restore();
    }
  });

  it("paints immediately when currentTime jumps or rewinds", () => {
    const pending: Array<() => void> = [];
    const video = {
      currentTime: 0,
      paused: false,
      requestVideoFrameCallback(cb: () => void) {
        pending.push(cb);
        return pending.length;
      },
      cancelVideoFrameCallback() {
        pending.length = 0;
      },
    };
    const restore = stubRaf();
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as unknown as HTMLVideoElement, () => {
        paints += 1;
      });
      video.currentTime = 1.2;
      pending.shift()?.();
      expect(paints).toBe(2);
      video.currentTime = 0.4;
      pending.shift()?.();
      expect(paints).toBe(3);
      stop();
    } finally {
      restore();
    }
  });

  it("paints a paused seek even when the jump is smaller than a preview frame", () => {
    const pending: Array<() => void> = [];
    const video = {
      currentTime: 0,
      paused: true,
      requestVideoFrameCallback(cb: () => void) {
        pending.push(cb);
        return pending.length;
      },
      cancelVideoFrameCallback() {
        pending.length = 0;
      },
    };
    const restore = stubRaf();
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as unknown as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      video.currentTime = 0.02;
      pending.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      restore();
    }
  });

  it("watchdog paints when currentTime moves without a video frame callback", () => {
    const { rafs, restore } = stubQueuedRaf();
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
      restore();
    }
  });

  it("watchdog skips sub-interval playback steps and paints after 1/24s", () => {
    const { rafs, restore } = stubQueuedRaf();
    const video = { currentTime: 0, paused: false };
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as HTMLVideoElement, () => {
        paints += 1;
      });
      video.currentTime = 1 / 30;
      rafs.shift()?.();
      expect(paints).toBe(1);
      video.currentTime = PREVIEW_FRAME_INTERVAL;
      rafs.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      restore();
    }
  });

  it("falls back to requestAnimationFrame when rVFC is missing", () => {
    const { rafs: pending, restore } = stubQueuedRaf();
    const video = { currentTime: 0 };
    try {
      let paints = 0;
      const stop = startVideoPaintLoop(video as HTMLVideoElement, () => {
        paints += 1;
      });
      expect(paints).toBe(1);
      video.currentTime = 1 / 30;
      pending.shift()?.();
      expect(paints).toBe(1);
      video.currentTime = PREVIEW_FRAME_INTERVAL;
      pending.shift()?.();
      expect(paints).toBe(2);
      stop();
    } finally {
      restore();
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
