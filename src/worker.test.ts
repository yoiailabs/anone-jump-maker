import { describe, expect, it } from "vitest";
import worker from "../worker/index.ts";

describe("worker fetch", () => {
  it("returns 404 so wrangler [assets] can serve Astro HTML", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("does not intercept /community; static community HTML carries OGP", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/community"));
    expect(response.status).toBe(404);
  });
});
