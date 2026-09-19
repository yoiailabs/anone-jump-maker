import { describe, expect, it } from "vitest";
import {
  appendAll,
  insertionIndexByClientX,
  moveItem,
  nearestIndexByClientX,
  orderByIds,
  removeById,
  sameIdOrder,
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
