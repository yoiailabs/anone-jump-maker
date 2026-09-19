import { nearestIndexByClientX } from "./photo-list.ts";

export type ThumbPhoto = {
  id: string;
  name: string;
  thumbUrl: string;
};

export type ThumbCopy = {
  listLabel: string;
  photoAlt: (index: number, name: string) => string;
  removeLabel: (index: number) => string;
  itemLabel: (index: number) => string;
};

export type ThumbEvents = {
  copy: ThumbCopy;
  isLocked: () => boolean;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
};

const DRAG_MOVE_PX = 8;
const TOUCH_HOLD_MS = 280;
const EDGE_SCROLL_PX = 40;

type DragState = {
  pointerId: number;
  item: HTMLElement;
  startX: number;
  startY: number;
  started: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
};

export function renderPhotoThumbs(
  container: HTMLElement,
  photos: readonly ThumbPhoto[],
  copy: ThumbCopy,
  options: { disabled?: boolean } = {},
): void {
  container.hidden = photos.length === 0;
  container.setAttribute("role", "list");
  container.setAttribute("aria-label", copy.listLabel);
  const disabled = Boolean(options.disabled);
  container.replaceChildren(...photos.map((photo, index) => createThumb(photo, index, copy, disabled)));
}

export function bindPhotoThumbs(container: HTMLElement, events: ThumbEvents): void {
  let drag: DragState | null = null;

  const idsFromDom = () =>
    [...container.querySelectorAll<HTMLElement>(".thumb")].map((el) => el.dataset.photoId ?? "").filter(Boolean);

  const commitReorder = () => {
    syncThumbLabels(container, events.copy);
    events.onReorder(idsFromDom());
  };

  const clearHold = () => {
    if (drag?.holdTimer == null) return;
    clearTimeout(drag.holdTimer);
    drag.holdTimer = null;
  };

  const startDrag = (state: DragState) => {
    if (state.started || events.isLocked()) return;
    state.started = true;
    state.item.classList.add("is-dragging");
    try {
      state.item.setPointerCapture(state.pointerId);
    } catch {
      // capture できない環境でも pointermove はコンテナで拾う
    }
  };

  const endDrag = (pointerId: number) => {
    if (!drag || drag.pointerId !== pointerId) return;
    clearHold();
    const { item, started } = drag;
    item.classList.remove("is-dragging");
    try {
      item.releasePointerCapture(pointerId);
    } catch {
      // 未 capture
    }
    drag = null;
    if (started && !events.isLocked()) commitReorder();
  };

  const moveDraggedItem = (clientX: number) => {
    if (!drag?.started) return;
    const items = [...container.querySelectorAll<HTMLElement>(".thumb")];
    const from = items.indexOf(drag.item);
    if (from < 0) return;
    const to = nearestIndexByClientX(
      clientX,
      items.map((el) => el.getBoundingClientRect()),
    );
    if (to !== from) {
      const target = items[to];
      if (target) {
        if (to < from) container.insertBefore(drag.item, target);
        else container.insertBefore(drag.item, target.nextSibling);
      }
    }
    const box = container.getBoundingClientRect();
    if (clientX < box.left + EDGE_SCROLL_PX) container.scrollLeft -= 16;
    else if (clientX > box.right - EDGE_SCROLL_PX) container.scrollLeft += 16;
  };

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || events.isLocked()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".thumb-remove")) return;
    const item = target.closest<HTMLElement>(".thumb");
    if (!item || !container.contains(item)) return;
    drag = {
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      holdTimer: null,
    };
    if (event.pointerType === "mouse") {
      try {
        item.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    drag.holdTimer = setTimeout(() => {
      if (drag && drag.pointerId === event.pointerId) startDrag(drag);
    }, TOUCH_HOLD_MS);
  });

  container.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const dist = Math.hypot(dx, dy);
    if (!drag.started) {
      if (event.pointerType === "mouse") {
        if (dist >= DRAG_MOVE_PX) startDrag(drag);
      } else if (dist >= DRAG_MOVE_PX) {
        clearHold();
        drag = null;
        return;
      }
    }
    if (drag?.started) moveDraggedItem(event.clientX);
  });

  container.addEventListener("pointerup", (event) => endDrag(event.pointerId));
  container.addEventListener("pointercancel", (event) => endDrag(event.pointerId));
  container.addEventListener("lostpointercapture", (event) => {
    if (drag && event.pointerId === drag.pointerId && drag.started) endDrag(event.pointerId);
  });

  container.addEventListener("click", (event) => {
    if (events.isLocked()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const remove = target.closest(".thumb-remove");
    if (!remove) return;
    const item = remove.closest<HTMLElement>(".thumb");
    const id = item?.dataset.photoId;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    events.onRemove(id);
  });

  container.addEventListener("keydown", (event) => {
    if (events.isLocked()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest<HTMLElement>(".thumb");
    if (!item || !container.contains(item) || target.closest(".thumb-remove")) return;
    const items = [...container.querySelectorAll<HTMLElement>(".thumb")];
    const from = items.indexOf(item);
    if (from < 0) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const to = event.key === "ArrowLeft" ? from - 1 : from + 1;
      if (to < 0 || to >= items.length) return;
      event.preventDefault();
      const ref = items[to]!;
      if (to < from) container.insertBefore(item, ref);
      else container.insertBefore(item, ref.nextSibling);
      item.focus();
      commitReorder();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      const id = item.dataset.photoId;
      if (!id) return;
      event.preventDefault();
      events.onRemove(id);
    }
  });
}

function createThumb(photo: ThumbPhoto, index: number, copy: ThumbCopy, disabled: boolean): HTMLElement {
  const item = document.createElement("div");
  item.className = "thumb";
  item.tabIndex = disabled ? -1 : 0;
  item.dataset.photoId = photo.id;
  item.dataset.photoName = photo.name;
  item.setAttribute("role", "listitem");
  item.setAttribute("aria-label", copy.itemLabel(index));
  item.setAttribute("aria-disabled", disabled ? "true" : "false");

  const img = document.createElement("img");
  img.src = photo.thumbUrl;
  img.alt = copy.photoAlt(index, photo.name);
  img.draggable = false;

  const badge = document.createElement("span");
  badge.className = "thumb-index";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = String(index + 1);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "thumb-remove";
  remove.setAttribute("aria-label", copy.removeLabel(index));
  remove.disabled = disabled;
  remove.textContent = "×";

  item.append(img, badge, remove);
  return item;
}

function syncThumbLabels(container: HTMLElement, copy: ThumbCopy): void {
  for (const [index, item] of [...container.querySelectorAll<HTMLElement>(".thumb")].entries()) {
    const name = item.dataset.photoName ?? "";
    item.setAttribute("aria-label", copy.itemLabel(index));
    const img = item.querySelector("img");
    if (img) img.alt = copy.photoAlt(index, name);
    const badge = item.querySelector(".thumb-index");
    if (badge) badge.textContent = String(index + 1);
    const remove = item.querySelector(".thumb-remove");
    if (remove) remove.setAttribute("aria-label", copy.removeLabel(index));
  }
}
