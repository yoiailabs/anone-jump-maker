import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gtagBootstrapScript,
  isAnalyticsEnabled,
  resolveAnalyticsConfig,
} from "./analytics-config.ts";

type FakeWindow = {
  location: { hostname: string };
  addEventListener: ReturnType<typeof vi.fn>;
  dataLayer?: unknown[];
  gtag?: unknown;
};

function runBootstrap(hostname: string, envId?: string) {
  const win: FakeWindow = { location: { hostname }, addEventListener: vi.fn() };
  const doc = { addEventListener: vi.fn(), head: { appendChild: vi.fn() }, createElement: vi.fn() };
  const timer = vi.fn();
  const script = gtagBootstrapScript(resolveAnalyticsConfig(envId));
  if (script) new Function("window", "document", "setTimeout", script)(win, doc, timer);
  return { win, doc, timer, script };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveAnalyticsConfig", () => {
  it("stays off when the measurement ID is unset", () => {
    expect(resolveAnalyticsConfig(undefined)).toEqual({ measurementId: null });
    expect(resolveAnalyticsConfig("")).toEqual({ measurementId: null });
    expect(resolveAnalyticsConfig("  ")).toEqual({ measurementId: null });
    expect(isAnalyticsEnabled(resolveAnalyticsConfig(undefined))).toBe(false);
  });

  it("enables analytics only from an explicit measurement ID", () => {
    const config = resolveAnalyticsConfig(" G-TEST123 ");
    expect(config).toEqual({ measurementId: "G-TEST123" });
    expect(isAnalyticsEnabled(config)).toBe(true);
  });
});

describe("gtagBootstrapScript", () => {
  it("emits no script when the measurement ID is unset", () => {
    for (const host of ["anone.yoiailabs.com", "localhost", "cursor-foo-anone.yoiailabs.workers.dev"]) {
      const { win, doc, timer, script } = runBootstrap(host);
      expect(script).toBe("");
      expect(script).not.toContain("googletagmanager");
      expect(win.gtag).toBeUndefined();
      expect(win.dataLayer).toBeUndefined();
      expect(win.addEventListener).not.toHaveBeenCalled();
      expect(doc.addEventListener).not.toHaveBeenCalled();
      expect(timer).not.toHaveBeenCalled();
    }
  });

  it("defines gtag on any host when an ID is set", () => {
    for (const host of ["anone.yoiailabs.com", "localhost", "jump.example.com"]) {
      const { win, doc, timer, script } = runBootstrap(host, "G-TEST123");
      expect(script).not.toContain("hostname");
      expect(typeof win.gtag).toBe("function");
      expect(win.dataLayer).toEqual([]);
      expect(win.addEventListener).toHaveBeenCalledTimes(3);
      expect(doc.addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 20000);
    }
  });

  it("loads the configured ID", () => {
    const { win, doc } = runBootstrap("localhost", "G-TEST123");
    const script: { src?: string } = {};
    doc.createElement.mockReturnValue(script);
    const load = win.addEventListener.mock.calls[0]?.[1] as () => void;
    load();
    expect(script.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    expect(doc.head.appendChild).toHaveBeenCalledWith(script);
  });
});
