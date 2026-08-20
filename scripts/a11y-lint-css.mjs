/**
 * Guard: no `outline: none` without a visible replacement.
 *
 * brand-north-accessibility names this "the single most common failure in
 * designer-led builds" — the focus ring is removed for aesthetics and keyboard
 * users lose all sense of where they are.
 *
 * Removing the outline is only acceptable when the same rule supplies another
 * visible indicator (box-shadow, border, background, ring) OR a sibling
 * :focus-visible rule for the same selector restores one.
 *
 *   node scripts/a11y-lint-css.mjs
 *   exit 0 clean · exit 1 on an unreplaced outline removal
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function cssFiles(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (["node_modules", ".git", "dist"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) cssFiles(p, out);
    else if (e.endsWith(".css")) out.push(p);
  }
  return out;
}

/** Split a stylesheet into {selector, body, line} rule blocks. */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    out.push({
      selector: m[1].replace(/\s+/g, " ").trim(),
      body: m[2],
      line: css.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

const REPLACEMENT = /(box-shadow|border(-[a-z]+)?\s*:|outline-offset|background(-color)?\s*:|ring)/i;
const KILLS_OUTLINE = /outline\s*:\s*(none|0(px)?)\s*(;|$)/i;

const failures = [];
for (const file of cssFiles(ROOT)) {
  const css = readFileSync(file, "utf8");
  const all = rules(css);
  for (const r of all) {
    if (!KILLS_OUTLINE.test(r.body)) continue;
    if (REPLACEMENT.test(r.body)) continue;

    // a sibling :focus-visible rule for the same base selector counts
    const base = r.selector.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, "").trim();
    const restored = all.some(
      (o) =>
        o !== r &&
        /focus-visible|focus/i.test(o.selector) &&
        o.selector.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, "").trim() === base &&
        REPLACEMENT.test(o.body)
    );
    if (restored) continue;

    failures.push({ file: relative(ROOT, file), line: r.line, selector: r.selector });
  }
}

if (failures.length) {
  console.error(`a11y:css — ${failures.length} rule(s) remove the focus outline with no visible replacement\n`);
  for (const f of failures) console.error(`  ${f.file}:${f.line}  ${f.selector}`);
  console.error("\nSupply a visible :focus-visible indicator, or keep the outline.");
  process.exit(1);
}

console.log(`a11y:css — no unreplaced outline removals`);
