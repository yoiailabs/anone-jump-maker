import { useEffect, useState } from "react";
import type { Locale } from "../i18n.ts";
import {
  insertJaPhraseBreaks,
  loadJaPhraseParser,
  needsJaPhrasePolyfill,
} from "../ja-phrase.ts";

type JaPhraseProps = {
  locale: Locale;
  text: string;
  className: string;
  id?: string;
  hidden?: boolean;
};

/**
 * Japanese prose. Chromium wraps with CSS auto-phrase (BudouX).
 * Other browsers get the same phrase breaks as zero-width spaces.
 */
export function JaPhrase({ locale, text, className, id, hidden }: JaPhraseProps) {
  const [body, setBody] = useState(text);

  useEffect(() => {
    setBody(text);
    if (!needsJaPhrasePolyfill(locale)) return;
    let cancelled = false;
    void loadJaPhraseParser().then((parse) => {
      if (!cancelled) setBody(insertJaPhraseBreaks(text, parse));
    });
    return () => {
      cancelled = true;
    };
  }, [locale, text]);

  const phrased = needsJaPhrasePolyfill(locale) && body !== text;
  return (
    <p
      id={id}
      className={phrased ? `${className} ja-phrase lede-phrased` : `${className} ja-phrase`}
      hidden={hidden}
      data-phrase-break={phrased ? "zwsp" : undefined}
    >
      {needsJaPhrasePolyfill(locale) ? body : text}
    </p>
  );
}
