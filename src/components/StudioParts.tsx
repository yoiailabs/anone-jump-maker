import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Play,
  Pause,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { pathForApp, t, type Locale } from "../i18n";
import { siteCopy } from "../site-copy";
import { DEFAULT_ASPECT } from "../layout";
import { SHARE_TEXT } from "../share";
import {
  muteButtonHtml,
  restartButtonHtml,
  PREVIEW_MUTED_DEFAULT,
} from "../preview";
import {
  getPhotoThumbsState,
  subscribePhotoThumbs,
} from "../photo-thumbs-store";
import { useEditor } from "../editor-store";
import { initSentry, reportError } from "../sentry";
import { LanguageNav } from "./LanguageNav";
import { PhotoThumbs } from "./PhotoThumbs";

export function useMakerBoot(locale: Locale) {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const init = () => initSentry();
    window.addEventListener("pointerdown", init, { once: true, passive: true });
    const timer = window.setTimeout(init, 20000);
    void import("../app")
      .then(({ boot }) => boot(root, { locale }))
      .catch((error: unknown) => {
        reportError(error);
        setError(t(locale, "makerBootFailed"));
      });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", init);
    };
  }, [locale]);
  return error;
}
export function usePhotos() {
  return useSyncExternalStore(
    subscribePhotoThumbs,
    getPhotoThumbsState,
    getPhotoThumbsState,
  );
}
export function EditorHeader({ locale }: { locale: Locale }) {
  return (
    <header className="editor-header">
      <a
        className="icon-link"
        href={pathForApp(locale, "home")}
        aria-label={siteCopy[locale].home}
      >
        <ArrowLeft size={20} />
      </a>
      <h1 id="makerTitle">{siteCopy[locale].studio}</h1>
      <LanguageNav locale={locale} view="maker" />
    </header>
  );
}
export function Preview({ locale }: { locale: Locale }) {
  const { photos } = usePhotos();
  const { ready, playing } = useEditor();
  const copy = siteCopy[locale];
  return (
    <section
      className="editor-preview"
      id="previewRegion"
      aria-label={copy.preview}
    >
      <div className="preview-canvas-area">
        <button
          type="button"
          className="stage"
          id="stage"
          data-aspect={DEFAULT_ASPECT}
          aria-pressed="false"
          aria-label={t(locale, "previewStageAria")}
          disabled={!ready}
        >
          <span className="stage-play-hint" aria-hidden="true" />
        </button>
        {photos.length === 0 && (
          <div className="preview-empty">
            <ImagePlus size={36} strokeWidth={1} />
            <p>{copy.empty}</p>
            <span>{copy.emptyHint}</span>
          </div>
        )}
      </div>
      <div className="preview-actions">
        <button
          type="button"
          id="restartBtn"
          className="control-button"
          disabled={!ready}
          dangerouslySetInnerHTML={{ __html: restartButtonHtml(locale) }}
        />
        <button
          type="button"
          id="playBtn"
          className="control-button play-control"
          disabled={!ready}
          aria-label={playing ? copy.pause : copy.play}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
          <span>{playing ? copy.pause : copy.play}</span>
        </button>
        <button
          type="button"
          id="muteBtn"
          className="control-button notranslate"
          translate="no"
          aria-pressed={PREVIEW_MUTED_DEFAULT ? "false" : "true"}
          dangerouslySetInnerHTML={{
            __html: muteButtonHtml(PREVIEW_MUTED_DEFAULT, locale),
          }}
        />
      </div>
    </section>
  );
}
export function PhotoPicker({ locale }: { locale: Locale }) {
  const { booted, locked } = useEditor();
  const { photos } = usePhotos();
  return (
    <label
      className={photos.length === 0 ? "file-btn first-picker" : "file-btn"}
    >
      <input
        id="picker"
        type="file"
        accept="image/*"
        multiple
        disabled={!booted || locked || photos.length >= 32}
      />
      <ImagePlus size={20} />
      <span id="pickerLabel">{t(locale, "makerPickPhotos")}</span>
    </label>
  );
}
export function Photos({ locale }: { locale: Locale }) {
  const { photos } = usePhotos();
  return (
    <div className="photo-collection">
      <div className="tray-heading">
        <h2>
          {siteCopy[locale].timeline}
          <span>{photos.length} / 32</span>
        </h2>
        <PhotoPicker locale={locale} />
      </div>
      <PhotoThumbs locale={locale} />
    </div>
  );
}
export function Aspect({ locale }: { locale: Locale }) {
  return (
    <fieldset className="aspect-field">
      <legend>{t(locale, "makerAspectLegend")}</legend>
      <RadioPills
        name="aspect"
        label={t(locale, "makerAspectLegend")}
        options={[
          ["landscape", t(locale, "makerLandscape")],
          ["portrait", t(locale, "makerPortrait")],
        ]}
      />
    </fieldset>
  );
}
export function Settings({ locale }: { locale: Locale }) {
  return (
    <details className="editor-settings">
      <summary>
        <SlidersHorizontal size={16} />
        {siteCopy[locale].settings}
      </summary>
      <div className="settings-grid">
        <fieldset className="aspect-field" id="swapField">
          <legend>{t(locale, "makerEffectLegend")}</legend>
          <RadioPills
            name="swap"
            label={t(locale, "makerEffectLegend")}
            options={[
              ["jump", t(locale, "makerJump")],
              ["zoom", t(locale, "makerZoom")],
            ]}
          />
        </fieldset>
        <fieldset className="aspect-field" id="filterField">
          <legend>{t(locale, "makerFilterLegend")}</legend>
          <RadioPills
            name="filter"
            label={t(locale, "makerFilterLegend")}
            options={[
              ["none", t(locale, "makerFilterNone")],
              ["blur-weak", t(locale, "makerFilterBlurWeak")],
              ["blur-strong", t(locale, "makerFilterBlurStrong")],
            ]}
          />
        </fieldset>
        <fieldset className="aspect-field" id="characterField">
          <legend>{t(locale, "makerCharacterLegend")}</legend>
          <RadioPills
            name="character"
            label={t(locale, "makerCharacterLegend")}
            options={[
              ["standard", t(locale, "makerCharacterStandard")],
              ["1.2", t(locale, "makerCharacter12")],
              ["1.4", t(locale, "makerCharacter14")],
            ]}
          />
        </fieldset>
      </div>
    </details>
  );
}
function RadioPills({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[][];
}) {
  return (
    <div className="aspect-toggle" role="radiogroup" aria-label={label}>
      {options.map(([value, text], index) => (
        <label key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            defaultChecked={index === 0}
          />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}
export function SaveButton({ locale }: { locale: Locale }) {
  const { ready, locked } = useEditor();
  return (
    <button
      id="saveBtn"
      type="button"
      className="primary-action"
      disabled={!ready || locked}
    >
      <Download size={19} />
      {siteCopy[locale].save}
    </button>
  );
}
export function Status({ locale }: { locale: Locale }) {
  return (
    <p
      className="status notranslate"
      id="status"
      data-kind="idle"
      translate="no"
      role="status"
    >
      {siteCopy[locale].local}
    </p>
  );
}
export function ShareControls({ locale }: { locale: Locale }) {
  return (
    <div className="share-controls">
      <p id="hashtagCopyHint">{SHARE_TEXT}</p>
      <div>
        <button type="button" id="copyHashtagsBtn" className="text-button">
          {t(locale, "makerCopyHashtags")}
        </button>
        <button type="button" id="shareAppBtn" className="text-button">
          {t(locale, "makerShare")}
        </button>
      </div>
    </div>
  );
}
