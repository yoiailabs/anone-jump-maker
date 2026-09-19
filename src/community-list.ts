import {
  COMMUNITY_JUMP_POSTS,
  DEFAULT_COMMUNITY_JUMP_SORT,
  isCommunityJumpSort,
  sortCommunityJumpPosts,
  type CommunityJumpPost,
  type CommunityJumpSort,
} from "./community-jumps.ts";
import {
  DEFAULT_LOCALE,
  TWITTER_DATA_LANG,
  isLocale,
  languageNavHtml,
  t,
  type Locale,
} from "./i18n.ts";
import { linkBannersHtml, type OfficialLink } from "./links.ts";
import { toMakerLinkHtml } from "./nav.ts";
import { hydrateReactionEmbed, isEmbedHostVisible } from "./reactions.ts";

/** 1 col < 40rem、2 col ≥ 40rem、3 col ≥ 48rem（iPad 縦 / PC。.app 幅と揃える）。 */
export const COMMUNITY_MASONRY_BREAKPOINTS = {
  tablet: 640,
  wide: 768,
} as const;

/** grid-auto-rows と gap。span 計算と CSS を一致させる。 */
export const COMMUNITY_MASONRY_ROW_PX = 8;
export const COMMUNITY_MASONRY_GAP_PX = 18;

export function communityMasonryColumns(widthPx: number): 1 | 2 | 3 {
  if (!Number.isFinite(widthPx) || widthPx < COMMUNITY_MASONRY_BREAKPOINTS.tablet) return 1;
  if (widthPx < COMMUNITY_MASONRY_BREAKPOINTS.wide) return 2;
  return 3;
}

/** 交差中のカードに加え、同じ段の左右も載せる。 */
export function hydratePadForColumns(columns: number): number {
  if (!Number.isInteger(columns) || columns < 1) return 1;
  return columns;
}

export function communityMasonryRowSpan(
  heightPx: number,
  rowPx = COMMUNITY_MASONRY_ROW_PX,
  gapPx = COMMUNITY_MASONRY_GAP_PX,
): number {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return 1;
  const unit = rowPx + gapPx;
  if (unit <= 0) return 1;
  return Math.max(1, Math.ceil((heightPx + gapPx) / unit));
}

export function applyCommunityMasonryItem(
  item: HTMLElement,
  columns: number,
): void {
  if (columns <= 1) {
    item.style.gridRowEnd = "";
    return;
  }
  const card = item.querySelector<HTMLElement>(".community-jumps-card");
  const height = card?.offsetHeight ?? item.offsetHeight;
  item.style.gridRowEnd = `span ${communityMasonryRowSpan(height)}`;
}

export function applyCommunityMasonryLayout(
  list: HTMLElement,
  items: readonly HTMLElement[],
  columns: number,
): void {
  const cols = columns === 2 || columns === 3 ? columns : 1;
  list.dataset.masonryCols = String(cols);
  list.style.setProperty("--community-masonry-cols", String(cols));
  for (const item of items) {
    applyCommunityMasonryItem(item, cols);
  }
}

export const COMMUNITY_JUMPS_TITLE = t("ja", "communityTitle");
export const COMMUNITY_JUMPS_LEDE = t("ja", "communityLede");
export const COMMUNITY_JUMPS_EMPTY = t("ja", "communityEmpty");
export const MORE_JUMPS_QUERY = "#あのねジャンプ";
export const MORE_JUMPS_HREF = `https://x.com/search?q=${encodeURIComponent(MORE_JUMPS_QUERY)}`;
const HASHTAG_SLUG = MORE_JUMPS_QUERY.slice(1);

/** ページ送りの下の SNS。公式アカウントではなく #あのねジャンプ の検索・タグへ。 */
export const COMMUNITY_HASHTAG_SEARCH_LINKS: readonly OfficialLink[] = [
  { id: "x", label: "X", href: MORE_JUMPS_HREF },
  {
    id: "instagram",
    label: "Instagram",
    href: `https://www.instagram.com/explore/tags/${encodeURIComponent(HASHTAG_SLUG)}/`,
  },
  {
    id: "youtube",
    label: "YouTube",
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(MORE_JUMPS_QUERY)}`,
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: `https://www.tiktok.com/tag/${encodeURIComponent(HASHTAG_SLUG)}`,
  },
];

export function communityHashtagSearchHtml(locale: Locale = DEFAULT_LOCALE): string {
  return `
    <nav class="community-hashtag-search" aria-label="${t(locale, "communityHashtagSearchNav")}">
      <p class="community-hashtag-search-lede" id="communityHashtagSearchHeading">${t(locale, "communityHashtagSearchLede")}</p>
      <ul class="link-banners" id="communityHashtagSearch">
        ${linkBannersHtml(COMMUNITY_HASHTAG_SEARCH_LINKS, locale, "communityHashtagSearchAria")}
      </ul>
    </nav>
  `;
}

/** 1ページの件数。無限スクロールにはしない。 */
export const COMMUNITY_JUMP_PAGE_SIZE = 50;
export const DEFAULT_COMMUNITY_JUMP_PAGE = 1;

export function communityJumpPageCount(
  total: number,
  pageSize = COMMUNITY_JUMP_PAGE_SIZE,
): number {
  if (!Number.isInteger(total) || total <= 0) return 0;
  if (!Number.isInteger(pageSize) || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

export function clampCommunityJumpPage(
  page: number,
  total: number,
  pageSize = COMMUNITY_JUMP_PAGE_SIZE,
): number {
  const pages = communityJumpPageCount(total, pageSize);
  if (pages <= 0) return DEFAULT_COMMUNITY_JUMP_PAGE;
  if (!Number.isInteger(page) || page < 1) return DEFAULT_COMMUNITY_JUMP_PAGE;
  return Math.min(page, pages);
}

export function communityJumpPagePosts<T>(
  posts: readonly T[],
  page: number,
  pageSize = COMMUNITY_JUMP_PAGE_SIZE,
): T[] {
  const current = clampCommunityJumpPage(page, posts.length, pageSize);
  const start = (current - 1) * pageSize;
  return posts.slice(start, start + pageSize);
}

/** 画面の少し外まで先読みする余白。埋め込みが伸びても後続を取りこぼさない。 */
export const HYDRATE_ROOT_MARGIN_PX = 640;

/** 交差中のカードと上下 pad 件だけ widgets.js を載せる。 */
export function hydrateIndexes(
  intersecting: readonly number[],
  length: number,
  pad = 1,
): readonly number[] {
  const want = new Set<number>();
  for (const index of intersecting) {
    if (!Number.isInteger(index)) continue;
    for (let i = index - pad; i <= index + pad; i += 1) {
      if (i >= 0 && i < length) want.add(i);
    }
  }
  return [...want].sort((a, b) => a - b);
}

/** 一度近づいたカードは忘れない。IO が空振りしても後続を落とさない。 */
export function rememberHydrateIndexes(
  remembered: Iterable<number>,
  incoming: readonly number[],
  length: number,
  pad = 1,
): readonly number[] {
  const seen = new Set<number>();
  for (const index of remembered) {
    if (Number.isInteger(index) && index >= 0 && index < length) seen.add(index);
  }
  for (const index of hydrateIndexes(incoming, length, pad)) {
    seen.add(index);
  }
  return [...seen].sort((a, b) => a - b);
}

type MeasurableItem = {
  dataset: { logical?: string };
  getBoundingClientRect: () => Pick<DOMRect, "top" | "bottom" | "width" | "height">;
};

export function visibleLogicalIndexes(
  items: readonly MeasurableItem[],
  viewportHeight: number,
  marginPx = HYDRATE_ROOT_MARGIN_PX,
): readonly number[] {
  const top = -marginPx;
  const bottom = viewportHeight + marginPx;
  const found: number[] = [];
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.bottom < top || rect.top > bottom) continue;
    const logical = Number(item.dataset.logical);
    if (Number.isInteger(logical)) found.push(logical);
  }
  return found;
}

/** 一覧の下端が近いときは残り全部を載せる。hidden で潰れた箱は無視する。 */
export function shouldHydrateRemaining(
  box: Pick<DOMRect, "bottom" | "height" | "width">,
  viewportHeight: number,
  marginPx = HYDRATE_ROOT_MARGIN_PX,
): boolean {
  if (box.width <= 0 || box.height <= 0) return false;
  return box.bottom <= viewportHeight + marginPx;
}

export function communityJumpsSectionHtml(
  posts: readonly CommunityJumpPost[] = COMMUNITY_JUMP_POSTS,
  locale: Locale = DEFAULT_LOCALE,
  sort: CommunityJumpSort = DEFAULT_COMMUNITY_JUMP_SORT,
  page: number = DEFAULT_COMMUNITY_JUMP_PAGE,
): string {
  const ordered = sortCommunityJumpPosts(posts, sort);
  const current = clampCommunityJumpPage(page, ordered.length);
  const shown = communityJumpPagePosts(ordered, current);
  return `
    <section class="community-jumps" id="communityJumps" data-locale="${locale}" data-sort="${sort}" data-page="${current}" aria-labelledby="communityJumpsTitle">
      <header class="hero community-jumps-hero">
        ${languageNavHtml(locale, "community")}
        ${toMakerLinkHtml("toMaker", locale)}
        <p class="eyebrow">#あのねジャンプ</p>
        <h1 id="communityJumpsTitle">${t(locale, "communityTitle")}</h1>
        ${
          posts.length === 0
            ? ""
            : `<p class="lede">${t(locale, "communityLede")}</p>`
        }
        ${posts.length < 2 ? "" : communitySortHtml(locale, sort)}
      </header>
      ${
        posts.length === 0
          ? `<p class="community-jumps-empty">${t(locale, "communityEmpty")}</p>`
          : `<ol class="community-jumps-list community-jumps-masonry" id="communityJumpsList">${itemsHtml(shown, locale)}</ol>`
      }
      ${communityPagerHtml(ordered.length, current, locale)}
      ${communityHashtagSearchHtml(locale)}
      <footer class="community-jumps-end">
        ${toMakerLinkHtml("toMakerBottom", locale)}
        ${languageNavHtml(locale, "community")}
      </footer>
    </section>
  `;
}

const communityRefreshers = new WeakMap<HTMLElement, () => void>();

/** 表示に戻った一覧は、潰れた iframe を blockquote から載せ直す。 */
export function refreshCommunityJumps(section: HTMLElement): void {
  communityRefreshers.get(section)?.();
}

export function mountCommunityJumps(
  section: HTMLElement,
  posts: readonly CommunityJumpPost[] = COMMUNITY_JUMP_POSTS,
): void {
  const list = section.querySelector<HTMLElement>("#communityJumpsList");
  if (!list || posts.length === 0) return;

  const remembered = new Set<number>();
  let ordered = sortCommunityJumpPosts(
    posts,
    isCommunityJumpSort(section.dataset.sort) ? section.dataset.sort : DEFAULT_COMMUNITY_JUMP_SORT,
  );
  let page = clampCommunityJumpPage(Number(section.dataset.page), ordered.length);

  const itemsNow = () => [...list.querySelectorAll<HTMLElement>(".community-jumps-item")];
  const shownPosts = () => communityJumpPagePosts(ordered, page);

  const columnCount = () =>
    typeof window === "undefined" ? 1 : communityMasonryColumns(window.innerWidth);

  const layoutMasonry = () => {
    applyCommunityMasonryLayout(list, itemsNow(), columnCount());
  };

  const incomingIndexes = () => {
    const items = itemsNow();
    const shown = shownPosts();
    if (typeof window !== "undefined" && shouldHydrateRemaining(list.getBoundingClientRect(), window.innerHeight)) {
      return shown.map((_, index) => index);
    }
    if (typeof window === "undefined") return remembered.size > 0 ? [] : [0];
    return visibleLogicalIndexes(items, window.innerHeight);
  };

  const hydrateWanted = () => {
    if (!isEmbedHostVisible(section)) return;
    const shown = shownPosts();
    const incoming = incomingIndexes();
    const kickstart = remembered.size === 0 && incoming.length === 0 ? [0] : incoming;
    const want = rememberHydrateIndexes(remembered, kickstart, shown.length, hydratePadForColumns(columnCount()));
    for (const index of want) remembered.add(index);

    const freshCards: HTMLElement[] = [];
    for (const item of itemsNow()) {
      const logical = Number(item.dataset.logical);
      const card = item.querySelector<HTMLElement>(".community-jumps-card");
      const post = shown[logical];
      if (!card || !post || !want.includes(logical) || card.dataset.hydrated === "1") continue;
      card.innerHTML = embedHtml(post, localeOf(section));
      card.dataset.hydrated = "1";
      freshCards.push(card);
    }
    for (const card of freshCards) {
      hydrateReactionEmbed(card);
    }
    layoutMasonry();
  };

  const remountHydratedCards = () => {
    if (!isEmbedHostVisible(section)) return;
    const shown = shownPosts();
    for (const item of itemsNow()) {
      const logical = Number(item.dataset.logical);
      const card = item.querySelector<HTMLElement>(".community-jumps-card");
      const post = shown[logical];
      if (!card || !post || card.dataset.hydrated !== "1") continue;
      card.innerHTML = embedHtml(post, localeOf(section));
      hydrateReactionEmbed(card);
    }
    layoutMasonry();
  };

  const refresh = () => {
    remountHydratedCards();
    hydrateWanted();
  };
  communityRefreshers.set(section, refresh);

  let observer: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;

  const watchItems = () => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
            const logical = Number(entry.target.dataset.logical);
            if (Number.isInteger(logical)) remembered.add(logical);
          }
          hydrateWanted();
        },
        { root: null, rootMargin: `${HYDRATE_ROOT_MARGIN_PX}px 0px`, threshold: 0 },
      );
      for (const item of itemsNow()) observer.observe(item);
    }
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        layoutMasonry();
      });
      for (const item of itemsNow()) {
        resizeObserver.observe(item.querySelector(".community-jumps-card") ?? item);
      }
    }
  };

  const renderPage = (opts?: { scroll?: boolean }) => {
    remembered.clear();
    page = clampCommunityJumpPage(page, ordered.length);
    section.dataset.page = String(page);
    const locale = localeOf(section);
    list.innerHTML = itemsHtml(shownPosts(), locale);
    const existingPager = section.querySelector("#communityPager");
    const pagerHtml = communityPagerHtml(ordered.length, page, locale);
    if (existingPager) {
      if (pagerHtml) existingPager.outerHTML = pagerHtml;
      else existingPager.remove();
    } else if (pagerHtml) {
      list.insertAdjacentHTML("afterend", pagerHtml);
    }
    watchItems();
    layoutMasonry();
    hydrateWanted();
    if (opts?.scroll) {
      list.scrollIntoView({ block: "start" });
    }
  };

  const applySort = (sort: CommunityJumpSort) => {
    ordered = sortCommunityJumpPosts(posts, sort);
    page = DEFAULT_COMMUNITY_JUMP_PAGE;
    section.dataset.sort = sort;
    renderPage({ scroll: true });
  };

  const applyPage = (next: number) => {
    const clamped = clampCommunityJumpPage(next, ordered.length);
    if (clamped === page) return;
    page = clamped;
    renderPage({ scroll: true });
  };

  const sortRoot = section.querySelector<HTMLElement>("#communitySort");
  sortRoot?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isCommunityJumpSort(target.value)) return;
    applySort(target.value);
  });

  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-community-page]");
    if (!button || !section.contains(button) || button.disabled) return;
    event.preventDefault();
    applyPage(Number(button.dataset.communityPage));
  });

  layoutMasonry();
  watchItems();

  if (typeof IntersectionObserver === "undefined") {
    for (let index = 0; index < shownPosts().length; index += 1) remembered.add(index);
    hydrateWanted();
    return;
  }

  const onScrollOrResize = () => {
    layoutMasonry();
    hydrateWanted();
  };
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);

  requestAnimationFrame(hydrateWanted);
}

export function communityPagerHtml(
  total: number,
  page: number,
  locale: Locale = DEFAULT_LOCALE,
  pageSize = COMMUNITY_JUMP_PAGE_SIZE,
): string {
  const pages = communityJumpPageCount(total, pageSize);
  if (pages <= 1) return "";
  const current = clampCommunityJumpPage(page, total, pageSize);
  const prevDisabled = current <= 1 ? " disabled" : "";
  const nextDisabled = current >= pages ? " disabled" : "";
  return `
    <nav class="community-pager" id="communityPager" aria-label="${t(locale, "communityPager")}">
      <button type="button" class="btn ghost" id="communityPagePrev" data-community-page="${current - 1}"${prevDisabled}>${t(locale, "communityPagePrev")}</button>
      <button type="button" class="btn ghost" id="communityPageNext" data-community-page="${current + 1}"${nextDisabled}>${t(locale, "communityPageNext")}</button>
    </nav>
  `;
}

export function communitySortHtml(
  locale: Locale = DEFAULT_LOCALE,
  sort: CommunityJumpSort = DEFAULT_COMMUNITY_JUMP_SORT,
): string {
  const newest = sort === "newest";
  return `
    <fieldset class="aspect-field community-sort">
      <legend>${t(locale, "communitySort")}</legend>
      <div class="aspect-toggle" id="communitySort" role="radiogroup" aria-label="${t(locale, "communitySort")}">
        <label>
          <input type="radio" name="communitySort" id="communitySortNewest" value="newest"${newest ? " checked" : ""} />
          <span>${t(locale, "communitySortNewest")}</span>
        </label>
        <label>
          <input type="radio" name="communitySort" id="communitySortPopular" value="popular"${newest ? "" : " checked"} />
          <span>${t(locale, "communitySortPopular")}</span>
        </label>
      </div>
    </fieldset>
  `;
}

function itemsHtml(posts: readonly CommunityJumpPost[], locale: Locale): string {
  return posts
    .map(
      (post, logical) => `
        <li
          class="community-jumps-item"
          data-logical="${logical}"
          data-post-id="${escapeHtml(post.id)}"
        >
          <article class="community-jumps-card" data-media="${escapeHtml(post.media)}">${fallbackHtml(post, locale)}</article>
        </li>
      `,
    )
    .join("");
}

function fallbackHtml(post: CommunityJumpPost, locale: Locale): string {
  const handle = post.handle ? `@${escapeHtml(post.handle)}` : t(locale, "communityXPost");
  const likes =
    post.likes == null ? "" : `<p class="community-jumps-likes">${t(locale, "communityLikes", { n: post.likes })}</p>`;
  return `
    <div class="community-jumps-fallback">
      <p class="community-jumps-handle">${handle}</p>
      ${likes}
      <a href="${escapeHtml(post.href)}" target="_blank" rel="noopener noreferrer">${t(locale, "communityViewOnX")}</a>
    </div>
  `;
}

function embedHtml(post: CommunityJumpPost, locale: Locale): string {
  const handle = post.handle ? `@${escapeHtml(post.handle)}` : t(locale, "communityXPost");
  const likes = post.likes == null ? "" : ` · ${t(locale, "communityLikes", { n: post.likes })}`;
  const tweetLang = TWITTER_DATA_LANG[locale];
  return `
    <blockquote class="twitter-tweet" data-lang="${tweetLang}" data-dnt="true" data-align="center">
      <p lang="ja" dir="ltr">${handle}${likes}</p>
      &mdash; ${handle}
      <a href="${escapeHtml(post.href)}">${handle}</a>
    </blockquote>
  `;
}

function localeOf(section: HTMLElement): Locale {
  return isLocale(section.dataset.locale) ? section.dataset.locale : DEFAULT_LOCALE;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
