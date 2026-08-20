/**
 * JSON-LD generation.
 *
 * Two rules drive everything here.
 *
 * 1. ONE Organization, declared once with an @id, referenced everywhere else.
 *    check_schema errors on a full Organization with no @id and warns when the
 *    same node is fully re-declared across many pages.
 *
 * 2. The editorial score is a `Review`, NEVER an `AggregateRating`. This is the
 *    trap in a comparison site: AggregateRating raises two FACTUAL errors —
 *    a rating with no author, and no reviewCount — which escalate to a human
 *    and cannot be auto-cleared. And it would be false. One publisher's
 *    assessment of one facility aggregates nothing; it is a review, with an
 *    author, of an itemReviewed.
 */

export const ORIGIN = "https://bergencountydrugrehabs.com";
const ORG_ID = `${ORIGIN}/#org`;
const url = (path = "") => `${ORIGIN}/${path}`;

const orgRef = { "@id": ORG_ID };

/** Declared in full exactly once, on the homepage. */
export const organizationNode = (reviewed) => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Bergen County Recovers",
  url: url(),
  description:
    "A comparison guide to addiction and mental health treatment centers serving Bergen County, New Jersey, assessed against published evidence.",
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Bergen County",
    containedInPlace: { "@type": "State", name: "New Jersey" },
  },
  publishingPrinciples: url("editorial-policy/"),
  actionableFeedbackPolicy: url("editorial-policy/"),
  // The organization IS the author, so the credential and the process it
  // follows have to be machine-readable, not just prose on a page.
  knowsAbout: [
    "addiction treatment", "substance use disorder", "behavioral health",
    "Bergen County, New Jersey", "treatment center comparison",
  ],
  dateModified: reviewed,
});

export const localBusinessNode = (c) => {
  const [city] = c.city.split(",");
  const node = {
    "@type": "LocalBusiness",
    "@id": `${ORIGIN}/${c.slug}/#business`,
    name: c.name.replace(/&mdash;/g, "—"),
    url: c.site,
    address: {
      "@type": "PostalAddress",
      addressLocality: city.trim(),
      addressRegion: "NJ",
      addressCountry: "US",
      ...(c.address?.streetAddress ? { streetAddress: c.address.streetAddress } : {}),
      ...(c.address?.postalCode ? { postalCode: c.address.postalCode } : {}),
    },
  };
  return node;
};

/**
 * The editorial assessment. A Review with a named author and an itemReviewed.
 * bestRating is stated because a 5-point scale is not the default assumption.
 */
export const reviewNode = (c, reviewed) => ({
  "@type": "Review",
  "@id": `${ORIGIN}/${c.slug}/#review`,
  itemReviewed: { "@id": `${ORIGIN}/${c.slug}/#business` },
  author: orgRef,
  publisher: orgRef,
  datePublished: reviewed,
  reviewRating: {
    "@type": "Rating",
    ratingValue: Number(c.score),
    bestRating: 5,
    worstRating: 0,
    ratingExplanation:
      "Measures the clarity and breadth of publicly available information, not treatment outcomes or patient satisfaction.",
  },
  reviewBody: String(c.summary).replace(/<[^>]+>/g, ""),
});

export const breadcrumbNode = (trail) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.name,
    ...(t.path !== undefined ? { item: url(t.path) } : {}),
  })),
});

/** Only where visible Q&A exists; text must match what the page renders. */
export const faqNode = (qas) => ({
  "@type": "FAQPage",
  mainEntity: qas.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: String(a).replace(/<[^>]+>/g, "") },
  })),
});

export const collectionNode = (path, name, description, centers) => ({
  "@type": "CollectionPage",
  "@id": `${ORIGIN}/${path}#page`,
  name,
  description,
  isPartOf: orgRef,
  author: orgRef,
  publisher: orgRef,
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: centers.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: centers.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: url(`${c.slug}/`),
      name: c.name.replace(/&mdash;/g, "—"),
    })),
  },
});

export const webPageNode = (path, name, description, reviewed) => ({
  "@type": "WebPage",
  "@id": `${ORIGIN}/${path}#page`,
  name,
  description,
  isPartOf: orgRef,
  author: orgRef,
  publisher: orgRef,
  reviewedBy: orgRef,
  dateModified: reviewed,
  lastReviewed: reviewed,
});

/** Wrap nodes in one @graph and emit the script tag. */
export const render = (nodes) =>
  `<script type="application/ld+json">${JSON.stringify(
    { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) },
    null,
    0
  )}</script>`;
