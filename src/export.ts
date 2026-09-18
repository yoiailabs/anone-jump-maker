export const EXPORT_FPS = 30;

/** 保存はリアルタイム録画ではなく、フレームをシークして組み立てる。 */
export const EXPORT_PATH = "offline" as const;

/** 音声はテンプレファイルから mux。キャプチャストリームは使わない。 */
export const EXPORT_AUDIO_SOURCE = "template-file" as const;

/** 保存パスに MediaRecorder フォールバックは置かない。未対応ブラウザは明示エラー。 */
export const EXPORT_FALLBACK = "none" as const;

export const UNSUPPORTED_EXPORT_MESSAGE =
  "このブラウザは動画の生成に未対応です。Chrome または Edge で開いてください。";

export type ExportProgress = {
  mode: "offline";
  current: number;
  total: number;
};

export type ExportResult = {
  blob: Blob;
  mime: string;
  extension: "mp4" | "webm";
  mode: "offline";
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

/** 1回のシーク待ち。Android Chrome では seeked が遅れたり欠けることがある。 */
export const SEEK_TIMEOUT_MS = 10_000;

/** タイムアウト後に currentTime を再設定する回数。 */
export const SEEK_TIMEOUT_RETRIES = 2;

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = clamp(time, 0, duration > 0 ? Math.max(0, duration - 1e-4) : time);
  video.pause();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - target) < 8e-4) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    let retriesLeft = SEEK_TIMEOUT_RETRIES;
    let timer = 0;
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
    const armTimer = () => {
      timer = window.setTimeout(() => {
        if (Math.abs(video.currentTime - target) < 0.05) {
          finish();
          return;
        }
        if (retriesLeft > 0) {
          retriesLeft -= 1;
          video.currentTime = target;
          armTimer();
          return;
        }
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        reject(new Error("シークがタイムアウトしました"));
      }, SEEK_TIMEOUT_MS);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
    armTimer();
  });
}

/**
 * プレビューと同じ compositor / 論理時刻でオフライン生成する。
 * WebCodecs が無い環境では録画に落とさず、方針を明示して失敗する。
 */
export async function exportJumpVideo(options: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  draw: (time: number) => void;
  duration: number;
  fps: number;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<ExportResult> {
  if (!hasWebCodecsVideoEncoder()) {
    throw new Error(UNSUPPORTED_EXPORT_MESSAGE);
  }
  const { pickOfflinePlan, encodeOffline } = await import("./offline-encode.ts");
  const plan = await pickOfflinePlan(options.canvas.width, options.canvas.height);
  if (!plan) {
    throw new Error(UNSUPPORTED_EXPORT_MESSAGE);
  }
  return encodeOffline({ ...options, plan });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
