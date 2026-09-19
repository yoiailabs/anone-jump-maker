import { useEffect, useRef } from "react";
import { boot } from "../app.ts";
import { initSentry, reportError } from "../sentry.ts";
import { communityJumpsSectionHtml } from "../community-list.ts";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { pathForApp, t, type AppView, type Locale } from "../i18n.ts";
import { DEFAULT_ASPECT } from "../layout.ts";
import { linkBannersHtml } from "../links.ts";
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
  locale: Locale;
};

export default function MakerApp({ initialView, locale }: MakerAppProps) {
  const started = useRef(false);
  const communityHtml = communityJumpsSectionHtml(undefined, locale);
  const linksHtml = linkBannersHtml(undefined, locale);
  const reactionsHtml = reactionEmbedHtml();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    initSentry();
    void boot(root, { locale }).catch((error: unknown) => {
      reportError(error);
      root.textContent = error instanceof Error ? error.message : t(locale, "makerBootFailed");
    });
  }, [locale]);

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
            <LanguageNav locale={locale} view="maker" />
            <p className="eyebrow">#あのねジャンプ</p>
            <h1 id="makerTitle">{t(locale, "makerTitle")}</h1>
            <p className="lede">
              {t(locale, "makerLede1")}
              <br />
              {t(locale, "makerLede2")}
              <br />
              {t(locale, "makerLede3")}
            </p>
            <p className="hero-more">
              <Button
                variant="site"
                nativeButton={false}
                render={<a id="toCommunity" className="btn" href={pathForApp(locale, "community")} />}
              >
                {t(locale, "communityToCommunity")}
              </Button>
            </p>
          </header>

          <div className="loop-wrap">
            <a
              className="loop-link"
              href="https://www.youtube.com/watch?v=M-IayQIR0XA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(locale, "makerPvAria", { song: t(locale, "songTitle") })}
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
              <span id="pickerLabel">{t(locale, "makerPickPhotos")}</span>
            </Label>
            <div className="thumbs" id="thumbs" hidden aria-describedby="thumbsHint" />
            <p className="thumbs-hint" id="thumbsHint" hidden>
              {t(locale, "makerThumbsHint")}
            </p>
            <fieldset className="aspect-field">
              <legend>{t(locale, "makerAspectLegend")}</legend>
              <RadioPills
                name="aspect"
                ariaLabel={t(locale, "makerAspectLegend")}
                options={[
                  { value: "landscape", label: t(locale, "makerLandscape"), defaultChecked: true },
                  { value: "portrait", label: t(locale, "makerPortrait") },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field" id="swapField">
              <legend>{t(locale, "makerEffectLegend")}</legend>
              <RadioPills
                name="swap"
                ariaLabel={t(locale, "makerEffectLegend")}
                options={[
                  { value: "jump", label: t(locale, "makerJump"), defaultChecked: true },
                  { value: "zoom", label: t(locale, "makerZoom") },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field" id="filterField">
              <legend>{t(locale, "makerFilterLegend")}</legend>
              <RadioPills
                name="filter"
                ariaLabel={t(locale, "makerFilterLegend")}
                className="aspect-toggle cols-3"
                options={[
                  { value: "none", label: t(locale, "makerFilterNone"), defaultChecked: true },
                  { value: "blur-weak", label: t(locale, "makerFilterBlurWeak") },
                  { value: "blur-strong", label: t(locale, "makerFilterBlurStrong") },
                ]}
              />
            </fieldset>
            <div className="actions">
              <Button variant="site" type="button" id="playBtn" className="btn ghost" disabled>
                {t(locale, "makerPreview")}
              </Button>
              <Button variant="site" type="button" id="saveBtn" className="btn" disabled>
                {t(locale, "makerSave")}
              </Button>
            </div>
            <p className="status" id="status" data-kind="idle">
              {t(locale, "makerStatusIdle")}
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
              {t(locale, "makerShare")}
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
                {t(locale, "makerCopyHashtags")}
              </Button>
              <p className="hashtag-copy-hint" id="hashtagCopyHint">
                {SHARE_TEXT}
              </p>
            </div>
          </div>

          <footer className="notes">
            <nav className="links" aria-labelledby="linksTitle">
              <p className="links-title" id="linksTitle">
                {t(locale, "makerOfficial")}
              </p>
              <ul className="link-banners" dangerouslySetInnerHTML={{ __html: linksHtml }} />
            </nav>
            <section className="reactions" aria-labelledby="reactionsTitle">
              <h2 className="reactions-title" id="reactionsTitle">
                {t(locale, "makerReactions")}
              </h2>
              <div
                className="reactions-embed"
                id="reactionsEmbed"
                dangerouslySetInnerHTML={{ __html: reactionsHtml }}
              />
            </section>
            <LanguageNav locale={locale} view="maker" />
          </footer>
        </div>
        <div
          className="app-view"
          id="communityView"
          hidden={communityHidden}
          dangerouslySetInnerHTML={{ __html: communityHtml }}
        />
      </div>
      <dialog className="preview-dialog" id="previewDialog" aria-labelledby="previewTitle">
        <div className="preview-sheet">
          <header className="preview-head">
            <h2 id="previewTitle">{t(locale, "previewTitle")}</h2>
            <Button
              variant="site"
              type="button"
              id="closePreviewBtn"
              className="preview-close"
              aria-label={t(locale, "previewClose")}
            >
              ×
            </Button>
          </header>
          <div className="preview-options">
            <fieldset className="aspect-field preview-field">
              <legend>{t(locale, "previewOrientation")}</legend>
              <RadioPills
                name="preview-aspect"
                ariaLabel={t(locale, "previewOrientationAria")}
                className="aspect-toggle preview-toggle"
                options={[
                  { value: "landscape", label: t(locale, "makerLandscape"), defaultChecked: true },
                  { value: "portrait", label: t(locale, "makerPortrait") },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field preview-field">
              <legend>{t(locale, "makerEffectLegend")}</legend>
              <RadioPills
                name="preview-swap"
                ariaLabel={t(locale, "previewEffectAria")}
                className="aspect-toggle preview-toggle"
                options={[
                  { value: "jump", label: t(locale, "makerJump"), defaultChecked: true },
                  { value: "zoom", label: t(locale, "makerZoom") },
                ]}
              />
            </fieldset>
            <fieldset className="aspect-field preview-field preview-field-span">
              <legend>{t(locale, "makerFilterLegend")}</legend>
              <RadioPills
                name="preview-filter"
                ariaLabel={t(locale, "previewFilterAria")}
                className="aspect-toggle preview-toggle cols-3"
                options={[
                  { value: "none", label: t(locale, "makerFilterNone"), defaultChecked: true },
                  { value: "blur-weak", label: t(locale, "makerFilterBlurWeak") },
                  { value: "blur-strong", label: t(locale, "makerFilterBlurStrong") },
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
              aria-label={t(locale, "previewStageAria")}
            >
              <span className="stage-play-hint" aria-hidden="true" />
            </button>
          </div>
          <p className="slot-meter" id="slotMeter">
            {t(locale, "previewSlotPending")}
          </p>
          <p className="preview-state" id="previewState" aria-live="polite">
            {t(locale, "previewStopped")}
          </p>
          <div className="preview-actions">
            <Button
              variant="site"
              type="button"
              id="modalPlayBtn"
              className="btn"
              dangerouslySetInnerHTML={{ __html: playPauseButtonHtml(false, locale) }}
            />
            <Button
              variant="site"
              type="button"
              id="restartBtn"
              className="btn ghost"
              dangerouslySetInnerHTML={{ __html: restartButtonHtml(locale) }}
            />
            <Button
              variant="site"
              type="button"
              id="muteBtn"
              className="btn ghost"
              aria-pressed={PREVIEW_MUTED_DEFAULT ? "false" : "true"}
              dangerouslySetInnerHTML={{ __html: muteButtonHtml(PREVIEW_MUTED_DEFAULT, locale) }}
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
