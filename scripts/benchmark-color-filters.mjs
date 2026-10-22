/** Chromium の 1080p ベンチマーク。他のテストと同時実行しない。 */
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const result = await page.evaluate(async () => {
    const { COLOR_FILTERS, applyColorFilter, createColorPhotoCache } = await import("/src/color-filter.ts");
    const { createCompositor } = await import("/src/compositor.ts");
    const source = document.createElement("canvas");
    source.width = 1920; source.height = 1080;
    const ctx = source.getContext("2d", { willReadFrequently: true });
    const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
    gradient.addColorStop(0, "#edae8f"); gradient.addColorStop(1, "#354b70");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1920, 1080);
    const bitmap = await createImageBitmap(source);
    const photo = { id: "bench", name: "bench", bitmap, thumbUrl: "" };
    const cache = createColorPhotoCache();
    const comp = createCompositor({ createKeyer: () => null });
    const video = document.createElement("video");
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const measure = (fn, count = 15) => {
      const samples = [];
      for (let i = 0; i < count + 3; i++) {
        const start = performance.now(); fn();
        if (i >= 3) samples.push(performance.now() - start);
      }
      return median(samples);
    };
    const rows = [];
    for (const color of COLOR_FILTERS.slice(1)) {
      const perFrameMs = measure(() => {
        ctx.drawImage(bitmap, 0, 0);
        const image = ctx.getImageData(0, 0, 1920, 1080);
        applyColorFilter(image.data, color); ctx.putImageData(image, 0, 0);
      });
      const coldMs = measure(() => { cache.clear(); cache.get(bitmap, color); });
      const hitMs = measure(() => { for (let i = 0; i < 100_000; i++) cache.get(bitmap, color); }) / 100_000;
      // 同じフレームを反復し、Canvas の遅延描画も readback で完了させる。
      const compose = (filter) => {
        comp.draw(video, [photo], { slots: [0] }, 0.2, "zoom", "none", undefined, "standard", filter);
        comp.canvas.getContext("2d").getImageData(0, 0, 1, 1);
      };
      const none = [];
      const colored = [];
      for (let round = 0; round < 9; round++) {
        // フィルター変更直後の一枚は定常フレーム計測から除く。
        const pair = round % 2 ? [[color, colored], ["none", none]] : [["none", none], [color, colored]];
        for (const [filter, samples] of pair) {
          compose(filter);
          samples.push(measure(() => compose(filter), 10));
        }
      }
      rows.push({ color, perFrameMs, coldMs, hitMs, composeNoneMs: median(none), composeColorMs: median(colored), extraComposeMs: median(colored) - median(none) });
    }
    comp.destroy(); cache.clear(); bitmap.close();
    return { userAgent: navigator.userAgent, resolution: "1920x1080", samples: 15, rows };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await server.close();
}
