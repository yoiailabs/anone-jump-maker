import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");
const chrome =
  process.env.CHROME_PATH ||
  ["/opt/google/chrome/chrome", "/usr/bin/google-chrome"].find((candidate) => {
    try {
      return spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0;
    } catch {
      return false;
    }
  });

if (!chrome) {
  throw new Error("Chrome not found. Set CHROME_PATH.");
}

const jobs = [
  { svg: "icon.svg", file: "icon-192.png", size: 192 },
  { svg: "icon.svg", file: "icon-512.png", size: 512 },
  { svg: "icon-maskable.svg", file: "icon-maskable-512.png", size: 512 },
  { svg: "icon.svg", file: "apple-touch-icon.png", size: 180 },
];

const svgs = Object.fromEntries(
  await Promise.all(
    [...new Set(jobs.map((job) => job.svg))].map(async (name) => [
      name,
      (await readFile(path.join(outDir, name))).toString(),
    ]),
  ),
);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const job of jobs) {
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: ${job.size}px; height: ${job.size}px; background: #F6EFE2; overflow: hidden; }
      svg { display: block; width: ${job.size}px; height: ${job.size}px; }
    </style>
  </head>
  <body>${svgs[job.svg]}</body>
</html>`);
    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: job.size, height: job.size },
      omitBackground: false,
    });
    const { width, height } = pngSize(png);
    if (width !== job.size || height !== job.size) {
      throw new Error(`${job.file} is ${width}x${height}, expected ${job.size}x${job.size}`);
    }
    await writeFile(path.join(outDir, job.file), png);
    console.log(`wrote ${job.file} (${png.length} bytes)`);
    await page.close();
  }
} finally {
  await browser.close();
}

function pngSize(buf) {
  if (buf.length < 24 || buf.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error("not a PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
