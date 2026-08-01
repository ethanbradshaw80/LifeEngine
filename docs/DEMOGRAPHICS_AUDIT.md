# Demographics Audit — why the town is dying

**Status: measured, 2026-08-01.** Owner question: why does ~100 people only
reach ~190 over multiple generations? Measured answer: it doesn't. **~190 is
the all-time count including the dead. The LIVING population declines from
~100 to 18–41 within 150 years on every seed tried.** The town is not
growing slowly; it is going extinct. The M5 fix ("births require a real
partnership") repaired the mechanism and left the rate terminal.

All numbers below from `yearlyDemographics` / `partneringFunnel` /
`fertilityCohort` (packages/engine/src/demographics.ts, D1 — read-side,
golden-safe), 150-year runs, seeds 12345 / 777 / 4242.

## The measurements

| Seed | Pop 1970 | Pop 2050 | Pop 2120 | Births last 30y | Deaths last 30y |
|---|---|---|---|---|---|
| 12345 | 98 | 61 | 18 | 6 | 19 |
| 777 | 98 | 55 | 19 | 6 | 22 |
| 4242 | 98 | 56 | 41 | 10 | 16 |

Completed-fertility cohort (women whose whole 20–42 window lay INSIDE
recorded history — the architecture review caught a first-draft instrument
that also counted founder women whose children predate the record; these
are the corrected numbers):

| Seed | Women | Children | Per woman | Childless | Median age at marriage |
|---|---|---|---|---|---|
| 12345 | 52 | 67 | **1.29** | 24 (46%) | 44 |
| 777 | 42 | 58 | **1.38** | 16 (38%) | 42 |
| 4242 | 49 | 82 | **1.67** | 16 (33%) | 38 |

Replacement needs ≈ 2.1. The town runs at two-thirds of that at best, and
the population rows above — which never depended on the cohort instrument —
show where that ends.

## The causes, in funnel order

1. **Courtship starvation — the dominant cause.** Whole-town courtships run
   ~1–2 per DECADE (weddings 3–4 per 30 years). Pairing today is entirely
   passive: a friendship must form by proximity rolls, drift above strength
   480, survive `couldCourt` (both single, opposite sex, ≤12 years apart),
   and then win a monthly compatibility draw (relationships.ts:358-391).
   Nobody in the model ever LOOKS for a partner. Real towns pair because
   single people seek — the sim has no seeking.
2. **Marriage far too late.** Median marriage at 38–44 against a fertility
   window ending at 42 (systems.ts:925: the base rate also decays 12/yr
   after 34). The couples that do form burn the window courting
   (strength 540 + 14 months + income gate) and cohabiting late — births
   additionally require sharing a roof (systems.ts:902-904).
3. **A third to a half of women never build a family** → 33–46% childless
   among completed cohorts. Not a fertility problem; a meeting problem
   (see 1).
4. **No remarriage.** 1–4 remarriages per 150 years despite a standing pool
   of widowed/divorced (funnel `formerlyPartneredAlone` 1–3 at any moment,
   many more across the years). The bereaved simply exit the pool: their old
   friendships are decayed, and no new-pairing pressure exists.
5. **Mortality is NOT the problem.** Deaths run at believable ages; the town
   dies from empty cradles, not full graves. Do not touch mortality.

## D2 — the fix, decision-driven (no artificial birth boosts)

Owner constraint honored: no birth-rate multiplier anywhere. Every fix is a
modelled life decision that produces records (Law 3) and player choice
moments (the P-arc reads these same moments):

1. **Partner-seeking intent.** Single adults 18–45 (and the formerly
   partnered after a modelled mourning/recovery period) gain a
   family-intent disposition (traits + age pressure + circumstance).
   Intent drives MEETING moments — introductions, socials, church, the
   dance at the grange hall — that create acquaintance edges with
   courtship potential, at need-driven rates instead of pure proximity
   luck. Each meeting is an event; each courtship still passes the
   existing compatibility machinery (selection stays picky; the FLOW
   rises). Player: meeting moments become choices (P-arc court verb).
2. **Marriage timing.** Family intent accelerates courtship→wedding
   conversion (appetite pressure grows with courtship length and the
   fertility window); the 14-month floor and income factor stay. Target:
   median first marriage 22–27, 1970s-small-town plausible.
3. **Family-size intention.** At marriage the couple decides a family-size
   aspiration (2–5; traits, finances, housing) recorded as a decision;
   monthly conception hazard persists while under-target and window-open;
   stopping early under hardship is itself a recorded decision. The
   biological hazard shape stays — intention replaces the flat
   children-at-home penalty as the reason families end.
4. **Remarriage.** The recovery period ends into seeking (1); a remarriage
   is a first-class wedding with its own records. Widowhood stops being a
   demographic exit.
5. **Household unblocking.** Verify cohabitation follows courtship fast
   enough that the window isn't spent waiting on `moveInWithPartner`
   (systems.ts:651) — measure, then tune.

**Tuning targets (measured against D1, 3 seeds × 150 years):** stable to
gently growing population; completed fertility 2.1–2.6; childless 10–20%;
median age at first marriage 22–27; remarriage a normal event. Every change
tunes toward these MEASURED targets — the audit runner pattern
(demographics.audit.test.ts, deleted after this audit; recreate at D2) is
the loop.

**Mechanics:** SIMULATION_VERSION bump, golden change, new Stream if new
draw sites (append-only), twin-world tests for any player-interceptable
moment, architecture-reviewer (relationship graph + core person state per
CLAUDE.md §10). Schema: family-intent/aspiration fields on people or
couples — schema bump with honest empty migration.

## D2 — SHIPPED (2026-08-01, SIMULATION_VERSION 23, schema v17)

Implemented per §D2 above, tuned over eight measured iterations and one
architecture-review round (two must-fixes and seven should-fixes, all
applied — see the review notes below). Final numbers (150y × 3 seeds):
population 99 → 124 / 186 / 132, all gently growing; completed fertility
2.02 / 2.46 / 2.36 (mean 2.28); childless 18% / 3% / 6% (mean ~9%);
median age at FIRST marriage 22 / 21 / 22 (the earlier draft instrument
conflated remarriages and read 23-25); remarriages 39-47; nobody leaves
home more than once. HONEST CALIBRATION NOTE: the population target — the
point of D2 — holds on every seed; fertility and childlessness hold in
the cross-seed mean, with per-seed spread that is binomial noise at
~100 women per cohort (the same model produced 3/103 and 15/84 childless
on different seeds). Tuning individual seeds into every band
simultaneously would be overfitting three seeds; the d2.test.ts bands are
set to catch regressions, not noise.

What the tuning loop TAUGHT, beyond the spec (each was a measured wall):

1. **The courting-decay trap.** Courting couples living apart decayed 4
   strength/month with no offset, slid under the marriage bar, and — since
   courtships have no ending path — lingered courting forever, locking
   both partners out of everything. Fix: courtship is TENDED (+9/month).
   The measured medMarriage 38-44 was mostly this.
2. **The still-at-home sterilization.** birthEligible refused births to
   anyone living with her parents, and moveInWithPartner routinely merges
   newlyweds into a parental household — those couples were permanently
   childless. Married couples under a parental roof now conceive;
   courting couples still do not.
3. **Arrears over-blocking.** A first draft made any arrears month a full
   conception stop — measured childlessness ~50%. Poor families had
   children; arrears now halves the hazard instead, and only DEEP arrears
   shrinks the plan (once, recorded).
4. **The aspiration floor.** Flooring hoped-for children at 2 exploded the
   town (fertility 3.2, pop 500+ by 2080). Families of one are families;
   the draw now spans 1-5, mean ≈ 2.45.
5. **Latent fertility, added to the spec.** With everyone pairing young,
   childlessness fell to 1-2% — falsely rosy. ~5.5% of women never
   conceive and ~6.5% conceive slowly (÷7), drawn from a constant-keyed
   stream (same woman, same answer, forever). This is where the childless
   marriages a real town had come from — modelled circumstance, not a
   rate lever.
6. **MAX_AGE_GAP 12 → 16.** Thin cohorts in a ~60-person town otherwise
   locked out entirely.

Cost recorded honestly: growing populations make century-scale tests much
slower under the O(n²) friendship loop — vitest timeouts raised 60s→300s,
full suite ~7.5 minutes. The cohort-index fix (queued since M3) is now
URGENT, promoted to the head of the technical queue.

## D1 — shipped with this audit

`packages/engine/src/demographics.ts` (yearlyDemographics, partneringFunnel,
fertilityCohort, populationAt) + tests (demographics.test.ts: rows reconcile
births−deaths = Δpopulation exactly; funnel partitions adults; measuring
changes no byte) + the 📊 Demographics panel on the observer dashboard
(App.tsx). Read-side only; golden untouched.
