import type { Locale } from "./messages.ts";

/** BudouX / CSS auto-phrase の改行機会（U+200B ZERO WIDTH SPACE）。 */
export const JA_PHRASE_ZWSP = "\u200b";

export type CssSupports = {
  supports: (property: string, value: string) => boolean;
};

export function supportsCssAutoPhrase(
  css: CssSupports | undefined = typeof CSS === "undefined" ? undefined : CSS,
): boolean {
  return typeof css?.supports === "function" && css.supports("word-break", "auto-phrase");
}

export function needsJaPhrasePolyfill(
  locale: Locale,
  css: CssSupports | undefined = typeof CSS === "undefined" ? undefined : CSS,
): boolean {
  return locale === "ja" && !supportsCssAutoPhrase(css);
}

export function visibleJaText(text: string): string {
  return text.replaceAll(JA_PHRASE_ZWSP, "");
}

export function insertJaPhraseBreaks(text: string, parse: (text: string) => string[]): string {
  const visible = visibleJaText(text);
  if (!visible) return visible;
  return parse(visible).join(JA_PHRASE_ZWSP);
}

let parserPromise: Promise<(text: string) => string[]> | undefined;

export function loadJaPhraseParser(): Promise<(text: string) => string[]> {
  parserPromise ??= import("./ja-parser.ts").then((mod) => mod.parseJaPhrases);
  return parserPromise;
}

const TEXT_NODE = 3;

export function phraseBreakElement(el: ParentNode, parse: (text: string) => string[]): void {
  const visit = (node: ChildNode): void => {
    if (node.nodeType === TEXT_NODE) {
      const current = node.textContent ?? "";
      const visible = visibleJaText(current);
      if (!visible) return;
      const next = insertJaPhraseBreaks(visible, parse);
      if (next !== current) node.textContent = next;
      return;
    }
    for (const child of [...node.childNodes]) visit(child);
  };
  for (const child of [...el.childNodes]) visit(child);
}

export async function applyJaPhrasePolyfill(root: ParentNode, locale: Locale): Promise<void> {
  if (!needsJaPhrasePolyfill(locale)) return;
  const targets = [...root.querySelectorAll<HTMLElement>(".lede")];
  if (targets.length === 0) return;
  const parse = await loadJaPhraseParser();
  for (const el of targets) {
    phraseBreakElement(el, parse);
    el.classList.add("lede-phrased");
    el.dataset.phraseBreak = "zwsp";
  }
}
