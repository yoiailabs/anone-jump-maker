import { describe, expect, it } from "vitest";
import {
  getPhotoThumbsHandlers,
  getPhotoThumbsState,
  resetPhotoThumbsState,
  setPhotoThumbsHandlers,
  setPhotoThumbsState,
  subscribePhotoThumbs,
} from "./photo-thumbs-store.ts";

describe("photo-thumbs-store", () => {
  it("notifies subscribers when photos change and skips identical snapshots", () => {
    resetPhotoThumbsState();
    const seen: number[] = [];
    const stop = subscribePhotoThumbs(() => seen.push(getPhotoThumbsState().photos.length));
    setPhotoThumbsState({
      photos: [{ id: "a", name: "a.jpg", thumbUrl: "blob:a" }],
      locked: false,
    });
    setPhotoThumbsState({
      photos: [{ id: "a", name: "a.jpg", thumbUrl: "blob:a" }],
      locked: false,
    });
    expect(seen).toEqual([1]);
    expect(getPhotoThumbsState().photos[0]?.id).toBe("a");
    stop();
    resetPhotoThumbsState();
    expect(getPhotoThumbsState().photos).toEqual([]);
  });

  it("keeps the latest reorder/remove handlers", () => {
    resetPhotoThumbsState();
    const ids: string[][] = [];
    setPhotoThumbsHandlers({
      onReorder: (next) => ids.push([...next]),
      onRemove: () => undefined,
    });
    getPhotoThumbsHandlers().onReorder(["b", "a"]);
    expect(ids).toEqual([["b", "a"]]);
    resetPhotoThumbsState();
  });
});
