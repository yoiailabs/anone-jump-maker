import { sanitizeGenerateAttrs, type GenerateAttrs } from "../../src/stats-shared.ts";

/**
 * 生成イベントの Durable Object。`anone` 本体とは別の Worker（`anone-stats`）に置く。
 *
 * Durable Object クラスを実装している Worker には Cloudflare が Preview URL を作らないので、
 * 本体 `anone` からクラスを外し、ここに移してから `script_name = "anone-stats"` で参照する。
 * 既存のデータは `worker/stats/wrangler.toml` の transferred_classes で `anone` から引き継ぐ。
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS generates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  device TEXT,
  language TEXT,
  timezone TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  dpr REAL,
  export_mode TEXT,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  action TEXT
)
`;

const MIGRATE_ACTION = `ALTER TABLE generates ADD COLUMN action TEXT`;

export class GenerateStats {
  constructor(private readonly ctx: DurableObjectState) {
    this.ctx.storage.sql.exec(SCHEMA);
    try {
      this.ctx.storage.sql.exec(MIGRATE_ACTION);
    } catch {
      // already migrated
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/count") {
      return json({ count: this.count() });
    }
    if (request.method === "POST" && url.pathname === "/record") {
      const attrs = sanitizeGenerateAttrs(await readJson(request));
      this.insert(attrs, new Date().toISOString());
      return json({ count: this.count() });
    }
    return new Response("Not found", { status: 404 });
  }

  private count(): number {
    const row = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM generates").one();
    return Number(row.n) || 0;
  }

  private insert(attrs: GenerateAttrs, createdAt: string): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO generates (
        created_at, browser, os, device, language, timezone,
        screen_w, screen_h, dpr, export_mode, mime, width, height, action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createdAt,
      attrs.browser ?? null,
      attrs.os ?? null,
      attrs.device ?? null,
      attrs.language ?? null,
      attrs.timezone ?? null,
      attrs.screenW ?? null,
      attrs.screenH ?? null,
      attrs.dpr ?? null,
      attrs.exportMode ?? null,
      attrs.mime ?? null,
      attrs.width ?? null,
      attrs.height ?? null,
      attrs.action ?? null,
    );
  }
}

/** この Worker は DO の置き場所。HTTP は受けない（本体 `anone` が /api/* を処理する）。 */
export default {
  async fetch(): Promise<Response> {
    return new Response("anone-stats: Durable Object host only", { status: 404 });
  },
};

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
