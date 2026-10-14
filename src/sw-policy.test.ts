import { describe, expect, it } from "vitest";
import { shouldCache } from "../public/sw-policy.js";

function request(init: { mode?: string; destination?: string } = {}) {
  return {
    mode: init.mode ?? "cors",
    destination: init.destination ?? "",
  };
}

function response(init: { ok?: boolean; type?: string; contentType?: string } = {}) {
  const contentType = init.contentType ?? "text/javascript";
  return {
    ok: init.ok ?? true,
    type: init.type ?? "basic",
    headers: { get: () => contentType },
  };
}

describe("shouldCache", () => {
  it("does not cache the SPA HTML fallback for a script URL", () => {
    expect(
      shouldCache(request({ destination: "script" }), response({ contentType: "text/html; charset=utf-8" })),
    ).toBe(false);
    expect(
      shouldCache(request(), response({ contentType: "text/html; charset=utf-8" })),
    ).toBe(false);
  });

  it("caches a real hashed script and leaves documents uncached", () => {
    expect(
      shouldCache(request({ destination: "script" }), response({ contentType: "text/javascript" })),
    ).toBe(true);
    expect(shouldCache(request({ mode: "navigate", destination: "document" }), response())).toBe(false);
    expect(shouldCache(request({ destination: "style" }), response({ contentType: "text/css" }))).toBe(true);
    expect(shouldCache(request({ destination: "style" }), response({ contentType: "text/html" }))).toBe(false);
    expect(shouldCache(request({ destination: "script" }), response({ contentType: "" }))).toBe(false);
    expect(shouldCache(request(), response({ ok: false, contentType: "text/html" }))).toBe(false);
  });
});
