/**
 * Guard: every <img> in the built site carries an alt attribute.
 *
 * brand-north-accessibility: "Decorative -> alt="". NEVER omit the attribute."
 * An empty alt is a decision; a missing alt is an omission a screen reader
 * resolves by reading the filename.
 *
 * Must NOT flag <source> inside <picture> — those legitimately carry no alt;
 * the <img> they fall back to is the element that must have it.
 *
 *   node scripts/a11y-assert-alt.mjs
 *   exit 0 clean · exit 1 on any <img> without alt
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error("a11y:alt — dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const html = readFileSync(file, "utf8");
  // every <img ...> tag, however it is spelled or wrapped across lines
  const imgs = html.match(/<img\b[^>]*>/gis) || [];
  imgs.forEach((tag) => {
    if (!/\balt\s*=/i.test(tag)) {
      const line = html.slice(0, html.indexOf(tag)).split("\n").length;
      failures.push({ file: relative(ROOT, file), line, tag: tag.slice(0, 110) });
    }
  });
}

const imgTotal = files.reduce(
  (n, f) => n + (readFileSync(f, "utf8").match(/<img\b/gi) || []).length, 0);

if (failures.length) {
  console.error(`a11y:alt — ${failures.length} <img> without an alt attribute\n`);
  for (const f of failures) console.error(`  ${f.file}:${f.line}\n    ${f.tag}`);
  console.error("\nDecorative images take alt=\"\". Never omit the attribute.");
  process.exit(1);
}

console.log(`a11y:alt — ${imgTotal} <img> across ${files.length} pages, all carry alt`);
