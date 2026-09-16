import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { parseStatsCount, sanitizeGenerateAttrs, type GenerateEvent } from "./src/stats-shared.ts";

function statsDevPlugin(): Plugin {
  const events: GenerateEvent[] = [];
  return {
    name: "anone-stats-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/api/stats" && req.method === "GET") {
          writeJson(res, 200, { count: events.length });
          return;
        }
        if (url === "/api/stats/generate" && req.method === "POST") {
          void readJsonBody(req).then((body) => {
            events.push({
              createdAt: new Date().toISOString(),
              ...sanitizeGenerateAttrs(body),
            });
            writeJson(res, 200, { count: events.length });
          });
          return;
        }
        next();
      });
    },
  };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text) as unknown);
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function writeJson(res: ServerResponse, status: number, body: { count: number }): void {
  const payload = { count: parseStatsCount(body) ?? 0 };
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [statsDevPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    sourcemap: true,
  },
});
