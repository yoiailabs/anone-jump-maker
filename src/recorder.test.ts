import { describe, expect, it } from "vitest";
import {
  RECORD_AUDIO_BITRATE,
  captureRecordingAudio,
  combineStreams,
  extensionForMime,
  mimeIncludesAudioCodec,
  pickRecorderMime,
  recordStream,
  requestCanvasFrame,
} from "./recorder.ts";

describe("extensionForMime", () => {
  it("maps containers", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/webm;codecs=vp9,opus")).toBe("webm");
  });
});

describe("combineStreams", () => {
  it("keeps canvas video tracks and appends element audio tracks only", () => {
    class FakeStream {
      constructor(private readonly tracks: Array<{ kind: string }> = []) {}
      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
      }
      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
      }
    }
    const previous = globalThis.MediaStream;
    (globalThis as unknown as { MediaStream: typeof FakeStream }).MediaStream = FakeStream;
    try {
      const canvas = new FakeStream([{ kind: "video" }]);
      const audio = new FakeStream([{ kind: "audio" }, { kind: "video" }]);
      const mixed = combineStreams(canvas as unknown as MediaStream, audio as unknown as MediaStream);
      expect(mixed.getVideoTracks()).toHaveLength(1);
      expect(mixed.getAudioTracks()).toHaveLength(1);
    } finally {
      (globalThis as unknown as { MediaStream: typeof previous }).MediaStream = previous;
    }
  });
});

describe("requestCanvasFrame", () => {
  it("calls requestFrame on video tracks when present", () => {
    let calls = 0;
    const stream = {
      getVideoTracks: () => [{ requestFrame: () => { calls += 1; } }],
    };
    requestCanvasFrame(stream as unknown as MediaStream);
    expect(calls).toBe(1);
  });
});

describe("pickRecorderMime", () => {
  it("prefers a mime that names an audio codec", () => {
    const previous = globalThis.MediaRecorder;
    (globalThis as unknown as { MediaRecorder: { isTypeSupported: (type: string) => boolean } }).MediaRecorder = {
      isTypeSupported: (type: string) =>
        type.includes("opus") || type.includes("mp4a") || type === "video/webm" || type === "video/mp4",
    };
    try {
      expect(mimeIncludesAudioCodec(pickRecorderMime())).toBe(true);
    } finally {
      (globalThis as unknown as { MediaRecorder: typeof previous }).MediaRecorder = previous;
    }
  });
});

describe("captureRecordingAudio", () => {
  it("taps the element through Web Audio after play", async () => {
    class FakeStream {
      constructor(private readonly tracks: Array<{ kind: string; readyState: string; enabled: boolean }> = []) {}
      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
      }
      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
      }
    }
    const dest = new FakeStream([{ kind: "audio", readyState: "live", enabled: true }]);
    class FakeAudioContext {
      state = "suspended";
      destination = {};
      createMediaElementSource() {
        return { connect() {} };
      }
      createMediaStreamDestination() {
        return { stream: dest };
      }
      async resume() {
        this.state = "running";
      }
    }
    const previousCtx = globalThis.AudioContext;
    const previousStream = globalThis.MediaStream;
    (globalThis as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext;
    (globalThis as unknown as { MediaStream: typeof FakeStream }).MediaStream = FakeStream;
    try {
      const video = {} as HTMLMediaElement;
      const stream = await captureRecordingAudio(video);
      expect(stream.getAudioTracks()).toHaveLength(1);
    } finally {
      (globalThis as unknown as { AudioContext: typeof previousCtx }).AudioContext = previousCtx;
      (globalThis as unknown as { MediaStream: typeof previousStream }).MediaStream = previousStream;
    }
  });
});

describe("recordStream", () => {
  it("sets audioBitsPerSecond and an audio-capable mime when supported", async () => {
    const constructed: MediaRecorderOptions[] = [];
    class FakeRecorder {
      mimeType: string;
      state = "recording";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, options: MediaRecorderOptions) {
        constructed.push(options);
        this.mimeType = options.mimeType ?? "";
      }
      start() {}
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
      static isTypeSupported(type: string) {
        return type.includes("opus") || type === "video/webm";
      }
    }
    const previous = globalThis.MediaRecorder;
    (globalThis as unknown as { MediaRecorder: typeof FakeRecorder }).MediaRecorder = FakeRecorder;
    try {
      const blob = await recordStream({} as MediaStream, Promise.resolve());
      expect(constructed[0]?.audioBitsPerSecond).toBe(RECORD_AUDIO_BITRATE);
      expect(constructed[0]?.mimeType && mimeIncludesAudioCodec(constructed[0].mimeType)).toBe(true);
      expect(blob).toBeInstanceOf(Blob);
    } finally {
      (globalThis as unknown as { MediaRecorder: typeof previous }).MediaRecorder = previous;
    }
  });
});
