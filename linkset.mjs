/**
 * RFC 9264 linkset — typed relationships as a standalone document.
 *
 * Schema says what a page IS. This says how resources RELATE. The two are
 * complementary and this does not replace entitymap.json; it expresses the
 * relationship layer in a vocabulary that has an RFC number rather than one we
 * invented.
 *
 * Served as application/linkset+json at /linkset.json, discovered through a
 * <link rel="linkset"> element in every page head.
 *
 * Three relation types are emitted, and one deliberately is not:
 *
 *   cite-as      the canonical citation target for a page. On a site
 *                republishing county statistics this is the load-bearing one:
 *                when an assistant surfaces a figure, the attribution should
 *                resolve here rather than to whichever aggregator reposted it.
 *
 *   author       every page points at /editorial-process/. The site uses
 *                organizational authorship, which is the weaker signal, so
 *                restating it in a second standard vocabulary is worth the
 *                bytes.
 *
 *   describedby  two directions. Articles point at the primary source they
 *                draw from. And — the part only a directory can do — each
 *                center's OWN homepage is anchored, with our review declared
 *                as a description of it. RFC 9264 permits a server to publish
 *                links about resources hosted elsewhere, and no other
 *                mechanism we have expresses that relationship: schema
 *                describes the business, not our relationship to it.
 *
 *   license      NOT emitted. We have not decided reuse terms for the prose,
 *                and a license relation pointing at nothing, or at terms
 *                nobody agreed, is worse than its absence.
 */

const ORIGIN = "https://bergencountydrugrehabs.com";

export function buildLinkset({ pages, centers, articles, reviewed }) {
  const self = (path) => `${ORIGIN}${path}`;
  const authorRef = [{ href: `${ORIGIN}/editorial-process/` }];
  const contexts = [];

  /* ---- the site root: what describes this publication ---- */
  contexts.push({
    anchor: `${ORIGIN}/`,
    "cite-as": [{ href: `${ORIGIN}/` }],
    author: authorRef,
    describedby: [
      { href: `${ORIGIN}/entitymap.json`, type: "application/json" },
      { href: `${ORIGIN}/llms.txt`, type: "text/plain" },
      { href: `${ORIGIN}/how-we-review/`, type: "text/html" },
    ],
  });

  /* ---- every published page: canonical citation target + author ---- */
  for (const p of pages) {
    if (p === "/") continue; // already emitted above
    contexts.push({
      anchor: self(p),
      "cite-as": [{ href: self(p) }],
      author: authorRef,
    });
  }

  /* ---- articles: point at the primary source they draw from ---- */
  for (const a of articles) {
    const ctx = contexts.find((c) => c.anchor === self(`/${a.slug}/`));
    if (!ctx) continue;
    ctx.describedby = a.sources.map((s) => ({
      href: s.url,
      type: s.url.endsWith(".pdf") ? "application/pdf" : "text/html",
      title: s.title,
    }));
  }

  /* ---- cross-domain: anchor each center's own site, describe it here ----
     This is the relation a directory exists to assert and the only one in
     this file that could not be expressed on the page itself. */
  for (const c of centers) {
    contexts.push({
      anchor: c.site,
      describedby: [
        {
          href: self(`/${c.slug}/`),
          type: "text/html",
          title: `Editorial review of ${c.name.replace(/&mdash;/g, "—")} by Bergen County Recovers`,
        },
      ],
    });
  }

  return { linkset: contexts };
}

/** Minimal structural validation against the shape RFC 9264 defines. */
export function validateLinkset(doc) {
  const errs = [];
  if (!doc || !Array.isArray(doc.linkset)) return ["top level must be an object with a linkset array"];

  const KNOWN = new Set(["anchor", "cite-as", "author", "describedby", "license", "latest-version", "alternate", "item", "collection"]);
  doc.linkset.forEach((ctx, i) => {
    if (typeof ctx.anchor !== "string" || !/^https?:\/\//.test(ctx.anchor))
      errs.push(`context ${i}: anchor must be an absolute URI`);
    const rels = Object.keys(ctx).filter((k) => k !== "anchor");
    if (!rels.length) errs.push(`context ${i}: no relations — an anchor with no links is meaningless`);
    for (const rel of rels) {
      if (!KNOWN.has(rel)) errs.push(`context ${i}: unregistered relation "${rel}"`);
      if (!Array.isArray(ctx[rel])) {
        errs.push(`context ${i}: relation "${rel}" must be an array of link objects`);
        continue;
      }
      ctx[rel].forEach((l, j) => {
        if (typeof l.href !== "string" || !/^https?:\/\//.test(l.href))
          errs.push(`context ${i}.${rel}[${j}]: href must be an absolute URI`);
      });
    }
  });

  // every anchor must be unique — duplicate contexts for one resource are
  // legal but ambiguous, and a consumer merging them is not guaranteed
  const seen = new Set();
  for (const ctx of doc.linkset) {
    if (seen.has(ctx.anchor)) errs.push(`duplicate anchor: ${ctx.anchor}`);
    seen.add(ctx.anchor);
  }
  return errs;
}
