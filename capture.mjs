/**
 * Captures a homepage screenshot of each center for use as a card thumbnail.
 *
 * These are reference thumbnails of publicly available homepages, shown next to
 * an editorial review of that homepage's publisher. That is the same comparative
 * use a search engine's site preview makes. We do not reproduce site copy, and we
 * do not touch Google Business Profile photos — those are owned by the business or
 * by the individual who uploaded them, and republishing them commercially is
 * straightforward infringement regardless of how they are obtained.
 *
 *   node capture.mjs
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const centers = JSON.parse(readFileSync(join(ROOT, "data/centers.json"), "utf8"));
const OUT = join(ROOT, "assets/centers");
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1000, height: 625 };

const browser = await chromium.launch({
  args: ["--disable-http2", "--disable-features=IsolateOrigins,site-per-process"],
});
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});

for (const c of centers) {
  const page = await ctx.newPage();
  const file = join(OUT, `${c.slug}.jpg`);
  try {
    process.stdout.write(`  ${c.slug} … `);
    await page.goto(c.site, { waitUntil: "domcontentloaded", timeout: 45000 });
    // let hero media and webfonts settle, then kill anything that obscures the page
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      const kill = [
        "[id*=cookie]", "[class*=cookie]", "[id*=consent]", "[class*=consent]",
        "[class*=gdpr]", "[id*=gdpr]", "[role=dialog]", "[class*=modal]",
        "[class*=popup]", "[id*=popup]", "[class*=chat]", "[id*=chat]",
        "[class*=intercom]", "[class*=drift]", "[class*=tawk]",
      ];
      kill.forEach((sel) =>
        document.querySelectorAll(sel).forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.position === "sticky" || parseInt(cs.zIndex || 0, 10) > 100) {
            el.remove();
          }
        })
      );
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: file, type: "jpeg", quality: 72, clip: { x: 0, y: 0, ...VIEWPORT } });
    console.log("ok");
  } catch (err) {
    console.log(`FAILED — ${err.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nThumbnails written to assets/centers/`);
