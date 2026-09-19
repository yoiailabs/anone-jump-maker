import { afterEach, describe, expect, it, vi } from "vitest";
import { bindPhotoThumbs, renderPhotoThumbs, THUMB_LONG_PRESS_MS, type ThumbCopy } from "./thumbs.ts";

const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const copy: ThumbCopy = {
  listLabel: "photos",
  photoAlt: (_index, name) => name,
  removeLabel: (index) => `remove ${index}`,
  itemLabel: (index) => `item ${index}`,
};

const photos = [
  { id: "a", name: "a.jpg", thumbUrl: PIXEL },
  { id: "b", name: "b.jpg", thumbUrl: PIXEL },
];

function idsOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".thumb")].map((el) => el.dataset.photoId ?? "");
}

function pointer(target: EventTarget, type: string, init: PointerEventInit): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      ...init,
    }),
  );
}

function mount(): { container: HTMLElement; onReorder: ReturnType<typeof vi.fn> } {
  const style = document.createElement("style");
  style.textContent = `
    .thumbs { display: flex; flex-wrap: wrap; gap: 8px; width: 240px; }
    .thumb { width: 80px; height: 80px; }
  `;
  document.head.append(style);
  const container = document.createElement("div");
  container.className = "thumbs";
  document.body.append(container);
  const onReorder = vi.fn();
  renderPhotoThumbs(container, photos, copy);
  bindPhotoThumbs(container, {
    copy,
    isLocked: () => false,
    onReorder,
    onRemove: () => undefined,
  });
  return { container, onReorder };
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach((el) => el.remove());
});

describe("bindPhotoThumbs touch gestures", () => {
  it("does not reorder on a quick horizontal swipe", () => {
    const { container, onReorder } = mount();
    const first = container.querySelector<HTMLElement>(".thumb")!;
    const start = first.getBoundingClientRect();
    pointer(first, "pointerdown", { clientX: start.left + 8, clientY: start.top + 8 });
    pointer(container, "pointermove", { clientX: start.left + 70, clientY: start.top + 8 });
    pointer(first, "pointerup", { clientX: start.left + 70, clientY: start.top + 8 });
    expect(idsOf(container)).toEqual(["a", "b"]);
    expect(onReorder).not.toHaveBeenCalled();
    expect(first.classList.contains("is-dragging")).toBe(false);
  });

  it("reorders after a long press then drag onto the neighbor", async () => {
    const { container, onReorder } = mount();
    const [first, second] = container.querySelectorAll<HTMLElement>(".thumb");
    const start = first!.getBoundingClientRect();
    const dest = second!.getBoundingClientRect();
    pointer(first!, "pointerdown", { clientX: start.left + 8, clientY: start.top + 8 });
    await new Promise((resolve) => setTimeout(resolve, THUMB_LONG_PRESS_MS + 40));
    expect(first!.classList.contains("is-dragging")).toBe(true);
    pointer(container, "pointermove", {
      clientX: dest.left + dest.width / 2,
      clientY: dest.top + dest.height / 2,
    });
    pointer(first!, "pointerup", {
      clientX: dest.left + dest.width / 2,
      clientY: dest.top + dest.height / 2,
    });
    expect(idsOf(container)).toEqual(["b", "a"]);
    expect(onReorder).toHaveBeenCalledWith(["b", "a"]);
  });
});
