import { describe, expect, it } from "vitest";
import {
  PRODUCTION_BRANCH,
  applyWorkersCiTelemetryGate,
  shouldEmbedTelemetry,
} from "./telemetry-build.ts";

const DSN = "https://public@o0.ingest.sentry.io/1";
const GA = "G-TEST123";

describe("shouldEmbedTelemetry", () => {
  it("embeds on local and fork builds, where Workers CI is absent", () => {
    expect(shouldEmbedTelemetry({})).toBe(true);
    expect(shouldEmbedTelemetry({ WORKERS_CI: "", WORKERS_CI_BRANCH: "feature" })).toBe(true);
    expect(shouldEmbedTelemetry({ WORKERS_CI: "   ", WORKERS_CI_BRANCH: "feature" })).toBe(true);
  });

  it("embeds only the production branch on Workers Builds", () => {
    expect(shouldEmbedTelemetry({ WORKERS_CI: "1", WORKERS_CI_BRANCH: PRODUCTION_BRANCH })).toBe(true);
    expect(shouldEmbedTelemetry({ WORKERS_CI: "1", WORKERS_CI_BRANCH: " main " })).toBe(true);
  });

  it("drops telemetry for preview branches and a missing branch", () => {
    expect(
      shouldEmbedTelemetry({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "cursor/env-only-telemetry-23c0" }),
    ).toBe(false);
    expect(shouldEmbedTelemetry({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "" })).toBe(false);
    expect(shouldEmbedTelemetry({ WORKERS_CI: "1" })).toBe(false);
  });
});

describe("applyWorkersCiTelemetryGate", () => {
  it("keeps the values for a fork build", () => {
    const env = { VITE_SENTRY_DSN: DSN, PUBLIC_GA4_MEASUREMENT_ID: GA, OTHER: "stay" };
    expect(applyWorkersCiTelemetryGate(env)).toBe(true);
    expect(env).toEqual({ VITE_SENTRY_DSN: DSN, PUBLIC_GA4_MEASUREMENT_ID: GA, OTHER: "stay" });
  });

  it("keeps the values for the production branch", () => {
    const env = {
      WORKERS_CI: "1",
      WORKERS_CI_BRANCH: "main",
      VITE_SENTRY_DSN: DSN,
      PUBLIC_GA4_MEASUREMENT_ID: GA,
    };
    expect(applyWorkersCiTelemetryGate(env)).toBe(true);
    expect(env.VITE_SENTRY_DSN).toBe(DSN);
    expect(env.PUBLIC_GA4_MEASUREMENT_ID).toBe(GA);
  });

  it("removes both values on a preview branch and leaves other variables", () => {
    const env: Record<string, string | undefined> = {
      WORKERS_CI: "1",
      WORKERS_CI_BRANCH: "cursor/env-only-telemetry-23c0",
      VITE_SENTRY_DSN: DSN,
      PUBLIC_GA4_MEASUREMENT_ID: GA,
      OTHER: "stay",
    };
    expect(applyWorkersCiTelemetryGate(env)).toBe(false);
    expect(env.VITE_SENTRY_DSN).toBeUndefined();
    expect(env.PUBLIC_GA4_MEASUREMENT_ID).toBeUndefined();
    expect(env.OTHER).toBe("stay");
  });
});
