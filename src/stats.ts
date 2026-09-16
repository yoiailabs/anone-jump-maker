import { OUTPUT } from "./layout.ts";
import {
  parseStatsCount,
  sanitizeGenerateAttrs,
  summarizeUserAgent,
  type ExportMode,
  type GenerateAttrs,
} from "./stats-shared.ts";

export { formatCountLabel, parseStatsCount } from "./stats-shared.ts";

export async function fetchGenerateCount(): Promise<number | null> {
  try {
    const response = await fetch("/api/stats", { method: "GET", credentials: "same-origin" });
    if (!response.ok) return null;
    return parseStatsCount(await response.json());
  } catch {
    return null;
  }
}

export async function recordGenerate(partial: {
  exportMode: ExportMode;
  mime: string;
  width?: number;
  height?: number;
}): Promise<number | null> {
  try {
    const response = await fetch("/api/stats/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collectClientAttrs(partial)),
    });
    if (!response.ok) return null;
    return parseStatsCount(await response.json());
  } catch {
    return null;
  }
}

export function collectClientAttrs(partial: {
  exportMode: ExportMode;
  mime: string;
  width?: number;
  height?: number;
}): GenerateAttrs {
  const ua = summarizeUserAgent(typeof navigator === "undefined" ? "" : navigator.userAgent);
  const language = typeof navigator === "undefined" ? undefined : navigator.language;
  const timezone =
    typeof Intl === "undefined" ? undefined : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screenW = typeof screen === "undefined" ? undefined : screen.width;
  const screenH = typeof screen === "undefined" ? undefined : screen.height;
  const dpr = typeof window === "undefined" ? undefined : window.devicePixelRatio;
  return sanitizeGenerateAttrs({
    ...ua,
    language,
    timezone,
    screenW,
    screenH,
    dpr,
    exportMode: partial.exportMode,
    mime: partial.mime.split(";")[0]?.trim(),
    width: partial.width ?? OUTPUT.width,
    height: partial.height ?? OUTPUT.height,
  });
}
