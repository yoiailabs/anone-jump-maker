/**
 * 200 の HTML をスクリプト URL にキャッシュしない。
 * SPA が無い `/_astro/*.js` を index.html で返すと、写真選択の listener が付かない。
 */
export function shouldCache(request, response) {
  if (!response.ok || response.type !== "basic") return false;
  if (request.mode === "navigate" || request.destination === "document") return false;
  const type = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("text/html")) return false;
  if (request.destination === "script" || request.destination === "worker") {
    return type.includes("javascript") || type.includes("ecmascript");
  }
  if (request.destination === "style") return type.includes("text/css");
  return true;
}
