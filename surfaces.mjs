/**
 * The six machine-readable surfaces, generated in dependency order.
 *
 *   layer 2  page JSON-LD          (build.mjs — already emitted)
 *   layer 1  sitemap.xml + .html
 *   layer 3  entitymap.json + .html
 *   layer 4  llms.txt
 *   layer 0  robots.txt
 *
 * robots.txt is authored last because it references the other four; it is the
 * layer that grants access to a graph that has to exist first.
 *
 *   node surfaces.mjs        (run after build.mjs)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLinkset, validateLinkset } from "./linkset.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..").replace(/\.\.$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const ORIGIN = "https://bergencountydrugrehabs.com";
const REVIEWED_ISO = "2026-08-19";

const centers = JSON.parse(readFileSync(join(HERE, "data/centers.json"), "utf8"));
const scores = JSON.parse(readFileSync(join(HERE, "data/scores.json"), "utf8"));
const bergen = JSON.parse(readFileSync(join(HERE, "data/bergen.json"), "utf8"));
const verification = JSON.parse(readFileSync(join(HERE, "data/verification.json"), "utf8"));

const bySlug = Object.fromEntries(scores.map((s) => [s.slug, s]));
const ranked = [...centers].sort((a, b) => bySlug[b.slug].composite - bySlug[a.slug].composite);
const PIVOT = ranked.find((c) => c.pick);
const nm = (c) => c.name.replace(/&mdash;/g, "—");

/* ------------------------------------------------------------ route set */
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
}
const routeOf = (f) => {
  const r = relative(DIST, f).split(sep).slice(0, -1).join("/");
  return r ? `/${r}/` : "/";
};
const pages = walkHtml(DIST).map(routeOf).sort();

/**
 * lastmod from the commit time of the inputs that produce the page — never
 * build time. An identical timestamp on every URL is the generator tell that
 * teaches a crawler to discount the whole file.
 */
const gitTime = (paths) => {
  for (const p of paths) {
    try {
      const t = execSync(`git log -1 --format=%cI -- "${p}"`, { cwd: HERE, encoding: "utf8" }).trim();
      if (t) return t;
    } catch {}
  }
  return `${REVIEWED_ISO}T00:00:00+00:00`;
};

const inputsFor = (route) => {
  const slug = route.replace(/^\/|\/$/g, "");
  const base = ["data/centers.json", "data/scores.json"];
  if (!slug) return ["templates/index.html", ...base];
  if (slug.includes("-vs-") || slug.startsWith("is-") || slug.endsWith("-alternatives")) return base;
  if (slug === "how-we-review" || slug === "compare") return ["score.mjs", ...base];
  if (slug === "editorial-policy" || slug === "privacy") return ["build.mjs"];
  return [`data/centers.json`, ...base];
};

/* -------------------------------------------------- layer 1: sitemap.xml */
const priority = (r) =>
  r === "/" ? "1.0" : centers.some((c) => r === `/${c.slug}/`) ? "0.9" : r === "/compare/" ? "0.8" : "0.6";

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (r) => `  <url>
    <loc>${ORIGIN}${r}</loc>
    <lastmod>${gitTime(inputsFor(r))}</lastmod>
    <priority>${priority(r)}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

/* ------------------------------------------------- layer 1: sitemap.html */
const group = (label, routes) =>
  routes.length
    ? `<h2>${label}</h2>\n<ul class="sitemap-list">\n${routes
        .map((r) => `  <li><a href="..${r}">${r}</a></li>`)
        .join("\n")}\n</ul>`
    : "";

const core = pages.filter((r) => r === "/" || centers.some((c) => r === `/${c.slug}/`));
const comparison = pages.filter((r) => r.includes("-vs-") || r.startsWith("/is-") || r.endsWith("-alternatives/"));
const spine = pages.filter((r) => ["/compare/", "/how-we-review/", "/editorial-policy/", "/privacy/"].includes(r));

/* ------------------------------------------------ layer 3: entitymap.json */
const chunk = (id, entity, type, text, sourceUrl) => ({
  id,
  entity,
  contentType: type,
  text,
  publisher: "Bergen County Recovers",
  sourceUrl,
});

const entitymap = {
  version: "1.0",
  schema: "https://entitymap.org/spec/v1.0",
  generated: REVIEWED_ISO,
  publisher: { name: "Bergen County Recovers", url: `${ORIGIN}/` },
  verificationStatus: "self-declared",
  entities: [
    {
      id: "bergen-county",
      type: "Place",
      name: "Bergen County",
      url: `${ORIGIN}/`,
      description:
        "A county in northern New Jersey with 70 municipalities, and the service area of this guide.",
    },
    ...ranked.map((c) => ({
      id: c.slug,
      type: "Organization",
      name: nm(c),
      url: `${ORIGIN}/${c.slug}/`,
      description: String(c.summary).replace(/<[^>]+>/g, ""),
    })),
    {
      id: "editorial-method",
      type: "Methodology",
      name: "Four-dimension editorial score",
      url: `${ORIGIN}/how-we-review/`,
      description:
        "Clinical clarity, medical support, program depth and continuing care, weighted equally, applied to publicly available information.",
    },
  ],
  relations: [
    ...ranked.map((c) => ({
      from: c.slug,
      // Woodland Park is in Passaic County. A false PART_OF here would be the
      // one place the graph contradicts the county column on the page.
      type: c.county === "Bergen County" ? "PART_OF" : "AFFILIATED_WITH",
      to: "bergen-county",
      note: c.county === "Bergen County" ? undefined : `Located in ${c.county}, adjacent to Bergen County.`,
    })),
    ...ranked.map((c) => ({ from: c.slug, type: "EVALUATED_BY", to: "editorial-method" })),
  ],
  chunks: [
    chunk(
      "c_scope_01",
      "bergen-county",
      "fact",
      `This guide compares ${centers.length} addiction and mental health treatment centers serving Bergen County, New Jersey. Five are located in Bergen County; BlueCrest Recovery Center is in Woodland Park, Passaic County.`,
      `${ORIGIN}/`
    ),
    chunk(
      "c_method_01",
      "editorial-method",
      "fact",
      "Scores measure the clarity and breadth of publicly available information, not treatment outcomes or patient satisfaction. Credential claims are scored by verification tier: verified against the correct issuing body for the jurisdiction, claimed but unconfirmed, or claimed and not checking out.",
      `${ORIGIN}/how-we-review/`
    ),
    chunk(
      "c_neg_01",
      "editorial-method",
      "negation",
      "These scores are not measures of treatment outcomes, clinical quality or patient satisfaction, and they are not patient reviews. No review text is used anywhere in the scoring.",
      `${ORIGIN}/editorial-policy/`
    ),
    chunk(
      "c_neg_02",
      "editorial-method",
      "negation",
      "This guide makes no claim to be independent of the centers it covers, and does not describe its rankings as unpaid or independently commissioned.",
      `${ORIGIN}/editorial-policy/`
    ),
    chunk(
      "c_neg_03",
      "bergen-county",
      "negation",
      `Of the ${centers.length} centers in this guide, only ChoicePoint states that it accepts Medicaid. In calendar year 2024, ${bergen.residents2024.insurance.medicaid[0].toLocaleString()} of ${bergen.residents2024.totalAdmissions.toLocaleString()} Bergen County treatment admissions reported Medicaid coverage.`,
      `${ORIGIN}/compare/`
    ),
    // What a center does NOT publish, stated as a disclosure gap rather than as
    // commentary on that center. The absence of a licence number is a checkable
    // fact; anything beyond that is an inference we are not in a position to make.
    ...ranked
      .filter((c) => !verification[c.slug]?.tiers?.stateLicense || verification[c.slug].tiers.stateLicense !== "A")
      .map((c, i) =>
        chunk(
          `c_disc_0${i + 1}`,
          c.slug,
          "negation",
          `${nm(c)} does not publish a New Jersey licence number that a reader can check against the state register. This is a statement about what is published, not about the facility's licensure, which this guide has not determined.`,
          `${ORIGIN}/${c.slug}/`
        )
      ),
  ],
};

/* ----------------------------------------------------- layer 4: llms.txt */
const pct = (a) => `${a[1]}%`;
const llms = `# Bergen County Recovers

> A comparison guide to ${centers.length} addiction and mental health treatment centers serving Bergen County, New Jersey, assessed against information each center publishes about itself.

Bergen County Recovers compares treatment centers on four equally weighted dimensions: clinical clarity, medical support, program depth and continuing care. Scores measure the clarity and breadth of publicly available information, not treatment outcomes or patient satisfaction. Credential claims carry a verification tier, and a claim that names the wrong regulator for the jurisdiction scores zero rather than face value.

Five of the six centers are located in Bergen County. BlueCrest Recovery Center is in Woodland Park, Passaic County, and is included because Bergen County residents use it: in calendar year 2024, ${bergen.residents2024.topReceivingCountiesOutsideBergen[0][1]} Bergen residents were treated in Passaic County.

This guide makes no claim to be independent of the centers it covers. The scoring method, the point values and the underlying evidence are published in full so a reader can check the reasoning rather than trust the ranking.

Publisher: Bergen County Recovers
Last updated: ${REVIEWED_ISO}

## Centers

${ranked.map((c) => `- [${nm(c)}](${ORIGIN}/${c.slug}/): ${c.city}, ${c.county}. Editorial score ${bySlug[c.slug].outOfFive.toFixed(1)} of 5.`).join("\n")}

## Method and policy

- [How we review](${ORIGIN}/how-we-review/): the four dimensions and what the scores deliberately do not measure.
- [Editorial policy](${ORIGIN}/editorial-policy/): what this guide claims, what it does not, and how corrections are made.
- [All six side by side](${ORIGIN}/compare/): every center on the same rows.
- [Privacy](${ORIGIN}/privacy/): what this site collects, which is nothing.

## Structured data

- [EntityMap](${ORIGIN}/entitymap.json): the machine-readable entity graph for this guide.
- [EntityMap, readable](${ORIGIN}/entitymap.html): the same graph as a web page.
- [Sitemap](${ORIGIN}/sitemap.xml): every published URL.
- [Linkset](${ORIGIN}/linkset.json): RFC 9264 typed relationships — canonical citation targets, authorship, and the sources each page draws from.

## Optional

- [Bergen County evidence base](${ORIGIN}/compare/): NJ DMHAS Substance Use Overview 2024 and Bergen County Prosecutor's Office overdose data, 2017 to 2025.
`;

/* ----------------------------------------------------- layer 0: robots.txt */
const SHARED_DISALLOW = ["/assets/featured/", "/*?"];
const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User",
  "PerplexityBot", "Google-Extended", "Applebot-Extended",
];

// Every named group repeats the shared rules. A named user-agent group inherits
// NOTHING from *, so an omitted disallow here silently grants access.
const robots = `# Bergen County Recovers
# ${ORIGIN}/

User-agent: *
${SHARED_DISALLOW.map((d) => `Disallow: ${d}`).join("\n")}
Allow: /

${AI_AGENTS.map(
  (a) => `User-agent: ${a}
${SHARED_DISALLOW.map((d) => `Disallow: ${d}`).join("\n")}
Allow: /`
).join("\n\n")}

Sitemap: ${ORIGIN}/sitemap.xml
`;

/* ------------------------------------------------------------------ write */
const sitemapHtmlBody = `${group("Centers", core)}
${group("Comparisons", comparison)}
${group("Method and policy", spine)}`;

writeFileSync(join(DIST, "sitemap.xml"), sitemapXml);
writeFileSync(join(DIST, "robots.txt"), robots);
writeFileSync(join(DIST, "llms.txt"), llms);
writeFileSync(join(DIST, "entitymap.json"), JSON.stringify(entitymap, null, 2));

/* ------------------------------------------------- RFC 9264 linkset */
const articlesDir = join(HERE, "data", "articles");
const articleList = existsSync(articlesDir)
  ? readdirSync(articlesDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => JSON.parse(readFileSync(join(articlesDir, f), "utf8")))
  : [];
const linkset = buildLinkset({ pages, centers: ranked, articles: articleList, reviewed: REVIEWED_ISO });
const lsErrors = validateLinkset(linkset);
if (lsErrors.length) {
  console.error("linkset failed validation:");
  for (const e of lsErrors) console.error(`  ${e}`);
  process.exit(1);
}
writeFileSync(join(DIST, "linkset.json"), JSON.stringify(linkset, null, 2));

/* ------------------------------- HTML companions for the two machine files */
const shell = (title, desc, canonical, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${ORIGIN}/${canonical}">
<link rel="linkset" type="application/linkset+json" href="${ORIGIN}/linkset.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Karla:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"WebPage","@id":`${ORIGIN}/${canonical}#page`,name:title,description:desc,isPartOf:{"@id":`${ORIGIN}/#org`},dateModified:REVIEWED_ISO}]})}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="bar">
  <a class="logo" href="../"><span class="mark">BC</span> Recovers<span class="thin">Bergen County, NJ</span></a>
  <nav class="nav"><a href="../#list">Compare centers</a><a href="../bergen-county-evidence/">Bergen County data</a><a href="../#faq">Care compass</a><a href="../how-we-review/">How we review</a></nav>
</div></header>
<main id="main">
<nav class="crumbs"><a href="../">Guide</a> <span>/</span> <b>${title}</b></nav>
<section class="center-hero"><div class="wrap"><p class="pick-flag muted">Machine-readable</p><h1>${title}</h1><p class="lede-dark">${desc}</p></div></section>
<section class="band"><div class="wrap narrow">
${body}
</div></section>
</main>
<footer class="site-foot"><div class="wrap">
  <p class="foot-brand"><span class="mark">BC</span> Guidance for choosing treatment in Bergen County and northern New Jersey.</p>
  <p class="foot-legal">&copy; 2026 Bergen County Recovers &middot; Information, not medical advice.</p>
</div></footer>
</body>
</html>
`;

mkdirSync(join(DIST, "sitemap"), { recursive: true });
writeFileSync(join(DIST, "sitemap", "index.html"), shell(
  "Sitemap",
  `Every page published by Bergen County Recovers, grouped by section.`,
  "sitemap/",
  sitemapHtmlBody));

mkdirSync(join(DIST, "entitymap"), { recursive: true });
const emRows = entitymap.entities.map((e) =>
  `<tr><th>${e.name}</th><td>${e.type}</td><td><a href="${e.url}">${e.url.replace(ORIGIN, "") || "/"}</a></td><td>${e.description}</td></tr>`).join("\n");
const negRows = entitymap.chunks.filter((c) => c.contentType === "negation")
  .map((c) => `<li><b>${c.entity}</b> &mdash; ${c.text}</li>`).join("\n");
writeFileSync(join(DIST, "entitymap", "index.html"), shell(
  "EntityMap",
  "The machine-readable entity graph behind this guide, as a readable page.",
  "entitymap/",
  `<p>This is the human-readable companion to <a href="../entitymap.json">entitymap.json</a>, the structured graph AI assistants read. Both are generated from the same source, so they cannot disagree.</p>
   <h2 class="section-title">Entities</h2>
   <div class="scroller"><table class="vs-table"><thead><tr><th></th><th>Type</th><th>URL</th><th>Description</th></tr></thead><tbody>${emRows}</tbody></table></div>
   <h2 class="section-title">Stated negations</h2>
   <p class="section-lede">What this guide explicitly does <em>not</em> claim. Silence gets filled by whatever an assistant infers, so the absence of a claim is not the same as a negation.</p>
   <ul class="plain">${negRows}</ul>
   <p class="fineprint">Generated ${REVIEWED_ISO}. verificationStatus: self-declared.</p>`));

console.log(`  + /sitemap/ and /entitymap/ HTML companions`);

export { sitemapHtmlBody, entitymap, pages };

console.log(`surfaces — linkset.json (${linkset.linkset.length} contexts), sitemap.xml (${pages.length + 1} urls), robots.txt (${AI_AGENTS.length + 1} groups), llms.txt (${(llms.length / 1024).toFixed(1)} KB), entitymap.json (${entitymap.entities.length} entities, ${entitymap.chunks.length} chunks)`);
