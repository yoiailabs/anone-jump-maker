import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SENTRY_DSN,
  errorReportExtras,
  filterSentryEvent,
  isExpectedUxError,
  reportError,
  resolveSentryDsn,
  scrubSentryEvent,
  sentryEnvironment,
  sentryEventHasExpectedUxError,
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
