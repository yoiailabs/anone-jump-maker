import { DEFAULT_LOCALE, LOCALES, type AppView } from "./i18n.ts";
import { pageUrl } from "./page-meta.ts";

const VIEWS: readonly AppView[] = ["maker", "community"];

export function sitemapXml(): string {
  const urls = VIEWS.flatMap((view) =>
    LOCALES.map((locale) => {
      const loc = pageUrl(locale, view);
      const links = [
        ...LOCALES.map(
          (item) =>
            `    <xhtml:link rel="alternate" hreflang="${item}" href="${pageUrl(item, view)}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(DEFAULT_LOCALE, view)}"/>`,
      ].join("\n");
      return `  <url>\n    <loc>${loc}</loc>\n${links}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}
