/**
 * Guard: axe-core against the built site, failing on NEW violations only.
 *
 * A never-audited site has a standing violation count. Failing on the absolute
 * number means the guard can never be adopted; failing on the delta means it
 * starts working today and the backlog is burned down deliberately.
 *
 * Served over a real HTTP origin — file:// breaks the site's relative asset
 * paths and produces violations that do not exist in production.
 *
 * Representative page set per brand-north-accessibility: homepage, a commercial
 * leaf, a data-table page, an article, a policy page.
 *
 *   node scripts/a11y-axe.mjs            compare against .a11y-baseline.json
 *   node scripts/a11y-axe.mjs --update   rewrite the baseline (review the diff)
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BASELINE = join(ROOT, ".a11y-baseline.json");
const UPDATE = process.argv.includes("--update");

const PAGES = [
  "/",                                  // hub: compass tablist + shortlist tool
  "/valley-spring-recovery-center/",    // commercial leaf
  "/compare/",                          // wide data table
  "/how-we-review/",                    // long-form prose
  "/editorial-policy/",                 // policy page
];

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = join(DIST, decodeURIComponent(req.url.split("?")[0]));
      try { if (statSync(p).isDirectory()) p = join(p, "index.html"); } catch {}
      try {
        const body = readFileSync(p);
        res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
        res.end(body);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

let chromium, AxeBuilder;
try {
  ({ chromium } = await import("playwright"));
  AxeBuilder = (await import("@axe-core/playwright")).default;
} catch {
  console.error("a11y:axe — needs playwright and @axe-core/playwright:\n  npm i -D @axe-core/playwright");
  process.exit(1);
}

if (!existsSync(DIST)) { console.error("a11y:axe — dist/ not found. Run `npm run build`."); process.exit(1); }

const { server, port } = await serve();
const browser = await chromium.launch();
const page = await browser.newPage();
const found = [];

for (const path of PAGES) {
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "load" });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  for (const v of violations)
    for (const n of v.nodes)
      found.push({ page: path, rule: v.id, impact: v.impact, target: n.target.join(" ") });
}

await browser.close();
server.close();

const key = (f) => `${f.page}|${f.rule}|${f.target}`;
const current = new Set(found.map(key));

if (UPDATE || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify({ generated: "committed baseline", findings: [...current].sort() }, null, 2));
  console.log(`a11y:axe — baseline written with ${current.size} known finding(s). Review and commit it.`);
  process.exit(0);
}

const baseline = new Set(JSON.parse(readFileSync(BASELINE, "utf8")).findings);
const added = [...current].filter((k) => !baseline.has(k));
const fixed = [...baseline].filter((k) => !current.has(k));

if (fixed.length) console.log(`a11y:axe — ${fixed.length} baseline finding(s) fixed. Re-run with --update to bank them.`);

if (added.length) {
  console.error(`a11y:axe — ${added.length} NEW violation(s)\n`);
  for (const k of added) {
    const f = found.find((x) => key(x) === k);
    console.error(`  ${f.page}  [${f.impact}] ${f.rule}\n    ${f.target}`);
  }
  process.exit(1);
}

console.log(`a11y:axe — no new violations (${current.size} known, ${PAGES.length} pages)`);
