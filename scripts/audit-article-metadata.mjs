/**
 * Article metadata guard.
 *
 * Ported from brand-north-content-integrity. The rules transfer verbatim; only
 * the reader changes — articles here are JSON under data/articles rather than
 * src/data/articles.
 *
 * The incident this exists to prevent: lastReviewed was a scaffold constant, and
 * 36 of 67 articles claimed a review date earlier than the file's own first
 * commit, 15 of them off by about sixteen months. A review date is a factual
 * claim that a named human read the content on that day.
 *
 * FAIL (exit 1):
 *   datePublished missing / not ISO / in the future
 *   lastReviewed  missing / not ISO / in the future
 *   lastReviewed < datePublished        — a review cannot precede publication
 *   reviewedBy    missing, non-string, or blank
 *   invalid JSON
 *
 * WARN (exit 0): lastReviewed older than REVIEW_WINDOW_MONTHS. Never bump a date
 * to clear the warning — the date is the claim. Put it in a human review queue.
 *
 *   node scripts/audit-article-metadata.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT, "data", "articles");

/** Keep in sync with the review window /editorial-policy/ publicly promises. */
const REVIEW_WINDOW_MONTHS = 12;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);

if (!existsSync(ARTICLES_DIR)) {
  console.log("audit:metadata — data/articles does not exist yet; no articles to check");
  process.exit(0);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".json") && !e.startsWith("_")) out.push(p);
  }
  return out;
}

const files = walk(ARTICLES_DIR);
if (!files.length) {
  console.log("audit:metadata — no articles yet");
  process.exit(0);
}

const errors = [];
const warnings = [];

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};
const staleBefore = monthsAgo(REVIEW_WINDOW_MONTHS);

for (const file of files) {
  const rel = relative(ROOT, file);
  let a;
  try {
    a = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel}: invalid JSON — ${e.message}`);
    continue;
  }

  const { datePublished: dp, lastReviewed: lr, reviewedBy: rb } = a;

  if (!dp) errors.push(`${rel}: missing datePublished`);
  else if (!ISO.test(dp)) errors.push(`${rel}: datePublished is not an ISO date (${JSON.stringify(dp)})`);
  else if (dp > today) errors.push(`${rel}: datePublished is in the future (${dp})`);

  // catches the literal string "undefined", the recurring template-substitution bug
  if (!lr) errors.push(`${rel}: missing lastReviewed`);
  else if (!ISO.test(lr)) errors.push(`${rel}: lastReviewed is not an ISO date (${JSON.stringify(lr)})`);
  else if (lr > today) errors.push(`${rel}: lastReviewed is in the future (${lr})`);

  if (ISO.test(dp || "") && ISO.test(lr || "") && lr < dp)
    errors.push(`${rel}: lastReviewed ${lr} precedes datePublished ${dp} — a review cannot precede publication`);

  if (typeof rb !== "string" || !rb.trim()) errors.push(`${rel}: reviewedBy missing or blank`);

  if (ISO.test(lr || "") && lr < staleBefore) warnings.push(`${rel}: last reviewed ${lr}`);
}

if (warnings.length) {
  console.warn(`audit:metadata — ${warnings.length} article(s) past the ${REVIEW_WINDOW_MONTHS}-month review window`);
  for (const w of warnings) console.warn(`  ${w}`);
  console.warn("  These need a genuine review. Do not bump the date — it is a factual claim.\n");
}

if (errors.length) {
  console.error(`audit:metadata — ${errors.length} error(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`audit:metadata — ${files.length} article(s), dates and attribution valid`);
