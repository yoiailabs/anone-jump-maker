import type { Locale } from "./messages.ts";

/** 文中リンク。プライバシーポリシーは表示言語の `/privacy` にする。 */
export type TermsPart = string | { kind: "privacy"; label: string };

export type TermsBlock =
  | { type: "p"; parts: TermsPart[] }
  | { type: "ol"; items: TermsPart[][] }
  | { type: "ul"; items: string[] };

export type TermsSection = { heading: string; blocks: TermsBlock[] };

export type TermsDocument = {
  enactedLabel: string;
  enactedValue: string;
  revisedLabel: string;
  revisedValue: string;
  effectiveLabel: string;
  effectiveValue: string;
  preamble: string;
  sections: TermsSection[];
};

function p(text: string): TermsBlock {
  return { type: "p", parts: [text] };
}

function ol(items: Array<string | TermsPart[]>): TermsBlock {
  return {
    type: "ol",
    items: items.map((item) => (typeof item === "string" ? [item] : item)),
  };
}

function ul(items: string[]): TermsBlock {
  return { type: "ul", items };
}

const ja: TermsDocument = {
  enactedLabel: "制定日：",
  enactedValue: "2026年9月22日",
  revisedLabel: "最終改定日：",
  revisedValue: "2026年9月22日",
  effectiveLabel: "適用開始日：",
  effectiveValue: "2026年9月22日",
  preamble:
    "この利用規約（以下「本規約」といいます。）は、Yoiailabs（個人制作者。以下「運営者」といいます。）が運営する「あのねジャンプメーカー」およびその関連ページ（以下「本サービス」といいます。）の利用条件を定めるものです。",
  sections: [
    {
      heading: "第1条　本サービスの位置付け",
      blocks: [
        ol([
          "本サービスは、アーティストグループ「ナナツカゼ」の作品を尊重し、「あのねジャンプ」のファンメイド作品の制作を楽しむための非公式サービスです。",
          "本サービスはナナツカゼ自身が提供するサービスではなく、本サービスの提供をもって、ナナツカゼによる公認・監修・素材利用の許諾があることを示すものではありません。",
          "本サービスで使用する楽曲「あのね」、ジャンプするキャラクターおよびその映像（以下、総称して「公式素材」といいます。）の著作権は、ナナツカゼに帰属します。運営者は公式素材の権利者ではありません。",
          "本規約は本サービスの利用条件を定めるものであり、ナナツカゼの公式な二次創作・二次利用ガイドラインではありません。運営者は、本規約によって公式素材の利用を許諾し、または第三者に再許諾するものではありません。",
        ]),
      ],
    },
    {
      heading: "第2条　規約への同意",
      blocks: [
        ol([
          "利用者は、本サービスを利用する前に本規約を確認し、その内容に同意したうえで利用するものとします。本規約に同意できない場合は、本サービスの利用をお控えください。",
          "本サービス上で同意の確認を求める場合は、表示された方法に従って同意してください。",
          "未成年者は、親権者その他の法定代理人の同意を得たうえで本サービスを利用してください。",
          [
            "個人情報その他の利用者に関する情報の取扱いは、別途定める",
            { kind: "privacy", label: "プライバシーポリシー" },
            "によります。本規約への同意は、法令上別途必要となる個人情報の取扱い等への同意を一括して与えるものではありません。",
          ],
        ]),
      ],
    },
    {
      heading: "第3条　利用目的と範囲",
      blocks: [
        ol([
          "本サービスは、利用者が選択した写真等と本サービス所定の公式素材を組み合わせ、本サービスが提供する機能の範囲で「あのねジャンプ」の動画を生成するために提供します。このように生成された動画を、以下「生成動画」といいます。",
          "本サービスの利用は、非営利のファン活動として生成動画を制作・鑑賞し、必要な権利・条件を確認したうえで共有する目的に限ります。",
          "利用者は、本サービスから取得した公式素材を、生成動画以外の作品、別の楽曲動画、別のミーム、独立したキャラクター素材その他「あのねジャンプ」以外の用途へ転用してはなりません。",
          "この制限は、本サービスの利用および本サービスを通じた公式素材の取得・使用に関するものです。本サービスと無関係に権利者から適法に得た権利や、法令上認められる利用を一般的に制限する趣旨ではありません。",
        ]),
      ],
    },
    {
      heading: "第4条　公式素材および生成動画の権利",
      blocks: [
        ol([
          "公式素材を含む生成動画を制作しても、公式素材の著作権が利用者または運営者に移転することはありません。",
          "利用者が選択した写真等の権利は、利用者またはその正当な権利者に留保されます。生成動画に利用者自身の創作による権利が生じる場合でも、公式素材その他の既存の著作物に関する権利は、そのまま存続します。",
          "本サービスは、公式素材や生成動画を自由に利用・配布・販売できる権利を利用者に与えるものではありません。ファンメイドであること、非営利であること、出典やクレジットを表示することだけで、必要な許諾が不要になるわけではありません。",
          "権利者が二次利用の条件を明示していない場合も、それを包括的な利用許可と解釈しないでください。また、SNS上の反応や作品の紹介等のみを根拠に、あらゆる利用が許可されたと解釈しないでください。",
          "ナナツカゼその他の権利者が利用条件・ガイドラインを公表し、または利用の停止・変更等を求めた場合は、当該条件・申出を確認し、それに反する利用をしないでください。必要な許諾が確認できない利用や、許諾範囲を超えるおそれのある利用はお控えください。",
          "権利者が利用を認める場合でも、それだけで本サービスの機能や利用範囲が自動的に拡張されるものではありません。本サービスを利用する場合は、本規約の条件にも従ってください。",
        ]),
      ],
    },
    {
      heading: "第5条　写真等の持込みと第三者の権利",
      blocks: [
        ol([
          "利用者は、自ら撮影した写真、または生成動画への加工・組込み・予定する公開について必要な権利・許諾を有する写真等を使用してください。",
          "他人が撮影・制作した写真やイラスト、人物の写った写真等を使用する場合は、著作権、肖像権、プライバシーその他の権利に配慮し、法令上必要な許諾を得てください。インターネット上で閲覧できることだけで、自由な利用が認められるわけではありません。",
          "個人を特定できる情報、住所、連絡先、秘密情報等が、意図せず写真や生成動画に含まれていないか確認してください。",
          "本サービスへの写真の選択・読込みだけで、写真や生成動画の権利を運営者へ譲渡したことにはなりません。また、運営者による広告利用・再配布等を包括的に許諾したことにもなりません。",
        ]),
      ],
    },
    {
      heading: "第6条　生成動画の公開・共有",
      blocks: [
        ol([
          "生成動画をSNSその他の外部サービスへ公開・送信する場合は、公式素材と使用した写真等の権利、投稿先の規約、楽曲・映像の利用条件を確認してください。本サービスで生成できることは、全ての投稿先で公開できることを保証するものではありません。",
          "投稿時は、ナナツカゼの公式投稿・公式広告・公式発表であると誤認されないようにしてください。必要に応じ、説明欄等にファンメイド作品であることを記載してください。",
          "出典・権利者・制作者を偽って表示したり、公式素材を自身のオリジナル作品であると表示したりしてはなりません。既に表示されている権利表示を削除・改変してはなりません。",
          "出典の明示には、例えば「楽曲・キャラクター・映像：ナナツカゼ／ファンメイド作品」と記載し、公式の楽曲ページ等へのリンクを添える方法があります。ただし、この表示自体が利用許諾になるものではなく、権利者が別途表示方法を指定した場合はその指定を確認してください。",
          "利用者が本サービスから書き出した生成動画について、投稿先の仕様に合わせた容量・形式の変換は、第3条の目的を維持する範囲で行ってください。公式素材の抜き出しや別作品への転用を目的とする編集はできません。",
          "利用者による外部サービスへの公開は、利用者自身が行います。運営者が利用者の端末内の動画や外部サービス上の投稿を管理・削除できることを前提としないでください。",
        ]),
      ],
    },
    {
      heading: "第7条　禁止事項",
      blocks: [
        p("利用者は、本サービスの利用に当たり、次の行為をしてはなりません。"),
        ol([
          "法令に違反する行為、または他者の著作権、著作者人格権、肖像権、プライバシー、名誉その他の権利を侵害する行為。",
          "公式素材の音声・映像・キャラクター等を抽出、分離または切り出し、本サービスによる「あのねジャンプ」の生成以外に使用する行為。",
          "公式素材を、素材集、音源ファイル、動画テンプレート、別の生成サービス、学習用データ等として提供・再配布・販売する行為。",
          "生成動画または公式素材を販売し、商品・サービスの広告、企業案件、販促、有料配信、商品化その他の営利目的に使用する行為。",
          "利用者自身が生成動画を収益化の対象に設定し、その動画から広告収益、販売収益等を得る行為。ただし、投稿先が利用者の意思にかかわらず表示する広告のみを理由に、この項への違反とするものではありません。",
          "ナナツカゼ、関係者または第三者への誹謗中傷、嫌がらせ、差別、脅迫、違法行為の助長等のために公式素材または生成動画を使用する行為。",
          "公式素材を、わいせつな表現、他人の尊厳を害する性的表現、または特定の個人・団体に対する暴力を賛美・扇動する表現と組み合わせる行為。",
          "ナナツカゼが特定の商品、企業、政治活動、宗教活動等を支持・推奨しているかのように表示する行為、その他公式の関与・承認について誤認させる行為。",
          "不正アクセス、セキュリティ機能の回避、過度なアクセス、サービスの妨害、その他本サービスの正常な運営を阻害する行為。",
          "第3条に定める利用目的を逸脱し、または本規約に明示した制限を回避するために本サービスを利用する行為。",
        ]),
      ],
    },
    {
      heading: "第8条　権利者からの申出および規約違反への対応",
      blocks: [
        ol([
          "運営者は、権利者からの申出、権利侵害に関する具体的な情報、本規約への違反その他本サービスの提供上の問題を把握した場合、必要な確認を行い、素材・機能の提供停止、本サービス内の掲載内容の修正・削除、技術的に可能な範囲での利用制限等の措置を講じることがあります。",
          "措置の内容は、問題の性質、緊急性、影響等を踏まえ、必要かつ合理的な範囲で判断します。可能な場合は、理由や対応内容を案内します。ただし、緊急の権利保護や不正利用への対応では、事前の告知なく措置を講じることがあります。",
          "利用者は、権利者からの正当な申出または具体的な権利侵害等に基づき、生成動画の公開停止・削除等を求められた場合、内容を確認し、必要な対応を行ってください。",
          "運営者は、利用者に外部投稿の確認・削除等を依頼することがありますが、利用者の端末内のファイルを遠隔で削除するものではありません。",
          "本条は、本サービスの素材提供・運営に関して運営者自身が負うべき義務や責任を、利用者に転嫁するものではありません。",
        ]),
      ],
    },
    {
      heading: "第9条　利用環境とサービスの変更・停止",
      blocks: [
        ol([
          "本サービスは無料で提供します。利用に必要な端末、インターネット接続、通信料金等は利用者が用意・負担するものとします。",
          "本サービスの動作や動画の生成結果は、端末、OS、ブラウザ、空き容量等の環境により異なる場合があります。運営者は、全ての環境での動作、無停止での提供、または特定の生成結果を保証するものではありません。",
          "利用者は、使用する写真の原本や保存したい生成動画を、自身で適切に保管してください。本サービスは、写真や生成動画のオンライン保管・復元を提供するものではありません。",
          "運営者は、保守、障害、外部サービスの変更、権利者からの申出、その他合理的な理由により、本サービスの機能を変更し、提供を中断し、または終了することがあります。",
          "利用者に大きな影響がある変更・終了については、可能な限り事前に本サービス上で告知します。ただし、緊急の対応が必要な場合はこの限りではありません。",
          "本条は、次条に定める運営者の責任を免除するものではありません。",
        ]),
      ],
    },
    {
      heading: "第10条　責任の範囲",
      blocks: [
        ol([
          "利用者は、自身が選択する写真等の内容および自身による生成動画の公開・利用について、法令および本規約に従って対応するものとします。",
          "利用者と第三者との間で問題が生じた場合、利用者は、自身の行為に関する事実確認や必要な対応を行うものとします。運営者も、運営者自身の行為や義務に関係する事項について必要な対応を行います。",
          "運営者の責めに帰すべき事由により利用者に損害が生じた場合、運営者は法令に従って責任を負います。ただし、運営者に故意または重大な過失がある場合を除き、賠償する損害は、現実に生じた通常かつ直接の損害の範囲とします。この制限は、法令により認められる範囲で適用します。",
          "運営者に故意または重大な過失がある場合には、前項の責任制限を適用しません。また、本規約は、消費者契約法その他の法令に基づく利用者の権利を制限するものではありません。",
        ]),
      ],
    },
    {
      heading: "第11条　本規約の変更",
      blocks: [
        ol([
          "運営者は、法令、サービス内容、権利者の方針等の変更に対応するため、本規約を変更することがあります。",
          "本規約の変更は、利用者との合意による場合、または民法上の定型約款の変更その他の法令上認められる要件を満たす場合に行います。",
          "変更する場合は、変更内容および適用開始日を本サービス上で周知します。重要な変更については、適用開始までの相当な期間を設けて告知し、法令上必要な場合には改めて同意を取得します。",
          "利用者が変更後の規約に同意しない場合は、変更後の条件による利用をお控えください。本項は、法令上認められない変更を、利用の継続や沈黙のみを理由に有効とするものではありません。",
        ]),
      ],
    },
    {
      heading: "第12条　準拠法・紛争解決",
      blocks: [
        ol([
          "本規約は日本法を準拠法とします。ただし、利用者に適用される強行法規に基づく保護を排除するものではありません。",
          "本サービスに関して問題が生じた場合は、まず次条の窓口で内容を確認し、誠実な解決に努めます。",
          "訴訟が必要となる場合の管轄裁判所は、法令の定めに従います。",
          "本規約の一部が無効と判断された場合でも、その他の条項は、法令上認められる範囲で引き続き適用されます。",
        ]),
      ],
    },
    {
      heading: "第13条　お問い合わせ",
      blocks: [
        p("本サービス、本規約、権利侵害のおそれ、素材・投稿の掲載停止等に関するお問い合わせは、次の窓口へご連絡ください。"),
        ul(["運営名：Yoiailabs（個人制作者）"]),
        p(
          "権利に関する申出では、対象のURLまたは素材、申出の内容、返信先をお知らせください。確認に必要な場合は追加の情報をお願いすることがあります。",
        ),
      ],
    },
  ],
};

const en: TermsDocument = {
  enactedLabel: "Enacted: ",
  enactedValue: "September 22, 2026",
  revisedLabel: "Last revised: ",
  revisedValue: "September 22, 2026",
  effectiveLabel: "Effective date: ",
  effectiveValue: "September 22, 2026",
  preamble:
    "These Terms of Use (these “Terms”) set the conditions for using “Anone Jump Maker” and its related pages (the “Service”), which are operated by Yoiailabs, an individual creator (the “Operator”).",
  sections: [
    {
      heading: "Article 1. Nature of the Service",
      blocks: [
        ol([
          "The Service is an unofficial service for enjoying fan-made “Anone Jump” works, with respect for the works of the artist group Nanatsukaze.",
          "The Service is not provided by Nanatsukaze. Offering the Service does not mean that Nanatsukaze has officially recognized or supervised the Service, or licensed use of the material.",
          "Copyright in the song “Anone,” the jumping characters, and their video used in the Service (together, the “Official Material”) belongs to Nanatsukaze. The Operator is not the rights holder of the Official Material.",
          "These Terms set conditions for using the Service. They are not Nanatsukaze’s official guidelines for derivative works or secondary use. The Operator does not, by these Terms, license the Official Material or sublicense it to anyone else.",
        ]),
      ],
    },
    {
      heading: "Article 2. Agreement to these Terms",
      blocks: [
        ol([
          "Before using the Service, please read these Terms and use the Service only if you agree. If you do not agree, please do not use the Service.",
          "If the Service asks you to confirm agreement, please agree by the method shown.",
          "If you are a minor, please use the Service only with the consent of a parent or other legal guardian.",
          [
            "Information about users, including personal information, is handled under the separate ",
            { kind: "privacy", label: "Privacy Policy" },
            ". Agreeing to these Terms does not, by itself, give any consent to the handling of personal information that the law requires separately.",
          ],
        ]),
      ],
    },
    {
      heading: "Article 3. Purpose and scope of use",
      blocks: [
        ol([
          "The Service combines photos you choose with the Official Material provided in the Service, and generates an “Anone Jump” video within the features the Service offers. A video generated that way is a “Generated Video.”",
          "Use of the Service is limited to making and watching Generated Videos, and sharing them after you have checked the rights and conditions that apply, as non-commercial fan activity.",
          "You must not take Official Material obtained from the Service and reuse it in works other than Generated Videos, in other music videos, in other memes, as standalone character material, or for any purpose other than Anone Jump.",
          "This limit applies to use of the Service and to obtaining or using Official Material through the Service. It is not meant to restrict, in general, rights you lawfully obtained from a rights holder apart from the Service, or uses the law allows.",
        ]),
      ],
    },
    {
      heading: "Article 4. Rights in Official Material and Generated Videos",
      blocks: [
        ol([
          "Making a Generated Video that includes Official Material does not transfer copyright in the Official Material to you or the Operator.",
          "Rights in photos you choose stay with you or the person who rightfully holds them. Even if your own creative work in a Generated Video gives rise to a right, rights in the Official Material and other existing works remain as they are.",
          "The Service does not give you a right to freely use, distribute, or sell the Official Material or Generated Videos. Being fan-made, non-commercial, or showing a source or credit does not, by itself, mean that a needed permission is unnecessary.",
          "If a rights holder has not stated conditions for secondary use, do not treat that as a blanket permission. Do not treat reactions or introductions on social media, by themselves, as permission for every use.",
          "If Nanatsukaze or another rights holder publishes conditions or guidelines, or asks that use stop or change, check that condition or request and do not use the material in a way that conflicts with it. Please refrain from a use when you cannot confirm the permission it needs, or when it may go beyond what is permitted.",
          "Even if a rights holder allows a use, that alone does not automatically expand the features or the scope of the Service. When you use the Service, also follow these Terms.",
        ]),
      ],
    },
    {
      heading: "Article 5. Photos you bring in, and third-party rights",
      blocks: [
        ol([
          "Please use photos you took yourself, or photos for which you have the rights and permissions needed to edit them into a Generated Video, include them, and publish them as you plan.",
          "If you use a photo or illustration someone else took or made, or a photo that shows a person, respect copyright, portrait rights, privacy, and other rights, and obtain any permission the law requires. Being able to view something on the internet does not, by itself, allow free use.",
          "Please check that information that can identify a person, an address, contact details, or confidential information is not included in a photo or Generated Video by mistake.",
          "Choosing or loading a photo into the Service does not assign rights in the photo or Generated Video to the Operator, and does not give the Operator a blanket permission to use them in advertising or to redistribute them.",
        ]),
      ],
    },
    {
      heading: "Article 6. Publishing and sharing Generated Videos",
      blocks: [
        ol([
          "If you publish or send a Generated Video to a social network or other external service, check the rights in the Official Material and the photos you used, the destination’s terms, and the conditions for using the song and video. Being able to generate a video in the Service does not guarantee that every destination allows you to publish it.",
          "When you post, do not make it look like an official Nanatsukaze post, advertisement, or announcement. Where it helps, say in the description or elsewhere that it is a fan-made work.",
          "Do not misstate the source, rights holder, or creator, and do not present Official Material as your own original work. Do not remove or alter a rights notice that is already shown.",
          "One way to show a source is to write, for example, “Song, characters, and video: Nanatsukaze / fan-made work,” and add a link to an official song page or similar. That notice is not itself a license. If a rights holder specifies a different way to credit the work, check that instruction.",
          "If you change the size or format of a Generated Video you exported from the Service so that it fits a destination’s requirements, do so only within the purpose in Article 3. You may not edit in order to extract Official Material or reuse it in another work.",
          "You yourself publish to external services. Do not assume that the Operator can manage or delete videos on your device or posts on an external service.",
        ]),
      ],
    },
    {
      heading: "Article 7. Prohibited conduct",
      blocks: [
        p("When using the Service, you must not do any of the following."),
        ol([
          "Breaking the law, or infringing someone else’s copyright, moral rights, portrait rights, privacy, reputation, or other rights.",
          "Extracting, separating, or cutting out audio, video, characters, or other parts of the Official Material, and using them for anything other than generating Anone Jump with the Service.",
          "Offering, redistributing, or selling Official Material as a material pack, audio file, video template, another generation service, training data, or the like.",
          "Selling Generated Videos or Official Material, or using them to advertise goods or services, for corporate sponsorships, promotion, paid distribution, merchandising, or any other commercial purpose.",
          "Setting a Generated Video to be monetized yourself and receiving advertising revenue, sales revenue, or similar income from that video. Advertising that a destination shows regardless of your intent does not, by itself, violate this item.",
          "Using Official Material or Generated Videos to defame, harass, discriminate against, or threaten Nanatsukaze, people connected with them, or anyone else, or to encourage illegal acts.",
          "Combining Official Material with obscene expression, sexual expression that harms another person’s dignity, or expression that glorifies or incites violence against a particular person or group.",
          "Displaying the material as if Nanatsukaze supports or recommends a particular product, company, political activity, religious activity, or the like, or otherwise causing a misunderstanding about official involvement or approval.",
          "Unauthorized access, bypassing security features, excessive access, interfering with the Service, or otherwise hindering normal operation of the Service.",
          "Using the Service beyond the purpose in Article 3, or in order to avoid a limit these Terms state.",
        ]),
      ],
    },
    {
      heading: "Article 8. Requests from rights holders, and responses to violations",
      blocks: [
        ol([
          "If the Operator learns of a request from a rights holder, specific information about an infringement, a violation of these Terms, or another problem in providing the Service, the Operator may check what is needed and take steps such as stopping material or features, correcting or removing content published in the Service, or limiting use to the extent technically possible.",
          "The Operator decides those steps within a necessary and reasonable range, considering the nature, urgency, and effect of the problem. Where possible, the Operator will explain the reason and what was done. For urgent protection of rights or a response to misuse, the Operator may act without advance notice.",
          "If a rights holder’s legitimate request, or a specific infringement or similar matter, asks you to stop publishing or to delete a Generated Video, please check it and take the steps that are needed.",
          "The Operator may ask you to check or delete an external post, but does not remotely delete files on your device.",
          "This article does not shift onto users the duties or responsibility the Operator itself should bear for providing material or operating the Service.",
        ]),
      ],
    },
    {
      heading: "Article 9. Environment, and changes or suspension of the Service",
      blocks: [
        ol([
          "The Service is provided free of charge. You provide and pay for the device, internet connection, communication charges, and anything else you need to use it.",
          "How the Service works, and the video it generates, may differ with the device, operating system, browser, free space, and similar conditions. The Operator does not guarantee that it works in every environment, that it is provided without interruption, or that it produces a particular result.",
          "Please keep your own copies of photos you use and of Generated Videos you want to save. The Service does not store photos or Generated Videos online, and does not restore them.",
          "The Operator may change features of the Service, interrupt it, or end it for maintenance, failures, changes to external services, a request from a rights holder, or another reasonable reason.",
          "For a change or ending that would greatly affect users, the Operator will give notice on the Service in advance when possible. This does not apply when an urgent response is needed.",
          "This article does not release the Operator from the responsibility set out in the next article.",
        ]),
      ],
    },
    {
      heading: "Article 10. Scope of liability",
      blocks: [
        ol([
          "You are responsible, under the law and these Terms, for the photos you choose and for how you publish and use Generated Videos.",
          "If a problem arises between you and a third party, you will check the facts of your own conduct and take the steps that are needed. The Operator will also take the steps that are needed for matters related to the Operator’s own conduct or duties.",
          "If a user suffers damage from a cause attributable to the Operator, the Operator is liable as the law provides. Except where the Operator acted intentionally or with gross negligence, damages are limited to ordinary and direct damage that actually occurred. This limit applies only to the extent the law allows.",
          "The limit in the previous item does not apply where the Operator acted intentionally or with gross negligence. These Terms do not limit rights you have under the Consumer Contract Act or other laws.",
        ]),
      ],
    },
    {
      heading: "Article 11. Changes to these Terms",
      blocks: [
        ol([
          "The Operator may change these Terms to respond to changes in the law, the Service, a rights holder’s policy, or similar matters.",
          "A change is made when you and the Operator agree, or when it meets the requirements the law allows, including a change to standard terms under the Civil Code.",
          "When these Terms change, the Operator will announce the changes and the effective date on the Service. For an important change, the Operator will give notice a reasonable time before it takes effect and, where the law requires, will obtain agreement again.",
          "If you do not agree to the changed Terms, please do not use the Service under the changed conditions. This item does not make a change valid, when the law does not allow it, merely because you kept using the Service or stayed silent.",
        ]),
      ],
    },
    {
      heading: "Article 12. Governing law and disputes",
      blocks: [
        ol([
          "These Terms are governed by Japanese law. They do not exclude protections that mandatory rules applicable to you provide.",
          "If a problem arises in connection with the Service, the parties will first check it through the contact in the next article and try to resolve it in good faith.",
          "If a lawsuit is needed, the court with jurisdiction is the one the law specifies.",
          "If part of these Terms is held invalid, the other provisions continue to apply to the extent the law allows.",
        ]),
      ],
    },
    {
      heading: "Article 13. Contact",
      blocks: [
        p(
          "For questions about the Service or these Terms, a possible infringement of rights, or a request to stop publishing material or posts, please contact the following.",
        ),
        ul(["Operator name: Yoiailabs (individual creator)"]),
        p(
          "For a request about rights, please tell us the URL or material, what you are asking, and an address for a reply. We may ask for more information if it is needed to check the request.",
        ),
      ],
    },
  ],
};

const ko: TermsDocument = {
  enactedLabel: "제정일: ",
  enactedValue: "2026년 9월 22일",
  revisedLabel: "최종 개정일: ",
  revisedValue: "2026년 9월 22일",
  effectiveLabel: "적용 시작일: ",
  effectiveValue: "2026년 9월 22일",
  preamble:
    "본 이용약관(이하 “본 약관”)은 Yoiailabs(개인 제작자. 이하 “운영자”)가 운영하는 「아노네 점프 메이커」 및 관련 페이지(이하 “본 서비스”)의 이용 조건을 정합니다.",
  sections: [
    {
      heading: "제1조 본 서비스의 성격",
      blocks: [
        ol([
          "본 서비스는 아티스트 그룹 Nanatsukaze의 작품을 존중하고, 「아노네 점프」의 팬메이드 작품 제작을 즐기기 위한 비공식 서비스입니다.",
          "본 서비스는 Nanatsukaze가 직접 제공하는 서비스가 아니며, 본 서비스를 제공한다고 해서 Nanatsukaze의 공인·감수 또는 소재 이용 허락이 있는 것은 아닙니다.",
          "본 서비스에서 사용하는 악곡 「아노네」, 점프하는 캐릭터 및 그 영상(이하 통틀어 “공식 소재”)의 저작권은 Nanatsukaze에 있습니다. 운영자는 공식 소재의 권리자가 아닙니다.",
          "본 약관은 본 서비스의 이용 조건을 정하는 것이며, Nanatsukaze의 공식적인 2차 창작·2차 이용 가이드라인이 아닙니다. 운영자는 본 약관으로 공식 소재의 이용을 허락하거나 제3자에게 재허락하지 않습니다.",
        ]),
      ],
    },
    {
      heading: "제2조 약관에 대한 동의",
      blocks: [
        ol([
          "이용자는 본 서비스를 이용하기 전에 본 약관을 확인하고, 그 내용에 동의한 다음 이용하는 것으로 합니다. 본 약관에 동의할 수 없으면 본 서비스 이용을 삼가 주세요.",
          "본 서비스에서 동의 확인을 요청하는 경우에는 표시된 방법에 따라 동의해 주세요.",
          "미성년자는 친권자 그 밖의 법정대리인의 동의를 받은 다음 본 서비스를 이용해 주세요.",
          [
            "개인정보 등 이용자에 관한 정보의 취급은 별도로 정하는 ",
            { kind: "privacy", label: "개인정보 처리방침" },
            "에 따릅니다. 본 약관에 동의하는 것만으로, 법령상 별도로 필요한 개인정보 취급 등에 대한 동의를 한꺼번에 한 것은 아닙니다.",
          ],
        ]),
      ],
    },
    {
      heading: "제3조 이용 목적과 범위",
      blocks: [
        ol([
          "본 서비스는 이용자가 고른 사진 등과 본 서비스가 정한 공식 소재를 조합하여, 본 서비스가 제공하는 기능의 범위에서 「아노네 점프」 영상을 생성하기 위해 제공합니다. 이렇게 생성된 영상을 이하 “생성 영상”이라 합니다.",
          "본 서비스의 이용은, 비영리 팬 활동으로서 생성 영상을 만들고 감상하며, 필요한 권리와 조건을 확인한 다음 공유하는 목적에 한정됩니다.",
          "이용자는 본 서비스에서 얻은 공식 소재를 생성 영상 이외의 작품, 다른 악곡 영상, 다른 밈, 독립된 캐릭터 소재, 그 밖에 「아노네 점프」 이외의 용도로 전용해서는 안 됩니다.",
          "이 제한은 본 서비스의 이용 및 본 서비스를 통한 공식 소재의 취득·사용에 관한 것입니다. 본 서비스와 무관하게 권리자로부터 적법하게 얻은 권리나, 법령상 인정되는 이용을 일반적으로 제한하려는 취지는 아닙니다.",
        ]),
      ],
    },
    {
      heading: "제4조 공식 소재 및 생성 영상의 권리",
      blocks: [
        ol([
          "공식 소재가 포함된 생성 영상을 만들어도, 공식 소재의 저작권이 이용자 또는 운영자에게 이전되지 않습니다.",
          "이용자가 고른 사진 등의 권리는 이용자 또는 정당한 권리자에게 남습니다. 생성 영상에 이용자 자신의 창작에 따른 권리가 생기더라도, 공식 소재 그 밖의 기존 저작물에 관한 권리는 그대로 존속합니다.",
          "본 서비스는 공식 소재나 생성 영상을 자유롭게 이용·배포·판매할 권리를 이용자에게 주지 않습니다. 팬메이드라는 점, 비영리라는 점, 출처나 크레딧을 표시하는 것만으로 필요한 허락이 필요 없어지는 것은 아닙니다.",
          "권리자가 2차 이용 조건을 명시하지 않은 경우에도 이를 포괄적인 이용 허가로 해석하지 마세요. SNS상의 반응이나 작품 소개 등만을 근거로 모든 이용이 허용되었다고 해석하지 마세요.",
          "Nanatsukaze 그 밖의 권리자가 이용 조건·가이드라인을 공표하거나 이용의 중지·변경 등을 요청한 경우에는 그 조건·신청을 확인하고, 이에 어긋나는 이용을 하지 마세요. 필요한 허락을 확인할 수 없는 이용이나, 허락 범위를 넘을 우려가 있는 이용은 삼가 주세요.",
          "권리자가 이용을 인정하는 경우에도, 그것만으로 본 서비스의 기능이나 이용 범위가 자동으로 넓어지지는 않습니다. 본 서비스를 이용하는 경우에는 본 약관의 조건도 따라 주세요.",
        ]),
      ],
    },
    {
      heading: "제5조 사진 등의 이용과 제3자의 권리",
      blocks: [
        ol([
          "이용자는 직접 촬영한 사진, 또는 생성 영상에 가공·포함·예정한 공개에 필요한 권리와 허락을 가진 사진 등을 사용해 주세요.",
          "다른 사람이 촬영·제작한 사진이나 일러스트, 사람이 찍힌 사진 등을 사용하는 경우에는 저작권, 초상권, 프라이버시 그 밖의 권리에 유의하고, 법령상 필요한 허락을 받아 주세요. 인터넷에서 볼 수 있다는 것만으로 자유로운 이용이 인정되는 것은 아닙니다.",
          "개인을 특정할 수 있는 정보, 주소, 연락처, 비밀 정보 등이 의도치 않게 사진이나 생성 영상에 포함되어 있지 않은지 확인해 주세요.",
          "본 서비스에서 사진을 선택·읽어 들이는 것만으로 사진이나 생성 영상의 권리를 운영자에게 양도한 것은 아니며, 운영자의 광고 이용·재배포 등을 포괄적으로 허락한 것도 아닙니다.",
        ]),
      ],
    },
    {
      heading: "제6조 생성 영상의 공개·공유",
      blocks: [
        ol([
          "생성 영상을 SNS 그 밖의 외부 서비스에 공개·전송하는 경우에는 공식 소재와 사용한 사진 등의 권리, 게시처의 약관, 악곡·영상의 이용 조건을 확인해 주세요. 본 서비스에서 생성할 수 있다는 것이 모든 게시처에서 공개할 수 있음을 보증하지는 않습니다.",
          "게시할 때는 Nanatsukaze의 공식 게시·공식 광고·공식 발표로 오인되지 않게 해 주세요. 필요하면 설명란 등에 팬메이드 작품임을 적어 주세요.",
          "출처·권리자·제작자를 거짓으로 표시하거나, 공식 소재를 자신의 오리지널 작품이라고 표시해서는 안 됩니다. 이미 표시된 권리 표시를 삭제·변경해서는 안 됩니다.",
          "출처 표시의 예로는 「악곡·캐릭터·영상: Nanatsukaze / 팬메이드 작품」이라고 적고, 공식 악곡 페이지 등의 링크를 덧붙이는 방법이 있습니다. 다만 이 표시 자체가 이용 허락은 아니며, 권리자가 별도로 표시 방법을 지정한 경우에는 그 지정을 확인해 주세요.",
          "이용자가 본 서비스에서 내보낸 생성 영상에 대해, 게시처 사양에 맞춘 용량·형식 변환은 제3조의 목적을 유지하는 범위에서 해 주세요. 공식 소재를 추출하거나 다른 작품으로 전용하려는 편집은 할 수 없습니다.",
          "외부 서비스에 대한 공개는 이용자 자신이 합니다. 운영자가 이용자 기기 안의 영상이나 외부 서비스의 게시물을 관리·삭제할 수 있다고 전제하지 마세요.",
        ]),
      ],
    },
    {
      heading: "제7조 금지 사항",
      blocks: [
        p("이용자는 본 서비스를 이용할 때 다음 행위를 해서는 안 됩니다."),
        ol([
          "법령을 위반하는 행위, 또는 다른 사람의 저작권, 저작자 인격권, 초상권, 프라이버시, 명예 그 밖의 권리를 침해하는 행위.",
          "공식 소재의 음성·영상·캐릭터 등을 추출, 분리 또는 잘라 내어, 본 서비스로 「아노네 점프」를 생성하는 것 이외에 사용하는 행위.",
          "공식 소재를 소재집, 음원 파일, 영상 템플릿, 다른 생성 서비스, 학습용 데이터 등으로 제공·재배포·판매하는 행위.",
          "생성 영상 또는 공식 소재를 판매하고, 상품·서비스의 광고, 기업 협찬, 판촉, 유료 배포, 상품화 그 밖의 영리 목적으로 사용하는 행위.",
          "이용자 자신이 생성 영상을 수익화 대상으로 설정하고, 그 영상에서 광고 수익, 판매 수익 등을 얻는 행위. 다만 게시처가 이용자의 의사와 관계없이 표시하는 광고만을 이유로 이 항의 위반으로 하지는 않습니다.",
          "Nanatsukaze, 관계자 또는 제3자에 대한 비방, 괴롭힘, 차별, 협박, 위법 행위의 조장 등을 위해 공식 소재 또는 생성 영상을 사용하는 행위.",
          "공식 소재를 외설적인 표현, 다른 사람의 존엄을 해치는 성적 표현, 또는 특정 개인·단체에 대한 폭력을 찬미·선동하는 표현과 결합하는 행위.",
          "Nanatsukaze가 특정 상품, 기업, 정치 활동, 종교 활동 등을 지지·추천하는 것처럼 표시하는 행위, 그 밖에 공식의 관여·승인에 대해 오인하게 하는 행위.",
          "부정 접근, 보안 기능의 우회, 과도한 접근, 서비스 방해, 그 밖에 본 서비스의 정상적인 운영을 저해하는 행위.",
          "제3조에서 정한 이용 목적을 벗어나거나, 본 약관에 명시한 제한을 피하기 위해 본 서비스를 이용하는 행위.",
        ]),
      ],
    },
    {
      heading: "제8조 권리자의 신청과 약관 위반에 대한 대응",
      blocks: [
        ol([
          "운영자는 권리자의 신청, 권리 침해에 관한 구체적인 정보, 본 약관 위반, 그 밖에 본 서비스 제공상의 문제를 알게 된 경우, 필요한 확인을 하고, 소재·기능의 제공 중지, 본 서비스 안 게시 내용의 수정·삭제, 기술적으로 가능한 범위의 이용 제한 등의 조치를 할 수 있습니다.",
          "조치의 내용은 문제의 성질, 긴급성, 영향 등을 고려하여 필요하고 합리적인 범위에서 판단합니다. 가능한 경우에는 이유와 대응 내용을 안내합니다. 다만 긴급한 권리 보호나 부정 이용에 대한 대응에서는 사전 고지 없이 조치할 수 있습니다.",
          "이용자는 권리자의 정당한 신청 또는 구체적인 권리 침해 등에 따라 생성 영상의 공개 중지·삭제 등을 요청받은 경우, 내용을 확인하고 필요한 대응을 해 주세요.",
          "운영자는 이용자에게 외부 게시물의 확인·삭제 등을 부탁할 수 있으나, 이용자 기기 안의 파일을 원격으로 삭제하지는 않습니다.",
          "본 조는 본 서비스의 소재 제공·운영에 관하여 운영자 자신이 져야 할 의무나 책임을 이용자에게 넘기는 것이 아닙니다.",
        ]),
      ],
    },
    {
      heading: "제9조 이용 환경과 서비스의 변경·중지",
      blocks: [
        ol([
          "본 서비스는 무료로 제공합니다. 이용에 필요한 기기, 인터넷 연결, 통신 요금 등은 이용자가 준비하고 부담합니다.",
          "본 서비스의 동작이나 영상 생성 결과는 기기, OS, 브라우저, 남은 용량 등의 환경에 따라 다를 수 있습니다. 운영자는 모든 환경에서의 동작, 중단 없는 제공, 또는 특정 생성 결과를 보증하지 않습니다.",
          "이용자는 사용하는 사진의 원본과 보관하고 싶은 생성 영상을 스스로 적절히 보관해 주세요. 본 서비스는 사진이나 생성 영상의 온라인 보관·복원을 제공하지 않습니다.",
          "운영자는 보수, 장애, 외부 서비스의 변경, 권리자의 신청, 그 밖의 합리적인 이유로 본 서비스의 기능을 변경하거나, 제공을 중단하거나, 종료할 수 있습니다.",
          "이용자에게 큰 영향이 있는 변경·종료는 가능한 한 사전에 본 서비스에서 알립니다. 다만 긴급한 대응이 필요한 경우에는 그렇지 않습니다.",
          "본 조는 다음 조에서 정하는 운영자의 책임을 면제하는 것이 아닙니다.",
        ]),
      ],
    },
    {
      heading: "제10조 책임의 범위",
      blocks: [
        ol([
          "이용자는 자신이 고르는 사진 등의 내용과 자신이 생성 영상을 공개·이용하는 것에 대해, 법령 및 본 약관에 따라 대응하는 것으로 합니다.",
          "이용자와 제3자 사이에 문제가 생긴 경우, 이용자는 자신의 행위에 관한 사실 확인과 필요한 대응을 하는 것으로 합니다. 운영자도 운영자 자신의 행위나 의무와 관련된 사항에 대해 필요한 대응을 합니다.",
          "운영자의 책임 있는 사유로 이용자에게 손해가 생긴 경우, 운영자는 법령에 따라 책임을 집니다. 다만 운영자에게 고의 또는 중대한 과실이 있는 경우를 제외하고, 배상하는 손해는 실제로 생긴 통상적이고 직접적인 손해의 범위로 합니다. 이 제한은 법령이 인정하는 범위에서 적용합니다.",
          "운영자에게 고의 또는 중대한 과실이 있는 경우에는 앞 항의 책임 제한을 적용하지 않습니다. 또한 본 약관은 소비자계약법 그 밖의 법령에 따른 이용자의 권리를 제한하지 않습니다.",
        ]),
      ],
    },
    {
      heading: "제11조 본 약관의 변경",
      blocks: [
        ol([
          "운영자는 법령, 서비스 내용, 권리자의 방침 등의 변경에 대응하기 위해 본 약관을 변경할 수 있습니다.",
          "본 약관의 변경은 이용자와의 합의에 의한 경우, 또는 민법상 정형약관의 변경 그 밖에 법령상 인정되는 요건을 갖춘 경우에 합니다.",
          "변경하는 경우에는 변경 내용과 적용 시작일을 본 서비스에서 알립니다. 중요한 변경은 적용 시작까지 상당한 기간을 두고 고지하고, 법령상 필요한 경우에는 다시 동의를 받습니다.",
          "이용자가 변경 후의 약관에 동의하지 않는 경우에는 변경 후의 조건에 따른 이용을 삼가 주세요. 본 항은 법령상 인정되지 않는 변경을, 이용의 계속이나 침묵만을 이유로 유효하게 하는 것이 아닙니다.",
        ]),
      ],
    },
    {
      heading: "제12조 준거법·분쟁 해결",
      blocks: [
        ol([
          "본 약관의 준거법은 일본법으로 합니다. 다만 이용자에게 적용되는 강행법규에 따른 보호를 배제하지는 않습니다.",
          "본 서비스에 관하여 문제가 생긴 경우에는 먼저 다음 조의 창구에서 내용을 확인하고, 성실한 해결을 위해 노력합니다.",
          "소송이 필요한 경우의 관할 법원은 법령이 정하는 바에 따릅니다.",
          "본 약관의 일부가 무효로 판단되더라도, 그 밖의 조항은 법령상 인정되는 범위에서 계속 적용됩니다.",
        ]),
      ],
    },
    {
      heading: "제13조 문의",
      blocks: [
        p("본 서비스, 본 약관, 권리 침해의 우려, 소재·게시물의 게재 중지 등에 관한 문의는 다음 창구로 연락해 주세요."),
        ul(["운영 이름: Yoiailabs (개인 제작자)"]),
        p(
          "권리에 관한 신청에서는 대상 URL 또는 소재, 신청 내용, 회신처를 알려 주세요. 확인에 필요하면 추가 정보를 부탁할 수 있습니다.",
        ),
      ],
    },
  ],
};

const zh: TermsDocument = {
  enactedLabel: "制定日：",
  enactedValue: "2026年9月22日",
  revisedLabel: "最后修订日：",
  revisedValue: "2026年9月22日",
  effectiveLabel: "开始适用日：",
  effectiveValue: "2026年9月22日",
  preamble:
    "本使用条款（以下称“本条款”）规定由 Yoiailabs（个人创作者。以下称“运营者”）运营的「あのね跳跃制作器」及其相关页面（以下称“本服务”）的使用条件。",
  sections: [
    {
      heading: "第1条　本服务的定位",
      blocks: [
        ol([
          "本服务是尊重艺人组合 Nanatsukaze 的作品、供人享受制作「あのね跳跃」粉丝作品的非官方服务。",
          "本服务并非由 Nanatsukaze 自身提供。提供本服务并不表示 Nanatsukaze 已官方认可、监修或许可使用素材。",
          "本服务所使用的乐曲「あのね」、跳跃的角色及其影像（以下合称“官方素材”）的著作权归 Nanatsukaze 所有。运营者不是官方素材的权利人。",
          "本条款规定的是使用本服务的条件，并不是 Nanatsukaze 的官方二次创作或二次使用指南。运营者不通过本条款许可使用官方素材，也不向第三方再许可。",
        ]),
      ],
    },
    {
      heading: "第2条　对条款的同意",
      blocks: [
        ol([
          "使用者应在使用本服务前确认本条款，并在同意其内容后使用。如果不能同意本条款，请不要使用本服务。",
          "如果本服务要求确认同意，请按照所显示的方法同意。",
          "未成年人请在取得监护人或其他法定代理人的同意后使用本服务。",
          [
            "个人信息及其他与使用者有关的信息，依照另行规定的",
            { kind: "privacy", label: "隐私政策" },
            "处理。同意本条款，并不当然等于一并同意法律另行要求的个人信息处理等事项。",
          ],
        ]),
      ],
    },
    {
      heading: "第3条　使用目的与范围",
      blocks: [
        ol([
          "本服务用于将使用者选择的照片等与本服务所定的官方素材组合，并在本服务所提供功能的范围内生成「あのね跳跃」视频。如此生成的视频以下称“生成视频”。",
          "使用本服务，仅限于作为非营利粉丝活动制作、欣赏生成视频，并在确认所需权利与条件后进行分享。",
          "使用者不得将从本服务取得的官方素材，转用于生成视频以外的作品、其他乐曲视频、其他迷因、独立的角色素材，或其他「あのね跳跃」以外的用途。",
          "这一限制针对的是使用本服务，以及通过本服务取得、使用官方素材。它并不是要一般性地限制与本服务无关、从权利人处合法取得的权利，或法律所允许的使用。",
        ]),
      ],
    },
    {
      heading: "第4条　官方素材及生成视频的权利",
      blocks: [
        ol([
          "即使制作了包含官方素材的生成视频，官方素材的著作权也不会转移给使用者或运营者。",
          "使用者所选择的照片等的权利，仍归使用者或其正当权利人所有。即使生成视频中因使用者自身的创作产生权利，官方素材及其他既有作品的权利仍然存续。",
          "本服务并不给予使用者自由使用、分发或销售官方素材及生成视频的权利。仅因属于粉丝制作、非营利，或标明了出处与署名，并不意味着不再需要必要的许可。",
          "权利人未明示二次使用条件时，请不要将其解释为概括性的使用许可。也不要仅凭社交平台上的反应或作品介绍，就认为任何使用都已获得许可。",
          "如果 Nanatsukaze 或其他权利人公布了使用条件、指南，或要求停止、变更使用，请确认该条件或申请，不要进行与之相抵触的使用。无法确认必要许可的使用，以及可能超出许可范围的使用，请不要进行。",
          "即使权利人允许某种使用，仅此也不会自动扩大本服务的功能或使用范围。使用本服务时，还应遵守本条款的条件。",
        ]),
      ],
    },
    {
      heading: "第5条　自带照片等与第三方权利",
      blocks: [
        ol([
          "请使用自己拍摄的照片，或对加工、编入生成视频以及计划中的公开拥有必要权利与许可的照片等。",
          "使用他人拍摄或制作的照片、插画，或拍有人物的照片等时，请顾及著作权、肖像权、隐私及其他权利，并取得法律所要求的许可。仅仅能够在互联网上浏览，并不意味着可以自由使用。",
          "请确认可识别个人的信息、地址、联系方式、秘密信息等，没有在无意中包含在照片或生成视频里。",
          "仅在本服务中选择或读取照片，并不等于把照片或生成视频的权利转让给运营者，也不等于概括许可运营者用于广告或再分发。",
        ]),
      ],
    },
    {
      heading: "第6条　生成视频的公开与分享",
      blocks: [
        ol([
          "向社交平台或其他外部服务公开、发送生成视频时，请确认官方素材与所使用照片等的权利、发布平台的条款，以及乐曲、影像的使用条件。能够在本服务中生成，并不保证可以在所有发布平台公开。",
          "发布时，请不要使人误认为这是 Nanatsukaze 的官方发布、官方广告或官方发表。必要时，请在说明栏等处写明这是粉丝制作的作品。",
          "不得虚假标注出处、权利人或制作者，也不得把官方素材标成自己的原创作品。不得删除或改动已经显示的权利标注。",
          "标明出处的一种方法是，例如写上「乐曲、角色、影像：Nanatsukaze／粉丝作品」，并附上官方乐曲页面等链接。不过，这一标注本身并不是使用许可。如果权利人另行指定了标注方法，请确认该指定。",
          "对从本服务导出的生成视频，为配合发布平台的规格而转换容量或格式时，请保持在第3条的目的范围内。不得为了提取官方素材或转用于其他作品而进行编辑。",
          "向外部服务公开由使用者本人进行。请不要以为运营者能够管理或删除使用者设备中的视频，或外部服务上的帖子。",
        ]),
      ],
    },
    {
      heading: "第7条　禁止事项",
      blocks: [
        p("使用本服务时，使用者不得从事下列行为。"),
        ol([
          "违反法律的行为，或侵害他人著作权、著作人身权、肖像权、隐私、名誉及其他权利的行为。",
          "提取、分离或切出官方素材的声音、影像、角色等，并将其用于以本服务生成「あのね跳跃」以外的用途。",
          "将官方素材作为素材集、音频文件、视频模板、其他生成服务、训练数据等提供、再分发或销售。",
          "销售生成视频或官方素材，或将其用于商品、服务的广告、企业合作、促销、付费发布、商品化及其他营利目的。",
          "使用者自行将生成视频设为收益对象，并从该视频获得广告收益、销售收入等。不过，不能仅因发布平台不顾使用者意愿而显示的广告，就认定违反本项。",
          "为了诽谤中伤、骚扰、歧视、威胁 Nanatsukaze、相关人员或第三方，或助长违法行为，而使用官方素材或生成视频。",
          "将官方素材与淫秽表达、损害他人尊严的性表达，或赞美、煽动针对特定个人或团体的暴力的表达相结合。",
          "使人以为 Nanatsukaze 支持或推荐特定商品、企业、政治活动、宗教活动等，或其他使人误解官方参与、认可的行为。",
          "未经授权的访问、规避安全功能、过度访问、妨碍服务，或其他阻碍本服务正常运营的行为。",
          "超出第3条规定的使用目的，或为了规避本条款明示的限制而使用本服务。",
        ]),
      ],
    },
    {
      heading: "第8条　权利人的申请以及对违反条款的处理",
      blocks: [
        ol([
          "运营者在得知权利人的申请、与权利侵害有关的具体信息、违反本条款，或其他提供本服务方面的问题时，可以进行必要的确认，并采取停止提供素材或功能、修正或删除本服务内的刊登内容、在技术可能的范围内限制使用等措施。",
          "措施的内容，将根据问题的性质、紧迫性和影响等，在必要且合理的范围内判断。可能时会说明理由和对应内容。不过，为紧急保护权利或应对不当使用，可能会在事先未告知的情况下采取措施。",
          "如果基于权利人的正当申请或具体的权利侵害等，要求停止公开或删除生成视频，请确认内容并采取必要的对应。",
          "运营者可能会请使用者确认或删除外部帖子，但不会远程删除使用者设备中的文件。",
          "本条并不把运营者自身在提供素材、运营本服务方面应当承担的义务或责任转嫁给使用者。",
        ]),
      ],
    },
    {
      heading: "第9条　使用环境与服务的变更、停止",
      blocks: [
        ol([
          "本服务免费提供。使用所需的设备、互联网连接、通信费用等，由使用者自行准备并负担。",
          "本服务的运行和视频生成结果，可能因设备、操作系统、浏览器、可用空间等环境而不同。运营者不保证在所有环境中都能运行、不中断地提供，或产生特定的生成结果。",
          "请自行妥善保管所使用照片的原件，以及希望保存的生成视频。本服务不提供照片或生成视频的在线保管与恢复。",
          "运营者可能因维护、故障、外部服务的变更、权利人的申请或其他合理理由，变更本服务的功能、中断提供或终止服务。",
          "对使用者有较大影响的变更或终止，会尽可能事先在本服务上告知。需要紧急对应时除外。",
          "本条并不免除下一条所规定的运营者责任。",
        ]),
      ],
    },
    {
      heading: "第10条　责任范围",
      blocks: [
        ol([
          "对于自己选择的照片等内容，以及自己对生成视频的公开与使用，使用者应依照法律和本条款进行处理。",
          "使用者与第三方之间发生问题时，使用者应对自己行为的事实进行确认并采取必要对应。对于与运营者自身行为或义务有关的事项，运营者也会采取必要对应。",
          "因可归责于运营者的事由给使用者造成损害时，运营者依照法律承担责任。不过，除运营者存在故意或重大过失的情形外，赔偿的损害以实际发生的通常且直接的损害为限。这一限制在法律允许的范围内适用。",
          "运营者存在故意或重大过失时，不适用前项的责任限制。本条款也不限制使用者基于消费者合同法及其他法律所享有的权利。",
        ]),
      ],
    },
    {
      heading: "第11条　本条款的变更",
      blocks: [
        ol([
          "为应对法律、服务内容、权利人方针等的变化，运营者可能会变更本条款。",
          "变更本条款，应在与使用者达成合意时进行，或在符合民法上格式条款的变更及其他法律所允许的要件时进行。",
          "变更时，会在本服务上公布变更内容和开始适用日。对于重要变更，会在开始适用前留出相当期间进行告知，并在法律要求时重新取得同意。",
          "如果使用者不同意变更后的条款，请不要按变更后的条件使用。本项并不使法律所不允许的变更，仅因继续使用或保持沉默而生效。",
        ]),
      ],
    },
    {
      heading: "第12条　准据法与争议解决",
      blocks: [
        ol([
          "本条款以日本法为准据法。不过，这并不排除适用于使用者的强制性规定所提供的保护。",
          "如果发生与本服务有关的问题，首先通过下一条的联系方式确认内容，并努力诚信解决。",
          "需要诉讼时，管辖法院依照法律的规定。",
          "即使本条款的一部分被认定为无效，其他条款仍在法律允许的范围内继续适用。",
        ]),
      ],
    },
    {
      heading: "第13条　联系",
      blocks: [
        p("有关本服务、本条款、可能的权利侵害，以及停止刊登素材或帖子等的询问，请通过下列联系方式联系。"),
        ul(["运营名称：Yoiailabs（个人创作者）"]),
        p(
          "提出与权利有关的申请时，请告知对象的 URL 或素材、申请内容以及回复地址。确认所需要时，可能会请你补充信息。",
        ),
      ],
    },
  ],
};

const DOCUMENTS: Record<Locale, TermsDocument> = { ja, en, ko, zh };

export function termsDocument(locale: Locale): TermsDocument {
  return DOCUMENTS[locale];
}
