import { describe, expect, it, vi } from "vitest";
import { blobForDownload, downloadBlob } from "./recorder.ts";

describe("blobForDownload", () => {
  it("retypes the blob as octet-stream without changing its bytes", () => {
    const source = new Blob(["jump"], { type: "video/mp4" });
    const download = blobForDownload(source);
    expect(download).not.toBe(source);
    expect(download.type).toBe("application/octet-stream");
    expect(download.size).toBe(source.size);
  });

  it("keeps webm bytes the same length", () => {
    const source = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/webm" });
    const download = blobForDownload(source);
    expect(download.type).toBe("application/octet-stream");
    expect(download.size).toBe(4);
  });
});

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
      const source = new Blob(["x"], { type: "video/mp4" });
      downloadBlob(source, "anone-jump-16x9.mp4");
      expect(createObjectURL).toHaveBeenCalledOnce();
      const offered = createObjectURL.mock.calls[0]?.[0] as Blob;
      expect(offered.type).toBe("application/octet-stream");
      expect(offered.size).toBe(source.size);
      expect(source.type).toBe("video/mp4");
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

  it("keeps a webm filename while serving octet-stream", () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", rel: "", click, remove: vi.fn() };
    const createObjectURL = vi.fn(() => "blob:webm");

    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { append: vi.fn() },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { setTimeout });

    try {
      downloadBlob(new Blob(["wm"], { type: "video/webm" }), "anone-jump.webm");
      const offered = createObjectURL.mock.calls[0]?.[0] as Blob;
      expect(offered.type).toBe("application/octet-stream");
      expect(anchor.download).toBe("anone-jump.webm");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
