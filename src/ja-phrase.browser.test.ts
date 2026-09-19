import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { JaLede } from "./components/JaLede.tsx";
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

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

function mountCss(): void {
  const style = document.createElement("style");
  style.textContent = LEDE_CSS;
  document.head.append(style);
}

async function mountLede(locale: "ja" | "en"): Promise<HTMLParagraphElement> {
  mountCss();
  document.documentElement.lang = locale;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(JaLede, { locale }));
  });
  return vi.waitFor(() => {
    const el = host.querySelector<HTMLParagraphElement>(".lede");
    expect(el).toBeTruthy();
    return el!;
  });
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach((el) => el.remove());
  document.documentElement.removeAttribute("lang");
});

describe("JaLede phrase wrapping", () => {
  it("gives the Japanese maker lede a phrase-break opportunity without changing copy", async () => {
    const el = await mountLede("ja");
    const expected =
      t("ja", "makerLede1") + t("ja", "makerLede2") + t("ja", "makerLede3");
    await act(async () => {
      await vi.waitFor(() => {
        const text = el.textContent ?? "";
        expect(visibleJaText(text)).toBe(expected);
        const wordBreak = getComputedStyle(el).wordBreak;
        const hasZwsp = text.includes(JA_PHRASE_ZWSP);
        const autoPhrase = wordBreak === "auto-phrase";
        expect(hasZwsp || autoPhrase).toBe(true);
        if (autoPhrase) {
          expect(hasZwsp).toBe(false);
          expect(el.dataset.phraseBreak).toBe("css");
        } else {
          expect(hasZwsp).toBe(true);
          expect(el.classList.contains("lede-phrased")).toBe(true);
          expect(el.dataset.phraseBreak).toBe("zwsp");
          expect(wordBreak).toBe("keep-all");
        }
      });
    });
  });

  it("leaves English lede wrapping and copy unchanged", async () => {
    const el = await mountLede("en");
    const expected =
      t("en", "makerLede1") + t("en", "makerLede2") + t("en", "makerLede3");
    expect(el.textContent).toBe(expected);
    expect(el.textContent).not.toContain(JA_PHRASE_ZWSP);
    expect(el.dataset.phraseBreak).toBe("none");
    expect(getComputedStyle(el).wordBreak).not.toBe("auto-phrase");
    expect(el.classList.contains("lede-phrased")).toBe(false);
  });
});

describe("community lede polyfill", () => {
  it("phrases Japanese community lede only when auto-phrase is unavailable", async () => {
    mountCss();
    document.documentElement.lang = "ja";
    const host = document.createElement("div");
    const p = document.createElement("p");
    p.className = "lede";
    p.textContent = t("ja", "communityLede");
    host.append(p);
    document.body.append(host);

    await applyJaPhrasePolyfill(host, "ja");
    const wordBreak = getComputedStyle(p).wordBreak;
    const hasZwsp = (p.textContent ?? "").includes(JA_PHRASE_ZWSP);
    expect(visibleJaText(p.textContent ?? "")).toBe(t("ja", "communityLede"));
    if (CSS.supports("word-break", "auto-phrase")) {
      expect(hasZwsp).toBe(false);
      expect(p.dataset.phraseBreak).toBeUndefined();
    } else {
      expect(hasZwsp).toBe(true);
      expect(p.dataset.phraseBreak).toBe("zwsp");
      expect(wordBreak).toBe("keep-all");
    }

    await applyJaPhrasePolyfill(host, "en");
    expect(visibleJaText(p.textContent ?? "")).toBe(t("ja", "communityLede"));
  });
});
