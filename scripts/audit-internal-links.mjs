/**
 * Internal link auditor for a static HTML site.
 *
 * Ported from brand-north-content-integrity, whose implementation is Next.js
 * app-router shaped. On a static site the route set is both simpler and more
 * reliable: it is the built output. Walk dist/ for index.html, derive the route.
 *
 * Folds in the rules semantic-article-formatter specifies but its own scanner
 * never implemented, so there is one link scanner rather than two that disagree:
 *   1. every internal href resolves to a real route
 *   2. no link to a redirect SOURCE — a retired URL must surface, not silently work
 *   3. no duplicate destination within one article
 *   4. no links inside an article introduction
 *   5. 3-5 unique body links per article  (formatter 3-6 ∩ content-brief 3-5)
 *   6. every page receives at least one inbound link (no orphans)
 *
 * Rules 3-5 apply to articles only; the core comparison pages are densely
 * cross-linked by design.
 *
 * Two things this gets right that the reference implementation does not:
 *   - hrefs are RESOLVED against the containing page, so ../foo/ is seen. The
 *     upstream regex matches only /^\//, which on a relatively-linked site
 *     silently passes everything as if it were fine.
 *   - only <a href> counts. A <link rel="canonical"> points a page at itself,
 *     so counting <link> hrefs makes every page its own inbound link and no
 *     page can ever be reported as an orphan.
 *
 *   node scripts/audit-internal-links.mjs
 *   exit 0 clean · exit 1 on any violation
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const ARTICLES = join(ROOT, "data", "articles");
const ORIGIN = "https://bergencountydrugrehabs.com";

const IGNORE_PREFIX = ["/assets/", "/images/", "/fonts/"];
const IGNORE_EXT = /\.(png|jpe?g|avif|webp|svg|ico|pdf|xml|json|txt|css|js|md)$/i;

if (!existsSync(DIST)) {
  console.error("audit:links — dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
}

const files = walkHtml(DIST);
const routeOf = (f) => {
  const r = relative(DIST, f).split(sep).slice(0, -1).join("/");
  return r ? `/${r}` : "/";
};
const routes = new Set(files.map(routeOf));

/* redirect sources are forbidden targets, never valid ones */
const redirectSources = new Set();
for (const f of ["_redirects", "netlify.toml", "static.json"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  const txt = readFileSync(p, "utf8");
  for (const m of txt.matchAll(/^\s*(\/\S+)\s+\/\S+/gm)) redirectSources.add(m[1]);
  for (const m of txt.matchAll(/from\s*=\s*"(\/[^"]+)"/g)) redirectSources.add(m[1]);
}

const articleRoutes = existsSync(ARTICLES)
  ? new Set(
      readdirSync(ARTICLES)
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => `/${f.replace(/\.json$/, "")}`)
    )
  : new Set();

const findings = [];
const inbound = new Map([...routes].map((r) => [r, 0]));

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const from = routeOf(file);
  const base = new URL(from === "/" ? "/" : `${from}/`, ORIGIN);
  const seen = new Map();

  for (const m of html.matchAll(/<a[^>]*?href\s*=\s*["']([^"']+)["']/gis)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#")) continue;
    if (!/^https?:/i.test(raw) && /^[a-z]+:/i.test(raw)) continue; // tel:, mailto:

    let u;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if (u.origin !== ORIGIN) continue; // external

    let target = u.pathname;
    if (target.length > 1) target = target.replace(/\/$/, "");
    if (IGNORE_PREFIX.some((p) => target.startsWith(p)) || IGNORE_EXT.test(target)) continue;

    if (redirectSources.has(target)) {
      findings.push({ from, rule: "redirect-source", detail: `${target} is a redirect source; link the final URL` });
      continue;
    }
    if (!routes.has(target)) {
      findings.push({ from, rule: "broken-link", detail: `${target} does not exist` });
      continue;
    }

    if (target !== from) inbound.set(target, (inbound.get(target) || 0) + 1);
    seen.set(target, (seen.get(target) || 0) + 1);
  }

  if (articleRoutes.has(from)) {
    for (const [t, n] of seen) {
      if (n > 1) findings.push({ from, rule: "duplicate-destination", detail: `${t} linked ${n}x` });
    }
    const intro = html.match(/<div class="article-intro">([\s\S]*?)<\/div>/i);
    if (intro && /<a[^>]*href/i.test(intro[1])) {
      findings.push({ from, rule: "intro-link", detail: "introduction contains a link" });
    }
    if (seen.size < 3 || seen.size > 5) {
      findings.push({ from, rule: "link-budget", detail: `${seen.size} unique body links; budget is 3-5` });
    }
  }
}

for (const [route, n] of inbound) {
  if (n === 0 && route !== "/") findings.push({ from: route, rule: "orphan", detail: "no page links here" });
}

if (findings.length) {
  const byRule = findings.reduce((a, f) => ((a[f.rule] ||= []).push(f), a), {});
  console.error(`audit:links — ${findings.length} finding(s) across ${files.length} pages\n`);
  for (const [rule, list] of Object.entries(byRule)) {
    console.error(`  ${rule} (${list.length})`);
    for (const f of list.slice(0, 12)) console.error(`    ${f.from}  ${f.detail}`);
    if (list.length > 12) console.error(`    … ${list.length - 12} more`);
  }
  process.exit(1);
}

console.log(`audit:links — ${files.length} pages, ${routes.size} routes, no broken links, no orphans`);
