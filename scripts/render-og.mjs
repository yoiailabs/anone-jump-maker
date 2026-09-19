import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "scripts", "og.html");
const html = await readFile(htmlPath);
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
    await page.goto(`http://127.0.0.1:${port}/og.html?locale=${locale}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: out, type: "png" });
    const info = await stat(out);
    console.log(`wrote ${out} (${info.size} bytes)`);
  }
} finally {
  await browser.close();
  server.close();
}
