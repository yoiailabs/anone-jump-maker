import {
  COMMUNITY_JUMP_POSTS,
  type CommunityJumpPost,
} from "./community-jumps.ts";
import { toMakerLinkHtml } from "./nav.ts";
import { hydrateReactionEmbed } from "./reactions.ts";

export const COMMUNITY_JUMPS_TITLE = "みんなの #あのねジャンプ";
export const COMMUNITY_JUMPS_LEDE = "ファンが投稿したジャンプ動画です。下にスクロールして見てね。";
export const COMMUNITY_JUMPS_EMPTY =
  "まだ公開できるジャンプがありません。#あのねジャンプ を付けて投稿してみてね。";
export const MORE_JUMPS_LABEL = "もっと見る";
export const MORE_JUMPS_QUERY = "#あのねジャンプ";
export const MORE_JUMPS_HREF = `https://x.com/search?q=${encodeURIComponent(MORE_JUMPS_QUERY)}`;

/** 画面の少し外まで先読みする余白。 */
export const HYDRATE_ROOT_MARGIN_PX = 160;

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

  const items = [...list.querySelectorAll<HTMLElement>(".community-jumps-item")];
  const intersecting = new Set<number>();

  const hydrateWanted = () => {
    const source = intersecting.size > 0 ? [...intersecting] : [0];
    const want = new Set(hydrateIndexes(source, posts.length));
    let addedEmbed = false;
    for (const item of items) {
      const logical = Number(item.dataset.logical);
      const card = item.querySelector<HTMLElement>(".community-jumps-card");
      const post = posts[logical];
      if (!card || !post || !want.has(logical) || card.dataset.hydrated === "1") continue;
      card.innerHTML = embedHtml(post);
      card.dataset.hydrated = "1";
      addedEmbed = true;
    }
    if (addedEmbed) {
      hydrateReactionEmbed(list);
    }
  };

  if (typeof IntersectionObserver === "undefined") {
    intersecting.add(0);
    hydrateWanted();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        const logical = Number(entry.target.dataset.logical);
        if (!Number.isInteger(logical)) continue;
        if (entry.isIntersecting) intersecting.add(logical);
        else intersecting.delete(logical);
      }
      hydrateWanted();
    },
    { root: null, rootMargin: `${HYDRATE_ROOT_MARGIN_PX}px 0px`, threshold: 0.01 },
  );

  for (const item of items) {
    observer.observe(item);
  }
}

export function moreJumpsLinkHtml(): string {
  return `<p class="community-more-wrap"><a id="moreJumps" class="btn" href="${MORE_JUMPS_HREF}" target="_blank" rel="noopener noreferrer">${MORE_JUMPS_LABEL}</a></p>`;
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
