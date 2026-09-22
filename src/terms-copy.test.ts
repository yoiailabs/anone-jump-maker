import { describe, expect, it } from "vitest";
import { LOCALES } from "./messages.ts";
import { termsDocument, type TermsBlock, type TermsPart } from "./terms-copy.ts";

function shape(blocks: TermsBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "ul" || block.type === "ol") return `${block.type}:${block.items.length}`;
      return "p";
    })
    .join(",");
}

function partsOf(block: TermsBlock): TermsPart[] {
  if (block.type === "p") return block.parts;
  if (block.type === "ol") return block.items.flat();
  return [];
}

describe("terms of use copy", () => {
  it("keeps articles 1 through 13 in the same shape in every language", () => {
    const ja = termsDocument("ja");
    expect(ja.sections.map((section) => section.heading)).toEqual([
      "第1条　本サービスの位置付け",
      "第2条　規約への同意",
      "第3条　利用目的と範囲",
      "第4条　公式素材および生成動画の権利",
      "第5条　写真等の持込みと第三者の権利",
      "第6条　生成動画の公開・共有",
      "第7条　禁止事項",
      "第8条　権利者からの申出および規約違反への対応",
      "第9条　利用環境とサービスの変更・停止",
      "第10条　責任の範囲",
      "第11条　本規約の変更",
      "第12条　準拠法・紛争解決",
      "第13条　お問い合わせ",
    ]);
    const jaShape = ja.sections.map((section) => shape(section.blocks));
    for (const locale of LOCALES) {
      const doc = termsDocument(locale);
      expect(doc.sections).toHaveLength(13);
      expect(doc.sections.map((section) => shape(section.blocks))).toEqual(jaShape);
      const text = JSON.stringify(doc);
      expect(text).toContain("Yoiailabs");
      expect(text).not.toContain("【要記入");
      expect(text).not.toContain("編集者向け");
      expect(text).not.toContain("運営主体");
      expect(text).not.toContain("お問い合わせ先");
      const privacy = doc.sections
        .flatMap((section) => section.blocks)
        .flatMap(partsOf)
        .find((part) => typeof part !== "string" && part.kind === "privacy");
      expect(privacy).toBeTruthy();
    }
  });

  it("keeps the unofficial status, use limits, and the ban on commercial use", () => {
    const ja = JSON.stringify(termsDocument("ja"));
    expect(ja).toContain("非公式サービス");
    expect(ja).toContain("運営者は公式素材の権利者ではありません");
    expect(ja).toContain("非営利のファン活動");
    expect(ja).toContain("営利目的に使用する行為");
    expect(ja).toContain("運営名：Yoiailabs（個人制作者）");
    expect(ja).toContain("確認に必要な場合は追加の情報をお願いすることがあります。");
    expect(ja).not.toContain("GitHub Issues");
    expect(termsDocument("ja").enactedValue).toBe("2026年9月22日");
    expect(termsDocument("ja").revisedValue).toBe("2026年9月22日");
    expect(termsDocument("ja").effectiveValue).toBe("2026年9月22日");
    expect(termsDocument("en")).toEqual(termsDocument("ja"));
    expect(termsDocument("ko")).toEqual(termsDocument("ja"));
    expect(termsDocument("zh")).toEqual(termsDocument("ja"));
    expect(ja).not.toContain("unofficial service");
    expect(ja).not.toContain("Article 1");
  });
});
