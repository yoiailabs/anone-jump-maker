import * as Sentry from "@sentry/browser";
import { MESSAGES } from "./messages.ts";
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

/** デコード失敗の切り分け用。ファイル名や画素は含めない。 */
export const SENTRY_DIAGNOSTIC_EXTRA_KEYS = new Set([
  "signature",
  "mime",
  "extension",
  "byteSize",
  "decodeAttempts",
]);

/**
 * 画面に出す想定どおりの UX メッセージ。throw は日本語定数のまま、表示だけ i18n する。
 * ANONE-JUMP-MAKER-7 / 1A / 1B / 19 / H と同系統。
 */
export const EXPECTED_UX_ERROR_MESSAGES = new Set<string>([
  MESSAGES.ja.errorImageLoad,
  MESSAGES.ja.errorHeic,
  MESSAGES.ja.errorUnsupportedExport,
]);

export function isExpectedUxError(error: unknown): boolean {
  return error instanceof Error && EXPECTED_UX_ERROR_MESSAGES.has(error.message);
}

type UxSentryEvent = SentryExceptionEvent & { message?: string };

export function sentryEventHasExpectedUxError(event: UxSentryEvent): boolean {
  if (event.message && EXPECTED_UX_ERROR_MESSAGES.has(event.message)) return true;
  return Boolean(
    event.exception?.values?.some(
      (value) => value?.value != null && EXPECTED_UX_ERROR_MESSAGES.has(value.value),
    ),
  );
}

function looksLikeBlobOrData(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"));
}

export function errorReportExtras(error: unknown): Record<string, unknown> | undefined {
  if (!error || typeof error !== "object" || !("extras" in error)) return undefined;
  const extras = error.extras;
  if (!extras || typeof extras !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras as Record<string, unknown>)) {
    if (!SENTRY_DIAGNOSTIC_EXTRA_KEYS.has(key) || looksLikeBlobOrData(value)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 写真名・blob・PII を載せない。診断キー（signature 等）は残す。 */
export function scrubSentryEvent<T extends ScrubEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
  }
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (SENTRY_DIAGNOSTIC_EXTRA_KEYS.has(key) && !looksLikeBlobOrData(value)) continue;
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

/** 翻訳スクリプトの Ok↔Qk スタックオーバーフローと、想定どおりの UX エラーは送らない。 */
export function filterSentryEvent<T extends ScrubEvent & SentryExceptionEvent>(event: T): T | null {
  if (isTranslatorCallStackOverflow(event)) return null;
  if (sentryEventHasExpectedUxError(event)) return null;
  return event;
}

export function reportError(
  error: unknown,
  capture: (error: unknown) => void = (value) => {
    const extras = errorReportExtras(value);
    if (extras) {
      Sentry.withScope((scope) => {
        scope.setExtras(extras);
        Sentry.captureException(value);
      });
    } else {
      Sentry.captureException(value);
    }
  },
): void {
  if (isExpectedUxError(error)) return;
  capture(error);
}
