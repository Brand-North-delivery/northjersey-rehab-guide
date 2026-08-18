/**
 * The scoring algorithm.
 *
 * Turns data/evidence.json (raw yes/no facts) into data/scores.json (published
 * scores). Every point is traceable to a named fact, so any score on the site can
 * be challenged by challenging a fact rather than an opinion.
 *
 *   node score.mjs            recompute and write data/scores.json
 *   node score.mjs --explain  print the full derivation per center
 *
 * FOUR PILLARS. Weights are the only judgement calls in the system and they are
 * published verbatim on /how-we-review/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const evidence = JSON.parse(readFileSync(join(ROOT, "data/evidence.json"), "utf8"));
const centers = JSON.parse(readFileSync(join(ROOT, "data/centers.json"), "utf8"));
const verification = JSON.parse(readFileSync(join(ROOT, "data/verification.json"), "utf8"));
const TIER = verification._tiers;

export const WEIGHTS = { credentials: 0.35, continuity: 0.25, transparency: 0.25, reputation: 0.15 };

/* ---------------------------------------------------------------- pillar 1
   CREDENTIALS — third parties who inspected the place, and the state that
   licensed it. The only pillar where an outside body has actually visited. */
const CREDENTIAL_POINTS = {
  stateLicensePublished:    [8,  "State license named on site"],
  licenseNumberPublished:   [7,  "License number published (verifiable against the state register)"],
  licenseExpiryPublished:   [4,  "License expiration date published"],
  secondLicenseMentalHealth:[8,  "Separate mental health license — can admit without a substance use diagnosis"],
  carf:                     [9,  "CARF accreditation"],
  jointCommission:          [9,  "The Joint Commission accreditation"],
  legitScript:              [3,  "LegitScript certification"],
};
const MEMBERSHIP_POINT = [2, "Professional membership body"];
const CREDENTIAL_MAX = 55; // 48 flags + up to ~7 of memberships

/* Which verification key governs which credential flag. A claim is only worth
   its face value if it checks out; a claim naming the wrong regulator is worth
   nothing, because the thing it asserts is not true of this facility. */
const GOVERNED_BY = {
  stateLicensePublished: "stateLicense",
  licenseNumberPublished: "stateLicense",
  licenseExpiryPublished: "stateLicense",
  secondLicenseMentalHealth: "stateLicense",
  carf: "carf",
  jointCommission: "jointCommission",
  legitScript: "legitScript",
};

function scoreCredentials(e, v) {
  const hits = [];
  let raw = 0;
  for (const [key, [pts, label]] of Object.entries(CREDENTIAL_POINTS)) {
    if (!e.credentials[key]) continue;
    const tier = v.tiers[GOVERNED_BY[key]] || "B";
    const mult = TIER[tier].multiplier;
    const awarded = +(pts * mult).toFixed(1);
    raw += awarded;
    hits.push({
      pts: awarded,
      label: `${label}${mult === 1 ? "" : ` — tier ${tier}, ${TIER[tier].label.toLowerCase()}${mult === 0 ? ", no points" : `, ${pts} × ${mult}`}`}`,
    });
  }
  // Membership bodies are dues-paying associations, not inspections. Scored, but
  // never allowed to substitute for a credential that involves someone visiting.
  for (const m of e.credentials.memberships || []) {
    raw += MEMBERSHIP_POINT[0];
    hits.push({ pts: MEMBERSHIP_POINT[0], label: `${MEMBERSHIP_POINT[1]} (dues, not an inspection): ${m}` });
  }
  for (const f of v.flags || []) hits.push({ pts: 0, label: `FLAG — ${f}` });
  return { raw: +raw.toFixed(1), max: CREDENTIAL_MAX, pct: raw / CREDENTIAL_MAX, hits, flags: v.flags || [], note: v.note };
}

/* ---------------------------------------------------------------- pillar 2
   CONTINUITY — how much of an episode of care happens under one roof. Every
   handoff between providers is a point where people fall out of treatment, and
   detox is the handoff that fails most often. Referral-only detox is scored as
   a real capability but a discounted one, not as equivalent to on-site. */
const CONTINUITY_POINTS = {
  detoxOnSite:      [12, "Medical detox on site"],
  residential:      [9,  "Residential level"],
  partialCare:      [7,  "Partial care"],
  iop:              [7,  "Intensive outpatient"],
  eveningIop:       [5,  "Evening IOP — treatment without leaving work"],
  outpatient:       [5,  "Outpatient"],
  telehealth:       [3,  "Telehealth delivery"],
  soberLivingOnSite:[4,  "Sober living attached"],
  alumniProgram:    [4,  "Alumni program"],
  caseManagement:   [4,  "Case management"],
  familyProgram:    [3,  "Family program"],
};
const REFERRAL_DETOX = [4, "Detox by referral to a partner (discounted — clinical responsibility changes hands)"];
const CONTINUITY_MAX = 63;

function scoreContinuity(e) {
  const hits = [];
  let raw = 0;
  for (const [key, [pts, label]] of Object.entries(CONTINUITY_POINTS)) {
    if (e.continuity[key]) { raw += pts; hits.push({ pts, label }); }
  }
  if (!e.continuity.detoxOnSite && e.continuity.detoxByReferral) {
    raw += REFERRAL_DETOX[0];
    hits.push({ pts: REFERRAL_DETOX[0], label: REFERRAL_DETOX[1] });
  }
  return { raw, max: CONTINUITY_MAX, pct: raw / CONTINUITY_MAX, hits };
}

/* ---------------------------------------------------------------- pillar 3
   TRANSPARENCY — what a family can check at 11pm before calling anyone.
   Stating what you do NOT offer scores here: it is the single most useful and
   least common thing a treatment website does. */
const TRANSPARENCY_POINTS = {
  scheduleTimesPublished:          [9, "Actual program times published, not just program names"],
  levelsNotOfferedStated:          [8, "States which levels of care it does NOT offer"],
  namedClinicalStaff:              [6, "Clinical staff named with credentials"],
  specialtyTracksNamed:            [4, "Specialty tracks named specifically"],
  selfPayRatePublished:            [7, "Self-pay rate published"],
  medicationsNamed:                [4, "Specific medications named"],
  publicInsuranceAccepted:         [3, "Public insurance position stated (accepts)"],
  publicInsuranceExclusionStated:  [3, "Public insurance position stated (excludes)"],
  separateMentalHealthTrackStated: [3, "Mental health track stated separately"],
};
const PAYER_LIST_MAX = 6;
const THIN_LOCATION_PENALTY = [-4, "Location-level detail thinner than company-wide pages"];
const TRANSPARENCY_MAX = 53;

function scoreTransparency(e) {
  const hits = [];
  let raw = 0;
  for (const [key, [pts, label]] of Object.entries(TRANSPARENCY_POINTS)) {
    if (e.transparency[key]) { raw += pts; hits.push({ pts, label }); }
  }
  const n = e.transparency.payerCountPublished || 0;
  if (n > 0) {
    const pts = Math.min(PAYER_LIST_MAX, Math.round((n / 20) * PAYER_LIST_MAX));
    raw += pts;
    hits.push({ pts, label: `Named payer list published (${n} payers)` });
  }
  if (e.transparency.locationLevelDetailThin) {
    raw += THIN_LOCATION_PENALTY[0];
    hits.push({ pts: THIN_LOCATION_PENALTY[0], label: THIN_LOCATION_PENALTY[1] });
  }
  return { raw, max: TRANSPARENCY_MAX, pct: Math.max(0, raw / TRANSPARENCY_MAX), hits };
}

/* ---------------------------------------------------------------- pillar 4
   REPUTATION — review signal. Deliberately the smallest weight: ratings in this
   industry are heavily gamed, and volume correlates with marketing spend rather
   than care quality.

   The text component does NOT score sentiment. It scores whether specific,
   checkable THEMES appear, because "they saved my life" is unfalsifiable while
   "I was billed for an out-of-network detox" is a fact a reader can act on.
   Negative billing and staffing themes carry more weight than positive ones:
   a consistent complaint is more informative than a consistent compliment.

   Runs only when reputation data is present. Absent data does not penalise a
   center — the pillar is dropped and the remaining three are renormalised, so a
   center is never punished for our missing inputs. */
export const THEMES = {
  billingSurprise:   { weight: -9, label: "Unexpected bills or out-of-network surprises" },
  staffTurnover:     { weight: -6, label: "Staff turnover or understaffing" },
  admissionsPressure:{ weight: -7, label: "High-pressure admissions or sales tactics" },
  dischargeAbrupt:   { weight: -6, label: "Abrupt or unplanned discharge" },
  facilityCondition: { weight: -3, label: "Facility condition problems" },
  clinicalSubstance: { weight:  6, label: "Specific clinical content described" },
  aftercareReal:     { weight:  5, label: "Aftercare actually delivered" },
  staffNamedPositive:{ weight:  4, label: "Individual clinicians named positively" },
  familyIncluded:    { weight:  3, label: "Family genuinely involved" },
};

function scoreReputation(rep) {
  if (!rep) return null;
  const hits = [];
  // rating component, 0..1, anchored so 3.0 = 0 and 5.0 = 1
  const ratingPct = Math.max(0, Math.min(1, (rep.rating - 3.0) / 2.0));
  // volume confidence: log-scaled, saturating around 200 reviews
  const confidence = Math.min(1, Math.log10(Math.max(1, rep.count)) / Math.log10(200));
  hits.push({ pts: +(ratingPct * 100).toFixed(0), label: `Rating ${rep.rating} across ${rep.count} reviews (confidence ${(confidence * 100).toFixed(0)}%)` });

  // theme component: share of reviews mentioning each theme, times its weight
  let themeAdj = 0;
  for (const [key, share] of Object.entries(rep.themes || {})) {
    const t = THEMES[key];
    if (!t) continue;
    const contribution = t.weight * share;
    themeAdj += contribution;
    hits.push({ pts: +contribution.toFixed(1), label: `${t.label} — ${(share * 100).toFixed(0)}% of reviews` });
  }
  // themeAdj lands roughly in -20..+18; map to a +/- 0.25 swing on the pillar
  const themePct = Math.max(-0.25, Math.min(0.25, themeAdj / 72));
  const pct = Math.max(0, Math.min(1, ratingPct * confidence + themePct));
  return { raw: +(pct * 100).toFixed(1), max: 100, pct, hits, confidence };
}

/* ------------------------------------------------------------------ compose */

export function scoreCenter(slug) {
  const e = evidence[slug];
  const pillars = {
    credentials: scoreCredentials(e, verification[slug] || { tiers: {}, flags: [] }),
    continuity: scoreContinuity(e),
    transparency: scoreTransparency(e),
    reputation: scoreReputation(e.reputation),
  };

  // renormalise over the pillars we actually have data for
  const active = Object.entries(WEIGHTS).filter(([k]) => pillars[k] !== null);
  const totalWeight = active.reduce((s, [, w]) => s + w, 0);
  const composite = active.reduce((s, [k, w]) => s + pillars[k].pct * (w / totalWeight), 0);

  return {
    slug,
    pillars,
    weightsUsed: Object.fromEntries(active.map(([k, w]) => [k, +(w / totalWeight).toFixed(3)])),
    reputationPending: pillars.reputation === null,
    composite: +composite.toFixed(4),
    outOfFive: +(composite * 5).toFixed(1),
  };
}

const results = centers.map((c) => scoreCenter(c.slug));

// rank by composite, tie-break on credentials
results.sort((a, b) => b.composite - a.composite || b.pillars.credentials.pct - a.pillars.credentials.pct);
results.forEach((r, i) => { r.rank = String(i + 1).padStart(2, "0"); });

if (process.argv.includes("--explain")) {
  for (const r of results) {
    const name = centers.find((c) => c.slug === r.slug).name.replace(/&mdash;/g, "—");
    console.log(`\n${r.rank}  ${name}  →  ${r.outOfFive}/5  (composite ${(r.composite * 100).toFixed(1)}%)`);
    if (r.reputationPending) console.log(`    reputation pillar: NO DATA — weights renormalised over the other three`);
    for (const [pillar, p] of Object.entries(r.pillars)) {
      if (!p) continue;
      console.log(`    ${pillar.padEnd(13)} ${String(p.raw).padStart(5)}/${p.max}  ${(p.pct * 100).toFixed(0).padStart(3)}%  × ${r.weightsUsed[pillar]}`);
      for (const h of p.hits) console.log(`        ${h.pts > 0 ? "+" : ""}${h.pts}  ${h.label}`);
    }
  }
  console.log();
} else {
  writeFileSync(join(ROOT, "data/scores.json"), JSON.stringify(results, null, 2), "utf8");
  console.log(`Scored ${results.length} centers → data/scores.json`);
  for (const r of results) {
    const name = centers.find((c) => c.slug === r.slug).name.replace(/&mdash;/g, "—");
    console.log(`  ${r.rank}  ${String(r.outOfFive).padEnd(4)} ${name}${r.reputationPending ? "   (reputation pending)" : ""}`);
  }
}
