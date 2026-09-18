import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SENTRY_DSN,
  errorReportExtras,
  reportError,
  resolveSentryDsn,
  scrubSentryEvent,
  sentryEnvironment,
} from "./sentry.ts";

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

describe("reportError", () => {
  it("forwards the exception to the capture function", () => {
    const capture = vi.fn();
    const error = new Error("export failed");
    reportError(error, capture);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error);
  });
});
