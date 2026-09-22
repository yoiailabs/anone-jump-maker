import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import makerSrc from "./components/MakerApp.tsx?raw";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("maker brand mark", () => {
  it("ships the wide wordmark as the maker hero title", async () => {
    const svg = await readFile(path.join(root, "public/brand/anone-logo-wide.svg"), "utf8");
    expect(svg).toContain('viewBox="0 0 600 245"');
    expect(svg).toContain("<title id=\"title\">あのねジャンプメーカー</title>");
    expect(svg).toContain('stroke="#000000"');
    expect(svg).not.toContain("#777F83");
    expect(svg).toContain('fill="#BCE7F5"');
    expect(svg).toContain("#72BEDB");
    expect(svg).toContain('fill="#244A62"');
    expect(makerSrc).toContain('src="/brand/anone-logo-wide.svg"');
    expect(makerSrc).toContain('id="makerTitle"');
    expect(makerSrc).toContain('alt={t(locale, "makerTitle")}');
    expect(makerSrc).not.toMatch(/anone-logo-(stacked|tall|square|compact)/);
  });
});
