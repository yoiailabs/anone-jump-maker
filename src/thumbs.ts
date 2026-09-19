import { insertionIndexByClientX, nearestIndexByClientX } from "./photo-list.ts";

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
const EDGE_SCROLL_PX = 48;
const PHOTO_DRAG_TYPE = "text/plain";

type PointerDrag = {
  pointerId: number;
  item: HTMLElement;
  startX: number;
  startY: number;
  started: boolean;
};

type Html5Drag = {
  item: HTMLElement;
  lastX: number;
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
  let pointerDrag: PointerDrag | null = null;
  let html5Drag: Html5Drag | null = null;

  const thumbItems = () =>
    [...container.querySelectorAll<HTMLElement>(".thumb")].filter((el) => el.dataset.photoId);

  const idsFromDom = () => thumbItems().map((el) => el.dataset.photoId ?? "").filter(Boolean);

  const commitReorder = () => {
    syncThumbLabels(container, events.copy);
    events.onReorder(idsFromDom());
  };

  const autoScroll = (clientX: number) => {
    const box = container.getBoundingClientRect();
    if (clientX < box.left + EDGE_SCROLL_PX) container.scrollLeft -= 20;
    else if (clientX > box.right - EDGE_SCROLL_PX) container.scrollLeft += 20;
  };

  const startPointerDrag = (state: PointerDrag) => {
    if (state.started || events.isLocked()) return;
    state.started = true;
    state.item.classList.add("is-dragging");
    try {
      state.item.setPointerCapture(state.pointerId);
    } catch {
      // capture できない環境でも pointermove はコンテナで拾う
    }
  };

  const endPointerDrag = (pointerId: number) => {
    if (!pointerDrag || pointerDrag.pointerId !== pointerId) return;
    const { item, started } = pointerDrag;
    item.classList.remove("is-dragging");
    try {
      item.releasePointerCapture(pointerId);
    } catch {
      // 未 capture
    }
    pointerDrag = null;
    if (started && !events.isLocked()) commitReorder();
  };

  const movePointerItem = (clientX: number) => {
    if (!pointerDrag?.started) return;
    const items = thumbItems();
    const from = items.indexOf(pointerDrag.item);
    if (from < 0) return;
    const to = nearestIndexByClientX(
      clientX,
      items.map((el) => el.getBoundingClientRect()),
    );
    if (to !== from) {
      const target = items[to];
      if (target) {
        if (to < from) container.insertBefore(pointerDrag.item, target);
        else container.insertBefore(pointerDrag.item, target.nextSibling);
      }
    }
    autoScroll(clientX);
  };

  const clearDropMarks = () => {
    for (const el of thumbItems()) {
      el.classList.remove("drop-before", "drop-after");
    }
  };

  const markDropIndex = (item: HTMLElement, clientX: number) => {
    const others = thumbItems().filter((el) => el !== item);
    clearDropMarks();
    if (others.length === 0) return;
    const index = insertionIndexByClientX(
      clientX,
      others.map((el) => el.getBoundingClientRect()),
    );
    if (index >= others.length) others[others.length - 1]?.classList.add("drop-after");
    else others[index]?.classList.add("drop-before");
  };

  const insertAtPointer = (item: HTMLElement, clientX: number) => {
    const others = thumbItems().filter((el) => el !== item);
    const index = insertionIndexByClientX(
      clientX,
      others.map((el) => el.getBoundingClientRect()),
    );
    if (index >= others.length) container.append(item);
    else container.insertBefore(item, others[index]!);
  };

  const finishHtml5Drag = (clientX?: number) => {
    if (!html5Drag) return;
    const { item, lastX } = html5Drag;
    html5Drag = null;
    clearDropMarks();
    insertAtPointer(item, clientX ?? lastX);
    item.classList.remove("is-dragging");
    if (!events.isLocked()) commitReorder();
  };

  container.addEventListener("dragstart", (event) => {
    if (events.isLocked() || pointerDrag?.started) {
      event.preventDefault();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".thumb-remove")) {
      event.preventDefault();
      return;
    }
    const item = target.closest<HTMLElement>(".thumb");
    const id = item?.dataset.photoId;
    if (!item || !id || !container.contains(item) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(PHOTO_DRAG_TYPE, id);
    const rect = item.getBoundingClientRect();
    try {
      event.dataTransfer.setDragImage(item, event.clientX - rect.left, event.clientY - rect.top);
    } catch {
      // setDragImage が無い環境でもネイティブのドラッグ画像で進める
    }
    html5Drag = { item, lastX: event.clientX };
    item.classList.add("is-dragging");
  });

  container.addEventListener("dragenter", (event) => {
    if (!html5Drag) return;
    event.preventDefault();
  });

  container.addEventListener("dragover", (event) => {
    if (!html5Drag) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    html5Drag.lastX = event.clientX;
    markDropIndex(html5Drag.item, event.clientX);
    autoScroll(event.clientX);
  });

  container.addEventListener("drop", (event) => {
    if (!html5Drag) return;
    event.preventDefault();
    finishHtml5Drag(event.clientX);
  });

  container.addEventListener("dragend", () => {
    if (html5Drag) finishHtml5Drag();
  });

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || events.isLocked()) return;
    if (event.pointerType === "mouse") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".thumb-remove")) return;
    const item = target.closest<HTMLElement>(".thumb");
    if (!item?.dataset.photoId || !container.contains(item)) return;
    pointerDrag = {
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  });

  container.addEventListener("pointermove", (event) => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - pointerDrag.startX;
    const dy = event.clientY - pointerDrag.startY;
    if (!pointerDrag.started) {
      if (Math.hypot(dx, dy) < DRAG_MOVE_PX) return;
      startPointerDrag(pointerDrag);
    }
    if (pointerDrag?.started) {
      event.preventDefault();
      movePointerItem(event.clientX);
    }
  });

  container.addEventListener("pointerup", (event) => endPointerDrag(event.pointerId));
  container.addEventListener("pointercancel", (event) => endPointerDrag(event.pointerId));
  container.addEventListener("lostpointercapture", (event) => {
    if (pointerDrag && event.pointerId === pointerDrag.pointerId && pointerDrag.started) {
      endPointerDrag(event.pointerId);
    }
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
    if (!item?.dataset.photoId || !container.contains(item) || target.closest(".thumb-remove")) return;
    const items = thumbItems();
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
  item.draggable = !disabled;
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
  remove.draggable = false;
  remove.setAttribute("aria-label", copy.removeLabel(index));
  remove.disabled = disabled;
  remove.textContent = "×";

  item.append(img, badge, remove);
  return item;
}

function syncThumbLabels(container: HTMLElement, copy: ThumbCopy): void {
  for (const [index, item] of [...container.querySelectorAll<HTMLElement>(".thumb[data-photo-id]")].entries()) {
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
