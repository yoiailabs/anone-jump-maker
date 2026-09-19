/** メーカー本体とコミュニティページ。ハッシュだけで切り替える。 */
export const APP_VIEWS = ["maker", "community"] as const;
export type AppView = (typeof APP_VIEWS)[number];

export const TAB_MAKER_LABEL = "メーカー";
export const TAB_COMMUNITY_LABEL = "みんなのジャンプ";
export const MAKER_DOCUMENT_TITLE = "あのねジャンプメーカー";

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

export function appTabsHtml(): string {
  return `
    <nav class="app-tabs" aria-label="ページ">
      <a class="app-tab" id="tabMaker" href="#maker">${TAB_MAKER_LABEL}</a>
      <a class="app-tab" id="tabCommunity" href="#community">${TAB_COMMUNITY_LABEL}</a>
    </nav>
  `;
}

export function syncAppTabs(root: ParentNode, view: AppView): void {
  const maker = root.querySelector("#tabMaker");
  const community = root.querySelector("#tabCommunity");
  maker?.setAttribute("aria-current", view === "maker" ? "page" : "false");
  community?.setAttribute("aria-current", view === "community" ? "page" : "false");
}
