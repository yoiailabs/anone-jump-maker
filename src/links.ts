import { DEFAULT_LOCALE, t, type Locale, type MessageKey } from "./i18n.ts";

/** 公式「あのね」MV。上部 JumpLoop と公式欄の埋め込みで同じ ID を使う。 */
export const OFFICIAL_MV_VIDEO_ID = "M-IayQIR0XA";
export const OFFICIAL_MV_WATCH_HREF = `https://www.youtube.com/watch?v=${OFFICIAL_MV_VIDEO_ID}`;
export const OFFICIAL_MV_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${OFFICIAL_MV_VIDEO_ID}`;

/** トップのサムネイル（JumpLoop）を開いたとき、公式MVをこの秒から再生する。 */
export const JUMP_LOOP_START_SECONDS = 60;

/**
 * YouTube の視聴 URL に再生開始秒を足す。
 * `youtube.com/watch` は `t=60s`、`youtu.be` は `t=60`。
 * 既存のクエリは値も並びもそのまま残し、開始秒（`t`）だけを差し替える。
 */
export function youtubePlaybackUrl(href: string, startSeconds: number): string {
  const url = new URL(href);
  const short = url.hostname.toLowerCase().replace(/^www\./, "") === "youtu.be";
  const value = short ? String(startSeconds) : `${startSeconds}s`;

  const hashIndex = href.indexOf("#");
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);
  const parts = query === "" ? [] : query.split("&");

  let replaced = false;
  const next = parts.flatMap((part) => {
    if (part.split("=", 1)[0] !== "t") return [part];
    if (replaced) return [];
    replaced = true;
    return [`t=${value}`];
  });
  if (!replaced) next.push(`t=${value}`);
  return `${path}?${next.join("&")}${hash}`;
}

export const JUMP_LOOP_WATCH_HREF = youtubePlaybackUrl(OFFICIAL_MV_WATCH_HREF, JUMP_LOOP_START_SECONDS);

/** 画面最下部に置くナナツカゼさんの公式リンク。ファン制作なので出典として並べる。 */
export type OfficialLink = {
  /** CSS のアクセント色とアイコンの引き当てに使う。 */
  readonly id: "x" | "instagram" | "youtube" | "tiktok" | "spotify" | "apple-music";
  readonly label: string;
  readonly href: string;
};

export const OFFICIAL_LINKS: readonly OfficialLink[] = [
  { id: "x", label: "X", href: "https://x.com/Nanatsukaze_ofc" },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/nanatsukaze_/" },
  { id: "youtube", label: "YouTube", href: "https://www.youtube.com/@Nanatsukaze_" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@nanatsukaze_ofc" },
  {
    id: "spotify",
    label: "Spotify",
    href: "https://open.spotify.com/artist/66icuwRNOsZJv6UCTsP0KH",
  },
  {
    id: "apple-music",
    label: "Apple Music",
    href: "https://music.apple.com/jp/artist/nanatsukaze/1685618009",
  },
];

/* 公式ロゴそのままではなく、テンプレに寄せた太線のアイコンを自分で描く。 */
const ICONS: Record<OfficialLink["id"], string> = {
  x: '<path d="M6 6 18 18M18 6 6 18" />',
  instagram:
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" /><circle cx="12" cy="12.1" r="3.5" /><circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" />',
  youtube:
    '<rect x="2.6" y="5" width="18.8" height="14" rx="4.2" /><path d="M10.6 9.3 15.8 12 10.6 14.7Z" fill="currentColor" />',
  tiktok:
    '<path d="M10.2 7.4v8.8" /><circle cx="8" cy="16.6" r="2.4" /><path d="M10.2 7.4c1.8 1.5 4 2.4 6.4 2.5V6.8c-2.1 0-4.2-.7-6-2" />',
  spotify:
    '<circle cx="12" cy="12" r="9" /><path d="M7.1 9.2c3.2-.9 6.6-.4 9.2 1.3M7.7 12.5c2.6-.7 5.4-.3 7.6 1M8.4 15.6c2-.5 4.1-.2 5.8.8" />',
  "apple-music":
    '<path d="M9.6 16.4V6.6l7-1.5v9.3" /><circle cx="7" cy="16.7" r="2.6" /><circle cx="14.2" cy="14.8" r="2.6" />',
};

export function linkBannersHtml(
  links: readonly OfficialLink[] = OFFICIAL_LINKS,
  locale: Locale = DEFAULT_LOCALE,
  ariaKey: MessageKey = "makerLinkAria",
): string {
  return links
    .map(
      (link) => `
        <li>
          <a
            class="link-banner"
            data-service="${link.id}"
            href="${link.href}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="${t(locale, ariaKey, { label: link.label })}"
          >
            <svg class="link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[link.id]}</svg>
            <span>${link.label}</span>
          </a>
        </li>`,
    )
    .join("");
}
