import { afterEach, describe, expect, it } from "vitest";
import { applyJaPhrasePolyfill, JA_PHRASE_ZWSP, visibleJaText } from "./ja-phrase.ts";
import { t } from "./i18n.ts";

const LEDE_CSS = `
.lede { text-wrap: pretty; }
html[lang="ja"] .lede { word-break: auto-phrase; }
@supports not (word-break: auto-phrase) {
  html[lang="ja"] .lede.lede-phrased {
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
}
`;

function mountCss(): void {
  const style = document.createElement("style");
  style.textContent = LEDE_CSS;
  document.head.append(style);
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach((el) => el.remove());
  document.documentElement.removeAttribute("lang");
});

describe("Japanese lede polyfill", () => {
  it("phrases Japanese copy only when auto-phrase is unavailable", async () => {
    mountCss();
    document.documentElement.lang = "ja";
    const host = document.createElement("div");
    const p = document.createElement("p");
    p.className = "lede";
    p.textContent = t("ja", "makerOnDevice");
    host.append(p);
    document.body.append(host);

    await applyJaPhrasePolyfill(host, "ja");
    const wordBreak = getComputedStyle(p).wordBreak;
    const hasZwsp = (p.textContent ?? "").includes(JA_PHRASE_ZWSP);
    expect(visibleJaText(p.textContent ?? "")).toBe(t("ja", "makerOnDevice"));
    if (CSS.supports("word-break", "auto-phrase")) {
      expect(hasZwsp).toBe(false);
      expect(p.dataset.phraseBreak).toBeUndefined();
    } else {
      expect(hasZwsp).toBe(true);
      expect(p.dataset.phraseBreak).toBe("zwsp");
      expect(wordBreak).toBe("keep-all");
    }

    await applyJaPhrasePolyfill(host, "en");
    expect(visibleJaText(p.textContent ?? "")).toBe(t("ja", "makerOnDevice"));
  });
});
