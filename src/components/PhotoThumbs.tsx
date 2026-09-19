import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t, type Locale } from "../i18n.ts";
import {
  getPhotoThumbsHandlers,
  getPhotoThumbsState,
  subscribePhotoThumbs,
  type ThumbPhoto,
} from "../photo-thumbs-store.ts";

/** タッチは長押しして浮かせてから。スクロールとぶつからないようにする。 */
export const THUMB_LONG_PRESS_MS = 400;

const dropAnimation = {
  duration: 180,
  easing: "ease",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.28" } },
  }),
};

export function PhotoThumbs({ locale }: { locale: Locale }) {
  const { photos, locked } = useSyncExternalStore(
    subscribePhotoThumbs,
    getPhotoThumbsState,
    getPhotoThumbsState,
  );
  const [items, setItems] = useState<ThumbPhoto[]>(() => [...photos]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems([...photos]);
  }, [photos]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: THUMB_LONG_PRESS_MS, tolerance: 8 },
    }),
  );

  const ids = useMemo(() => items.map((photo) => photo.id), [items]);
  const activePhoto = items.find((photo) => photo.id === activeId);
  const activeIndex = activePhoto ? items.findIndex((photo) => photo.id === activeId) : -1;
  const empty = items.length === 0;

  const moveBy = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    getPhotoThumbsHandlers().onReorder(next.map((photo) => photo.id));
  };

  const onDragStart = (event: DragStartEvent) => {
    if (locked) return;
    setActiveId(String(event.active.id));
    try {
      navigator.vibrate?.(15);
    } catch {
      // vibrate が拒否されても並べ替えは続ける
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (locked || !over || active.id === over.id) return;
    const from = items.findIndex((photo) => photo.id === active.id);
    const to = items.findIndex((photo) => photo.id === over.id);
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    getPhotoThumbsHandlers().onReorder(next.map((photo) => photo.id));
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            className="thumbs"
            id="thumbs"
            hidden={empty}
            role="list"
            aria-label={t(locale, "makerThumbsLabel")}
            aria-describedby="thumbsHint"
          >
            {items.map((photo, index) => (
              <SortableThumb
                key={photo.id}
                photo={photo}
                index={index}
                locale={locale}
                locked={locked}
                onRemove={() => getPhotoThumbsHandlers().onRemove(photo.id)}
                onMove={(delta) => moveBy(index, index + delta)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={dropAnimation}>
          {activePhoto ? (
            <ThumbFace
              photo={activePhoto}
              index={activeIndex < 0 ? 0 : activeIndex}
              locale={locale}
              floating
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="thumbs-hint" id="thumbsHint" hidden={empty}>
        {t(locale, "makerThumbsHint")}
      </p>
    </>
  );
}

function SortableThumb({
  photo,
  index,
  locale,
  locked,
  onRemove,
  onMove,
}: {
  photo: ThumbPhoto;
  index: number;
  locale: Locale;
  locked: boolean;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled: locked,
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "thumb is-placeholder" : "thumb"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-photo-id={photo.id}
      data-photo-name={photo.name}
      aria-label={t(locale, "makerPhotoItem", { n: index + 1 })}
      {...attributes}
      {...listeners}
      tabIndex={locked ? -1 : 0}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.target instanceof Element && event.target.closest(".thumb-remove")) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onMove(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onMove(1);
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      <ThumbFace photo={photo} index={index} locale={locale} locked={locked} onRemove={onRemove} />
    </div>
  );
}

function ThumbFace({
  photo,
  index,
  locale,
  locked = false,
  floating = false,
  onRemove,
}: {
  photo: ThumbPhoto;
  index: number;
  locale: Locale;
  locked?: boolean;
  floating?: boolean;
  onRemove?: () => void;
}) {
  const face = (
    <>
      <img src={photo.thumbUrl} alt={photo.name.trim() || t(locale, "makerPhotoAlt", { n: index + 1 })} draggable={false} />
      <span className="thumb-index" aria-hidden="true">
        {index + 1}
      </span>
      {floating || !onRemove ? null : (
        <button
          type="button"
          className="thumb-remove"
          aria-label={t(locale, "makerRemovePhoto", { n: index + 1 })}
          disabled={locked}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!locked) onRemove();
          }}
        >
          ×
        </button>
      )}
    </>
  );
  if (floating) return <div className="thumb thumb-float">{face}</div>;
  return face;
}
