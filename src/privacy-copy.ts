import type { Locale } from "./messages.ts";
import {
  CLOUDFLARE_PRIVACY_URL,
  GOOGLE_ANALYTICS_OPTOUT_URL,
  GOOGLE_ANALYTICS_SAFEGUARDS_URL,
  GOOGLE_PARTNER_SITES_URL,
  GOOGLE_PRIVACY_POLICY_URL,
  SENTRY_DATA_COLLECTED_URL,
  SENTRY_DPA_URL,
  SENTRY_PRIVACY_URL,
  SENTRY_TERMS_URL,
  X_COOKIES_URL,
  X_PRIVACY_URL,
} from "./privacy.ts";

export type Inline = string | { href: string; label: string };

export type PrivacyBlock =
  | { type: "p"; parts: Inline[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: { title: string; text: string }[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | {
      type: "sources";
      intro: string;
      separator: string;
      items: { name: string; links: { href: string; label: string }[] }[];
    };

export type PrivacyDocument = {
  revisedLabel: string;
  revisedValue: string;
  effectiveLabel: string;
  effectiveValue: string;
  preamble: string;
  sections: { heading: string; blocks: PrivacyBlock[] }[];
};

const ja: PrivacyDocument = {
  revisedLabel: "最終改定日：",
  revisedValue: "2026年9月22日",
  effectiveLabel: "適用開始日：",
  effectiveValue: "2026年9月22日",
  preamble:
    "あのねジャンプメーカーの運営者（以下「運営者」といいます。）は、あのねジャンプメーカーおよびその関連ページ（以下「本サービス」といいます。）における利用者に関する情報の取扱いについて、次のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。",
  sections: [
    {
      heading: "第1条　運営者と適用範囲",
      blocks: [
        { type: "p", parts: ["本サービスの運営者は、次のとおりです。"] },
        {
          type: "ul",
          items: ["運営名：Yoiailabs（個人制作者）"],
        },
        {
          type: "p",
          parts: [
            "本ポリシーは、本サービスの利用に伴い運営者が取得・利用する情報、および本サービスに組み込まれた外部サービスへの情報送信について適用します。リンク先のサービスで独自に行われる情報の取扱いについては、各サービスのプライバシーポリシー等もご確認ください。",
          ],
        },
        {
          type: "p",
          parts: [
            "本ポリシーにおける「個人情報」「個人データ」「保有個人データ」その他の法令上の用語は、個人情報の保護に関する法律に従うものとします。",
          ],
        },
      ],
    },
    {
      heading: "第2条　写真・動画の取扱い",
      blocks: [
        {
          type: "p",
          parts: [
            "本サービスの写真の読み込み・加工、プレビューおよび動画の生成は、利用者の端末のブラウザ内で行います。これらの通常の処理のために、利用者が選択した写真の画像データや生成した動画のデータを、運営者のサーバーまたは外部サービスへアップロードすることはありません。",
          ],
        },
        {
          type: "p",
          parts: [
            "ファイル名は、端末内での写真の管理・表示に使用します。写真・動画の本体やファイル名は、アクセス解析や障害診断のための送信対象に含めません。ただし、不具合の調査に必要な情報として、ファイル形式、拡張子、ファイルサイズ、読み込み処理の状況等を取り扱う場合があります。",
          ],
        },
        {
          type: "p",
          parts: [
            "写真を選択したり動画を生成したりするだけで、SNSその他の外部サービスへ自動的に公開されることはありません。利用者自身が写真・動画等を外部サービスへ投稿・送信した場合、その情報は送信先のサービスの定めに従って取り扱われます。",
          ],
        },
        {
          type: "p",
          parts: [
            "本サービスはアカウント登録を必要とせず、通常の写真・動画生成のために氏名、住所、メールアドレスの入力を求めません。お問い合わせ等に際して利用者が提供する情報については、次条以降に従って取り扱います。",
          ],
        },
      ],
    },
    {
      heading: "第3条　取得・利用する情報と利用目的",
      blocks: [
        { type: "p", parts: ["運営者は、次の情報を、それぞれ記載した目的のために取り扱います。"] },
        {
          type: "table",
          headers: ["情報の区分", "主な情報", "利用目的"],
          rows: [
            [
              "利用状況に関する情報",
              "閲覧ページ、参照元、閲覧・操作の日時、ブラウザを識別する情報、プレビュー・保存操作、動画の向き・エフェクト等",
              "利用状況の把握、機能・画面の改善",
            ],
            [
              "通信・利用環境に関する情報",
              "IPアドレス、ブラウザ・OS・端末の情報、表示言語、リクエストに関する情報等",
              "ページや素材の配信、表示の最適化、セキュリティの確保、稼働状況の確認",
            ],
            [
              "不具合に関する情報",
              "エラー内容、発生時のページ・操作に関する情報、ブラウザ等の環境情報、ファイル形式・サイズ等の診断情報",
              "不具合の調査、修正、再発防止",
            ],
            [
              "設定に関する情報",
              "選択した表示言語、ブラウザ内に保存される設定・キャッシュ等",
              "表示言語の維持、表示や読み込みの円滑化",
            ],
            [
              "お問い合わせに関する情報",
              "連絡先、利用者が提供した氏名・アカウント名、問い合わせ内容、対応履歴、必要な本人確認情報等",
              "お問い合わせ・苦情への対応、必要な事実確認",
            ],
            [
              "本サービスで紹介する公開投稿の情報",
              "公開された投稿内容、投稿者の表示名・アカウント名、投稿日時、投稿先URL等",
              "本サービスに関連する投稿・反応の紹介、掲載に関する問い合わせへの対応",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "外部サービスを通じて取得・処理される情報については、第5条もご確認ください。運営者が管理画面等を通じて閲覧できる情報と、外部サービス提供者が通信処理等のために受け取る情報は、同一とは限りません。",
          ],
        },
        {
          type: "p",
          parts: [
            "運営者は、法令により認められる場合を除き、上記の利用目的の達成に必要な範囲を超えて個人情報を取り扱いません。また、利用者の個人情報を販売しません。",
          ],
        },
      ],
    },
    {
      heading: "第4条　Cookie等の利用",
      blocks: [
        {
          type: "p",
          parts: [
            "本サービスでは、表示言語の維持や利用状況の把握等のために、Cookieおよびブラウザ内の保存領域を利用します。",
          ],
        },
        {
          type: "ol",
          items: [
            {
              title: "言語設定",
              text: "選択した表示言語を anone-locale というCookieに保存します。設定上の有効期間は保存・更新時から365日です。実際の保持期間はブラウザの設定等によって短くなる場合があります。このCookieは本サービスへのアクセス時に配信サーバーへ送信され、言語別ページへの案内に使用されます。",
            },
            {
              title: "アクセス解析",
              text: "Google Analyticsは、ブラウザを識別し利用状況を把握するため、Cookie等を使用することがあります。送信される情報等は第5条をご確認ください。",
            },
            {
              title: "キャッシュ",
              text: "本サービスを円滑に表示するため、アイコン等の配信ファイルがブラウザ内に保存されることがあります。この保存は、選択した写真や生成した動画を運営者が収集するためのものではありません。",
            },
          ],
        },
        {
          type: "p",
          parts: [
            "利用者は、ブラウザの設定によりCookie等を制限・削除できます。その場合、表示言語の維持等の一部機能が利用できなくなることがあります。Cookieの制限・削除だけで、全ての外部通信や情報収集が停止するわけではありません。",
          ],
        },
      ],
    },
    {
      heading: "第5条　外部サービスの利用と情報の外部送信",
      blocks: [
        {
          type: "p",
          parts: [
            "本サービスでは、次の外部サービスを利用します。対象のページや機能の読み込み・利用に伴い、利用者の端末から各サービスへ情報が送信されます。",
          ],
        },
        {
          type: "p",
          parts: [
            "送信される情報は、利用状況、ブラウザの設定、外部サービスへのログイン状態、提供者側の仕様等によって異なります。以下の情報には、通常の通信に必要なIPアドレス等も含まれます。",
          ],
        },
        {
          type: "table",
          headers: [
            "サービス／情報を取り扱う主な事業者",
            "主な送信情報",
            "本サービスでの利用目的・送信の場面",
            "送信先での主な利用目的",
          ],
          rows: [
            [
              "Google Analytics／Google LLC",
              "ページURL、参照元、Cookie等の識別情報、閲覧・操作情報、ブラウザ・端末・言語情報、通信に伴うIPアドレス等",
              "利用状況の計測・改善。ページの読み込み後や操作時等。独自イベントではプレビュー・保存操作と向き・エフェクトを計測",
              "解析サービスの提供・維持・改善等。その他の取扱いはGoogleとの設定・適用規約による",
            ],
            [
              "Sentry／Functional Software, Inc.",
              "エラー内容、発生ページ・操作履歴等の診断情報、端末・ブラウザ情報、必要に応じたファイル形式・サイズ等、通信に必要な情報",
              "エラー監視機能の読み込み・エラー報告等。不具合の調査・修正",
              "障害監視・診断サービスの提供、保守、セキュリティ確保等",
            ],
            [
              "Cloudflare／Cloudflare, Inc.",
              "IPアドレス、アクセス先、アクセス日時、リクエスト情報、ブラウザ等の情報、言語Cookie等",
              "本サービスのページ・素材の配信、言語別ページへの案内、稼働監視、不正アクセス対策",
              "配信・セキュリティ・稼働監視サービスの提供等",
            ],
            [
              "Google Fonts／Google LLC",
              "IPアドレス、フォントの取得要求、ブラウザ情報、通信に伴う参照元情報等",
              "ページで使用するフォントの配信",
              "フォント配信サービスの提供・維持等",
            ],
            [
              "YouTube／Google LLC",
              "IPアドレス、ブラウザ・端末情報、埋め込みの参照元、再生操作情報、Cookie等の情報",
              "埋め込みプレーヤーの読み込み・操作による動画の表示・再生",
              "動画配信、利用状況の分析、不正防止等。設定等に応じたコンテンツ・広告の提供",
            ],
            [
              "X／X Corp.",
              "IPアドレス、ブラウザ・端末情報、埋め込みの参照元、閲覧・操作情報、Cookie等の情報",
              "埋め込み投稿・関連ウィジェットの読み込み・表示",
              "投稿の表示、サービスの提供・分析、不正防止等。設定等に応じたパーソナライズ",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "YouTubeの埋め込みにはプライバシー強化モードを使用し、Xの埋め込みには追跡を抑制する指定を行っています。ただし、これらの設定は、外部サービスへの通信や情報の取扱いが一切発生しないことを意味するものではありません。",
          ],
        },
        {
          type: "p",
          parts: [
            "Sentryについては、氏名等を利用者情報として設定して送信せず、リクエスト本文やCookie等をエラー報告から除去する処理を行っています。ただし、診断情報や通信に必要な情報まで全て送信しないという意味ではありません。",
          ],
        },
        {
          type: "sources",
          intro: "各サービスの取扱いの詳細は、次の情報をご確認ください。",
          separator: "／",
          items: [
            {
              name: "Google",
              links: [
                { href: GOOGLE_PRIVACY_POLICY_URL, label: "プライバシーポリシー" },
                { href: GOOGLE_PARTNER_SITES_URL, label: "Googleを利用するサイト・アプリでの情報の取扱い" },
              ],
            },
            {
              name: "Google Analytics",
              links: [{ href: GOOGLE_ANALYTICS_SAFEGUARDS_URL, label: "データの保護" }],
            },
            {
              name: "Sentry",
              links: [
                { href: SENTRY_TERMS_URL, label: "サービス利用規約" },
                { href: SENTRY_DPA_URL, label: "データ処理補遺" },
                { href: SENTRY_DATA_COLLECTED_URL, label: "JavaScript SDKの収集データ" },
                { href: SENTRY_PRIVACY_URL, label: "プライバシーポリシー" },
              ],
            },
            {
              name: "Cloudflare",
              links: [{ href: CLOUDFLARE_PRIVACY_URL, label: "プライバシーポリシー" }],
            },
            {
              name: "X",
              links: [
                { href: X_PRIVACY_URL, label: "プライバシーポリシー" },
                { href: X_COOKIES_URL, label: "Cookie等の利用" },
              ],
            },
          ],
        },
        {
          type: "p",
          parts: [
            "Sentryへ障害診断のために送信するサービスデータの取扱いは、運営者とSentryとの契約に基づきます。Sentry自身のウェブサイト等に適用されるプライバシーポリシーとは、適用範囲が異なります。",
          ],
        },
      ],
    },
    {
      heading: "第6条　第三者提供、委託および外国での取扱い",
      blocks: [
        {
          type: "p",
          parts: [
            "運営者は、本人の同意がある場合、法令に基づく場合その他法令で認められる場合を除き、個人データを第三者に提供しません。",
          ],
        },
        {
          type: "p",
          parts: [
            "利用目的の達成に必要な範囲で個人データの取扱いを委託する場合は、委託先を適切に選定し、その取扱状況について必要かつ適切な監督を行います。",
          ],
        },
        {
          type: "p",
          parts: [
            "第5条の外部サービスへの送信には、利用者の端末から外部サービス提供者が情報を直接取得するものが含まれます。これらの外部サービスを利用する際には、本ポリシーのほか、各提供者の取扱いについてもご確認ください。",
          ],
        },
        {
          type: "p",
          parts: [
            "外部サービスの利用に伴い、情報が日本国外で取り扱われる場合があります。運営者による外国にある第三者への個人データの提供に該当する場合には、法令に従い、必要な情報提供および同意の取得、または法令で認められるその他の措置を講じます。",
          ],
        },
      ],
    },
    {
      heading: "第7条　保存期間と削除",
      blocks: [
        {
          type: "p",
          parts: [
            "運営者は、取り扱う情報の内容、利用目的、対応・調査に要する期間、法令上の義務等を考慮し、目的の達成に必要な期間に限って情報を保持します。保持する必要がなくなった情報は、合理的な期間内に削除するなど、適切に処理します。",
          ],
        },
        {
          type: "p",
          parts: [
            "外部サービスに保存される情報については、運営者が設定・管理できる範囲で保存期間および削除を管理します。外部サービス提供者が独自に保持する情報には、当該提供者の保存方針が適用されます。",
          ],
        },
        {
          type: "p",
          parts: [
            "端末内で処理され、運営者が取得していない写真・生成動画について、運営者側に削除対象となる原本や保存データはありません。利用者が端末に保存したファイルは、利用者自身で管理・削除してください。ブラウザ内のCookie・キャッシュ等は、ブラウザの設定から削除できます。",
          ],
        },
      ],
    },
    {
      heading: "第8条　安全管理",
      blocks: [
        {
          type: "p",
          parts: [
            "運営者は、個人データの漏えい、滅失または毀損の防止その他の安全管理のため、取り扱う情報と運営規模に応じ、必要かつ適切な措置を講じます。",
          ],
        },
        {
          type: "p",
          parts: [
            "主な措置として、情報を取り扱う者・管理アカウントの限定、認証情報の適切な管理、管理端末の保護、通信の暗号化、ソフトウェアの更新、不要な情報の収集・送信の抑制、外部サービスの設定および取扱状況の確認を行います。",
          ],
        },
      ],
    },
    {
      heading: "第9条　情報収集の制限",
      blocks: [
        {
          type: "p",
          parts: [
            "利用者は、ブラウザの設定によるCookie等の制限・削除のほか、対応する環境では",
            { href: GOOGLE_ANALYTICS_OPTOUT_URL, label: "Google Analyticsオプトアウトアドオン" },
            "を利用できます。アドオンの利用可否や効果は、端末・ブラウザ等の環境によって異なります。",
          ],
        },
        {
          type: "p",
          parts: [
            "Googleの広告設定の変更は、広告のパーソナライズ等に関する設定であり、本サービスのアクセス解析や全ての外部通信を停止するものではありません。また、Google Analyticsのオプトアウトは、Sentry、Cloudflare、外部フォント、埋め込みコンテンツ等への通信を一括して停止するものではありません。",
          ],
        },
        {
          type: "p",
          parts: [
            "外部サービス側の情報の取扱いを制限したい場合は、各サービスが提供する設定・手続もご確認ください。",
          ],
        },
      ],
    },
    {
      heading: "第10条　本ポリシーの変更",
      blocks: [
        {
          type: "p",
          parts: [
            "運営者は、法令の改正、本サービスの機能または情報の取扱いの変更等に応じ、本ポリシーを改定することがあります。",
          ],
        },
        {
          type: "p",
          parts: [
            "改定する場合は、本ページに変更後の内容、最終改定日および適用開始日を掲載します。",
          ],
        },
      ],
    },
  ],
};

const en: PrivacyDocument = {
  revisedLabel: "Last revised: ",
  revisedValue: "September 22, 2026",
  effectiveLabel: "Effective date: ",
  effectiveValue: "September 22, 2026",
  preamble:
    "The operator of Anone Jump Maker (the “Operator”) sets out this privacy policy (this “Policy”) for how information about users is handled in Anone Jump Maker and its related pages (the “Service”).",
  sections: [
    {
      heading: "Article 1. Operator and scope",
      blocks: [
        { type: "p", parts: ["The operator of the Service is as follows."] },
        {
          type: "ul",
          items: ["Operator name: Yoiailabs (individual creator)"],
        },
        {
          type: "p",
          parts: [
            "This Policy applies to information the Operator obtains and uses as you use the Service, and to information sent to external services built into the Service. For information handled independently by a linked service, please also read that service’s privacy policy.",
          ],
        },
        {
          type: "p",
          parts: [
            "In this Policy, “personal information,” “personal data,” “retained personal data,” and other statutory terms follow the Act on the Protection of Personal Information of Japan.",
          ],
        },
      ],
    },
    {
      heading: "Article 2. Photos and video",
      blocks: [
        {
          type: "p",
          parts: [
            "Loading and editing photos, previewing, and generating video all happen in the browser on your device. For this ordinary processing, the image data of photos you select and the video data that is generated are not uploaded to the Operator’s servers or to an external service.",
          ],
        },
        {
          type: "p",
          parts: [
            "File names are used on the device to manage and display photos. The photos and video themselves, and their file names, are not included in what is sent for usage measurement or error diagnosis. Information needed to investigate a problem, such as the file format, extension, file size, and the status of loading, may still be handled.",
          ],
        },
        {
          type: "p",
          parts: [
            "Selecting photos or generating a video does not by itself publish them to a social network or any other external service. If you yourself post or send photos, video, or other material to an external service, that service’s rules apply to that information.",
          ],
        },
        {
          type: "p",
          parts: [
            "The Service does not require an account, and it does not ask for your name, address, or email address in order to generate photos and video in the ordinary way. Information you provide when you contact us is handled under the following articles.",
          ],
        },
      ],
    },
    {
      heading: "Article 3. Information we handle and why",
      blocks: [
        { type: "p", parts: ["The Operator handles the following information for the purposes listed with it."] },
        {
          type: "table",
          headers: ["Category", "Main information", "Purpose"],
          rows: [
            [
              "Usage",
              "Pages viewed, referrer, date and time of viewing and actions, information that identifies the browser, preview and save actions, video orientation and effect, and similar details",
              "Understanding usage, and improving features and screens",
            ],
            [
              "Connection and environment",
              "IP address, browser, operating system, and device information, display language, request information, and similar details",
              "Delivering pages and assets, adapting the display, security, and checking that the Service is running",
            ],
            [
              "Problems",
              "Error details, the page and actions at the time, environment information such as the browser, and diagnostic details such as file format and size",
              "Investigating problems, fixing them, and preventing them from happening again",
            ],
            [
              "Settings",
              "The display language you select, and settings and cache stored in the browser",
              "Keeping the display language, and making display and loading smoother",
            ],
            [
              "Inquiries",
              "Contact details, a name or account name you provide, the content of the inquiry, the history of the response, and identity information needed to respond",
              "Responding to inquiries and complaints, and confirming the facts that are needed",
            ],
            [
              "Public posts shown in the Service",
              "The content of a public post, the poster’s display name and account name, the time of the post, the URL of the post, and similar details",
              "Introducing posts and reactions related to the Service, and responding to inquiries about that listing",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "For information obtained or processed through an external service, please also read Article 5. Information the Operator can view in an admin screen is not necessarily the same as information the external provider receives in order to handle the communication.",
          ],
        },
        {
          type: "p",
          parts: [
            "Except where the law allows it, the Operator does not handle personal information beyond what is needed for the purposes above. The Operator does not sell users’ personal information.",
          ],
        },
      ],
    },
    {
      heading: "Article 4. Cookies and similar storage",
      blocks: [
        {
          type: "p",
          parts: [
            "The Service uses cookies and storage in the browser to keep the display language, to understand usage, and for similar purposes.",
          ],
        },
        {
          type: "ol",
          items: [
            {
              title: "Language",
              text: "The display language you select is stored in a cookie named anone-locale. The configured lifetime is 365 days from when it is saved or updated. The browser’s own settings may keep it for a shorter time. This cookie is sent to the delivery server when you access the Service, and it is used to direct you to the page for that language.",
            },
            {
              title: "Usage measurement",
              text: "Google Analytics may use cookies or similar storage to identify the browser and understand usage. Please read Article 5 for what is sent.",
            },
            {
              title: "Cache",
              text: "Files used for delivery, such as icons, may be stored in the browser so the Service can be shown smoothly. This storage is not a way for the Operator to collect the photos you select or the video you generate.",
            },
          ],
        },
        {
          type: "p",
          parts: [
            "You can limit or delete cookies in the browser settings. Some features, such as keeping the display language, may then stop working. Limiting or deleting cookies does not by itself stop every external communication or every collection of information.",
          ],
        },
      ],
    },
    {
      heading: "Article 5. External services and outbound transmissions",
      blocks: [
        {
          type: "p",
          parts: [
            "The Service uses the external services below. When a page or feature that uses one of them is loaded or used, information is sent from your device to that service.",
          ],
        },
        {
          type: "p",
          parts: [
            "What is sent depends on usage, browser settings, whether you are signed in to the external service, the provider’s specifications, and similar factors. The information below includes an IP address and other details needed for ordinary communication.",
          ],
        },
        {
          type: "table",
          headers: [
            "Service / main party that handles the information",
            "Main information sent",
            "Purpose in the Service, and when it is sent",
            "Main purposes at the recipient",
          ],
          rows: [
            [
              "Google Analytics / Google LLC",
              "Page URL, referrer, cookie and similar identifiers, viewing and action information, browser, device, and language information, IP address used for the connection, and similar details",
              "Measuring and improving usage. After a page loads, when you take an action, and at similar times. Custom events measure preview and save actions, together with orientation and effect",
              "Providing, maintaining, and improving the analytics service, and similar purposes. Other handling follows the settings and terms that apply with Google",
            ],
            [
              "Sentry / Functional Software, Inc.",
              "Error details, diagnostic information such as the page and action history, device and browser information, file format and size when needed, and information required for the connection",
              "Loading error monitoring and sending error reports, and similar times. Investigating and fixing problems",
              "Providing error monitoring and diagnostic services, maintenance, security, and similar purposes",
            ],
            [
              "Cloudflare / Cloudflare, Inc.",
              "IP address, the address accessed, date and time of access, request information, browser and similar information, the language cookie, and similar details",
              "Delivering pages and assets, directing visitors to the page for their language, monitoring operation, and blocking unauthorized access",
              "Providing delivery, security, and operational monitoring, and similar purposes",
            ],
            [
              "Google Fonts / Google LLC",
              "IP address, the request for a font, browser information, referrer information that accompanies the connection, and similar details",
              "Delivering the fonts used on the page",
              "Providing and maintaining the font delivery service, and similar purposes",
            ],
            [
              "YouTube / Google LLC",
              "IP address, browser and device information, the referrer of the embed, playback actions, cookies and similar information",
              "Loading and using the embedded player to show and play video",
              "Delivering video, analyzing usage, preventing abuse, and similar purposes. Providing content and ads according to settings and similar factors",
            ],
            [
              "X / X Corp.",
              "IP address, browser and device information, the referrer of the embed, viewing and action information, cookies and similar information",
              "Loading and showing embedded posts and related widgets",
              "Showing posts, providing and analyzing the service, preventing abuse, and similar purposes. Personalization according to settings and similar factors",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "YouTube embeds use privacy-enhanced mode, and X embeds use a setting that limits tracking. Those settings do not mean that no communication with the external service takes place, or that the service handles no information.",
          ],
        },
        {
          type: "p",
          parts: [
            "For Sentry, a name or similar detail is not set as user information and sent, and the body of a request, cookies, and similar data are removed from error reports. That does not mean that diagnostic information, or information needed for the connection, is never sent.",
          ],
        },
        {
          type: "sources",
          intro: "For how each service handles information, please read the following.",
          separator: " / ",
          items: [
            {
              name: "Google",
              links: [
                { href: "https://policies.google.com/privacy?hl=en", label: "Privacy Policy" },
                {
                  href: "https://policies.google.com/technologies/partner-sites?hl=en",
                  label: "How Google uses information from sites or apps that use its services",
                },
              ],
            },
            {
              name: "Google Analytics",
              links: [
                { href: "https://support.google.com/analytics/answer/6004245?hl=en", label: "Safeguarding your data" },
              ],
            },
            {
              name: "Sentry",
              links: [
                { href: SENTRY_TERMS_URL, label: "Terms of Service" },
                { href: SENTRY_DPA_URL, label: "Data Processing Addendum" },
                { href: SENTRY_DATA_COLLECTED_URL, label: "Data collected by the JavaScript SDK" },
                { href: SENTRY_PRIVACY_URL, label: "Privacy Policy" },
              ],
            },
            {
              name: "Cloudflare",
              links: [{ href: CLOUDFLARE_PRIVACY_URL, label: "Privacy Policy" }],
            },
            {
              name: "X",
              links: [
                { href: "https://x.com/en/privacy", label: "Privacy Policy" },
                { href: "https://help.x.com/en/rules-and-policies/x-cookies", label: "How cookies are used" },
              ],
            },
          ],
        },
        {
          type: "p",
          parts: [
            "Service data sent to Sentry for error diagnosis is handled under the contract between the Operator and Sentry. That is a different scope from the privacy policy that applies to Sentry’s own website.",
          ],
        },
      ],
    },
    {
      heading: "Article 6. Third parties, processors, and handling outside Japan",
      blocks: [
        {
          type: "p",
          parts: [
            "The Operator does not provide personal data to a third party, except with the person’s consent, where a statute requires it, or in other cases the law allows.",
          ],
        },
        {
          type: "p",
          parts: [
            "When the Operator entrusts the handling of personal data to the extent needed for the purposes, the Operator selects the processor appropriately and supervises the handling as needed and as is appropriate.",
          ],
        },
        {
          type: "p",
          parts: [
            "Sending information to the external services in Article 5 includes cases where the provider obtains information directly from your device. When you use those services, please also read how each provider handles information, in addition to this Policy.",
          ],
        },
        {
          type: "p",
          parts: [
            "Information may be handled outside Japan when an external service is used. Where the Operator’s provision of personal data to a third party in a foreign country applies, the Operator will, as the law requires, provide the necessary information and obtain consent, or take another measure the law allows.",
          ],
        },
      ],
    },
    {
      heading: "Article 7. Retention and deletion",
      blocks: [
        {
          type: "p",
          parts: [
            "The Operator keeps information only for the period needed to achieve the purpose, taking into account what the information is, the purpose, the time needed to respond or investigate, legal duties, and similar factors. Information that no longer needs to be kept is deleted within a reasonable period, or otherwise handled appropriately.",
          ],
        },
        {
          type: "p",
          parts: [
            "For information stored in an external service, the Operator manages the retention period and deletion to the extent the Operator can configure and control it. Information the provider keeps on its own is subject to that provider’s retention practices.",
          ],
        },
        {
          type: "p",
          parts: [
            "For photos and generated video that are processed on the device and that the Operator has not obtained, the Operator has no original or stored copy to delete. Please manage and delete files you save on your device yourself. Cookies, cache, and similar data in the browser can be deleted in the browser settings.",
          ],
        },
      ],
    },
    {
      heading: "Article 8. Security management",
      blocks: [
        {
          type: "p",
          parts: [
            "The Operator takes necessary and appropriate measures, suited to the information handled and the scale of the operation, to prevent leakage, loss, or damage of personal data and to keep it secure.",
          ],
        },
        {
          type: "p",
          parts: [
            "The main measures are limiting who handles the information and which admin accounts exist, managing credentials appropriately, protecting devices used for administration, encrypting communications, updating software, limiting collection and transmission of information that is not needed, and checking the settings and handling of external services.",
          ],
        },
      ],
    },
    {
      heading: "Article 9. Limiting collection",
      blocks: [
        {
          type: "p",
          parts: [
            "Besides limiting or deleting cookies in the browser settings, you can use the ",
            { href: "https://tools.google.com/dlpage/gaoptout?hl=en", label: "Google Analytics opt-out add-on" },
            " where your environment supports it. Whether the add-on is available, and what it does, depends on the device, browser, and similar factors.",
          ],
        },
        {
          type: "p",
          parts: [
            "Changing Google’s ads settings adjusts personalization of ads and similar uses. It does not stop usage measurement for the Service, or every external communication. Opting out of Google Analytics also does not, by itself, stop communication with Sentry, Cloudflare, external fonts, embedded content, and similar services.",
          ],
        },
        {
          type: "p",
          parts: [
            "To limit how an external service handles information, please also use the settings and procedures that service provides.",
          ],
        },
      ],
    },
    {
      heading: "Article 10. Changes to this Policy",
      blocks: [
        {
          type: "p",
          parts: [
            "The Operator may revise this Policy when the law changes, or when the Service’s features or the handling of information changes.",
          ],
        },
        {
          type: "p",
          parts: [
            "When it is revised, the updated text, the last revised date, and the effective date are published on this page.",
          ],
        },
      ],
    },
  ],
};

const ko: PrivacyDocument = {
  revisedLabel: "최종 개정일: ",
  revisedValue: "2026년 9월 22일",
  effectiveLabel: "적용 시작일: ",
  effectiveValue: "2026년 9월 22일",
  preamble:
    "아노네 점프 메이커의 운영자(이하 “운영자”)는 아노네 점프 메이커 및 관련 페이지(이하 “본 서비스”)에서 이용자에 관한 정보를 다루는 방법에 대해 다음과 같이 개인정보 처리방침(이하 “본 방침”)을 정합니다.",
  sections: [
    {
      heading: "제1조 운영자와 적용 범위",
      blocks: [
        { type: "p", parts: ["본 서비스의 운영자는 다음과 같습니다."] },
        {
          type: "ul",
          items: ["운영 이름: Yoiailabs (개인 제작자)"],
        },
        {
          type: "p",
          parts: [
            "본 방침은 본 서비스를 이용함에 따라 운영자가 취득·이용하는 정보와, 본 서비스에 포함된 외부 서비스로 보내는 정보에 적용합니다. 링크된 서비스가 독자적으로 정보를 다루는 경우에는 각 서비스의 개인정보 처리방침도 확인해 주세요.",
          ],
        },
        {
          type: "p",
          parts: [
            "본 방침의 “개인정보”, “개인데이터”, “보유 개인데이터” 및 그 밖의 법령상 용어는 일본의 개인정보 보호에 관한 법률에 따릅니다.",
          ],
        },
      ],
    },
    {
      heading: "제2조 사진·영상의 취급",
      blocks: [
        {
          type: "p",
          parts: [
            "본 서비스에서 사진을 읽고 가공하고, 미리보기와 영상을 만드는 작업은 이용자 단말의 브라우저 안에서 이루어집니다. 이러한 통상적인 처리를 위해, 이용자가 고른 사진의 이미지 데이터나 만든 영상 데이터를 운영자의 서버 또는 외부 서비스에 업로드하지 않습니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "파일 이름은 단말 안에서 사진을 관리하고 표시하는 데 사용합니다. 사진·영상 본체와 파일 이름은 이용 분석이나 장애 진단을 위해 보내는 대상에 포함하지 않습니다. 다만 문제를 조사하는 데 필요한 정보로서 파일 형식, 확장자, 파일 크기, 읽기 처리 상황 등을 다룰 수 있습니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "사진을 고르거나 영상을 만드는 것만으로 SNS 등 외부 서비스에 자동으로 공개되지 않습니다. 이용자 자신이 사진·영상 등을 외부 서비스에 게시·전송한 경우, 그 정보는 전송처 서비스의 규정에 따라 취급됩니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "본 서비스는 계정 등록이 필요하지 않으며, 통상적인 사진·영상 생성을 위해 성명, 주소, 이메일 주소의 입력을 요구하지 않습니다. 문의 등을 할 때 이용자가 제공하는 정보는 다음 조 이후에 따라 취급합니다.",
          ],
        },
      ],
    },
    {
      heading: "제3조 취득·이용하는 정보와 이용 목적",
      blocks: [
        { type: "p", parts: ["운영자는 다음 정보를 각각 적힌 목적을 위해 취급합니다."] },
        {
          type: "table",
          headers: ["정보의 구분", "주요 정보", "이용 목적"],
          rows: [
            [
              "이용 상황에 관한 정보",
              "열람한 페이지, 참조원, 열람·조작의 일시, 브라우저를 식별하는 정보, 미리보기·저장 조작, 영상의 방향·효과 등",
              "이용 상황의 파악, 기능·화면의 개선",
            ],
            [
              "통신·이용 환경에 관한 정보",
              "IP 주소, 브라우저·OS·단말 정보, 표시 언어, 요청에 관한 정보 등",
              "페이지와 소재의 전달, 표시의 최적화, 보안 확보, 가동 상황의 확인",
            ],
            [
              "문제에 관한 정보",
              "오류 내용, 발생 당시의 페이지·조작에 관한 정보, 브라우저 등 환경 정보, 파일 형식·크기 등 진단 정보",
              "문제의 조사, 수정, 재발 방지",
            ],
            [
              "설정에 관한 정보",
              "선택한 표시 언어, 브라우저 안에 저장되는 설정·캐시 등",
              "표시 언어의 유지, 표시와 불러오기의 원활화",
            ],
            [
              "문의에 관한 정보",
              "연락처, 이용자가 제공한 성명·계정 이름, 문의 내용, 대응 이력, 필요한 본인 확인 정보 등",
              "문의·불만 대응, 필요한 사실 확인",
            ],
            [
              "본 서비스에서 소개하는 공개 게시물 정보",
              "공개된 게시 내용, 게시자의 표시 이름·계정 이름, 게시 일시, 게시 URL 등",
              "본 서비스와 관련된 게시·반응의 소개, 게재에 관한 문의 대응",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "외부 서비스를 통해 취득·처리되는 정보는 제5조도 확인해 주세요. 운영자가 관리 화면 등을 통해 볼 수 있는 정보와, 외부 서비스 제공자가 통신 처리 등을 위해 받는 정보가 항상 같지는 않습니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "운영자는 법령에서 인정하는 경우를 제외하고, 위 이용 목적을 달성하는 데 필요한 범위를 넘어 개인정보를 취급하지 않습니다. 이용자의 개인정보를 판매하지도 않습니다.",
          ],
        },
      ],
    },
    {
      heading: "제4조 쿠키 등의 이용",
      blocks: [
        {
          type: "p",
          parts: ["본 서비스는 표시 언어의 유지와 이용 상황의 파악 등을 위해 쿠키와 브라우저 안의 저장 영역을 이용합니다."],
        },
        {
          type: "ol",
          items: [
            {
              title: "언어 설정",
              text: "선택한 표시 언어를 anone-locale 이라는 쿠키에 저장합니다. 설정상의 유효 기간은 저장·갱신 시점부터 365일입니다. 실제 보관 기간은 브라우저 설정 등에 따라 더 짧아질 수 있습니다. 이 쿠키는 본 서비스에 접속할 때 전달 서버로 전송되며, 언어별 페이지로 안내하는 데 사용됩니다.",
            },
            {
              title: "이용 분석",
              text: "Google Analytics는 브라우저를 식별하고 이용 상황을 파악하기 위해 쿠키 등을 사용할 수 있습니다. 전송되는 정보 등은 제5조를 확인해 주세요.",
            },
            {
              title: "캐시",
              text: "본 서비스를 원활히 표시하기 위해 아이콘 등 전달 파일이 브라우저 안에 저장될 수 있습니다. 이 저장은 선택한 사진이나 만든 영상을 운영자가 수집하기 위한 것이 아닙니다.",
            },
          ],
        },
        {
          type: "p",
          parts: [
            "이용자는 브라우저 설정으로 쿠키 등을 제한·삭제할 수 있습니다. 그 경우 표시 언어의 유지 등 일부 기능을 이용하지 못할 수 있습니다. 쿠키를 제한·삭제하는 것만으로 모든 외부 통신이나 정보 수집이 멈추는 것은 아닙니다.",
          ],
        },
      ],
    },
    {
      heading: "제5조 외부 서비스의 이용과 정보의 외부 전송",
      blocks: [
        {
          type: "p",
          parts: [
            "본 서비스는 다음 외부 서비스를 이용합니다. 대상 페이지나 기능을 불러오거나 이용하면, 이용자의 단말에서 각 서비스로 정보가 전송됩니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "전송되는 정보는 이용 상황, 브라우저 설정, 외부 서비스 로그인 상태, 제공자 측 사양 등에 따라 달라집니다. 아래 정보에는 통상적인 통신에 필요한 IP 주소 등도 포함됩니다.",
          ],
        },
        {
          type: "table",
          headers: ["서비스 / 정보를 다루는 주요 사업자", "주요 전송 정보", "본 서비스에서의 이용 목적·전송 상황", "전송처의 주요 이용 목적"],
          rows: [
            [
              "Google Analytics / Google LLC",
              "페이지 URL, 참조원, 쿠키 등 식별 정보, 열람·조작 정보, 브라우저·단말·언어 정보, 통신에 따른 IP 주소 등",
              "이용 상황의 측정·개선. 페이지를 불러온 뒤나 조작 시 등. 자체 이벤트에서는 미리보기·저장 조작과 방향·효과를 측정",
              "분석 서비스의 제공·유지·개선 등. 그 밖의 취급은 Google과의 설정·적용 약관에 따름",
            ],
            [
              "Sentry / Functional Software, Inc.",
              "오류 내용, 발생 페이지·조작 이력 등 진단 정보, 단말·브라우저 정보, 필요에 따른 파일 형식·크기 등, 통신에 필요한 정보",
              "오류 감시 기능의 불러오기·오류 보고 등. 문제의 조사·수정",
              "장애 감시·진단 서비스의 제공, 유지보수, 보안 확보 등",
            ],
            [
              "Cloudflare / Cloudflare, Inc.",
              "IP 주소, 접속한 주소, 접속 일시, 요청 정보, 브라우저 등의 정보, 언어 쿠키 등",
              "본 서비스의 페이지·소재 전달, 언어별 페이지 안내, 가동 감시, 부정 접근 대책",
              "전달·보안·가동 감시 서비스의 제공 등",
            ],
            [
              "Google Fonts / Google LLC",
              "IP 주소, 폰트 요청, 브라우저 정보, 통신에 따른 참조원 정보 등",
              "페이지에서 사용하는 폰트의 전달",
              "폰트 전달 서비스의 제공·유지 등",
            ],
            [
              "YouTube / Google LLC",
              "IP 주소, 브라우저·단말 정보, 임베드의 참조원, 재생 조작 정보, 쿠키 등의 정보",
              "임베드 플레이어를 불러오고 조작하여 영상을 표시·재생",
              "영상 전달, 이용 상황 분석, 부정 방지 등. 설정 등에 따른 콘텐츠·광고 제공",
            ],
            [
              "X / X Corp.",
              "IP 주소, 브라우저·단말 정보, 임베드의 참조원, 열람·조작 정보, 쿠키 등의 정보",
              "임베드 게시물·관련 위젯의 불러오기·표시",
              "게시물 표시, 서비스 제공·분석, 부정 방지 등. 설정 등에 따른 개인화",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "YouTube 임베드에는 개인정보 보호 강화 모드를 사용하고, X 임베드에는 추적을 줄이는 지정을 하고 있습니다. 다만 이러한 설정이 외부 서비스로의 통신이나 정보 취급이 전혀 일어나지 않는다는 뜻은 아닙니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "Sentry에 대해서는 성명 등을 이용자 정보로 설정해 보내지 않으며, 요청 본문이나 쿠키 등을 오류 보고에서 제거하는 처리를 합니다. 다만 진단 정보나 통신에 필요한 정보까지 모두 보내지 않는다는 뜻은 아닙니다.",
          ],
        },
        {
          type: "sources",
          intro: "각 서비스의 취급에 대한 자세한 내용은 다음을 확인해 주세요.",
          separator: " / ",
          items: [
            {
              name: "Google",
              links: [
                { href: "https://policies.google.com/privacy?hl=ko", label: "개인정보처리방침" },
                {
                  href: "https://policies.google.com/technologies/partner-sites?hl=ko",
                  label: "Google 서비스를 이용하는 사이트·앱에서의 정보 취급",
                },
              ],
            },
            {
              name: "Google Analytics",
              links: [{ href: "https://support.google.com/analytics/answer/6004245?hl=ko", label: "데이터 보호" }],
            },
            {
              name: "Sentry",
              links: [
                { href: SENTRY_TERMS_URL, label: "서비스 이용약관" },
                { href: SENTRY_DPA_URL, label: "데이터 처리 부속서" },
                { href: SENTRY_DATA_COLLECTED_URL, label: "JavaScript SDK가 수집하는 데이터" },
                { href: SENTRY_PRIVACY_URL, label: "개인정보 처리방침" },
              ],
            },
            {
              name: "Cloudflare",
              links: [{ href: CLOUDFLARE_PRIVACY_URL, label: "개인정보 처리방침" }],
            },
            {
              name: "X",
              links: [
                { href: "https://x.com/ko/privacy", label: "개인정보 처리방침" },
                { href: "https://help.x.com/ko/rules-and-policies/x-cookies", label: "쿠키 등의 이용" },
              ],
            },
          ],
        },
        {
          type: "p",
          parts: [
            "장애 진단을 위해 Sentry로 보내는 서비스 데이터의 취급은 운영자와 Sentry의 계약에 따릅니다. Sentry 자신의 웹사이트 등에 적용되는 개인정보 처리방침과는 적용 범위가 다릅니다.",
          ],
        },
      ],
    },
    {
      heading: "제6조 제3자 제공, 위탁 및 국외에서의 취급",
      blocks: [
        {
          type: "p",
          parts: [
            "운영자는 본인의 동의가 있는 경우, 법령에 따른 경우, 그 밖에 법령에서 인정하는 경우를 제외하고 개인데이터를 제3자에게 제공하지 않습니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "이용 목적의 달성에 필요한 범위에서 개인데이터 취급을 위탁하는 경우, 수탁자를 적절히 선정하고 그 취급 상황에 대해 필요하고 적절한 감독을 합니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "제5조의 외부 서비스로의 전송에는, 이용자의 단말에서 외부 서비스 제공자가 정보를 직접 취득하는 경우가 포함됩니다. 이러한 외부 서비스를 이용할 때는 본 방침 외에 각 제공자의 취급도 확인해 주세요.",
          ],
        },
        {
          type: "p",
          parts: [
            "외부 서비스 이용에 따라 정보가 일본 국외에서 취급될 수 있습니다. 운영자가 외국에 있는 제3자에게 개인데이터를 제공하는 경우에 해당하면, 법령에 따라 필요한 정보 제공과 동의 취득, 또는 법령에서 인정하는 그 밖의 조치를 합니다.",
          ],
        },
      ],
    },
    {
      heading: "제7조 보관 기간과 삭제",
      blocks: [
        {
          type: "p",
          parts: [
            "운영자는 다루는 정보의 내용, 이용 목적, 대응·조사에 필요한 기간, 법령상 의무 등을 고려하여, 목적 달성에 필요한 기간에 한정해 정보를 보관합니다. 보관할 필요가 없어진 정보는 합리적인 기간 안에 삭제하는 등 적절히 처리합니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "외부 서비스에 저장되는 정보는, 운영자가 설정·관리할 수 있는 범위에서 보관 기간과 삭제를 관리합니다. 외부 서비스 제공자가 독자적으로 보관하는 정보에는 해당 제공자의 보관 방침이 적용됩니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "단말 안에서 처리되어 운영자가 취득하지 않은 사진·생성 영상에 대해, 운영자 쪽에 삭제할 원본이나 저장 데이터는 없습니다. 이용자가 단말에 저장한 파일은 이용자 자신이 관리·삭제해 주세요. 브라우저 안의 쿠키·캐시 등은 브라우저 설정에서 삭제할 수 있습니다.",
          ],
        },
      ],
    },
    {
      heading: "제8조 안전관리",
      blocks: [
        {
          type: "p",
          parts: [
            "운영자는 개인데이터의 유출, 멸실 또는 훼손의 방지와 그 밖의 안전관리를 위해, 다루는 정보와 운영 규모에 맞추어 필요하고 적절한 조치를 합니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "주요 조치로, 정보를 다루는 사람과 관리 계정의 제한, 인증 정보의 적절한 관리, 관리 단말의 보호, 통신의 암호화, 소프트웨어 업데이트, 불필요한 정보의 수집·전송 억제, 외부 서비스의 설정과 취급 상황 확인을 합니다.",
          ],
        },
      ],
    },
    {
      heading: "제9조 정보 수집의 제한",
      blocks: [
        {
          type: "p",
          parts: [
            "이용자는 브라우저 설정으로 쿠키 등을 제한·삭제하는 것 외에, 지원되는 환경에서는 ",
            { href: "https://tools.google.com/dlpage/gaoptout?hl=ko", label: "Google Analytics 옵트아웃 부가기능" },
            "을 이용할 수 있습니다. 부가기능의 이용 가능 여부와 효과는 단말·브라우저 등 환경에 따라 다릅니다.",
          ],
        },
        {
          type: "p",
          parts: [
            "Google 광고 설정의 변경은 광고 개인화 등에 관한 설정이며, 본 서비스의 이용 분석이나 모든 외부 통신을 멈추는 것은 아닙니다. Google Analytics 옵트아웃도 Sentry, Cloudflare, 외부 폰트, 임베드 콘텐츠 등으로의 통신을 한꺼번에 멈추는 것은 아닙니다.",
          ],
        },
        {
          type: "p",
          parts: ["외부 서비스 쪽의 정보 취급을 제한하려면, 각 서비스가 제공하는 설정·절차도 확인해 주세요."],
        },
      ],
    },
    {
      heading: "제10조 본 방침의 변경",
      blocks: [
        {
          type: "p",
          parts: ["운영자는 법령의 개정, 본 서비스의 기능 또는 정보 취급의 변경 등에 따라 본 방침을 개정할 수 있습니다."],
        },
        {
          type: "p",
          parts: [
            "개정하는 경우에는 본 페이지에 변경 후의 내용, 최종 개정일 및 적용 시작일을 게재합니다.",
          ],
        },
      ],
    },
  ],
};

const zh: PrivacyDocument = {
  revisedLabel: "最后修订日：",
  revisedValue: "2026年9月22日",
  effectiveLabel: "开始适用日：",
  effectiveValue: "2026年9月22日",
  preamble:
    "あのね跳跃制作器的运营者（下称“运营者”）就あのね跳跃制作器及其相关页面（下称“本服务”）中与使用者有关的信息的处理，制定如下隐私政策（下称“本政策”）。",
  sections: [
    {
      heading: "第1条　运营者与适用范围",
      blocks: [
        { type: "p", parts: ["本服务的运营者如下。"] },
        {
          type: "ul",
          items: ["运营名称：Yoiailabs（个人创作者）"],
        },
        {
          type: "p",
          parts: [
            "本政策适用于因使用本服务而由运营者取得、使用的信息，以及向本服务所接入的外部服务发送的信息。链接目的地的服务自行处理信息时，也请查看各服务的隐私政策等。",
          ],
        },
        {
          type: "p",
          parts: ["本政策中的“个人信息”“个人数据”“持有的个人数据”以及其他法律用语，依日本《个人信息保护法》。"],
        },
      ],
    },
    {
      heading: "第2条　照片和视频的处理",
      blocks: [
        {
          type: "p",
          parts: [
            "本服务中照片的读取与加工、预览以及视频的生成，均在使用者终端的浏览器内进行。为进行这些通常处理，不会把使用者所选照片的图像数据或生成的视频数据上传到运营者的服务器或外部服务。",
          ],
        },
        {
          type: "p",
          parts: [
            "文件名用于在终端内管理和显示照片。照片、视频本身以及文件名，不纳入为访问分析或故障诊断而发送的对象。但作为调查问题所需的信息，可能会处理文件格式、扩展名、文件大小、读取处理状况等。",
          ],
        },
        {
          type: "p",
          parts: [
            "仅选择照片或生成视频，不会自动发布到社交网络或其他外部服务。使用者自行把照片、视频等投稿或发送到外部服务时，该信息依发送目的地服务的规定处理。",
          ],
        },
        {
          type: "p",
          parts: [
            "本服务不需要注册账号，也不会为通常的照片、视频生成而要求输入姓名、地址或电子邮箱。使用者在咨询等场合提供的信息，依以下各条处理。",
          ],
        },
      ],
    },
    {
      heading: "第3条　收集、使用的信息与使用目的",
      blocks: [
        { type: "p", parts: ["运营者为各项所列目的处理下列信息。"] },
        {
          type: "table",
          headers: ["信息类别", "主要信息", "使用目的"],
          rows: [
            [
              "与使用情况有关的信息",
              "浏览的页面、来源、浏览和操作的日期时间、识别浏览器的信息、预览和保存操作、视频的方向和效果等",
              "掌握使用情况，改进功能和界面",
            ],
            [
              "与通信和使用环境有关的信息",
              "IP地址、浏览器、操作系统和终端的信息、界面语言、与请求有关的信息等",
              "分发页面和素材，优化显示，保障安全，确认运行状况",
            ],
            [
              "与故障有关的信息",
              "错误内容、发生时的页面和操作信息、浏览器等环境信息、文件格式和大小等诊断信息",
              "调查故障、修复、防止再次发生",
            ],
            [
              "与设置有关的信息",
              "所选的界面语言，以及保存在浏览器中的设置和缓存等",
              "保持界面语言，使显示和加载更顺畅",
            ],
            [
              "与咨询有关的信息",
              "联系方式、使用者提供的姓名或账号名、咨询内容、处理记录、必要的本人确认信息等",
              "回应咨询和投诉，确认必要的事实",
            ],
            [
              "本服务所介绍的公开投稿信息",
              "已公开的投稿内容、投稿者的显示名和账号名、投稿时间、投稿网址等",
              "介绍与本服务有关的投稿和反应，回应与刊登有关的咨询",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "通过外部服务取得或处理的信息，也请查看第5条。运营者通过管理界面等能够查看的信息，与外部服务提供者为处理通信等而收到的信息，不一定相同。",
          ],
        },
        {
          type: "p",
          parts: ["除法律允许的情况外，运营者不会超出实现上述使用目的所需的范围处理个人信息。也不会出售使用者的个人信息。"],
        },
      ],
    },
    {
      heading: "第4条　Cookie等的使用",
      blocks: [
        { type: "p", parts: ["本服务为保持界面语言、掌握使用情况等，使用 Cookie 以及浏览器内的存储区域。"] },
        {
          type: "ol",
          items: [
            {
              title: "语言设置",
              text: "所选界面语言保存在名为 anone-locale 的 Cookie 中。设定上的有效期为保存或更新之时起 365 日。实际保存期间可能因浏览器设置等而更短。访问本服务时，该 Cookie 会发送到分发服务器，用于引导至对应语言的页面。",
            },
            {
              title: "访问分析",
              text: "Google Analytics 可能会使用 Cookie 等，以识别浏览器并掌握使用情况。发送的信息等请查看第5条。",
            },
            {
              title: "缓存",
              text: "为顺畅显示本服务，图标等分发文件可能会保存在浏览器中。这种保存并不是为了让运营者收集所选照片或生成的视频。",
            },
          ],
        },
        {
          type: "p",
          parts: [
            "使用者可以在浏览器设置中限制或删除 Cookie 等。此时，保持界面语言等部分功能可能无法使用。仅限制或删除 Cookie，并不会停止全部外部通信或信息收集。",
          ],
        },
      ],
    },
    {
      heading: "第5条　外部服务的使用与信息的对外发送",
      blocks: [
        {
          type: "p",
          parts: ["本服务使用下列外部服务。在加载或使用相应页面、功能时，会从使用者的终端向各服务发送信息。"],
        },
        {
          type: "p",
          parts: [
            "发送的信息会因使用情况、浏览器设置、是否登录外部服务、提供者一侧的规格等而不同。下列信息也包括通常通信所需的 IP 地址等。",
          ],
        },
        {
          type: "table",
          headers: ["服务／处理信息的主要事业者", "主要发送信息", "在本服务中的使用目的与发送场合", "发送目的地的主要使用目的"],
          rows: [
            [
              "Google Analytics／Google LLC",
              "页面 URL、来源、Cookie 等识别信息、浏览和操作信息、浏览器、终端和语言信息、通信所伴随的 IP 地址等",
              "测量并改进使用情况。页面加载后或操作时等。自定义事件测量预览、保存操作以及方向和效果",
              "提供、维持、改进分析服务等。其他处理依与 Google 的设置和适用条款",
            ],
            [
              "Sentry／Functional Software, Inc.",
              "错误内容、发生页面和操作记录等诊断信息、终端和浏览器信息、必要时的文件格式和大小等、通信所需信息",
              "加载错误监控功能、发送错误报告等。调查并修复故障",
              "提供故障监控和诊断服务、维护、保障安全等",
            ],
            [
              "Cloudflare／Cloudflare, Inc.",
              "IP 地址、访问地址、访问日期时间、请求信息、浏览器等信息、语言 Cookie 等",
              "分发本服务的页面和素材，引导至对应语言的页面，监控运行，防范未经授权的访问",
              "提供分发、安全和运行监控等服务",
            ],
            [
              "Google Fonts／Google LLC",
              "IP 地址、字体获取请求、浏览器信息、通信所伴随的来源信息等",
              "分发页面使用的字体",
              "提供并维持字体分发服务等",
            ],
            [
              "YouTube／Google LLC",
              "IP 地址、浏览器和终端信息、嵌入的来源、播放操作信息、Cookie 等信息",
              "加载并操作嵌入播放器以显示和播放视频",
              "分发视频、分析使用情况、防止滥用等。依设置等提供内容和广告",
            ],
            [
              "X／X Corp.",
              "IP 地址、浏览器和终端信息、嵌入的来源、浏览和操作信息、Cookie 等信息",
              "加载并显示嵌入的投稿及相关小组件",
              "显示投稿、提供并分析服务、防止滥用等。依设置等进行个性化",
            ],
          ],
        },
        {
          type: "p",
          parts: [
            "YouTube 的嵌入使用隐私加强模式，X 的嵌入使用抑制跟踪的指定。这些设置并不表示不会与外部服务发生任何通信，或外部服务完全不处理信息。",
          ],
        },
        {
          type: "p",
          parts: [
            "对于 Sentry，不会把姓名等设为使用者信息并发送，并会从错误报告中去除请求正文和 Cookie 等。这并不表示诊断信息以及通信所需的信息也全部不发送。",
          ],
        },
        {
          type: "sources",
          intro: "各服务如何处理信息，请查看下列资料。",
          separator: "／",
          items: [
            {
              name: "Google",
              links: [
                { href: "https://policies.google.com/privacy?hl=zh-CN", label: "隐私政策" },
                {
                  href: "https://policies.google.com/technologies/partner-sites?hl=zh-CN",
                  label: "使用 Google 服务的网站和应用如何处理信息",
                },
              ],
            },
            {
              name: "Google Analytics",
              links: [{ href: "https://support.google.com/analytics/answer/6004245?hl=zh-CN", label: "数据保护" }],
            },
            {
              name: "Sentry",
              links: [
                { href: SENTRY_TERMS_URL, label: "服务条款" },
                { href: SENTRY_DPA_URL, label: "数据处理附录" },
                { href: SENTRY_DATA_COLLECTED_URL, label: "JavaScript SDK 收集的数据" },
                { href: SENTRY_PRIVACY_URL, label: "隐私政策" },
              ],
            },
            {
              name: "Cloudflare",
              links: [{ href: CLOUDFLARE_PRIVACY_URL, label: "隐私政策" }],
            },
            {
              name: "X",
              links: [
                { href: "https://x.com/zh/privacy", label: "隐私政策" },
                { href: "https://help.x.com/zh/rules-and-policies/x-cookies", label: "Cookie 等的使用" },
              ],
            },
          ],
        },
        {
          type: "p",
          parts: [
            "为故障诊断而发送给 Sentry 的服务数据，依运营者与 Sentry 之间的合同处理。其适用范围与适用于 Sentry 自身网站等的隐私政策不同。",
          ],
        },
      ],
    },
    {
      heading: "第6条　向第三方提供、委托及在境外的处理",
      blocks: [
        { type: "p", parts: ["除本人同意、依据法令、以及其他法令允许的情况外，运营者不向第三方提供个人数据。"] },
        {
          type: "p",
          parts: ["在实现使用目的所需的范围内委托处理个人数据时，运营者会适当选定受托方，并对其处理状况进行必要且适当的监督。"],
        },
        {
          type: "p",
          parts: [
            "第5条向外部服务发送的信息，包括外部服务提供者从使用者终端直接取得信息的情况。使用这些外部服务时，除本政策外，也请确认各提供者的处理方式。",
          ],
        },
        {
          type: "p",
          parts: [
            "因使用外部服务，信息可能在日本境外被处理。如果属于运营者向位于外国的第三方提供个人数据，运营者将依法令提供必要信息并取得同意，或采取法令允许的其他措施。",
          ],
        },
      ],
    },
    {
      heading: "第7条　保存期限与删除",
      blocks: [
        {
          type: "p",
          parts: [
            "运营者会考虑所处理信息的内容、使用目的、回应和调查所需的期间、法令上的义务等，仅在实现目的所需的期间内保存信息。不再需要保存的信息，将在合理期间内删除或以其他适当方式处理。",
          ],
        },
        {
          type: "p",
          parts: [
            "对于保存在外部服务中的信息，运营者在能够设定和管理的范围内管理保存期限和删除。外部服务提供者自行保存的信息，适用该提供者的保存方针。",
          ],
        },
        {
          type: "p",
          parts: [
            "对于在终端内处理、运营者并未取得的照片和生成视频，运营者一侧没有可作为删除对象的原件或保存数据。使用者保存在终端上的文件，请自行管理和删除。浏览器中的 Cookie、缓存等，可以在浏览器设置中删除。",
          ],
        },
      ],
    },
    {
      heading: "第8条　安全管理",
      blocks: [
        {
          type: "p",
          parts: ["运营者为防止个人数据泄露、灭失或毁损，并采取其他安全管理措施，会按所处理的信息和运营规模，采取必要且适当的措施。"],
        },
        {
          type: "p",
          parts: [
            "主要措施包括：限制处理信息的人员和管理者账号，适当管理认证信息，保护管理用终端，加密通信，更新软件，抑制不必要的信息收集和发送，确认外部服务的设置和处理状况。",
          ],
        },
      ],
    },
    {
      heading: "第9条　限制信息收集",
      blocks: [
        {
          type: "p",
          parts: [
            "除了在浏览器设置中限制或删除 Cookie 等之外，在支持的环境中还可以使用",
            { href: "https://tools.google.com/dlpage/gaoptout?hl=zh-CN", label: "Google Analytics 停用插件" },
            "。插件能否使用及其效果，因终端、浏览器等环境而不同。",
          ],
        },
        {
          type: "p",
          parts: [
            "更改 Google 的广告设置，是关于广告个性化等的设置，并不会停止本服务的访问分析或全部外部通信。停用 Google Analytics，也不会一并停止与 Sentry、Cloudflare、外部字体、嵌入内容等的通信。",
          ],
        },
        { type: "p", parts: ["如果希望限制外部服务一侧对信息的处理，也请查看各服务提供的设置和手续。"] },
      ],
    },
    {
      heading: "第10条　本政策的变更",
      blocks: [
        { type: "p", parts: ["运营者可能根据法令修订、本服务功能或信息处理的变更等，修订本政策。"] },
        {
          type: "p",
          parts: [
            "修订时，会在本页刊登变更后的内容、最后修订日和开始适用日。",
          ],
        },
      ],
    },
  ],
};

export const PRIVACY_COPY: Record<Locale, PrivacyDocument> = { ja, en, ko, zh };

export function privacyDocument(locale: Locale): PrivacyDocument {
  return PRIVACY_COPY[locale];
}
