import {
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";
import {
  EXPORT_FPS,
  composeExportFrame,
  frameTimes,
  hasWebCodecsVideoEncoder,
  type ExportProgress,
  type ExportResult,
} from "./export.ts";

export type OfflinePlan = {
  container: "mp4" | "webm";
  videoCodec: VideoCodec;
  format: OutputFormat;
};

const VIDEO_QUALITY = new Quality("high");
const AUDIO_QUALITY = new Quality("high");

/** MP4 を優先（avc）。なければ WebM（vp9/vp8）。 */
const MP4_VIDEO_PREF: VideoCodec[] = ["avc", "hevc", "av1"];
const WEBM_VIDEO_PREF: VideoCodec[] = ["vp9", "av1", "vp8"];

export async function pickOfflinePlan(width: number, height: number): Promise<OfflinePlan | null> {
  if (!hasWebCodecsVideoEncoder()) return null;
  const size = { width, height, quality: VIDEO_QUALITY };
  const mp4 = new Mp4OutputFormat({ fastStart: "in-memory" });
  const mp4Codec = await getFirstEncodableVideoCodec(
    MP4_VIDEO_PREF.filter((codec) => mp4.getSupportedVideoCodecs().includes(codec)),
    size,
  );
  if (mp4Codec) {
    return { container: "mp4", videoCodec: mp4Codec, format: mp4 };
  }
  const webm = new WebMOutputFormat();
  const webmCodec = await getFirstEncodableVideoCodec(
    WEBM_VIDEO_PREF.filter((codec) => webm.getSupportedVideoCodecs().includes(codec)),
    size,
  );
  if (webmCodec) {
    return { container: "webm", videoCodec: webmCodec, format: webm };
  }
  return null;
}

export async function encodeOffline(options: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  draw: (time: number) => void;
  duration: number;
  fps: number;
  plan: OfflinePlan;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<ExportResult> {
  const { video, canvas, draw, duration, fps, plan, onProgress } = options;
  const times = frameTimes(duration, fps);
  const frameDuration = 1 / (fps > 0 ? fps : EXPORT_FPS);
  const target = new BufferTarget();
  const output = new Output({ format: plan.format, target });
  const videoSource = new CanvasSource(canvas, {
    codec: plan.videoCodec,
    quality: VIDEO_QUALITY,
    latencyMode: "quality",
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps > 0 ? fps : EXPORT_FPS });

  const pumpAudio = await attachTemplateAudio(output, plan.format, video.currentSrc || video.src);

  video.pause();
  video.muted = true;
  await output.start();
  try {
    if (pumpAudio) {
      await pumpAudio();
    }
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i]!;
      await composeExportFrame(video, time, draw);
      await videoSource.add(i * frameDuration, frameDuration);
      if (i === 0 || i === times.length - 1 || i % 8 === 0) {
        onProgress?.({ mode: "offline", current: i + 1, total: times.length });
        await yieldToUi();
      }
    }
    await output.finalize();
  } catch (error) {
    if (output.state === "started" || output.state === "pending") {
      await output.cancel();
    }
    throw error;
  }

  const buffer = target.buffer;
  if (!buffer) {
    throw new Error("生成バッファが空です");
  }
  const mime = plan.format.mimeType;
  const extension = plan.format.fileExtension.replace(".", "") as "mp4" | "webm";
  return {
    blob: new Blob([buffer], { type: mime }),
    mime,
    extension,
    mode: "offline",
  };
}

async function attachTemplateAudio(
  output: Output,
  format: OutputFormat,
  templateSrc: string,
): Promise<(() => Promise<void>) | null> {
  const input = await openTemplateInput(templateSrc);
  if (!input) return null;
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) {
      input.dispose();
      return null;
    }
    const packetCodec = await track.getCodec();
    if (packetCodec && format.getSupportedAudioCodecs().includes(packetCodec)) {
      const source = new EncodedAudioPacketSource(packetCodec);
      output.addAudioTrack(source);
      return async () => {
        try {
          const sink = new EncodedPacketSink(track);
          const decoderConfig = await track.getDecoderConfig();
          let first = true;
          for await (const packet of sink.packets()) {
            await source.add(packet, first && decoderConfig ? { decoderConfig } : undefined);
            first = false;
          }
        } finally {
          input.dispose();
        }
      };
    }
    const encodeCodec = await pickAudioCodec(format);
    if (!encodeCodec || !(await track.canDecode())) {
      input.dispose();
      return null;
    }
    const source = new AudioBufferSource({ codec: encodeCodec, quality: AUDIO_QUALITY });
    output.addAudioTrack(source);
    return async () => {
      try {
        const sink = new AudioBufferSink(track);
        for await (const wrapped of sink.buffers()) {
          await source.add(wrapped.buffer);
        }
      } finally {
        input.dispose();
      }
    };
  } catch {
    input.dispose();
    return null;
  }
}

async function pickAudioCodec(format: OutputFormat): Promise<AudioCodec | null> {
  return getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), { quality: AUDIO_QUALITY });
}

async function openTemplateInput(src: string): Promise<Input | null> {
  if (!src) return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Input({ source: new BlobSource(blob), formats: [MP4] });
  } catch {
    return null;
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
