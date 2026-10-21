import { describe, expect, it, vi } from "vitest";
import { applySoftwareBlur } from "./blur.ts";
import { previewResolutionScale } from "./canvas-size.ts";
import { createCompositor } from "./compositor.ts";
import { filterBlurPx, mainPanelRect, OUTPUTS, type ImageFilter } from "./layout.ts";
import { applyLegacyBlur } from "./test-support/legacy-blur.ts";

vi.mock("./blur.ts", { spy: true });

/** 10–90%のエッジ幅。しきい値の位置は画素間を線形補間する。 */
function edgeWidth(values: number[]): number {
  const crossing = (value: number) => {
    const i = values.findIndex((v) => v >= value);
    expect(i).toBeGreaterThan(0);
    return i - 1 + (value - values[i - 1]!) / (values[i]! - values[i - 1]!);
  };
  return crossing(255 * 0.9) - crossing(255 * 0.1);
}

function blurredEdge(width: number, height: number, filter: ImageFilter, vertical: boolean, legacy = false): number {
  const target = document.createElement("canvas");
  const scratch = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d")!;
  try {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "white";
    if (vertical) ctx.fillRect(Math.floor(width / 2), 0, width, height);
    else ctx.fillRect(0, Math.floor(height / 2), width, height);
    const long = Math.max(width, height);
    const px = legacy ? Math.max(2, Math.round(long * (filter === "blur-weak" ? 0.005 : 0.011))) : filterBlurPx(filter, long);
    (legacy ? applyLegacyBlur : applySoftwareBlur)(target, ctx, scratch, scratch.getContext("2d")!, px);
    const { data } = vertical
      ? ctx.getImageData(0, Math.floor(height / 2), width, 1)
      : ctx.getImageData(Math.floor(width / 2), 0, 1, height);
    const values = Array.from({ length: data.length / 4 }, (_, i) => data[i * 4]!);
    return edgeWidth(values);
  } finally {
    target.width = target.height = scratch.width = scratch.height = 0;
  }
}

describe("photo blur at preview / export resolutions", () => {
  it("calibrates actual canvas edge widths against the legacy algorithm", () => {
    for (const long of [640, 1920]) for (const filter of ["blur-weak", "blur-strong"] as const) {
      for (const vertical of [true, false]) {
        const old = blurredEdge(long, long * 9 / 16, filter, vertical, true);
        const current = blurredEdge(long, long * 9 / 16, filter, vertical);
        console.log(JSON.stringify({ long, filter, axis: vertical ? "x" : "y", old, current, ratio: current / old }));
        if (long === 1920) {
          expect(current / old).toBeGreaterThanOrEqual(filter === "blur-weak" ? 0.50 : 0.55);
          expect(current / old).toBeLessThanOrEqual(filter === "blur-weak" ? 0.60 : 0.65);
        }
      }
    }
  });
  for (const aspect of ["landscape", "portrait"] as const) {
    for (const filter of ["blur-weak", "blur-strong"] as const) {
      it(`${aspect}/${filter}: matches actual edge spread within 15% in both axes`, () => {
        const output = OUTPUTS[aspect];
        for (const vertical of [true, false]) {
          const fractions = [previewResolutionScale(aspect), 1].map((scale) => {
            const panel = mainPanelRect(Math.round(output.width * scale), Math.round(output.height * scale), aspect);
            const width = Math.round(panel.w);
            const height = Math.round(panel.h);
            return blurredEdge(width, height, filter, vertical) / Math.max(width, height);
          });
          console.log(JSON.stringify({ aspect, filter, axis: vertical ? "x" : "y", previewExport: fractions[0]! / fractions[1]! }));
          expect(fractions[0]! / fractions[1]!, `preview/export, ${vertical ? "x" : "y"}`).toBeGreaterThanOrEqual(0.85);
          expect(fractions[0]! / fractions[1]!, `preview/export, ${vertical ? "x" : "y"}`).toBeLessThanOrEqual(1.15);
        }
      });
    }
  }

  it("also matches the requested 360/1080 reference sizes and keeps 強 about twice as wide as 弱", () => {
    const fractions = new Map<string, number>();
    for (const long of [360, 640, 1080, 1920]) {
      for (const vertical of [true, false]) {
        const weak = blurredEdge(long, Math.round(long * 9 / 16), "blur-weak", vertical);
        const strong = blurredEdge(long, Math.round(long * 9 / 16), "blur-strong", vertical);
        // 目標σ比は単体テストで2倍以上を固定。補間・8bit量子化には約2倍の幅を許す。
        expect(strong / weak, `${long}, ${vertical ? "x" : "y"}: strong/weak`).toBeGreaterThanOrEqual(1.95);
        fractions.set(`${long}/weak/${vertical}`, weak / long);
        fractions.set(`${long}/strong/${vertical}`, strong / long);
      }
    }
    for (const [preview, saved] of [[360, 1080], [640, 1920]]) {
      for (const filter of ["weak", "strong"]) for (const vertical of [true, false]) {
        const ratio = fractions.get(`${preview}/${filter}/${vertical}`)! / fractions.get(`${saved}/${filter}/${vertical}`)!;
        expect(ratio, `${preview}/${saved}, ${filter}, ${vertical ? "x" : "y"}`).toBeGreaterThanOrEqual(0.75);
        expect(ratio, `${preview}/${saved}, ${filter}, ${vertical ? "x" : "y"}`).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it("none never enters blur processing and restores identical photo pixels after a blur", async () => {
    const source = document.createElement("canvas");
    source.width = 64;
    source.height = 36;
    const ctx = source.getContext("2d")!;
    ctx.fillStyle = "#d87045";
    ctx.fillRect(0, 0, 64, 36);
    ctx.fillStyle = "#ffffff";
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 4, 36);
    const bitmap = await createImageBitmap(source);
    const comp = createCompositor({ resolutionScale: previewResolutionScale("landscape"), createKeyer: () => null });
    const video = document.createElement("video");
    const read = vi.spyOn(CanvasRenderingContext2D.prototype, "getImageData");
    const draw = (filter: ImageFilter) => comp.draw(video, [{ id: "edge", name: "edge", bitmap, thumbUrl: "" }], { slots: [0] }, 0.2, "zoom", filter);
    const pixels = () => comp.canvas.getContext("2d")!.getImageData(0, 0, comp.canvas.width, comp.canvas.height).data;
    try {
      vi.mocked(applySoftwareBlur).mockClear();
      draw("none");
      expect(applySoftwareBlur).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      const original = pixels();
      draw("blur-strong");
      expect(applySoftwareBlur).toHaveBeenCalledOnce();
      expect(pixels()).not.toEqual(original);
      vi.mocked(applySoftwareBlur).mockClear();
      read.mockClear();
      draw("none");
      expect(applySoftwareBlur).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      expect(pixels()).toEqual(original);
    } finally {
      read.mockRestore();
      comp.destroy();
      bitmap.close();
      source.width = source.height = 0;
    }
  });
});
