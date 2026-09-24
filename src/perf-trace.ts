import { summarizePaintSamples, PREVIEW_RENDER_WINDOW_MS } from "./preview-bench.ts";
import { isFirstMovingCompositePaint, PREVIEW_FPS } from "./playback.ts";
import {
  getTracingApi,
  isAllowedSpanName,
  pickTraceAttributes,
  type TraceAttributeValue,
  type TraceOutcome,
  type TraceSpanName,
  type TracingSpan,
} from "./sentry.ts";

export type TraceAttributes = Record<string, TraceAttributeValue>;

export type StageStat = {
  count: number;
  totalMs: number;
  maxMs: number;
};

export function createStageStat(): StageStat {
  return { count: 0, totalMs: 0, maxMs: 0 };
}

export function noteStage(stat: StageStat, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  stat.count += 1;
  stat.totalMs += ms;
  if (ms > stat.maxMs) stat.maxMs = ms;
}

export function roundTraceMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms * 10) / 10;
}

export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

/** At most the first, middle, and last frame. Never one span per frame. */
export function detailFrameRoles(count: number): Map<number, "first" | "mid" | "last"> {
  const roles = new Map<number, "first" | "mid" | "last">();
  if (!(count > 0)) return roles;
  roles.set(0, "first");
  if (count === 1) return roles;
  const last = count - 1;
  if (count > 2) {
    const mid = Math.floor(last / 2);
    if (mid !== 0 && mid !== last) roles.set(mid, "mid");
  }
  roles.set(last, "last");
  return roles;
}

export function stageAttributePrefix(
  name: "acquire" | "rgba" | "compose" | "video_add" | "yield",
  stat: StageStat,
): TraceAttributes {
  return {
    [`${name}_count`]: stat.count,
    [`${name}_total_ms`]: roundTraceMs(stat.totalMs),
    [`${name}_max_ms`]: roundTraceMs(stat.maxMs),
  };
}

export type TraceHandle = {
  readonly name: TraceSpanName;
  readonly ended: boolean;
  setAttribute(key: string, value: TraceAttributeValue): void;
  setAttributes(attrs: TraceAttributes): void;
  startChild(name: TraceSpanName, attrs?: TraceAttributes): TraceHandle | null;
  end(outcome?: TraceOutcome, attrs?: TraceAttributes): void;
};

/** One `beginPreviewStart` call. A later start replaces this; a stale finish must not close the newer one. */
export type PreviewStartAttempt = {
  readonly id: number;
};

const STATUS_BY_OUTCOME: Record<TraceOutcome, { code: 1 | 2; message: string }> = {
  success: { code: 1, message: "ok" },
  error: { code: 2, message: "internal_error" },
  cancelled: { code: 2, message: "cancelled" },
  timeout: { code: 2, message: "deadline_exceeded" },
  superseded: { code: 1, message: "ok" },
};

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function openSpan(
  name: TraceSpanName,
  options: { parent: TracingSpan | null; forceTransaction?: boolean; attrs?: TraceAttributes },
): TraceHandle | null {
  const api = getTracingApi();
  if (!api || !api.getClient()) return null;
  const attributes = pickTraceAttributes(options.attrs);
  const span = safe(
    () =>
      api.withActiveSpan(options.parent, () =>
        api.startInactiveSpan({
          name,
          op: name,
          forceTransaction: options.forceTransaction,
          parentSpan: options.forceTransaction ? null : options.parent,
          attributes,
        }),
      ),
    undefined as TracingSpan | undefined,
  );
  if (!span || !safe(() => span.isRecording(), false)) {
    safe(() => span?.end(), undefined);
    return null;
  }
  return createHandle(name, span);
}

function createHandle(name: TraceSpanName, span: TracingSpan): TraceHandle {
  let ended = false;
  const children: TraceHandle[] = [];
  const handle: TraceHandle = {
    name,
    get ended() {
      return ended;
    },
    setAttribute(key, value) {
      if (ended) return;
      const picked = pickTraceAttributes({ [key]: value });
      const next = picked[key];
      if (next === undefined) return;
      safe(() => span.setAttribute(key, next), undefined);
    },
    setAttributes(attrs) {
      if (ended) return;
      safe(() => span.setAttributes(pickTraceAttributes(attrs)), undefined);
    },
    startChild(childName, attrs) {
      if (ended || !isAllowedSpanName(childName)) return null;
      const child = openSpan(childName, { parent: span, attrs });
      if (child) children.push(child);
      return child;
    },
    end(outcome = "success", attrs) {
      if (ended) return;
      ended = true;
      const status = STATUS_BY_OUTCOME[outcome];
      for (const child of children) {
        if (!child.ended) child.end(outcome);
      }
      safe(() => {
        span.setAttributes(pickTraceAttributes({ ...attrs, outcome }));
        span.setStatus(status);
        span.end();
      }, undefined);
    },
  };
  return handle;
}

let previewOpen: TraceHandle | null = null;
let previewStart: TraceHandle | null = null;
let previewStartAttempt: PreviewStartAttempt | null = null;
let previewStartSeq = 0;
/** True for the life of a preview start, even when that span was not sampled. */
let previewStartArmed = false;
let previewPlayback: TraceHandle | null = null;
let previewRender: TraceHandle | null = null;
let movingSpan: TraceHandle | null = null;
let movingAnchor: number | null = null;
let exportRoot: TraceHandle | null = null;
let playbackSamples: number[] = [];
let playbackStartedAt = 0;
let playbackTimer: ReturnType<typeof setTimeout> | 0 = 0;
let composeParent: TraceHandle | null = null;
const spanStack: TraceHandle[] = [];

function pushSpan(span: TraceHandle | null): void {
  if (span) spanStack.push(span);
}

function popSpan(span: TraceHandle | null): void {
  if (!span) return;
  const index = spanStack.lastIndexOf(span);
  if (index >= 0) spanStack.splice(index, 1);
}

function clearPlaybackTimer(): void {
  if (playbackTimer) globalThis.clearTimeout(playbackTimer);
  playbackTimer = 0;
}

function paintStats(samples: readonly number[], elapsedMs: number): TraceAttributes {
  const snap = summarizePaintSamples(samples, elapsedMs, PREVIEW_FPS);
  return {
    paint_n: snap.n,
    paint_avg_ms: roundTraceMs(snap.avgMs),
    paint_p95_ms: roundTraceMs(snap.p95Ms),
    paint_min_ms: roundTraceMs(snap.minMs),
    paint_max_ms: roundTraceMs(snap.maxMs),
    paint_achieved_fps: roundTraceMs(snap.achievedFps),
    paint_target_fps: snap.targetFps,
    paint_elapsed_sec: roundTraceMs(snap.elapsedSec * 1000) / 1000,
  };
}

function finishPreviewOpen(outcome: TraceOutcome, attrs?: TraceAttributes): void {
  const current = previewOpen;
  previewOpen = null;
  current?.end(outcome, attrs);
}

function finishPreviewStart(outcome: TraceOutcome, attrs?: TraceAttributes): void {
  previewStartAttempt = null;
  previewStartArmed = false;
  movingAnchor = null;
  const moving = movingSpan;
  movingSpan = null;
  moving?.end(outcome);
  const current = previewStart;
  previewStart = null;
  current?.end(outcome, attrs);
}

/** Closes this attempt only. A stale attempt must not end the newer preview.start. */
function finishPreviewStartIfCurrent(
  attempt: PreviewStartAttempt,
  outcome: TraceOutcome,
  attrs?: TraceAttributes,
): void {
  if (previewStartAttempt !== attempt) return;
  finishPreviewStart(outcome, attrs);
}

function finishPlayback(reason: "window" | "stop" | "leave" | "settings" | "hidden" | "superseded"): void {
  const root = previewPlayback;
  const render = previewRender;
  if (!root && !render) return;
  previewPlayback = null;
  previewRender = null;
  clearPlaybackTimer();
  const outcome: TraceOutcome =
    reason === "window" ? "success" : reason === "superseded" ? "superseded" : "cancelled";
  const attrs: TraceAttributes = {
    end_reason: reason,
    window_complete: reason === "window",
    ...paintStats(playbackSamples, playbackStartedAt ? nowMs() - playbackStartedAt : 0),
  };
  playbackSamples = [];
  playbackStartedAt = 0;
  render?.end(outcome, attrs);
  root?.end(outcome, attrs);
}

/**
 * Separate root, sampled once at `tracesSampleRate`.
 * Reaching this must not depend on `preview.start` being recorded: that span is
 * dropped when it misses the 0.1 sample, and gating this window on it would sample
 * the render measurements a second time.
 */
function beginPlaybackWindow(): void {
  finishPlayback("superseded");
  const root = openSpan("preview.playback", { parent: null, forceTransaction: true });
  if (!root) return;
  previewPlayback = root;
  previewRender = root.startChild("preview.render_window");
  playbackSamples = [];
  playbackStartedAt = nowMs();
  playbackTimer = globalThis.setTimeout(() => finishPlayback("window"), PREVIEW_RENDER_WINDOW_MS);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function outcomeFromError(error: unknown): TraceOutcome {
  return isAbort(error) ? "cancelled" : "error";
}

async function withChild<T>(parent: TraceHandle | null, name: TraceSpanName, fn: () => T | Promise<T>): Promise<T> {
  if (!parent) return fn();
  const span = parent.startChild(name);
  pushSpan(span);
  try {
    const value = await fn();
    span?.end("success");
    return value;
  } catch (error) {
    span?.end(outcomeFromError(error));
    throw error;
  } finally {
    popSpan(span);
  }
}

export const studioTrace = {
  beginPreviewOpen(attrs: TraceAttributes): void {
    finishPreviewOpen("superseded", { end_reason: "superseded" });
    previewOpen = openSpan("preview.open", { parent: null, forceTransaction: true, attrs });
  },
  finishPreviewOpen,
  openPreviewResourcesSpan(): TraceHandle | null {
    return previewOpen?.startChild("preview.resources") ?? null;
  },
  beginPreviewStart(attrs: TraceAttributes): PreviewStartAttempt {
    finishPreviewStart("superseded", { end_reason: "superseded" });
    finishPlayback("superseded");
    const attempt: PreviewStartAttempt = { id: ++previewStartSeq };
    previewStartAttempt = attempt;
    previewStartArmed = true;
    previewStart = openSpan("preview.start", { parent: null, forceTransaction: true, attrs });
    return attempt;
  },
  annotatePreviewStart(attrs: TraceAttributes): void {
    previewStart?.setAttributes(attrs);
  },
  finishPreviewStart,
  finishPreviewStartIfCurrent,
  openPreviewChild(name: TraceSpanName): TraceHandle | null {
    return previewStart?.startChild(name) ?? null;
  },
  armFirstMovingPaint(anchorTime: number): void {
    if (!previewStartArmed || !Number.isFinite(anchorTime)) return;
    movingAnchor = anchorTime;
    movingSpan?.end("superseded");
    movingSpan = previewStart?.startChild("preview.first_moving_paint") ?? null;
  },
  waitingForMovingPaint(): boolean {
    return movingAnchor != null && previewStartArmed;
  },
  wantsPaintSample(): boolean {
    return previewPlayback != null && !previewPlayback.ended;
  },
  notePaintSample(ms: number): void {
    if (!this.wantsPaintSample() || !Number.isFinite(ms) || ms < 0) return;
    playbackSamples.push(ms);
  },
  noteCompositePaint(input: {
    currentTime: number;
    paused: boolean;
    exporting: boolean;
    templateReady: boolean;
    hasPhotos: boolean;
    timelinesReady: boolean;
    compositorReady: boolean;
  }): void {
    if (input.exporting) return;
    if (previewOpen && !previewOpen.ended && input.templateReady && input.timelinesReady && input.compositorReady) {
      finishPreviewOpen("success", {
        has_photos: input.hasPhotos,
        timelines_ready: true,
        compositor_ready: true,
        template_ready: true,
      });
    }
    if (movingAnchor == null || !previewStartArmed) return;
    if (
      !isFirstMovingCompositePaint({
        anchorTime: movingAnchor,
        currentTime: input.currentTime,
        paused: input.paused,
        exporting: input.exporting,
      })
    ) {
      return;
    }
    const moving = movingSpan;
    movingSpan = null;
    movingAnchor = null;
    moving?.end("success");
    finishPreviewStart("success");
    beginPlaybackWindow();
  },
  onPreviewStop(reason: "stop" | "settings" | "leave" | "hidden" | "superseded"): void {
    const outcome: TraceOutcome = reason === "superseded" ? "superseded" : "cancelled";
    finishPreviewStart(outcome, { end_reason: reason });
    finishPlayback(reason);
  },
  onLeaveStudio(): void {
    finishPreviewOpen("cancelled", { end_reason: "leave" });
    this.onPreviewStop("leave");
  },
  onHidden(): void {
    finishPreviewOpen("cancelled", { end_reason: "hidden" });
    this.onPreviewStop("hidden");
  },
  onPageHide(persisted: boolean): void {
    this.onHidden();
    if (!persisted) this.finishExport("cancelled");
  },
  onGenerationStart(): void {
    finishPreviewOpen("superseded", { end_reason: "superseded" });
    finishPreviewStart("superseded", { end_reason: "superseded" });
    finishPlayback("superseded");
  },
  beginExport(attrs: TraceAttributes): void {
    exportRoot?.end("superseded", { end_reason: "superseded" });
    exportRoot = openSpan("export.generate", { parent: null, forceTransaction: true, attrs });
  },
  annotateExport(attrs: TraceAttributes): void {
    exportRoot?.setAttributes(attrs);
  },
  finishExport(outcome: TraceOutcome, attrs?: TraceAttributes): void {
    const current = exportRoot;
    exportRoot = null;
    current?.end(outcome, attrs);
  },
  finishExportIfOpen(outcome: TraceOutcome): void {
    if (!exportRoot || exportRoot.ended) return;
    this.finishExport(outcome);
  },
  openExportChild(name: TraceSpanName, attrs?: TraceAttributes): TraceHandle | null {
    const child = exportRoot?.startChild(name, attrs) ?? null;
    pushSpan(child);
    if (!child) return null;
    const end = child.end.bind(child);
    child.end = (outcome, endAttrs) => {
      popSpan(child);
      end(outcome, endAttrs);
    };
    return child;
  },
  withExportChild<T>(name: TraceSpanName, fn: () => T | Promise<T>): Promise<T> {
    return withChild(exportRoot, name, fn);
  },
  openRewindSpan(): TraceHandle | null {
    const parent = exportRoot ?? previewStart ?? previewPlayback;
    return parent?.startChild("media.rewind") ?? null;
  },
  annotateCurrent(attrs: TraceAttributes): void {
    spanStack[spanStack.length - 1]?.setAttributes(attrs);
  },
  keyerParent(): TraceHandle | null {
    return exportRoot ?? previewStart ?? previewOpen;
  },
};

export function composeDetailActive(): boolean {
  return composeParent != null;
}

export function withComposeDetail<T>(parent: TraceHandle, fn: () => T): T {
  const previous = composeParent;
  composeParent = parent;
  try {
    return fn();
  } finally {
    composeParent = previous;
  }
}

export function traceCompose<T>(name: TraceSpanName, fn: () => T): T {
  if (!composeParent) return fn();
  const span = composeParent.startChild(name);
  try {
    const value = fn();
    span?.end("success");
    return value;
  } catch (error) {
    span?.end(outcomeFromError(error));
    throw error;
  }
}

export function traceChildSync<T>(parent: TraceHandle | null, name: TraceSpanName, fn: (span: TraceHandle | null) => T): T {
  if (!parent) return fn(null);
  const span = parent.startChild(name);
  try {
    const value = fn(span);
    span?.end("success");
    return value;
  } catch (error) {
    span?.end(outcomeFromError(error));
    throw error;
  }
}

export function resetStudioTraceForTests(): void {
  clearPlaybackTimer();
  previewOpen = null;
  previewStart = null;
  previewStartAttempt = null;
  previewStartArmed = false;
  previewPlayback = null;
  previewRender = null;
  movingSpan = null;
  movingAnchor = null;
  exportRoot = null;
  playbackSamples = [];
  playbackStartedAt = 0;
  composeParent = null;
  spanStack.length = 0;
}
