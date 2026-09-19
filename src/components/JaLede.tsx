import { Fragment, useEffect, useState } from "react";
import { t, type Locale } from "../i18n.ts";
import {
  insertJaPhraseBreaks,
  JA_PHRASE_ZWSP,
  loadJaPhraseParser,
  needsJaPhrasePolyfill,
} from "../ja-phrase.ts";

export function JaLede({ locale }: { locale: Locale }) {
  const line1 = t(locale, "makerLede1");
  const line2 = t(locale, "makerLede2");
  const line3 = t(locale, "makerLede3");
  const [lines, setLines] = useState([line1, line2, line3]);
  const polyfill = needsJaPhrasePolyfill(locale);

  useEffect(() => {
    if (!polyfill) {
      setLines([line1, line2, line3]);
      return;
    }
    let cancelled = false;
    void loadJaPhraseParser()
      .then((parse) => {
        if (cancelled) return;
        setLines([line1, line2, line3].map((line) => insertJaPhraseBreaks(line, parse)));
      })
      .catch(() => {
        if (!cancelled) setLines([line1, line2, line3]);
      });
    return () => {
      cancelled = true;
    };
  }, [polyfill, line1, line2, line3]);

  const phrased = lines.some((line) => line.includes(JA_PHRASE_ZWSP));
  const phraseBreak = locale === "ja" ? (phrased ? "zwsp" : "css") : "none";

  return (
    <p className={phrased ? "lede lede-phrased" : "lede"} data-phrase-break={phraseBreak}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </p>
  );
}
