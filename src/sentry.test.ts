import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SENTRY_DSN,
  PRODUCTION_TRACES_SAMPLE_RATE,
  createSentryBrowserOptions,
  errorReportExtras,
  filterSentryEvent,
  isExpectedUxError,
  pickTraceAttributes,
  reportError,
  resolveSentryDsn,
  resolveTraceSampleRate,
  scrubSentryEvent,
  scrubSentrySpan,
  scrubSentryTransaction,
  sentryEnvironment,
  sentryEventHasExpectedUxError,
  traceSampleRateForEnvironment,
} from "./sentry.ts";
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

describe("resolveSentryDsn", () => {
  it("falls back to the public default DSN", () => {
    expect(resolveSentryDsn(undefined)).toBe(DEFAULT_SENTRY_DSN);
    expect(resolveSentryDsn("")).toBe(DEFAULT_SENTRY_DSN);
    expect(resolveSentryDsn("   ")).toBe(DEFAULT_SENTRY_DSN);
  });

  it("uses VITE_SENTRY_DSN when set", () => {
    expect(resolveSentryDsn("https://example@o0.ingest.sentry.io/1")).toBe(
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

    const options = createSentryBrowserOptions({ dsn: DEFAULT_SENTRY_DSN, environment: "production" });
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
  });
});

describe("trace attribute allowlist", () => {
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

  it("scrubs root transactions and every child span", () => {
    const event = {
      transaction: "export.generate",
      user: { email: "a@b.com" },
      message: "vacation.jpg を処理中",
      breadcrumbs: [{ message: "blob:http://localhost/photo" }],
      extra: { photoName: "vacation.jpg", ok: "fine" },
      request: { url: "/studio", data: "secret", cookies: { sid: "1" } },
      tags: { aspect: "portrait", filename: "secret.jpg" },
      contexts: {
        trace: {
          op: "export.generate",
          data: { export_path: "offline", fingerprint: 42, photoName: "vacation.jpg" },
        },
      },
      spans: [
        {
          description: "export.frames",
          op: "export.frames",
          data: { acquire_count: 2, fingerprint: 99, id: "photo-1" },
        },
        {
          description: "user photo vacation.jpg",
          op: "db",
          data: { filename: "vacation.jpg" },
        },
      ],
    };

    const scrubbed = scrubSentryTransaction(event);
    expect(scrubbed?.user).toBeUndefined();
    expect(scrubbed?.message).toBeUndefined();
    expect(scrubbed?.breadcrumbs).toBeUndefined();
    expect(scrubbed?.extra).toBeUndefined();
    expect(scrubbed?.request).toEqual({ url: "/studio" });
    expect(scrubbed?.tags).toEqual({ aspect: "portrait" });
    expect(scrubbed?.contexts?.trace?.data).toEqual({ export_path: "offline" });
    expect(scrubbed?.spans).toEqual([
      {
        description: "export.frames",
        op: "export.frames",
        data: { acquire_count: 2 },
      },
    ]);
  });

  it("drops unknown transactions and redacts unknown spans without returning null from beforeSendSpan", () => {
    expect(scrubSentryTransaction({ transaction: "http.client", spans: [] })).toBeNull();
    const span = scrubSentrySpan({
      description: "LoadedPhoto vacation.jpg",
      op: "custom",
      data: { filename: "vacation.jpg", fingerprint: 5 },
    });
    expect(span).toEqual({
      description: "redacted",
      op: "redacted",
      data: {},
    });

    const options = createSentryBrowserOptions({ dsn: DEFAULT_SENTRY_DSN, environment: "preview" });
    expect(
      options.beforeSendTransaction({
        transaction: "preview.open",
        tags: { entry: "initial", photoName: "a.jpg" },
        spans: [{ description: "preview.resources", data: { timelines_ready: true, filename: "a.jpg" } }],
      }),
    ).toMatchObject({
      transaction: "preview.open",
      tags: { entry: "initial" },
      spans: [{ description: "preview.resources", data: { timelines_ready: true } }],
    });
    expect(options.beforeSendSpan({ description: "media.rewind", data: { src: "blob:http://x/y" } })).toMatchObject({
      description: "media.rewind",
      data: {},
    });
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
