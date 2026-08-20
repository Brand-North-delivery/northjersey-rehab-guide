/**
 * Static generator for the Bergen County rehab comparison guide.
 *
 * Entity list  : data/centers.json  (6 centers)
 * Pivot        : Valley Spring Recovery Center
 * Templates    : review, alternatives, is-it-worth-it, pivot-vs-X, X-vs-pivot-cost,
 *                cross-comparisons, plus two spine pages.
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./schema.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(ROOT, "data/centers.json"), "utf8"));
const payers = JSON.parse(readFileSync(join(ROOT, "data/payers.json"), "utf8"));
const verification = JSON.parse(readFileSync(join(ROOT, "data/verification.json"), "utf8"));
const scores = JSON.parse(readFileSync(join(ROOT, "data/scores.json"), "utf8"));
const compass = JSON.parse(readFileSync(join(ROOT, "data/compass.json"), "utf8"));

/* Rank and score come from the algorithm, not from the editorial file. If the
   two ever disagree, the algorithm wins and the methodology page stays true. */
const bySlug = Object.fromEntries(scores.map((s) => [s.slug, s]));
const centers = [...raw]
  .sort((a, b) => bySlug[b.slug].composite - bySlug[a.slug].composite)
  .map((c) => ({
    ...c,
    rank: bySlug[c.slug].rank,
    score: bySlug[c.slug].outOfFive.toFixed(1),
    evidence: bySlug[c.slug],
    verify: verification[c.slug] || { tiers: {}, flags: [], note: "" },
  }));

const REVIEWED = "August 2026";
const REVIEWED_ISO = "2026-08-19";
const PIVOT = centers.find((c) => c.pick);

/* A flagged verification claim, rendered wherever the center appears. */
const flagBlock = (c, heading = true) =>
  !c.verify.flags?.length
    ? ""
    : `<div class="claim-flag">
      ${heading ? `<p class="claim-flag-head">Verification note</p>` : ""}
      <p class="claim-flag-list">${c.verify.flags.join(" &middot; ")}</p>
      <p>${c.verify.note}</p>
    </div>`;

const thumb = (c, up = "") => {
  const initials = plain(c.name).replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
  return `<div class="thumb"><img src="${up}assets/centers/${c.slug}.jpg" alt="Homepage of ${plain(c.name)}, captured ${REVIEWED}" loading="lazy" width="1000" height="625" onerror="this.parentNode.classList.add('is-fallback');this.remove()"><span class="thumb-fallback" aria-hidden="true">${initials}</span></div>`;
};
const RIVALS = centers.filter((c) => !c.pick);
const DIMS = ["Clinical clarity", "Medical support", "Program depth", "Continuing care"];

const plain = (s) => s.replace(/&mdash;/g, "—").replace(/&rsquo;/g, "’");
const shortName = (c) => plain(c.name).split(" — ")[0];
const pages = [];

/* ---------------------------------------------------------------- chrome */

const featuredMap = JSON.parse(readFileSync(join(ROOT, "assets/featured/manifest.json"), "utf8"));
const SITE = "https://bergencountydrugrehabs.com/";

/* SOP 9 — <picture>/<source> for the mobile breakpoint.
   SOP: alt = the text on the image, title = the same. */
const featured = (slug, up = "") => {
  const f = featuredMap[slug];
  if (!f) return "";
  return `<figure class="featured">
      <picture>
        <source media="(max-width: 820px)" srcset="${up}${f.mobile}" width="820" height="560">
        <img src="${up}${f.desktop}" alt="${f.alt}" title="${f.title}" width="1640" height="840" fetchpriority="high" decoding="async">
      </picture>
    </figure>`;
};

/* SOP 10 — the same asset serves the OG and Twitter card, full width. */
const ogTags = (slug, title, desc) => {
  const f = featuredMap[slug];
  const img = f ? SITE + f.desktop : "";
  return `<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">${f ? `
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1640">
<meta property="og:image:height" content="840">
<meta property="og:image:alt" content="${f.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">` : ""}`;
};

const head = (title, desc, up, slug = "", canonicalPath = "", jsonLd = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}${canonicalPath}">
${ogTags(slug, title, desc)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Karla:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}styles.css">
${jsonLd}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="bar">
    <a class="logo" href="${up}"><span class="mark">BC</span> Recovers<span class="thin">Bergen County, NJ</span></a>
    <nav class="nav">
      <a href="${up}#list">Compare</a>
      <a href="${up}compare/">All six side by side</a>
      <a href="${up}how-we-review/">How we review</a>
      <a href="${up}#faq">Plain answers</a>
    </nav>
    <button class="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="crisis" role="note">
  <strong>In immediate danger?</strong> Withdrawal from alcohol and benzodiazepines can be life-threatening. Call <a href="tel:911">911</a>, or call or text <a href="tel:988">988</a>. Bergen County runs a 24/7 addiction line on <a href="tel:2015892976">(201) 589-2976</a>.
</div>`;

const foot = (up) => `
<footer class="site-foot">
  <div class="wrap">
    <p class="foot-brand"><span class="mark">BC</span> Guidance for choosing treatment in Bergen County and northern New Jersey.</p>
    <p class="foot-note">Editorial scores updated ${REVIEWED} from provider-published information. This page is general information and is not medical or legal advice. If you are in crisis, call or text 988, or call 911.</p>
    <div class="foot-cols">
      <div>
        <h3>Explore</h3>
        <a href="${up}#list">Compare centers</a>
        <a href="${up}compare/">Side by side</a>
        <a href="${up}#shortlist-tool">Where to start</a>
        <a href="${up}#faq">Care compass</a>
      </div>
      <div>
        <h3>Important</h3>
        <a href="${up}how-we-review/">Our review approach</a>
        <a href="${up}editorial-policy/">Editorial policy</a>
        <a href="${up}privacy/">Privacy</a>
        <a href="${up}sitemap/">Sitemap</a>
        <a href="${up}entitymap/">EntityMap</a>
      </div>
    </div>
    <p class="foot-legal">&copy; 2026 Bergen County Recovers &middot; Information, not medical advice.</p>
  </div>
</footer>
<script src="${up}script.js"></script>
</body>
</html>
`;

const crumbs = (up, trail) =>
  `<nav class="crumbs"><a href="${up}">Guide</a>` +
  trail.map((t) => ` <span>/</span> ` + (t.href ? `<a href="${t.href}">${t.label}</a>` : `<b>${t.label}</b>`)).join("") +
  `</nav>`;

const fineprint = `<p class="fineprint">*Provider-reported information, current as of ${REVIEWED}; confirm before admission. Inclusion does not imply endorsement. Details can change.</p>`;

const DIST = join(ROOT, "dist");

const emit = (slug, html) => {
  const dir = join(DIST, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
  pages.push(slug);
};

/* ------------------------------------------------------------ hub cards */

const card = (c) => `
      <li class="center${c.pick ? " is-pick" : ""}" data-tags="${c.tags.join(" ")}">
        <div class="rank"><span>${c.rank}</span></div>
        <div class="center-body">
          <div class="center-top">
            <div>
              ${c.pick ? `<p class="pick-flag">Editor&rsquo;s pick</p>` : ""}
              <h3><a href="${c.slug}/">${c.name}</a></h3>
              <p class="place">${c.city} &middot; ${c.county}</p>
            </div>
            <div class="score" aria-label="Editorial score ${c.score} out of 5"><b>${c.score}</b><span>/5</span></div>
          </div>
          ${thumb(c)}
          <p class="summary">${c.summary}</p>
          <dl class="spec">
${Object.entries(c.spec).map(([k, v]) => `            <div><dt>${k}</dt><dd>${v}<sup class="src" title="Provider-reported">*</sup></dd></div>`).join("\n")}
          </dl>
          ${flagBlock(c)}
          <p class="verdict"><b class="verdict-label">${c.pick ? "Why we favor it" : "Our take"}</b>${c.verdict}</p>
          <div class="center-cta">
            <a class="btn btn-primary btn-sm" href="${c.slug}/">Read the full review</a>
            ${c.pick ? "" : `<a class="btn btn-ghost btn-sm" href="${PIVOT.slug}-vs-${c.slug}/">Compare with ${shortName(PIVOT)}</a>`}
            <a class="btn btn-ghost btn-sm" href="${c.site}" target="_blank" rel="noopener">Visit center</a>
          </div>
        </div>
      </li>`;


/* Cross-comparisons this center appears in. Without this the generated
   head-to-heads between two non-pivot centers are orphans: built, deployed,
   and unreachable from anywhere on the site. */
const CROSS = [
  ["north-jersey-recovery-center", "choicepoint"],
  ["bluecrest-recovery-center", "boca-recovery-center-englewood"],
  ["choicepoint", "ikon-recovery-centers"],
  ["ikon-recovery-centers", "bluecrest-recovery-center"],
];

const crossLinksFor = (c) => {
  const mine = CROSS.filter(([x, y]) => x === c.slug || y === c.slug);
  if (!mine.length) return "";
  const items = mine.map(([x, y]) => {
    const a = centers.find((z) => z.slug === x);
    const b = centers.find((z) => z.slug === y);
    return `<a href="../${x}-vs-${y}/">${shortName(a)} vs ${shortName(b)}</a>`;
  });
  return `<p class="back">Also compared directly: ${items.join(" &middot; ")}</p>`;
};

/* --------------------------------------------------------- 1. review page */

const reviewPage = (c) => {
  const p = payers[c.slug];
  const others = centers.filter((o) => o.slug !== c.slug);
  return `${head(
    `${shortName(c)} Review — ${c.city} | Bergen County Recovers`,
    `An editorial review of ${plain(c.name)} in ${c.city}: levels of care, licensing, accreditation, insurance, who it fits, and what to ask before you call.`,
    "../",
    c.slug,
    `${c.slug}/`,
    S.render([
      S.localBusinessNode(c),
      S.reviewNode(c, REVIEWED_ISO),
      S.breadcrumbNode([
        { name: "Guide", path: "" },
        { name: "The shortlist", path: "#list" },
        { name: plain(c.name) },
      ]),
      S.webPageNode(`${c.slug}/`, `${shortName(c)} Review`, plain(c.summary).slice(0, 200), REVIEWED_ISO),
    ])
  )}
<main id="main">
${crumbs("../", [{ label: "The shortlist", href: "../#list" }, { label: c.name }])}

<section class="center-hero${c.pick ? " is-pick" : ""}">
  <div class="wrap">
    <p class="pick-flag${c.pick ? "" : " muted"}">${c.pick ? `Editor&rsquo;s pick &middot; ranked ${c.rank} of ${centers.length}` : `Ranked ${c.rank} of ${centers.length}`}</p>
    <div class="center-hero-top">
      <div><h1>${c.name}</h1><p class="place">${c.city} &middot; ${c.county}</p></div>
      <div class="score big" aria-label="Editorial score ${c.score} out of 5"><b>${c.score}</b><span>/5</span></div>
    </div>
    <p class="lede-dark">${c.summary}</p>
    <p class="geo-context">${c.city.replace(", NJ", "")} sits in ${c.county}${c.county === "Bergen County" ? "" : ", just outside Bergen"}, in northern New Jersey.</p>
    <div class="hero-cta">
      ${c.pick ? "" : `<a class="btn btn-primary" href="../${PIVOT.slug}-vs-${c.slug}/">Compare with ${shortName(PIVOT)}</a>`}
      <a class="btn btn-ghost" href="${c.site}" target="_blank" rel="noopener">Visit ${shortName(c)} &rarr;</a>
    </div>
  </div>
</section>

<figure class="shot-hero">
  ${thumb(c, "../")}
  <figcaption>${shortName(c)}&rsquo;s own website, captured ${REVIEWED}. The branded card image is used only for link previews.</figcaption>
</figure>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">At a glance</h2>
    <dl class="spec standalone">
${Object.entries(c.spec).map(([k, v]) => `      <div><dt>${k}</dt><dd>${v}<sup class="src" title="Provider-reported">*</sup></dd></div>`).join("\n")}
    </dl>
    <p class="verdict big"><b class="verdict-label">${c.pick ? "Why we favor it" : "Our take"}</b>${c.verdict}</p>
    ${fineprint}
  </div>
</section>
${
  !c.verify.flags?.length
    ? ""
    : `
<section class="band flagged">
  <div class="wrap narrow">
    <h2 class="section-title">A claim that does not check out</h2>
    <p class="section-lede">${shortName(c)} publishes this on its own website:</p>
    <blockquote class="claim-quote">${
      c.slug === "ikon-recovery-centers"
        ? "Licensed by the State Department of Healthcare Services, License 2000964. Expiration 11/30/2026"
        : c.verify.flags.join(". ")
    }</blockquote>
    <p>${c.verify.note}</p>
    <div class="claim-flag">
      <p class="claim-flag-head">What this does and does not mean</p>
      <p>We could <b>not</b> establish that ${shortName(c)} is unlicensed, and nothing here should be read that way. A facility can hold a perfectly valid New Jersey license and still publish a wrong sentence about it &mdash; treatment websites are routinely built from recycled templates, and a licensing line copied from an out-of-state original is the most likely explanation.</p>
      <p>What we can say is narrower and still matters: <b>the sentence gives a reader nothing they can check.</b> A licensing claim exists so that a family can verify it at 11pm before making a phone call. One that names a regulator in the wrong state cannot be verified by anyone, which is why our algorithm scores it at zero rather than at face value.</p>
    </div>
    <h3 class="sub">What to do about it</h3>
    <ol class="ask-list">
      <li>Ask ${shortName(c)} directly for its New Jersey DMHAS license number and the name on the license.</li>
      <li>Check that number against the New Jersey Substance Abuse Monitoring System treatment directory.</li>
      <li>Ask which entity holds the license, and whether it is the same entity operating the ${c.city} address.</li>
    </ol>
    <p class="fineprint">Quoted from the center&rsquo;s own website in ${REVIEWED}. New Jersey licenses substance use disorder treatment through the Division of Mental Health and Addiction Services in the Department of Human Services, and through the Department of Health; it has no Department of Health Care Services. If this has since been corrected, we will update it &mdash; the claim, not the center, is what is being assessed.</p>
  </div>
</section>`
}

<section class="band alt">
  <div class="wrap narrow">
    <h2 class="section-title">How it scores</h2>
    <p class="section-lede">Four dimensions, weighted equally. These measure the clarity and breadth of publicly available information&mdash;not treatment outcomes or patient satisfaction. <a href="../how-we-review/">How we review &rarr;</a></p>
    <div class="score-rows">
${DIMS.map((d) => {
  const [val, note] = c.scores[d];
  return `      <div class="score-row">
        <div class="score-row-head"><h3>${d}</h3><b>${val}</b></div>
        <div class="meter"><i style="width:${(parseFloat(val) / 5) * 100}%"></i></div>
        <p>${note}</p>
      </div>`;
}).join("\n")}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <div class="fit-grid">
      <div class="fit yes"><h2>Who it fits</h2><ul>
${c.fits.map((f) => `        <li>${f}</li>`).join("\n")}
      </ul></div>
      <div class="fit no"><h2>Who it does not</h2><ul>
${c.notFits.map((f) => `        <li>${f}</li>`).join("\n")}
      </ul></div>
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap narrow">
    <h2 class="section-title">Paying for it</h2>
    <dl class="spec standalone">
      <div><dt>Commercial insurance</dt><dd>${p.network}</dd></div>
      <div><dt>Medicaid / Medicare</dt><dd>${p.public}</dd></div>
      <div><dt>Self-pay</dt><dd>${p.selfPay}</dd></div>
    </dl>
    <p>${p.note}</p>
    ${c.pick ? "" : `<p class="back"><a href="../${c.slug}-vs-${PIVOT.slug}-cost/">Cost and coverage compared with ${shortName(PIVOT)} &rarr;</a></p>`}
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">What to ask them</h2>
    <p class="section-lede">Specific questions for this center, based on what its own materials leave open.</p>
    <ol class="ask-list">
${c.ask.map((q) => `      <li>${q}</li>`).join("\n")}
    </ol>
  </div>
</section>

<section class="band alt">
  <div class="wrap">
    <h2 class="section-title">Compare with the others</h2>
    <ul class="others">
${others.map((o) => `      <li><a href="../${o.slug}/"><span class="o-rank">${o.rank}</span><span class="o-body"><b>${o.name}</b><i>${o.city}</i></span><span class="o-score">${o.score}</span></a></li>`).join("\n")}
    </ul>
    <p class="back">${c.pick ? "" : `<a href="../${c.slug}-alternatives/">Alternatives to ${shortName(c)}</a> &middot; <a href="../is-${c.slug}-worth-it/">Is ${shortName(c)} worth it?</a> &middot; `}<a href="../compare/">All six side by side</a></p>
    ${crossLinksFor(c)}
  </div>
</section>
</main>
${foot("../")}`;
};

/* --------------------------------------------------- 2. alternatives page */

const alternativesPage = (c) => {
  const others = centers.filter((o) => o.slug !== c.slug);
  return `${head(
    `Alternatives to ${shortName(c)} in Bergen County`,
    `Five alternatives to ${plain(c.name)} in Bergen and Passaic counties, with what each does differently and who it suits.`,
    "../",
    "",
    `${c.slug}-alternatives/`,
    S.render([
      S.collectionNode(`${c.slug}-alternatives/`, `Alternatives to ${shortName(c)}`,
        `Five alternatives to ${plain(c.name)} serving Bergen County.`, centers.filter((o) => o.slug !== c.slug)),
      S.breadcrumbNode([{ name: "Guide", path: "" }, { name: plain(c.name), path: `${c.slug}/` }, { name: "Alternatives" }]),
    ])
  )}
<main id="main">
${crumbs("../", [{ label: c.name, href: `../${c.slug}/` }, { label: "Alternatives" }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Comparison</p>
    <h1>Alternatives to ${shortName(c)}</h1>
    <p class="lede-dark">${shortName(c)} in ${c.city} scores ${c.score} out of 5 in this guide. If it is not the right fit, these five centers in Bergen County cover the same region, and each does something ${shortName(c)} does not.</p>
    <a class="btn btn-ghost" href="../${c.slug}/">Read the ${shortName(c)} review &rarr;</a>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">Why people look elsewhere</h2>
    <p class="section-lede">Taken from ${shortName(c)}&rsquo;s own published materials, these are the situations it is least suited to.</p>
    <div class="fit no standalone-fit"><ul>
${c.notFits.map((f) => `      <li>${f}</li>`).join("\n")}
    </ul></div>
  </div>
</section>

<section class="band alt">
  <div class="wrap">
    <h2 class="section-title">Five alternatives</h2>
    <div class="alt-list">
${others.map((o) => `      <article class="alt-item${o.pick ? " is-pick" : ""}">
        <div class="alt-head">
          <div><h3><a href="../${o.slug}/">${o.name}</a></h3><p class="place">${o.city} &middot; ${o.county}</p></div>
          <div class="score" aria-label="Editorial score ${o.score} out of 5"><b>${o.score}</b><span>/5</span></div>
        </div>
        <p>${o.summary}</p>
        <p class="alt-why"><b>Consider it instead if:</b> ${o.fits[0].charAt(0).toLowerCase() + o.fits[0].slice(1)}.</p>
        <p class="back"><a href="../${o.slug}/">Full review &rarr;</a></p>
      </article>`).join("\n")}
    </div>
    ${fineprint}
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">Still not sure?</h2>
    <p>Compare every center on the same four dimensions rather than switching between marketing pages.</p>
    <p class="back"><a href="../compare/">All six side by side &rarr;</a> &middot; <a href="../is-${c.slug}-worth-it/">Is ${shortName(c)} worth it?</a></p>
  </div>
</section>
</main>
${foot("../")}`;
};

/* ------------------------------------------------- 3. is-it-worth-it page */

const worthItPage = (c) => {
  const best = DIMS.reduce((a, d) => (parseFloat(c.scores[d][0]) > parseFloat(c.scores[a][0]) ? d : a), DIMS[0]);
  const worst = DIMS.reduce((a, d) => (parseFloat(c.scores[d][0]) < parseFloat(c.scores[a][0]) ? d : a), DIMS[0]);
  return `${head(
    `Is ${shortName(c)} Worth It? An Honest Read`,
    `A straight assessment of ${plain(c.name)} in ${c.city}: what it does well, where it is thin, and who should look elsewhere.`,
    "../",
    "",
    `is-${c.slug}-worth-it/`,
    S.render([
      S.webPageNode(`is-${c.slug}-worth-it/`, `Is ${shortName(c)} worth it?`, plain(c.summary).slice(0, 200), REVIEWED_ISO),
      S.breadcrumbNode([{ name: "Guide", path: "" }, { name: plain(c.name), path: `${c.slug}/` }, { name: "Is it worth it?" }]),
    ])
  )}
<main id="main">
${crumbs("../", [{ label: c.name, href: `../${c.slug}/` }, { label: "Is it worth it?" }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Assessment &middot; ranked ${c.rank} of ${centers.length}</p>
    <div class="center-hero-top">
      <div><h1>Is ${shortName(c)} worth it?</h1><p class="place">${c.city} &middot; ${c.county}</p></div>
      <div class="score big" aria-label="Editorial score ${c.score} out of 5"><b>${c.score}</b><span>/5</span></div>
    </div>
    <p class="lede-dark">Short answer: it depends on whether you need what it is strongest at. ${shortName(c)} scores highest on <b>${best.toLowerCase()}</b> and lowest on <b>${worst.toLowerCase()}</b>.</p>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">The strongest thing about it</h2>
    <div class="score-row">
      <div class="score-row-head"><h3>${best}</h3><b>${c.scores[best][0]}</b></div>
      <div class="meter"><i style="width:${(parseFloat(c.scores[best][0]) / 5) * 100}%"></i></div>
      <p>${c.scores[best][1]}</p>
    </div>
    <h2 class="section-title" style="margin-top:2.5rem">The weakest</h2>
    <div class="score-row">
      <div class="score-row-head"><h3>${worst}</h3><b>${c.scores[worst][0]}</b></div>
      <div class="meter"><i style="width:${(parseFloat(c.scores[worst][0]) / 5) * 100}%"></i></div>
      <p>${c.scores[worst][1]}</p>
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap narrow">
    <div class="fit-grid">
      <div class="fit yes"><h2>Worth it for</h2><ul>
${c.fits.map((f) => `        <li>${f}</li>`).join("\n")}
      </ul></div>
      <div class="fit no"><h2>Not worth it for</h2><ul>
${c.notFits.map((f) => `        <li>${f}</li>`).join("\n")}
      </ul></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">Before you decide</h2>
    <p class="section-lede">Ask these four. The answers move this from a ranking to a decision.</p>
    <ol class="ask-list">
${c.ask.map((q) => `      <li>${q}</li>`).join("\n")}
    </ol>
    ${fineprint}
    <p class="back"><a href="../${PIVOT.slug}-vs-${c.slug}/">${shortName(PIVOT)} vs ${shortName(c)} &rarr;</a> &middot; <a href="../${c.slug}-alternatives/">Alternatives</a></p>
  </div>
</section>
</main>
${foot("../")}`;
};

/* ------------------------------------------------- 4. head-to-head page */

const versusPage = (a, b) => {
  const slug = `${a.slug}-vs-${b.slug}`;
  return `${head(
    `${shortName(a)} vs ${shortName(b)} — Compared on Four Dimensions`,
    `${plain(a.name)} and ${plain(b.name)} compared on clinical clarity, medical support, program depth and continuing care, with who each one suits.`,
    "../",
    "",
    `${slug}/`,
    S.render([
      S.webPageNode(`${slug}/`, `${shortName(a)} vs ${shortName(b)}`,
        `${plain(a.name)} and ${plain(b.name)} compared on four dimensions.`, REVIEWED_ISO),
      S.breadcrumbNode([{ name: "Guide", path: "" }, { name: `${shortName(a)} vs ${shortName(b)}` }]),
    ])
  )}
<main id="main">
${crumbs("../", [{ label: "The shortlist", href: "../#list" }, { label: `${shortName(a)} vs ${shortName(b)}` }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Head to head</p>
    <h1>${shortName(a)} <span class="vs">vs</span> ${shortName(b)}</h1>
    <p class="lede-dark">Both serve Bergen County. ${shortName(a)} is in ${a.city}, ${shortName(b)} in ${b.city}. They differ most in what happens when someone needs more than an outpatient schedule.</p>
    <div class="vs-scores">
      <div><b>${a.score}</b><span>${shortName(a)}</span></div>
      <div><b>${b.score}</b><span>${shortName(b)}</span></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2 class="section-title">Side by side</h2>
    <div class="scroller">
      <table class="vs-table">
        <thead><tr><th></th><th>${shortName(a)}</th><th>${shortName(b)}</th></tr></thead>
        <tbody>
          <tr><th>Location</th><td>${a.city}, ${a.county}</td><td>${b.city}, ${b.county}</td></tr>
${Object.keys(a.spec).map((k) => `          <tr><th>${k}</th><td>${a.spec[k]}</td><td>${b.spec[k] || "&mdash;"}</td></tr>`).join("\n")}
          <tr><th>Medicaid / Medicare</th><td>${payers[a.slug].public}</td><td>${payers[b.slug].public}</td></tr>
${DIMS.map((d) => `          <tr><th>${d}</th><td class="n">${a.scores[d][0]}</td><td class="n">${b.scores[d][0]}</td></tr>`).join("\n")}
          <tr class="total"><th>Overall</th><td class="n">${a.score}</td><td class="n">${b.score}</td></tr>
        </tbody>
      </table>
    </div>
    ${fineprint}
  </div>
</section>

<section class="band alt">
  <div class="wrap narrow">
    <h2 class="section-title">Choose one over the other</h2>
    <div class="fit-grid">
      <div class="fit yes"><h2>${shortName(a)} if&hellip;</h2><ul>
${a.fits.slice(0, 3).map((f) => `        <li>${f}</li>`).join("\n")}
      </ul><p class="back"><a href="../${a.slug}/">Full review &rarr;</a></p></div>
      <div class="fit yes"><h2>${shortName(b)} if&hellip;</h2><ul>
${b.fits.slice(0, 3).map((f) => `        <li>${f}</li>`).join("\n")}
      </ul><p class="back"><a href="../${b.slug}/">Full review &rarr;</a></p></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">Where each one is thin</h2>
    <h3 class="sub">${shortName(a)}</h3>
    <p>${a.scores[DIMS.reduce((x, d) => (parseFloat(a.scores[d][0]) < parseFloat(a.scores[x][0]) ? d : x), DIMS[0])][1]}</p>
    <h3 class="sub">${shortName(b)}</h3>
    <p>${b.scores[DIMS.reduce((x, d) => (parseFloat(b.scores[d][0]) < parseFloat(b.scores[x][0]) ? d : x), DIMS[0])][1]}</p>
    <p class="back"><a href="../compare/">All six side by side &rarr;</a></p>
  </div>
</section>
</main>
${foot("../")}`;
};

/* ------------------------------------------------------- 5. cost compare */

const costPage = (c) => {
  const pc = payers[c.slug];
  const pp = payers[PIVOT.slug];
  return `${head(
    `${shortName(c)} vs ${shortName(PIVOT)} — Cost and Insurance`,
    `How ${plain(c.name)} and ${plain(PIVOT.name)} compare on insurance, public coverage and what each publishes about cost.`,
    "../",
    "",
    `${c.slug}-vs-${PIVOT.slug}-cost/`,
    S.render([
      S.webPageNode(`${c.slug}-vs-${PIVOT.slug}-cost/`, `${shortName(c)} vs ${shortName(PIVOT)}: cost and insurance`,
        `How ${plain(c.name)} and ${plain(PIVOT.name)} compare on insurance and coverage.`, REVIEWED_ISO),
      S.breadcrumbNode([{ name: "Guide", path: "" }, { name: plain(c.name), path: `${c.slug}/` }, { name: "Cost" }]),
    ])
  )}
<main id="main">
${crumbs("../", [{ label: c.name, href: `../${c.slug}/` }, { label: `Cost vs ${shortName(PIVOT)}` }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Cost and coverage</p>
    <h1>${shortName(c)} <span class="vs">vs</span> ${shortName(PIVOT)}: what it costs</h1>
    <p class="lede-dark">Neither center publishes a price. That is normal in this market and it is also the single biggest source of unpleasant surprises, so this page compares what each one <em>does</em> disclose about coverage&mdash;and what to make them tell you before intake.</p>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2 class="section-title">What each publishes</h2>
    <div class="scroller">
      <table class="vs-table">
        <thead><tr><th></th><th>${shortName(c)}</th><th>${shortName(PIVOT)}</th></tr></thead>
        <tbody>
          <tr><th>Commercial insurance</th><td>${pc.network}</td><td>${pp.network}</td></tr>
          <tr><th>Medicaid / Medicare</th><td>${pc.public}</td><td>${pp.public}</td></tr>
          <tr><th>Self-pay rate</th><td>${pc.selfPay}</td><td>${pp.selfPay}</td></tr>
          <tr><th>Levels of care billed</th><td>${c.spec["Levels of care"]}</td><td>${PIVOT.spec["Levels of care"]}</td></tr>
        </tbody>
      </table>
    </div>
    ${fineprint}
  </div>
</section>

<section class="band alt">
  <div class="wrap narrow">
    <h2 class="section-title">What it means in practice</h2>
    <h3 class="sub">${shortName(c)}</h3>
    <p>${pc.note}</p>
    <h3 class="sub">${shortName(PIVOT)}</h3>
    <p>${pp.note}</p>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="section-title">Make them answer these</h2>
    <ol class="ask-list">
      <li>Are you in network for my specific plan, or billing as out of network? Get the answer in writing.</li>
      <li>What is the expected out-of-pocket total for the level of care you are recommending?</li>
      <li>How many sessions or days has my plan authorized, and what happens when that runs out?</li>
      <li>If I need to step up or down a level, does the authorization carry over?</li>
      <li>Is there any service in my treatment plan that a different, possibly out-of-network provider delivers?</li>
    </ol>
    <p class="back"><a href="../${PIVOT.slug}-vs-${c.slug}/">Full head-to-head comparison &rarr;</a> &middot; <a href="../compare/">All six side by side</a></p>
  </div>
</section>
</main>
${foot("../")}`;
};

/* ----------------------------------------------------- 6. spine: compare */

const comparePage = () => `${head(
  `All Six Bergen County Rehabs, Side by Side`,
  `Every center in this guide compared on one screen: levels of care, licensing, accreditation, insurance and all four editorial dimensions.`,
  "../",
  "compare",
  "compare/",
  S.render([
    S.collectionNode("compare/", "All six Bergen County centers, side by side",
      "Every center in this guide compared on licensing, levels of care, insurance and four editorial dimensions.", centers),
    S.breadcrumbNode([{ name: "Guide", path: "" }, { name: "Side by side" }]),
  ])
)}
<main id="main">
${crumbs("../", [{ label: "Side by side" }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">The full table</p>
    <h1>All six, side by side</h1>
    <p class="lede-dark">Every center serving Bergen County and the neighbouring North Jersey towns, on the same rows, so the comparison is not a matter of remembering what the last marketing page said.</p>
  </div>
</section>
${featured("compare", "../")}

<section class="band">
  <div class="wrap">
    <div class="scroller">
      <table class="vs-table wide">
        <thead><tr><th></th>${centers.map((c) => `<th><a href="../${c.slug}/">${shortName(c)}</a>${c.pick ? ' <i class="tag-pick">pick</i>' : ""}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th>Town</th>${centers.map((c) => `<td>${c.city}</td>`).join("")}</tr>
          <tr><th>County</th>${centers.map((c) => `<td>${c.county.replace(" County","")}${c.county === "Bergen County" ? "" : " <i class=\"outside\">outside Bergen</i>"}</td>`).join("")}</tr>
${Object.keys(PIVOT.spec).map((k) => `          <tr><th>${k}</th>${centers.map((c) => `<td>${c.spec[k] || "&mdash;"}</td>`).join("")}</tr>`).join("\n")}
          <tr><th>Medicaid / Medicare</th>${centers.map((c) => `<td>${payers[c.slug].public}</td>`).join("")}</tr>
${DIMS.map((d) => `          <tr><th>${d}</th>${centers.map((c) => `<td class="n">${c.scores[d][0]}</td>`).join("")}</tr>`).join("\n")}
          <tr class="total"><th>Overall</th>${centers.map((c) => `<td class="n">${c.score}</td>`).join("")}</tr>
        </tbody>
      </table>
    </div>
    ${fineprint}
    <p class="back"><a href="../how-we-review/">How these scores are produced &rarr;</a></p>
  </div>
</section>
</main>
${foot("../")}`;

/* ------------------------------------------------ 7. spine: methodology */

const methodologyPage = () => `${head(
  `How We Review Treatment Centers`,
  `The scoring method behind this guide: four equally weighted dimensions applied to publicly available information, and what the scores deliberately do not measure.`,
  "../",
  "how-we-review",
  "how-we-review/",
  S.render([
    S.webPageNode("how-we-review/", "How we review Bergen County treatment centers",
      "Four equally weighted dimensions applied to publicly available information.", REVIEWED_ISO),
    S.breadcrumbNode([{ name: "Guide", path: "" }, { name: "How we review" }]),
  ])
)}
<main id="main">
${crumbs("../", [{ label: "How we review" }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Methodology</p>
    <h1>How we review</h1>
    <p class="lede-dark">Every center serving Bergen County and the surrounding northern New Jersey area is assessed on the same four dimensions, weighted equally at 25 percent each, using information the center itself publishes.</p>
  </div>
</section>
${featured("how-we-review", "../")}

<section class="band">
  <div class="wrap narrow">
    <div class="rubric">
      <div class="rub"><h3>Clinical clarity</h3><p>Are the programs, schedules and clinical staffing described specifically enough to know what you are buying?</p></div>
      <div class="rub"><h3>Medical support</h3><p>What medical and psychiatric services are named, and are they delivered on site or by referral?</p></div>
      <div class="rub"><h3>Program depth</h3><p>How many levels of care are offered, and what therapies and specialty tracks are documented?</p></div>
      <div class="rub"><h3>Continuing care</h3><p>What happens after the program ends&mdash;step-down, alumni support, family involvement?</p></div>
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap narrow">
    <h2 class="section-title">What these scores are not</h2>
    <p class="disclosure">Our scores measure the clarity and breadth of publicly available information&mdash;not treatment outcomes or patient satisfaction. They are not patient reviews, clinical outcome ratings or guarantees. A center may deliver excellent care and publish very little about it, and the reverse is also possible. Always confirm current licensing, clinical staff, costs and admission suitability directly with the center.</p>
    <h2 class="section-title" style="margin-top:2.5rem">Why publication quality is worth scoring at all</h2>
    <p>Because it is the only thing a family can check at 11pm before they call anyone. A center that publishes its license number, its schedule and the levels of care it does <em>not</em> offer has made itself checkable. One that publishes adjectives has not. That is not the same as quality of care, and this guide does not claim it is&mdash;but it is a real signal, and it is the signal available to you before admission.</p>
    <h2 class="section-title" style="margin-top:2.5rem">Sources</h2>
    <p>Each center&rsquo;s own website, as published in ${REVIEWED}. Where a center does not publish something&mdash;a license number, an accreditation, a payer list&mdash;the entry says so rather than filling the gap.</p>
    <p class="back"><a href="../compare/">See all six side by side &rarr;</a></p>
  </div>
</section>
</main>
${foot("../")}`;

/* ------------------------------------------------------------- generate */

centers.forEach((c) => emit(c.slug, reviewPage(c)));
RIVALS.forEach((c) => {
  emit(`${c.slug}-alternatives`, alternativesPage(c));
  emit(`is-${c.slug}-worth-it`, worthItPage(c));
  emit(`${PIVOT.slug}-vs-${c.slug}`, versusPage(PIVOT, c));
  emit(`${c.slug}-vs-${PIVOT.slug}-cost`, costPage(c));
});

/* cross-comparisons people actually make: same town, or same capability */
CROSS.forEach(([x, y]) => {
  const a = centers.find((c) => c.slug === x);
  const b = centers.find((c) => c.slug === y);
  emit(`${a.slug}-vs-${b.slug}`, versusPage(a, b));
});

/* ------------------------------------------------ spine: policy pages */

const policyPage = (title, desc, slug, body) => `${head(title, desc, "../", "", `${slug}/`,
  S.render([
    S.webPageNode(`${slug}/`, title, desc, REVIEWED_ISO),
    S.breadcrumbNode([{ name: "Guide", path: "" }, { name: title }]),
  ]))}
<main id="main">
${crumbs("../", [{ label: title }])}

<section class="center-hero">
  <div class="wrap">
    <p class="pick-flag muted">Important</p>
    <h1>${title}</h1>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
${body}
  </div>
</section>
</main>
${foot("../")}`;

emit("editorial-policy", policyPage(
  "Editorial policy",
  "How this guide is written, what it does and does not claim, how errors are corrected, and how a center can request a correction.",
  "editorial-policy",
  `    <h2 class="section-title">What this guide is</h2>
    <p>This is a comparison of six addiction and mental health treatment centers in Bergen County, assessed on the information each one publishes about itself. It is written for people choosing a program, and for the families helping them.</p>

    <h2 class="section-title">What we assess</h2>
    <p>Every center is scored on the same four dimensions, weighted equally, using material published on that center's own website. The full method is on <a href="../how-we-review/">our review approach</a> page, including the point values and the verification tiers.</p>
    <p>The ranking is produced by that method rather than authored. If the evidence changes, the order changes.</p>

    <h2 class="section-title">What we do not claim</h2>
    <ul class="plain">
      <li>These scores are <b>not</b> measures of treatment outcomes, clinical quality or patient satisfaction. A center may deliver excellent care and publish very little about it.</li>
      <li>They are <b>not</b> patient reviews. No review text is used anywhere in the scoring.</li>
      <li>Nothing here is medical or legal advice, and nothing here is a guarantee about any center.</li>
      <li>Inclusion does not imply endorsement, and exclusion does not imply criticism.</li>
    </ul>

    <h2 class="section-title">Facts, and opinion</h2>
    <p>The specification rows on each page are facts reported by the provider, marked with an asterisk. The paragraph labelled <b>Our take</b> or <b>Why we favor it</b> is editorial opinion, and is labelled so you can tell the difference at a glance.</p>

    <h2 class="section-title">Where a claim does not check out</h2>
    <p>Where a center publishes a credential claim that cannot be verified against the body that would have issued it, we say so, quote the claim, and state plainly what we were and were not able to establish. We assess the claim, never the center's actual licensure, which we are not in a position to determine.</p>

    <h2 class="section-title">Corrections</h2>
    <p>If something here is wrong, or has since been corrected on a center's own site, we will update it. Details change and this guide is a snapshot. Every page carries the date its information was current.</p>

    <h2 class="section-title">Independence</h2>
    <p>This guide makes no claim to be independent of the centers it covers, and does not describe its rankings as unpaid or independently commissioned. The method, the point values and the underlying evidence are published in full so that you can check the reasoning yourself rather than take the ranking on trust.</p>

    <p class="fineprint">Last reviewed August 2026.</p>`
));

emit("privacy", policyPage(
  "Privacy",
  "What this site collects, which is nothing, and what that means in practice.",
  "privacy",
  `    <h2 class="section-title">What we collect</h2>
    <p>Nothing. This site has no forms, no sign-ups, no newsletter, no chat widget and no analytics. Nothing you do here is recorded, and nothing is sent anywhere.</p>

    <h2 class="section-title">The care compass and the shortlist tool</h2>
    <p>Both run entirely in your browser. Your selections are never transmitted, never stored, and disappear when you close the tab. That is deliberate: people research treatment at difficult moments, often on shared devices, and this page is designed so that using it leaves nothing behind.</p>

    <h2 class="section-title">Fonts</h2>
    <p>Typefaces are served by Google Fonts, which means Google receives the request for the font file. That is the only third party involved in loading this page.</p>

    <h2 class="section-title">Links to treatment centers</h2>
    <p>Links marked &ldquo;Visit center&rdquo; open that center's own website in a new tab. Once you are there, their privacy practices apply rather than ours, and they may well collect a great deal more than we do.</p>

    <h2 class="section-title">Your privacy elsewhere</h2>
    <p>If you are researching treatment on a device someone else can access, consider a private browsing window. If you are in crisis, calling or texting <a href="tel:988">988</a> is confidential.</p>

    <p class="fineprint">Last reviewed August 2026.</p>`
));

emit("compare", comparePage());
emit("how-we-review", methodologyPage());

/* ---------------------------------------------------- the care compass */
const n2 = (i) => String(i + 1).padStart(2, "0");

const compassTabs = compass.categories
  .map((c, i) => `        <button class="ctab${i === 0 ? " is-on" : ""}" role="tab" id="ctab-${c.id}"
          aria-selected="${i === 0}" aria-controls="cpanel-${c.id}" data-panel="${c.id}">
          <span class="ctab-n">${n2(i)}</span><span class="ctab-l">${c.label}</span>
        </button>`)
  .join("\n");

const compassPanels = compass.categories
  .map((c, i) => `      <div class="cpanel${i === 0 ? " is-on" : ""}" id="cpanel-${c.id}" role="tabpanel"
        aria-labelledby="ctab-${c.id}"${i === 0 ? "" : " hidden"}>
        <div class="cpanel-intro">
          <p class="ceyebrow">Your care compass &middot; ${c.label}</p>
          <p class="cpanel-title" role="heading" aria-level="3">Ten questions before you choose</p>
          <p>${c.intro}</p>
        </div>
        <div class="cpanel-qs">
${c.questions.map((q, j) => `          <details class="cq">
            <summary><span class="cq-n">${n2(j)}</span><span class="cq-t">${q[0]}</span><span class="cq-i" aria-hidden="true"></span></summary>
            <p>${q[1]}</p>
          </details>`).join("\n")}
        </div>
      </div>`)
  .join("\n");

const inject = (src, tag, body) => {
  const a = src.indexOf(`<!-- ${tag} -->`);
  const b = src.indexOf(`<!-- /${tag} -->`);
  if (a === -1 || b === -1) throw new Error(`missing ${tag} markers in index.html`);
  return src.slice(0, a + `<!-- ${tag} -->`.length) + "\n" + body + "\n      " + src.slice(b);
};

/* hub cards */
const indexPath = join(ROOT, "templates", "index.html");
let index = readFileSync(indexPath, "utf8");
const START = "<!-- centers:start -->";
const END = "<!-- centers:end -->";
const a = index.indexOf(START);
const b = index.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`! index.html is missing the ${START} / ${END} markers.`);
  process.exit(1);
}
index = index.slice(0, a + START.length) + "\n" + centers.map(card).join("\n") + "\n      " + index.slice(b);
index = inject(index, "jsonld", S.render([
  S.organizationNode(REVIEWED_ISO),
  S.collectionNode("", "Bergen County Drug Rehabs",
    "Six addiction treatment centers serving Bergen County, New Jersey, compared against published evidence.", centers),
  S.breadcrumbNode([{ name: "Guide", path: "" }]),
]));
index = inject(index, "compass:tabs", compassTabs);
index = inject(index, "compass:panels", compassPanels);
mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, "index.html"), index, "utf8");

console.log(`Built ${pages.length} pages:`);
console.log(`  care compass: ${compass.categories.length} categories x ${compass.categories[0].questions.length} questions`);
console.log(`  ${centers.length} reviews, ${RIVALS.length} alternatives, ${RIVALS.length} worth-it, ${RIVALS.length} head-to-head, ${RIVALS.length} cost, ${CROSS.length} cross, 2 spine`);

/* ---------------------------------------------------- static assets */
import { cpSync, existsSync } from "node:fs";
for (const f of ["styles.css", "script.js", ".nojekyll"]) {
  if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(DIST, f));
}
if (existsSync(join(ROOT, "assets"))) {
  cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
}
console.log("  static assets -> dist/");
