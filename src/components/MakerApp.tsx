import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Check } from "lucide-react";
import type { Locale } from "../i18n";
import { siteCopy } from "../site-copy";
import { pauseEditor, useEditor } from "../editor-store";
import {
  EditorHeader,
  Preview,
  Photos,
  Aspect,
  Settings,
  SaveButton,
  Status,
  ShareControls,
  useMakerBoot,
  usePhotos,
} from "./StudioParts";
import { ExportDialog } from "./ExportDialog";
import { SiteFooter } from "./SiteFooter";
export default function MakerApp({ locale }: { locale: Locale }) {
  const error = useMakerBoot(locale);
  const [step, setStep] = useState(0);
  const { ready, locked, exported } = useEditor();
  const { photos } = usePhotos();
  const copy = siteCopy[locale];
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);
  const titles = [
    copy.empty,
    copy.arrange,
    copy.preview,
    exported ? copy.done : copy.finish,
  ];
  const labels = [copy.step1, copy.step2, copy.step3, copy.step4];
  useEffect(() => {
    if (step === previous.current) return;
    previous.current = step;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  function move(next: number) {
    if (locked) return;
    pauseEditor();
    setStep(next);
  }
  return (
    <div className="wizard-shell" id="makerView" data-step={step}>
      <EditorHeader locale={locale} />
      <main className="wizard-main">
        <ol className="step-dots" aria-label={copy.step}>
          {labels.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={index < step ? "complete" : ""}
            >
              <span className="sr-only">
                {index + 1}. {label}
              </span>
              <span aria-hidden="true" />
            </li>
          ))}
        </ol>
        <div className="wizard-title">
          <p>{String(step + 1).padStart(2, "0")} / 04</p>
          <h2 ref={heading} tabIndex={-1}>
            {titles[step]}
          </h2>
        </div>
        <div className="wizard-photos" hidden={step > 1}>
          <Photos locale={locale} />
          <p className="step-note">
            {step === 0 ? copy.emptyHint : copy.order}
          </p>
        </div>
        <div className="wizard-preview" hidden={step !== 2}>
          <Preview locale={locale} />
          <div className="wizard-options">
            <Aspect locale={locale} />
            <Settings locale={locale} />
          </div>
        </div>
        <div className="wizard-save" hidden={step !== 3}>
          <div className="save-symbol" aria-hidden="true">
            {exported ? (
              <Check size={46} strokeWidth={1.5} />
            ) : (
              <Download size={46} strokeWidth={1.5} />
            )}
          </div>
          <p>
            {copy.photos} · {photos.length}
          </p>
          <SaveButton locale={locale} />
          <p className="step-note">{copy.local}</p>
          <div className="wizard-share">
            <p>{copy.share}</p>
            <ShareControls locale={locale} />
          </div>
        </div>
        <div className="wizard-status">
          <Status locale={locale} />
          {error && <p role="alert">{error}</p>}
        </div>
        <nav className="wizard-navigation" aria-label={copy.step}>
          <button
            type="button"
            id="wizardBack"
            className="back-action"
            disabled={step === 0 || locked}
            onClick={() => move(step - 1)}
          >
            <ArrowLeft size={18} />
            {copy.back}
          </button>
          <button
            type="button"
            id="wizardNext"
            className="primary-action"
            hidden={step === 3}
            disabled={!ready || locked}
            onClick={() => move(step + 1)}
          >
            {copy.next}
            <ArrowRight size={18} />
          </button>
        </nav>
      </main>
      <SiteFooter locale={locale} />
      <ExportDialog locale={locale} />
    </div>
  );
}
