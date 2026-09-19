import * as Sentry from "@sentry/browser";
import { isTranslatorCallStackOverflow, type SentryExceptionEvent } from "./translate-guard.ts";

/** Preview/prod でも env 無しで動く公開 DSN。上書きは VITE_SENTRY_DSN。 */
export const DEFAULT_SENTRY_DSN =
  "https://619cccd108a2ff20f1ea48c71161b61c@o4511562294427648.ingest.us.sentry.io/4512104396947456";

export const PRODUCTION_HOST = "anone.yoiailabs.com";

export type SentryEnvironment = "production" | "preview" | "development";

export function sentryEnvironment(hostname: string): SentryEnvironment {
  if (hostname === PRODUCTION_HOST) return "production";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return "development";
  }
  return "preview";
}

export function resolveSentryDsn(envDsn: string | undefined): string {
  const trimmed = envDsn?.trim();
  return trimmed || DEFAULT_SENTRY_DSN;
}

type ScrubEvent = {
  user?: Record<string, unknown>;
  request?: { data?: unknown; cookies?: unknown };
  extra?: Record<string, unknown>;
};

function looksLikeBlobOrData(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"));
}

/** 写真名・blob・PII を載せない。 */
export function scrubSentryEvent<T extends ScrubEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
  }
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (looksLikeBlobOrData(value) || /photo|filename|file|blob|image/i.test(key)) {
        delete event.extra[key];
      }
    }
  }
  return event;
}

export function initSentry(): void {
  Sentry.init({
    dsn: resolveSentryDsn(import.meta.env.VITE_SENTRY_DSN),
    environment: sentryEnvironment(window.location.hostname),
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    denyUrls: [
      /translate\.googleapis\.com/i,
      /translate\.googleusercontent\.com/i,
      /translate\.google\.com/i,
    ],
    beforeSend(event) {
      return filterSentryEvent(scrubSentryEvent(event));
    },
  });
}

/** 翻訳スクリプトの Ok↔Qk スタックオーバーフローは first-party ではないので送らない。 */
export function filterSentryEvent<T extends ScrubEvent & SentryExceptionEvent>(event: T): T | null {
  if (isTranslatorCallStackOverflow(event)) return null;
  return event;
}

export function reportError(
  error: unknown,
  capture: (error: unknown) => void = (value) => {
    Sentry.captureException(value);
  },
): void {
  capture(error);
}
