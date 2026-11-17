// Builds the site around the app into dist/: the welcome page and the guide, one plain HTML page
// per language of each (/, /it/, /fr/, /de/, /es/ and /guide/, /it/guida/, ...) so search engines
// read each in its own language, with the links between them (hreflang), the data for search
// results (JSON-LD), a sitemap and robots.txt; plus the legal pages, the colour sets the pages
// share with the app, and the fonts they need (served from here, so the pages ask no one else for
// anything).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COMMUNITY, CONTRIBUTE } from "../site/contribute.mjs";
import { renderMarkdown } from "../site/docs-page.mjs";
import { GUIDE } from "../site/guide.mjs";
import { GUIDES, MORE } from "../site/guides.mjs";
import { NEWS } from "../site/news.mjs";
import { TEXTS } from "../site/texts.mjs";
import {
  CHANGELOG,
  GUIDE_TOPICS,
  ROADMAP,
  contributePath,
  guidePath,
  newsPath,
  pick,
} from "../src/content/news.ts";

const ORIGIN = "https://heroquill.app";
const LANGUAGES = ["en", "it", "fr", "de", "es"];
const LOCALES = { en: "en_US", it: "it_IT", fr: "fr_FR", de: "de_DE", es: "es_ES" };
const FAQ = [1, 2, 3, 4, 5, 6];

const homePath = (lang) => (lang === "en" ? "/" : `/${lang}/`);
const newsPagePath = (lang) => newsPath(lang);
const contributePagePath = (lang) => contributePath(lang);
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => escapeHtml(text).replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);

const alternatesOf = (pathOf) =>
  [
    ...LANGUAGES.map(
      (l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathOf(l)}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathOf("en")}" />`,
  ].join("\n");

// Every option of the language list leads to the same kind of page in its language.
const withLanguageLinks = (html, lang, pathOf) => {
  let out = html;
  for (const l of LANGUAGES)
    out = out.replace(`<option value="${l}"`, `<option value="${l}" data-href="${pathOf(l)}"`);
  return out.replace(
    `<option value="${lang}" data-href`,
    `<option value="${lang}" selected data-href`,
  );
};

// Every element with data-i18n holds only a text: it is replaced by the text of the language.
function translate(html, lang) {
  const t = TEXTS[lang];
  const missing = new Set();
  const labelled = html
    .replace(/ data-i18n-label="([^"]+)"/g, (whole, key) =>
      t[key] === undefined ? whole : ` aria-label="${escapeAttr(t[key])}"`,
    )
    .replace(/(<button[^>]*\bdata-close\b[^>]*?) aria-label="Close"/g, (whole, head) =>
      t["nav.close"] === undefined ? whole : `${head} aria-label="${escapeAttr(t["nav.close"])}"`,
    );
  const out = labelled.replace(
    /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, _tag, key, _old, close) => {
      const text = t[key];
      if (text === undefined) {
        missing.add(key);
        return whole;
      }
      return `${open}${escapeHtml(text)}${close}`;
    },
  );
  if (missing.size > 0) throw new Error(`${lang}: no text for ${[...missing].join(", ")}`);
  return out;
}

// ---- the welcome page ----
const template = readFileSync("site/index.template.html", "utf8");

function homeJsonLd(lang, t) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: "Heroquill",
        inLanguage: LANGUAGES,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${ORIGIN}/#app`,
        name: "Heroquill",
        url: `${ORIGIN}${homePath(lang)}`,
        description: t["meta.desc"],
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires a modern web browser",
        inLanguage: lang,
        isAccessibleForFree: true,
        image: `${ORIGIN}/og-image.png`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        featureList: [
          t["val.srd"],
          t["val.multi"],
          t["val.homebrew"],
          t["val.aurora"],
          t["val.pdf"],
          t["val.offline"],
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((n) => ({
          "@type": "Question",
          name: t[`faq.q${n}`],
          acceptedAnswer: { "@type": "Answer", text: t[`faq.a${n}`] },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");
}

// The list under the Guide link of the bar: the guide to creating a character, then the others.
function guideMenu(lang) {
  const items = [
    [guidePath(lang), GUIDE[lang].h1],
    ...GUIDE_TOPICS.map((topic) => [guidePath(lang, topic), GUIDES[topic][lang].label]),
  ];
  return items
    .map(([href, label]) => `            <li><a href="${href}">${escapeHtml(label)}</a></li>`)
    .join("\n");
}

function homePage(lang) {
  const t = TEXTS[lang];
  const html = template
    .replaceAll("{{lang}}", lang)
    .replaceAll("{{title}}", escapeAttr(t["meta.title"]))
    .replaceAll("{{description}}", escapeAttr(t["meta.desc"]))
    .replaceAll("{{url}}", `${ORIGIN}${homePath(lang)}`)
    .replaceAll("{{ogLocale}}", LOCALES[lang])
    .replaceAll("{{guideUrl}}", guidePath(lang))
    .replaceAll("{{newsUrl}}", newsPagePath(lang))
    .replaceAll("{{contributeUrl}}", contributePagePath(lang))
    .replaceAll("{{auroraGuideUrl}}", guidePath(lang, "aurora"))
    .replaceAll("{{guideMenu}}", guideMenu(lang))
    .replace("{{alternates}}", alternatesOf(homePath))
    .replace("{{jsonld}}", homeJsonLd(lang, t));
  return withLanguageLinks(translate(html, lang), lang, homePath);
}

// The bar and the foot of the welcome page, for the pages that go around an article: the links
// that point inside the welcome page keep pointing there, and each language of the list leads to
// the same page in that language (`pathOf`).
function shell(lang, pathOf) {
  const homeHtml = homePage(lang);
  const bar = /<header class="nav on-dark">[\s\S]*?<\/header>/.exec(homeHtml)?.[0];
  const foot = /<footer class="foot on-dark">[\s\S]*?<\/footer>/.exec(homeHtml)?.[0];
  const side = /<aside class="side on-dark"[\s\S]*?<\/aside>/.exec(homeHtml)?.[0];
  if (!bar || !foot || !side)
    throw new Error("the bar, the side menu or the foot of the welcome page was not found");
  const home = homePath(lang);
  const barHere = LANGUAGES.reduce(
    (html, l) =>
      html.replace(
        new RegExp(`(<option value="${l}"[^>]*?)data-href="[^"]*"`),
        `$1data-href="${pathOf(l)}"`,
      ),
    `${bar}\n    ${side}`.replace(/href="#/g, `href="${home}#`),
  );
  return { bar: barHere, foot };
}

// ---- the guide: sections of paragraphs and lists ----
function guideBlocks(sections) {
  return sections
    .map(([heading, blocks]) => {
      const body = blocks
        .map((block) =>
          Array.isArray(block)
            ? `<ul>\n${block.map((item) => `            <li>${escapeHtml(item)}</li>`).join("\n")}\n          </ul>`
            : `<p>${escapeHtml(block)}</p>`,
        )
        .join("\n          ");
      return `        <section>\n          <h2>${escapeHtml(heading)}</h2>\n          ${body}\n        </section>`;
    })
    .join("\n");
}

// A page that goes around an article: the head, the bar and the foot of the welcome page, a
// first screen with the title, the article, and a call to open the app.
function articleDocument(lang, pathOf, a) {
  const t = TEXTS[lang];
  const home = homePath(lang);
  const url = `${ORIGIN}${pathOf(lang)}`;
  const { bar, foot } = shell(lang, pathOf);
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      a.main(url),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Heroquill", item: `${ORIGIN}${home}` },
          { "@type": "ListItem", position: 2, name: a.crumb, item: url },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="${lang}" data-palette="notte">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#121a2c" />
    <title>${escapeHtml(a.title)}</title>
    <meta name="description" content="${escapeAttr(a.desc)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
${a.single ? "" : `${alternatesOf(pathOf)}\n`}    <meta property="og:type" content="${a.ogType}" />
    <meta property="og:site_name" content="Heroquill" />
    <meta property="og:title" content="${escapeAttr(a.title)}" />
    <meta property="og:description" content="${escapeAttr(a.desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="${LOCALES[lang]}" />
    <meta property="og:image" content="${ORIGIN}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(a.title)}" />
    <meta name="twitter:description" content="${escapeAttr(a.desc)}" />
    <meta name="twitter:image" content="${ORIGIN}/og-image.png" />
    <script type="application/ld+json">${jsonld}</script>
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/fonts/cinzel-700.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/palettes.css" />
    <link rel="stylesheet" href="/site.css" />
    <script>
      document.documentElement.classList.add("js");
      try {
        var saved = JSON.parse(localStorage.getItem("theme") || "null") || {};
        var palettes = ["notte", "classico", "bordeaux", "foresta", "arcano", "ghiaccio", "rame", "ossidiana"];
        var before = !("palette" in saved) && ("style" in saved || "scheme" in saved);
        document.documentElement.dataset.palette =
          palettes.indexOf(saved.palette) >= 0 ? saved.palette : before ? "classico" : "notte";
      } catch (e) {}
    </script>
  </head>
  <body>
    ${bar}

    <main>
      <section class="page-hero on-dark">
        <div class="wrap narrow">
          <p class="crumb"><a href="${home}">Heroquill</a> › ${escapeHtml(a.crumb)}</p>
          <h1>${escapeHtml(a.h1)}</h1>
          <p class="lead">${escapeHtml(a.intro)}</p>
        </div>
      </section>

      <article class="band on-light">
${
  a.toc
    ? `        <div class="wrap docs">
          <nav class="doc-toc" aria-label="Contents">
${a.toc}
          </nav>
          <div class="prose doc-body">
${a.body}
          </div>
        </div>`
    : `        <div class="wrap narrow prose${a.plain ? " plain" : ""}">
${a.body}
        </div>`
}
      </article>

      <section class="cta on-dark">
        <div class="wrap">
          <p class="lead">${escapeHtml(a.cta)}</p>
          <div class="actions">
            <a class="button" href="/app/#example">${escapeHtml(t["hero.try"])}</a>
            <a class="button ghost" href="/app/">${escapeHtml(t["hero.cta"])}</a>
          </div>
        </div>
      </section>
    </main>

    ${foot}
    <script src="/site.js"></script>
  </body>
</html>
`;
}

// The other guides, as a list of links under an article: the main guide first, then the guides
// that go deeper (the one being read is left out).
function moreGuides(lang, topic) {
  const items = [
    topic && [guidePath(lang), GUIDE[lang].h1],
    ...GUIDE_TOPICS.filter((other) => other !== topic).map((other) => [
      guidePath(lang, other),
      GUIDES[other][lang].h1,
    ]),
  ]
    .filter(Boolean)
    .map(([href, label]) => `            <li><a href="${href}">${escapeHtml(label)}</a></li>`)
    .join("\n");
  return `        <section>
          <h2>${escapeHtml(MORE[lang])}</h2>
          <ul>
${items}
          </ul>
        </section>`;
}

// The guide to creating a character (no topic) and the guides on one part of the app.
function guidePage(lang, topic) {
  const g = topic ? GUIDES[topic][lang] : GUIDE[lang];
  return articleDocument(lang, (l) => guidePath(l, topic), {
    title: g.title,
    desc: g.desc,
    h1: g.h1,
    intro: g.intro,
    crumb: topic ? g.label : TEXTS[lang]["nav.guide"],
    cta: g.cta,
    ogType: "article",
    body: `${guideBlocks(g.sections)}\n${moreGuides(lang, topic)}`,
    main: (url) => ({
      "@type": "Article",
      headline: g.h1,
      description: g.desc,
      inLanguage: lang,
      mainEntityOfPage: url,
      datePublished: today,
      dateModified: today,
      image: `${ORIGIN}/og-image.png`,
      author: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
      publisher: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
    }),
  });
}

// ---- the news: the changelog and the roadmap of the app, as a page of reading ----
const UI = Object.fromEntries(
  LANGUAGES.map((l) => [l, JSON.parse(readFileSync(`locales/${l}/ui.json`, "utf8"))]),
);

function newsBody(lang) {
  const n = NEWS[lang];
  const label = (version) =>
    (UI[lang]["about.changelog.version"] ?? "Version {version}").replace("{version}", version);
  const history = CHANGELOG.map((entry) => {
    const notes = entry.notes
      .map((note) => `            <li>${escapeHtml(pick(note, lang))}</li>`)
      .join("\n");
    return `        <section>
          <h3>${escapeHtml(label(entry.version))} <small>${entry.date}</small></h3>
          <ul>
${notes}
          </ul>
        </section>`;
  }).join("\n");
  const roadmap = ROADMAP.map(
    (item) => `            <li>${escapeHtml(pick(item.text, lang))}</li>`,
  ).join("\n");
  return `        <section>
          <h2>${escapeHtml(n.history)}</h2>
${history}
        </section>
        <section>
          <h2>${escapeHtml(n.roadmap)}</h2>
          <p>${escapeHtml(UI[lang]["about.roadmap.intro"] ?? "")}</p>
          <ul>
${roadmap}
          </ul>
        </section>`;
}

function newsPage(lang) {
  const n = NEWS[lang];
  return articleDocument(lang, newsPagePath, {
    title: n.title,
    desc: n.desc,
    h1: n.h1,
    intro: n.intro,
    crumb: TEXTS[lang]["nav.news"],
    cta: TEXTS[lang]["cta.title"],
    ogType: "website",
    plain: true,
    body: newsBody(lang),
    main: (url) => ({
      "@type": "WebPage",
      name: n.h1,
      description: n.desc,
      inLanguage: lang,
      url,
      dateModified: CHANGELOG[0]?.date ?? today,
      isPartOf: { "@id": `${ORIGIN}/#website` },
    }),
  });
}

// ---- contribute: the ways of helping, each shown only while its address is set ----
// A small drawn icon for each way; site.css moves it when its section scrolls into view.
const ICONS = {
  like: '<path class="heart" d="M12 20.5C5 15.6 3 12.2 3 9.1 3 6.6 4.9 4.8 7.2 4.8c1.8 0 3.4 1 4.8 3 1.4-2 3-3 4.8-3C19.1 4.8 21 6.6 21 9.1c0 3.1-2 6.5-9 11.4z"/>',
  translate:
    '<path d="M3 5.5h10M8 3.5v2M5 5.5c.6 3 2.6 5.2 5.5 6.5M11 5.5c-.7 3-3 5.6-6.5 7.2"/><path class="word" d="M12.5 20.5l4-10 4 10M14 17h5"/>',
  report:
    '<g class="bug"><ellipse cx="12" cy="14" rx="4.2" ry="5.5"/><path d="M9.5 8.5c.5-2.2 4.5-2.2 5 0M3.5 12.5l4.5 1M3.5 19l4.5-2M20.5 12.5l-4.5 1M20.5 19l-4.5-2M12 8.5v11"/></g>',
  code: '<path class="brace" d="M8 6l-6 6 6 6M16 6l6 6-6 6"/><path class="slash" d="M14 4.5l-4 15"/>',
};

function contributeBody(lang) {
  const c = CONTRIBUTE[lang];
  const link = (href, label, extra = "") =>
    `<a${extra} href="${escapeAttr(href)}" rel="noopener">${escapeHtml(label)}</a>`;
  const mail = `mailto:${COMMUNITY.email}`;
  // The other way to reach out goes on a line of its own, so it never wraps beside the button.
  const other = (html) => `<span class="other">${html}</span>`;
  const section = (icon, heading, body, actions) =>
    `        <section class="reveal">
          <h2><svg class="icon icon-${icon}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>${escapeHtml(heading)}</h2>
          <p>${escapeHtml(body)}</p>
          <p class="actions">${actions.filter(Boolean).join("\n            ")}</p>
        </section>`;
  return [
    (COMMUNITY.discussions || COMMUNITY.discord || COMMUNITY.email) &&
      section("like", c.like.heading, c.like.body, [
        COMMUNITY.discord && link(COMMUNITY.discord, c.like.discord, ' class="button"'),
        COMMUNITY.discussions && link(COMMUNITY.discussions, c.like.discussions, ' class="button"'),
        COMMUNITY.email && other(link(mail, `${c.like.email}: ${COMMUNITY.email}`)),
      ]),
    COMMUNITY.weblate &&
      section("translate", c.translate.heading, c.translate.body, [
        link(COMMUNITY.weblate, c.translate.link, ' class="button"'),
        other(link(guidePath(lang, "weblate"), c.translate.guide)),
      ]),
    (COMMUNITY.issues || COMMUNITY.email) &&
      section("report", c.report.heading, c.report.body, [
        COMMUNITY.issues && link(COMMUNITY.issues, c.report.issues, ' class="button"'),
        COMMUNITY.email && other(`${escapeHtml(c.report.email)} ${link(mail, COMMUNITY.email)}`),
      ]),
    COMMUNITY.repo &&
      section("code", c.code.heading, c.code.body, [
        link(COMMUNITY.repo, c.code.link, ' class="button"'),
      ]),
    COMMUNITY.email &&
      `        <section class="reveal">\n          <p class="muted">${escapeHtml(c.privacy)}</p>\n        </section>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function contributePage(lang) {
  const c = CONTRIBUTE[lang];
  return articleDocument(lang, contributePagePath, {
    title: c.title,
    desc: c.desc,
    h1: c.h1,
    intro: c.intro,
    crumb: TEXTS[lang]["nav.contribute"],
    cta: c.cta,
    ogType: "website",
    plain: true,
    body: contributeBody(lang),
    main: (url) => ({
      "@type": "WebPage",
      name: c.h1,
      description: c.desc,
      inLanguage: lang,
      url,
      dateModified: today,
      isPartOf: { "@id": `${ORIGIN}/#website` },
    }),
  });
}

// ---- the technical page on the pack format: docs/PACK_FORMAT.md, in English only ----
const DOCS_PACKS = "/docs/packs/";

function docsPage() {
  const { html, headings, title } = renderMarkdown(readFileSync("docs/PACK_FORMAT.md", "utf8"));
  // The first heading is the title of the page; the contents list the sections and, under each,
  // the parts that are written by hand (the generated reference is listed by its kinds only).
  const sections = headings.filter((h) => h.level === 2);
  const toc = sections
    .map((h) => `            <a href="#${h.id}">${escapeHtml(h.text)}</a>`)
    .join("\n");
  // The first heading repeats the title of the page: leave it out of the body.
  const body = html.replace(/^<h1 [^>]*>[\s\S]*?<\/h1>\n?/, "");
  const intro =
    "Everything a Heroquill pack file can hold and how the app reads it: for people who write packs by hand, and for programs and AIs that turn a book into a pack.";
  return articleDocument("en", () => DOCS_PACKS, {
    title: `${title} – Heroquill`,
    desc: intro,
    h1: title,
    intro,
    crumb: "Pack format",
    cta: "Ready to write your own?",
    ogType: "article",
    single: true,
    toc,
    body,
    main: (url) => ({
      "@type": "TechArticle",
      headline: title,
      description: intro,
      inLanguage: "en",
      mainEntityOfPage: url,
      dateModified: today,
      image: `${ORIGIN}/og-image.png`,
      author: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
      publisher: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
    }),
  });
}

// ---- the pages ----
mkdirSync("dist", { recursive: true });
mkdirSync(`dist${DOCS_PACKS.slice(0, -1)}`, { recursive: true });
writeFileSync(`dist${DOCS_PACKS}index.html`, docsPage());
// The same page as plain Markdown, for whoever reads it with a program or gives it to an AI.
cpSync("docs/PACK_FORMAT.md", `dist${DOCS_PACKS}PACK_FORMAT.md`);
for (const lang of LANGUAGES) {
  const directory = lang === "en" ? "dist" : `dist/${lang}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/index.html`, homePage(lang));
  const guideDirectory = `dist${guidePath(lang).slice(0, -1)}`;
  mkdirSync(guideDirectory, { recursive: true });
  writeFileSync(`${guideDirectory}/index.html`, guidePage(lang));
  for (const topic of GUIDE_TOPICS) {
    const topicDirectory = `dist${guidePath(lang, topic).slice(0, -1)}`;
    mkdirSync(topicDirectory, { recursive: true });
    writeFileSync(`${topicDirectory}/index.html`, guidePage(lang, topic));
  }
  const newsDirectory = `dist${newsPagePath(lang).slice(0, -1)}`;
  mkdirSync(newsDirectory, { recursive: true });
  writeFileSync(`${newsDirectory}/index.html`, newsPage(lang));
  const contributeDirectory = `dist${contributePagePath(lang).slice(0, -1)}`;
  mkdirSync(contributeDirectory, { recursive: true });
  writeFileSync(`${contributeDirectory}/index.html`, contributePage(lang));
}

// What the app reads, to tell what changes before it updates: the latest versions.
writeFileSync("dist/changelog.json", JSON.stringify({ entries: CHANGELOG.slice(0, 12) }));

// ---- what the pages share, and the files that are copied as they are ----
for (const file of [
  "site.css",
  "site.js",
  "privacy.html",
  "terms.html",
  "icon.svg",
  "apple-touch-icon.png",
  "og-image.png",
  "_headers",
]) {
  cpSync(`site/${file}`, `dist/${file}`);
}
cpSync("src/ui/theme/palettes.css", "dist/palettes.css");

mkdirSync("dist/fonts", { recursive: true });
const fonts = [
  ["node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2", "cinzel-600.woff2"],
  ["node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2", "cinzel-700.woff2"],
  [
    "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2",
    "eb-garamond-400.woff2",
  ],
  [
    "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
    "eb-garamond-600.woff2",
  ],
];
for (const [from, name] of fonts) cpSync(from, `dist/fonts/${name}`);

// ---- for search engines ----
const entryOf = (pathOf, lang) => {
  const links = [
    ...LANGUAGES.map(
      (l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathOf(l)}"/>`,
    ),
    `      <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathOf("en")}"/>`,
  ].join("\n");
  return `  <url>\n    <loc>${ORIGIN}${pathOf(lang)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`;
};
const entries = [
  ...LANGUAGES.map((lang) => entryOf(homePath, lang)),
  ...LANGUAGES.map((lang) => entryOf(guidePath, lang)),
  ...GUIDE_TOPICS.flatMap((topic) =>
    LANGUAGES.map((lang) => entryOf((l) => guidePath(l, topic), lang)),
  ),
  ...LANGUAGES.map((lang) => entryOf(newsPagePath, lang)),
  ...LANGUAGES.map((lang) => entryOf(contributePagePath, lang)),
  `  <url>\n    <loc>${ORIGIN}${DOCS_PACKS}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
].join("\n");
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`,
);
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
