import { describe, expect, it } from "vitest";
import { LOCALES } from "./messages.ts";
import { privacyDocument, type PrivacyBlock } from "./privacy-copy.ts";
import { FILL_CONTACT } from "./privacy.ts";

function shape(blocks: PrivacyBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "table") return `table:${block.headers.length}x${block.rows.length}`;
      if (block.type === "ul" || block.type === "ol") return `${block.type}:${block.items.length}`;
      if (block.type === "sources") return `sources:${block.items.length}`;
      return "p";
    })
    .join(",");
}

describe("privacy policy copy", () => {
  it("keeps the same article structure in every language", () => {
    const ja = privacyDocument("ja");
    expect(ja.sections.map((section) => section.heading)).toEqual([
      "第1条　運営者と適用範囲",
      "第2条　写真・動画の取扱い",
      "第3条　取得・利用する情報と利用目的",
      "第4条　Cookie等の利用",
      "第5条　外部サービスの利用と情報の外部送信",
      "第6条　第三者提供、委託および外国での取扱い",
      "第7条　保存期間と削除",
      "第8条　安全管理と事故への対応",
      "第9条　情報収集の制限",
      "第10条　開示等の請求",
      "第11条　お問い合わせ・苦情の窓口",
      "第12条　本ポリシーの変更",
    ]);
    const jaShape = ja.sections.map((section) => shape(section.blocks));
    for (const locale of LOCALES) {
      const doc = privacyDocument(locale);
      expect(doc.sections).toHaveLength(12);
      expect(doc.sections.map((section) => shape(section.blocks))).toEqual(jaShape);
      const text = JSON.stringify(doc);
      expect(text).toContain("Yoiailabs");
      expect(text).toContain("anone-locale");
      expect(text).toContain(FILL_CONTACT);
      expect(text).not.toContain("【要記入：実際の改定日】");
      expect(text).not.toContain("【要記入：実際の適用開始日】");
      expect(text).not.toContain("編集者向け");
      expect(text).not.toContain("2026年9月21日");
    }
  });

  it("states that ordinary photo and video processing is not uploaded", () => {
    const text = JSON.stringify(privacyDocument("ja"));
    expect(text).toContain("運営者のサーバーまたは外部サービスへアップロードすることはありません");
    expect(text).toContain("個人情報を販売しません");
    expect(text).toContain("Google Analytics／Google LLC");
    expect(text).toContain("Sentry／Functional Software, Inc.");
    expect(text).toContain("Cloudflare／Cloudflare, Inc.");
    expect(text).toContain("Google Fonts／Google LLC");
    expect(text).toContain("YouTube／Google LLC");
    expect(text).toContain("X／X Corp.");
    expect(text).toContain("運営名：Yoiailabs（個人制作者）");
    expect(text).toContain("最終改定日");
    expect(privacyDocument("ja").revisedValue).toBe("2026年9月22日");
    expect(privacyDocument("ja").effectiveValue).toBe("2026年9月22日");
    expect(privacyDocument("en").revisedValue).toBe("September 22, 2026");
    expect(text).not.toContain("お問い合わせにGitHubを利用した場合");
    expect(text).not.toContain("安全管理措置の概要に関するお問い合わせ");
    expect(text).not.toContain("運営主体の氏名");
  });
});
