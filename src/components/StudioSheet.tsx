import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { getFeedback, subscribeFeedback } from "../feedback-store.ts";
import { t, type Locale, type MessageKey } from "../i18n.ts";
import { STUDIO_TABS, sheetDragOffset, sheetOpenAfterDrag, tabForKey, type StudioTab } from "../studio-sheet.ts";

const TAB_LABELS: Record<StudioTab, MessageKey> = {
  photos: "studioTabPhotos",
  motion: "studioTabMotion",
  look: "studioTabLook",
};

/** ドラッグで開閉したあとに来る click を、もう一度の開閉として数えない時間。 */
const DRAG_CLICK_GRACE_MS = 400;

/**
 * 写真を選んだあとの編集シート。ハンドルで開閉し、ピル型タブでパネルを切り替える。
 * パネルは常にマウントしたまま hidden で隠す。boot が起動時に radio を掴んでいるため。
 * 写真を選ぶ前は「写真」パネルだけを、選ぶ導線として出す。
 */
export function StudioSheet({
  locale,
  editing,
  panels,
}: {
  locale: Locale;
  editing: boolean;
  panels: Record<StudioTab, ReactNode>;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<StudioTab>("photos");
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ y: number; id: number; moved: boolean } | null>(null);
  const swallowClickUntil = useRef(0);
  const tabRefs = useRef<Partial<Record<StudioTab, HTMLButtonElement | null>>>({});

  // 写真を選び直して編集に入るたび、最初の形（開いた「写真」）から始める。
  useEffect(() => {
    if (!editing) return;
    setOpen(true);
    setTab("photos");
  }, [editing]);

  // 写真の読み込みエラーは「写真」パネルの #photoFeedback に出る。読み込み中にタブを替えたり
  // シートをたたんだりしていても見えて読み上げられるよう、エラーが来たら開いて「写真」へ戻す。
  const photoFeedback = useSyncExternalStore(
    subscribeFeedback,
    () => getFeedback("photo"),
    () => getFeedback("photo"),
  );
  useEffect(() => {
    if (photoFeedback.kind !== "error") return;
    // 隠れるパネルにフォーカスがあると body へ落ちるので、「写真」タブへ移す。
    const panel = document.activeElement?.closest<HTMLElement>(".sheet-panel");
    if (panel && panel.dataset.panel !== "photos") tabRefs.current.photos?.focus();
    setOpen(true);
    setTab("photos");
  }, [photoFeedback]);

  const collapsed = editing && !open;
  const hint = t(locale, open ? "studioSheetHintOpen" : "studioSheetHintClosed");

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    drag.current = { y: event.clientY, id: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dy = event.clientY - current.y;
    if (Math.abs(dy) > 6) current.moved = true;
    if (current.moved) setOffset(sheetDragOffset(open, dy));
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    setOffset(0);
    if (!current.moved) return;
    swallowClickUntil.current = performance.now() + DRAG_CLICK_GRACE_MS;
    if (commit) setOpen(sheetOpenAfterDrag(open, event.clientY - current.y));
  };

  return (
    // 写真を選ぶ前は写真ピッカーだけなので、「オプション」の名前付き領域にしない。
    <section
      className="studio-sheet studio-options"
      aria-labelledby={editing ? "studioOptionsTitle" : undefined}
      data-open={open ? "true" : "false"}
      data-dragging={offset !== 0 ? "true" : undefined}
      style={offset !== 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      <h2 id="studioOptionsTitle" className="studio-visually-hidden" hidden={!editing}>
        {t(locale, "studioOptions")}
      </h2>
      {/* 読み上げ名は見えているヒントから始め、区切りのあとに操作の説明を足す（WCAG 2.5.3）。 */}
      <button
        type="button"
        className="sheet-handle"
        id="sheetHandle"
        hidden={!editing}
        aria-expanded={open}
        aria-controls="studioSheetBody"
        aria-label={`${hint}${t(locale, "studioSheetLabelSep")}${t(locale, open ? "studioSheetCollapse" : "studioSheetExpand")}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, true)}
        onPointerCancel={(event) => endDrag(event, false)}
        onClick={() => {
          if (performance.now() < swallowClickUntil.current) return;
          setOpen(!open);
        }}
      >
        <span className="sheet-grip" aria-hidden="true" />
        <span className="sheet-hint">
          {hint}
          <span aria-hidden="true">{open ? " ↓" : " ↑"}</span>
        </span>
      </button>
      <div className="sheet-body" id="studioSheetBody" inert={collapsed}>
        <div className="sheet-body-clip">
          <div className="sheet-body-inner">
            <div
              className="sheet-tabs"
              role="tablist"
              aria-label={t(locale, "studioTabs")}
              hidden={!editing}
              onKeyDown={(event) => {
                const next = tabForKey(event.key, tab);
                if (!next) return;
                event.preventDefault();
                setTab(next);
                tabRefs.current[next]?.focus();
              }}
            >
              {STUDIO_TABS.map((id) => (
                <button
                  key={id}
                  ref={(node) => {
                    tabRefs.current[id] = node;
                  }}
                  type="button"
                  role="tab"
                  className="sheet-tab"
                  id={`studioTab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`studioPanel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setTab(id)}
                >
                  {t(locale, TAB_LABELS[id])}
                </button>
              ))}
            </div>
            <div className="sheet-panels">
              {STUDIO_TABS.map((id) => (
                <div
                  key={id}
                  className="sheet-panel"
                  id={`studioPanel-${id}`}
                  data-panel={id}
                  role={editing ? "tabpanel" : undefined}
                  aria-labelledby={editing ? `studioTab-${id}` : undefined}
                  hidden={editing ? tab !== id : id !== "photos"}
                >
                  {panels[id]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
