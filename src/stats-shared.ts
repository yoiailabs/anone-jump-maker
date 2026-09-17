export type ExportMode = "offline" | "record";

export type GenerateAction = "preview" | "save";

export type GenerateAttrs = {
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
  timezone?: string;
  screenW?: number;
  screenH?: number;
  dpr?: number;
  exportMode?: ExportMode;
  mime?: string;
  width?: number;
  height?: number;
  action?: GenerateAction;
};

export type GenerateEvent = GenerateAttrs & {
  createdAt: string;
};

const BROWSERS = new Set(["chrome", "safari", "firefox", "edge", "opera", "other"]);
const OSES = new Set(["ios", "android", "macos", "windows", "linux", "other"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);
/** 新規保存は record 固定。offline は過去イベント用に受け付ける。 */
const EXPORT_MODES = new Set(["offline", "record"]);
const GENERATE_ACTIONS = new Set(["preview", "save"]);

export function formatCountLabel(count: number | null): string {
  if (count === null || !Number.isFinite(count)) {
    return "—回作られたよ";
  }
  return `${Math.max(0, Math.floor(count))}回作られたよ`;
}

export function summarizeUserAgent(ua: string): { browser: string; os: string; device: string } {
  const u = ua || "";
  let os = "other";
  if (/iP(hone|ad|od)/.test(u)) os = "ios";
  else if (/Android/.test(u)) os = "android";
  else if (/Mac OS X|Macintosh/.test(u)) os = "macos";
  else if (/Windows/.test(u)) os = "windows";
  else if (/Linux/.test(u)) os = "linux";

  let browser = "other";
  if (/Edg\//.test(u)) browser = "edge";
  else if (/OPR\/|Opera/.test(u)) browser = "opera";
  else if (/Firefox\/|FxiOS\//.test(u)) browser = "firefox";
  else if (/Chrome\/|CriOS\//.test(u)) browser = "chrome";
  else if (/Safari\//.test(u)) browser = "safari";

  let device = "desktop";
  if (/iPad|Tablet|Android(?!.*Mobile)/.test(u)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.+Mobile/.test(u)) device = "mobile";

  return { browser, os, device };
}

export function sanitizeGenerateAttrs(input: unknown): GenerateAttrs {
  const raw = isRecord(input) ? input : {};
  const attrs: GenerateAttrs = {};
  const browser = clip(raw.browser, 24);
  const os = clip(raw.os, 24);
  const device = clip(raw.device, 24);
  if (browser && BROWSERS.has(browser)) attrs.browser = browser;
  if (os && OSES.has(os)) attrs.os = os;
  if (device && DEVICES.has(device)) attrs.device = device;
  const language = clip(raw.language, 16);
  if (language) attrs.language = language;
  const timezone = clip(raw.timezone, 64);
  if (timezone) attrs.timezone = timezone;
  const screenW = intIn(raw.screenW, 1, 20_000);
  const screenH = intIn(raw.screenH, 1, 20_000);
  if (screenW) attrs.screenW = screenW;
  if (screenH) attrs.screenH = screenH;
  const dpr = numIn(raw.dpr, 0.5, 8);
  if (dpr !== undefined) attrs.dpr = Math.round(dpr * 10) / 10;
  const exportMode = clip(raw.exportMode, 16);
  if (exportMode && EXPORT_MODES.has(exportMode)) attrs.exportMode = exportMode as ExportMode;
  const mime = clip(raw.mime, 64);
  if (mime && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)) attrs.mime = mime.toLowerCase();
  const width = intIn(raw.width, 1, 8_000);
  const height = intIn(raw.height, 1, 8_000);
  if (width) attrs.width = width;
  if (height) attrs.height = height;
  const action = clip(raw.action, 16);
  if (action && GENERATE_ACTIONS.has(action)) attrs.action = action as GenerateAction;
  return attrs;
}

/** プレビューは再生が最後まで終わったときだけ数える。停止は数えない。 */
export function shouldCountPreview(input: {
  event: "ended" | "stop";
  playing: boolean;
  recording: boolean;
}): boolean {
  return input.event === "ended" && input.playing && !input.recording;
}

export function parseStatsCount(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  const count = payload.count;
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  return Math.max(0, Math.floor(count));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

function intIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const n = Math.round(value);
  if (n < min || n > max) return undefined;
  return n;
}

function numIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}
