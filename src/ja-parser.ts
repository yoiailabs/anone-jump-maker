import { Parser, jaModel } from "budoux";

/** Japanese model only — loaded from a separate chunk so Chromium can skip it. */
const parser = new Parser(jaModel);

export function parseJaPhrases(text: string): string[] {
  return parser.parse(text);
}
