/** Composition clock: never wall time or a frame counter. */
export const PAINT_CLOCK = "video.currentTime" as const;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Paint whenever the video presents a frame (rVFC), falling back to rAF.
 * The paint callback must read `video.currentTime` itself.
 */
export function startVideoPaintLoop(video: HTMLVideoElement, paint: () => void): () => void {
  const media = video as VideoWithFrameCallback;
  let raf = 0;
  let rvfc = 0;
  let running = true;

  const clearScheduled = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (rvfc && typeof media.cancelVideoFrameCallback === "function") {
      media.cancelVideoFrameCallback(rvfc);
      rvfc = 0;
    }
  };

  const schedule = () => {
    if (!running) return;
    if (typeof media.requestVideoFrameCallback === "function") {
      rvfc = media.requestVideoFrameCallback(() => {
        rvfc = 0;
        if (!running) return;
        paint();
        schedule();
      });
      return;
    }
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!running) return;
      paint();
      schedule();
    });
  };

  paint();
  schedule();

  return () => {
    running = false;
    clearScheduled();
  };
}

/** Resolves on the next presented video frame, or after a short timeout. */
export function waitForPresentedFrame(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  const media = video as VideoWithFrameCallback;
  return new Promise((resolve) => {
    let settled = false;
    let handle = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(() => {
      if (!settled && handle && typeof media.cancelVideoFrameCallback === "function") {
        media.cancelVideoFrameCallback(handle);
      }
      finish();
    }, timeoutMs);

    if (typeof media.requestVideoFrameCallback === "function") {
      handle = media.requestVideoFrameCallback(() => finish());
      return;
    }

    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      finish();
      return;
    }

    video.addEventListener("playing", finish, { once: true });
    video.addEventListener("loadeddata", finish, { once: true });
  });
}
