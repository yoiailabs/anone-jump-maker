import {
  captureCanvasStream,
  combineStreams,
  extensionForMime,
  pickRecorderMime,
  recordStream,
} from "./recorder.ts";

export const EXPORT_FPS = 30;

export type ExportMode = "offline" | "record";

export type ExportProgress = {
  mode: ExportMode;
  current: number;
  total: number;
};

export type ExportResult = {
  blob: Blob;
  mime: string;
  extension: "mp4" | "webm";
  mode: ExportMode;
};

export function frameTimes(duration: number, fps: number): number[] {
  const safeFps = fps > 0 ? fps : EXPORT_FPS;
  if (!(duration > 0)) return [0];
  const count = Math.max(1, Math.round(duration * safeFps));
  const last = Math.max(0, duration - 1 / safeFps / 2);
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    times.push(Math.min(i / safeFps, last));
  }
  return times;
}

export function hasWebCodecsVideoEncoder(): boolean {
  return typeof VideoEncoder === "function";
}

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
  onProgress?: (progress: ExportProgress) => void;
}): Promise<ExportResult> {
  const { canvas, video, audioStream, resumeAudio, startLoop, onProgress } = options;
  onProgress?.({ mode: "record", current: 0, total: 1 });
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

export async function exportJumpVideo(options: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  draw: () => void;
  duration: number;
  fps: number;
  audioStream: MediaStream | null;
  resumeAudio: () => Promise<void>;
  startLoop: () => Promise<void>;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<ExportResult> {
  try {
    const offline = await import("./offline-encode.ts");
    const plan = await offline.pickOfflinePlan(options.canvas.width, options.canvas.height);
    if (plan) {
      return await offline.encodeOffline({ ...options, plan });
    }
  } catch {
    // WebCodecs / mux が使えない・途中で落ちたら録画へ
  }
  return recordRealtime(options);
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
