import { useRef, useState } from "react";
import type { Locale } from "../i18n";
import { siteCopy } from "../site-copy";
import { seekEditor, useEditor } from "../editor-store";
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
function timecode(time: number) {
  const seconds = Math.max(0, Math.floor(time));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function Playhead({ locale }: { locale: Locale }) {
  const { time, duration, ready, locked } = useEditor();
  const [draft, setDraft] = useState<number | null>(null);
  const [seeking, setSeeking] = useState(false);
  const pending = useRef(false);
  const copy = siteCopy[locale];
  async function commit(value: number) {
    if (pending.current) return;
    pending.current = true;
    setSeeking(true);
    try {
      await seekEditor(value);
    } finally {
      pending.current = false;
      setSeeking(false);
      setDraft(null);
    }
  }
  return (
    <div className="playhead">
      <div className="playhead-readout">
        <span>{copy.preview}</span>
        <output>
          {timecode(draft ?? time)} <span>/ {timecode(duration)}</span>
        </output>
      </div>
      <input
        id="playhead"
        type="range"
        aria-label={copy.scrub}
        aria-valuetext={`${timecode(draft ?? time)} / ${timecode(duration)}`}
        min={0}
        max={duration || 1}
        step={0.01}
        value={draft ?? Math.min(time, duration)}
        disabled={!ready || locked || seeking}
        onChange={(event) => setDraft(Number(event.currentTarget.value))}
        onPointerUp={(event) => void commit(Number(event.currentTarget.value))}
        onPointerCancel={() => setDraft(null)}
        onKeyDown={(event) => {
          const increments: Record<string, number> = {
            ArrowLeft: -0.1,
            ArrowDown: -0.1,
            ArrowRight: 0.1,
            ArrowUp: 0.1,
            PageDown: -1,
            PageUp: 1,
          };
          if (
            !(event.key in increments) &&
            event.key !== "Home" &&
            event.key !== "End"
          )
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? duration
                : Math.max(
                    0,
                    Math.min(
                      duration,
                      (draft ?? time) + (increments[event.key] ?? 0),
                    ),
                  );
          setDraft(next);
          void commit(next);
        }}
        onBlur={(event) => {
          if (draft !== null) void commit(Number(event.currentTarget.value));
        }}
      />
      <div className="time-ruler" aria-hidden="true">
        <span>00:00</span>
        <span>{timecode(duration / 2)}</span>
        <span>{timecode(duration)}</span>
      </div>
    </div>
  );
}
export default function MakerApp({ locale }: { locale: Locale }) {
  const error = useMakerBoot(locale);
  return (
    <div className="timeline-shell" id="makerView">
      <EditorHeader locale={locale} />
      <main className="timeline-workspace">
        <Preview locale={locale} />
        <section
          className="timeline-dock"
          aria-label={siteCopy[locale].timeline}
        >
          <Playhead locale={locale} />
          <Photos locale={locale} />
          <div className="timeline-controls">
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
