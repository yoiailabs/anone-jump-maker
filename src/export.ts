import {
  captureCanvasStream,
  combineStreams,
  extensionForMime,
  pickRecorderMime,
  recordStream,
} from "./recorder.ts";

export const EXPORT_FPS = 30;

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

export async function recordRealtime(options: {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  audioStream: MediaStream | null;
  resumeAudio: () => Promise<void>;
  startLoop: () => Promise<void>;
}): Promise<ExportResult> {
  const { canvas, video, audioStream, resumeAudio, startLoop } = options;
  await resumeAudio();
  video.pause();
  video.currentTime = 0;
  await seekVideo(video, 0);
  const canvasStream = captureCanvasStream(canvas, EXPORT_FPS);
  const mixed = combineStreams(canvasStream, audioStream);
  video.muted = false;
  const finished = whenEnded(video);
  const blobPromise = recordStream(mixed, finished);
  await video.play();
  await startLoop();
  const blob = await blobPromise;
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
