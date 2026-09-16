export function pickRecorderMime(): string {
  const safari = isAppleWebKit();
  const webm = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mp4 = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"];
  // Chromium reports video/mp4 then often writes VP9 into an .mp4 name. Prefer WebM there.
  const types = safari ? [...mp4, ...webm] : [...webm, ...mp4];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function isAppleWebKit(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)|Macintosh/.test(ua) && /WebKit/.test(ua) && !/Chrom(e|ium)|Android/.test(ua);
}

export function extensionForMime(mime: string): "mp4" | "webm" {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export function combineStreams(video: MediaStream, audio: MediaStream | null): MediaStream {
  const tracks: MediaStreamTrack[] = [...video.getVideoTracks()];
  if (audio) {
    tracks.push(...audio.getAudioTracks());
  }
  return new MediaStream(tracks);
}

export function captureCanvasStream(canvas: HTMLCanvasElement, fps: number): MediaStream {
  const withWebkit = canvas as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
    webkitCaptureStream?: (frameRate?: number) => MediaStream;
  };
  if (typeof withWebkit.captureStream === "function") {
    return withWebkit.captureStream(fps);
  }
  if (typeof withWebkit.webkitCaptureStream === "function") {
    return withWebkit.webkitCaptureStream(fps);
  }
  throw new Error("このブラウザは canvas.captureStream に未対応です");
}

export async function recordStream(stream: MediaStream, until: Promise<void>): Promise<Blob> {
  const mime = pickRecorderMime();
  const recorder = mime
    ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("録画に失敗しました"));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || mime || "video/webm" }));
    };
  });
  recorder.start(250);
  try {
    await until;
  } finally {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }
  return stopped;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}
