import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJaPhrases } from "./ja-parser.ts";
import {
  insertJaPhraseBreaks,
  JA_PHRASE_ZWSP,
  needsJaPhrasePolyfill,
  supportsCssAutoPhrase,
  visibleJaText,
} from "./ja-phrase.ts";
import { t } from "./i18n.ts";
import jaParserSrc from "./ja-parser.ts?raw";
import jaPhraseSrc from "./ja-phrase.ts?raw";

const stylesSrc = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

const JA_LEDE = [t("ja", "makerLede1"), t("ja", "makerLede2"), t("ja", "makerLede3")] as const;
const EN_LEDE = [t("en", "makerLede1"), t("en", "makerLede2"), t("en", "makerLede3")] as const;

describe("Japanese phrase breaks", () => {
  it("keeps the maker lede wording exactly", () => {
    expect(JA_LEDE).toEqual([
      "写真を何枚か選択するだけで簡単に「あのねジャンプ」動画が作れます。",
      "動画生成はすべて端末内で完結するため、外部のサーバーに画像が送信されることはありません。",
      "※ファン制作の非公式アプリです。",
    ]);
  });

  it("inserts ZWSP between Japanese phrases without changing visible copy", () => {
    for (const line of JA_LEDE) {
      const phrased = insertJaPhraseBreaks(line, parseJaPhrases);
      expect(phrased).toContain(JA_PHRASE_ZWSP);
      expect(visibleJaText(phrased)).toBe(line);
      expect(parseJaPhrases(line).length).toBeGreaterThan(1);
    }
    const community = t("ja", "communityLede");
    const phrasedCommunity = insertJaPhraseBreaks(community, parseJaPhrases);
    expect(phrasedCommunity).toContain(JA_PHRASE_ZWSP);
    expect(visibleJaText(phrasedCommunity)).toBe(community);
  });

  it("does not rewrite non-Japanese lede copy", () => {
    for (const line of EN_LEDE) {
      expect(line).not.toContain(JA_PHRASE_ZWSP);
      expect(visibleJaText(line)).toBe(line);
    }
    expect(needsJaPhrasePolyfill("en")).toBe(false);
    expect(needsJaPhrasePolyfill("ko")).toBe(false);
    expect(needsJaPhrasePolyfill("zh")).toBe(false);
  });

  it("polyfills Japanese only when CSS auto-phrase is missing", () => {
    expect(needsJaPhrasePolyfill("ja")).toBe(true);
    expect(supportsCssAutoPhrase({ supports: () => false })).toBe(false);
    expect(supportsCssAutoPhrase({ supports: (property, value) => property === "word-break" && value === "auto-phrase" })).toBe(
      true,
    );
    expect(
      needsJaPhrasePolyfill("ja", {
        supports: (property, value) => property === "word-break" && value === "auto-phrase",
      }),
    ).toBe(false);
  });

  it("is idempotent when ZWSP is already present", () => {
    const once = insertJaPhraseBreaks(JA_LEDE[0], parseJaPhrases);
    expect(insertJaPhraseBreaks(once, parseJaPhrases)).toBe(once);
  });

  it("scopes auto-phrase CSS to Japanese and keep-all to the polyfill class", () => {
    expect(stylesSrc).toMatch(/\.lede\s*\{[^}]*text-wrap:\s*pretty/);
    expect(stylesSrc).toMatch(/html\[lang="ja"\]\s*\.lede\s*\{[^}]*word-break:\s*auto-phrase/);
    expect(stylesSrc).toMatch(/@supports not \(word-break:\s*auto-phrase\)/);
    expect(stylesSrc).toMatch(/html\[lang="ja"\]\s*\.lede\.lede-phrased\s*\{[^}]*word-break:\s*keep-all/);
    expect(stylesSrc).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("lazy-loads only the Japanese parser", () => {
    expect(jaParserSrc).toContain('from "budoux"');
    expect(jaParserSrc).toContain("jaModel");
    expect(jaParserSrc).not.toContain("zhHansModel");
    expect(jaParserSrc).not.toContain("loadDefaultThaiParser");
    expect(jaPhraseSrc).toContain('import("./ja-parser.ts")');
    expect(jaPhraseSrc).not.toContain("from \"budoux\"");
  });
});
