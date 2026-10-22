/** 他のビルド・ブラウザ検証と同時に動かさず、ブラウザごとに実行する。 */
import { createServer } from "vite";
import { chromium, webkit } from "playwright";

const name = process.env.ANONE_BROWSER;
if (name !== "chromium" && name !== "webkit") throw new Error("Set ANONE_BROWSER to chromium or webkit");
const server = await createServer({ configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
const browser = await ({ chromium, webkit })[name].launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const result = await page.evaluate(async () => {
    const { applySoftwareBlur } = await import("/src/blur.ts");
    const { applyLegacyBlur } = await import("/src/test-support/legacy-blur.ts");
    const { filterBlurPx } = await import("/src/layout.ts");
    const surface = (width, height, read = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      // compositor.ts と同じ、不透明な写真層と readback 用 scratch。
      return { canvas, ctx: canvas.getContext("2d", { alpha: false, willReadFrequently: read }) };
    };
    const median = (values) => {
      const sorted = values.slice().sort((a, b) => a - b);
      return (sorted[14] + sorted[15]) / 2;
    };
    const rows = [];
    for (const long of [640, 1920]) {
      const height = long * 9 / 16;
      const source = surface(long, height);
      const image = source.ctx.createImageData(long, height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = (i * 17) % 251;
        image.data[i + 1] = (i * 31) % 253;
        image.data[i + 2] = (i * 47) % 255;
        image.data[i + 3] = 255;
      }
      source.ctx.putImageData(image, 0, 0);
      for (const filter of ["blur-weak", "blur-strong"]) {
        // 旧側のリサイズで新版のバッファを壊さないよう、経路ごとに確保する。
        const paths = {
          old: { target: surface(long, height), scratch: surface(1, 1, true), blur: applyLegacyBlur, px: Math.max(2, Math.round(long * (filter === "blur-weak" ? 0.005 : 0.011))) },
          current: { target: surface(long, height), scratch: surface(1, 1, true), blur: applySoftwareBlur, px: filterBlurPx(filter, long) },
        };
        const samples = { old: [], current: [] };
        for (let frame = 0; frame < 35; frame++) {
          // 5回ウォームアップし、順序も交互に変えて各30回の中央値を取る。
          for (const key of frame % 2 ? ["current", "old"] : ["old", "current"]) {
            const { target, scratch, blur, px } = paths[key];
            target.ctx.drawImage(source.canvas, 0, 0);
            const start = performance.now();
            blur(target.canvas, target.ctx, scratch.canvas, scratch.ctx, px);
            // 両経路の遅延描画を同じ1画素readbackで完了させる。
            target.ctx.getImageData(long / 2, height / 2, 1, 1);
            if (frame >= 5) samples[key].push(performance.now() - start);
          }
        }
        const oldMs = median(samples.old);
        const currentMs = median(samples.current);
        rows.push({ long, filter, oldMs, currentMs, ratio: currentMs / oldMs, samples });
        for (const { target, scratch } of Object.values(paths)) target.canvas.width = target.canvas.height = scratch.canvas.width = scratch.canvas.height = 0;
      }
      source.canvas.width = source.canvas.height = 0;
    }
    return { userAgent: navigator.userAgent, warmup: 5, samples: 30, rows };
  });
  console.log(JSON.stringify({ browser: name, ...result }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
