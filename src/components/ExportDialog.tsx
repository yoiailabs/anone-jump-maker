import { t, type Locale } from "../i18n.ts";
import { Button } from "./ui/button";
export function ExportDialog({ locale }: { locale: Locale }) {
  return (
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
        <p
          className="export-status notranslate"
          id="exportStatus"
          translate="no"
          aria-live="polite"
        >
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
          <span
            className="export-progress-label notranslate"
            id="exportProgressLabel"
            translate="no"
          >
            {t(locale, "exportPercent", { percent: 0 })}
          </span>
        </div>
        <p className="export-keep-open" id="exportKeepOpen">
          {t(locale, "exportKeepOpen")}
        </p>
        <p className="export-download-hint" id="exportDownloadHint" hidden>
          {t(locale, "exportDownloadHint")}
        </p>
        <Button
          variant="site"
          type="button"
          id="cancelExportBtn"
          className="btn ghost"
        >
          {t(locale, "exportCancel")}
        </Button>
        <Button
          variant="site"
          type="button"
          id="downloadExportBtn"
          className="btn"
          hidden
        >
          {t(locale, "exportDownload")}
        </Button>
        <Button
          variant="site"
          type="button"
          id="closeExportBtn"
          className="btn ghost"
          hidden
        >
          {t(locale, "exportClose")}
        </Button>
      </div>
    </dialog>
  );
}
