import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { canRegisterServiceWorker, installabilityIssues, registerPwa } from "./pwa.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("PWA manifest", () => {
  it("meets Chromium installability fields", async () => {
    const raw = await readFile(path.join(root, "public/manifest.webmanifest"), "utf8");
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    expect(installabilityIssues(manifest)).toEqual([]);
    expect(manifest.theme_color).toBe("#F6EFE2");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("rejects a display that cannot be installed", () => {
    expect(
      installabilityIssues({
        name: "x",
        start_url: "/",
        display: "browser",
        icons: [],
      }),
    ).toEqual(["display", "icon 192x192", "icon 512x512"]);
  });

  it("ships PNG icons at the required sizes", async () => {
    const files = [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
      ["public/icons/icon-maskable-512.png", 512],
      ["public/icons/apple-touch-icon.png", 180],
    ] as const;
    for (const [file, size] of files) {
      const buf = await readFile(path.join(root, file));
      expect(buf.toString("ascii", 1, 4)).toBe("PNG");
      expect(buf.readUInt32BE(16)).toBe(size);
      expect(buf.readUInt32BE(20)).toBe(size);
    }
  });
});

describe("service worker", () => {
  it("registers a fetch handler and leaves template video alone", async () => {
    const source = await readFile(path.join(root, "public/sw.js"), "utf8");
    expect(source).toContain('addEventListener("fetch"');
    expect(source).toContain('addEventListener("install"');
    expect(source).toContain("/template/");
    expect(source).toContain('request.destination === "video"');
  });
});

describe("registerPwa", () => {
  it("registers /sw.js on a secure origin", () => {
    const register = vi.fn(async () => ({}));
    vi.stubGlobal("location", { protocol: "https:", hostname: "anone.yoiailabs.com" });
    try {
      registerPwa({ register });
      expect(register).toHaveBeenCalledWith("/sw.js", { type: "module" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("skips registration off http localhost", () => {
    const register = vi.fn(async () => ({}));
    vi.stubGlobal("location", { protocol: "http:", hostname: "example.test" });
    try {
      registerPwa({ register });
      expect(register).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("allows localhost http", () => {
    expect(canRegisterServiceWorker("http:", "127.0.0.1")).toBe(true);
    expect(canRegisterServiceWorker("http:", "localhost")).toBe(true);
    expect(canRegisterServiceWorker("https:", "anone.yoiailabs.com")).toBe(true);
    expect(canRegisterServiceWorker("http:", "anone.yoiailabs.com")).toBe(false);
  });
});
