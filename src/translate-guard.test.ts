import { describe, expect, it } from "vitest";
import appSrc from "./app.ts?raw";
import makerSrc from "./components/MakerApp.tsx?raw";
import jaLedeSrc from "./components/JaLede.tsx?raw";
import layoutSrc from "./layouts/Layout.astro?raw";
import {
  bansDocumentTranslation,
  isolateVolatileChrome,
  isTranslatorCallStackOverflow,
  setTextIfChanged,
} from "./translate-guard.ts";

type FakeChrome = {
  translate: "yes" | "no";
  text: string;
  wraps: number;
};

/**
 * 翻訳ウォークがテキストを <font> で包んだあと、同じノードへの再代入で再入する経路。
 * innerHTML は毎回ミューテーションになる。setTextIfChanged は同文なら触れない。
 */
function notifyTranslator(el: FakeChrome, maxWraps = 48): void {
  if (el.translate === "no") return;
  el.wraps += 1;
  if (el.wraps > maxWraps) throw new RangeError("Maximum call stack size exceeded.");
  notifyTranslator(el, maxWraps);
}

function assignInnerHTML(el: FakeChrome, html: string): void {
  el.text = html;
  notifyTranslator(el);
}

function assignTextIfChanged(el: FakeChrome, text: string): void {
  const target = { textContent: el.text };
  if (!setTextIfChanged(target, text)) return;
  el.text = target.textContent ?? text;
  notifyTranslator(el);
}

describe("document translation", () => {
  it("does not ban page translation on the shipped HTML", () => {
    expect(bansDocumentTranslation(layoutSrc)).toBe(false);
    expect(layoutSrc).not.toMatch(/<html\b[^>]*\btranslate\s*=\s*["']?no/i);
    expect(layoutSrc).not.toMatch(/<meta\b[^>]*\bname\s*=\s*["']google["'][^>]*notranslate/i);
  });

  it("detects a full-document opt-out when all three marks are present", () => {
    expect(bansDocumentTranslation('<html lang="ja">')).toBe(false);
    expect(
      bansDocumentTranslation(
        '<html lang="ja" class="notranslate" translate="no"><meta name="google" content="notranslate">',
      ),
    ).toBe(true);
  });
});

describe("injected translator Ok/Qk walk vs our DOM updates", () => {
  it("overflows when innerHTML rewrites a translatable live control", () => {
    const button: FakeChrome = { translate: "yes", text: "再生", wraps: 0 };
    expect(() => assignInnerHTML(button, "<span>一時停止</span>")).toThrow(RangeError);
    expect(() => assignInnerHTML(button, "<span>一時停止</span>")).toThrow(
      /Maximum call stack size exceeded/,
    );
  });

  it("does not re-enter when volatile chrome is isolated and the text is unchanged", () => {
    const status: FakeChrome = { translate: "no", text: "再生中", wraps: 0 };
    expect(() => assignTextIfChanged(status, "再生中")).not.toThrow();
    expect(status.wraps).toBe(0);
    expect(status.text).toBe("再生中");
  });

  it("does not start the wrap when isolated chrome changes text", () => {
    const slot: FakeChrome = { translate: "no", text: "スロット — / 32", wraps: 0 };
    expect(() => assignTextIfChanged(slot, "スロット 2 / 32")).not.toThrow();
    expect(slot.wraps).toBe(0);
    expect(slot.text).toBe("スロット 2 / 32");
  });
});

describe("setTextIfChanged", () => {
  it("skips the write when the node already has the string", () => {
    let writes = 0;
    const el = {
      current: "停止中",
      get textContent() {
        return this.current;
      },
      set textContent(value: string) {
        writes += 1;
        this.current = value;
      },
    };
    expect(setTextIfChanged(el, "停止中")).toBe(false);
    expect(writes).toBe(0);
    expect(setTextIfChanged(el, "再生中")).toBe(true);
    expect(writes).toBe(1);
    expect(el.textContent).toBe("再生中");
  });
});

describe("isolateVolatileChrome", () => {
  it("marks only the given node, not a document root contract", () => {
    const classes: string[] = [];
    const attrs: Record<string, string> = {};
    isolateVolatileChrome({
      setAttribute(name, value) {
        attrs[name] = value;
      },
      classList: {
        add(name) {
          classes.push(name);
        },
      },
    });
    expect(attrs).toEqual({ translate: "no" });
    expect(classes).toEqual(["notranslate"]);
  });
});

describe("volatile chrome in the maker markup", () => {
  it("does not replace preview control innerHTML after boot", () => {
    expect(appSrc.includes("modalPlayBtn.innerHTML")).toBe(false);
    expect(appSrc.includes("muteBtn.innerHTML")).toBe(false);
  });

  it("isolates status chrome", () => {
    expect(makerSrc).toMatch(/id="status"[^>]*translate="no"|translate="no"[^>]*id="status"/);
    expect(makerSrc).not.toMatch(/id="slotMeter"/);
    expect(makerSrc).not.toMatch(/id="previewState"/);
    expect(appSrc).toContain("isolateVolatileChrome");
  });

  it("leaves the static hero copy translatable", () => {
    expect(makerSrc).toMatch(/id="makerTitle"/);
    expect(makerSrc).toContain('src="/brand/anone-logo-wide.svg"');
    expect(makerSrc).toMatch(/<JaLede\b/);
    expect(makerSrc).not.toMatch(/id="makerTitle"[^>]*translate="no"|translate="no"[^>]*id="makerTitle"/);
    expect(makerSrc).not.toMatch(/className="lede"[^>]*translate="no"|translate="no"[^>]*className="lede"/);
    expect(jaLedeSrc).toContain('"lede"');
    expect(jaLedeSrc).not.toMatch(/translate="no"/);
  });
});

describe("isTranslatorCallStackOverflow", () => {
  it("matches the production Ok/Qk document-url stack", () => {
    expect(isTranslatorCallStackOverflow(productionYEvent())).toBe(true);
  });

  it("keeps first-party /assets stacks even when names are two letters", () => {
    const frames = Array.from({ length: 10 }, (_, index) => ({
      filename: "https://anone.yoiailabs.com/assets/index-Dh7cYpZX.js",
      function: index % 2 === 0 ? "Ok" : "Qk",
    }));
    expect(
      isTranslatorCallStackOverflow({
        exception: {
          values: [
            {
              type: "RangeError",
              value: "Maximum call stack size exceeded.",
              stacktrace: { frames },
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it("ignores other RangeErrors and non-overflow exceptions", () => {
    expect(
      isTranslatorCallStackOverflow({
        exception: {
          values: [{ type: "RangeError", value: "Invalid array length", stacktrace: { frames: [] } }],
        },
      }),
    ).toBe(false);
    expect(
      isTranslatorCallStackOverflow({
        exception: {
          values: [{ type: "TypeError", value: "undefined is not an object", stacktrace: { frames: [] } }],
        },
      }),
    ).toBe(false);
  });
});

function productionYEvent() {
  const pair = Array.from({ length: 24 }, (_, index) => ({
    filename: "https://anone.yoiailabs.com/",
    function: index % 2 === 0 ? "Ok" : "Qk",
    lineno: 226,
    colno: index % 2 === 0 ? 63 : 408,
  }));
  return {
    exception: {
      values: [
        {
          type: "RangeError",
          value: "Maximum call stack size exceeded.",
          stacktrace: {
            frames: [
              { filename: "https://anone.yoiailabs.com/", lineno: 190, colno: 41 },
              { filename: "https://anone.yoiailabs.com/", lineno: 198, colno: 237 },
              ...pair,
            ],
          },
        },
      ],
    },
  };
}
