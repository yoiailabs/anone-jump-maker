import {
  ASPECT_MODES,
  CHARACTER_SIZES,
  IMAGE_FILTERS,
  SWAP_STYLES,
} from "./layout.ts";
import { MESSAGES } from "./messages.ts";
import { isTranslatorCallStackOverflow, type SentryExceptionEvent } from "./translate-guard.ts";

/** Preview/prod でも env 無しで動く公開 DSN。上書きは VITE_SENTRY_DSN。 */
export const DEFAULT_SENTRY_DSN =
  "https://619cccd108a2ff20f1ea48c71161b61c@o4511562294427648.ingest.us.sentry.io/4512104396947456";

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

export function resolveSentryDsn(envDsn: string | undefined): string {
  const trimmed = envDsn?.trim();
  return trimmed || DEFAULT_SENTRY_DSN;
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
  parentSampled?: boolean;
  inheritOrSampleWith?: (fallbackSampleRate: number) => number;
};

export function sampleTrace(environment: SentryEnvironment, samplingContext: SamplingContextLike): number | boolean {
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

export type SpanScrubTarget = {
  description?: string;
  op?: string;
  name?: string;
  data?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  tags?: Record<string, unknown>;
};

const REDACTED_SPAN = "redacted";

/** 子スパンの説明と属性を許可リストに合わせる。SDK 10 は null を捨てないので必ずスパンを返す。 */
export function scrubSentrySpan<T extends SpanScrubTarget>(span: T): T {
  const name = span.description || span.op || span.name || "";
  if (!isAllowedSpanName(name)) {
    if (span.description !== undefined) span.description = REDACTED_SPAN;
    if (span.op !== undefined) span.op = REDACTED_SPAN;
    if (span.name !== undefined) span.name = REDACTED_SPAN;
    span.data = {};
    if (span.attributes) span.attributes = {};
    if (span.tags) span.tags = {};
    return span;
  }
  if (span.description !== undefined && !isAllowedSpanName(span.description)) span.description = name;
  if (span.op !== undefined && !isAllowedSpanName(span.op)) span.op = name;
  if (span.name !== undefined && !isAllowedSpanName(span.name)) span.name = name;
  if (span.data) span.data = pickTraceAttributes(span.data);
  if (span.attributes) span.attributes = pickTraceAttributes(span.attributes);
  if (span.tags) span.tags = pickTraceAttributes(span.tags);
  return span;
}

export type TransactionScrubTarget = ScrubEvent & {
  transaction?: string;
  message?: string;
  logentry?: unknown;
  breadcrumbs?: unknown;
  fingerprint?: string[];
  tags?: Record<string, unknown>;
  measurements?: Record<string, unknown>;
  spans?: SpanScrubTarget[];
  contexts?: { trace?: { op?: string; description?: string; data?: Record<string, unknown> } };
};

function keepMeasurement(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return false;
  const record = value as { value?: unknown };
  return typeof record.value === "number" && Number.isFinite(record.value);
}

/** ルートと子スパンの属性・説明を許可リストに合わせる。未知のトランザクションは送らない。 */
export function scrubSentryTransaction<T extends TransactionScrubTarget>(event: T): T | null {
  scrubSentryEvent(event);
  delete event.extra;
  delete event.breadcrumbs;
  delete event.logentry;
  delete event.message;
  if (event.fingerprint) {
    const kept = event.fingerprint.filter((item) => isAllowedSpanName(item));
    if (kept.length === 0) delete event.fingerprint;
    else event.fingerprint = kept;
  }
  if (!event.transaction || !isRootSpanName(event.transaction)) return null;
  if (event.tags) event.tags = pickTraceAttributes(event.tags);
  const trace = event.contexts?.trace;
  if (trace) {
    if (trace.data) trace.data = pickTraceAttributes(trace.data);
    if (trace.op && !isAllowedSpanName(trace.op)) delete trace.op;
    if (trace.description && !isAllowedSpanName(trace.description)) delete trace.description;
  }
  if (event.spans) {
    event.spans = event.spans.filter((span) => {
      const name = span.description || span.op || span.name || "";
      return isAllowedSpanName(name);
    });
    for (const span of event.spans) scrubSentrySpan(span);
  }
  if (event.measurements) {
    for (const [key, value] of Object.entries(event.measurements)) {
      if (!keepMeasurement(value)) delete event.measurements[key];
    }
  }
  return event;
}

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
    tracesSampleRate: PRODUCTION_TRACES_SAMPLE_RATE,
    tracesSampler(samplingContext: SamplingContextLike) {
      return sampleTrace(input.environment, samplingContext);
    },
    sendDefaultPii: false as const,
    denyUrls: SENTRY_DENY_URLS,
    beforeSend<T extends ScrubEvent & SentryExceptionEvent>(event: T) {
      return filterSentryEvent(scrubSentryEvent(event));
    },
    beforeSendSpan<T extends SpanScrubTarget>(span: T) {
      return scrubSentrySpan(span);
    },
    beforeSendTransaction<T extends TransactionScrubTarget>(event: T) {
      return scrubSentryTransaction(event);
    },
  };
}

type SentryBrowser = typeof import("@sentry/browser");

let sentryPromise: Promise<SentryBrowser> | null = null;

function loadSentry(): Promise<SentryBrowser> {
  sentryPromise ??= import("@sentry/browser").then((Sentry) => {
    if (typeof window === "undefined") return Sentry;
    const environment = sentryEnvironment(window.location.hostname);
    Sentry.init(
      createSentryBrowserOptions({
        dsn: resolveSentryDsn(import.meta.env.VITE_SENTRY_DSN),
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
