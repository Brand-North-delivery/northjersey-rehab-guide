/**
 * Situation-based fit, replacing the single global ranking.
 *
 * WHY THIS REPLACED A RANK
 *
 * A single ordered list forces a verdict the evidence cannot support. Ranking
 * six centers 1 to 6 says the sixth is worst, and nothing in publicly available
 * information supports that claim about anyone's care. It also answers a
 * question almost no reader has. Nobody arrives asking "which is best." They
 * arrive asking "can this place take me, on my insurance, on a schedule I can
 * keep, for the thing that is actually wrong."
 *
 * So the unit of judgement is the SITUATION, not the center. Each center is
 * assessed as a fit for each situation, with the reason stated and traceable to
 * a field in data/evidence.json. A center can be the strongest option for one
 * situation and the wrong option for another, which is what is actually true.
 *
 * The situations are not invented. Each is the largest documented segment in
 * the Bergen County admissions data, or a documented access barrier:
 *   - Medicaid           61% of CY2024 admissions
 *   - working schedule   34% employed full or part time
 *   - detox risk         alcohol is the primary drug in 50% of admissions
 *   - mental health      licensed separately in NJ; most centers cannot admit
 *   - continuity         35% of clients had 2+ admissions in one year
 *   - verifiability      the reader's only pre-admission check
 *
 * A published-evidence index is retained as a SECONDARY signal. It measures how
 * much a center discloses, is labelled as such, and is deliberately not called
 * a score or a rank.
 */

export const SITUATIONS = [
  {
    id: "medicaid",
    label: "I have Medicaid",
    why: "Medicaid covered 61% of Bergen County treatment admissions in 2024, the single largest payer.",
    test: (e, c) => (e.transparency.publicInsuranceAccepted ? "strong" : e.transparency.publicInsuranceExclusionStated ? "no" : "unknown"),
    reason: {
      strong: "States it accepts Medicaid and Medicare.",
      no: "States it does not accept Medicaid or Medicare.",
      unknown: "Does not publish a position on Medicaid. Ask before the clinical conversation.",
    },
  },
  {
    id: "working",
    label: "I cannot stop working",
    why: "34% of Bergen County admissions were people employed full or part time. Most programs run during business hours.",
    test: (e) => (e.continuity.eveningIop ? "strong" : e.continuity.telehealth ? "possible" : "unknown"),
    reason: {
      strong: "Publishes an evening intensive outpatient track.",
      possible: "Offers telehealth, which may cover some sessions. No evening track published.",
      unknown: "No evening schedule or telehealth published. Ask for exact program hours.",
    },
  },
  {
    id: "detox",
    label: "Withdrawal may be dangerous",
    why: "Alcohol is the primary substance in half of Bergen County admissions, and alcohol withdrawal can be life-threatening.",
    test: (e) => (e.continuity.detoxOnSite ? "strong" : e.continuity.detoxByReferral ? "possible" : "no"),
    reason: {
      strong: "Provides medical detox on site, so clinical responsibility does not change hands.",
      possible: "Arranges detox through a partner facility. Ask who is clinically responsible during the transfer.",
      no: "No detox pathway published. Requires medical assessment elsewhere first.",
    },
  },
  {
    id: "mentalhealth",
    label: "Mental health is the primary problem",
    why: "New Jersey licenses mental health separately. A center without that licence generally cannot admit someone with no substance use diagnosis.",
    test: (e) => (e.credentials.secondLicenseMentalHealth ? "strong" : e.transparency.separateMentalHealthTrackStated ? "possible" : "no"),
    reason: {
      strong: "Holds a separate New Jersey mental health licence, so no substance use diagnosis is required.",
      possible: "Publishes a distinct mental health track. Ask which licence an admission would fall under.",
      no: "No separate mental health licence or track published.",
    },
  },
  {
    id: "continuity",
    label: "I want one provider throughout",
    why: "35% of Bergen County clients were admitted more than once in a single year. Every handoff is a point where people fall out of treatment.",
    test: (e) => {
      const levels = ["detoxOnSite", "residential", "partialCare", "iop", "outpatient"].filter((k) => e.continuity[k]).length;
      return levels >= 4 ? "strong" : levels >= 2 ? "possible" : "no";
    },
    reason: {
      strong: "Covers four or more levels of care in house, so stepping down does not mean changing providers.",
      possible: "Covers part of the ladder. Ask where you go if you need more, or less, than they offer.",
      no: "Single level of care published.",
    },
  },
  {
    id: "verifiable",
    label: "I want to check them before I call",
    why: "A licence number is the only thing a family can verify at 11pm, before speaking to anyone.",
    test: (e, c, v) => {
      const t = v?.tiers?.stateLicense;
      if (t === "A") return "strong";
      if (e.credentials.carf || e.credentials.jointCommission) return "possible";
      return "no";
    },
    reason: {
      strong: "Publishes a New Jersey licence number that can be checked against the state directory.",
      possible: "Displays third-party accreditation but publishes no licence number to check.",
      no: "Publishes neither a licence number nor accreditation.",
    },
  },
];

const RANK = { strong: 3, possible: 2, unknown: 1, no: 0 };

/**
 * Disclosure checklist — what a center publishes, as a list of yes/no facts.
 *
 * Deliberately NOT a percentage. A single number, however it is normalised,
 * re-creates the ordered list this model exists to replace: the reader sees
 * 100 and 25 and reads first and last. A checklist carries the same
 * information and supports the only question that matters — is the specific
 * thing I need to check published or not.
 */
export const DISCLOSURES = [
  ["licenceNumber",  "State licence number",        (e, v) => e.credentials.licenseNumberPublished && v?.tiers?.stateLicense !== "C"],
  ["accreditation",  "Third-party accreditation",   (e) => e.credentials.carf || e.credentials.jointCommission],
  ["scheduleTimes",  "Actual program hours",        (e) => e.transparency.scheduleTimesPublished],
  ["levelsNot",      "Levels of care NOT offered",  (e) => e.transparency.levelsNotOfferedStated],
  ["namedStaff",     "Named clinical staff",        (e) => e.transparency.namedClinicalStaff],
  ["payers",         "Named insurance payers",      (e) => (e.transparency.payerCountPublished || 0) > 0],
  ["publicIns",      "Medicaid position stated",    (e) => !!(e.transparency.publicInsuranceAccepted || e.transparency.publicInsuranceExclusionStated)],
];

export function disclosures(slug, evidence, verification) {
  const e = evidence[slug];
  const v = verification[slug];
  return DISCLOSURES.map(([id, label, test]) => ({ id, label, published: !!test(e, v) }));
}

/** Retained for internal comparison only. Never rendered as a score. */
export function evidenceIndex(evidence, verification) {
  const raw = {};
  for (const [slug, e] of Object.entries(evidence)) {
    if (slug.startsWith("_")) continue;
    const v = verification[slug] || { tiers: {} };
    const tierMult = { A: 1, B: 0.6, C: 0 };
    let n = 0;
    // credentials, discounted by whether the claim can actually be checked
    if (e.credentials.stateLicensePublished) n += 8 * (tierMult[v.tiers?.stateLicense] ?? 0.6);
    if (e.credentials.licenseNumberPublished) n += 7 * (tierMult[v.tiers?.stateLicense] ?? 0.6);
    if (e.credentials.secondLicenseMentalHealth) n += 6 * (tierMult[v.tiers?.stateLicense] ?? 0.6);
    if (e.credentials.carf) n += 6 * (tierMult[v.tiers?.carf] ?? 0.6);
    if (e.credentials.jointCommission) n += 6 * (tierMult[v.tiers?.jointCommission] ?? 0.6);
    // disclosure
    if (e.transparency.scheduleTimesPublished) n += 9;
    if (e.transparency.levelsNotOfferedStated) n += 8;
    if (e.transparency.namedClinicalStaff) n += 6;
    if (e.transparency.medicationsNamed) n += 4;
    if (e.transparency.specialtyTracksNamed) n += 3;
    if (e.transparency.publicInsuranceAccepted || e.transparency.publicInsuranceExclusionStated) n += 4;
    if ((e.transparency.payerCountPublished || 0) > 0) n += 5;
    raw[slug] = n;
  }
  const best = Math.max(...Object.values(raw), 1);
  return Object.fromEntries(Object.entries(raw).map(([k, n]) => [k, Math.round((n / best) * 100)]));
}

export function fitProfile(slug, evidence, verification, centers) {
  const e = evidence[slug];
  const c = centers.find((x) => x.slug === slug);
  const v = verification[slug];
  return SITUATIONS.map((s) => {
    const verdict = s.test(e, c, v);
    return { id: s.id, label: s.label, verdict, reason: s.reason[verdict] };
  });
}

/** Which centers are the strongest options for a given situation. */
export function bestFor(situationId, evidence, verification, centers) {
  const s = SITUATIONS.find((x) => x.id === situationId);
  return centers
    .map((c) => ({ c, verdict: s.test(evidence[c.slug], c, verification[c.slug]) }))
    .sort((a, b) => RANK[b.verdict] - RANK[a.verdict])
    .filter((x) => RANK[x.verdict] >= 2);
}
