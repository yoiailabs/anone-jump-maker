import { waitForPresentedFrame } from "./playback.ts";
import {
  captureCanvasStream,
  captureElementAudio,
  combineStreams,
  extensionForMime,
  pickRecorderMime,
  recordStream,
  requestCanvasFrame,
} from "./recorder.ts";

let onPainted: (() => void) | null = null;

/** Called after each composited frame so the capture track can emit it. */
export function signalCanvasPainted(): void {
  onPainted?.();
}

/** Capture sample rate. Each paint also calls requestFrame so frames follow the video clock. */
export const EXPORT_FPS = 30;

export const RECORD_AUDIO_SOURCE = "element-captureStream" as const;

export const RECORD_START_ORDER = [
  "seek",
  "unmute",
  "paint-loop",
  "play",
  "first-frame",
  "media-recorder",
] as const;

export type ExportResult = {
  blob: Blob;
  mime: string;
  extension: "mp4" | "webm";
  mode: "record";
};

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = clamp(time, 0, duration > 0 ? Math.max(0, duration - 1e-4) : time);
  video.pause();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - target) < 8e-4) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onSeeked = () => finish();
    const onError = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("シークに失敗しました"));
    };
    const timer = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (Math.abs(video.currentTime - target) < 0.05) {
        resolve();
        return;
      }
      reject(new Error("シークがタイムアウトしました"));
    }, 2500);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
  });
}

/**
 * Arm playback so MediaRecorder starts on a presented video frame.
 * Paint/hop/swap must already follow `video.currentTime`.
 */
export async function prepareRealtimeClock(steps: {
  startLoop: () => Promise<void>;
  play: () => Promise<void>;
  waitForFrame: () => Promise<void>;
}): Promise<void> {
  await steps.startLoop();
  await steps.play();
  await steps.waitForFrame();
}

export async function recordRealtime(options: {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  startLoop: () => Promise<void>;
}): Promise<ExportResult> {
  const { canvas, video, startLoop } = options;
  video.pause();
  video.muted = false;
  video.volume = 1;
  await seekVideo(video, 0);

  const canvasStream = captureCanvasStream(canvas, EXPORT_FPS);
  const audioStream = captureElementAudio(video);
  const mixed = combineStreams(canvasStream, audioStream.getAudioTracks().length > 0 ? audioStream : null);
  const unbind = bindPaintCapture(canvasStream);

  const finished = whenEnded(video);
  try {
    await prepareRealtimeClock({
      startLoop,
      play: () => video.play(),
      waitForFrame: () => waitForPresentedFrame(video),
    });
    requestCanvasFrame(canvasStream);
    const blob = await recordStream(mixed, finished);
    for (const track of canvasStream.getTracks()) {
      track.stop();
    }
    const mime = blob.type || pickRecorderMime();
    return {
      blob,
      mime,
      extension: extensionForMime(mime),
      mode: "record",
    };
  } finally {
    unbind();
  }
}

function bindPaintCapture(stream: MediaStream): () => void {
  onPainted = () => requestCanvasFrame(stream);
  requestCanvasFrame(stream);
  return () => {
    onPainted = null;
  };
}

function whenEnded(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("ended", done);
      resolve();
    };
    video.addEventListener("ended", done);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
