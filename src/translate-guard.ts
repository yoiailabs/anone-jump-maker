/** Google Translate / Chrome のページ翻訳と共存するための印と DOM 更新。 */

const HTML_OPEN_TAG = /<html\b[^>]*>/i;
const TRANSLATE_NO_ATTR = /\btranslate\s*=\s*(["']?)no\1/i;
const NOTRANSLATE_CLASS = /\bclass\s*=\s*["'][^"']*\bnotranslate\b[^"']*["']/i;
const GOOGLE_NOTRANSLATE_META =
  /<meta\b[^>]*\bname\s*=\s*["']google["'][^>]*\bcontent\s*=\s*["']notranslate["'][^>]*>/i;
const GOOGLE_NOTRANSLATE_META_REVERSED =
  /<meta\b[^>]*\bcontent\s*=\s*["']notranslate["'][^>]*\bname\s*=\s*["']google["'][^>]*>/i;

export type VolatileChromeElement = {
  setAttribute: (name: string, value: string) => void;
  classList: { add: (name: string) => void };
};

export type TextTarget = {
  textContent?: string | null;
};

/**
 * ページ全体を翻訳禁止にしているか。ヒーロー等の静的コピーは翻訳できた方がよいので、
 * 出荷 HTML では false にする。
 */
export function bansDocumentTranslation(html: string): boolean {
  const open = html.match(HTML_OPEN_TAG)?.[0];
  if (!open) return false;
  const meta = GOOGLE_NOTRANSLATE_META.test(html) || GOOGLE_NOTRANSLATE_META_REVERSED.test(html);
  return TRANSLATE_NO_ATTR.test(open) && NOTRANSLATE_CLASS.test(open) && meta;
}

/** 頻繁に書き換える UI だけ翻訳ウォークから外す。 */
export function isolateVolatileChrome(el: VolatileChromeElement): void {
  el.setAttribute("translate", "no");
  el.classList.add("notranslate");
}

/**
 * 同じ文字列なら触らない。翻訳済みの <font> ラップを毎回壊して
 * MutationObserver を再入させない。
 */
export function setTextIfChanged(el: TextTarget, text: string): boolean {
  if ((el.textContent ?? "") === text) return false;
  el.textContent = text;
  return true;
}

export type SentryExceptionFrame = {
  filename?: string;
  abs_path?: string;
  function?: string;
  lineno?: number;
};

export type SentryExceptionEvent = {
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: { frames?: SentryExceptionFrame[] };
    }>;
  };
};

const STACK_OVERFLOW = /Maximum call stack size exceeded/i;
const MINIFIED_PAIR = /^[A-Za-z]{2}$/;
const FIRST_PARTY_SCRIPT = /\.m?js$/i;
const FIRST_PARTY_ASSETS = /\/assets\//i;

/**
 * 本番 ANONE-JUMP-MAKER-Y: iOS が翻訳スクリプトの Ok↔Qk 相互再帰を
 * ドキュメント URL に付け替えた RangeError。first-party の /assets/*.js は落とさない。
 */
export function isTranslatorCallStackOverflow(event: SentryExceptionEvent): boolean {
  const ex = event.exception?.values?.[0];
  if (ex?.type !== "RangeError") return false;
  if (!STACK_OVERFLOW.test(ex.value ?? "")) return false;
  const frames = ex.stacktrace?.frames ?? [];
  if (frames.some((frame) => isFirstPartyScriptFrame(frame))) return false;
  const names: string[] = [];
  for (const frame of frames) {
    const name = frame.function;
    if (!name || isAnonymousFrame(name)) continue;
    names.push(name);
  }
  return isAlternatingMinifiedPair(names);
}

function isAnonymousFrame(name: string): boolean {
  return name === "?" || name === "<anonymous>" || name === "global code";
}

function isFirstPartyScriptFrame(frame: SentryExceptionFrame): boolean {
  const file = frame.filename ?? frame.abs_path ?? "";
  if (!file) return false;
  const path = file.split("?")[0] ?? "";
  return FIRST_PARTY_SCRIPT.test(path) || FIRST_PARTY_ASSETS.test(path);
}

function isAlternatingMinifiedPair(names: readonly string[]): boolean {
  if (names.length < 8) return false;
  const unique = [...new Set(names)];
  if (unique.length !== 2) return false;
  if (!unique.every((name) => MINIFIED_PAIR.test(name))) return false;
  const [first, second] = names;
  if (!first || !second || first === second) return false;
  return names.every((name, index) => name === (index % 2 === 0 ? first : second));
}
