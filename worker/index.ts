/**
 * 静的アセットは wrangler の [assets] が配信する。
 * `/community` は Astro が `community/index.html` を書き出すので Worker は触らない。
 */
export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
};
