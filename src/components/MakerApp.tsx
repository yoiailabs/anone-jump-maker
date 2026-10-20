import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { initSentry, reportError } from "../sentry.ts";
import { HeaderGitHub } from "@/components/HeaderGitHub.tsx";
import { LanguageNav } from "@/components/LanguageNav.tsx";
import { JumpLoop } from "@/components/JumpLoop.tsx";
import { JaPhrase } from "@/components/JaPhrase.tsx";
import { OfficialMvEmbed } from "@/components/OfficialMvEmbed.tsx";
import { SiteFooter } from "@/components/SiteFooter.tsx";
import { pathForApp, t, type AppView, type Locale } from "../i18n.ts";
import { DEFAULT_ASPECT, DEFAULT_SWAP_STYLE } from "../layout.ts";
import { JUMP_LOOP_WATCH_HREF, linkBannersHtml } from "../links.ts";
import { reactionEmbedHtml } from "../reactions.ts";
import { MORE_JUMPS_HREF, SHARE_TEXT } from "../share.ts";
import { muteButtonHtml, playPauseButtonHtml, PREVIEW_MUTED_DEFAULT } from "../preview.ts";
import { getPreviewChrome, subscribePreviewChrome } from "../preview-chrome-store.ts";
import { getPhotoThumbsState, subscribePhotoThumbs } from "../photo-thumbs-store.ts";
import { getFeedback, subscribeFeedback, type FeedbackPlace } from "../feedback-store.ts";
import { makerLogoStackedSize, makerLogoStackedSrc } from "../brand.ts";
import { scheduleHeroLogoHop } from "../hero-logo-hop.ts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ExportActions } from "../app.ts";

const PhotoThumbs = lazy(async () => {
  const { PhotoThumbs: Thumbs } = await import("@/components/PhotoThumbs.tsx");
  return { default: Thumbs };
});

function PreviewChrome({ locale }: { locale: Locale }) {
  const { playing, enabled } = useSyncExternalStore(subscribePreviewChrome, getPreviewChrome, getPreviewChrome);
  return (
    <>
      <div className="preview-dim" id="previewDim" />
      <Button
        variant="site"
        type="button"
        id="previewToggle"
        className="preview-toggle btn ghost"
        disabled={!enabled}
        aria-pressed={playing ? "true" : "false"}
        aria-label={t(locale, playing ? "previewPause" : "previewPlay")}
        dangerouslySetInnerHTML={{ __html: playPauseButtonHtml(playing, locale) }}
      />
    </>
  );
}

function PreviewStatus({ locale }: { locale: Locale }) {
  const { playing } = useSyncExternalStore(subscribePreviewChrome, getPreviewChrome, getPreviewChrome);
  return (
    <span
      className="preview-status"
      id="previewStatus"
      data-state={playing ? "playing" : "stopped"}
      role="img"
      aria-label={t(locale, playing ? "previewPlaying" : "previewStopped")}
    >
      <svg className="preview-status-icon preview-status-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 6.2 18.2 12 8 17.8Z" fill="currentColor" />
      </svg>
      <svg className="preview-status-icon preview-status-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 6.2h2.7v11.6H8Zm5.3 0H16v11.6h-2.7Z" fill="currentColor" />
      </svg>
    </span>
  );
}

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
};

const OPTION_TABS = [
  ["aspect", "studioTabAspect", "makerAspectLegend"],
  ["swap", "studioTabEffect", "makerEffectLegend"],
  ["filter", "studioTabFilter", "makerFilterLegend"],
  ["character", "studioTabCharacter", "makerCharacterLegend"],
] as const;

type OptionTab = (typeof OPTION_TABS)[number][0];

export default function MakerApp({ initialView, locale }: MakerAppProps) {
  const started = useRef(false);
  const exportActions = useRef<ExportActions | null>(null);
  const landingLogoRef = useRef<HTMLImageElement>(null);
  const [optionTab, setOptionTab] = useState<OptionTab>("aspect");
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
      .then(({ boot }) => boot(root, {
        locale,
        onExportActionsReady: (actions) => {
          exportActions.current = actions;
        },
      }))
      .catch((error: unknown) => {
        reportError(error);
        root.textContent = error instanceof Error ? error.message : t(locale, "makerBootFailed");
      });
    return () => {
      window.clearTimeout(sentryTimer);
    };
  }, [locale]);

  useEffect(() => {
    if (initialView !== "maker") return;
    const logo = landingLogoRef.current;
    if (!logo) return;
    return scheduleHeroLogoHop(logo);
  }, [initialView]);

  const makerHidden = initialView !== "maker";
  const studioHidden = initialView !== "studio";
  const logoSize = makerLogoStackedSize(locale);

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
            <HeaderGitHub id="makerHeaderGitHub" locale={locale} />
            <LanguageNav locale={locale} view="maker" />
            <h1 id="makerTitle">
              <img
                ref={landingLogoRef}
                className="hero-logo"
                src={makerLogoStackedSrc(locale)}
                width={logoSize.width}
                height={logoSize.height}
                alt={t(locale, "makerTitle")}
                decoding="async"
              />
            </h1>
            <div className="loop-wrap">
              <JumpLoop
                href={JUMP_LOOP_WATCH_HREF}
                ariaLabel={t(locale, "makerPvAria", { song: t(locale, "songTitle") })}
              />
            </div>
            <div className="make-cta">
              <Button
                variant="site"
                nativeButton={false}
                render={<a id="toStudio" className="btn" href={pathForApp(locale, "studio")} />}
              >
                {t(locale, "makerMakeVideo")}
              </Button>
            </div>
          </header>

          <section className="maker-story">
            <p className="hero-more">
              <Button
                variant="site"
                nativeButton={false}
                render={
                  <a
                    id="toCommunity"
                    className="btn ghost"
                    href={MORE_JUMPS_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                {t(locale, "communityToCommunity")}
              </Button>
            </p>
            <p className="hero-hashtags" id="landingHashtags">
              {SHARE_TEXT}
            </p>
          </section>

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
        <div className="app-view" id="studioView" hidden={studioHidden}>
          <header className="studio-top">
            <a id="studioHome" href={pathForApp(locale, "maker")}>
              <img
                className="hero-logo"
                src={makerLogoStackedSrc(locale)}
                width={logoSize.width}
                height={logoSize.height}
                alt={t(locale, "makerTitle")}
                decoding="async"
              />
            </a>
            <h1 id="studioTitle" className="studio-title">
              {t(locale, "studioTitle")}
            </h1>
          </header>
          <div className="studio-photos">
            <div className="make-cta">
              <JaPhrase
                id="onDeviceNote"
                className="make-note"
                locale={locale}
                text={t(locale, "makerOnDevice")}
              />
              <div className="pick-row">
                <Label className="file-btn">
                  <input
                    id="picker"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                    multiple
                    aria-describedby="pickHint"
                  />
                  <span id="pickerLabel">{t(locale, "makerPickPhotos")}</span>
                </Label>
                <p id="pickHint" className="make-note">
                  {t(locale, "makerPhotoCountHint")}
                </p>
              </div>
              <LiveFeedback id="photoFeedback" place="photo" />
            </div>
            <PhotoThumbsSlot locale={locale} />
          </div>
          <section className="studio-stage" aria-label={t(locale, "previewTitle")}>
            <div className="stage-wrap">
              <div className="stage" id="stage" data-aspect={DEFAULT_ASPECT} aria-pressed="false">
                <button type="button" className="studio-empty" id="studioEmpty" aria-label={t(locale, "studioEmpty")} />
                <PreviewChrome locale={locale} />
                <div className="preview-transport" id="previewTransport">
                  <PreviewStatus locale={locale} />
                  <input
                    id="previewSeek"
                    className="preview-seek"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0}
                    disabled
                    aria-label={t(locale, "previewSeekAria")}
                  />
                  <span className="preview-time" id="previewTime" aria-hidden="true">
                    0:00
                  </span>
                  <div className="preview-actions">
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
                </div>
              </div>
            </div>
            <LiveFeedback id="previewFeedback" place="preview" />
            <section className="studio-options" aria-labelledby="studioOptionsTitle">
              <h2 id="studioOptionsTitle" className="studio-options-heading">
                {t(locale, "studioOptions")}
              </h2>
              <div className="studio-option-sheet">
                <div className="studio-option-tabs" role="tablist" aria-labelledby="studioOptionsTitle">
                  {OPTION_TABS.map(([id, labelKey, legendKey]) => (
                    <button
                      key={id}
                      type="button"
                      className="studio-option-tab"
                      id={`${id}Tab`}
                      role="tab"
                      aria-selected={optionTab === id}
                      aria-controls={`${id}Panel`}
                      aria-label={t(locale, legendKey)}
                      onClick={() => setOptionTab(id)}
                    >
                      {id === "character" ? (
                        <>
                          <span className="studio-option-tab-full">{t(locale, labelKey)}</span>
                          <span className="studio-option-tab-short">{t(locale, "studioTabCharacterShort")}</span>
                        </>
                      ) : (
                        t(locale, labelKey)
                      )}
                    </button>
                  ))}
                </div>
                <div className="studio-option-panels">
                  <fieldset
                    className="aspect-field"
                    id="aspectPanel"
                    role="tabpanel"
                    aria-labelledby="aspectTab"
                    hidden={optionTab !== "aspect"}
                  >
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
                  <fieldset
                    className="aspect-field"
                    id="swapPanel"
                    role="tabpanel"
                    aria-labelledby="swapTab"
                    hidden={optionTab !== "swap"}
                  >
                    <legend>{t(locale, "makerEffectLegend")}</legend>
                    <RadioPills
                      name="swap"
                      ariaLabel={t(locale, "makerEffectLegend")}
                      options={[
                        { value: "zoom", label: t(locale, "makerZoom"), defaultChecked: DEFAULT_SWAP_STYLE === "zoom" },
                        { value: "jump", label: t(locale, "makerJump"), defaultChecked: DEFAULT_SWAP_STYLE === "jump" },
                        { value: "catiris", label: t(locale, "makerCatIris"), defaultChecked: DEFAULT_SWAP_STYLE === "catiris" },
                      ]}
                    />
                  </fieldset>
                  <fieldset
                    className="aspect-field"
                    id="filterPanel"
                    role="tabpanel"
                    aria-labelledby="filterTab"
                    hidden={optionTab !== "filter"}
                  >
                    <legend>{t(locale, "makerFilterLegend")}</legend>
                    <RadioPills
                      name="filter"
                      className="aspect-toggle cols-3"
                      ariaLabel={t(locale, "makerFilterLegend")}
                      options={[
                        { value: "none", label: t(locale, "makerFilterNone"), defaultChecked: true },
                        { value: "blur-weak", label: t(locale, "makerFilterBlurWeak") },
                        { value: "blur-strong", label: t(locale, "makerFilterBlurStrong") },
                      ]}
                    />
                  </fieldset>
                  <fieldset
                    className="aspect-field"
                    id="characterPanel"
                    role="tabpanel"
                    aria-labelledby="characterTab"
                    hidden={optionTab !== "character"}
                  >
                    <legend>{t(locale, "makerCharacterLegend")}</legend>
                    <RadioPills
                      name="character"
                      className="aspect-toggle cols-3"
                      ariaLabel={t(locale, "makerCharacterLegend")}
                      options={[
                        { value: "standard", label: t(locale, "makerCharacterStandard"), defaultChecked: true },
                        { value: "1.2", label: t(locale, "makerCharacter12") },
                        { value: "1.4", label: t(locale, "makerCharacter14") },
                      ]}
                    />
                  </fieldset>
                </div>
              </div>
            </section>
          </section>
          <section className="studio-tools">
            <div className="preview-save">
              <Button
                variant="site"
                type="button"
                id="saveBtn"
                className="btn preview-save-btn"
                disabled
                aria-describedby="previewSaveHint"
              >
                {t(locale, "makerSave")}
              </Button>
              <JaPhrase
                id="previewSaveHint"
                className="preview-save-hint"
                locale={locale}
                text={t(locale, "previewSaveHint")}
              />
            </div>
            <dialog
              className="export-panel export-sheet"
              id="exportPanel"
              data-export-phase="busy"
              aria-labelledby="exportTitle"
              aria-describedby="exportKeepOpen"
              tabIndex={-1}
              onClose={() => exportActions.current?.syncClose()}
              onCancel={(event) => {
                event.preventDefault();
                if (event.currentTarget.dataset.exportPhase === "done") exportActions.current?.close();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const dialog = event.currentTarget;
                const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button:not([hidden]):enabled")];
                const first = buttons[0];
                const last = buttons.at(-1);
                const active = document.activeElement;
                // ネイティブ dialog からブラウザの UI へ Tab が抜けるのを防ぐ。
                if (!first || !last) {
                  event.preventDefault();
                  dialog.focus();
                } else if (event.shiftKey && (active === first || active === dialog)) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && (active === last || active === dialog)) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              <header className="preview-head">
                <h2 id="exportTitle">{t(locale, "exportTitle")}</h2>
              </header>
              <p className="export-status notranslate" id="exportStatus" translate="no" aria-live="polite" hidden />
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
              <JaPhrase
                id="exportKeepOpen"
                className="export-keep-open"
                locale={locale}
                text={t(locale, "exportKeepOpen")}
              />
              <Button
                variant="site"
                type="button"
                id="cancelExportBtn"
                className="btn ghost"
                onClick={() => exportActions.current?.cancel()}
              >
                {t(locale, "exportCancel")}
              </Button>
              <Button
                variant="site"
                type="button"
                id="downloadExportBtn"
                className="btn"
                hidden
                onClick={() => exportActions.current?.save()}
              >
                {t(locale, "exportDownload")}
              </Button>
              <Button
                variant="site"
                type="button"
                id="closeExportBtn"
                className="btn ghost"
                hidden
                onClick={() => exportActions.current?.close()}
              >
                {t(locale, "exportClose")}
              </Button>
            </dialog>
            <LiveFeedback id="saveFeedback" place="save" />
          </section>
          <LanguageNav locale={locale} view="studio" />
        </div>
        <SiteFooter locale={locale} />
      </div>
    </>
  );
}

function LiveFeedback({ id, place }: { id: string; place: FeedbackPlace }) {
  const snap = useSyncExternalStore(
    subscribeFeedback,
    () => getFeedback(place),
    () => getFeedback(place),
  );
  return (
    <p
      className="status feedback notranslate"
      id={id}
      data-kind={snap.kind}
      translate="no"
      aria-live="polite"
      hidden={snap.text.length === 0}
    >
      {snap.text}
    </p>
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
