/**
 * 静的アセットは wrangler の [assets] が配信する。
 * 生成回数 API / Durable Object は無料枠を消費していたため置かない。
 */
export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
};
