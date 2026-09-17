import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "scripts", "og.html");
const out = path.join(root, "public", "og.png");
const chrome = process.env.CHROME_PATH || "google-chrome";

const html = await readFile(htmlPath);
const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/og.html") {
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
const url = `http://127.0.0.1:${port}/og.html`;

const work = await mkdtemp(path.join(tmpdir(), "anone-og-"));
const shot = path.join(work, "og.png");
const profile = path.join(work, "chrome-profile");

const args = [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-features=Translate,MediaRouter,OptimizationHints",
  "--force-device-scale-factor=2",
  "--window-size=1200,630",
  "--virtual-time-budget=8000",
  "--timeout=20000",
  "--run-all-compositor-stages-before-draw",
  `--user-data-dir=${profile}`,
  `--screenshot=${shot}`,
  url,
];

try {
  await new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "inherit", "inherit"] });
    const killTimer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 25000);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(killTimer);
      if (code === 0 || code === null) resolve();
      else reject(new Error(`chrome exited ${code}`));
    });
  });
  await copyFile(shot, out);
  const info = await stat(out);
  console.log(`wrote ${out} (${info.size} bytes)`);
} finally {
  server.close();
  await rm(work, { recursive: true, force: true });
}
