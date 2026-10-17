import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GA4_MEASUREMENT_ID,
  PRODUCTION_HOST,
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
  new Function("window", "document", "setTimeout", script)(win, doc, timer);
  return { win, doc, timer };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveAnalyticsConfig", () => {
  it("uses the production measurement ID by default", () => {
    expect(resolveAnalyticsConfig(undefined)).toEqual({
      measurementId: GA4_MEASUREMENT_ID,
      productionHost: PRODUCTION_HOST,
      force: false,
    });
    expect(resolveAnalyticsConfig("  ").force).toBe(false);
  });

  it("forces analytics on with an explicit measurement ID", () => {
    expect(resolveAnalyticsConfig(" G-TEST123 ")).toEqual({
      measurementId: "G-TEST123",
      productionHost: PRODUCTION_HOST,
      force: true,
    });
  });
});

describe("isAnalyticsEnabled", () => {
  it("is enabled only on the production host by default", () => {
    const config = resolveAnalyticsConfig(undefined);
    expect(isAnalyticsEnabled("anone.yoiailabs.com", config)).toBe(true);
    expect(isAnalyticsEnabled("localhost", config)).toBe(false);
    expect(isAnalyticsEnabled("cursor-foo-anone.yoiailabs.workers.dev", config)).toBe(false);
    expect(isAnalyticsEnabled("anone.example.com", config)).toBe(false);
  });

  it("is enabled everywhere when the env ID is set", () => {
    expect(isAnalyticsEnabled("localhost", resolveAnalyticsConfig("G-TEST123"))).toBe(true);
  });
});

describe("gtagBootstrapScript", () => {
  it("defines gtag and schedules loading on the production host", () => {
    const { win, doc, timer } = runBootstrap("anone.yoiailabs.com");
    expect(typeof win.gtag).toBe("function");
    expect(win.dataLayer).toEqual([]);
    expect(win.addEventListener).toHaveBeenCalledTimes(3);
    expect(doc.addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 20000);
  });

  it("does nothing on forks, previews and localhost", () => {
    for (const host of ["localhost", "127.0.0.1", "cursor-foo-anone.yoiailabs.workers.dev", "jump.example.com"]) {
      const { win, doc, timer } = runBootstrap(host);
      expect(win.gtag).toBeUndefined();
      expect(win.dataLayer).toBeUndefined();
      expect(win.addEventListener).not.toHaveBeenCalled();
      expect(doc.addEventListener).not.toHaveBeenCalled();
      expect(timer).not.toHaveBeenCalled();
    }
  });

  it("loads the configured ID when forced", () => {
    const { win, doc } = runBootstrap("localhost", "G-TEST123");
    expect(typeof win.gtag).toBe("function");
    const script: { src?: string } = {};
    doc.createElement.mockReturnValue(script);
    const load = win.addEventListener.mock.calls[0]?.[1] as () => void;
    load();
    expect(script.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    expect(doc.head.appendChild).toHaveBeenCalledWith(script);
  });

  it("keeps the production measurement ID in the loader URL", () => {
    const { win, doc } = runBootstrap("anone.yoiailabs.com");
    const script: { src?: string } = {};
    doc.createElement.mockReturnValue(script);
    (win.addEventListener.mock.calls[0]?.[1] as () => void)();
    expect(script.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`);
  });
});
