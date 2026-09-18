import type { CharacterFrame } from "./compositor.ts";
import { waitForPresentedFrame } from "./playback.ts";

export const EXPORT_FPS = 30;

/** 保存はリアルタイム録画ではなく、フレームをシークして組み立てる。 */
export const EXPORT_PATH = "offline" as const;

/** 音声はテンプレファイルから mux。キャプチャストリームは使わない。 */
export const EXPORT_AUDIO_SOURCE = "template-file" as const;

/**
 * 保存のキャラは、使えるならテンプレファイルの VideoDecoder。
 * それが落ちる環境（iOS / WebKit）は HTML video シークに落とす。
 */
export const EXPORT_CHARACTER_SOURCE = "capability-branch" as const;

/** キャラ画素は VideoFrame/canvas blit ではなく、デコーダ出力の RGBA コピー。 */
export const EXPORT_CHARACTER_PIXELS = "rgba-copyTo" as const;

/** RGBA 経路が使えない環境（WebKit など）は HTML video シークに落とす。 */
export const EXPORT_CHARACTER_FALLBACK = "html-video-seek" as const;

export type ExportCharacterPath = typeof EXPORT_CHARACTER_PIXELS | typeof EXPORT_CHARACTER_FALLBACK;

export const TEMPLATE_DECODE_MESSAGE = "テンプレ映像をデコードできませんでした";
export const TEMPLATE_FRAME_MISSING_MESSAGE = "テンプレのフレームを取得できませんでした";
export const TEMPLATE_FRAME_FROZEN_MESSAGE = "テンプレのフレームが先頭のままです";

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
 * シーク後の提示待ち上限。
 * html-video-seek で毎フレーム待ると 466×400ms ≈ 186s になるので、保存フォールバックでは使わない。
 */
export const SEEK_PRESENT_TIMEOUT_MS = 400;

/** RGBA プローブ全体の上限。WebKit の software デコードがここで止まらないようにする。 */
export const EXPORT_PROBE_TIMEOUT_MS = 1200;

export type SeekVideoOptions = {
  /**
   * 提示フレームを待つ。Android の HTML video 固まり対策用。
   * iOS の html-video-seek 保存では false（#52 以前と同じ seeked のみ）。
   */
  waitForPresented?: boolean;
};

export async function seekVideo(
  video: HTMLVideoElement,
  time: number,
  options: SeekVideoOptions = {},
): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = clamp(time, 0, duration > 0 ? Math.max(0, duration - 1e-4) : time);
  video.pause();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - target) < 8e-4) {
    return;
  }
  const waitForPresented = options.waitForPresented === true;
  // rVFC は currentTime 代入より前に登録する。代入後だと paused seek の提示を取り逃す。
  const presented = waitForPresented
    ? waitForPresentedFrame(video, SEEK_PRESENT_TIMEOUT_MS, { mediaTime: target })
    : null;
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
  if (presented) {
    await Promise.all([seeked, presented]);
    return;
  }
  await seeked;
}

export async function firstResolved<T>(promises: ReadonlyArray<Promise<T>>): Promise<T> {
  return Promise.race(promises);
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

export type RgbaFrame = {
  timestamp: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  fingerprint: number;
};

export type CopyableSample = {
  timestamp: number;
  codedWidth: number;
  codedHeight: number;
  allocationSize: (options: { format: "RGBA" }) => number;
  copyTo: (
    dest: AllowSharedBufferSource,
    options: { format: "RGBA" },
  ) => Promise<ReadonlyArray<{ stride?: number }> | void>;
};

/** stride 付き RGBA を密な ImageData 用バッファに直す。 */
export function packedRgba(src: Uint8Array, width: number, height: number, stride: number): Uint8ClampedArray {
  const row = width * 4;
  const out = new Uint8ClampedArray(row * height);
  if (!(width > 0 && height > 0 && stride >= row && src.byteLength >= stride * (height - 1) + row)) {
    throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
  }
  if (stride === row) {
    out.set(src.subarray(0, row * height));
    return out;
  }
  for (let y = 0; y < height; y += 1) {
    out.set(src.subarray(y * stride, y * stride + row), y * row);
  }
  return out;
}

/** 粗い格子の画素ハッシュ。先頭フレームの使い回し検出用。 */
export function fingerprintRgba(data: Uint8ClampedArray, width: number, height: number): number {
  let hash = 2166136261;
  const stepX = Math.max(1, Math.floor(width / 8));
  const stepY = Math.max(1, Math.floor(height / 8));
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      hash ^= (data[i] ?? 0) | ((data[i + 1] ?? 0) << 8) | ((data[i + 2] ?? 0) << 16);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

export function assertCharacterAdvanced(firstFingerprint: number, fingerprint: number, time: number): void {
  if (time >= 1 && fingerprint === firstFingerprint) {
    throw new Error(TEMPLATE_FRAME_FROZEN_MESSAGE);
  }
}

export type ExportCharacterProbe = {
  copiedFirst: boolean;
  copiedLater: boolean;
  firstTimeOk: boolean;
  laterTimeOk: boolean;
  pixelsAdvanced: boolean;
};

/**
 * Android では RGBA コピーが通って画素も進む。
 * iOS / WebKit は copyTo('RGBA')・PTS・デコーダのいずれかが落ちることがある。
 */
export function chooseExportCharacterPath(probe: ExportCharacterProbe): ExportCharacterPath {
  if (probe.copiedFirst && probe.copiedLater && probe.firstTimeOk && probe.laterTimeOk && probe.pixelsAdvanced) {
    return EXPORT_CHARACTER_PIXELS;
  }
  return EXPORT_CHARACTER_FALLBACK;
}

export async function copySampleRgba(sample: CopyableSample): Promise<RgbaFrame> {
  const width = sample.codedWidth;
  const height = sample.codedHeight;
  if (!(width > 0 && height > 0)) {
    throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
  }
  const options = { format: "RGBA" as const };
  const raw = new Uint8Array(sample.allocationSize(options));
  const layout = await sample.copyTo(raw, options);
  const stride =
    Array.isArray(layout) && layout[0] && typeof layout[0].stride === "number" ? layout[0].stride : width * 4;
  const data = packedRgba(raw, width, height, stride);
  return {
    timestamp: sample.timestamp,
    width,
    height,
    data,
    fingerprint: fingerprintRgba(data, width, height),
  };
}

export function putRgbaOnCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  frame: Pick<RgbaFrame, "data" | "width" | "height">,
): void {
  if (typeof ImageData !== "function") {
    throw new Error(TEMPLATE_DECODE_MESSAGE);
  }
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }
  const pixels = new Uint8ClampedArray(frame.data.length);
  pixels.set(frame.data);
  ctx.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0);
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
