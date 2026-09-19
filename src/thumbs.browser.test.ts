import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PhotoThumbs } from "./components/PhotoThumbs.tsx";
import {
  resetPhotoThumbsState,
  setPhotoThumbsHandlers,
  setPhotoThumbsState,
} from "./photo-thumbs-store.ts";

const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const photos = [
  { id: "a", name: "a.jpg", thumbUrl: PIXEL },
  { id: "b", name: "b.jpg", thumbUrl: PIXEL },
];

function idsOf(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".thumb[data-photo-id]")].map(
    (el) => el.dataset.photoId ?? "",
  );
}

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

async function mount(): Promise<{ onReorder: ReturnType<typeof vi.fn>; onRemove: ReturnType<typeof vi.fn> }> {
  const style = document.createElement("style");
  style.textContent = `
    .thumbs { display: flex; flex-wrap: wrap; gap: 8px; width: 240px; }
    .thumb { width: 80px; height: 80px; }
  `;
  document.head.append(style);
  const host = document.createElement("div");
  document.body.append(host);
  const onReorder = vi.fn();
  const onRemove = vi.fn();
  setPhotoThumbsHandlers({ onReorder, onRemove });
  const root = createRoot(host);
  act(() => {
    setPhotoThumbsState({ photos, locked: false });
    root.render(createElement(PhotoThumbs, { locale: "ja" }));
  });
  await vi.waitFor(() => {
    expect(document.querySelectorAll(".thumb[data-photo-id]")).toHaveLength(2);
  });
  return { onReorder, onRemove };
}

afterEach(() => {
  resetPhotoThumbsState();
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach((el) => el.remove());
});

describe("PhotoThumbs", () => {
  it("reorders with arrow keys and removes from the × button", async () => {
    const { onReorder, onRemove } = await mount();
    const first = document.querySelector<HTMLElement>(".thumb[data-photo-id]")!;
    act(() => {
      first.focus();
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    expect(idsOf()).toEqual(["b", "a"]);
    expect(onReorder).toHaveBeenCalledWith(["b", "a"]);

    act(() => {
      document.querySelector<HTMLButtonElement>(".thumb-remove")!.click();
    });
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("does not reorder on a quick touch swipe", async () => {
    const { onReorder } = await mount();
    const first = document.querySelector<HTMLElement>(".thumb[data-photo-id]")!;
    const start = first.getBoundingClientRect();
    act(() => {
      first.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          button: 0,
          clientX: start.left + 8,
          clientY: start.top + 8,
        }),
      );
      first.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: start.left + 70,
          clientY: start.top + 8,
        }),
      );
      first.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: start.left + 70,
          clientY: start.top + 8,
        }),
      );
    });
    expect(idsOf()).toEqual(["a", "b"]);
    expect(onReorder).not.toHaveBeenCalled();
  });
});
