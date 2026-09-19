import { describe, expect, it } from "vitest";
import {
  appendAll,
  insertionIndexByClientX,
  insertionIndexByPoint,
  moveItem,
  nearestIndexByClientX,
  nearestIndexByPoint,
  orderByIds,
  PHOTO_MAX_COUNT,
  removeById,
  sameIdOrder,
  takeUpToPhotoCap,
} from "./photo-list.ts";

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("ignores out-of-range indexes and does not mutate the source", () => {
    const source = ["a", "b"];
    expect(moveItem(source, -1, 0)).toEqual(["a", "b"]);
    expect(moveItem(source, 0, 9)).toEqual(["a", "b"]);
    expect(source).toEqual(["a", "b"]);
  });
});

describe("removeById / appendAll / orderByIds", () => {
  const items = [
    { id: "a", n: 1 },
    { id: "b", n: 2 },
    { id: "c", n: 3 },
  ];

  it("removes by id and keeps the rest in order", () => {
    expect(removeById(items, "b")).toEqual({
      removed: { id: "b", n: 2 },
      rest: [
        { id: "a", n: 1 },
        { id: "c", n: 3 },
      ],
    });
    expect(removeById(items, "missing").removed).toBeUndefined();
    expect(removeById(items, "missing").rest).toEqual(items);
  });

  it("appends without dropping the existing list", () => {
    expect(appendAll(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(appendAll(["a"], [])).toEqual(["a"]);
  });

  it("keeps at most PHOTO_MAX_COUNT photos and drops the rest silently", () => {
    expect(PHOTO_MAX_COUNT).toBe(32);
    expect(takeUpToPhotoCap(0, ["a", "b"])).toEqual(["a", "b"]);
    expect(takeUpToPhotoCap(30, ["a", "b", "c", "d"])).toEqual(["a", "b"]);
    expect(takeUpToPhotoCap(32, ["a", "b"])).toEqual([]);
    expect(takeUpToPhotoCap(0, Array.from({ length: 40 }, (_, i) => i))).toEqual(
      Array.from({ length: 32 }, (_, i) => i),
    );
  });

  it("reorders by id list and appends anything missing", () => {
    expect(orderByIds(items, ["c", "a", "c", "b"])).toEqual([
      { id: "c", n: 3 },
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
    expect(orderByIds(items, ["b"]).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(sameIdOrder(items, items)).toBe(true);
    expect(sameIdOrder(items, orderByIds(items, ["b", "a", "c"]))).toBe(false);
  });
});

describe("nearestIndexByClientX / insertionIndexByClientX", () => {
  it("picks the item whose center is closest to the pointer", () => {
    const rects = [
      { left: 0, width: 40 },
      { left: 50, width: 40 },
      { left: 100, width: 40 },
    ];
    expect(nearestIndexByClientX(10, rects)).toBe(0);
    expect(nearestIndexByClientX(70, rects)).toBe(1);
    expect(nearestIndexByClientX(130, rects)).toBe(2);
    expect(nearestIndexByClientX(0, [])).toBe(0);
  });

  it("inserts before the first center the pointer has not passed", () => {
    const rects = [
      { left: 0, width: 40 },
      { left: 50, width: 40 },
    ];
    expect(insertionIndexByClientX(10, rects)).toBe(0);
    expect(insertionIndexByClientX(40, rects)).toBe(1);
    expect(insertionIndexByClientX(90, rects)).toBe(2);
    expect(insertionIndexByClientX(0, [])).toBe(0);
  });
});

describe("nearestIndexByPoint / insertionIndexByPoint", () => {
  const grid = [
    { left: 0, top: 0, width: 40, height: 40 },
    { left: 50, top: 0, width: 40, height: 40 },
    { left: 100, top: 0, width: 40, height: 40 },
    { left: 0, top: 50, width: 40, height: 40 },
    { left: 50, top: 50, width: 40, height: 40 },
  ];

  it("picks the closest center in two dimensions", () => {
    expect(nearestIndexByPoint(10, 10, grid)).toBe(0);
    expect(nearestIndexByPoint(70, 10, grid)).toBe(1);
    expect(nearestIndexByPoint(20, 70, grid)).toBe(3);
    expect(nearestIndexByPoint(70, 70, grid)).toBe(4);
    expect(nearestIndexByPoint(0, 0, [])).toBe(0);
  });

  it("inserts by reading order across wrapped rows", () => {
    expect(insertionIndexByPoint(10, 20, grid)).toBe(0);
    expect(insertionIndexByPoint(70, 20, grid)).toBe(2);
    expect(insertionIndexByPoint(130, 20, grid)).toBe(3);
    expect(insertionIndexByPoint(10, 70, grid)).toBe(3);
    expect(insertionIndexByPoint(80, 70, grid)).toBe(5);
    expect(insertionIndexByPoint(10, -8, grid)).toBe(0);
    expect(insertionIndexByPoint(200, 200, grid)).toBe(5);
    expect(insertionIndexByPoint(0, 0, [])).toBe(0);
  });
});
