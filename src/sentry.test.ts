import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SENTRY_DSN,
  filterSentryEvent,
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
});
