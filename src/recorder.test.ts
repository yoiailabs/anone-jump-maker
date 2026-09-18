import { describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./recorder.ts";

describe("downloadBlob", () => {
  it("clicks a temporary download link and revokes the object URL", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { href: "", download: "", rel: "", click, remove };
    const createElement = vi.fn(() => anchor);
    const append = vi.fn();
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("document", {
      createElement,
      body: { append },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("window", { setTimeout });

    try {
      downloadBlob(new Blob(["x"], { type: "video/mp4" }), "anone-jump-16x9.mp4");
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(anchor.download).toBe("anone-jump-16x9.mp4");
      expect(anchor.rel).toBe("noopener");
      expect(append).toHaveBeenCalledWith(anchor);
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(4_000);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
