import {
  COMMUNITY_DOCUMENT_TITLE,
  COMMUNITY_PATH,
  isCommunityPath,
  MAKER_DOCUMENT_TITLE,
} from "./page-meta.ts";

/** メーカー本体とコミュニティページ。パスで切り替える。 */
export const APP_VIEWS = ["maker", "community"] as const;
export type AppView = (typeof APP_VIEWS)[number];

export { MAKER_DOCUMENT_TITLE, COMMUNITY_PATH };
export const TO_COMMUNITY_LABEL = "みんなの #あのねジャンプ を見る";
export const TO_MAKER_LABEL = "メーカーに戻る";

export function pathForView(view: AppView): string {
  return view === "community" ? COMMUNITY_PATH : "/";
}

export function parseHashView(hash: string): AppView {
  const raw = hash.trim().replace(/^#\/?/, "");
  return raw === "community" ? "community" : "maker";
}

export function parseAppView(input: string | Pick<Location, "pathname" | "hash">): AppView {
  if (typeof input === "string") {
    if (input.startsWith("/")) {
      const path = input.split(/[?#]/, 1)[0] ?? input;
      return isCommunityPath(path) ? "community" : "maker";
    }
    return parseHashView(input);
  }
  if (isCommunityPath(input.pathname)) return "community";
  return parseHashView(input.hash);
}

export function documentTitleForView(view: AppView, communityTitle = COMMUNITY_DOCUMENT_TITLE): string {
  return view === "community" ? communityTitle : MAKER_DOCUMENT_TITLE;
}

/** 古い `#community` / `#maker` を実パスへ寄せるときの URL。既に正規なら null。 */
export function canonicalAppUrl(loc: Pick<Location, "pathname" | "search" | "hash">): string | null {
  const view = parseAppView(loc);
  const next = `${pathForView(view)}${loc.search}`;
  const current = `${loc.pathname}${loc.search}${loc.hash}`;
  return current === next ? null : next;
}

export function appViewFromClick(
  anchor: Pick<HTMLAnchorElement, "href" | "target">,
  origin: string,
): AppView | null {
  if (anchor.target && anchor.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(anchor.href, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  if (url.pathname !== "/" && !isCommunityPath(url.pathname)) return null;
  return parseAppView({ pathname: url.pathname, hash: url.hash });
}

export function toCommunityLinkHtml(): string {
  return `<p class="hero-more"><a id="toCommunity" class="btn" href="${COMMUNITY_PATH}">${TO_COMMUNITY_LABEL}</a></p>`;
}

export function toMakerLinkHtml(id = "toMaker"): string {
  return `<p class="community-back-wrap"><a id="${id}" class="page-link" href="/">${TO_MAKER_LABEL}</a></p>`;
}
