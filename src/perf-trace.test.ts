import { afterEach, describe, expect, it, vi } from "vitest";
import { detailFrameRoles, noteStage, resetStudioTraceForTests, studioTrace, createStageStat } from "./perf-trace.ts";
import { bindSentryTracing, resetSentryTracingForTests, type TracingApi, type TracingSpan } from "./sentry.ts";

type RecordedSpan = {
  name: string;
  parent: string | null;
  forceTransaction?: boolean;
  attributes: Record<string, unknown>;
  status?: string;
  ended: boolean;
};

function installFakeTracing(recording: (name: string) => boolean = () => true): RecordedSpan[] {
  const records: RecordedSpan[] = [];
  const api: TracingApi = {
    getClient: () => ({}),
    startInactiveSpan(options) {
      const parent =
        options.parentSpan && "name" in options.parentSpan
          ? String((options.parentSpan as { name?: string }).name)
          : null;
      const record: RecordedSpan = {
        name: options.name,
        parent,
        forceTransaction: options.forceTransaction,
        attributes: { ...(options.attributes ?? {}) },
        ended: false,
      };
      records.push(record);
      const span: TracingSpan & { name: string } = {
        name: options.name,
        setAttribute(key, value) {
          if (value === undefined) delete record.attributes[key];
          else record.attributes[key] = value;
        },
        setAttributes(attrs) {
          Object.assign(record.attributes, attrs);
        },
        setStatus(status) {
          record.status = status.message;
        },
        end() {
          record.ended = true;
        },
        isRecording: () => recording(options.name),
      };
      return span;
    },
    withActiveSpan(_span, callback) {
      return callback();
    },
  };
  bindSentryTracing(api);
  return records;
}

const readyPaint = {
  currentTime: 0,
  paused: true,
  exporting: false,
  templateReady: true,
  hasPhotos: true,
  timelinesReady: true,
  compositorReady: true,
};

afterEach(() => {
  resetStudioTraceForTests();
  resetSentryTracingForTests();
  vi.useRealTimers();
});

describe("detail frames", () => {
  it("keeps at most the first, middle, and last frame", () => {
    expect([...detailFrameRoles(0).keys()]).toEqual([]);
    expect([...detailFrameRoles(1).entries()]).toEqual([[0, "first"]]);
    expect([...detailFrameRoles(2).entries()]).toEqual([
      [0, "first"],
      [1, "last"],
    ]);
    expect([...detailFrameRoles(466).entries()]).toEqual([
      [0, "first"],
      [232, "mid"],
      [465, "last"],
    ]);
  });

  it("aggregates stage timings without storing per-frame objects", () => {
    const stat = createStageStat();
    noteStage(stat, 4);
    noteStage(stat, 10);
    noteStage(stat, Number.NaN);
    expect(stat).toEqual({ count: 2, totalMs: 14, maxMs: 10 });
  });
});

describe("studio transactions", () => {
  it("carries whip through export trace attributes", () => {
    const records = installFakeTracing();
    studioTrace.beginExport({ export_path: "offline", aspect: "portrait", effect: "whip" });
    expect(records.find((span) => span.name === "export.generate")?.attributes.effect).toBe("whip");
  });
  it("does not invent a fast span when Sentry is not ready yet", () => {
    studioTrace.beginPreviewOpen({ entry: "initial", has_photos: false });
    studioTrace.noteCompositePaint(readyPaint);
    studioTrace.beginPreviewStart({ trigger: "play" });
    studioTrace.armFirstMovingPaint(0);
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 0.2, paused: false });
    studioTrace.beginExport({ export_path: "offline", aspect: "landscape" });
    studioTrace.finishExport("success");
    const records = installFakeTracing();
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 1, paused: false });
    expect(records).toEqual([]);
  });

  it("finishes preview.open once, then preview.start only after the clock moves", () => {
    const records = installFakeTracing();
    studioTrace.beginPreviewOpen({
      entry: "initial",
      has_photos: false,
      timelines_ready: false,
      compositor_ready: false,
      template_ready: false,
    });
    const resources = studioTrace.openPreviewResourcesSpan();
    resources?.end("success");
    studioTrace.noteCompositePaint({ ...readyPaint, templateReady: false });
    expect(records.find((span) => span.name === "preview.open")?.ended).toBe(false);

    studioTrace.noteCompositePaint(readyPaint);
    const opened = records.find((span) => span.name === "preview.open");
    expect(opened?.ended).toBe(true);
    expect(opened?.attributes).toMatchObject({
      entry: "initial",
      outcome: "success",
      has_photos: true,
      template_ready: true,
    });
    expect(records.find((span) => span.name === "preview.resources")?.parent).toBe("preview.open");

    studioTrace.beginPreviewStart({ trigger: "resume", aspect: "landscape", effect: "zoom" });
    studioTrace.armFirstMovingPaint(1);
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 1, paused: false });
    expect(records.find((span) => span.name === "preview.start")?.ended).toBe(false);
    expect(records.some((span) => span.name === "preview.playback")).toBe(false);

    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 1.05, paused: false });
    expect(records.find((span) => span.name === "preview.start")?.attributes.outcome).toBe("success");
    expect(records.find((span) => span.name === "preview.first_moving_paint")?.parent).toBe("preview.start");
    expect(records.find((span) => span.name === "preview.play_request")).toBeUndefined();
    expect(records.find((span) => span.name === "preview.playback")?.forceTransaction).toBe(true);
    expect(records.find((span) => span.name === "preview.render_window")?.parent).toBe("preview.playback");
  });

  it("closes the playback window at five seconds with paint stats", () => {
    vi.useFakeTimers();
    const records = installFakeTracing();
    studioTrace.beginPreviewStart({ trigger: "play", rewind_required: false });
    studioTrace.armFirstMovingPaint(0);
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 0.05, paused: false });
    expect(studioTrace.wantsPaintSample()).toBe(true);
    studioTrace.notePaintSample(11);
    studioTrace.notePaintSample(15);
    vi.advanceTimersByTime(5000);
    const playback = records.find((span) => span.name === "preview.playback");
    expect(playback?.ended).toBe(true);
    expect(playback?.attributes).toMatchObject({
      outcome: "success",
      end_reason: "window",
      window_complete: true,
      paint_n: 2,
      paint_target_fps: 24,
    });
    expect(records.find((span) => span.name === "preview.render_window")?.attributes.window_complete).toBe(true);
    expect(studioTrace.wantsPaintSample()).toBe(false);
  });

  it("arms the playback window even when preview.start was not sampled", () => {
    const records = installFakeTracing((name) => name !== "preview.start");
    studioTrace.beginPreviewStart({ trigger: "play" });
    const start = records.find((span) => span.name === "preview.start");
    expect(start?.ended).toBe(true);
    expect(start?.attributes.outcome).toBeUndefined();

    studioTrace.armFirstMovingPaint(0);
    expect(studioTrace.waitingForMovingPaint()).toBe(true);
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 0, paused: false });
    expect(records.some((span) => span.name === "preview.playback")).toBe(false);

    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 0.05, paused: false });
    expect(studioTrace.wantsPaintSample()).toBe(true);
    const playback = records.find((span) => span.name === "preview.playback");
    expect(playback?.ended).toBe(false);
    expect(playback?.forceTransaction).toBe(true);
    expect(playback?.parent).toBeNull();
    expect(records.find((span) => span.name === "preview.render_window")?.parent).toBe("preview.playback");
    expect(records.some((span) => span.name === "preview.first_moving_paint")).toBe(false);
  });

  it("does not finish a newer preview.start from a stale attempt", () => {
    const records = installFakeTracing();
    const stale = studioTrace.beginPreviewStart({ trigger: "play" });
    const current = studioTrace.beginPreviewStart({ trigger: "resume" });
    studioTrace.finishPreviewStartIfCurrent(stale, "superseded", { end_reason: "superseded" });

    const starts = records.filter((span) => span.name === "preview.start");
    expect(starts).toHaveLength(2);
    expect(starts[0]?.ended).toBe(true);
    expect(starts[0]?.attributes.outcome).toBe("superseded");
    expect(starts[1]?.ended).toBe(false);

    studioTrace.armFirstMovingPaint(0);
    studioTrace.noteCompositePaint({ ...readyPaint, currentTime: 0.05, paused: false });
    expect(starts[1]?.attributes.outcome).toBe("success");
    expect(records.find((span) => span.name === "preview.first_moving_paint")?.parent).toBe("preview.start");
    expect(records.some((span) => span.name === "preview.playback")).toBe(true);
    expect(current.id).not.toBe(stale.id);
  });

  it("finishes open roots on leave, hide, and export without a share-sheet span", () => {
    const records = installFakeTracing();
    studioTrace.beginPreviewOpen({ entry: "reopen", has_photos: true });
    studioTrace.beginPreviewStart({ trigger: "play" });
    studioTrace.onLeaveStudio();
    expect(records.find((span) => span.name === "preview.open")?.attributes).toMatchObject({
      outcome: "cancelled",
      end_reason: "leave",
    });
    expect(records.find((span) => span.name === "preview.start")?.attributes.outcome).toBe("cancelled");

    studioTrace.beginExport({ export_path: "offline", aspect: "portrait", effect: "jump" });
    studioTrace.finishExport("success", { container: "mp4", video_codec: "avc" });
    const exported = records.find((span) => span.name === "export.generate");
    expect(exported?.attributes).toMatchObject({
      outcome: "success",
      export_path: "offline",
      container: "mp4",
      video_codec: "avc",
    });
    expect(exported?.attributes.photoName).toBeUndefined();
    expect(records.some((span) => span.name === "export.handoff")).toBe(false);

    studioTrace.beginExport({ export_path: "offline" });
    studioTrace.onPageHide(false);
    expect(records.filter((span) => span.name === "export.generate").at(-1)?.attributes.outcome).toBe("cancelled");
  });

  it("drops forbidden attributes before they reach the span", () => {
    const records = installFakeTracing();
    studioTrace.beginExport({
      export_path: "offline",
      aspect: "landscape",
      photoName: "secret.jpg",
      fingerprint: 123,
    } as unknown as { export_path: "offline"; aspect: "landscape" });
    studioTrace.finishExport("error");
    expect(records[0]?.attributes).toMatchObject({ export_path: "offline", aspect: "landscape", outcome: "error" });
    expect(records[0]?.attributes.photoName).toBeUndefined();
    expect(records[0]?.attributes.fingerprint).toBeUndefined();
  });
});
