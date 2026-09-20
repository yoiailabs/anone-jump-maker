import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "../i18n.ts";
import { OFFICIAL_MV_EMBED_SRC } from "../links.ts";
import { whenNearViewport } from "../reactions.ts";

type OfficialMvEmbedProps = {
  locale: Locale;
};

/**
 * 公式リンク欄の末尾に置く「あのね」MV。
 * 画面に入るまで iframe を載せない（反応ウィジェットと同じ PageSpeed 寄せ）。
 */
export function OfficialMvEmbed({ locale }: OfficialMvEmbedProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | undefined>(undefined);
  const label = t(locale, "makerOfficialMv");
  const title = t(locale, "makerOfficialMvTitle", { song: t(locale, "songTitle") });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    return whenNearViewport(frame, () => setSrc(OFFICIAL_MV_EMBED_SRC));
  }, []);

  return (
    <figure className="official-mv" id="officialMv">
      <figcaption className="official-mv-title" id="officialMvTitle">
        {label}
      </figcaption>
      <div className="official-mv-frame" ref={frameRef}>
        {src ? (
          <iframe
            id="officialMvEmbed"
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
    </figure>
  );
}
