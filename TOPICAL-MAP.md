# Topical Map — Bergen County Recovers

**Domain:** bergencountydrugrehabs.com
**Central entity:** Bergen County, New Jersey × addiction and mental health treatment
**Date:** 19 August 2026
**Evidence base:** `data/bergen.json` — NJ DMHAS Substance Use Overview 2024 (published January 2026) and Bergen County Prosecutor's Office opioid response data 2017–2025

---

## The five components

**Source context.** A comparison guide for people choosing addiction or mental health treatment in Bergen County, built on published evidence rather than provider marketing, with a disclosed editor's choice.

**Central entity.** Bergen County × treatment. Not "North Jersey" — the county is the unit that actually has data behind it. NJ DMHAS reports by county, the Prosecutor's Office reports by county, and the recovery court, hotline and fatality review team are all county programs. Every one of those is a citable fact that a state-level or region-level site cannot carry.

**Central search intent.** Find treatment in or near Bergen County, understand what it costs and who pays, and work out whether a given center can actually take you.

**Core section.** The six centers, the comparison matrix, and the payer question.

**Outer section.** County data, county programs, the towns, and the decision guidance.

---

## The three findings the map is built on

These come from the evidence base and none of them appears on a competing local site.

**1. Most Bergen residents leave the county for treatment.** 1,345 of 2,890 CY2024 admissions were treated in the county of residence — 47%. Passaic received 422, Monmouth 243, Essex 174. A guide that only lists Bergen addresses is describing where a minority of people actually go.

**2. Medicaid is the largest payer, and almost nobody in the private market takes it.** 1,767 of 2,890 admissions (61%) reported Medicaid; another 656 (23%) reported no insurance. Of the six centers in the guide, one states it accepts Medicaid. The population entering treatment and the population these centers advertise to are not the same population.

**3. Alcohol is half of all admissions.** 1,433 (50%), against 588 for heroin (20%). Local coverage is opioid-weighted; the admissions data is not.

---

## Core section

| # | URL | Title | Macro context | Pri |
|---|---|---|---|---|
| 1 | `/` | Bergen County Drug Rehabs: Compared on Published Evidence | The six centers ranked | 1 |
| 2 | `/{center}/` × 6 | [Center] Review — [Town], Bergen County | One center each | 1 |
| 3 | `/compare/` | All Six Bergen County Centers, Side by Side | The full matrix | 1 |
| 4 | `/how-we-review/` | How We Review Bergen County Treatment Centers | Methodology | 1 |
| 5 | `/medicaid/` | Which Bergen County Rehabs Accept Medicaid? | The payer gap | **1** |
| 6 | `/cost/` | What Treatment Costs in Bergen County | Price and coverage | 2 |
| 7 | `/detox/` | Where to Detox in and Around Bergen County | On-site vs referral | 1 |
| 8 | `/mental-health/` | Mental Health Treatment in Bergen County Without a Substance Use Diagnosis | Standalone MH licence | 1 |

Page 5 is the highest-value new page on this map. It answers the question 61% of the actual treatment population has, and the honest answer names one center out of six and then points outward to county resources. That is exactly the kind of page that earns trust and links.

---

## Outer section — county evidence

| # | URL | Title | Carries | Pri |
|---|---|---|---|---|
| 9 | `/bergen-county-addiction-statistics/` | Bergen County Addiction Statistics 2024 | The full DMHAS table | 1 |
| 10 | `/bergen-county-overdose-data/` | Bergen County Overdose Deaths and Narcan Saves, 2017–2025 | The BCPO nine-year series | 1 |
| 11 | `/where-bergen-residents-get-treatment/` | Where Bergen County Residents Actually Get Treatment | The 53% finding | 1 |
| 12 | `/bergen-county-recovery-court/` | Bergen County Recovery Court: How Diversion Works | Fair Lawn 2018 → countywide 2023 | 2 |
| 13 | `/bergen-county-hotline/` | The Bergen County 24/7 Addiction Hotline | (201) 589-2976, #StoptheODs | 1 |
| 14 | `/narcan-in-bergen-county/` | Getting and Using Narcan in Bergen County | LE carry since 2014 | 2 |
| 15 | `/operation-helping-hand/` | Operation Helping Hand and County Outreach | County programs | 3 |

Pages 9 and 10 are quality nodes. They are the only pages on the site that nobody else can copy without doing the same work, and they are what a journalist or a county agency would link to.

---

## Outer section — geography

Bergen County has 70 municipalities. Do not build 70 pages. Build the towns where a center sits plus the largest population centers, and only where the page can carry something specific.

| # | URL | Anchor |
|---|---|---|
| 16 | `/norwood/` | Valley Spring |
| 17 | `/fair-lawn/` | ChoicePoint, North Jersey Recovery Center, and the recovery court pilot |
| 18 | `/saddle-brook/` | IKON |
| 19 | `/englewood/` | Boca |
| 20 | `/hackensack/` | County seat, largest city, no listed center |
| 21 | `/paramus/` | Largest retail and commuter hub |
| 22 | `/passaic-county-from-bergen/` | Where 422 Bergen residents actually went |

Page 22 is the unusual one and it is the honest one: a Bergen guide that tells you the second-largest destination for Bergen residents is the next county over.

---

## Outer section — the care compass

Already built: 10 categories × 10 questions. Re-anchor each category intro to Bergen data — the alcohol category opens on 50% of admissions, the insurance category on the Medicaid gap, the aftercare category on the 35% readmission rate.

---

## Semantic integration of the entity

"Bergen County" is the central entity and it must appear as a fact-carrier, not a keyword.

- **Every center page** states the town and that the town is in Bergen County, and gives the distance to the county seat.
- **Every statistic** is labelled Bergen County and dated, with the source named inline.
- **The comparison table** gains a county column, which is where BlueCrest's Passaic address becomes visible rather than hidden.
- **The compass** cites county programs by name, with the county hotline in the crisis banner alongside 988.
- **Schema:** every center is `LocalBusiness` with `addressRegion: NJ` and `addressLocality` set to the real town; the guide itself carries `areaServed` as Bergen County with its 70 municipalities available as a list rather than asserted in prose.
- **EntityMap:** Bergen County is its own entity with the DMHAS and BCPO figures as sourced chunks, related to every center by `areaServed` and to every town by `containedInPlace`.

---

## Scope decision required

**BlueCrest Recovery Center is in Woodland Park, Passaic County.** Under a Bergen County brand there are three options:

1. Keep it, labelled clearly as Passaic, because it is the only center in the set with in-house detox and residential and Bergen residents genuinely use it — 422 went to Passaic in 2024. This is the option the data supports.
2. Drop it, and the guide loses its only full continuum.
3. Keep it and add a second Passaic option, making "and the border" explicit in the scope statement.

Recommend option 1, with the county named on every appearance.

---

## Build order

**Wave 1 — rebrand and the payer gap.** Rename to Bergen County Recovers on bergencountydrugrehabs.com, add the county column, and ship pages 5, 9, 10, 11, 13. This is the wave that makes the site Bergen-specific rather than renamed.

**Wave 2 — the rest of the core.** Pages 6, 7, 8, plus compass intros re-anchored to county data.

**Wave 3 — geography.** Pages 16–22, each carrying something specific.

**Wave 4 — county programs.** Pages 12, 14, 15.

---

## What this map deliberately does not do

It does not build a page per municipality. Seventy near-identical town pages on a YMYL domain is the exact pattern that gets a site classified as thin, and the DMHAS data is not published at municipal level, so 64 of those pages would have nothing verifiable to say. The county is the unit that has evidence behind it, and the map stops where the evidence stops.
