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

## D1 — shipped with this audit

`packages/engine/src/demographics.ts` (yearlyDemographics, partneringFunnel,
fertilityCohort, populationAt) + tests (demographics.test.ts: rows reconcile
births−deaths = Δpopulation exactly; funnel partitions adults; measuring
changes no byte) + the 📊 Demographics panel on the observer dashboard
(App.tsx). Read-side only; golden untouched.
