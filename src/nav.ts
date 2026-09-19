/** メーカー本体とコミュニティページ。ハッシュだけで切り替える。 */
export const APP_VIEWS = ["maker", "community"] as const;
export type AppView = (typeof APP_VIEWS)[number];

export const MAKER_DOCUMENT_TITLE = "あのねジャンプメーカー";
export const TO_COMMUNITY_LABEL = "みんなの #あのねジャンプ を見る";
export const TO_MAKER_LABEL = "メーカーに戻る";

export function parseAppView(hash: string): AppView {
  const raw = hash.trim().replace(/^#\/?/, "");
  return raw === "community" ? "community" : "maker";
}

export function hashForView(view: AppView): string {
  return view === "community" ? "#community" : "#maker";
}

export function documentTitleForView(view: AppView, communityTitle: string): string {
  return view === "community" ? communityTitle : MAKER_DOCUMENT_TITLE;
}

export function toCommunityLinkHtml(): string {
  return `<p class="hero-more"><a id="toCommunity" href="#community">${TO_COMMUNITY_LABEL}</a></p>`;
}

export function toMakerLinkHtml(): string {
  return `<p class="community-back-wrap"><a id="toMaker" href="#maker">${TO_MAKER_LABEL}</a></p>`;
}
