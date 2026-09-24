/** One accepted preview start is observed for this long, then the window closes. */
export const PREVIEW_RENDER_WINDOW_MS = 5000;

/** Paused frames and export draws stay out of the preview paint window. */
export function shouldRecordPreviewPaintSample(input: {
  paused: boolean;
  exporting: boolean;
  windowOpen: boolean;
}): boolean {
  return input.windowOpen && !input.paused && !input.exporting;
}

export type PaintBenchSnapshot = {
  n: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  achievedFps: number;
  targetFps: number;
  elapsedSec: number;
};

export function summarizePaintSamples(
  samples: readonly number[],
  elapsedMs: number,
  targetFps: number,
): PaintBenchSnapshot {
  const elapsedSec = elapsedMs > 0 ? elapsedMs / 1000 : 0;
  if (samples.length === 0) {
    return {
      n: 0,
      avgMs: 0,
      p95Ms: 0,
      minMs: 0,
      maxMs: 0,
      achievedFps: 0,
      targetFps,
      elapsedSec,
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return {
    n: sorted.length,
    avgMs: sum / sorted.length,
    p95Ms: sorted[p95Index]!,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    achievedFps: elapsedSec > 0 ? sorted.length / elapsedSec : 0,
    targetFps,
    elapsedSec,
  };
}

export function readPreviewBenchFlags(search: string): { bench: boolean; forceCpuKeying: boolean } {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const query = new URLSearchParams(raw);
  return {
    bench: query.has("bench"),
    forceCpuKeying: query.get("keying") === "cpu",
  };
}
