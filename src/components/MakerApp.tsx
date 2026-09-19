import { useEffect, useRef } from "react";
import { boot } from "../app.ts";
import { initSentry, reportError } from "../sentry.ts";
import { communityJumpsSectionHtml } from "../community-list.ts";
import { linkBannersHtml } from "../links.ts";
import { COMMUNITY_PATH, TO_COMMUNITY_LABEL, type AppView } from "../nav.ts";
import { DEFAULT_ASPECT } from "../layout.ts";
import { reactionEmbedHtml } from "../reactions.ts";
import { SHARE_TEXT } from "../share.ts";
import {
  muteButtonHtml,
  playPauseButtonHtml,
  PREVIEW_MUTED_DEFAULT,
  restartButtonHtml,
} from "../preview.ts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type MakerAppProps = {
  initialView: AppView;
};

const COMMUNITY_HTML = communityJumpsSectionHtml();
const LINKS_HTML = linkBannersHtml();
const REACTIONS_HTML = reactionEmbedHtml();

export default function MakerApp({ initialView }: MakerAppProps) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    initSentry();
    void boot(root).catch((error: unknown) => {
      reportError(error);
      root.textContent = error instanceof Error ? error.message : "起動に失敗しました";
    });
  }, []);

  const makerHidden = initialView !== "maker";
  const communityHidden = initialView !== "community";

  return (
    <>
      <div className="sky" aria-hidden="true">
        <span className="blob blob-lime" />
        <span className="blob blob-teal" />
        <span className="blob blob-coral" />
      </div>
      <div className="app">
        <div className="app-view" id="makerView" hidden={makerHidden}>
          <header className="hero">
            <p className="eyebrow">#あのねジャンプ</p>
            <h1 id="makerTitle">あのねジャンプメーカー</h1>
            <p className="lede">
              写真を何枚か選択するだけで簡単に「あのねジャンプ」動画が作れます。
              <br />
              動画生成はすべて端末内で完結するため、外部のサーバーに画像が送信されることはありません。
              <br />
              ※ファン制作の非公式アプリです。
            </p>
            <p className="hero-more">
              <Button
                variant="site"
                nativeButton={false}
                render={<a id="toCommunity" className="btn" href={COMMUNITY_PATH} />}
              >
                {TO_COMMUNITY_LABEL}
              </Button>
            </p>
          </header>

          <div className="loop-wrap">
            <a
              className="loop-link"
              href="https://www.youtube.com/watch?v=M-IayQIR0XA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="あのねのPVをYouTubeで開く（新しいタブ）"
            >
              <picture>
                <source media="(prefers-reduced-motion: reduce)" srcSet="/jump-loop-still.png" />
                <img className="loop" src="/jump-loop.png" alt="" width={448} height={252} decoding="async" />
              </picture>
            </a>
          </div>

          <section className="panel">
            <Label className="file-btn">
              <input
                id="picker"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                multiple
              />
              写真を選ぶ
            </Label>
            <div className="thumbs" id="thumbs" hidden />
            <fieldset className="aspect-field">
              <legend>動画の向き</legend>
              <RadioPills
                name="aspect"
                ariaLabel="動画の向き"
                options={[
                  { value: "landscape", label: "横", defaultChecked: true },
                  { value: "portrait", label: "縦" },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field" id="swapField">
              <legend>エフェクト</legend>
              <RadioPills
                name="swap"
                ariaLabel="エフェクト"
                options={[
                  { value: "jump", label: "ジャンプ", defaultChecked: true },
                  { value: "zoom", label: "ズーム" },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field" id="filterField">
              <legend>フィルター</legend>
              <RadioPills
                name="filter"
                ariaLabel="フィルター"
                className="aspect-toggle cols-3"
                options={[
                  { value: "none", label: "なし", defaultChecked: true },
                  { value: "blur-weak", label: "ブラー(弱)" },
                  { value: "blur-strong", label: "ブラー(強)" },
                ]}
              />
            </fieldset>
            <div className="actions">
              <Button variant="site" type="button" id="playBtn" className="btn ghost" disabled>
                プレビュー
              </Button>
              <Button variant="site" type="button" id="saveBtn" className="btn" disabled>
                動画を保存
              </Button>
            </div>
            <p className="status" id="status" data-kind="idle">
              何枚でも。テンプレは 10 枚を 32 カットに並べ直します。少なければ順にくり返します。
            </p>
          </section>

          <div className="share-wrap">
            <Button variant="site" type="button" id="shareAppBtn" className="btn share-app">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 3v10M8.2 6.8 12 3l3.8 3.8M5 13v6.2A1.8 1.8 0 0 0 6.8 21h10.4A1.8 1.8 0 0 0 19 19.2V13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              共有する
            </Button>
            <div className="hashtag-copy">
              <Button
                variant="site"
                type="button"
                id="copyHashtagsBtn"
                className="btn copy-hashtags"
                aria-describedby="hashtagCopyHint"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect
                    x="8.2"
                    y="8.2"
                    width="11.5"
                    height="13"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                  />
                  <path
                    d="M15.8 8.2V6.4A1.8 1.8 0 0 0 14 4.6H6.4A1.8 1.8 0 0 0 4.6 6.4V18A1.8 1.8 0 0 0 6.4 19.8H8.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                ハッシュタグをコピー
              </Button>
              <p className="hashtag-copy-hint" id="hashtagCopyHint">
                {SHARE_TEXT}
              </p>
            </div>
          </div>

          <footer className="notes">
            <nav className="links" aria-labelledby="linksTitle">
              <p className="links-title" id="linksTitle">
                ナナツカゼさん公式
              </p>
              <ul className="link-banners" dangerouslySetInnerHTML={{ __html: LINKS_HTML }} />
            </nav>
            <section className="reactions" aria-labelledby="reactionsTitle">
              <h2 className="reactions-title" id="reactionsTitle">
                反応
              </h2>
              <div
                className="reactions-embed"
                id="reactionsEmbed"
                dangerouslySetInnerHTML={{ __html: REACTIONS_HTML }}
              />
            </section>
          </footer>
        </div>
        <div
          className="app-view"
          id="communityView"
          hidden={communityHidden}
          dangerouslySetInnerHTML={{ __html: COMMUNITY_HTML }}
        />
      </div>
      <dialog className="preview-dialog" id="previewDialog" aria-labelledby="previewTitle">
        <div className="preview-sheet">
          <header className="preview-head">
            <h2 id="previewTitle">プレビュー</h2>
            <Button variant="site" type="button" id="closePreviewBtn" className="preview-close" aria-label="閉じる">
              ×
            </Button>
          </header>
          <div className="preview-options">
            <fieldset className="aspect-field preview-field">
              <legend>向き</legend>
              <RadioPills
                name="preview-aspect"
                ariaLabel="プレビューの向き"
                className="aspect-toggle preview-toggle"
                options={[
                  { value: "landscape", label: "横", defaultChecked: true },
                  { value: "portrait", label: "縦" },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field preview-field">
              <legend>エフェクト</legend>
              <RadioPills
                name="preview-swap"
                ariaLabel="プレビューのエフェクト"
                className="aspect-toggle preview-toggle"
                options={[
                  { value: "jump", label: "ジャンプ", defaultChecked: true },
                  { value: "zoom", label: "ズーム" },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field preview-field preview-field-span">
              <legend>フィルター</legend>
              <RadioPills
                name="preview-filter"
                ariaLabel="プレビューのフィルター"
                className="aspect-toggle preview-toggle cols-3"
                options={[
                  { value: "none", label: "なし", defaultChecked: true },
                  { value: "blur-weak", label: "ブラー(弱)" },
                  { value: "blur-strong", label: "ブラー(強)" },
                ]}
              />
            </fieldset>
          </div>
          <div className="stage-wrap">
            <button
              type="button"
              className="stage"
              id="stage"
              data-aspect={DEFAULT_ASPECT}
              aria-pressed="false"
              aria-label="プレビュー。クリックで再生と一時停止"
            >
              <span className="stage-play-hint" aria-hidden="true" />
            </button>
          </div>
          <p className="slot-meter" id="slotMeter">
            スロット — / —
          </p>
          <p className="preview-state" id="previewState" aria-live="polite">
            停止中
          </p>
          <div className="preview-actions">
            <Button
              variant="site"
              type="button"
              id="modalPlayBtn"
              className="btn"
              dangerouslySetInnerHTML={{ __html: playPauseButtonHtml(false) }}
            />
            <Button
              variant="site"
              type="button"
              id="restartBtn"
              className="btn ghost"
              dangerouslySetInnerHTML={{ __html: restartButtonHtml() }}
            />
            <Button
              variant="site"
              type="button"
              id="muteBtn"
              className="btn ghost"
              aria-pressed={PREVIEW_MUTED_DEFAULT ? "false" : "true"}
              dangerouslySetInnerHTML={{ __html: muteButtonHtml(PREVIEW_MUTED_DEFAULT) }}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}

function RadioPills({
  name,
  ariaLabel,
  options,
  className = "aspect-toggle",
}: {
  name: string;
  ariaLabel: string;
  className?: string;
  options: readonly { value: string; label: string; defaultChecked?: boolean }[];
}) {
  return (
    <div className={className} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <label key={`${name}-${option.value}`}>
          <input type="radio" name={name} value={option.value} defaultChecked={option.defaultChecked} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
