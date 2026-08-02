# Risk Register

Scoring: **Likelihood** and **Impact** each Low / Medium / High.
**Priority** = the combination, judged rather than computed.

Reviewed at every milestone exit.

---

## Critical — these can end the project

### R-01 · Scope explosion
**Likelihood: High · Impact: High**

Fourteen major domains, each individually a substantial project. The design documents
describe a game far larger than one person can build. The pressure to add "just one
more system" is constant and feels productive.

*Mitigation.* Strict layering. The Three Gates. Binding out-of-scope lists in every
milestone. Changing a milestone's scope requires an ADR — deliberate friction, applied
on purpose.

*Warning sign.* A milestone's scope grows after it starts.

---

### R-02 · Insufficient development resources
**Likelihood: High · Impact: High**

One person, ~10 hours a week, still learning to code, against a five-layer vision.
Layer 4 alone is larger than Layers 1–3 combined.

*Mitigation.* Every layer is a satisfying place to stop. `MILESTONE_PLAN.md` states
plainly that Layer 4 is likely out of reach solo. Success is defined at Layer 3, not
Layer 5.

*Not mitigated by.* Working faster, or estimating more optimistically.

---

### R-18 · Motivation decay before anything is visible
**Likelihood: Medium *(was High)* · Impact: High**

Solo projects die from lost interest far more often than from technical failure.

*Downgraded by ADR-0012.* The previous plan deferred all UI to Milestone 5 —
plausibly six months of console output. The web pivot made a visible interface cheap,
so it moved to **Milestone 2**, immediately after the first working tick. Watching a
simulated person age in a browser after roughly two months is a fundamentally different
experience from six months of text.

*Remaining mitigation.* `PROJECT_CHARTER.md` §6 keeps "is this life story interesting
to read?" as the primary success test. Milestone 1 must still produce readable life
stories, not raw data dumps.

*Escape hatch.* If motivation is failing, reorder the plan — including pulling military
content forward. Rework is a real cost, but an abandoned project costs everything. This
is explicitly permitted, not a failure.

---

### R-21 · User data breach
**Likelihood: Medium · Impact: High**
*Introduced by the web pivot (ADR-0009, ADR-0010). Dormant until Milestone 6.*

Accounts mean credentials, email addresses, and personal save data on a server. A
breach harms real people and is not recoverable by reverting a commit. The developer is
explicitly still learning, and security is the one area where a learner cannot reliably
self-review.

*Mitigation.* Never write custom authentication — use a maintained provider
(`MILESTONE_PLAN.md` M6). Mandatory `web-security-reviewer` pass (ADR-0014). Secrets
excluded by `.gitignore` as a safety net, never as the strategy. Store the minimum data
that works. Milestones 0–5 have **no server and no user data at all**, which removes
this risk entirely for the first year of work.

*Why Critical-adjacent but rated High.* Likelihood is genuinely reducible by using
managed services. Impact is not reducible at all.

---

## High

### R-03 · Tick cost and browser memory
**Likelihood: Medium · Impact: High**

If a monthly tick is slow, advancing a year is tedious and the game is unpleasant
regardless of how good the simulation is.

*~~Assumed at the web pivot: memory, not CPU, is the binding constraint, because a
browser tab has less headroom than a desktop process.~~* Kept visible because the
correction below is the point — this was reasoned from first principles and was
wrong, which is why Milestone 3 exists.

*MEASURED at Milestone 3.* Memory is not the
binding constraint at these sizes — 10,000 people fit in ~20 MB and the whole
page measured 11 MB in a browser. **CPU is**, and specifically one algorithm:
friendship formation is O(n²) in population, so ten times the people costs ~66×
the time per tick. At 10,000 people a tick takes 210 ms against a ~100 ms budget.

*Still true from the old framing.* A tab that exhausts memory is killed without
warning, so autosave matters. Memory is simply not what runs out first.

*Current standing.* At the shipped scale of ~100 people the game is comfortably
fast (0.27 ms per tick; five years advances in 14 ms in a real browser). The risk
is real but not yet biting.

*Mitigation.* Simulation tiers, with most of the population as aggregate
statistics rather than objects — now justified by measurement rather than
expectation. A tick-time budget. Web Worker at Milestone 4. The O(n²) lookup
needs an index or the tier system before Light-tier populations are attempted;
`performance-reviewer` exists to catch the next one.

---

### R-06 · NPC continuity breaks across tiers
**Likelihood: Medium · Impact: High**

Promotion synthesizing history that contradicts what was retained. Players notice this
immediately and it destroys belief in the world.

*Mitigation.* `SIMULATION_LEVELS.md` §3 fixes invariant state at every tier and §6
makes non-contradiction a hard requirement. Synthesized detail is flagged as such.

---

### R-09 · Circular dependencies between domains
**Likelihood: Medium · Impact: High**

Everything genuinely does connect to everything (Law 4). Without discipline the
dependency graph becomes a knot that cannot be tested or reasoned about.

*Mitigation.* `DOMAIN_MAP.md` §4 — layered dependency direction, no synchronous query
cycles, an automated dependency test once code exists.

---

### R-16 · Long-term migration burden
**Likelihood: High · Impact: Medium**

Every schema change needs a migration, and they accumulate forever. Skipping one
breaks old saves permanently.

*Mitigation.* Migration infrastructure from Milestone 4, before there are real saves to
break. Migration tests run in CI against a committed old save. A version header — and
the `userId` field — exist from the very first save ever written.

---

### R-13 · Sensitive-topic representation
**Likelihood: Medium · Impact: High**

The design includes war, casualties, death, mental illness, disability, addiction,
crime, incarceration, poverty, and inequality. Handled carelessly these become
offensive, stereotyped, or trivializing — and the damage is reputational and hard to
undo.

*Mitigation.* Law 10 sets the constraint. Every design document touching these areas
must apply it concretely rather than cite it. Outcomes derive from modelled
circumstances, never from group membership.

*Specific rule.* No trait, probability, or outcome may be keyed to race, ethnicity,
religion, or national origin. Model circumstances — geography, income, education,
family, health, opportunity — and let outcomes follow from those.

---

### R-14 · War and casualty representation
**Likelihood: Medium · Impact: High**

Character death in service must be meaningful, not a slot machine. Real conflicts and
real units carry both factual and ethical hazards.

*Mitigation.* All geopolitics **generated** — never scripted, never modelled on a
real conflict, never carrying a real war's name (amended 2026-08-02, ADR-0021; the
rule was "fictional and generated" until a preset was allowed real countries). Real
COUNTRIES are a preset's choice; a real WAR is nobody's.
Casualties require traceable causal records — never an unexplained hidden roll.
Service portrayed as neither purely glorious nor purely harmful. See
`MILITARY_AND_WAR_FOUNDATION.md`.

---

## Medium

### R-04 · Save-file growth
**Likelihood: High · Impact: Medium**

Unlimited generations of persistent history. Saves grow without bound unless
compression is deliberate.

*Mitigation.* Causal-record compression tiers. Historical summarization (Law 6).
Measured at Milestone 3. Because saves store seed + version + decisions, full state is
in principle recoverable by replay — a useful backstop.

---

### R-05 · Causal-record growth
**Likelihood: High · Impact: Medium**

Law 3 requires explanations; naive implementation stores unbounded reasoning.

*Mitigation.* `CAUSAL_RECORDS.md` §4 significance tiers with one-way lossy compression.
Only Deep tier produces full records. Measured at Milestone 3.

---

### R-07 · Emergent-system instability
**Likelihood: Medium · Impact: Medium**

Interconnected systems (Law 4) produce feedback loops. Runaway inflation, universal
divorce, population collapse — all plausible.

*Mitigation.* Determinism makes these reproducible and therefore debuggable, which is
most of the fight. Long-run stability tests: simulate 200 years and assert population,
employment, and wealth stay within plausible bands.

---

### R-10 · Testing explosion
**Likelihood: Medium · Impact: Medium**

A system where everything connects has combinatorially many interactions. Testing all
of them is impossible; testing none is worse.

*Mitigation.* Test at domain boundaries, not across every combination. Golden-seed
tests catch broad regressions cheaply. Property-based tests for invariants ("nobody is
employed before the minimum age") over exhaustive case enumeration.

---

### R-17 · AI-generated code inconsistency
**Likelihood: Medium · Impact: Medium**

Code written across many AI sessions drifts in style, duplicates logic, and quietly
violates architecture rules — especially when the human reviewer is still learning and
cannot always tell.

*Mitigation.* `CLAUDE.md` as durable constitution. `CLAUDE_RULES.md` as the practical
checklist. Independent review agents. Small, reviewable diffs. Determinism tests catch
a large class of silent behavioural drift automatically, which matters most precisely
when the reviewer is unsure.

---

### R-08 · Memory growth
**Likelihood: Medium · Impact: Medium**

Thousands of simulated people with histories, held in memory.

*Mitigation.* Tiering. Measured at Milestone 3. Aggregate tier stores no individuals
at all, which is where most of the leverage is.

---

### R-11 · UI information overload
**Likelihood: Medium · Impact: Medium**

The engine will know vastly more than a player can absorb. Exposing it produces a
spreadsheet, not a game.

*Mitigation.* Law 9. Progressive disclosure, summaries, on-demand "Why?" rather than
always-on detail. Deferred to Milestone 5 — not a current concern.

---

### R-12 · Legal and IP concerns
**Likelihood: Low · Impact: High**

Real brands, insignia, unit designations, or people create trademark, publicity-rights,
and IP exposure.

*Mitigation.* All entities fictional (`PROJECT_CHARTER.md` §5). Original artwork only.
Real geography is used, which is far lower risk than real names — but this should be
verified with a real source before any commercial release, not assumed from this
document.

---

### R-15 · Content repetition
**Likelihood: Medium · Impact: Medium**

Procedural lives start to feel samey after several generations, which is precisely
when a generational game most needs to hold interest.

*Mitigation.* Believability over balance (Law 10) — unequal starting circumstances
create variety for free. Deep causal modelling produces more variation than templated
events. Honest note: this is the risk hardest to mitigate through architecture, and it
is the one most likely to determine whether the finished game is actually fun.

---

## Low

### R-24 · Support and community burden consumes development time
**Likelihood: High · Impact: Medium**
*Introduced by `PRODUCT_ROADMAP.md`. Dormant until closed alpha.*

Discord, feedback channels, and player support are permanent obligations, not features.
They compete directly with the ~10 hours a week allocated to building — and unlike
development, they arrive on other people's schedules. This is a plausible route to
R-02 (insufficient resources) becoming acute.

*Mitigation.* Prefer an in-app feedback form and a public changelog over a Discord until
there is a community to serve. Set written expectations about response times. Treat
community as a decision with a cost, not a default.

*Warning sign.* A week where all available hours went to answering messages.

---

### R-25 · Breaking saves after real players exist
**Likelihood: Medium · Impact: High**
*Introduced by `PRODUCT_ROADMAP.md` §8. Dormant until closed alpha.*

Before players, breaking the save format costs nothing. After closed beta, it costs 250
people their progress, and most do not come back. The ratchet tightens at every stage
and never loosens.

*Mitigation.* Migration infrastructure at M4, before accounts at M6 — the ordering is
deliberate. From closed alpha onward, every schema change ships with a migration tested
against a **real** save exported from the prior stage, not a fixture. Alpha players are
told in writing that saves may be reset; beta players are not told that, and so it must
not happen.

*Relationship to R-16.* R-16 is the engineering burden of maintaining migrations. R-25
is the consequence of getting one wrong once players exist.

---

### R-26 · Monetization creates obligations that outlast interest
**Likelihood: Low · Impact: Medium**
*Introduced by ADR-0015. Fully avoidable — this risk only exists if subscription is chosen.*

A subscription creates payment processing, refunds, jurisdiction-dependent tax
obligations, and a standing commitment to keep the service running while people pay.
On a solo hobby project, that commitment can outlive enthusiasm for it — and shutting
down a paid service is materially worse than shutting down a free one.

*Mitigation.* ADR-0015 defers the decision to public beta, with real cost data. One-time
purchase and free-with-optional-support carry far lighter obligations. If a subscription
is chosen, decide in advance what happens if the project ends.

---

### R-22 · Hosting cost and provider dependency
**Likelihood: Medium · Impact: Medium**
*Introduced by the web pivot. Dormant until Milestone 6.*

A web application with accounts has a bill that never stops, and it grows with users. A
hobby project with no revenue can become an unwelcome monthly expense. Free tiers get
withdrawn, providers change pricing, and services shut down.

*Mitigation.* ADR-0010 puts simulation in the browser, so hosting cost stays near-flat
rather than scaling with active players — this is most of the mitigation and it is
structural. Prefer providers with data export. Avoid building on any feature that
cannot be replaced. **Verify current pricing and terms before committing** rather than
trusting any documented figure, including in these documents.

*Warning sign.* An architecture choice justified by one provider's specific free tier.

---

### R-23 · TypeScript types vanish at runtime
**Likelihood: Medium · Impact: Medium**
*Introduced by ADR-0009.*

TypeScript checks at compile time only. A save file loaded from IndexedDB or a server
is untyped data at runtime — a `as SaveFile` cast asserts nothing and will happily
accept corrupt or malicious input.

*Mitigation.* Strict mode from Milestone 0. **Every boundary validates with an explicit
runtime schema check, never a cast.** Boundaries are: save load, worker messages, and
(from M6) every network response. Checksums for corruption detection. Milestone 4
requires a corrupted save to be refused rather than loaded.

---

### R-19 · Unrealistic expectations about population scale
**Likelihood: Low · Impact: Medium**

Named explicitly in the bootstrap. Expecting to individually simulate a whole country.

*Mitigation.* The tier system exists specifically for this. Documented as a hard
constraint rather than a target to grow into. Downgraded to Low likelihood because it
is now designed for rather than assumed away.

---

### R-20 · Determinism silently broken
**Likelihood: Low · Impact: High**

A stray `Math.random()`, a `Date.now()` read, or a banned transcendental function
breaks reproducibility, and nobody notices until a bug proves irreproducible months later.

*Partly reduced by ADR-0009.* JavaScript specifies `Map`/`Set` iteration order and
stable array sorting, which removes the largest hazard the C# plan carried.

*New hazard from the same ADR.* `Math.sin`/`cos`/`exp`/`pow` have
implementation-defined precision in ECMAScript, so a simulation can diverge **between
browsers** while being perfectly reproducible on the developer's machine. This is a
web-specific failure mode with no desktop equivalent.

*Mitigation.* Golden-seed, double-run, cross-process, and **cross-environment**
(Node vs. real browser) tests in CI from Milestone 1. The cross-environment test is the
only one that catches a transcendental slipping through, and it is the reason it exists.
Banned-construct list in `DETERMINISM.md` §5, enforced by an automated source test.

Low likelihood *only because* these controls exist. Without them this would be High.

---

## Summary

| Priority | Risks |
|---|---|
| **Critical** | R-01 scope · R-02 resources · R-18 motivation |
| **High** | R-03 tick cost and memory · R-06 continuity · R-09 cycles · R-13 sensitive topics · R-14 war · R-16 migrations · **R-21 data breach** · **R-25 breaking saves** |
| **Medium** | R-04 · R-05 · R-07 · R-08 · R-10 · R-11 · R-12 · R-15 · R-17 · R-22 hosting · R-23 runtime types · **R-24 support burden** |
| **Low** | R-19 · R-20 · **R-26 monetization** |

### What the web pivot changed

| Risk | Movement |
|---|---|
| R-18 motivation | **High → Medium.** A visible UI at Milestone 2 instead of Milestone 5 |
| R-03 tick cost | Reframed — browser **memory** is now the binding constraint, not CPU |
| R-20 determinism | Largest C# hazard removed; a new browser-divergence hazard added |
| R-21 data breach | **New, High.** Did not exist for a desktop application |
| R-22 hosting cost | **New, Medium.** Structurally reduced by simulating in the browser |
| R-23 runtime types | **New, Medium.** TypeScript checks nothing at runtime |

The three Critical risks remain human rather than technical. That is still the honest
picture: the technology is tractable, and the plan's real enemies are scope, available
time, and staying interested.

The web pivot **improved** the most dangerous of the three. It also added a category
that did not previously exist — but that category stays entirely dormant until
Milestone 6, roughly a year out.

### What the product roadmap added

| Risk | Note |
|---|---|
| R-24 support burden | **New, Medium.** The most likely route to R-02 becoming acute |
| R-25 breaking saves | **New, High.** Consequence-of-failure counterpart to R-16 |
| R-26 monetization | **New, Low.** Only exists if subscription is chosen; ADR-0015 defers it |

All three are dormant until closed alpha — roughly a year out. Their value now is that
they shape decisions being made today: migration infrastructure at M4, and account
deletion and analytics as alpha entry criteria rather than 1.0 features. Both are far
cheaper to build before there are users than after.
