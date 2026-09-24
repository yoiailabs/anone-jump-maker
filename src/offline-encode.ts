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
  VideoSampleSink,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";
import type { CharacterFrame } from "./compositor.ts";
import {
  EXPORT_CHARACTER_FALLBACK,
  EXPORT_CHARACTER_PIXELS,
  EXPORT_FPS,
  EXPORT_PROBE_TIMEOUT_MS,
  TEMPLATE_FRAME_MISSING_MESSAGE,
  assertCharacterAdvanced,
  characterFrameFromCanvas,
  chooseExportCharacterPath,
  copySampleRgba,
  firstResolved,
  frameTimes,
  hasWebCodecsVideoEncoder,
  isAbortError,
  putRgbaOnCanvas,
  markCharacterVideoUsed,
  rewindCharacterVideo,
  seekVideo,
  templateFrameMatchesTime,
  throwIfAborted,
  abortError,
  type ExportCharacterPath,
  type ExportProgress,
  type ExportResult,
} from "./export.ts";
import {
  createStageStat,
  detailFrameRoles,
  noteStage,
  nowMs,
  roundTraceMs,
  stageAttributePrefix,
  studioTrace,
  withComposeDetail,
  type StageStat,
} from "./perf-trace.ts";
import type { TraceOutcome } from "./sentry.ts";

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
  draw: (time: number, character?: CharacterFrame) => void;
  duration: number;
  fps: number;
  plan: OfflinePlan;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const { video, canvas, draw, duration, fps, plan, onProgress, signal } = options;
  const times = frameTimes(duration, fps);
  const frameDuration = 1 / (fps > 0 ? fps : EXPORT_FPS);
  onProgress?.({ mode: "offline", current: 0, total: times.length });
  throwIfAborted(signal);
  const target = new BufferTarget();
  const output = new Output({ format: plan.format, target });
  const videoSource = new CanvasSource(canvas, {
    codec: plan.videoCodec,
    quality: VIDEO_QUALITY,
    latencyMode: "quality",
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps > 0 ? fps : EXPORT_FPS });

  const template = await openTemplateInput(video.currentSrc || video.src, signal);
  throwIfAborted(signal);
  video.pause();
  video.muted = true;
  try {
    await rewindCharacterVideo(video);
    throwIfAborted(signal);
    const frameSink = template ? await openTemplateFrameSink(template) : null;
    throwIfAborted(signal);
    const characterPath = await chooseCharacterPath(frameSink, signal);
    throwIfAborted(signal);
    const pumpAudio = template
      ? await studioTrace.withExportChild("export.audio_prepare", () =>
          attachTemplateAudio(output, plan.format, template, signal),
        )
      : null;
    await output.start();
    if (pumpAudio) {
      await studioTrace.withExportChild("export.audio_pump", () => pumpAudio());
    }
    if (characterPath === EXPORT_CHARACTER_PIXELS && frameSink) {
      await encodeWithRgbaFrames({
        sink: frameSink,
        times,
        frameDuration,
        draw,
        videoSource,
        onProgress,
        signal,
      });
    } else {
      await encodeWithHtmlVideo({
        video,
        times,
        frameDuration,
        draw,
        videoSource,
        onProgress,
        signal,
      });
    }
    throwIfAborted(signal);
    await studioTrace.withExportChild("export.finalize", () => output.finalize());
  } catch (error) {
    if (output.state === "started" || output.state === "pending") {
      const cleanup = studioTrace.openExportChild("export.cancel_cleanup");
      try {
        await output.cancel();
        cleanup?.end("success");
      } catch (cancelError) {
        cleanup?.end(isAbortError(cancelError) ? "cancelled" : "error");
        throw cancelError;
      }
    }
    throw error;
  } finally {
    markCharacterVideoUsed(video);
    template?.dispose();
  }

  const buffer = target.buffer;
  if (!buffer) {
    throw new Error("生成バッファが空です");
  }
  const mime = plan.format.mimeType;
  const extension = plan.format.fileExtension.replace(".", "") as "mp4" | "webm";
  const blobSpan = studioTrace.openExportChild("export.blob_create");
  const blob = new Blob([buffer], { type: mime });
  blobSpan?.setAttribute("byte_size", buffer.byteLength);
  blobSpan?.setAttribute("container", plan.container);
  blobSpan?.end("success");
  return {
    blob,
    mime,
    extension,
    mode: "offline",
  };
}

type ProbeFlags = {
  copiedFirst: boolean;
  copiedLater: boolean;
  firstTimeOk: boolean;
  laterTimeOk: boolean;
  pixelsAdvanced: boolean;
};

function publishProbe(out: ProbeFlags | undefined, probe: ProbeFlags): void {
  if (!out) return;
  out.copiedFirst = probe.copiedFirst;
  out.copiedLater = probe.copiedLater;
  out.firstTimeOk = probe.firstTimeOk;
  out.laterTimeOk = probe.laterTimeOk;
  out.pixelsAdvanced = probe.pixelsAdvanced;
}

async function chooseCharacterPath(
  frameSink: VideoSampleSink | null,
  signal?: AbortSignal,
): Promise<ExportCharacterPath> {
  const flags: ProbeFlags = {
    copiedFirst: false,
    copiedLater: false,
    firstTimeOk: false,
    laterTimeOk: false,
    pixelsAdvanced: false,
  };
  let timeoutWon = false;
  const probeSpan = studioTrace.openExportChild("export.character_probe");
  try {
    const characterPath = frameSink
      ? await firstResolved([
          probeExportCharacterPath(frameSink, signal, flags),
          sleep(EXPORT_PROBE_TIMEOUT_MS, signal).then(() => {
            timeoutWon = true;
            return EXPORT_CHARACTER_FALLBACK;
          }),
        ])
      : EXPORT_CHARACTER_FALLBACK;
    probeSpan?.setAttributes({
      probe_outcome: characterPath,
      character_path: characterPath,
      timeout_won: timeoutWon,
      copied_first: flags.copiedFirst,
      copied_later: flags.copiedLater,
      first_time_ok: flags.firstTimeOk,
      later_time_ok: flags.laterTimeOk,
      pixels_advanced: flags.pixelsAdvanced,
    });
    studioTrace.annotateExport({ character_path: characterPath });
    probeSpan?.end("success");
    return characterPath;
  } catch (error) {
    probeSpan?.end(isAbortError(error) ? "cancelled" : "error");
    throw error;
  }
}

async function probeExportCharacterPath(
  sink: VideoSampleSink,
  signal?: AbortSignal,
  out?: ProbeFlags,
): Promise<ExportCharacterPath> {
  throwIfAborted(signal);
  const probe: ProbeFlags = {
    copiedFirst: false,
    copiedLater: false,
    firstTimeOk: false,
    laterTimeOk: false,
    pixelsAdvanced: false,
  };
  const finish = () => {
    publishProbe(out, probe);
    return chooseExportCharacterPath(probe);
  };
  try {
    const first = await sink.getSample(0);
    if (!first) return finish();
    try {
      const rgba0 = await copySampleRgba(first);
      probe.copiedFirst = true;
      probe.firstTimeOk = templateFrameMatchesTime(rgba0.timestamp, 0);
      const later = await sink.getSample(1);
      if (!later) return finish();
      try {
        const rgba1 = await copySampleRgba(later);
        probe.copiedLater = true;
        probe.laterTimeOk = templateFrameMatchesTime(rgba1.timestamp, 1);
        probe.pixelsAdvanced = rgba1.fingerprint !== rgba0.fingerprint;
      } finally {
        later.close();
      }
    } finally {
      first.close();
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    // copyTo / PTS / decoder が WebKit で落ちても HTML video に落とす
  }
  return finish();
}

type FrameTrace = {
  span: ReturnType<typeof studioTrace.openExportChild>;
  acquire: StageStat;
  rgba: StageStat;
  compose: StageStat;
  videoAdd: StageStat;
  yield: StageStat;
  roles: Map<number, "first" | "mid" | "last">;
};

function openFrameTrace(frameCount: number): FrameTrace | null {
  const span = studioTrace.openExportChild("export.frames");
  if (!span) return null;
  return {
    span,
    acquire: createStageStat(),
    rgba: createStageStat(),
    compose: createStageStat(),
    videoAdd: createStageStat(),
    yield: createStageStat(),
    roles: detailFrameRoles(frameCount),
  };
}

function finishFrameTrace(trace: FrameTrace | null, outcome: TraceOutcome): void {
  if (!trace) return;
  trace.span?.setAttributes({
    ...stageAttributePrefix("acquire", trace.acquire),
    ...stageAttributePrefix("rgba", trace.rgba),
    ...stageAttributePrefix("compose", trace.compose),
    ...stageAttributePrefix("video_add", trace.videoAdd),
    ...stageAttributePrefix("yield", trace.yield),
  });
  trace.span?.end(outcome);
}

function markStage(stat: StageStat | undefined, started: number): number {
  if (!stat) return 0;
  const elapsed = nowMs() - started;
  noteStage(stat, elapsed);
  return elapsed;
}

async function encodeWithRgbaFrames(options: {
  sink: VideoSampleSink;
  times: number[];
  frameDuration: number;
  draw: (time: number, character?: CharacterFrame) => void;
  videoSource: { add: (timestamp: number, duration: number) => Promise<unknown> };
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { sink, times, frameDuration, draw, videoSource, onProgress, signal } = options;
  const frameCanvas = document.createElement("canvas");
  const frameCtx = frameCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!frameCtx) {
    throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
  }
  const trace = openFrameTrace(times.length);
  let i = 0;
  let firstFingerprint: number | undefined;
  let acquireStart = trace ? nowMs() : 0;
  try {
    for await (const sample of sink.samplesAtTimestamps(times)) {
      const acquireMs = trace ? markStage(trace.acquire, acquireStart) : 0;
      if (signal?.aborted) {
        sample?.close();
        throwIfAborted(signal);
      }
      const time = times[i];
      if (time === undefined) {
        sample?.close();
        break;
      }
      if (!sample) {
        throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
      }
      const role = trace?.roles.get(i);
      const frameSpan = role ? trace?.span?.startChild("export.frame", { frame_role: role, frame_index: i }) : null;
      let rgbaMs = 0;
      let composeMs = 0;
      let frameOutcome: TraceOutcome = "success";
      try {
        const rgbaStart = trace ? nowMs() : 0;
        const rgba = await copySampleRgba(sample);
        if (!templateFrameMatchesTime(rgba.timestamp, time)) {
          throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
        }
        if (firstFingerprint === undefined) {
          firstFingerprint = rgba.fingerprint;
        } else {
          assertCharacterAdvanced(firstFingerprint, rgba.fingerprint, time);
        }
        putRgbaOnCanvas(frameCanvas, frameCtx, rgba);
        rgbaMs = trace ? markStage(trace.rgba, rgbaStart) : 0;
        const composeStart = trace ? nowMs() : 0;
        const character = characterFrameFromCanvas(frameCanvas);
        if (frameSpan) withComposeDetail(frameSpan, () => draw(time, character));
        else draw(time, character);
        composeMs = trace ? markStage(trace.compose, composeStart) : 0;
      } catch (error) {
        frameOutcome = isAbortError(error) ? "cancelled" : "error";
        throw error;
      } finally {
        sample.close();
      }
      const addStart = trace ? nowMs() : 0;
      await videoSource.add(i * frameDuration, frameDuration);
      const addMs = trace ? markStage(trace.videoAdd, addStart) : 0;
      let yieldMs = 0;
      if (i === 0 || i === times.length - 1 || i % 8 === 0) {
        onProgress?.({ mode: "offline", current: i + 1, total: times.length });
        const yieldStart = trace ? nowMs() : 0;
        await yieldToUi(signal);
        yieldMs = trace ? markStage(trace.yield, yieldStart) : 0;
      }
      frameSpan?.setAttributes({
        acquire_ms: roundTraceMs(acquireMs),
        rgba_ms: roundTraceMs(rgbaMs),
        compose_ms: roundTraceMs(composeMs),
        video_add_ms: roundTraceMs(addMs),
        ...(yieldMs > 0 ? { yield_ms: roundTraceMs(yieldMs) } : {}),
      });
      frameSpan?.end(frameOutcome);
      acquireStart = trace ? nowMs() : 0;
      i += 1;
    }
    if (i !== times.length) {
      throw new Error(TEMPLATE_FRAME_MISSING_MESSAGE);
    }
    finishFrameTrace(trace, "success");
  } catch (error) {
    finishFrameTrace(trace, isAbortError(error) ? "cancelled" : "error");
    throw error;
  }
}

async function encodeWithHtmlVideo(options: {
  video: HTMLVideoElement;
  times: number[];
  frameDuration: number;
  draw: (time: number, character?: CharacterFrame) => void;
  videoSource: { add: (timestamp: number, duration: number) => Promise<unknown> };
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { video, times, frameDuration, draw, videoSource, onProgress, signal } = options;
  const trace = openFrameTrace(times.length);
  try {
    for (let i = 0; i < times.length; i += 1) {
      throwIfAborted(signal);
      const time = times[i]!;
      const role = trace?.roles.get(i);
      const frameSpan = role ? trace?.span?.startChild("export.frame", { frame_role: role, frame_index: i }) : null;
      let frameOutcome: TraceOutcome = "success";
      const acquireStart = trace ? nowMs() : 0;
      try {
        // iOS フォールバックは #52 以前と同じ seeked のみ。毎フレーム rVFC すると 466×400ms になる。
        await seekVideo(video, time, { waitForPresented: false });
      } catch (error) {
        frameOutcome = isAbortError(error) ? "cancelled" : "error";
        frameSpan?.end(frameOutcome);
        throw error;
      }
      const acquireMs = trace ? markStage(trace.acquire, acquireStart) : 0;
      const composeStart = trace ? nowMs() : 0;
      if (frameSpan) withComposeDetail(frameSpan, () => draw(time));
      else draw(time);
      const composeMs = trace ? markStage(trace.compose, composeStart) : 0;
      const addStart = trace ? nowMs() : 0;
      await videoSource.add(i * frameDuration, frameDuration);
      const addMs = trace ? markStage(trace.videoAdd, addStart) : 0;
      let yieldMs = 0;
      if (i === 0 || i === times.length - 1 || i % 8 === 0) {
        onProgress?.({ mode: "offline", current: i + 1, total: times.length });
        const yieldStart = trace ? nowMs() : 0;
        await yieldToUi(signal);
        yieldMs = trace ? markStage(trace.yield, yieldStart) : 0;
      }
      frameSpan?.setAttributes({
        acquire_ms: roundTraceMs(acquireMs),
        compose_ms: roundTraceMs(composeMs),
        video_add_ms: roundTraceMs(addMs),
        ...(yieldMs > 0 ? { yield_ms: roundTraceMs(yieldMs) } : {}),
      });
      frameSpan?.end(frameOutcome);
    }
    finishFrameTrace(trace, "success");
  } catch (error) {
    finishFrameTrace(trace, isAbortError(error) ? "cancelled" : "error");
    throw error;
  }
}

async function attachTemplateAudio(
  output: Output,
  format: OutputFormat,
  input: Input,
  signal?: AbortSignal,
): Promise<(() => Promise<void>) | null> {
  try {
    throwIfAborted(signal);
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    const packetCodec = await track.getCodec();
    if (packetCodec && format.getSupportedAudioCodecs().includes(packetCodec)) {
      studioTrace.annotateCurrent({ audio_codec: packetCodec, has_audio: true });
      const source = new EncodedAudioPacketSource(packetCodec);
      output.addAudioTrack(source);
      return async () => {
        const sink = new EncodedPacketSink(track);
        const decoderConfig = await track.getDecoderConfig();
        let first = true;
        for await (const packet of sink.packets()) {
          throwIfAborted(signal);
          await source.add(packet, first && decoderConfig ? { decoderConfig } : undefined);
          first = false;
        }
      };
    }
    const encodeCodec = await pickAudioCodec(format);
    if (!encodeCodec || !(await track.canDecode())) return null;
    studioTrace.annotateCurrent({ audio_codec: encodeCodec, has_audio: true });
    const source = new AudioBufferSource({ codec: encodeCodec, quality: AUDIO_QUALITY });
    output.addAudioTrack(source);
    return async () => {
      const sink = new AudioBufferSink(track);
      for await (const wrapped of sink.buffers()) {
        throwIfAborted(signal);
        await source.add(wrapped.buffer);
      }
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

async function openTemplateFrameSink(input: Input): Promise<VideoSampleSink | null> {
  if (typeof VideoDecoder !== "function") return null;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    // ここではデコードしない。getSample(0) すると iOS software で数秒かかり、そのあとまた probe する。
    return new VideoSampleSink(track, { hardwareAcceleration: "prefer-software" });
  } catch {
    return null;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function pickAudioCodec(format: OutputFormat): Promise<AudioCodec | null> {
  return getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), { quality: AUDIO_QUALITY });
}

async function openTemplateInput(src: string, signal?: AbortSignal): Promise<Input | null> {
  const span = studioTrace.openExportChild("export.template_open");
  let opened = false;
  let outcome: TraceOutcome = "success";
  try {
    if (!src) return null;
    throwIfAborted(signal);
    const response = await fetch(src, signal ? { signal } : undefined);
    if (!response.ok) return null;
    const blob = await response.blob();
    throwIfAborted(signal);
    const input = new Input({ source: new BlobSource(blob), formats: [MP4] });
    opened = true;
    return input;
  } catch (error) {
    if (isAbortError(error)) {
      outcome = "cancelled";
      throw error;
    }
    return null;
  } finally {
    span?.setAttribute("opened", opened);
    span?.end(outcome);
  }
}

function yieldToUi(signal?: AbortSignal): Promise<void> {
  return sleep(0, signal);
}
