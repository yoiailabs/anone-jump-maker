import type { Locale } from "../i18n";
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
} from "./StudioParts";
import { ExportDialog } from "./ExportDialog";
import { SiteFooter } from "./SiteFooter";
export default function MakerApp({ locale }: { locale: Locale }) {
  const error = useMakerBoot(locale);
  return (
    <div className="studio-shell" id="makerView">
      <EditorHeader locale={locale} />
      <main className="studio-workspace">
        <Preview locale={locale} />
        <section className="studio-dock">
          <Photos locale={locale} />
          <div className="dock-controls">
            <Aspect locale={locale} />
            <Settings locale={locale} />
            <SaveButton locale={locale} />
          </div>
          <Status locale={locale} />
          {error && <p role="alert">{error}</p>}
        </section>
      </main>
      <div className="editor-footer">
        <ShareControls locale={locale} />
        <SiteFooter locale={locale} />
      </div>
      <ExportDialog locale={locale} />
    </div>
  );
}
