import { afterEach, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor.ts";
import { swapFx } from "./layout.ts";
import { withComposeDetail } from "./perf-trace.ts";
import type { LoadedPhoto } from "./photos.ts";

vi.mock("./layout.ts", { spy: true });
const noFx = swapFx(0, [], "catiris");
afterEach(() => vi.restoreAllMocks());

it.each([false, true])("dispatches shared reveal by style, with detailed tracing=%s", async (traced) => {
  const compositor = createCompositor({ resolutionScale: 0.1, createKeyer: () => null });
  const source = document.createElement("canvas");
  source.width = source.height = 20;
  const ctx = source.getContext("2d")!;
  const photos: LoadedPhoto[] = [];
  for (const color of ["#a00", "#0a0"]) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 20, 20);
    photos.push({ id: color, name: color, bitmap: await createImageBitmap(source), thumbUrl: "" });
  }
  const video = document.createElement("video");
  const stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
  const draw = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  // 詳細トレースの分岐も同じ共有revealで検査する。
  const parent = { startChild: () => null } as unknown as Parameters<typeof withComposeDetail>[0];
  try {
    for (const style of ["catiris", "jump", "zoom"] as const) {
      for (const lift of [0, 0.1]) {
        vi.mocked(swapFx).mockReturnValue({ ...noFx, lift, reveal: { nextSlot: 1, progress: 3 / 7 } });
        stroke.mockClear(); draw.mockClear();
        const render = () => compositor.draw(video, photos, { slots: [0, 1] }, 0.5, style);
        if (traced) withComposeDetail(parent, render);
        else render();
        expect(stroke).toHaveBeenCalledTimes(style === "catiris" ? 1 : 0);
        expect(draw).toHaveBeenCalledTimes(2 + (style === "catiris" ? 1 : 0) + (lift > 0 ? 3 : 0));
        const { width: w, height: h } = compositor.canvas;
        const pixel = compositor.canvas.getContext("2d")!.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
        // revealがあっても他のstyleにネコは出ず、全面FXも誤って省略しない。
        expect(pixel[style === "catiris" ? 1 : 0]).toBeGreaterThan(pixel[style === "catiris" ? 0 : 1]!);
      }
    }
  } finally {
    photos.forEach((p) => p.bitmap.close());
    compositor.destroy();
  }
});
