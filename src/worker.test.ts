import { describe, expect, it } from "vitest";
import worker from "../worker/index.ts";

describe("worker fetch", () => {
  it("returns 404 because static assets are served by wrangler [assets]", async () => {
    const response = await worker.fetch();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
