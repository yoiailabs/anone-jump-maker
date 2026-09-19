import {
  COMMUNITY_JUMP_POSTS,
  type CommunityJumpPost,
} from "./community-jumps.ts";
import { toMakerLinkHtml } from "./nav.ts";
import { COMMUNITY_DESCRIPTION, COMMUNITY_DOCUMENT_TITLE } from "./page-meta.ts";
import { hydrateReactionEmbed } from "./reactions.ts";

export const COMMUNITY_JUMPS_TITLE = COMMUNITY_DOCUMENT_TITLE;
export const COMMUNITY_JUMPS_LEDE = COMMUNITY_DESCRIPTION;
export const COMMUNITY_JUMPS_EMPTY =
  "まだ公開できるジャンプがありません。#あのねジャンプ を付けて投稿してみてね。";
export const MORE_JUMPS_LABEL = "もっと見る";
export const MORE_JUMPS_QUERY = "#あのねジャンプ";
export const MORE_JUMPS_HREF = `https://x.com/search?q=${encodeURIComponent(MORE_JUMPS_QUERY)}`;

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
): string {
  return `
    <section class="community-jumps" id="communityJumps" aria-labelledby="communityJumpsTitle">
      <header class="hero community-jumps-hero">
        ${toMakerLinkHtml()}
        <p class="eyebrow">#あのねジャンプ</p>
        <h1 id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h1>
        ${
          posts.length === 0
            ? ""
            : `<p class="lede">${COMMUNITY_JUMPS_LEDE}</p>`
        }
      </header>
      ${
        posts.length === 0
          ? `<p class="community-jumps-empty">${COMMUNITY_JUMPS_EMPTY}</p>`
          : `<ol class="community-jumps-list" id="communityJumpsList">${itemsHtml(posts)}</ol>`
      }
      <footer class="community-jumps-end">
        ${moreJumpsLinkHtml()}
        ${toMakerLinkHtml("toMakerBottom")}
      </footer>
    </section>
  `;
}

export function mountCommunityJumps(
  section: HTMLElement,
  posts: readonly CommunityJumpPost[] = COMMUNITY_JUMP_POSTS,
): void {
  const list = section.querySelector<HTMLElement>("#communityJumpsList");
  if (!list || posts.length === 0) return;

  const remembered = new Set<number>();

  const itemsNow = () => [...list.querySelectorAll<HTMLElement>(".community-jumps-item")];

  const incomingIndexes = () => {
    const items = itemsNow();
    if (typeof window !== "undefined" && shouldHydrateRemaining(list.getBoundingClientRect(), window.innerHeight)) {
      return posts.map((_, index) => index);
    }
    if (typeof window === "undefined") return remembered.size > 0 ? [] : [0];
    return visibleLogicalIndexes(items, window.innerHeight);
  };

  const isSectionLaidOut = () => {
    if (section.closest("[hidden]")) return false;
    const box = section.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };

  const hydrateWanted = () => {
    if (typeof window !== "undefined" && !isSectionLaidOut()) return;
    const incoming = incomingIndexes();
    const kickstart = remembered.size === 0 && incoming.length === 0 ? [0] : incoming;
    const want = rememberHydrateIndexes(remembered, kickstart, posts.length);
    for (const index of want) remembered.add(index);

    const freshCards: HTMLElement[] = [];
    for (const item of itemsNow()) {
      const logical = Number(item.dataset.logical);
      const card = item.querySelector<HTMLElement>(".community-jumps-card");
      const post = posts[logical];
      if (!card || !post || !want.includes(logical) || card.dataset.hydrated === "1") continue;
      card.innerHTML = embedHtml(post);
      card.dataset.hydrated = "1";
      freshCards.push(card);
    }
    for (const card of freshCards) {
      hydrateReactionEmbed(card);
    }
  };

  if (typeof IntersectionObserver === "undefined") {
    for (let index = 0; index < posts.length; index += 1) remembered.add(index);
    hydrateWanted();
    return;
  }

  const observer = new IntersectionObserver(
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

  for (const item of itemsNow()) {
    observer.observe(item);
  }

  const onScrollOrResize = () => hydrateWanted();
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);
  requestAnimationFrame(hydrateWanted);
}

export function moreJumpsLinkHtml(): string {
  return `<p class="community-more-wrap"><a id="moreJumps" class="btn community-more-btn" href="${MORE_JUMPS_HREF}" target="_blank" rel="noopener noreferrer">${MORE_JUMPS_LABEL}</a></p>`;
}

function itemsHtml(posts: readonly CommunityJumpPost[]): string {
  return posts
    .map(
      (post, logical) => `
        <li
          class="community-jumps-item"
          data-logical="${logical}"
          data-post-id="${escapeHtml(post.id)}"
        >
          <article class="community-jumps-card">${fallbackHtml(post)}</article>
        </li>
      `,
    )
    .join("");
}

function fallbackHtml(post: CommunityJumpPost): string {
  const handle = post.handle ? `@${escapeHtml(post.handle)}` : "Xの投稿";
  const likes =
    post.likes == null ? "" : `<p class="community-jumps-likes">${post.likes} いいね</p>`;
  return `
    <div class="community-jumps-fallback">
      <p class="community-jumps-handle">${handle}</p>
      ${likes}
      <a href="${escapeHtml(post.href)}" target="_blank" rel="noopener noreferrer">Xで見る</a>
    </div>
  `;
}

function embedHtml(post: CommunityJumpPost): string {
  const handle = post.handle ? `@${escapeHtml(post.handle)}` : "Xの投稿";
  const likes = post.likes == null ? "" : ` · ${post.likes} いいね`;
  return `
    <blockquote class="twitter-tweet" data-lang="ja" data-dnt="true" data-align="center">
      <p lang="ja" dir="ltr">${handle}${likes}</p>
      &mdash; ${handle}
      <a href="${escapeHtml(post.href)}">${handle}</a>
    </blockquote>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
