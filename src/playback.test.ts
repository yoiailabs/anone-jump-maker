import { describe, expect, it } from "vitest";
import { EXPORT_FPS } from "./export.ts";
import {
  PAINT_CLOCK,
  PREVIEW_FPS,
  PREVIEW_FRAME_INTERVAL,
  isFirstMovingCompositePaint,
  previewStartTrigger,
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

describe("preview start measurement", () => {
  it("names play, resume, restart, and aspect resume without treating a paused frame as moving", () => {
    expect(
      previewStartTrigger({ aspectResume: false, fromStart: false, ended: false, currentTime: 0, duration: 8 }),
    ).toBe("play");
    expect(
      previewStartTrigger({ aspectResume: false, fromStart: false, ended: false, currentTime: 2.4, duration: 8 }),
    ).toBe("resume");
    expect(
      previewStartTrigger({ aspectResume: false, fromStart: false, ended: true, currentTime: 8, duration: 8 }),
    ).toBe("restart");
    expect(
      previewStartTrigger({ aspectResume: true, fromStart: false, ended: false, currentTime: 2, duration: 8 }),
    ).toBe("aspect_resume");
    expect(
      isFirstMovingCompositePaint({ anchorTime: 1, currentTime: 1, paused: true, exporting: false }),
    ).toBe(false);
    expect(
      isFirstMovingCompositePaint({ anchorTime: 1, currentTime: 1, paused: false, exporting: false }),
    ).toBe(false);
    expect(
      isFirstMovingCompositePaint({ anchorTime: 1, currentTime: 1.2, paused: false, exporting: true }),
    ).toBe(false);
    expect(
      isFirstMovingCompositePaint({ anchorTime: 1, currentTime: 1.04, paused: false, exporting: false }),
    ).toBe(true);
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

  it("ignores a stale mediaTime and waits for the sought frame", async () => {
    const pending: Array<(now: number, metadata: { mediaTime: number }) => void> = [];
    const video = {
      requestVideoFrameCallback(next: (now: number, metadata: { mediaTime: number }) => void) {
        pending.push(next);
        return pending.length;
      },
      cancelVideoFrameCallback() {
        pending.length = 0;
      },
    };
    let done = false;
    const wait = waitForPresentedFrame(video as unknown as HTMLVideoElement, 5_000, {
      mediaTime: 1.2,
    }).then(() => {
      done = true;
    });
    pending.shift()?.(0, { mediaTime: 0 });
    await Promise.resolve();
    expect(done).toBe(false);
    expect(pending).toHaveLength(1);
    pending.shift()?.(0, { mediaTime: 1.2 });
    await wait;
    expect(done).toBe(true);
  });

  it("falls back to two animation frames when rVFC is missing", async () => {
    const { rafs, restore } = stubQueuedRaf();
    try {
      let done = false;
      const wait = waitForPresentedFrame({ paused: true } as HTMLVideoElement, 5_000).then(() => {
        done = true;
      });
      expect(rafs).toHaveLength(1);
      rafs.shift()?.();
      await Promise.resolve();
      expect(done).toBe(false);
      expect(rafs).toHaveLength(1);
      rafs.shift()?.();
      await wait;
      expect(done).toBe(true);
    } finally {
      restore();
    }
  });
});
