/**
 * The outer-section article renderer.
 *
 * The rule that shapes everything: an article never hardcodes a number. Every
 * figure is a reference into data/bergen.json, resolved at build time, with the
 * attribution attached automatically. Four things follow from that:
 *
 *   - a typo in a statistic becomes impossible; the number on the page IS the
 *     number in the dataset
 *   - the CY2025 update is a data swap, not a rewrite of every page
 *   - "cite the source before the claim" stops being editorial discipline and
 *     becomes structural — the renderer emits it and a writer cannot forget
 *   - the facts-record projection map becomes computable, so regenerating after
 *     a correction is grep rather than memory
 *
 * Structure is enforced here rather than trusted to the author: the intro is a
 * separate field with links stripped, H2s come only from sections[].heading,
 * H3 is reachable only inside the FAQ block, and every section opens with its
 * extractive answer wrapped in <strong>.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const fmt = (n) => Number(n).toLocaleString("en-US");

/** Resolve "residents2024.insurance.medicaid" or "…topReceiving…0" into a value. */
function lookup(bergen, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), bergen);
}

/**
 * A ref resolves to {n, pct, name} depending on the shape it points at:
 *   [count, pct]          -> n, pct
 *   [name, count, pct]    -> name, n, pct
 *   number                -> n
 */
function shapeRef(v) {
  if (typeof v === "number") return { n: fmt(v), raw: v };
  if (Array.isArray(v) && typeof v[0] === "string") return { name: v[0], n: fmt(v[1]), pct: String(v[2]), raw: v[1] };
  if (Array.isArray(v)) return { n: fmt(v[0]), pct: String(v[1]), raw: v[0] };
  return { n: String(v), raw: v };
}

export function resolveRefs(text, refs) {
  return String(text).replace(/\{\{(\w+)\.(\w+)\}\}/g, (m, key, field) => {
    const r = refs[key];
    if (!r || r[field] === undefined) throw new Error(`unresolved reference ${m}`);
    return r[field];
  });
}

export function loadArticles(ROOT, bergen) {
  const dir = join(ROOT, "data", "articles");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => {
      const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
      a.refs = Object.fromEntries(
        Object.entries(a.bergenRefs || {}).map(([k, path]) => {
          const v = lookup(bergen, path);
          if (v === undefined) throw new Error(`${a.slug}: bergenRef ${k} -> ${path} not found`);
          return [k, shapeRef(v)];
        })
      );
      return a;
    });
}

/** Structural checks the renderer refuses to emit past. */
export function assertShape(a) {
  const errs = [];
  if (!a.intro) errs.push("missing intro");
  if (/<a\b/i.test(a.intro || "")) errs.push("intro contains a link");
  if (!Array.isArray(a.sections) || a.sections.length < 3) errs.push("fewer than 3 sections");
  for (const s of a.sections || []) {
    if (!/\?$/.test(s.heading.trim())) errs.push(`H2 is not a question: "${s.heading}"`);
    const words = String(s.answer || "").split(/\s+/).length;
    if (words > 55) errs.push(`extractive answer is ${words} words (target ~40): "${s.heading}"`);
    if (!s.bridge) errs.push(`no bridge sentence: "${s.heading}"`);
  }
  if ((a.faqs || []).length !== 8) errs.push(`${(a.faqs || []).length} FAQs; exactly 8 required`);
  for (const f of a.faqs || []) if (!f[2]) errs.push(`FAQ missing paaSource: "${f[0]}"`);
  if ((a.sources || []).length < 2) errs.push("fewer than 2 sources");
  for (const s of a.sources || [])
    if (!/^https?:\/\/[^/]*\.(gov|edu|net|org)\b/.test(s.url)) errs.push(`source is not a primary domain: ${s.url}`);
  const n = (a.links || []).length;
  if (n < 3 || n > 5) errs.push(`${n} body links; budget is 3-5`);
  if (errs.length) throw new Error(`${a.slug}:\n    - ${errs.join("\n    - ")}`);
}

export function articleBody(a) {
  const R = (t) => resolveRefs(t, a.refs);
  const src = a.sources[0];

  return `
<article class="article">
  <div class="article-intro">
    <p class="lede-dark">${R(a.intro)}</p>
    <p class="byline">By <a href="../editorial-process/">Bergen County Recovers</a>
      &middot; Reviewed ${a.lastReviewed}
      &middot; organizational authorship, process published</p>
  </div>

${a.sections
  .map(
    (s) => `  <section class="art-sec">
    <h2>${R(s.heading)}</h2>
    <p><strong>${R(s.answer)}</strong></p>
${s.body.map((p) => `    <p>${R(p)}</p>`).join("\n")}
    <p class="bridge">${R(s.bridge)}</p>
  </section>`
  )
  .join("\n")}

  <section class="art-sec takeaways">
    <h2>What the data says, in short</h2>
    <ul>
${a.keyTakeaways.map((t) => `      <li>${R(t)}</li>`).join("\n")}
    </ul>
  </section>

  <section class="art-sec">
    <h2>Questions people ask about this data</h2>
    <div class="faq">
${a.faqs
  .map(
    ([q, ans]) => `      <details><summary>${R(q)}</summary><p>${R(ans)}</p></details>`
  )
  .join("\n")}
    </div>
  </section>

  <section class="art-sec sources">
    <h2>Sources</h2>
    <ol>
${a.sources
  .map(
    (s) => `      <li><b>${s.name}</b>, <i>${s.title}</i>. <a href="${s.url}" rel="nofollow noopener" target="_blank">${new URL(s.url).hostname}</a>. ${s.note}</li>`
  )
  .join("\n")}
    </ol>
    <p class="fineprint">Every figure on this page is resolved from the dataset above at build time rather than typed into the prose, so the number shown and the number published by the source cannot drift apart.</p>
  </section>

  <section class="art-sec">
    <h2>Where to go next</h2>
    <ul class="plain">
${a.links.map(([href, anchor]) => `      <li><a href="..${href}">${anchor}</a></li>`).join("\n")}
    </ul>
  </section>
</article>`;
}
