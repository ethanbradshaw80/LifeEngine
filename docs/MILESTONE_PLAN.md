# Milestone Plan

**Revision 2 — web application, TypeScript.** Supersedes the desktop/C# plan.

Small vertical milestones. Each one produces something executable and inspectable.

**Time budget: ~10 hours per week, solo, while still learning to code.**

> **On the estimates.** Every duration below is a guess, and the first two are the
> least reliable because they include learning TypeScript. Treat them as planning aids,
> not commitments. Record actual elapsed time for each milestone — after three
> completed milestones you will have real data, and every estimate after that becomes
> worth something. Estimates made now are not.

---

## Shape of the plan

The browser-first decision (ADR-0010) produces a genuinely useful property:

> **Milestones 0–5 require no server, no database, no accounts, and no hosting bill.**

Everything runs in the browser and saves locally. The expensive, risky, security-
sensitive work is deferred to Milestone 6 — by which point there is something worth
protecting and you will have learned a great deal more.

| Milestone | Deliverable | Server needed |
|---|---|---|
| 0 | Environment and skeleton | No |
| 1 | Deterministic town, headless | No |
| 2 | It's on a web page | No |
| 3 | Measure and prove | No |
| 4 | Saves and responsiveness | No |
| 5 | Relationships — one domain done properly | No |
| 6 | Accounts and cloud saves | **Yes** |

---

## Milestone 0 — Environment and skeleton

**Objective.** A machine that can build, test, and run TypeScript.

**Deliverable.** The monorepo from `ARCHITECTURE_PROPOSAL.md` §4, with one passing test.

**Tasks.**
1. Install Node.js LTS. Verify `node --version`.
2. Configure git identity (`user.name`, `user.email`).
3. Install VS Code.
4. Create the monorepo: `packages/engine`, `packages/shared`, `apps/web`.
5. TypeScript in **strict mode**. Not optional — strict mode is most of the value of
   using TypeScript at all.
6. Vitest configured; one test asserting `true` passes.
7. Vite dev server serves a blank page.
8. First commit.

**Exit criteria.** `npm test` passes. `npm run dev` serves a page. Repo committed.

**Out of scope.** Any simulation logic whatsoever.

**Estimate.** 1–2 weeks. Environment setup reliably takes longer than expected, and
that is normal rather than a sign of trouble.

---

## Milestone 1 — Deterministic town *(the bootstrap's first executable milestone)*

**Objective.** Generate a deterministic small town, simulate ~100 people for 120
monthly ticks, and produce inspectable causal and historical records — headless.

**Dependencies.** M0. ADR-0008, 0009, 0010 accepted.

**Deliverable.** A function taking a seed and returning a world, plus a test that
prints any person's life story as readable text.

**In scope.**

- Simulation clock — monthly ticks, calendar dates
- Seeded RNG with derived streams (`DETERMINISM.md` §1–2)
- Sequential entity ID allocator
- Person: ID, name, birth tick, death tick, sex, coarse traits, tier field (always Deep)
- Place: one town with a handful of named locations
- Event log with deterministic ordering
- `CausalRecord` with significance tiers — **structure only, no compression**
- A deliberately narrow set of behaviours: **friendship formation, schooling, first
  employment, income, household formation, moving, birth, death**
- Serializable world state (required for M4's worker boundary)
- Determinism tests: golden seed, double-run, cross-process, **cross-environment**

**Explicitly out of scope.** Marriage and divorce. Relationship depth. Businesses as
entities. Economy. Health beyond alive/dead. Government. Military. Crime. Media.
Weather. Inheritance. Multiple towns. Tiers beyond Deep. **Any UI.** Save/load. Causal
compression.

**Tests.**
- Same seed, two runs, one process ⇒ byte-identical
- Same seed, two Node processes ⇒ byte-identical
- Same seed, Node and a real browser ⇒ byte-identical
- Every death has a causal record
- No person is employed before the minimum age
- Import-graph test: `packages/engine` imports nothing but `packages/shared`
- Source test: none of the banned constructs in `DETERMINISM.md` §5 appear

**Exit criteria.** Run seed 12345 twice; output identical. Print a person's life story
and it reads as a coherent, plausible life. All tests pass.

**Risks.** Scope creep dominates — "just add marriage" is exactly how this milestone
becomes six months long. The out-of-scope list is binding; changing it requires an ADR.

**Estimate.** 6–10 weeks, including learning TypeScript. If it reaches 14 weeks, stop
and cut scope rather than pushing on.

---

## Milestone 2 — It's on a web page

**Objective.** See a simulated person in a browser. *(Resolves ADR-0012.)*

**Dependencies.** M1.

**Deliverable.** A local web page listing the town's people, with a detail view and an
"advance one year" button.

**In scope.**
- React app importing the engine
- Person list; person detail showing name, age, job, household, relationships
- Advance-time control
- A timeline of that person's life events
- A "Why?" view rendering causal records into prose

**The rule.** The UI **renders engine state and sends commands. It holds no simulation
state of its own.** This is the discipline ADR-0005 protected by delay; here it is
protected by rule instead. A React component holding a fact the engine does not have is
a bug.

**Exit criteria.** Open the page, click advance five times, watch people age, get jobs,
move, and die. Click "Why?" on an event and get a truthful explanation.

**Out of scope.** Styling beyond legibility. Accounts. Saving. Mobile layout. Animation.

**Estimate.** 2–4 weeks.

**Why this is here and not at the end.** R-18 (motivation decay) is rated Critical, and
its main cause was months of invisible progress. A web page showing a life unfold
removes most of that risk cheaply. It also surfaces information-overload problems
(Law 9) while the design is still soft.

---

## Milestone 3 — Measure and prove

**Objective.** Replace every performance guess in the documentation with a measurement.

**Dependencies.** M2.

**Deliverable.** A benchmark harness and `PERFORMANCE_BASELINE.md` with real numbers.

**In scope.**
- Tick time at 100, 1,000, and 10,000 people
- **Browser memory per person and per causal record** — the binding constraint for a
  web app, and the number most likely to force a design change
- Save-object size growth per simulated year
- Time to advance one simulated year
- Update `SIMULATION_LEVELS.md` §7, `CAUSAL_RECORDS.md` §5, and
  `ARCHITECTURE_PROPOSAL.md` §6 with actual figures
- Create the `performance-reviewer` agent (ADR-0007)

**Exit criteria.** Every "unmeasured" note in the docs is replaced with data or the
scope is explicitly revised.

**Out of scope.** Optimization. This milestone measures; it does not tune.

**Estimate.** 2 weeks.

---

## Milestone 4 — Saves and responsiveness

**Objective.** Saves survive schema change, and long simulations do not freeze the page.

**Dependencies.** M3. *(Resolves ADR-0004.)*

**Deliverable.** Versioned local saves plus the engine running in a Web Worker.

**In scope.**
- Choose the serialized save shape
- Header: schema version, simulation version, seed, **and `userId`** — valued
  `"local"` until M6 (ADR-0010)
- IndexedDB read/write from `apps/web`
- Checksum for corruption detection; graceful, non-destructive failure
- One real migration from the M1 shape, tested against a committed old save
- Move the engine into a Web Worker so the UI stays responsive
- Handle `BigInt` in serialization now, before Layer 4 needs it

**Exit criteria.** Save, close the tab, reopen, continue — state intact. A deliberately
corrupted save is refused rather than silently loading garbage. Advancing fifty years
does not freeze the page.

**Out of scope.** Cloud sync. Accounts. Multiple named save slots.

**Estimate.** 3–4 weeks.

**Note.** The `userId` field costs nothing here and saves a painful migration at M6.
Do not skip it because accounts do not exist yet — that is precisely why it is cheap now.

---

## Milestone 5 — Relationships: one domain done properly

**Objective.** One Layer 2 domain, end to end, as the template for all the others.

**Dependencies.** M4.

**Deliverable.** Relationships as a real domain — graph, formation, decay, marriage,
divorce, households, with causal records throughout.

**In scope.** Typed relationship edges · formation from compatibility, proximity, and
shared context · decay and reinforcement · marriage and divorce with causal records ·
household composition changes · UI for viewing relationships · full test coverage.

**Exit criteria.** A generated life story contains a relationship whose beginning and
end are both explainable from records, and the explanation is not obviously wrong.

**Out of scope.** Every other Layer 2 domain. This is a template, not a race.

**Estimate.** 4–6 weeks.

**Why relationships first.** Most narratively load-bearing Layer 2 domain, and the one
most likely to expose flaws in the causal-record design while it is still cheap to change.

---

## Milestone 6 — Accounts and cloud saves

**Objective.** Multiple users, each with their own account and save files.

**Dependencies.** M5. *(Resolves ADR-0011, ADR-0014 activates.)*

> **This is the riskiest milestone in the plan, and the only one where a mistake harms
> real people rather than a save file.** Everything before it is a game. This one
> handles other people's credentials and data.

**In scope.**
- Choose a hosting platform and a database
- Choose an authentication provider or maintained library — **never write your own**
- Sign up, sign in, sign out, password reset
- Per-user save storage; local IndexedDB becomes a cache
- Migrate existing `"local"` saves to the signed-in user
- Rate limiting; input validation at every boundary
- A privacy policy stating plainly what is stored and why
- Backups, and a tested restore — an untested backup is not a backup
- Mandatory `web-security-reviewer` pass before anything ships

**Non-negotiable rules.**
- Never write your own authentication, password hashing, or session handling.
- **Verify any provider's current pricing, status, and maintenance before committing.**
  Do not rely on this document, or on any AI's recollection, for that — it is exactly
  the kind of fact that goes stale.
- Secrets never enter the repository. `.gitignore` already covers the usual shapes;
  that is a safety net, not a strategy.
- A save is user data. Treat a leak as a real-world harm.

**Exit criteria.** Two separate accounts each hold their own saves and cannot see each
other's. Password reset works. Security review passed. A restore from backup has been
performed successfully, not merely configured. **Account deletion works**, and basic
analytics are in place — both are closed-alpha entry criteria per
`PRODUCT_ROADMAP.md` §5, and both are far cheaper to build before there are users.

**Out of scope.** Social features. Sharing. Leaderboards. Anything involving one user
seeing another's world — that is multiplayer, and it remains rejected.

**Estimate.** 6–10 weeks. Wide, because it is mostly unfamiliar territory and the
security work should not be rushed.

---

## Getting it in front of people

This document covers *building*. `PRODUCT_ROADMAP.md` covers *releasing* — prototype
(M2), private showing (M5), closed alpha (M6), then beta and 1.0.

One consequence reaches back into this plan: **breaking the save format stops being
free at closed alpha.** Before players, a broken save costs nothing. After closed beta,
it costs 250 people their progress. That is why M4 builds migration infrastructure
before M6 needs it — the ordering was already right and is now load-bearing (R-25).

---

## Beyond Milestone 6

Not planned in detail, deliberately. Estimates that far out are fiction, and Milestones
1–5 will produce information that changes what should come next.

Rough direction: remaining Layer 2 domains (education, careers, finance, housing) →
Layer 3 generational systems → the simulation tiers → Layer 4 institutional domains,
with military and war among the last.

---

## Honest assessment

**Layers 1–3 are achievable** at 10 hours a week — roughly a year to eighteen months of
steady work to reach a game where you live a life, have a family, age, die, and
continue as an heir, in a browser, with accounts.

**That is already a real product**, and a satisfying place to stop.

**Milestone 6 is a genuine step up in difficulty.** Accounts, hosting, and user data are
a different discipline from simulation programming — less forgiving, with consequences
outside your own machine. Budget for it honestly and lean on managed services rather
than building infrastructure yourself.

**Layer 4 is where realism gets hard.** Economy, government, healthcare, military, war,
crime, and media are each individually as large as everything in Layers 1–3 combined.
Reaching all of them solo is not a realistic plan.

This is not a reason to abandon the vision. It is the reason for the layering: the
military system you are most interested in sits in Layer 4, and the way to actually
reach it is to finish Layers 1–3 first. A military system built on a nonexistent person
model would model nothing.

**If motivation is the binding constraint rather than time** — and on solo projects it
usually is — say so, and the plan can be reordered to bring a thin, honest slice of
military service forward. That trade has a real cost in rework, but a project you enjoy
building is worth more than a tidy dependency graph.
