import { describe, expect, it } from "vitest";
import {
  PREVIEW_RENDER_WINDOW_MS,
  readPreviewBenchFlags,
  shouldRecordPreviewPaintSample,
  summarizePaintSamples,
} from "./preview-bench.ts";
import { describeKeying } from "./compositor.ts";
import { isSoftwareWebGLRenderer } from "./keying-gpu.ts";

describe("summarizePaintSamples", () => {
  it("reports avg, p95, and achieved fps", () => {
    const samples = [10, 12, 11, 13, 40];
    const snap = summarizePaintSamples(samples, 1000, 24);
    expect(snap.n).toBe(5);
    expect(snap.avgMs).toBeCloseTo(17.2, 5);
    expect(snap.p95Ms).toBe(40);
    expect(snap.minMs).toBe(10);
    expect(snap.maxMs).toBe(40);
    expect(snap.achievedFps).toBeCloseTo(5, 5);
    expect(snap.targetFps).toBe(24);
  });

  it("returns zeros when there are no samples", () => {
    expect(summarizePaintSamples([], 0, 24).n).toBe(0);
    expect(summarizePaintSamples([], 0, 24).achievedFps).toBe(0);
  });
});

describe("preview render window", () => {
  it("observes five seconds of moving preview paints and skips paused or export draws", () => {
    expect(PREVIEW_RENDER_WINDOW_MS).toBe(5000);
    expect(shouldRecordPreviewPaintSample({ windowOpen: true, paused: false, exporting: false })).toBe(true);
    expect(shouldRecordPreviewPaintSample({ windowOpen: true, paused: true, exporting: false })).toBe(false);
    expect(shouldRecordPreviewPaintSample({ windowOpen: true, paused: false, exporting: true })).toBe(false);
    expect(shouldRecordPreviewPaintSample({ windowOpen: false, paused: false, exporting: false })).toBe(false);
  });
});

describe("readPreviewBenchFlags", () => {
  it("reads bench and forced CPU keying from the query string", () => {
    expect(readPreviewBenchFlags("")).toEqual({ bench: false, forceCpuKeying: false });
    expect(readPreviewBenchFlags("?bench=1")).toEqual({ bench: true, forceCpuKeying: false });
    expect(readPreviewBenchFlags("bench=1&keying=cpu")).toEqual({ bench: true, forceCpuKeying: true });
    expect(readPreviewBenchFlags("?keying=webgl")).toEqual({ bench: false, forceCpuKeying: false });
  });
});

describe("isSoftwareWebGLRenderer", () => {
  it("detects SwiftShader / llvmpipe and ignores a hardware-looking name", () => {
    expect(isSoftwareWebGLRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))")).toBe(true);
    expect(isSoftwareWebGLRenderer("llvmpipe (LLVM 15, 256 bits)", "Mesa")).toBe(true);
    expect(isSoftwareWebGLRenderer("ANGLE (Apple, ANGLE Metal Renderer: Apple M1)")).toBe(false);
  });
});

describe("describeKeying", () => {
  it("keeps GPU debug only while the backend is webgl", () => {
    expect(
      describeKeying("webgl", {
        context: "webgl",
        renderer: "SwiftShader",
        vendor: "Google",
        software: true,
      }),
    ).toMatchObject({ backend: "webgl", software: true, renderer: "SwiftShader" });
    expect(describeKeying("cpu")).toEqual({
      backend: "cpu",
      context: "none",
      renderer: "",
      vendor: "",
      software: false,
    });
  });
});
