/** Composition clock: never wall time or a frame counter. */
export const PAINT_CLOCK = "video.currentTime" as const;

/**
 * Preview compose rate. Export/save uses `EXPORT_FPS` (30) on the offline
 * path and is independent of this value.
 */
export const PREVIEW_FPS = 15;

export const PREVIEW_FRAME_INTERVAL = 1 / PREVIEW_FPS;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Whether a preview paint should run for this media time. */
export function shouldPaintPreviewFrame(
  currentTime: number,
  lastPaintTime: number,
  extras: { paused?: boolean; lastSeenTime?: number } = {},
): boolean {
  if (!Number.isFinite(lastPaintTime)) return true;
  if (extras.paused) return true;
  const sincePaint = currentTime - lastPaintTime;
  if (sincePaint < 0 || sincePaint >= PREVIEW_FRAME_INTERVAL) return true;
  if (Number.isFinite(extras.lastSeenTime)) {
    const step = currentTime - extras.lastSeenTime!;
    if (step < 0 || step > PREVIEW_FRAME_INTERVAL) return true;
  }
  return false;
}

/**
 * Paint presented video frames (rVFC), rate-limited to `PREVIEW_FPS`.
 * An rAF watchdog also paints when `currentTime` moved but rVFC did not fire
 * (headless / background). The paint callback must read `video.currentTime` itself.
 */
export function startVideoPaintLoop(video: HTMLVideoElement, paint: () => void): () => void {
  const media = video as VideoWithFrameCallback;
  let raf = 0;
  let rvfc = 0;
  let running = true;
  let lastSeenTime = Number.NaN;
  let lastPaintTime = Number.NaN;

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

  const runPaint = () => {
    const time = video.currentTime;
    const due = shouldPaintPreviewFrame(time, lastPaintTime, {
      paused: video.paused === true,
      lastSeenTime,
    });
    lastSeenTime = time;
    if (!due) return;
    lastPaintTime = time;
    paint();
  };

  const scheduleRvfc = () => {
    if (!running || typeof media.requestVideoFrameCallback !== "function") return;
    rvfc = media.requestVideoFrameCallback(() => {
      rvfc = 0;
      if (!running) return;
      runPaint();
      scheduleRvfc();
    });
  };

  const scheduleWatchdog = () => {
    if (!running || typeof requestAnimationFrame !== "function") return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!running) return;
      if (video.currentTime !== lastSeenTime) {
        runPaint();
      }
      scheduleWatchdog();
    });
  };

  runPaint();
  scheduleRvfc();
  scheduleWatchdog();

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
