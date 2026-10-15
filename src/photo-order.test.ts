import { afterEach, describe, expect, it, vi } from "vitest";
import portraitCuts from "../public/template/cuts.json" with { type: "json" };
import { EXPORT_FPS, frameTimes } from "./export.ts";
import { TEMPLATE_FPS, swapFx, type SwapStyle } from "./layout.ts";
import { PHOTO_MAX_COUNT, takeUpToPhotoCap } from "./photo-list.ts";
import {
  PHOTO_DECODE_CONCURRENCY,
  loadPhotos,
  mapLimit,
  selectImageFiles,
  type LoadedPhoto,
} from "./photos.ts";
import { photoForSlot, photoIndexForSlot, slotForTime } from "./timeline.ts";

/** 報告された 32 枚の再生（1 始まり）。テンプレの再登場枠に後ろの写真を詰めた並び。 */
const REPORTED_SCRAMBLED_PLAYBACK = [
  1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 8, 14, 15, 9, 16, 17, 18, 19, 20, 21, 22, 23, 10, 24, 25, 26, 27,
  28, 29, 30, 31, 32,
];

const SLOT_COUNT = portraitCuts.slots.length;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("selection order through decode, preview, and export", () => {
  it("keeps results in input order when a 2-wide pool finishes later tasks first", async () => {
    expect(PHOTO_DECODE_CONCURRENCY).toBeGreaterThan(1);
    const gate = completionGate();
    const values = Array.from({ length: PHOTO_MAX_COUNT }, (_, index) => index);
    const pending = mapLimit(values, PHOTO_DECODE_CONCURRENCY, async (value) => {
      await gate.hold(value);
      return `p${value}`;
    });
    const finished = await gate.releaseLatestFirst(values.length, PHOTO_DECODE_CONCURRENCY);
    await expect(pending).resolves.toEqual(values.map((value) => `p${value}`));
    expect(finished).not.toEqual([...values]);
    expect(finished[0]).toBeGreaterThan(0);
  });

  it("plays and exports the capped selection in order after out-of-order decode", async () => {
    const picked = Array.from({ length: 40 }, (_, index) =>
      jpegFile(`roll-${String(40 - index).padStart(2, "0")}.jpg`, (index * 13) % 40),
    );
    const selected = takeUpToPhotoCap(0, picked);
    expect(selected.map((file) => file.name)).toEqual(picked.slice(0, PHOTO_MAX_COUNT).map((file) => file.name));
    const video = new File([new Uint8Array([0, 1, 2])], "clip.mp4", { type: "video/mp4" });
    expect(selectImageFiles([selected[0]!, video, selected[1]!]).map((file) => file.name)).toEqual([
      selected[0]!.name,
      selected[1]!.name,
    ]);

    const gate = completionGate();
    stubDecode(selected, gate);
    const loading = loadPhotos(selected);
    const finished = await gate.releaseLatestFirst(selected.length, PHOTO_DECODE_CONCURRENCY);
    const photos = await loading;

    expect(finished).not.toEqual([...selected.keys()]);
    expect(names(photos)).toEqual(namesOf(selected));
    expect(names(photos)).not.toEqual([...names(photos)].sort((a, b) => a.localeCompare(b)));
    expect(names(photos)).not.toEqual(namesOf([...selected].sort((a, b) => a.lastModified - b.lastModified)));

    const oneIndexed = slotPlates(photos, "jump").map((name) => selected.findIndex((file) => file.name === name) + 1);
    expect(oneIndexed).toEqual([...Array(SLOT_COUNT).keys()].map((slot) => (slot % selected.length) + 1));
    expect(oneIndexed).not.toEqual(REPORTED_SCRAMBLED_PLAYBACK);
    expectExportPlates(photos, "jump");
    expectExportPlates(photos, "zoom");
  });

  it("drops one failed decode without letting the race reorder the rest", async () => {
    const files = Array.from({ length: PHOTO_MAX_COUNT }, (_, index) =>
      jpegFile(`keep-${String(PHOTO_MAX_COUNT - index).padStart(2, "0")}.jpg`, (index * 5) % PHOTO_MAX_COUNT),
    );
    const broken = 11;
    const gate = completionGate();
    stubDecode(files, gate, broken);
    stubFailedHtmlDecode();
    const loading = loadPhotos(files, { onError: () => {} });
    const finished = await gate.releaseLatestFirst(files.length - 1, PHOTO_DECODE_CONCURRENCY);
    const photos = await loading;

    const kept = files.filter((_, index) => index !== broken);
    expect(finished).not.toContain(broken);
    expect(finished).not.toEqual([...finished].sort((a, b) => a - b));
    expect(names(photos)).toEqual(namesOf(kept));
    expect(names(photos)).not.toEqual([...names(photos)].sort((a, b) => a.localeCompare(b)));
    expect(names(photos)).not.toEqual(namesOf([...kept].sort((a, b) => a.lastModified - b.lastModified)));
    expect(slotPlates(photos, "jump").slice(0, kept.length)).toEqual(namesOf(kept));
    expect(photoForSlot(photos, kept.length)?.name).toBe(kept[0]?.name);
    expectExportPlates(photos, "jump");
    expectExportPlates(photos, "zoom");
  });
});

function slotPlates(photos: readonly LoadedPhoto[], style: SwapStyle): string[] {
  return portraitCuts.slots.map((time) => plateAt(photos, time, style));
}

/** 保存は全フレームをこの順で描く。ジャンプはスロットの選択順、ズームは直前 1 フレだけ前の写真。 */
function expectExportPlates(photos: readonly LoadedPhoto[], style: SwapStyle): void {
  const count = photos.length;
  for (const time of frameTimes(portraitCuts.duration, EXPORT_FPS)) {
    const slot = slotForTime(time, portraitCuts.slots);
    const current = photoIndexForSlot(slot, count);
    const previous = photoIndexForSlot(Math.max(0, slot - 1), count);
    const plate = photoIndexForSlot(swapFx(time, portraitCuts.slots, style).plateSlot, count);
    const portraitPlate = photoIndexForSlot(
      swapFx(time, portraitCuts.slots, style, "portrait").plateSlot,
      count,
    );
    if (style === "jump") {
      expect(portraitPlate, `portrait ${style} frame ${time}`).toBe(plate);
      expect(plate, `${style} frame ${time}`).toBe(current);
    } else {
      expect([current, previous], `${style} frame ${time}`).toContain(plate);
      expect([current, previous], `portrait ${style} frame ${time}`).toContain(portraitPlate);
    }
  }
  for (let slot = 1; slot < portraitCuts.slots.length; slot += 1) {
    const afterHold = portraitCuts.slots[slot]! + 1 / TEMPLATE_FPS + 1e-4;
    const plate = photoIndexForSlot(swapFx(afterHold, portraitCuts.slots, style).plateSlot, count);
    expect(plate, `${style} after cut ${slot}`).toBe(photoIndexForSlot(slot, count));
  }
}

function plateAt(photos: readonly LoadedPhoto[], time: number, style: SwapStyle): string {
  const name = photoForSlot(photos, swapFx(time, portraitCuts.slots, style).plateSlot)?.name;
  if (!name) throw new Error(`missing plate at ${time}`);
  return name;
}

function names(photos: readonly LoadedPhoto[]): string[] {
  return photos.map((photo) => photo.name);
}

function namesOf(files: readonly File[]): string[] {
  return files.map((file) => file.name);
}

/**
 * 同時デコードのうち、大きい添字から先に完了させる。
 * 完了順に push する実装だと、結果が選択順ではなくなる。
 */
function completionGate() {
  const pending = new Map<number, () => void>();
  return {
    hold(index: number) {
      return new Promise<void>((resolve) => {
        if (pending.has(index)) throw new Error(`decode ${index} waited twice`);
        pending.set(index, resolve);
      });
    },
    async releaseLatestFirst(expected: number, concurrency: number) {
      const finished: number[] = [];
      for (let spin = 0; finished.length < expected && spin < 20_000; spin += 1) {
        const waitingFor = Math.min(concurrency, expected - finished.length);
        if (pending.size < waitingFor) {
          await Promise.resolve();
          continue;
        }
        const index = Math.max(...pending.keys());
        const resolve = pending.get(index);
        if (!resolve) throw new Error(`missing decode ${index}`);
        pending.delete(index);
        finished.push(index);
        resolve();
        await Promise.resolve();
      }
      if (finished.length !== expected) {
        throw new Error(`decode gate stalled at ${finished.length}/${expected}, waiting ${[...pending.keys()].join(",")}`);
      }
      return finished;
    },
  };
}

function stubDecode(files: readonly File[], gate: ReturnType<typeof completionGate>, brokenIndex = -1): void {
  const held = new Set<number>();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (source: unknown) => {
      const index = files.findIndex((file) => file === source);
      if (index < 0) return fakeBitmap(8, 8);
      if (index === brokenIndex) throw new Error("undecodable");
      if (!held.has(index)) {
        held.add(index);
        await gate.hold(index);
      }
      return fakeBitmap(16 + index, 12);
    }),
  );
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:thumb",
    revokeObjectURL: () => {},
  });
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["x"], { type: "image/jpeg" })),
      };
    },
  });
}

function stubFailedHtmlDecode(): void {
  vi.stubGlobal(
    "Image",
    class {
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  vi.stubGlobal(
    "FileReader",
    class {
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
}

function jpegFile(name: string, lastModified: number): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], name, {
    type: "image/jpeg",
    lastModified,
  });
}

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as ImageBitmap;
}
