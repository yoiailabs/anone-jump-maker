import type { CharacterFrame } from "./compositor.ts";
import { waitForPresentedFrame } from "./playback.ts";

export const EXPORT_FPS = 30;

/** 保存はリアルタイム録画ではなく、フレームをシークして組み立てる。 */
export const EXPORT_PATH = "offline" as const;

/** 音声はテンプレファイルから mux。キャプチャストリームは使わない。 */
export const EXPORT_AUDIO_SOURCE = "template-file" as const;

/**
 * 保存のキャラ画素は HTMLVideoElement ではなく、同じテンプレファイルを VideoDecoder で読む。
 * Android Chrome は paused seek 後も video テクスチャが先頭フレームのままになる。
 */
export const EXPORT_CHARACTER_SOURCE = "template-file-decode" as const;

export const TEMPLATE_DECODE_MESSAGE = "テンプレ映像をデコードできませんでした";
export const TEMPLATE_FRAME_MISSING_MESSAGE = "テンプレのフレームを取得できませんでした";

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

/**
 * シーク完了後に canvas/WebGL へ提示されたフレームを待つ上限。
 * Android Chrome は seeked / currentTime 更新後もしばらく先頭フレームのままになる。
 */
export const SEEK_PRESENT_TIMEOUT_MS = 400;

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = clamp(time, 0, duration > 0 ? Math.max(0, duration - 1e-4) : time);
  video.pause();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - target) < 8e-4) {
    return;
  }
  // rVFC は currentTime 代入より前に登録する。代入後だと paused seek の提示を取り逃す。
  const presented = waitForPresentedFrame(video, SEEK_PRESENT_TIMEOUT_MS, { mediaTime: target });
  const seeked = new Promise<void>((resolve, reject) => {
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
  await Promise.all([seeked, presented]);
}

/** デコード済みフレームを保存のキャラ源にする。HTMLVideoElement は使わない。 */
export function characterFrameFromCanvas(canvas: {
  width: number;
  height: number;
}): CharacterFrame {
  return { source: canvas as CanvasImageSource, width: canvas.width, height: canvas.height };
}

/**
 * ファイルデコーダが返した PTS が、保存の論理時刻に使えるか。
 * 先頭フレーム（t≈0）の使い回しはここで落とす。
 */
export function templateFrameMatchesTime(sampleTime: number, targetTime: number): boolean {
  if (!Number.isFinite(sampleTime) || !Number.isFinite(targetTime)) return false;
  return Math.abs(sampleTime - targetTime) < 3 / EXPORT_FPS + 1e-3;
}

export function paintDecodedExportFrame(
  time: number,
  frame: { canvas: { width: number; height: number }; timestamp: number } | null,
  draw: (time: number, character?: CharacterFrame) => void,
): void {
  if (!frame || frame.canvas.width < 1 || frame.canvas.height < 1 || !templateFrameMatchesTime(frame.timestamp, time)) {
    throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
  }
  draw(time, characterFrameFromCanvas(frame.canvas));
}

/**
 * プレビューと同じ compositor / 論理時刻でオフライン生成する。
 * WebCodecs が無い環境では録画に落とさず、方針を明示して失敗する。
 */
export async function exportJumpVideo(options: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  draw: (time: number, character?: CharacterFrame) => void;
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
