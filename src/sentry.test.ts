import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_TRACES_SAMPLE_RATE,
  createSentryBrowserOptions,
  errorReportExtras,
  filterSentryEvent,
  isSentryEnabled,
  isExpectedUxError,
  pickTraceAttributes,
  reportError,
  resolveSentryDsn,
  resolveTraceSampleRate,
  scrubSentryEvent,
  scrubSentrySpan,
  sentryEnvironment,
  sentryEventHasExpectedUxError,
  traceSampleRateForEnvironment,
} from "./sentry.ts";

const requireFromSentry = createRequire(import.meta.resolve("@sentry/browser"));
const { shouldIgnoreSpan } = requireFromSentry("@sentry/core") as {
  shouldIgnoreSpan: (
    span: { description?: string; op?: string; attributes?: Record<string, unknown> },
    ignoreSpans: ReadonlyArray<string | RegExp | Record<string, unknown>>,
  ) => boolean;
};
import { UNSUPPORTED_EXPORT_MESSAGE } from "./export.ts";
import { MESSAGES } from "./messages.ts";
import { HEIC_UNSUPPORTED_MESSAGE, IMAGE_LOAD_ERROR } from "./photos.ts";

describe("sentryEnvironment", () => {
  it("marks the production host as production", () => {
    expect(sentryEnvironment("anone.yoiailabs.com")).toBe("production");
  });

  it("marks localhost as development", () => {
    expect(sentryEnvironment("localhost")).toBe("development");
    expect(sentryEnvironment("127.0.0.1")).toBe("development");
    expect(sentryEnvironment("[::1]")).toBe("development");
  });

  it("marks Workers preview hosts as preview", () => {
    expect(sentryEnvironment("cursor-sentry-client-errors-b37a-anone.yoiailabs.workers.dev")).toBe(
      "preview",
    );
  });
});

const TEST_SENTRY_DSN = "https://public@o0.ingest.sentry.io/1";

describe("isSentryEnabled", () => {
  it("stays off when VITE_SENTRY_DSN is unset", () => {
    expect(isSentryEnabled(undefined)).toBe(false);
    expect(isSentryEnabled("")).toBe(false);
    expect(isSentryEnabled("  ")).toBe(false);
  });

  it("turns on only when VITE_SENTRY_DSN is set", () => {
    expect(isSentryEnabled("https://example@o0.ingest.sentry.io/1")).toBe(true);
  });
});

describe("resolveSentryDsn", () => {
  it("returns undefined when unset", () => {
    expect(resolveSentryDsn(undefined)).toBeUndefined();
    expect(resolveSentryDsn("")).toBeUndefined();
    expect(resolveSentryDsn("   ")).toBeUndefined();
  });

  it("trims VITE_SENTRY_DSN when set", () => {
    expect(resolveSentryDsn("  https://example@o0.ingest.sentry.io/1  ")).toBe(
      "https://example@o0.ingest.sentry.io/1",
    );
  });
});

describe("scrubSentryEvent", () => {
  it("drops user fields and blob / photo extras", () => {
    const event = {
      user: { email: "a@b.com", ip_address: "1.2.3.4" },
      request: { data: "payload", cookies: { sid: "1" }, url: "/ok" },
      extra: {
        thumb: "blob:http://localhost/abc",
        photoName: "vacation.jpg",
        filename: "face.png",
        ok: "fine",
      },
    };

    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toEqual({ url: "/ok" });
    expect(scrubbed.extra).toEqual({ ok: "fine" });
  });

  it("keeps decode diagnostics and still drops filenames", () => {
    const event = {
      extra: {
        signature: "unknown",
        mime: "image/jpeg",
        extension: "jpg",
        byteSize: 128,
        decodeAttempts: ["bitmap-orient", "bitmap-plain"],
        photoName: "vacation.jpg",
        filename: "face.png",
      },
    };

    expect(scrubSentryEvent(event).extra).toEqual({
      signature: "unknown",
      mime: "image/jpeg",
      extension: "jpg",
      byteSize: 128,
      decodeAttempts: ["bitmap-orient", "bitmap-plain"],
    });
  });
});

describe("errorReportExtras", () => {
  it("copies only allowlisted extras off the error", () => {
    const error = Object.assign(new Error("画像を読み込めませんでした"), {
      extras: {
        signature: "unknown",
        mime: "image/jpeg",
        extension: "jpg",
        byteSize: 12,
        decodeAttempts: ["bitmap-orient"],
        photoName: "secret.jpg",
      },
    });
    expect(errorReportExtras(error)).toEqual({
      signature: "unknown",
      mime: "image/jpeg",
      extension: "jpg",
      byteSize: 12,
      decodeAttempts: ["bitmap-orient"],
    });
    expect(errorReportExtras(new Error("export failed"))).toBeUndefined();
  });
});

describe("filterSentryEvent", () => {
  it("drops the production Ok/Qk document-url stack overflow", () => {
    const frames = [
      { filename: "https://anone.yoiailabs.com/", lineno: 190, colno: 41 },
      { filename: "https://anone.yoiailabs.com/", lineno: 198, colno: 237 },
      ...Array.from({ length: 16 }, (_, index) => ({
        filename: "https://anone.yoiailabs.com/",
        function: index % 2 === 0 ? "Ok" : "Qk",
        lineno: 226,
      })),
    ];
    const event = scrubSentryEvent({
      extra: { ok: "fine" },
      exception: {
        values: [
          {
            type: "RangeError",
            value: "Maximum call stack size exceeded.",
            stacktrace: { frames },
          },
        ],
      },
    });
    expect(filterSentryEvent(event)).toBeNull();
  });

  it("still sends first-party RangeErrors from hashed assets", () => {
    const event = {
      extra: { ok: "fine" },
      exception: {
        values: [
          {
            type: "RangeError",
            value: "Maximum call stack size exceeded.",
            stacktrace: {
              frames: [
                {
                  filename: "https://anone.yoiailabs.com/assets/index-Dh7cYpZX.js",
                  function: "paint",
                },
              ],
            },
          },
        ],
      },
    };
    expect(filterSentryEvent(event)).toBe(event);
  });
});

describe("trace sampling", () => {
  it("keeps the production rate at 0.1 and does not multiply a parent decision", () => {
    expect(PRODUCTION_TRACES_SAMPLE_RATE).toBe(0.1);
    expect(traceSampleRateForEnvironment("production")).toBe(0.1);
    expect(traceSampleRateForEnvironment("preview")).toBe(0.1);
    expect(traceSampleRateForEnvironment("development")).toBe(0.1);
    expect(resolveTraceSampleRate({ environment: "production" })).toBe(0.1);
    expect(resolveTraceSampleRate({ environment: "production", parentSampled: true })).toBe(true);
    expect(resolveTraceSampleRate({ environment: "production", parentSampled: false })).toBe(false);

    const options = createSentryBrowserOptions({ dsn: TEST_SENTRY_DSN, environment: "production" });
    expect(options.tracesSampleRate).toBe(0.1);
    expect(
      options.tracesSampler({
        inheritOrSampleWith(rate) {
          expect(rate).toBe(0.1);
          return 1;
        },
      }),
    ).toBe(1);
    expect(options.tracesSampler({ parentSampled: true })).toBe(true);
    expect(options.tracesSampler({ parentSampled: false })).toBe(false);
    expect(options.tracesSampler({})).toBe(0.1);
    expect(options.tracesSampler({ name: "preview.open" })).toBe(0.1);
    expect(options.tracesSampler({ name: "export.generate", parentSampled: true })).toBe(true);
    expect(options.tracesSampler({ name: "http.client" })).toBe(false);
    expect(options.tracesSampler({ name: "export.frames" })).toBe(false);
    expect(options.tracesSampler({ name: "Pageload" })).toBe(false);
  });
});

describe("trace attribute allowlist", () => {
  it("retains moya in Sentry and performance attributes", () => {
    expect(pickTraceAttributes({ effect: "moya" })).toEqual({ effect: "moya" });
  });
  it("keeps low-cardinality fields and drops photos, blobs, fingerprints, and freeform text", () => {
    expect(
      pickTraceAttributes({
        outcome: "success",
        aspect: "landscape",
        effect: "jump",
        filter: "blur-weak",
        character_size: "1.2",
        character_path: "rgba-copyTo",
        keying: "webgl",
        container: "mp4",
        video_codec: "avc",
        width: 1280,
        height: 720,
        fps: 30,
        has_photos: true,
        paint_n: 4,
        paint_avg_ms: 12.5,
        acquire_count: 3,
        acquire_total_ms: 40,
        acquire_max_ms: 20,
        photoName: "vacation.jpg",
        filename: "face.png",
        id: "vacation.jpg",
        fingerprint: 987654,
        vendor: "Google Inc.",
        renderer: "ANGLE (Apple)",
        message: "ユーザーの写真で失敗しました",
        blob: "blob:http://localhost/abc",
        src: "data:image/png;base64,aaaa",
        nested: { aspect: "landscape" },
        effect_bad: "data:image/png;base64,aaaa",
      }),
    ).toEqual({
      outcome: "success",
      aspect: "landscape",
      effect: "jump",
      filter: "blur-weak",
      character_size: "1.2",
      character_path: "rgba-copyTo",
      keying: "webgl",
      container: "mp4",
      video_codec: "avc",
      width: 1280,
      height: 720,
      fps: 30,
      has_photos: true,
      paint_n: 4,
      paint_avg_ms: 12.5,
      acquire_count: 3,
      acquire_total_ms: 40,
      acquire_max_ms: 20,
    });
  });

  it("scrubs streamed span names and attributes down to the allowlist", () => {
    expect(
      scrubSentrySpan({
        name: "export.generate",
        attributes: {
          "sentry.op": "export.generate",
          aspect: "portrait",
          filename: "secret.jpg",
          export_path: "offline",
          fingerprint: 42,
          photoName: "vacation.jpg",
        },
      }),
    ).toEqual({
      name: "export.generate",
      attributes: {
        "sentry.op": "export.generate",
        aspect: "portrait",
        export_path: "offline",
      },
    });

    expect(
      scrubSentrySpan({
        name: "export.frames",
        attributes: {
          "sentry.op": "export.frames",
          acquire_count: 2,
          fingerprint: 99,
          id: "photo-1",
        },
      }),
    ).toEqual({
      name: "export.frames",
      attributes: {
        "sentry.op": "export.frames",
        acquire_count: 2,
      },
    });

    expect(
      scrubSentrySpan({
        name: "user photo vacation.jpg",
        attributes: { "sentry.op": "db", filename: "vacation.jpg" },
      }),
    ).toEqual({
      name: "redacted",
      attributes: { "sentry.op": "redacted" },
    });
  });

  it("drops non-allowlisted span names and redacts streamed spans without returning null", () => {
    const options = createSentryBrowserOptions({ dsn: TEST_SENTRY_DSN, environment: "preview" });
    expect(options.traceLifecycle).toBe("stream");
    expect(Object.hasOwn(options, "beforeSendTransaction")).toBe(false);
    expect(Object.hasOwn(options, "sendDefaultPii")).toBe(false);
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
      queues: false,
      stackFrameVariables: true,
      frameContextLines: 7,
    });

    const ignoreSpans = options.ignoreSpans ?? [];
    expect(shouldIgnoreSpan({ description: "http.client", op: "http.client" }, ignoreSpans)).toBe(true);
    expect(shouldIgnoreSpan({ description: "Pageload", op: "pageload" }, ignoreSpans)).toBe(true);
    expect(shouldIgnoreSpan({ description: "preview.openapi", op: "preview.openapi" }, ignoreSpans)).toBe(true);
    expect(
      shouldIgnoreSpan(
        { description: "preview.resources", op: "preview.resources", attributes: { timelines_ready: true } },
        ignoreSpans,
      ),
    ).toBe(false);
    expect(shouldIgnoreSpan({ description: "export.frames", op: "export.frames" }, ignoreSpans)).toBe(false);
    expect(shouldIgnoreSpan({ description: "", op: "http.client" }, ignoreSpans)).toBe(false);

    const streamed = {
      trace_id: "a".repeat(32),
      span_id: "b".repeat(16),
      start_timestamp: 1,
      status: "ok" as const,
      is_segment: false,
    };
    expect(
      options.beforeSendSpan({
        ...streamed,
        name: "media.rewind",
        attributes: { "sentry.op": "blob:http://x/y", rewind_required: true, src: "blob:http://x/y" },
      }),
    ).toMatchObject({
      name: "media.rewind",
      attributes: { "sentry.op": "media.rewind", rewind_required: true },
    });
    const redacted = options.beforeSendSpan({
      ...streamed,
      name: "",
      attributes: { "sentry.op": "http.client", url: "https://example.test/photo.jpg" },
    });
    expect(redacted).not.toBeNull();
    expect(redacted).toMatchObject({
      name: "redacted",
      attributes: { "sentry.op": "redacted" },
    });
  });

  it("records only allowlisted spans and strips photo attributes when the v11 client sends them", async () => {
    const Sentry = await import("@sentry/browser");
    const envelopes: unknown[] = [];
    const options = createSentryBrowserOptions({
      dsn: "https://public@o0.ingest.sentry.io/1",
      environment: "development",
    });
    Sentry.init({
      ...options,
      tracesSampler(samplingContext) {
        const decision = options.tracesSampler(samplingContext);
        return decision === false ? false : 1;
      },
      transport: () => ({
        send: (envelope) => {
          envelopes.push(envelope);
          return Promise.resolve({});
        },
        flush: () => Promise.resolve(true),
      }),
    });

    try {
      expect(
        Sentry.startInactiveSpan({ name: "http.client", op: "http.client", parentSpan: null }).isRecording(),
      ).toBe(false);
      expect(
        Sentry.startInactiveSpan({ name: "export.frames", op: "export.frames", parentSpan: null }).isRecording(),
      ).toBe(false);

      const root = Sentry.startInactiveSpan({
        name: "export.generate",
        op: "export.generate",
        parentSpan: null,
        attributes: { filename: "secret.jpg", aspect: "portrait" },
      });
      const child = Sentry.startInactiveSpan({
        name: "export.frames",
        op: "export.frames",
        parentSpan: root,
        attributes: { filename: "vacation.jpg", acquire_count: 2 },
      });
      const dropped = Sentry.startInactiveSpan({
        name: "user photo vacation.jpg",
        op: "db",
        parentSpan: root,
      });
      expect(root.isRecording()).toBe(true);
      expect(child.isRecording()).toBe(true);
      expect(dropped.isRecording()).toBe(false);
      child.end();
      dropped.end();
      root.end();
      await Sentry.flush(2000);

      const payload = JSON.stringify(envelopes);
      expect(payload).toContain("export.generate");
      expect(payload).toContain("export.frames");
      expect(payload).toContain("portrait");
      expect(payload).not.toContain("filename");
      expect(payload).not.toContain("secret.jpg");
      expect(payload).not.toContain("vacation");
      expect(payload).not.toContain("http.client");
    } finally {
      await Sentry.close(2000);
    }
  });
});

describe("reportError", () => {
  it("forwards the exception to the capture function", () => {
    const capture = vi.fn();
    const error = new Error("export failed");
    reportError(error, capture);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error);
  });

  it("does not send expected photo and unsupported-browser UX errors", () => {
    const capture = vi.fn();
    reportError(new Error(IMAGE_LOAD_ERROR), capture);
    reportError(new Error(HEIC_UNSUPPORTED_MESSAGE), capture);
    reportError(new Error(UNSUPPORTED_EXPORT_MESSAGE), capture);
    reportError(new Error("サムネを作れませんでした"), capture);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((capture.mock.calls[0]?.[0] as Error).message).toBe("サムネを作れませんでした");
  });
});

describe("expected UX errors", () => {
  it("matches the Japanese constants thrown by photos and export", () => {
    expect(IMAGE_LOAD_ERROR).toBe(MESSAGES.ja.errorImageLoad);
    expect(HEIC_UNSUPPORTED_MESSAGE).toBe(MESSAGES.ja.errorHeic);
    expect(UNSUPPORTED_EXPORT_MESSAGE).toBe(MESSAGES.ja.errorUnsupportedExport);
    expect(isExpectedUxError(new Error(IMAGE_LOAD_ERROR))).toBe(true);
    expect(isExpectedUxError(new Error(HEIC_UNSUPPORTED_MESSAGE))).toBe(true);
    expect(isExpectedUxError(new Error(UNSUPPORTED_EXPORT_MESSAGE))).toBe(true);
    expect(isExpectedUxError(new Error("サムネを作れませんでした"))).toBe(false);
    expect(isExpectedUxError("画像を読み込めませんでした")).toBe(false);
  });

  it("drops those messages in beforeSend", () => {
    expect(
      filterSentryEvent({
        exception: { values: [{ value: IMAGE_LOAD_ERROR }] },
      }),
    ).toBeNull();
    expect(
      filterSentryEvent({
        exception: { values: [{ value: HEIC_UNSUPPORTED_MESSAGE }] },
      }),
    ).toBeNull();
    expect(
      filterSentryEvent({
        exception: { values: [{ value: UNSUPPORTED_EXPORT_MESSAGE }] },
      }),
    ).toBeNull();
    expect(
      sentryEventHasExpectedUxError({
        exception: { values: [{ value: "書き出しに失敗しました" }] },
      }),
    ).toBe(false);
    expect(
      filterSentryEvent({
        exception: { values: [{ value: "書き出しに失敗しました" }] },
      }),
    ).not.toBeNull();
  });
});
