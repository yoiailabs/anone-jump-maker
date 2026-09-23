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

const JA_COPY = [t("ja", "communityLede"), t("ja", "makerOnDevice")] as const;

describe("Japanese phrase breaks", () => {
  it("inserts ZWSP between Japanese phrases without changing visible copy", () => {
    for (const line of JA_COPY) {
      const phrased = insertJaPhraseBreaks(line, parseJaPhrases);
      expect(phrased).toContain(JA_PHRASE_ZWSP);
      expect(visibleJaText(phrased)).toBe(line);
      expect(parseJaPhrases(line).length).toBeGreaterThan(1);
    }
  });

  it("does not rewrite non-Japanese lede copy", () => {
    const line = t("en", "communityLede");
    expect(line).not.toContain(JA_PHRASE_ZWSP);
    expect(visibleJaText(line)).toBe(line);
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
    const once = insertJaPhraseBreaks(JA_COPY[0], parseJaPhrases);
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
