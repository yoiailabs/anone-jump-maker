import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { initSentry, reportError } from "../sentry.ts";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { BrowsersNote } from "@/components/BrowsersNote.tsx";
import { JaLede } from "@/components/JaLede.tsx";
import { JumpLoop } from "@/components/JumpLoop.tsx";
import { OfficialMvEmbed } from "@/components/OfficialMvEmbed.tsx";
import { pathForApp, t, type AppView, type Locale } from "../i18n.ts";
import { DEFAULT_ASPECT } from "../layout.ts";
import { linkBannersHtml, OFFICIAL_MV_WATCH_HREF } from "../links.ts";
import { reactionEmbedHtml } from "../reactions.ts";
import { SHARE_TEXT } from "../share.ts";
import { muteButtonHtml, PREVIEW_MUTED_DEFAULT, restartButtonHtml } from "../preview.ts";
import { getPhotoThumbsState, subscribePhotoThumbs } from "../photo-thumbs-store.ts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const PhotoThumbs = lazy(async () => {
  const { PhotoThumbs: Thumbs } = await import("@/components/PhotoThumbs.tsx");
  return { default: Thumbs };
});

function PhotoThumbsSlot({ locale }: { locale: Locale }) {
  const { photos } = useSyncExternalStore(
    subscribePhotoThumbs,
    getPhotoThumbsState,
    getPhotoThumbsState,
  );
  if (photos.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <PhotoThumbs locale={locale} />
    </Suspense>
  );
}

type MakerAppProps = {
  initialView: AppView;
  locale: Locale;
  communityHtml?: string;
};

export default function MakerApp({ initialView, locale, communityHtml = "" }: MakerAppProps) {
  const started = useRef(false);
  const linksHtml = linkBannersHtml(undefined, locale);
  const reactionsHtml = reactionEmbedHtml();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const startSentry = () => {
      initSentry();
    };
    const onFirstGesture = () => startSentry();
    window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    window.addEventListener("error", onFirstGesture, { once: true });
    window.addEventListener("unhandledrejection", onFirstGesture, { once: true });
    const sentryTimer = window.setTimeout(startSentry, 20000);
    void import("../app.ts")
      .then(({ boot }) => boot(root, { locale }))
      .catch((error: unknown) => {
        reportError(error);
        root.textContent = error instanceof Error ? error.message : t(locale, "makerBootFailed");
      });
    return () => {
      window.clearTimeout(sentryTimer);
    };
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
            <h1 id="makerTitle">
              <img
                className="hero-logo"
                src="/brand/anone-logo-wide.svg"
                width={600}
                height={245}
                alt={t(locale, "makerTitle")}
                decoding="async"
              />
            </h1>
            <JaLede locale={locale} />
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
            <JumpLoop
              href={OFFICIAL_MV_WATCH_HREF}
              ariaLabel={t(locale, "makerPvAria", { song: t(locale, "songTitle") })}
            />
          </div>

          <section className="panel">
            <BrowsersNote locale={locale} />
            <Label className="file-btn">
              <input
                id="picker"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                multiple
              />
              <span id="pickerLabel">{t(locale, "makerPickPhotos")}</span>
            </Label>
            <PhotoThumbsSlot locale={locale} />
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
            <fieldset className="aspect-field" id="characterField">
              <legend>{t(locale, "makerCharacterLegend")}</legend>
              <RadioPills
                name="character"
                ariaLabel={t(locale, "makerCharacterLegend")}
                className="aspect-toggle cols-3"
                options={[
                  { value: "standard", label: t(locale, "makerCharacterStandard"), defaultChecked: true },
                  { value: "1.2", label: t(locale, "makerCharacter12") },
                  { value: "1.4", label: t(locale, "makerCharacter14") },
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
            <p className="status notranslate" id="status" data-kind="idle" translate="no">
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
              <OfficialMvEmbed locale={locale} />
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
          {...(communityHtml ? { dangerouslySetInnerHTML: { __html: communityHtml } } : {})}
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
            <fieldset className="aspect-field preview-field preview-field-span">
              <legend>{t(locale, "makerCharacterLegend")}</legend>
              <RadioPills
                name="preview-character"
                ariaLabel={t(locale, "previewCharacterAria")}
                className="aspect-toggle preview-toggle cols-3"
                options={[
                  { value: "standard", label: t(locale, "makerCharacterStandard"), defaultChecked: true },
                  { value: "1.2", label: t(locale, "makerCharacter12") },
                  { value: "1.4", label: t(locale, "makerCharacter14") },
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
          <div className="preview-actions">
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
              className="btn ghost notranslate"
              translate="no"
              aria-pressed={PREVIEW_MUTED_DEFAULT ? "false" : "true"}
              dangerouslySetInnerHTML={{ __html: muteButtonHtml(PREVIEW_MUTED_DEFAULT, locale) }}
            />
          </div>
          <div className="preview-save">
            <Button
              variant="site"
              type="button"
              id="previewSaveBtn"
              className="btn preview-save-btn"
              disabled
              aria-describedby="previewSaveHint"
            >
              {t(locale, "makerSave")}
            </Button>
            <p className="preview-save-hint" id="previewSaveHint">
              {t(locale, "previewSaveHint")}
            </p>
          </div>
        </div>
      </dialog>
      <dialog
        className="preview-dialog export-dialog"
        id="exportDialog"
        data-export-phase="busy"
        aria-labelledby="exportTitle"
        aria-describedby="exportKeepOpen"
      >
        <div className="export-sheet">
          <header className="preview-head">
            <h2 id="exportTitle">{t(locale, "exportTitle")}</h2>
          </header>
          <p className="export-status notranslate" id="exportStatus" translate="no" aria-live="polite">
            {t(locale, "statusExportPreparing")}
          </p>
          <div className="export-progress">
            <progress
              id="exportProgress"
              className="export-progress-bar"
              max={100}
              value={0}
              aria-label={t(locale, "exportProgressAria")}
            />
            <span className="export-progress-label notranslate" id="exportProgressLabel" translate="no">
              {t(locale, "exportPercent", { percent: 0 })}
            </span>
          </div>
          <p className="export-keep-open" id="exportKeepOpen">
            {t(locale, "exportKeepOpen")}
          </p>
          <p className="export-download-hint" id="exportDownloadHint" hidden>
            {t(locale, "exportDownloadHint")}
          </p>
          <Button variant="site" type="button" id="cancelExportBtn" className="btn ghost">
            {t(locale, "exportCancel")}
          </Button>
          <Button variant="site" type="button" id="downloadExportBtn" className="btn" hidden>
            {t(locale, "exportDownload")}
          </Button>
          <Button variant="site" type="button" id="closeExportBtn" className="btn ghost" hidden>
            {t(locale, "exportClose")}
          </Button>
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
