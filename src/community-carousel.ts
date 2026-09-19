import {
  COMMUNITY_JUMP_POSTS,
  type CommunityJumpPost,
} from "./community-jumps.ts";
import { hydrateReactionEmbed } from "./reactions.ts";

export const COMMUNITY_JUMPS_TITLE = "みんなの #あのねジャンプ";
export const COMMUNITY_JUMPS_LEDE = "ファンが投稿したジャンプ動画です。左右に送って見てね。";
export const COMMUNITY_JUMPS_EMPTY =
  "まだ公開できるジャンプがありません。#あのねジャンプ を付けて投稿してみてね。";

const SWIPE_PX = 48;
const TRANSITION_MS = 360;

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

/** 現在と両隣。2件のときは両方。埋め込みを載せる論理インデックス。 */
export function neighborIndexes(index: number, length: number): readonly number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const center = wrapIndex(index, length);
  const prev = wrapIndex(center - 1, length);
  const next = wrapIndex(center + 1, length);
  if (prev === next) {
    return prev === center ? [center] : [prev, center];
  }
  return [prev, center, next];
}

export function loopingCarousel(length: number): boolean {
  return length >= 2;
}

/** クローン付きトラック: [末尾, ...本体, 先頭]。visual 0 が末尾クローン。 */
export function logicalFromVisual(visual: number, length: number): number {
  if (length <= 0) return 0;
  if (visual === 0) return length - 1;
  if (visual === length + 1) return 0;
  return visual - 1;
}

export function startVisual(length: number): number {
  return loopingCarousel(length) ? 1 : 0;
}

/** クローン端まで行ったあとに本体へ瞬間移動する先。 */
export function snapLoopVisual(visual: number, length: number): number {
  if (!loopingCarousel(length)) return visual;
  if (visual === 0) return length;
  if (visual === length + 1) return 1;
  return visual;
}

export function meterLabel(logical: number, length: number): string {
  if (length <= 0) return "0 / 0";
  return `${logical + 1} / ${length}`;
}

export function shouldHydrateSlide(
  visual: number,
  currentLogical: number,
  length: number,
): boolean {
  if (length <= 0) return false;
  if (!loopingCarousel(length)) return visual === 0;
  return neighborIndexes(currentLogical, length).includes(logicalFromVisual(visual, length));
}

export function communityJumpsSectionHtml(
  posts: readonly CommunityJumpPost[] = COMMUNITY_JUMP_POSTS,
): string {
  if (posts.length === 0) {
    return `
      <section class="community-jumps" id="communityJumps" aria-labelledby="communityJumpsTitle">
        <h2 class="community-jumps-title" id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h2>
        <p class="community-jumps-empty">${COMMUNITY_JUMPS_EMPTY}</p>
      </section>
    `;
  }

  const looping = loopingCarousel(posts.length);
  const visual = startVisual(posts.length);
  const logical = looping ? logicalFromVisual(visual, posts.length) : 0;

  return `
    <section
      class="community-jumps"
      id="communityJumps"
      aria-labelledby="communityJumpsTitle"
      aria-roledescription="カルーセル"
    >
      <h2 class="community-jumps-title" id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h2>
      <p class="community-jumps-lede">${COMMUNITY_JUMPS_LEDE}</p>
      <div
        class="community-jumps-viewport"
        id="communityJumpsViewport"
        tabindex="0"
        aria-label="${COMMUNITY_JUMPS_TITLE}"
      >
        <div
          class="community-jumps-track"
          id="communityJumpsTrack"
          data-instant="true"
          style="transform: translate3d(${-visual * 100}%, 0, 0)"
        >
          ${slidesHtml(posts, looping)}
        </div>
      </div>
      <div class="community-jumps-controls">
        <button
          type="button"
          class="community-jumps-nav"
          id="communityJumpsPrev"
          aria-label="前の動画"
          ${looping ? "" : "hidden"}
        >
          ${chevronSvg("prev")}
        </button>
        <p class="community-jumps-meter" id="communityJumpsMeter" aria-live="polite">${meterLabel(logical, posts.length)}</p>
        <button
          type="button"
          class="community-jumps-nav"
          id="communityJumpsNext"
          data-dir="next"
          aria-label="次の動画"
          ${looping ? "" : "hidden"}
        >
          ${chevronSvg("next")}
        </button>
      </div>
    </section>
  `;
}

export function mountCommunityJumps(
  section: HTMLElement,
  posts: readonly CommunityJumpPost[] = COMMUNITY_JUMP_POSTS,
): void {
  const track = section.querySelector<HTMLElement>("#communityJumpsTrack");
  const viewport = section.querySelector<HTMLElement>("#communityJumpsViewport");
  const meter = section.querySelector<HTMLElement>("#communityJumpsMeter");
  const prevBtn = section.querySelector<HTMLButtonElement>("#communityJumpsPrev");
  const nextBtn = section.querySelector<HTMLButtonElement>("#communityJumpsNext");
  if (!track || !viewport || !meter || posts.length === 0) return;

  const slides = [...track.querySelectorAll<HTMLElement>(".community-jumps-slide")];
  const looping = loopingCarousel(posts.length);
  let visual = startVisual(posts.length);
  let logical = looping ? logicalFromVisual(visual, posts.length) : 0;
  let busy = false;
  let pending: -1 | 1 | 0 = 0;
  let moveGen = 0;
  let swipe: { x: number; y: number } | null = null;

  const prefersInstant = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setTransform = (instant: boolean) => {
    track.dataset.instant = instant ? "true" : "false";
    void track.offsetWidth;
    track.style.transform = `translate3d(${-visual * 100}%, 0, 0)`;
  };

  const syncAria = () => {
    for (const slide of slides) {
      const slideVisual = Number(slide.dataset.visual);
      slide.setAttribute("aria-hidden", slideVisual === visual ? "false" : "true");
    }
  };

  const syncMeter = () => {
    meter.textContent = meterLabel(logical, posts.length);
  };

  const syncHydration = () => {
    const want = new Set(neighborIndexes(logical, posts.length));
    let addedEmbed = false;
    for (const slide of slides) {
      const card = slide.querySelector<HTMLElement>(".community-jumps-card");
      const post = posts[Number(slide.dataset.logical)];
      if (!card || !post) continue;
      const should = want.has(Number(slide.dataset.logical));
      const hydrated = card.dataset.hydrated === "1";
      if (should && !hydrated) {
        card.innerHTML = embedHtml(post);
        card.dataset.hydrated = "1";
        addedEmbed = true;
      } else if (!should && hydrated) {
        card.innerHTML = fallbackHtml(post);
        delete card.dataset.hydrated;
      }
    }
    if (addedEmbed) {
      hydrateReactionEmbed(track);
    }
  };

  const finishMove = () => {
    if (!busy) return;
    const snapped = snapLoopVisual(visual, posts.length);
    if (snapped !== visual) {
      visual = snapped;
      logical = logicalFromVisual(visual, posts.length);
      setTransform(true);
    }
    busy = false;
    syncMeter();
    syncAria();
    syncHydration();
    if (pending !== 0) {
      const next = pending;
      pending = 0;
      go(next);
    }
  };

  const go = (delta: -1 | 1) => {
    if (!looping) return;
    if (busy) {
      pending = delta;
      return;
    }
    busy = true;
    visual += delta;
    logical = logicalFromVisual(visual, posts.length);
    const instant = prefersInstant();
    setTransform(instant);
    syncMeter();
    syncAria();
    syncHydration();
    if (instant) {
      finishMove();
      return;
    }
    const gen = (moveGen += 1);
    window.setTimeout(() => {
      if (gen === moveGen) finishMove();
    }, TRANSITION_MS + 90);
  };

  track.addEventListener("transitionend", (event) => {
    if (event.target !== track || event.propertyName !== "transform") return;
    finishMove();
  });

  prevBtn?.addEventListener("click", () => {
    go(-1);
  });
  nextBtn?.addEventListener("click", () => {
    go(1);
  });

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("iframe, a, button")) return;
    swipe = { x: event.clientX, y: event.clientY };
  });

  const endSwipe = (event: PointerEvent) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  viewport.addEventListener("pointerup", endSwipe);
  viewport.addEventListener("pointercancel", () => {
    swipe = null;
  });

  syncAria();
  syncHydration();
}

function slidesHtml(posts: readonly CommunityJumpPost[], looping: boolean): string {
  const last = posts[posts.length - 1];
  const first = posts[0];
  if (!first || !last) return "";
  const sequence = looping ? [last, ...posts, first] : [...posts];
  return sequence
    .map((post, visual) => {
      const logical = looping ? logicalFromVisual(visual, posts.length) : visual;
      return `
        <article
          class="community-jumps-slide"
          data-visual="${visual}"
          data-logical="${logical}"
          data-post-id="${escapeHtml(post.id)}"
          aria-hidden="${visual === startVisual(posts.length) ? "false" : "true"}"
        >
          <div class="community-jumps-card">${fallbackHtml(post)}</div>
        </article>
      `;
    })
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

function chevronSvg(dir: "prev" | "next"): string {
  const d = dir === "prev" ? "M14.8 6.2 8.8 12l6 5.8" : "M9.2 6.2 15.2 12l-6 5.8";
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
