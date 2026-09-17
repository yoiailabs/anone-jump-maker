import { parseStatsCount, statsObjectName } from "../src/stats-shared.ts";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    // 本番ではこのホストがカスタムドメインか Preview URL（<alias>-anone.<sub>.workers.dev）になる。
    // wrangler dev は routes のドメインに書き換えるので、ローカルは常に本番名の件数を使う。
    const host = url.hostname;
    if (url.pathname === "/api/stats" && request.method === "GET") {
      return proxyStats(env, host, "GET", "/count");
    }
    if (url.pathname === "/api/stats/generate" && request.method === "POST") {
      return proxyStats(env, host, "POST", "/record", request);
    }
    return new Response("Not found", { status: 404 });
  },
};

/**
 * `anone-stats` Worker の Durable Object へ中継する。
 * バインディングが無い（`anone-stats` がまだ無い環境）ときは 502 を返し、
 * クライアントは「—回作られたよ」のまま動く。
 */
async function proxyStats(
  env: WorkerEnv,
  hostname: string,
  method: string,
  path: string,
  incoming?: Request,
): Promise<Response> {
  const namespace = env.GENERATE_STATS;
  if (!namespace) {
    return json({ error: "stats unavailable" }, 502);
  }
  const init: RequestInit = { method };
  if (incoming && method === "POST") {
    init.headers = { "content-type": "application/json" };
    init.body = await incoming.text();
  }
  try {
    const stub = namespace.get(namespace.idFromName(statsObjectName(hostname)));
    const response = await stub.fetch(new Request(`https://stats${path}`, init));
    const payload = await response.json().catch(() => null);
    const count = parseStatsCount(payload);
    if (!response.ok || count === null) {
      return json({ error: "stats unavailable" }, 502);
    }
    return json({ count });
  } catch {
    return json({ error: "stats unavailable" }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
