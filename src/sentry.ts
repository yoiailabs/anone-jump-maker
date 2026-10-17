import type { BrowserOptions } from "@sentry/browser";
import {
  ASPECT_MODES,
  CHARACTER_SIZES,
  IMAGE_FILTERS,
  SWAP_STYLES,
} from "./layout.ts";
import { MESSAGES } from "./messages.ts";
import { isTranslatorCallStackOverflow, type SentryExceptionEvent } from "./translate-guard.ts";

/** Sentry の environment 名を production にするホスト。送信のオンオフには使わない。 */
export const PRODUCTION_HOST = "anone.yoiailabs.com";

/**
 * 本番のトレースサンプル率。`tracesSampleRate` と同じ値。
 * `tracesSampler` を足すときは親の判定を引き継ぐだけで、この率を掛け算しない。
 */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

export type SentryEnvironment = "production" | "preview" | "development";

export function sentryEnvironment(hostname: string): SentryEnvironment {
  if (hostname === PRODUCTION_HOST) return "production";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return "development";
  }
  return "preview";
}

/**
 * `VITE_SENTRY_DSN` があるときだけ SDK を読む。未設定ならホストが本番でも送らない。
 */
export function resolveSentryDsn(envDsn: string | undefined): string | undefined {
  const trimmed = envDsn?.trim();
  return trimmed || undefined;
}

export function isSentryEnabled(envDsn: string | undefined): boolean {
  return resolveSentryDsn(envDsn) !== undefined;
}

/** 環境ごとのルートトレース率。本番は 0.1 のまま。sampler はこの値を親判定に掛けない。 */
export function traceSampleRateForEnvironment(environment: SentryEnvironment): number {
  if (environment === "production") return PRODUCTION_TRACES_SAMPLE_RATE;
  return PRODUCTION_TRACES_SAMPLE_RATE;
}

/**
 * 親が既にサンプリング済みならその判定をそのまま返す。
 * `parentSampled ? rate : 0` のようには掛け算しない。
 */
export function resolveTraceSampleRate(input: {
  environment: SentryEnvironment;
  parentSampled?: boolean;
}): number | boolean {
  if (input.parentSampled === true) return true;
  if (input.parentSampled === false) return false;
  return traceSampleRateForEnvironment(input.environment);
}

type SamplingContextLike = {
  name?: string;
  parentSampled?: boolean;
  inheritOrSampleWith?: (fallbackSampleRate: number) => number;
};

export function sampleTrace(environment: SentryEnvironment, samplingContext: SamplingContextLike): number | boolean {
  // v11 stream mode never calls beforeSendTransaction. tracesSampler runs only for segment spans.
  if (typeof samplingContext.name === "string" && !isRootSpanName(samplingContext.name)) {
    return false;
  }
  const rate = traceSampleRateForEnvironment(environment);
  if (typeof samplingContext.inheritOrSampleWith === "function") {
    return samplingContext.inheritOrSampleWith(rate);
  }
  return resolveTraceSampleRate({
    environment,
    parentSampled: samplingContext.parentSampled,
  });
}

type ScrubEvent = {
  user?: Record<string, unknown>;
  request?: { data?: unknown; cookies?: unknown; headers?: unknown; url?: unknown };
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
    delete event.request.headers;
    if (looksLikeBlobOrData(event.request.url)) delete event.request.url;
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

export const TRACE_ROOT_NAMES = [
  "preview.open",
  "preview.start",
  "preview.playback",
  "export.generate",
] as const;

export const TRACE_SPAN_NAMES = [
  ...TRACE_ROOT_NAMES,
  "export.frames",
  "export.frame",
  "preview.render_window",
  "export.character_probe",
  "media.rewind",
  "export.template_open",
  "export.audio_prepare",
  "export.audio_pump",
  "export.finalize",
  "export.module_load",
  "export.plan",
  "preview.play_request",
  "preview.first_moving_paint",
  "preview.resources",
  "export.prepare",
  "compose.photo",
  "compose.filter",
  "compose.character",
  "compose.fx",
  "compose.output",
  "compositor.keyer_init",
  "export.cancel_cleanup",
  "export.blob_create",
] as const;

export type TraceSpanName = (typeof TRACE_SPAN_NAMES)[number];
export type TraceRootName = (typeof TRACE_ROOT_NAMES)[number];
export type TraceOutcome = "success" | "error" | "cancelled" | "superseded" | "timeout";
export type TraceAttributeValue = string | number | boolean;

const TRACE_SPAN_NAME_SET = new Set<string>(TRACE_SPAN_NAMES);
const TRACE_ROOT_NAME_SET = new Set<string>(TRACE_ROOT_NAMES);

const TRACE_STRING_ENUMS: Record<string, ReadonlySet<string>> = {
  outcome: new Set(["success", "error", "cancelled", "superseded", "timeout"]),
  entry: new Set(["initial", "reopen"]),
  trigger: new Set(["play", "resume", "restart", "aspect_resume"]),
  end_reason: new Set(["stop", "leave", "settings", "hidden", "window", "superseded"]),
  export_path: new Set(["offline"]),
  aspect: new Set(ASPECT_MODES),
  effect: new Set(SWAP_STYLES),
  filter: new Set(IMAGE_FILTERS),
  character_size: new Set(CHARACTER_SIZES),
  character_path: new Set(["rgba-copyTo", "html-video-seek"]),
  probe_outcome: new Set(["rgba-copyTo", "html-video-seek"]),
  keying: new Set(["webgl", "cpu"]),
  container: new Set(["mp4", "webm"]),
  frame_role: new Set(["first", "mid", "last"]),
};

const TRACE_TOKEN_KEYS = new Set(["video_codec", "audio_codec"]);

const TRACE_NUMERIC_KEYS = new Set([
  "width",
  "height",
  "fps",
  "frame_count",
  "frame_index",
  "duration_sec",
  "byte_size",
  "acquire_count",
  "acquire_total_ms",
  "acquire_max_ms",
  "acquire_ms",
  "rgba_count",
  "rgba_total_ms",
  "rgba_max_ms",
  "rgba_ms",
  "compose_count",
  "compose_total_ms",
  "compose_max_ms",
  "compose_ms",
  "video_add_count",
  "video_add_total_ms",
  "video_add_max_ms",
  "video_add_ms",
  "yield_count",
  "yield_total_ms",
  "yield_max_ms",
  "yield_ms",
  "paint_n",
  "paint_avg_ms",
  "paint_p95_ms",
  "paint_min_ms",
  "paint_max_ms",
  "paint_achieved_fps",
  "paint_target_fps",
  "paint_elapsed_sec",
]);

const TRACE_BOOLEAN_KEYS = new Set([
  "window_complete",
  "rewind_required",
  "has_photos",
  "timelines_ready",
  "compositor_ready",
  "template_ready",
  "timeout_won",
  "copied_first",
  "copied_later",
  "first_time_ok",
  "later_time_ok",
  "pixels_advanced",
  "opened",
  "has_audio",
]);

const TRACE_TOKEN = /^[a-z0-9.+_-]{1,32}$/i;

export function isAllowedSpanName(name: string): name is TraceSpanName {
  return TRACE_SPAN_NAME_SET.has(name);
}

export function isRootSpanName(name: string): name is TraceRootName {
  return TRACE_ROOT_NAME_SET.has(name);
}

function stringAttributeAllowed(key: string, value: string): boolean {
  if (
    value.length > 64 ||
    value.includes("blob:") ||
    value.includes("data:") ||
    value.includes("/") ||
    value.includes("\\") ||
    /\s/.test(value)
  ) {
    return false;
  }
  const enums = TRACE_STRING_ENUMS[key];
  if (enums) return enums.has(value);
  if (TRACE_TOKEN_KEYS.has(key)) return TRACE_TOKEN.test(value);
  return false;
}

/** 低カーディナリティの属性だけ残す。オブジェクトの展開や自由文は捨てる。 */
export function pickTraceAttributes(input: Record<string, unknown> | undefined): Record<string, TraceAttributeValue> {
  const out: Record<string, TraceAttributeValue> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    if (TRACE_BOOLEAN_KEYS.has(key)) {
      if (typeof value === "boolean") out[key] = value;
      continue;
    }
    if (TRACE_NUMERIC_KEYS.has(key)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
      continue;
    }
    if (typeof value === "string" && stringAttributeAllowed(key, value)) {
      out[key] = value;
    }
  }
  return out;
}

const SENTRY_OP_ATTRIBUTE = "sentry.op";

export type StreamedSpanScrubTarget = {
  name?: string;
  attributes?: Record<string, unknown>;
};

const REDACTED_SPAN = "redacted";

function spanOp(span: StreamedSpanScrubTarget): string | undefined {
  const op = span.attributes?.[SENTRY_OP_ATTRIBUTE];
  return typeof op === "string" ? op : undefined;
}

/**
 * v11 `beforeSendSpan` receives `name` / `attributes['sentry.op']` / `attributes`.
 * The callback cannot drop a span, so a name outside the allowlist is redacted.
 */
export function scrubSentrySpan<T extends StreamedSpanScrubTarget>(span: T): T {
  const op = spanOp(span);
  const name = span.name || op || "";
  if (!isAllowedSpanName(name)) {
    span.name = REDACTED_SPAN;
    span.attributes = { [SENTRY_OP_ATTRIBUTE]: REDACTED_SPAN };
    return span;
  }
  const nextOp = op && isAllowedSpanName(op) ? op : name;
  span.name = name;
  span.attributes = {
    ...pickTraceAttributes(span.attributes),
    [SENTRY_OP_ATTRIBUTE]: nextOp,
  };
  return span;
}

function escapeTraceSpanName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches every span name except the allowlist.
 * `ignoreSpans` evaluates this at span start and ignores an empty description,
 * so `scrubSentrySpan` still redacts that case.
 */
export function ignoredTraceSpanNamePattern(): RegExp {
  const allowed = TRACE_SPAN_NAMES.map(escapeTraceSpanName).join("|");
  return new RegExp(`^(?!(?:${allowed})$).*$`);
}

const V10_SENSITIVE_KEY_DENY = ["forwarded", "-ip", "remote-", "via", "-user"];

export type TracingSpan = {
  setAttribute(key: string, value: TraceAttributeValue | undefined): void;
  setAttributes(attributes: Record<string, TraceAttributeValue | undefined>): void;
  setStatus(status: { code: 0 | 1 | 2; message?: string }): void;
  end(): void;
  isRecording(): boolean;
};

export type TracingApi = {
  getClient(): unknown;
  startInactiveSpan(options: {
    name: string;
    op?: string;
    attributes?: Record<string, TraceAttributeValue | undefined>;
    forceTransaction?: boolean;
    parentSpan?: TracingSpan | null;
    onlyIfParent?: boolean;
  }): TracingSpan;
  withActiveSpan<T>(span: TracingSpan | null, callback: () => T): T;
};

let tracingApi: TracingApi | null = null;

export function bindSentryTracing(api: TracingApi | null): void {
  tracingApi = api;
}

/** 初期化が終わるまで null。計測側は待たずに何もしない。 */
export function getTracingApi(): TracingApi | null {
  return tracingApi;
}

export function resetSentryTracingForTests(): void {
  tracingApi = null;
}

const SENTRY_DENY_URLS = [
  /translate\.googleapis\.com/i,
  /translate\.googleusercontent\.com/i,
  /translate\.google\.com/i,
];

export function createSentryBrowserOptions(input: { dsn: string; environment: SentryEnvironment }) {
  return {
    dsn: input.dsn,
    environment: input.environment,
    traceLifecycle: "stream" as const,
    tracesSampleRate: PRODUCTION_TRACES_SAMPLE_RATE,
    tracesSampler(samplingContext: SamplingContextLike) {
      return sampleTrace(input.environment, samplingContext);
    },
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: [...V10_SENSITIVE_KEY_DENY] },
        response: { deny: [...V10_SENSITIVE_KEY_DENY] },
      },
      httpBodies: [],
      urlQueryParams: { deny: [...V10_SENSITIVE_KEY_DENY] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
      queues: false,
      stackFrameVariables: true,
      frameContextLines: 7,
    },
    denyUrls: SENTRY_DENY_URLS,
    ignoreSpans: [ignoredTraceSpanNamePattern()],
    beforeSend<T extends ScrubEvent & SentryExceptionEvent>(event: T) {
      return filterSentryEvent(scrubSentryEvent(event));
    },
    beforeSendSpan(span) {
      return scrubSentrySpan(span);
    },
  } satisfies BrowserOptions;
}

type SentryBrowser = typeof import("@sentry/browser");

let sentryPromise: Promise<SentryBrowser | null> | null = null;

function loadSentry(): Promise<SentryBrowser | null> {
  if (sentryPromise) return sentryPromise;
  const dsn = resolveSentryDsn(import.meta.env.VITE_SENTRY_DSN);
  if (typeof window === "undefined" || !dsn) {
    sentryPromise = Promise.resolve(null);
    return sentryPromise;
  }
  sentryPromise = import("@sentry/browser").then((Sentry) => {
    const environment = sentryEnvironment(window.location.hostname);
    Sentry.init(
      createSentryBrowserOptions({
        dsn,
        environment,
      }),
    );
    bindSentryTracing({
      getClient: () => Sentry.getClient(),
      startInactiveSpan: (options) =>
        Sentry.startInactiveSpan(options as Parameters<typeof Sentry.startInactiveSpan>[0]),
      withActiveSpan: (span, callback) =>
        Sentry.withActiveSpan(span as Parameters<typeof Sentry.withActiveSpan>[0], () => callback()),
    });
    return Sentry;
  });
  return sentryPromise;
}

/** SDK は別チャンク。初回描画のあとで呼ぶ。計測は初期化を待たない。 */
export function initSentry(): void {
  void loadSentry();
}

/** 翻訳スクリプトの Ok↔Qk スタックオーバーフローと、想定どおりの UX エラーは送らない。 */
export function filterSentryEvent<T extends ScrubEvent & SentryExceptionEvent>(event: T): T | null {
  if (isTranslatorCallStackOverflow(event)) return null;
  if (sentryEventHasExpectedUxError(event)) return null;
  return event;
}

export function reportError(error: unknown, capture?: (error: unknown) => void): void {
  if (isExpectedUxError(error)) return;
  if (capture) {
    capture(error);
    return;
  }
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const extras = errorReportExtras(error);
    if (extras) {
      Sentry.withScope((scope) => {
        scope.setExtras(extras);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  });
}
