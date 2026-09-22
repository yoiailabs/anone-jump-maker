import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "scripts", "og.html");
const brandDir = path.join(root, "public", "brand");
const html = await readFile(htmlPath);
const brandFiles = {
  "/brand/anone-logo-stacked.svg": await readFile(path.join(brandDir, "anone-logo-stacked.svg")),
  "/brand/anone-logo-stacked-en.svg": await readFile(path.join(brandDir, "anone-logo-stacked-en.svg")),
};
const includeJa = process.argv.includes("--ja");
const locales = includeJa ? ["ja", "en", "ko", "zh"] : ["en", "ko", "zh"];

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname === "/" || pathname === "/og.html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
    return;
  }
  const brand = brandFiles[pathname];
  if (brand) {
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(brand);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});

try {
  for (const locale of locales) {
    const outName = locale === "ja" ? "og.png" : `og-${locale}.png`;
    const out = path.join(root, "public", outName);
    const expectedLogo = locale === "ja" ? "anone-logo-stacked.svg" : "anone-logo-stacked-en.svg";
    await page.goto(`http://127.0.0.1:${port}/og.html?locale=${locale}`, { waitUntil: "networkidle" });
    await page.locator("img.hero-logo").waitFor();
    await page.waitForFunction((name) => {
      const img = document.querySelector("img.hero-logo");
      return img instanceof HTMLImageElement && img.src.includes(name);
    }, expectedLogo);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const img = document.querySelector("img.hero-logo");
      if (!(img instanceof HTMLImageElement)) {
        throw new Error("missing stacked logo");
      }
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", () => reject(new Error("stacked logo failed to load")), {
            once: true,
          });
        });
      }
      if (img.naturalWidth === 0) {
        throw new Error("stacked logo has no dimensions");
      }
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: out, type: "png" });
    const info = await stat(out);
    console.log(`wrote ${out} (${info.size} bytes)`);
  }
} finally {
  await browser.close();
  server.close();
}
