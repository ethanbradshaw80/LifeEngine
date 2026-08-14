# Decision Log

Architecture Decision Records. Every significant, hard-to-reverse choice lives here.

**This log outranks `LIFE_ENGINE_BOOTSTRAP.md`.** Where they disagree, the ADR is
current and the bootstrap is historical.

**Format:** Status · Context · Options · Decision · Rationale · Consequences ·
Reversibility · Review trigger.

**Statuses:** `Proposed` (awaiting owner approval) · `Accepted` · `Superseded by ADR-NNNN` · `Rejected`

---

## Current state

| ADR | Decision | Status |
|---|---|---|
| 0001 | ~~Windows desktop~~ | **Superseded by 0009** |
| 0002 | ~~C# / .NET~~ | **Superseded by 0009** |
| 0003 | Engine is headless with zero UI dependencies | Accepted |
| 0004 | Persistence format deferred | Accepted |
| 0005 | ~~No UI before Milestone 5~~ | **Superseded by 0012** |
| 0006 | Godot and Unity rejected | Accepted *(moot)* |
| 0007 | Reduced foundation agent set | Amended by 0014 |
| 0008 | Money as integer minor units | **Accepted** |
| 0009 | **Web application, TypeScript** | **Accepted** |
| 0010 | **Simulation in the browser; multi-user ready, shipped later** | **Accepted** |
| 0011 | **React + Vite; no full-stack framework yet** | **Accepted** |
| 0012 | **UI from Milestone 2** | **Accepted** |
| 0013 | **Offline-only constraint replaced** | **Accepted** |
| 0014 | **Web security reviewer added** | Accepted |
| 0015 | **Product stages gated on criteria; monetization deferred** | **Accepted** |
| 0016 | **Accounts deferred until the game is playable** | Accepted |
| 0017 | **Layer 4 entered military-first; nations aggregate-only** | **Accepted** |
| 0018 | **Simulation institutions paused; player experience is the arc** | **Accepted** |
| 0019 | **Demographics repaired by modelled decisions, not rates** | **Accepted** |
| 0020 | **World presets; Real World Mode alongside Classic** | **Accepted** |
| 0021 | **Real foreign nations and generated wars in a real-world preset** | **Accepted** |
| 0022 | **Coalitions: the call to arms, and who decides a nation's war** | **Accepted** |
| 0023 | **Real school names; units stay fictional** | **Accepted** |
| 0024 | **Real decoration and badge names, with earnability enforced** | **Accepted** |
| 0025 | **Capture, captivity, and the Prisoner of War Medal** | **Accepted** |
| 0026 | **Aviation, the Air Medal, and the end of the HOLD list** | **Accepted** |
| 0027 | **M-ECON: money belongs to people; the economy is weather** | **Accepted** |
| 0028 | **Bankruptcy, homelessness, and the floors under a life** | **Accepted** |
| 0029 | **Civilian careers brought up to the military's depth** | **Accepted** |
| 0030 | **A grown adult's money is his own; the household is a building** | **Accepted** |
| 0031 | **Enlistment is a recruiting station, not a menu** | **Accepted** |
| 0032 | **The twelve-year wall: indefinite or out, and it wants SGT** | **Accepted** |
| 0033 | **A conviction reaches the hiring desk; an heir gets their own life** | **Accepted** |
| 0034 | **A job offer is an offer — accept, decline, or ask for time** | **Accepted** |
| 0035 | **A house can be bought with money, not only with a mortgage** | **Accepted** |
| 0036 | **The phantom household member: a loop that mutated what it iterated** | **Accepted** |
| 0037 | **The Article 15: a paper you sign, and a bridge from the courthouse** | **Accepted** |

---

## ADR-0001 — Target platform: Windows desktop

**Status: Superseded by ADR-0009.**

Recorded that the machine is Windows 11 with no Swift toolchain, that Apple's tooling
is macOS-only, and retargeted from iOS to Windows desktop. The platform reasoning is
now void; the underlying finding — that the engine's framework independence made the
change cost only documentation — is retained and reinforced by ADR-0009.

## ADR-0002 — Engine language: C# on .NET

**Status: Superseded by ADR-0009.**

Chose C# for a Windows desktop application. That premise no longer holds. See ADR-0009.

---

## ADR-0003 — Engine is headless with zero UI dependencies

**Status:** Accepted
**Date:** 2026-07-30

**Context.** Simulation logic embedded in UI code cannot be tested, reasoned about, or
ported.

**Decision.** `packages/engine` is a pure TypeScript package importing nothing but
`packages/shared`. No React, no DOM, no `window`, no `document`, no storage, no
network, no clock. The application depends on the engine; the engine never depends on
the application.

**Rationale.** Enables headless testing, keeps determinism verifiable in isolation, and
allows the engine to run unchanged in a browser, a Web Worker, or on a server.

**Consequences.** All I/O lives in `apps/web`. Engine state must remain serializable so
it can cross a worker or network boundary.

**Reversibility.** Easy to preserve, painful to retrofit. Enforce with an automated
import-graph test.

**Vindication worth recording.** This ADR has now survived two complete platform
reversals — iOS → Windows → web — at a total cost of documentation edits and zero code.
It is the most valuable decision in this log.

**Review trigger.** Any proposal to import a framework, DOM type, or I/O API into
`packages/engine`. The answer is no.

---

## ADR-0004 — Persistence format deferred

**Status:** Accepted
**Date:** 2026-07-30

**Context.** Versioned saves with migrations are required, but the shape of the data is
not yet known.

**Decision.** Defer the format. Commit now only to the *contract*: every save carries
an explicit schema version, simulation version, seed, and `userId`; migrations are
tested; data is never silently lost.

**Amended by ADR-0009/0010.** The storage *medium* for Milestones 1–5 is IndexedDB in
the browser. The serialized shape remains undecided until Milestone 4, which is where
`MILESTONE_PLAN.md` resolves it.

**Reversibility.** High now, low later.

**Review trigger.** Milestone 4.

---

## ADR-0005 — No user interface before Milestone 5

**Status: Superseded by ADR-0012.**

Correct for a desktop application built engine-first. Wrong for a web application,
where the browser *is* the delivery mechanism and a page is close to free.

---

## ADR-0006 — Godot and Unity rejected

**Status:** Accepted, now moot
**Date:** 2026-07-30

Rejected for the foundation phase on the grounds that there was nothing to render and
adopting a game engine meant learning three unfamiliar things at once. ADR-0009 makes
the question moot — neither is a candidate for a web application of this kind.

---

## ADR-0007 — Reduced foundation agent set

**Status:** Accepted, amended by ADR-0014
**Date:** 2026-07-30

No Swift or C# engineer agent. Four agents defined: `architecture-reviewer`,
`persistence-reviewer`, `scope-risk-reviewer`, `documentation-reviewer`. Performance
and military reviewers deferred until there is code to profile and military systems to
review. ADR-0014 adds a fifth.

---

## ADR-0008 — Money as integer minor units; floating point restricted

**Status:** Accepted
**Date:** 2026-07-30

**Context.** Law 11 requires reproducibility. Floating-point arithmetic accumulates
error and is the classic source of both financial bugs and nondeterministic drift.

**Decision.** Monetary values are integer **cents**. Traits and bounded quantities use
integer scales. Floating point is permitted only for derived display values that never
feed back into authoritative state.

**Amended for TypeScript.** All JS numbers are IEEE-754 doubles; integer arithmetic is
exact only to 2^53−1. That is about $90 trillion in cents — comfortable for personal
and household finance, which is all Layers 1–3 need. **Aggregate economy figures at
Layer 4 must use `BigInt`.** Flagged now so the persistence layer is designed to carry
both without a migration.

**Consequences.** Explicit conversion for display. Rounding rules documented at every
site where rounding occurs.

**Reversibility.** Poor once financial data exists in saves.

**Review trigger.** First implementation of interest, inflation, or investment returns.

---

## ADR-0009 — Web application, TypeScript end to end

**Status:** Accepted
**Date:** 2026-07-30
**Supersedes:** ADR-0001, ADR-0002

**Context.** The owner directed that The Life Engine be a web application supporting
multiple users with separate accounts and save files, using a web-first architecture,
with the engine kept separate from the frontend so it remains deterministic and
testable.

**Options.** TypeScript end to end · C# backend + TypeScript frontend · C# everywhere
via Blazor WebAssembly · Rust/WASM + TypeScript · Python backend. Full evaluation in
`ARCHITECTURE_PROPOSAL.md` §3.

**Decision.** TypeScript across engine, frontend, and any future backend. React + Vite
for the application. Monorepo with `packages/engine`, `packages/persistence`,
`packages/shared`, `apps/web`.

**Rationale.** One language across the whole stack is the single largest practical
advantage available to a solo developer at ~10 hrs/week who is still learning — every
hour spent learning TypeScript applies everywhere. The common objection, determinism,
is answerable and in one important respect JavaScript is *better* than C#: `Map` and
`Set` iteration order is specified by ECMAScript, eliminating the largest determinism
hazard in the previous plan. C# backend and Blazor were rejected for requiring two
toolchains or a smaller community. Rust was rejected on learning curve, as before.

**Consequences.**

- Node.js must be installed. It is not currently on this machine.
- The .NET SDK is no longer needed.
- TypeScript types vanish at runtime — save validation must be an explicit schema
  check, never a cast.
- `Math.sin`/`cos`/`exp`/`pow` are banned in engine logic: ECMAScript leaves their
  precision implementation-defined, so results can differ across browsers.
- Browser memory, not CPU, becomes the binding constraint on population scale.
- Distribution is a URL — no installer, no store, no signing.

**Reversibility.** Poor. Changing language after Layer 1 is a rewrite.

**Review trigger.** A determinism or performance problem proven unsolvable in
TypeScript — demonstrated with profiling evidence, not suspected.

---

## ADR-0010 — Simulation runs in the browser; multi-user ready, shipped later

**Status:** Accepted
**Date:** 2026-07-30

**Context.** The engine must eventually support multiple users with separate accounts
and saves. It could run in the browser or on a server.

**Options.**

1. Server-side simulation. Authoritative, tamper-proof saves; hosting cost scales with
   every active player and a slow tick degrades service for everyone.
2. Browser simulation, server stores saves. Cheap, near-flat hosting; responsive; saves
   are editable by a determined user.
3. Browser now, server-capable later. Engine written to run unchanged in either.

**Decision.** Option 3, per owner selection.

**Rationale.** Hosting cost stays near-flat as users grow, which matters for a project
with no revenue. Save tampering is close to irrelevant for a single-player life
simulation. Writing the engine to run in either place costs only discipline — the same
purity rule ADR-0003 already requires — and preserves the option permanently.

**Consequences.**

- **Milestones 1–5 need no server at all.** Saves go to IndexedDB locally. No database,
  no auth, no hosting bill, no security surface until Milestone 6.
- The engine may not use browser-only APIs, or it could not move server-side (C4).
- **Every save carries a `userId` from the first save ever written**, valued `"local"`
  until accounts exist. This costs nothing now and avoids a painful migration later.
- Engine state must stay serializable, for both worker and network boundaries.
- Very large simulations are limited by the player's device.

**Reversibility.** High, by design — provided the purity rule holds and `userId` exists
from day one.

**Review trigger.** Milestone 6, or evidence that browser memory limits are constraining
the design.

---

## ADR-0011 — React + Vite; no full-stack framework yet

**Status:** Accepted
**Date:** 2026-07-30

**Context.** Next.js would supply routing, API routes, and a mature auth ecosystem —
all of which are Milestone 6 concerns.

**Decision.** React with Vite for now. Reconsider Next.js at Milestone 6, when accounts
arrive.

**Rationale.** Milestones 1–5 need no server, so a full-stack framework would be unused
complexity during exactly the period when complexity hurts a learner most. Vite is
simpler to understand and faster to iterate in. ADR-0003 means the frontend choice is
cheap to revisit.

**Consequences.** A migration to Next.js later, if chosen, touches only `apps/web`.

**Reversibility.** Easy.

**Review trigger.** Milestone 6.

---

## ADR-0012 — User interface from Milestone 2

**Status:** Accepted
**Date:** 2026-07-30
**Supersedes:** ADR-0005

**Context.** ADR-0005 deferred all UI to Milestone 5 to prevent effort going into
buttons instead of simulation. On a desktop project that was right. On the web the
calculus differs: the browser is the delivery mechanism, and rendering a list of people
is close to free.

**Decision.** A minimal web interface arrives at Milestone 2, immediately after the
engine's first working tick.

**Rationale.** R-18 (motivation decay) is rated Critical and was the largest
non-technical risk in the register. Six months of console output was its primary cause.
A web page showing a simulated person aging removes most of that risk for a small
fraction of the effort a desktop UI would have cost. The discipline ADR-0005 protected
is preserved differently: **the UI may only render engine state and send commands.** It
holds no simulation state of its own, and the engine remains fully testable headlessly.

**Consequences.** Slightly earlier frontend effort. Requires vigilance that the UI does
not accumulate authoritative state — the failure ADR-0005 existed to prevent, now
guarded by rule rather than by delay.

**Reversibility.** Easy.

**Review trigger.** Any UI component holding state the engine does not have.

---

## ADR-0013 — The offline-only constraint is replaced

**Status:** Accepted
**Date:** 2026-07-30

**Context.** `LIFE_ENGINE_BOOTSTRAP.md` §12 requires that ordinary gameplay work
offline and that no cloud account be required. ADR-0009 and the multi-user requirement
directly contradict this. Leaving a governing constraint that the architecture violates
would make the constitution unreliable.

**Decision.** Replace the offline constraint with:

- Ordinary gameplay must work **without a network round-trip per tick.** The simulation
  runs locally in the browser; the network is used for loading the app, and later for
  authentication and save sync.
- **No runtime generative AI.** *(Unchanged — still absolute.)*
- An account is **not** required for local play. It is required only for saves that
  follow the user across devices.
- The game must degrade gracefully when offline: an already-loaded session keeps
  simulating and saves locally.

**Rationale.** Preserves the *intent* of the original constraint — the player's
experience should not depend on a server being healthy — while permitting the accounts
the owner requires. The genuinely important half, no runtime AI, is untouched.

**Consequences.** `CLAUDE.md` §7 rewritten. `PROJECT_CHARTER.md` §5 non-goals revised:
"online backend or accounts" moves from rejected to required. **"Multiplayer, in any
form" remains rejected** — multi-user is not multiplayer.

**Reversibility.** N/A — this is a requirements change, not a technical one.

**Review trigger.** Any proposal requiring a network call to advance a tick.

---

## ADR-0014 — Web security reviewer agent added

**Status:** Accepted
**Date:** 2026-07-30
**Amends:** ADR-0007

**Context.** ADR-0009 and the multi-user requirement introduce a class of risk absent
from a desktop application: user accounts, credentials, personal data, and a public
attack surface. A bug here harms real people, not a save file.

**Decision.** Add `web-security-reviewer` to `.claude/agents/`. It reviews anything
touching authentication, sessions, user data, storage, or network boundaries.

**Rationale.** The developer is explicitly still learning. Security bugs are exactly
the class where a learner cannot reliably self-review, and where the consequences fall
on other people.

**Consequences.** Mandatory review for all Milestone 6+ work. Dormant until then.

**Reversibility.** Trivial.

**Review trigger.** Milestone 6 planning.

---

## ADR-0015 — Product stages gated on criteria; monetization deferred

**Status:** Accepted
**Date:** 2026-07-30

**Context.** The technical documents covered building the game and said nothing about
releasing it. External review raised the gap and proposed a five-stage roadmap:
prototype → closed alpha (25) → closed beta (250) → public beta → 1.0, with 1.0
carrying marketing, subscription, analytics, Discord, and a feedback system.

The gap was real. Two aspects of the proposal needed resolving before adoption.

**Options considered.**

1. Adopt as proposed, with player counts as stage boundaries.
2. Adopt with **criteria-based gates**, counts as targets rather than triggers.
3. Defer a roadmap entirely until closer to release.

**Decision.** Option 2, with three amendments:

- **Stages gate on criteria, not counts or dates.** A player count is a size, not a
  decision. Each stage defines what must be true to enter and what must be learned to
  exit. See `PRODUCT_ROADMAP.md`.
- **A "private showing" stage is inserted** between prototype and closed alpha: 3–5
  people you know, in person, at Milestone 5. Going from one player to twenty-five in
  one step skips the cheapest feedback available.
- **Monetization is an explicit open question, not a 1.0 feature.** Decided at public
  beta, using real hosting-cost data from closed beta.

**Rationale for deferring monetization.** A subscription creates payment processing,
refunds and chargebacks, jurisdiction-dependent tax obligations, terms of service, and
a standing obligation to keep the service running while people pay. It also pulls
against `PROJECT_CHARTER.md` §5, which rejects live-service design because it distorts
decisions away from believability. A subscription is not microtransactions, but the
retention pressure it creates is what that non-goal exists to resist. Choosing a model
now would be a guess about a business that does not exist.

**Consequences.**

- **Migration discipline becomes an obligation at closed alpha,** not a good practice.
  Breaking saves for 250 beta players is unrecoverable. This is why M4 builds migration
  infrastructure before M6 needs it — the ordering was already correct and is now
  load-bearing.
- **Account deletion and basic analytics become closed-alpha entry criteria**, not 1.0
  features. Both are far cheaper before there are users.
- Discord and a feedback system are recorded as **ongoing operational costs**, not
  features — they compete directly with the 10 hours a week allocated to building.
- No engineering scope is added before Milestone 6.

**Reversibility.** High. This is a plan, not an architecture. Monetization remains fully
open by design.

**Review trigger.** Closed alpha exit — revisit the later stages using what the first
25 players actually did, and decide monetization at public beta.

---

## ADR-0016 — Accounts deferred until the game is playable

**Status:** Accepted (owner decision, 2026-07-31)
**Date:** 2026-07-31

**Context.** Milestones 0–5 are complete. The plan's next milestone was M6,
accounts and cloud saves — the first milestone with a hosting bill, a security
surface, and other people's data. But the product is still a simulation
*viewer*: there is no player character, and the charter's product vision — "the
player begins as one person within a world" — is not yet true of anything.

**Decision.** M6 is deferred until there is an actual playable game. The next
milestone is **M-PLAY: the playable character** — pick a person, live their
life through the decisions the simulation currently makes for them, die, see
the retrospective (Law 8), and optionally continue as an heir.

**Rationale.** Accounts protect progress people care about. Nobody cares about
progress in a game that cannot be played. Building auth first would spend the
riskiest effort on the least-proven part, inverted. Everything M6 needs
(`userId` on every save, migration discipline) is already in place and keeps.

**Consequences.** `MILESTONE_PLAN.md` ordering changes; no engineering scope is
lost, only resequenced. The alpha entry criteria in `PRODUCT_ROADMAP.md` §5 are
unchanged and still gate on M6 when it happens.

**Reversibility.** Trivial — it is a reordering.

**Review trigger.** M-PLAY complete and the game is genuinely playable.

---

## ADR-0017 — Layer 4 entered military-first; nations are aggregate-only

**Status:** Accepted (owner approval, 2026-07-31)
**Date:** 2026-07-31

**Context.** Layers 1–3 are built and playable (simulation v6, 168 tests).
The owner directed Layer 4 planning, whose deepest and most-specified domain
— military service and war — was the heart of the original bootstrap (§8, its
largest section). The bootstrap did not order Layer 4's seven domains.

**Decision.**

1. Layer 4 is entered **military-first**: geopolitics → health prerequisite →
   service careers → deployment and risk → awards and veterans, per
   `LAYER4_PLAN.md`. Economy, government, crime, media, and transportation are
   deferred within the layer; war's economic and political consequences are
   narrative events until their domains exist.
2. **Foreign nations are aggregate-tier only.** No individual foreign person
   is ever simulated. Grounded in measurement, not taste: the tick loop is
   O(n²) in people and 10,000 already cost 210 ms/tick (Milestone 3).
3. The health model (injury, recovery, permanent disability) is pulled
   forward as a prerequisite — the one genuine gap the §17 foreclosure audit
   found in Layers 1–3.
4. The `military-scope-reviewer` agent is created now, per ADR-0007's
   deferred trigger, and is mandatory on military-touching changes.

**Rationale.** This is the motivation trade `MILESTONE_PLAN.md` explicitly
reserved from day one, taken deliberately rather than drifted into. The
foundation doc's boundaries (fixed 2026-07-30, before any code) survived the
audit almost intact, which is what a foundation phase is for.

**Consequences.** Wars will initially move markets that do not exist; accepted
and stated in the plan. Each L4 milestone bumps SIMULATION_VERSION and ships
into the playable game.

**Reversibility.** High — it is a sequencing plan. The aggregate-nations rule
is the exception: reversing it later would be a performance rewrite, which is
exactly why it is fixed now.

**Review trigger.** After L4-M1 ships, reassess the remaining sequence.

---

## Approval status

**All ADRs are Accepted as of 2026-08-01.** Nothing is outstanding.
(0018/0019/0020 approved 2026-08-01; everything earlier by 2026-07-31.)

ADR-0008, 0009, 0010, 0011, 0012, 0013, and 0015 were approved together by the owner
after review.

### What this authorizes

Implementation may begin at Milestone 0 (`MILESTONE_PLAN.md`), once Node.js is installed
and git identity is configured globally.

### What it does not authorize

Gameplay beyond the current milestone's in-scope list. Milestone out-of-scope lists
remain binding, and changing one still requires a new ADR.

### The decisions now hardest to reverse

| ADR | Decision | Cost to reverse |
|---|---|---|
| 0009 | TypeScript | A rewrite |
| 0003 | Engine purity | Easy to keep, a rewrite to retrofit |
| 0008 | Integer money | Poor once financial data exists in saves |
| 0010 | `userId` in every save | Cheap now, a migration later |

Determinism (Law 11) is not an ADR because it is not optional. It cannot be retrofitted
at any price, and it must be built in from the first commit.

## ADR-0018 — Simulation institutions paused; player experience becomes the arc

**Status:** Accepted (owner direction, 2026-08-01)
**Date:** 2026-08-01

**Context.** C1 (crime & justice) completed its core exit criteria — the
second Layer 4 institution. The owner then audited the game as a GAME and
directed: stop adding major simulation systems; the player experiences the
world through one life, and today five of seven domains are watch-and-wait
for a played character (PLAYER_EXPERIENCE_AUDIT.md — 19 decision surfaces
exist; only the military tab is a complete loop).

**Decision.**

1. No new major simulation institutions (government, economy/businesses,
   media, transportation, C3 justice depth) until the P-arc and D-arc land.
2. The player-experience redesign proceeds as PLAYER_EXPERIENCE_AUDIT.md's
   P1 (explanations) → P2 (verbs) → P3 (surfaces). C2 (player crime) folds
   into this arc — it was already the player side of C1.
3. The redesign principle is binding: the simulation stays authoritative;
   player choice is raised at modelled moments or initiated through
   log-before-roll verbs with honest refusals, resolved through the same
   shared functions the auto path uses. No UI-driven simulation logic.
4. The demographic repair (ADR-0019) runs FIRST: relationships verbs need a
   working partnering pipeline to act on.

**Rationale.** Law 9 (show what matters) and the product identity
(BitLife-style story-first game, M-GAME) both say depth the player cannot
touch is inventory, not gameplay. The engine outgrew its interface; the
correction is deliberate.

## ADR-0019 — Demographic realism repaired by modelled decisions, not rates

**Status:** Accepted (owner direction, 2026-08-01)
**Date:** 2026-08-01

**Context.** Measured (DEMOGRAPHICS_AUDIT.md, D1 instrumentation): living
population declines ~100 → 18-41 within 150 years on every seed. Completed
fertility 1.29-1.67 vs ~2.1 replacement; 33-46% of completed women
childless; courtships ~1-2 per decade town-wide; median marriage age 38-44;
remarriage effectively absent. Mortality is healthy — the cradle, not the
grave.

**Decision.** D2 implements partner-seeking intent, family-intent-driven
marriage timing, family-size aspiration decided and recorded by couples,
and remarriage after a modelled recovery period — per DEMOGRAPHICS_AUDIT.md
§D2. **Artificial birth-rate multipliers are forbidden**; every change must
be a modelled decision with a causal record, tuned against D1's measured
targets (completed fertility 2.1-2.6, childless 10-20%, median first
marriage 22-27, stable-to-growing population over 150 years, 3 seeds).

**Rationale.** Law 1 (simulation is the source of truth) and Law 3 (every
outcome explainable): a fertility multiplier explains nothing, while "they
married young because they wanted a family, and the town had a dance"
explains everything. The owner's constraint and the constitution agree.

**Amendment (2026-08-01, at D2 review).** Latent per-woman fecundity —
a fixed draw from a constant-keyed stream deciding that for some women
children never come (~5.5%) or come slowly (~6.5%) — is PERMITTED as
modelled circumstance. It is population heterogeneity, not a tunable
lever: adjusting it changes WHO is childless, and it is exempt from the
causal-record requirement because it is not a decision. The record is
still owed its fact: when the window closes on an unmet plan, "the
children never came" is recorded (settleFamilyPlans). Known simplification
accepted: fecundity currently follows the woman only.

## ADR-0024 — Real decoration and badge names, with earnability enforced

**Status:** Accepted (owner override, 2026-08-02)
**Date:** 2026-08-02
**Amends:** MILITARY_AND_WAR_FOUNDATION §3 for AWARD and BADGE names, the way
ADR-0023 did for school names. Named UNITS and foreign nations are untouched.

**Context.** The owner's awards pack carries an explicit override: use the
real decoration and badge names — Purple Heart, Silver Star, Bronze Star,
Good Conduct Medal, Combat Infantryman Badge, Ranger Tab and the rest —
"implement the real names even though §3 as written forbids it; this
override takes precedence."

This repo has reverted real decoration names TWICE before (at v13→v14 and
again in M-HARM), which is why this ADR exists: so the next reviewer does
not revert them a third time by reflex.

**Decision.**

1. **Decorations and badges carry their real names.** The fictional titles
   they replace — the Crimson Band, the Faithful Service Medal, the
   Standard-Bearer Medal — are gone from new grants.
2. **EARNABILITY IS THE PRICE, and it is the owner's own rule:** "no badge
   or ribbon exists that can't be earned." Every award grants from a
   qualifying recorded event and from nothing else. The grant functions
   still REFUSE an event that does not qualify, and the negative tests that
   prove it stay.
3. **The campaign award stays GENERIC** — the Armed Forces Expeditionary
   Medal, never a war-named one. This is the owner's own exception and it
   independently fixes the bug the last military review caught: a generated
   war against a real country was minting "the Afghanistan Campaign Medal",
   the verbatim name of a real decoration, onto a permanent record.
4. **HOLD ITEMS ARE NOT BUILT AND NOT SHOWN.** The Prisoner of War Medal
   needs a capture system and the Air Medal needs an aviation unit. Their
   kinds are not added to the type union either: a union member nothing can
   produce is the "unearnable award" rule broken one level down.
5. Records already written keep the titles they were written with. A
   veteran who earned the Crimson Band in 1974 still wears it — the
   correct-before-generation doctrine, unchanged since the Ashkelon rename.

**Rationale.** A decoration's name is the name of a thing a government
awards; using it in an expressive work is ordinary and common. What was
always load-bearing is that the award is EARNED — that a rack is a record of
what happened rather than a costume — and that is not weakened by the names
being real. It is strengthened, because a real medal a player recognises
makes the earning matter more.

**Amended the same day:** the top valor tier is **the Distinguished Service
Cross**, not the Medal of Honor. Both are real; the Medal of Honor is also a
long-running video-game trademark, which is a commercial conflict none of the
other names carry. The owner was shown the point and chose the swap. The DSC
is the real award immediately below it, so the tier keeps its meaning.

---

## ADR-0023 — Real school names; units stay fictional

**Status:** Accepted (owner override, 2026-08-02)
**Date:** 2026-08-02
**Amends:** MILITARY_AND_WAR_FOUNDATION §3, for SCHOOL names only.

**Context.** The military and combat master plan
(`docs/MILITARY_COMBAT_PLAN.md`) carries an explicit owner override: use the
real names for the service schools — Airborne, Ranger, Sniper, Pathfinder,
Military Freefall, SERE, EOD, the Special Forces Qualification Course and the
rest — "even though §3 as written forbids it; this override takes
precedence."

Two of this repo's five reviews have renamed schools for being close to real
ones (M-SPECOPS renamed two, and the decorations were reverted twice). This
ADR is what stops that happening a third time by reflex.

**Decision.**

1. **Schools carry their real names.** The structure they hang on — badge
   gates, failable selection, tiers, duty pay — is unchanged, which is the
   part that was ever load-bearing.
2. **UNITS STAY FICTIONAL, in every preset, permanently.** The owner's own
   note draws the line: "real school names are low-risk and common in games.
   Real unit names are the thing §3 chose to keep fictional... Default here
   is real schools + fictional units; add unit names to the override line if
   you want them real." He did not add them. ADR-0021 §2 and ADR-0022 stand
   untouched.
3. A future reviewer may NOT rename a school back for being real. It is here
   by decision, and this is the record of it.

**Rationale.** A school is a course of instruction; naming one asserts
nothing about a person and carries no casualty history. A unit is a body of
living people with a record of its own dead, which is why that line does not
move even as this one does.

---

## ADR-0022 — Coalitions: the call to arms, and who decides a nation's war

**Status:** Accepted (owner spec + four answered decisions, 2026-08-02)
**Date:** 2026-08-02
**Amends:** ADR-0021 §4 (an alignment now sets standing alliance membership
as well as the starting rung — see §3 below).

**Context.** The owner's war/deployment/difficulty spec adds a "call to
arms": an ally at war asks its allies to join, coalitions form, and once a
nation has joined, deployment can arrive as an ORDER rather than an
invitation. He answered the spec's four open questions directly: refusing
orders is allowed and costs you; a nation that joins is in until the war
ends; volunteering stays open even when your nation declined; and the call
fires when the war is going badly rather than on a fixed timer.

**Decision.**

1. **The call to arms is driven by distress, not by a clock.** The owner's
   words: "completely random but it should be before year 5 if the war is
   really that bad — it should trigger ally help when they are losing the
   war or taking more deaths and need additional help." So a belligerent's
   distress is measured from what the war is actually doing to it — the
   casualty deficit against its enemy, the strength ground off its
   peacetime baseline, and how long it has gone on — and the call is a
   monthly draw whose odds rise with distress, with a guarantee that a
   genuinely bad war has called before year five.
2. **Every nation runs the same logic**, including the homeland. Wars grow
   into coalitions on their own.
3. **An alignment sets standing alliance membership.** ADR-0021 §4 said an
   alignment touched only the first rung, and a review had just removed
   alliance membership for being more than that. The call to arms REQUIRES
   a persistent notion of who your allies are — "a nation can only be
   called to arms by an ally" — so the owner's spec supersedes: 'ally'
   means an alliance that stands. It is disclosed here rather than
   discovered, which is what the review actually objected to.
4. **THE PLAYER DOES NOT DECIDE WHETHER THEIR NATION JOINS A WAR.** The
   spec says "your nation's response (player choice)"; this is the one
   place it is not followed, and the reason is Law 2 and the charter's
   opening premise: the player is one person in the world, not its
   government, and no head-of-state seat exists anywhere in this design.
   The homeland decides by the same formula as everyone else and the player
   reads it in the news. What the player DOES get is the decision the
   charter says is theirs: whether they personally go — volunteer while
   their country stays out, or refuse the order when it does not. That is
   ADR-0022's substitute for the missing seat, and it is a better fit for
   this game than a cabinet vote.
5. **Refusing an order is allowed and costs.** Court-martial, the sentence,
   the discharge and the record that follows into civilian hiring — all
   machinery that already exists.
6. **A nation that joins is in until the war ends.** No separate peace.
7. **Volunteering is unaffected by any of it**, including after a decline.

**Rationale.** Coalitions are the thing the geopolitics model has always
been missing: wars were pairwise forever, so a world war was impossible and
an alliance meant nothing. Building them out of PAIRWISE wars — each joiner
declares against the same enemy — means no change to the war model itself,
and the coalition is visible as what it actually is: several countries
fighting the same enemy for a stated reason.

**Consequences.**
- More wars per century in a world with real alliances, and the homeland
  will be pulled into wars it did not start. That is the point.
- A player can be ordered somewhere they did not choose, and refusing ends
  a career. That is also the point, and it is the first time this game has
  offered a choice whose good outcome is not obvious.
- The spec's `JOIN_THRESHOLD` and `MULTI_WAR_PENALTY` were left "(tune)".
  They are tuned by measurement and the numbers are recorded in the code.

---

## ADR-0021 — Real foreign nations, and generated wars with them, in a real-world preset

**Status:** Accepted (owner direction, 2026-08-02)
**Amended:** 2026-08-02 — real country names in award citations, confirmed.

**Amendment (owner, 2026-08-02).** The place tally added with
one-award-per-deployment puts real country names into a permanent award
citation, and does it more visibly than the single-campaign line it
replaced: "service in the campaigns against Afghanistan x2, Iran". This was
raised to the owner as a judgement call rather than a defect, and **he
confirmed it stays.**

It is consistent with the rulings already in force and does not widen them:
the DECORATION is fictional (the campaign award is deliberately the generic
Armed Forces Expeditionary Medal precisely so a generated war can never mint
a real named campaign medal); the country appears only as a statement about
a war THIS WORLD generated; and no real unit, person or real conflict is
named. A reviewer meeting this again should treat it as settled rather than
reopening it.
**Date:** 2026-08-02
**Supersedes:** ADR-0020 §2's "foreign nations FICTIONAL permanently", for
presets that opt in. Everything else in ADR-0020 stands, including named
units, which remain fictional in every preset.

**Context.** The owner supplied a list of 21 real countries with
US-perspective ally/neutral/hostile labels and asked for them in the game. He
was shown, in writing and before deciding, exactly what this engine does with
a foreign nation — it escalates relations to war, deploys people into that
war, kills them there, and writes the enemy's name onto campaign medals,
newspaper headlines and death records that are permanent and never rewritten
— and was offered three options: leave it fictional, real countries as a
non-belligerent backdrop, or real countries with real wars. He chose the
third explicitly.

**Decision.**

1. A preset MAY name real foreign nations, and the war model runs against
   them unchanged. `american-heartland` does. `classic` does not and never
   will — it stays a wholly invented world, which is the point of keeping it.
2. NAMED MILITARY UNITS REMAIN FICTIONAL IN EVERY PRESET. A real unit has
   living members and a real casualty history; nothing here changes that,
   and the owner did not ask for it.
3. A preset naming real nations MUST carry unmissable alternate-history
   framing — at the point the world is chosen AND inside the running game,
   not one line in a settings menu. This is the condition, not a courtesy.
4. Starting relations may be seeded from real-world alignment as a STARTING
   POSITION. They are a gameplay premise, not a claim: the simulation moves
   them from tick one, and where they end up is the simulation's, not
   anybody's assessment of the world.
5. R-14's mitigation is amended: "all geopolitics fictional" becomes "all
   geopolitics GENERATED — never a scripted or historical conflict".
   Generation is what keeps a war the simulation's own; the names on the map
   were never what made a casualty meaningful.

**Rationale.** Games have depicted real nations in invented conflicts for as
long as there have been games; the charter's own premise is a realistic
simulated United States. The hazard R-14 names is real but is about
PRESENTATION and TRACEABILITY — a death must be caused, explicable and not a
slot machine — and none of that changes with the enemy's name. The line that
does not move is the one between a generated conflict and a real one: this
engine must never model, script or reproduce an actual war, and no real
conflict, operation or battle name may enter its content.

**Consequences, stated plainly.**
- The game will produce sentences like "the United States is at war with
  Russia" for wars that did not happen. That is the decision, and the
  framing requirement in §3 exists because of it.
- Campaign medals name their enemy, so an invented decoration will carry a
  real country's name. Flagged for the owner: real campaign medals are
  usually named for a theatre rather than a nation, and switching to theatre
  names would read better; deferred, not forgotten.
- Classic remains the wholly fictional world for anyone who wants one, and
  its golden fingerprint is untouched by this.

---

## ADR-0020 — World configuration system; Real World Mode alongside Classic

**Status:** Accepted (owner direction, 2026-08-01)
**Date:** 2026-08-01

**Context.** The owner wants a believable real-world setting (real US
geography, states, installations) with the fictional world preserved as an
option, extensible to future presets. Full placeholder inventory and legal
rulings in WORLD_MODES_PLAN.md.

**Decision.**

1. A WorldSpec chosen at world creation, recorded in the save header,
   immutable per world. Determinism becomes seed + preset + version +
   decisions; one golden fingerprint per preset. Launch presets: Classic
   (today's content, every existing save) and American Heartland.
2. Rulings: real geography/states/climate REAL; homeland may be the United
   States per preset; foreign nations and named military units FICTIONAL
   permanently; service branches real by NAME only (no insignia); bases
   real by name; companies, decorations, attended universities
   realistic-fictional; politicians/media/celebrities/private individuals
   fictional always.
3. Two narrow constitution amendments land with W2, not before:
   MILITARY_AND_WAR_FOUNDATION §3 scopes "fictional" to FOREIGN countries;
   CLAUDE.md §3 distinguishes branches (preset-real, name-only) from units
   (always fictional).
4. Engine logic never branches on a preset name; everything preset-specific
   lives on the spec. Implementation order W1 (extraction, zero behavior
   change for Classic) → W2 (Heartland) → W3 (place depth), AFTER the P/D
   arcs per ADR-0018.

**Rationale.** The charter always said "realistic simulated United States"
— the fictional homeland was L4-M1's deviation, now made a preset choice
rather than a constant. The fictional-foreign-wars line holds because
generated wars with real countries would fabricate history onto permanent
records (R-14), which no preset may do.

---

## ADR-0025 — Capture, captivity, and the Prisoner of War Medal

**Date.** 2026-08-02. **Status.** Accepted.

**Context.** ADR-0024 admitted the owner's awards pack but held two items:
the Prisoner of War Medal and the Air Medal. Both were held for the same
stated reason — his rule is that no award exists that cannot be earned, and
neither had a system behind it. The POW Medal needed a capture system. Until
now a month that went wrong on deployment ended in a wound or a death, which
quietly asserted that no war this simulation runs has ever taken a prisoner.

**Decision.**

1. **Capture is the third thing a bad month can end in.** Enemy contact
   only — an accident does not hand anybody over — and it REPLACES the
   wound rather than adding to it, because the capture is what happened to
   them that month. Roughly one in fourteen of the serious contacts that
   were already going to hurt somebody.

2. **A captive's tour stops running on the calendar.** `capturedAtTick`
   lives on the deployment. A prisoner does not come home because the orders
   said this month, is not accruing contact, and is not on the roster the
   war can spend.

3. **Captivity ends two ways, and the war's end is the wide door.**
   Repatriation, or death held. Prisoners go home when the shooting stops; a
   captivity that outlived its war by decades would be a different and much
   darker system than this one models, and we are not building that one. A
   test runs 25 captivities out fifty years and asserts nobody is still held.

4. **The medal is granted at CAPTURE, off the capture event.** Not at
   repatriation. A man who dies held earned it the same as the one who walks
   out, and hanging it on the way out would quietly say otherwise.

5. **The Air Medal stays held.** It needs an aviation unit. The earnability
   test now asserts `'pow'` is in the union and `'air'` still is not — the
   rule enforced in both directions.

**Consequences.** SIMULATION_VERSION 48: the extra draw shifts every seed
where the Republic fought. SCHEMA_VERSION 25 with a real migration — every
migrated tour is set free, because no build before this one could take
anybody, and guessing otherwise would invent captivity that never happened.

---

## ADR-0026 — Aviation, the Air Medal, and the end of the HOLD list

**Date.** 2026-08-02. **Status.** Accepted.

**Context.** The second of ADR-0024's two held items. The Air Medal and the
aircrew badges had no system behind them, and the owner's rule is that no
award exists that cannot be earned.

**Decision.**

1. **Two flying trades, not one.** `aviator` (college-entry, twelve months
   of schooling) and `aircrew`. Their exposure profiles are the honest shape
   of the job rather than a flat "dangerous": an aircraft is never in a
   convoy, is rarely in a firefight, and the machine itself is the hazard —
   accidents dominate both profiles.

2. **Contact for aircrew is a mission flown into it.** The month that gives
   a rifleman a firefight gives them a sortie: `aerial-mission`, recorded,
   and the Air Medal grants off it.

3. **The Air Medal repeats.** The real decoration is awarded again and again
   to the same aircrew — the clusters are the usual case — and the grant
   helper's own count carries it, so a long tour of flying reads as one.

4. **The Nighthawk Squadron**, air-guard tier 2, fed by the Guardian Flight
   and gated behind Flight School's senior aviator badge. Fictional name,
   permanently, like every named unit in every preset (charter §3).

5. **The HOLD list is now empty**, and the earnability test asserts it in
   both directions: a kind in the union must have a grant, and a kind
   without a system must not be in the union. Any future award waits for its
   system the same way.

**Consequences.** SIMULATION_VERSION 49 — new trades change who takes which
job at enlistment and which civilian career follows, so every seed's working
lives differ, not only the ones who flew.

**Two things the work turned up.** The first draft pointed the aviator trade
at a `pilot` civilian job that does not exist in `OCCUPATIONS` — a promise
the veteran could never collect on. The test now walks every specialty
unlock against the occupation list, and it immediately caught a second one.
Separately, the lifetime-savings ceiling turned out to be tuned to a single
draw; it was measured across five seeds ($540k–$1.62m) before being widened,
rather than moved to get a green result.

---

## ADR-0027 — M-ECON: money belongs to people, and the economy is weather

**Date.** 2026-08-03. **Status.** Accepted.

**Context.** Before this module the whole simulation held one number for
money: a household balance. Nobody owned anything, nothing was taxed, prices
never moved, and a recession was a word the news could not use because there
was no recession to have. Six phases, built together, replace it.

**Decision.**

1. **Money is personal, not architectural.** Every person has checking,
   savings and a retirement account (`Accounts`, keyed by person). The
   household balance survives as what the roof costs and what the roof has,
   because rent is genuinely a household fact — but a wage lands in a
   person's account and leaves with them. `finances.ts` remains the single
   writer; nothing else in the engine may move a cent.

2. **Tax is withheld monthly and settled in January.** Progressive brackets
   in `tax.ts`, a sales tax on discretionary spending, capital gains on
   realized brokerage gains only, and an estate tax at inheritance. A refund
   or a bill arrives every January, which is the point: it is a month that
   feels different from the other eleven.

3. **The economy is a seeded state machine**, built like the conflict
   machine in geopolitics — expansion, peak, recession, depression,
   recovery, drifting over years. A downturn takes jobs; a central bank
   moves the rate savings earn and loans are priced from; prices compound
   with inflation and wages move with them through `atTodaysPrices`.

4. **Four fictional sectors**, with their own volatility, beta and war
   sensitivity, one of which moves against the others in a war. A brokerage
   account is taxed on the way out; a retirement account never is, which
   over lives this long is the entire reason it exists.

5. **A credit score is DERIVED, never stored** — read from months paid,
   defaults, and what is owed right now, so it cannot drift from the
   history that justifies it (Law 3). It follows the criminal-record rule
   (C3 §5): a score is a DOOR, and a shut door can be walked back through.
   A poor file makes borrowing dear before it makes it impossible.

6. **A level loan payment is SEARCHED FOR, not solved.** The textbook
   formula needs `Math.pow`, whose precision ECMAScript leaves
   implementation-defined — the same mortgage could amortise differently in
   two browsers. `monthlyPaymentFor` bisects over an integer simulation of
   the loan instead, and `purity.test.ts` keeps `Math.pow` out.

7. **Shocks are asked, not inflicted.** A medical bill, a scam, a roof.
   The player chooses to pay it or carry it; carrying it writes an ordinary
   personal loan rather than a second kind of debt. NPCs meet the same bill
   on the same numbers, which is the parity rule.

**Consequences.** SIMULATION_VERSION 78 and SCHEMA_VERSION 32, with five
migrations (28→32). Every seed's lives differ from v76 in what they earn,
keep, owe and own. The Money tab gains a second view — the BANK — beside the
existing household ledger, because "where did it go" and "what do I have"
are different questions.

**Three things measured rather than guessed.** Phase 1 collapsed a town from
110 people to 35: the household balance clamped at zero with nothing
absorbing a bad month. Phase 2 left a median net worth of $463 because
spending was drawn against gross income while the money arriving was net.
Phase 3 collapsed a town again — prices inflated sixfold over a century
while wages stayed flat. Each was found by printing the number first, and
each band in the tests carries the measurement that set it.

---

## ADR-0028 — Bankruptcy, homelessness, and the floors under a life

**Date.** 2026-08-03. **Status.** Accepted. **Supersedes** the Law-7 arrears
write-off introduced with SIMULATION_VERSION 80, on the owner's explicit
written authority to overrule it.

**Context.** Playing the economy build turned up two absences that were never
design decisions. There was no state pension, so every non-veteran retirement
ended in destitution — a man who retired at 66 with $134,703 was broke inside
eight years, which made "retire or keep working" a trap. And there was no
floor of any kind under a household that stopped earning, so arrears
free-fell: one reached **−$606,276 over seventy-nine months** with no month in
any future that could clear it.

The v80 fix — write the debt off after two years — stopped the number being
absurd and left the mechanism dishonest. Debt does not evaporate on a timer.
A silent reset is not a recovery path; it is a hack wearing one.

**Decision.**

1. **Three floors, generically named** (charter §3 — the structure of a
   safety net is public policy and fine to model; no trademarked program
   name or restricted dataset appears anywhere). A **state pension** from 65
   scaling with months actually worked; **unemployment insurance** at 45% of
   the last wage for six months, and only after a *layoff*; **public
   assistance** topping any adult up to a bare floor. The first two are
   earned, the third is not, and that distinction is modelled.

2. **Insolvency is resolved through a system, always.** A **chapter 13**
   plan of three to five years for somebody with something spare at the end
   of the month, or a means-tested **chapter 7** liquidation for somebody
   with nothing. An automatic stay while either runs. A plan can be
   **dismissed** when it cannot be kept — which is the honest failure mode
   and what makes the whole thing bounded.

3. **Homelessness is a state, not a crash.** A household with nowhere
   cheaper to go loses its housing rather than being billed for a house it
   is not in — which is what stops the free-fall at its source. It costs a
   shelter figure instead of rent, and it is felt: triple the illness rate,
   more injury, marriage strain, and heavier crime pressure. Income buys a
   room back, and the test measures that people do climb out.

4. **A filing is a door, not a punishment** — the same rule the criminal
   record uses (C3 §5). Seven years for a plan, ten for a liquidation,
   fading the whole way, then gone.

**Consequences.** SIMULATION_VERSION 81, SCHEMA_VERSION 33, one migration.
`debt-written-off` is no longer written by anything and survives only so old
saves still read back.

**Five things measured rather than guessed**, each of which was wrong first:

- The deepest arrears anywhere across four centuries went **$606,276 →
  $25,344**, and what remains belongs to households mid-resolution.
- A household barred from refiling used to `continue`, and free-fell anyway.
  It loses the housing instead.
- Re-housing on the old affordability rule (rent plus *one* adult) bounced
  families in and out **2,500 times**; requiring the whole month's costs cut
  it to 429.
- The means test on **gross** income put every insolvent household onto a
  repayment plan, including those with nothing to pay one from: 460
  dismissed against 31 completed. It runs on **disposable** income now.
- And the one that mattered most: the settle skipped anybody with no wage
  *before* support was considered, so **the floors were counted in household
  income and never actually paid to anyone**. A household with $647 coming
  in went $250 further behind every month.

---

## ADR-0029 — Civilian careers brought up to the military's depth

**Date.** 2026-08-04. **Status.** Accepted.

**Context.** Civilian work was a list of jobs with pay bands and a record
that went hired → annual raise → fired. The military career beside it has
ranks, a promotion board, schools, tours and awards. A shop clerk had a wage
and nothing else for fifty years.

**Decision.** Build the civilian parallel, one for one — rank ladder → job
ladder, board → annual review, time in grade → months in the rung, specialty
→ track, deployments → work moments, discharge → quitting, being let go, or
going into business for yourself.

1. **Nine tracks, twenty-nine new rungs.** A rung is an ordinary occupation,
   so hiring, pay, tax and the ledger needed no changes; what is new is that
   occupations know what comes next. Pay stays in `content.ts` — a ladder
   carrying its own pay table would be a second source of truth.

2. **The review is the board.** Performance and time in the job, leaned on
   by the economy so a boom opens doors a slump keeps shut. Meeting the bar
   is not being chosen, and being passed over is recorded.

3. **Ten work moments, each with its own copy.** The rule the crime scenes
   were rebuilt to enforce, applied to work: no line is shared between two
   moments. A test proves it and caught three shared labels on the first run.

4. **Applying opens an interview.** Three ways to play the room, and which
   one works depends on whether the job is a reach. The offer that follows
   is a card of its own. `jobBar` gives the Openings list the same refusal
   the button gives — the `offenceBar` pattern.

5. **Business is the other road.** Five scales from freelance work to a
   contracting firm, bought with real capital, riding the cycle directly,
   able to fail, and passing to an eldest child — the only thing in this
   world that keeps earning for somebody who did not build it.

6. **A Career tab**, the Service tab's civilian twin. Pay shown yearly and
   paid monthly throughout.

**Consequences.** SIMULATION_VERSION 85, SCHEMA_VERSION 35, two migrations
(the ladder, and the register of businesses). Every working life in every
seed differs from v81.

**Four things measured rather than guessed.** Promotions run 92 against 88
pass-overs across three seeds and seventy-five years, with people standing on
every rung. Work moments fire 2,080 times, all ten kinds, about one every
three years per worker. A work-moment raise had to be **clamped to the
occupation's band** — a counteroffer really can beat the band, but pay that
drifts past the ceiling compounds over fifty years. And business survival
was **93 per cent** at the first setting, which no small trade has ever had;
at the second it is 58 per cent, with the failures having a median life of
seventeen years.

**One leak a test caught.** Businesses passed on through `distributeEstate`,
which only runs when a death empties a household — so a business went on
trading for decades under an owner who had died with somebody still in the
house. It now passes on every death.

---

## ADR-0030 — A grown adult's money is his own; the household is a building

**Date.** 2026-08-03. **Status.** Accepted (owner direction).

**Context.** The owner, playing: *"I hate how our money is displayed. It
should show just your money, if you have a wife then your wife's money. This
is a life simulator — why would my parents control my spending when I'm a
grown man after 18?"*

He was right, and the bug was structural rather than cosmetic. Money was
owned by the HOUSEHOLD. A twenty-six-year-old with a job, living at home,
had his wages pooled with his father's and his spending stance set by
whoever the household head was. The screen was reporting the model
accurately; the model was wrong.

**Decision.** The unit of money is the **financial unit**, not the
household. A financial unit is a person, plus a spouse or partner where one
exists, plus dependants — and dependency is decided by INCOME, not by age or
by address.

1. **A household is a building.** It keeps the roof, the rent and who lives
   under it. It no longer keeps a purse.
2. **A partner shares.** Spouses and courting partners are one unit;
   marrying merges two units and separation splits them.
3. **A dependant is somebody with no income of their own.** A child under 18
   is a dependant. So is a grown child with no job. A grown child WITH a job
   is his own unit under his father's roof — which is the case the owner was
   complaining about.
4. **Rent splits by income share**, so a working adult at home contributes
   rather than either paying nothing or paying everything.
5. **The spend stance belongs to the person**, and each unit sets its own.

**Consequences.** SIMULATION_VERSION 90, SCHEMA_VERSION 36, one migration
(the stance moves from household to person). Every seed's balances differ.

**The measurement that caught the real bug.** The first cut used the
existing `ADULT_COST_AGE` of 16 to decide dependency, and the founding town
collapsed from 159 people to 50 inside a century: sixteen-year-olds became
their own financial units, carrying adult living costs against no income,
and starved. Dependency is about income, not age — that is not a tuning
detail, it is the whole distinction the ADR is about.

---

## ADR-0031 — Enlistment is a recruiting station, not a menu

**Date.** 2026-08-04. **Status.** Accepted (owner spec: `enlistment_branches_master.md`,
`officer_moments_written.md`).

**Context.** Enlisting was one question with eight answers. Every trade was
open to everybody, a degree silently commissioned you, and the branch was
whatever the trade happened to belong to. The most consequential decision in
the game was one click, and a rifleman and a signals operator had the same
career and read the same words in the same firefight.

**Decision.** Model the actual pipeline, and let the job matter afterwards.

1. **A pipeline, not a menu.** Commission fork → which service → the entry
   test → a trade the score opens. Each step is its own pending, so a player
   who closes the tab half way through comes back to the same question.
2. **Twenty-two enlisted trades with real job codes** (11B, 68W, BM, 15A),
   each with an aptitude gate, a schooling requirement, a scene pool and an
   exposure profile. **Real codes and titles are permitted; named units stay
   fictional** — the charter §3 line is about units, not job titles.
3. **An entry test, deterministic from the seed and the person.** Schooling
   is most of it, temperament is the rest, and a seeded ten either way is
   the day they had. It is asked for repeatedly and always answers the same,
   which is what makes an eligible-job list replayable.
4. **Twenty-six officer roles across three accession models** — the naval
   service selects a community, the ground service branches on merit, the
   air service assigns by need and competes the rated seats. Same screen,
   three different weights behind the same question.
5. **The trade decides which moment you meet.** Every combat scene carries
   the same tags the trades do. A medic reaches a casualty; a signaller has
   a dead net and an antenna on the roof; a mechanic has a vehicle down in
   the open. Two officer moments are command decisions and are offered only
   to people in command.
6. **An accident can be a decision.** Accidents used to resolve entirely
   over the player's head, which is right for a rollover and exactly wrong
   for the thing that actually kills aviators. The gate is the trade's own
   tag: no scene for your job still means no moment.
7. **The Service tab before enlistment is the recruiter's wall** — every
   trade with its code and what it wants on the test. It shows no score,
   because they have not sat it; it does grey what their schooling shuts,
   because they already know whether they have a degree.

**Consequences.** SIMULATION_VERSION 92, SCHEMA_VERSION 38. One migration
back-fills an entry score of 55 and a track onto every existing record — a
flat number rather than a derived one, because a derived score would be a
claim about a test this person never sat, and Law 3 says the record holds
what happened. Officer and enlisted pay tables were repriced in the same
arc, after the owner caught that only civilian pay had been fixed and an E-8
was earning less than a shop clerk.

**One bug the acceptance tests caught.** The branches do not gate equally at
the bottom — the air service starts at 40 and the ground service at 31 —
so somebody scoring 35 who picked the air service walked into a blank wall:
empty trade menu, no record written, pending consumed. The branch menu now
only offers a service with something open.

---

## ADR-0032 — The twelve-year wall: indefinite or out, and it wants SGT

**Date.** 2026-08-04. **Status.** Accepted (owner direction).

**Context.** The owner: *"after 12 years of service you must either become
indefinite or get out. This is how they do it in real life. And SGT is the
rank that should be the safe spot — if you make SGT and have 12 years+ you
can be indefinite. CPLs can not become career CPLs."*

The game had none of this. A career was an unbounded series of four-year
contracts, and the only up-or-out rule was high-year tenure, which measures
time IN GRADE — so a corporal promoted at year eight was clear of it and
could draw a wage as a corporal until the thirty-year ceiling. Indefinite
status existed but was keyed on grade 7 alone, with no reference to years.

**Decision.** Twelve years is a wall, and grade 5 is the gate through it.

1. **`INDEFINITE_AT_YEARS = 12`.** There is no thirteenth year on a term.
2. **`INDEFINITE_MIN_GRADE = 5`** — SGT on the ground ladder, PO2 at sea,
   SSgt in the air. The owner's rule is about a RANK; the code enforces a
   GRADE, because that is the one number all three ladders share, and a
   test pins SGT to it so the two cannot drift apart. CPL is grade 4,
   sitting alongside SPC, which is exactly why a corporal cannot pass.
3. **`indefiniteStandingFor(grade, years)`** returns `contract`, `elect` or
   `barred` — one function, so the screen offering the choice and the
   handler enforcing it cannot disagree about who gets through.
4. **At the wall there are no terms to choose.** `reenlistEligibility`
   returns an empty term list for the eligible and RE-4 for everybody else,
   with a reason that says it is the grade and not the conduct.
5. **The player's verb changes.** "Sign on again" becomes "Go indefinite",
   and the scene says out loud that indefinite carries no term and
   therefore no term bonus, rather than quietly not paying one.

**Consequences.** SIMULATION_VERSION 93, SCHEMA_VERSION 39. Both goldens
move: every town's serving population differs, because the careers that used
to run out to thirty years at grade 4 now end at twelve.

**Verified, not assumed.** A forty-year run across three seeds contains no
serving enlisted member past twelve years below grade 5, and still contains
long careers above it — the test asserts both, because the first claim alone
would pass in a world where nobody served twelve years at all.

**One trap worth recording.** The indefinite contract carries a term of
zero. Passing that through to `reenlist` set `termMonthsLeft` to zero and
fired the term's end again the same month, for ever; the call site sends
`undefined` instead, which keeps the standing term as a heartbeat nobody is
ever asked about.

---

## ADR-0033 — A conviction reaches the hiring desk; an heir gets their own life

**Date.** 2026-08-04. **Status.** Accepted (owner, playing).

**Context.** Two complaints, one of which turned out to be a symptom of
something worse.

*"It also doesn't seem like convictions are affecting people's ability to
get jobs either."* True. A criminal record dragged the odds that an
opportunity turned up at all — and did nothing else. A convicted felon could
still be hired as the town constable, teach its children, or keep its books,
and the player's own applications through the Career tab never read the
record at all.

*"Can we change the when you graduate high school you instantly get offered
a job? It should ask you the go to college question with the enlist option
and stuff that comes after that first."* Also true, and the cause was not
the employment system. `hasAnswered` — the check behind every once-in-a-life
question — scanned the player's decision log unscoped. **The log is never
cleared on succession**, deliberately, because it is the dynasty's record.
So an heir inherited every flag their parent had set: the fork at eighteen
was never offered to them, nor was the walk into the recruiting office, and
the employment system simply handed them a job instead. This is the fourth
time an unscoped read of that log has produced a bug.

**Decision.**

1. **`PlayerChoice.personId`.** A once-in-a-life question belongs to one
   life. `hasAnswered` scopes to the person being played.
   **An entry with no owner answers for nobody** — the deliberate choice
   over back-filling the current player, which would have been tidier and
   would have left every existing save's heir still stuck. The questions
   carry their own age and level gates, so a stale one simply never fires.
2. **`TRUST_SENSITIVE_OCCUPATIONS`** — the roles that in practice require a
   clean record: sworn positions, children, licensed care, other people's
   money. A hard record gate shuts these and **nothing else**. Law 7 is the
   reason for the second half: a man with a conviction can still lay
   bricks, cook, drive and run a crew, and a record that closed the whole
   labour market would be a dead end rather than a chapter.
3. **The town lives under the same rule** (Law 1). The NPC hiring path
   filters the same list, so the world does not quietly staff its school
   and its police station with people the player is refused alongside.
4. **The fork at eighteen comes first.** No job offer is raised for a
   player who still owes the education question. Once answered — including
   answered with "work" — offers resume normally. One reader,
   `educationForkPending`, so the employment system cannot decide the fork
   is over while the schoolhouse still intends to ask.

**Consequences.** Folded into SIMULATION_VERSION 93 and SCHEMA_VERSION 39
with ADR-0032. Hiring differs in every seed.

---

## ADR-0034 — A job offer is an offer

**Date.** 2026-08-05. **Status.** Accepted (owner, playing).

**Context.** *"When you get the job it just says the 'job opened up' — it
should really be saying congrats they have extended a job offer and it tells
you to accept, decline, or wait."*

The prompt read "There is an opening for a shop clerk", which is what the
newspaper says, not what somebody says to you after they have decided they
want you. And the two answers were take it or lose it.

**Decision.** The words say somebody chose you. A third answer, `wait`, holds
the offer — the same job, the same money, the same employer — for
`OFFER_WAITS_ALLOWED` months, after which the option disappears from the
menu rather than silently failing. An employer waits, but not indefinitely,
and the screen says which month it is.

**Consequences.** Player-path only; rides the schema version.

---

## ADR-0035 — A house can be bought with money

**Date.** 2026-08-05. **Status.** Accepted (owner, playing).

**Context.** *"When you go to the bank to buy a house it makes you buy it as
a mortgage no matter what and then it forces you into a repayment plan and
there is no way to pay for the actual house. This is a real issue."*

It was worse than an omission. `buyHome` took a mortgage unconditionally,
and the mortgage's **eligibility check ran before any money changed hands** —
so somebody sitting on the full price in savings could be refused the house
entirely, because the bank would not lend to them.

**Decision.** `buyHome` takes a method: `cash` pays the whole price and
creates no loan; `mortgage` is what it always did. `homePurchaseBar` answers
why either is shut, in the bar pattern, so the greyed button and the refusal
cannot disagree — and the cash refusal says how many dollars short they are
rather than "the purchase did not go through". The Bank offers both.

**Consequences.** Player-path only. Existing callers default to `mortgage`,
which is what they meant.

---

## ADR-0036 — The phantom household member

**Date.** 2026-08-05. **Status.** Accepted (found by the invariant sweep).

**Context.** A new invariant sweep over five seeds and sixty years found
households listing people who lived somewhere else. Reproduced at seed 4141,
tick 533: household 626 held `[502, 505]` while 505 lived in 627.

**Cause.** `runHouseholds` iterates `livingPeople(world)` — a snapshot — and
`moveInWithPartner` writes the **partner's** householdId as well as the
mover's. When that partner's own turn came round the loop was still holding
the object captured before the move, so `householdOf` read the household
they had already left, `leaveHome` built them a third household out of it,
and the one they had just moved into went on listing them for ever.

This is not cosmetic. Rent splits by income share, household income and
costs, the financial unit (ADR-0030) and the estate all count that list.

**Decision.** Re-read the person from the world at the top of each
iteration. Two lines, and the sweep that found it stays in the suite.

**Consequences.** SIMULATION_VERSION 94. Both goldens held across the fix
itself — the collision does not occur inside their 240-tick horizon — and
moved only because the version field is part of the hashed bytes.

**The lesson worth keeping.** Every other invariant in that sweep passed.
This class of bug — a loop mutating what it iterates — produces no error, no
test failure and no visible symptom; it just quietly makes the numbers
wrong. The sweep is the only thing that would ever have caught it.

---

## ADR-0037 — The Article 15: a paper you sign, and a bridge from the courthouse

**Date.** 2026-08-05. **Status.** Accepted (owner spec: `article15_paper_spec.md`,
`article15_paper.html`).

**Context.** The M-ARMY2 misconduct pass already produced everything a
company punishment needs: the `'disciplined'` event, the busted stripe, the
third-mark discharge, and real infraction text. What it had never had was a
document. The single most consequential thing that can happen to a serving
player short of a wound arrived as one line in the story log — less ceremony
than a promotion board.

And the crime system and the service system stood side by side saying nothing
to each other. A soldier could be convicted in the town's courthouse and the
orderly room would never hear about it, which is exactly backwards: the
services punish members for civilian offences, and that is what nonjudicial
punishment is *for*.

**Decision.** One new paper, one player-only pending, one read-only bridge.
The discipline maths, the three-strike discharge and `crime.ts`'s ownership
of `world.criminal` are untouched.

1. **`article15For(world, personId, tick)`** returns plain data, like
   `contractFor` — command, station, name, the grade before and after a
   bust, the offence, the numbered findings, the mark number, the control
   number. The component writes nothing. Returns `undefined` when no such
   punishment exists, so a rewritten record cannot produce a document about
   a thing that did not happen.
2. **`Article15Sheet.tsx`** in the paper family, reusing the `.contract-*`
   classes. No new look: a service life accumulates documents and they
   should read like documents from the same office. The crest is an
   invented device, never a seal (charter §3).
3. **Anti-spam, which the owner asked for explicitly.** The paper is raised
   only for a **stripe bust** or a **civilian conviction**. Late off leave
   stays the quiet story line it already was, and NPCs never get the paper —
   it is a player surface, the record is everybody's.
4. **The bridge lives in `service.ts`**, not `crime.ts`. Single writer
   preserved (DOMAIN_MAP §2): `crime.ts` owns the criminal record and never
   touches rank; this reads it and writes the service record, which is its
   own. A conviction with **no confinement** becomes a company punishment
   and counts as a strike like any other. A conviction **with** confinement
   does not — the soldier is already off duty and that belongs to the
   separation path.
5. **Signing is not agreeing.** One option, `acknowledge`. Nonjudicial
   punishment is imposed by the commander; the stripe is gone before the
   paper reaches the screen, consistent with the module's own rule that the
   punishments are never a choice. The accept-vs-demand-court-martial fork
   the spec flagged as optional is deliberately **not** built: it opens a
   court-martial branch and shifts that philosophy.

**Consequences.** SIMULATION_VERSION 95, SCHEMA_VERSION 40. Both goldens
move for a real reason this time — NPCs take the mark too, so every seed's
service records differ.

**Two traps hit while building it.** The bridge fires **the month after**
the conviction, because `runService` runs before `runCrime` in the tick — a
conviction handed down this month is not on the commander's desk until next
month, which is also how it works. And `article15.ts` could not import
`rankTitle` from `service.ts`: that module imports `player.ts`, which
imports this one to render the paper, and the import ratchet caught the
cycle immediately. The ladder is read inline instead, the same trick
`health.ts` and `finances.ts` already use.

---

## ADR-0038 — A bankruptcy plan you can see, and one you can pay off

**Status:** Accepted · **Date:** 2026-08-05

**Context.** The owner, playing: *"There is still no way to payoff your
bankruptcy."*

He was right, and the gap was bigger than a missing button. A chapter 13
plan was **entirely invisible** once it started. Nothing on any screen said
what the payment was, how many months it had left, or what the court was
holding — the Bank showed accounts, loans and credit and simply omitted the
filing. The money left the account every month for three to five years and
the only surfaces the whole bankruptcy system had were the pending that asks
which chapter to file under, and a line in City Hall recording that you
filed.

That made the honest complaint hard to even phrase. The owner could not ask
"why can't I pay this off" until he noticed there was a *this*, and the only
reason he noticed was that he could not act on it.

The second half is the one he named. A real chapter 13 plan **can** be paid
off early: pay the plan base and the court discharges you. The engine had no
such path. The plan ran its 36–60 months and discharged on the calendar, or
it was dismissed because the household fell far enough behind — and dismissal
is the bad ending, not a way out. A player who clawed their way back to money
had nothing to spend it on.

**Decision.**

1. **The Bank shows the filing.** An *Under the court* card: chapter, owed at
   filing, the monthly payment, months left, and what settling costs today.
   A chapter 7 shows the first two and stops, because that is all a chapter 7
   has.

2. **`planPayoffFor` is the plan base still to run** — `planMonthly ×
   monthsLeft` — not the original `owed`. The months already paid were paid.
   Settling is settling the *plan*, which is what an early payoff is.

3. **`payOffPlan` takes the money and discharges the filing.** What is
   discharged is what the plan would have wiped at its natural end, so the
   record reads the same either way.

4. **The filing itself does not vanish.** It sits on the file for its seven
   years and the credit penalty runs its course. Paying early buys the months
   back and stops the money leaving; it does not buy a clean history, because
   that is not a thing money buys.

5. **One bar function**, `planPayoffBar`, drives both the greyed button and
   the verb's refusal — the house pattern. The refusal is the bar's own
   words: *"Settling the plan costs 4,200 dollars; you have 900."*

**Consequences.** A recovery arc that was a waiting room becomes a thing you
can act on, which is what Law 7 asks of the safety net. The dismissal path is
unchanged and still bounded — this adds a good ending, it does not remove the
bad one.

**Two things the tests caught, both worth recording.**

The chapter-7 message was ordered wrong. A chapter 7 is discharged at filing,
so the `dischargedAtTick !== null` check fired first and a chapter 7 filer was
told *"No plan is running"* — a true sentence that explains nothing. The
chapter check now comes first.

And the first fixture had no wage. `planPaymentFor` floors at one cent, so a
filer with no income got a plan costing 36 cents in total, and the payoff test
passed while proving nothing. This cannot happen in play — `chaptersOpenTo`
only offers chapter 13 to somebody with disposable income — but it is a
standing warning about fixtures that bypass the gate the feature sits behind.

**And a bug in the code this was copied from.** The discharge figure — the
sum the life story reports as written off — used `PLAN_MONTHS_MIN`, a flat
36, for every plan. But `planMonthsFor` returns anything from 36 to 60. A
sixty-month plan credited the filer with 36 months of payments they had
actually made 60 of, so the story told them a larger sum had been forgiven
than really was; at the sixty-month end it overstated the write-off by two
years of payments. It is now computed from the plan's real length,
`planEndsAtTick - filedAtTick`, in one helper both endings share.

This moved both goldens (Classic `967a2f7e` → `d7cbcfc7`, Heartland
`48030648` → `a04a7a51`), which is the proof it was reachable in ordinary
play rather than only in theory: NPC filings in the seeded towns were
carrying the wrong number.

---

## ADR-0039 — The career corporal came back through the orderly room

**Status:** Accepted · **Date:** 2026-08-05

**Context.** ADR-0032 built the twelve-year wall: indefinite or out, and
indefinite wants SGT. No career corporals — the owner's rule.

The wall guards the term's end, which is the door everybody was thinking
about. There is a second door. An indefinite **sergeant** who is busted a
stripe for misconduct becomes a **corporal still flagged indefinite**, and
the term-end handler returns early for anybody indefinite — so he is never
asked the wall's question again. Combined with the thirty-year ceiling
ADR-0032 gave indefinite careers, he serves to thirty years as a career
corporal.

Worth stating plainly: ADR-0032 made this worse. Before it raised the
ceiling, the same soldier was force-retired at twenty.

**Decision.** Losing the stripes loses indefinite status. Below
`INDEFINITE_MIN_GRADE`, the flag clears and the member goes back on
contracts; the next term's end asks the wall, which at twelve years and
grade four has one answer.

The bust is the only demotion path — promotion boards only promote, and the
court-martial fork was never built — so one guard closes it.

**The first version of this fix did not work, and that is the useful part.**

It wrote `indefinite: false` straight to the record at the bust. Measured
afterwards: 92 busts across five seeds and forty years, and **two career
corporals still standing.**

The service month ends with a single write that spreads `...record` — the
snapshot taken before any of the month ran. Every field NOT in that write's
explicit list is silently reverted. `rank` survives because it is listed;
`indefinite` was not, so the fix was undone the same month it was applied.

**Anything a service month decides must travel in a local**, not a write.
This is the second time a stale snapshot has produced a silent revert in
this codebase — ADR-0036 was the same shape in `runHouseholds`. It is worth
treating as a known trap rather than a surprise.

Re-measured after the real fix: **zero** below-line indefinite records.
Indefinite records fell 59 → 56, which is the three who now meet the wall
instead of coasting past it.

**And the test that should have caught it was already there, passing.** The
town-level rule test ran three seeds; both career corporals were in the
other two. It now runs five, and asserts on the `indefinite` flag directly
rather than inferring from years served — the bust reached the record
without going near the wall, so the years-based check was looking at the
wrong thing.

**Consequences.** SIMULATION_VERSION 96 → 97. Classic `d7cbcfc7` →
`ba7ac6ac`, Heartland `a04a7a51` → `9d5b5da6`. A busted senior NCO now has
a real cliff under him, which is the honest consequence of losing a stripe
late in a career.

---

## ADR-0040 — M-PROMO: three promotion systems, five schools that gate them, and a pyramid

**Status:** Accepted · **Date:** 2026-08-05

**Context.** Three owner specs, delivered as masters that override any
existing rule: `army_promotions_fix.md`, `promotions_all_branches.md`, and
the schoolhouse remodel. The headline: "the game currently treats promotion
as one thing (a board) at every grade. That's wrong."

**What was actually wrong, checked rather than assumed.** The game already
had two bands — automatic below `competitiveFrom`, points-and-cutoff above —
so E-2 → E-4 was mostly right already. Three things were not:

1. **`COMPETITIVE_FROM` for the land forces sat at 4, which is CPL.** Making
   corporal meant clearing a promotion-points cutoff: a board in all but
   name, and exactly the doc's headline complaint. The navy's 3 and the air
   force's 4 were already correct, because those branches genuinely differ —
   a navy E-4 *is* won on an advancement exam.
2. **No third band.** E-7 → E-9 ran the E-5/E-6 logic: an individual test
   against a cutoff rather than a competition for a fixed number of seats.
3. **No school gated any promotion at all.**

**Decision.** All six phases, per the docs.

- **Ladders to E-9** in all three branches. The officer ladders already
  matched the spec exactly and were left alone.
- **CPL is a lateral**, selective rather than automatic — "the commander
  names you."
- **Fourteen PME courses** with a `gatesGrade` field, using the classic
  mapping the spec recommends (each rank earned by finishing *its* school),
  with the post-2024 literal rule noted in code so nobody "corrects" it.
- **The school is a hard gate**, on the NPC path and the player's, with
  `schoolOwed` surfaced on the board standing for the bar pattern.
- **Band 3: the centralized selection board.** Annual, per branch, per
  grade, a fixed number of seats read off the whole file. Not selected is
  recorded as `passed-over`, which the cutoff penalty already reads.
- **Billets**: 1SG and CSM over E-8/E-9, CMC, Command Chief, Air Force First
  Sergeant. A tour runs 36 months and **reverts** — the part "just add two
  ranks" would have got permanently wrong.
- **Migration v40 → v41**, back-filling PME for grades at or below the one
  already held, dated to enlistment rather than to the upgrade.

**Four things measurement caught that reasoning did not.**

**NPCs had never attended a school in their lives.** The only doors were the
player's. Harmless while a school pinned a badge on; fatal the moment it
gates a grade. First measurement: one sergeant left standing out of fifteen
serving, 45 high-year-tenure discharges as stuck corporals aged out.

**PME entry bars were higher than the promotions they gate.** A
470-performance bar on the course gating sergeant — a rank won on *points*,
where seniority and awards carry a middling evaluation. A school is
education; the selection happens at the board.

**Every school booking was silently reverted.** ADR-0039's stale-snapshot
trap, walked into an hour after it was written down: `schoolId` is not among
the fields the month's closing write names. Measured at **zero bookings of
any kind across twenty-five years**. Carried in a local now, like
`indefinite`. Two for two on that trap.

**Making CPL automatic disabled high-year tenure.** Every specialist became
a corporal at twelve months, which reset the time-in-grade clock — so the
up-or-out rule for everybody below sergeant could never fire. Soldiers who
should have gone at six years in grade sailed to the twelve-year wall
instead. Two tests that had been guarding that rule caught it, which is what
they were for.

**Consequences.** SIMULATION_VERSION 98, SCHEMA_VERSION 41. The force is a
pyramid again — with the gate in and band 3 absent, seventeen of thirty-three
serving sat at E-7 or above. Verified at scale (2,500 people, forty years):
`E1:10 E2:11 E3:37 E4:38 E5:15 E6:25 E7:16 E8:7 E9:2`, with 1SG, CCM and
First Sergeant billets held.

**Two things left honest rather than tuned.** There is an E-6 bulge — that
band has no seat cap, so everyone clearing the cutoff piles at the highest
uncapped grade; in reality the monthly cutoff score moves to control the
flow, and the game's is fixed. And E-8/E-9 are unreachable in a small town,
because the seats are a fraction of the force: a four-hundred-person town
fields about twenty soldiers and rates no sergeant major. Both are correct
as far as the specs go, and both are worth revisiting.

**Not built:** the officer PME ladder (BOLC/CCC/CGSC and the naval and air
equivalents) is scoped in `promotions_all_branches.md` and deliberately left
out — gating officer promotion on courses that do not exist would stop every
officer career dead at O-1. `schoolOwedFor` returns early for the
commissioned, with that reason in the code.

---

## ADR-0041 — The flag: misconduct that closes the schoolhouse door

**Status:** Accepted · **Date:** 2026-08-05

**Context.** M-SCHOOL §3, which the owner's spec calls "the gate that ties
discipline to schooling (big interconnection)". While a soldier is flagged —
a suspension of favourable actions — they cannot be sent to school, be
promoted, reenlist, or receive an award.

It is the payoff of the Article 15 work (ADR-0037). Before it, misconduct
cost a performance number and a stripe; now it visibly shuts a door.

**Decision.** `flagStatus(world, personId, tick)` is **derived, never
stored** — each reason read from state its own system already writes, so
there is one owner per fact (DOMAIN_MAP §2). It closes the schoolhouse,
blocks promotion for player and town alike, holds reenlistment, and
suspends discretionary medals.

**Three judgements the spec does not make.**

*Which medals.* Suspended: the routine, discretionary ones a command decides
to give — good conduct, commendation, meritorious service. **Not** suspended:
the decorations that record something that HAPPENED — a wound, a campaign,
contact with the enemy, captivity, an act of valour. Heroism under fire is
not a favour the orderly room grants, and a Purple Heart withheld because
somebody was late to formation would be the game calling a fact a reward.

*Body composition is absent, not faked.* The spec lists it as a flag reason.
There is no weight or tape standard anywhere in this game to read, and
inventing one to satisfy a list would be building a system nobody asked for.
The type takes new reasons without changing its callers.

*A flag holds; it does not discharge* — for the reasons that lift on their
own. See below, because getting this wrong was the interesting part.

**Two bugs, both found by measurement rather than by reasoning.**

**The fitness bar was set above the middle of the army.** Chosen at 200 by
guesswork; the scores this game actually produces run 114 to 207 with a
median of 180. Fifteen of seventeen serving soldiers were flagged, and since
flagged means no school, no promotion and no reenlistment, the whole force
stalled below the first senior rung. Now 128, with a test asserting that
under half the army can be flagged at once. **This is the third time in one
session a number invented without checking its distribution turned out badly
wrong.**

**A permanently unfit soldier could neither reenlist nor leave.** Holding the
term for ANY flag was sound for an adverse action, which ages off in twelve
months, and wrong for a fitness failure, which does not age off at all — it
clears when the next test is passed, and a body that cannot pass never
clears it. Such a soldier sat out the rest of his career in limbo:
unpromotable, on frozen pay, his term ending and re-ending every month until
the thirty-year ceiling or age sixty-two removed him.

**A demographics test caught it, from three systems away.** Completed
families went 25.4% childless against a 25% ceiling — a metric with nothing
military about it. A stalled career is a life that does not start. Stashing
`service.ts` alone and re-running proved the flag caused it rather than the
bound being tight, which is the check that turned an apparent nuisance into
a real bug. The hold is now for the temporary flag only; a soldier still
failing the standard at the end of a term is not held, and the ordinary
eligibility check gives the career an honest ending.

**Consequences.** SIMULATION_VERSION 99. Classic `2a9315e1`, Heartland
`6b387a0b`. 916 tests green.

**Worth keeping:** this is the second time in one session that a guarded
invariant caught something well outside its own domain — the population
sweep found the phantom household member, and fertility found a reenlistment
trap. That is an argument for more of them.

---

## ADR-0042 — The schoolhouse: a seat you earn, a course you can fail, a tab that says so

**Status:** Accepted · **Date:** 2026-08-05

**Context.** The owner's `schoolhouse_remodel.md`, delivered as a master
spec. A school was a flat gate: clear the rank and the evaluation, wait for
a class, take the badge. Nobody was ever turned down for a seat and nobody
ever washed out.

**Decision.** All of it, in three commits — the model and content
(ADR pending in M-SCHOOL phase 1), the flag (ADR-0041), the attrition, and
the tab.

**§5, the failure.** Graduate, recycle, wash out or get hurt, on a seeded
roll salted by the course and the attempt. Performance and fitness buy
relief against the course's difficulty, which is what makes those numbers on
the record mean something. Measured through Ranger School, sixty soldiers:
41 graduated, 17 washed, 3 hurt, 28 recycled. Airborne passes over 90%.
Three rules from the spec: a recycle costs time and nothing else, an injury
drop does not spend an attempt, and a wash-out is a setback rather than a
wall.

**§6, the tab.** Grouped by category, because a flat list said nothing about
the difference between the course that makes you a sergeant and a selection
you can fail. Each card: what it grants or which grade it gates, duration, a
difficulty read, a scarcity read, a requirement checklist, the slot status,
and what this soldier has already tried here. The dot reads are deliberately
not numbers — "difficulty 420" means nothing to anybody.

**What is NOT built, and deliberately.**

*The officer PME ladder.* Scoped in `promotions_all_branches.md`. Gating
officer promotion on courses that do not exist would stop every officer
career dead at O-1, so `schoolOwedFor` returns early for the commissioned
with that reason in the code.

*Body composition as a flag reason.* There is no weight or tape standard in
this game to read, and inventing one to satisfy a list would be building a
system nobody asked for.

*NPCs volunteering for elective skill schools.* They attend PME and their
trade pipeline; Ranger, Sniper and Combat Diver are player-choice only. That
is pre-existing rather than introduced here, and it means wash-outs will
mostly be the player's own. The machinery does not care who is in the seat.

**Consequences.** SIMULATION_VERSION 100. 919 tests green.

**A note on numbers, earned the hard way.** Three separate values invented
in this milestone without checking their distribution turned out badly
wrong: the PME entry bars (which emptied the NCO ranks), the fitness-failure
threshold (set above the median of the army, flagging fifteen of seventeen
soldiers), and the school seat chance. Every one was caught by measuring
rather than by reasoning, and two were caught by tests in other domains
entirely. **Measure the distribution before picking the threshold** is not a
style preference in this codebase; it is the difference between a rule and a
bug.

---

## ADR-0043 — A major is not a corporal: one grade table, two ladders

**Status:** Accepted · **Date:** 2026-08-06

**Context.** The owner, playing: *"majors should not be getting kicked out if
they are past 12 years in service... I just got kicked out after 16 years of
an amazing career because I was a major."*

He was removed by the **career corporal rule**.

`BRANCH_GRADES` is the ENLISTED pay table. It was being indexed with an
OFFICER's rank index. A major sits at officer index 3, and enlisted index 3
is E-4. So the twelve-year wall (ADR-0032) looked at a major with sixteen
years, saw a specialist who had never made sergeant, and did exactly what it
was built to do. High-year tenure read the same wrong number, so a major with
six years in grade was up-or-out as well.

**The tables overlap for the first few rungs** — O-4 and E-4 are both "4" —
which is why the code read as correct and why no test caught it.

**Measured, before and after, across three seeds and forty years:**

| | before | after |
|---|---|---|
| officers barred from reenlistment | 21 | 2 |
| officers removed by high-year tenure | 24 | 0 |
| of 152 officers | **45 (30%)** | **2** |
| highest officer rank reached | **Major** | **Lieutenant Colonel** |

Nearly a third of every officer career in the game was ended by a rule
written for corporals, and **nobody had ever made lieutenant colonel** —
they were all separated at major first. The owner's sixteen-year career was
not unlucky; it was the norm. The two that remain are barred for age, a
conviction, or a misconduct record, which are real reasons.

**Decision.** One function, `gradeOf(world, record)`, reads the ladder its
owner is actually on. Every grade read goes through it. On top of that, both
the twelve-year wall and high-year tenure are declared ENLISTED rules and
skip commissioned careers outright — belt and braces, because the wall has
no meaning for an officer even with the right number.

**Consequences.** SIMULATION_VERSION 101. Classic `f5f7fa53`, Heartland
`e68c2f66`. 924 tests green.

**The lesson worth keeping.** Two parallel tables indexed by the same
variable name is a bug that cannot be seen by reading — it needs a value
that differs between them to expose it, and the first five rungs of these
two agree. The fix is not vigilance; it is one accessor that cannot be
called wrongly.

---

## ADR-0044 — The calendar is an input now: trades have an era

**Date:** 2026-08-13. **Status:** accepted. **Narrows:** ADR-0020 / W1's
"the start year is a label on the ticks, not an input to them".

**Owner's ruling.** *"Businesses should be able to populate over the years
so if SaaS isn't in 1970 just make it available only after a certain
year."* Asked whether the anachronistic business types should be trimmed
from the supplied design, the owner chose the better answer: keep them and
gate them by year, so the town's economy ages across generations.

**What this costs.** W1 established that nothing in the tick path reads the
calendar year, and a test asserted it: two worlds differing only in
`startYear` lived identical lives. That property is why presets were cheap
— it meant a start year could never change gameplay, only the dates
printed on it.

It is no longer true, and it should not be. Which trades exist is now read
from `toDate(world, tick).year`. A town founded in 1885 must not have a
computer shop on its high street at tick zero; a town founded in 2010 must
not be offered a typewriter repair business. Technology has a date, and
pretending otherwise to protect an invariant would be protecting the
invariant instead of the world.

**What still holds, and is what actually mattered.** The year is not a
source of RANDOMNESS and never enters a seeded stream. Same seed and same
start year produce a bit-identical world, every time — Law 11 is untouched.
The narrowed test in `w1.test.ts` asserts exactly that, plus the one thing
the year now decides, so the boundary is pinned rather than merely assumed.

**Why the year and not elapsed ticks.** Gating on ticks-since-start was the
alternative that would have preserved the old invariant. It is wrong: it
would put software companies in a 1917 town that started in 1885, and
typewriter repair in one that started in 2000. The era belongs to the
world's calendar, not to the length of the save.

**Retirement is the other half.** A trade past its era is not deleted from
the table — it can no longer be FOUNDED, and the ones still trading meet a
demand floor that falls over a decade to a fifth and stays there (Law 6:
history persists; Law 7: failure has a path out). The last video rental in
town grinds down while its owner decides what to do. That arc is the reason
to model retirement rather than dropping the type from the list.

**Also fixed under this change.** The wider NPC founding pool exposed a
latent bug: `decide` in `government.ts` seated whoever polled highest
without asking whether they already held another office. Candidacy is
screened when a ballot OPENS, but two can be open at once — somebody
holding nothing when both opened could win both. Seed-dependent, present
from the start, surfaced when the draw order shifted. Screened now at the
chokepoint every winner passes through.

---

## ADR-0045 — Control of a listed company costs more than the company

**Date:** 2026-08-13 · **Status:** accepted · **Version:** SIMULATION_VERSION 174

**Context.** The owner asked: *"is there a thing where If someone has so much
money that they can just buy up all the shares of a stock and do a takeover?
or own a certain percentage? isnt that a thing in real life"*. The pieces
were already in the engine and inert. Every `Stock` has carried
`sharesOutstanding` since the market was built and every `Holding` its
`units`, and no code anywhere divided one by the other. A player could hold
nine tenths of a company and the game would not notice.

**Decision.** A stake is `units / sharesOutstanding` in per-mille, computed
in one place (`stakePerMilleOf`) that the screen and the verb both read.
Two thresholds mean something: 250 blocks, 500 controls.

**The part that matters: the price rises as you take it.**
`controlPremiumPerMille` is nil below a tenth and then quadratic, and
`costToReachPerMille` walks the climb in per-mille steps rather than solving
it, because a single multiplication would quietly charge the opening price
for the whole ascent. The consequence is measured rather than asserted:
buying an entire company costs strictly MORE than its market capitalisation
(`takeover.test.ts`).

**Why that is the whole design.** A takeover priced at exactly market cap is
arithmetic, not a decision — anybody holding the money would simply do it,
and there is no question anywhere in it. Making the last tenth hurt is what
turns it into "do I want this badly enough", which is the only reason to
model it at all.

**Dividends were already right and were left alone.** `dividendOn` pays on
the value of the holding, so control already receives in proportion. A
separate "control dividend" would have been a second source of truth for a
fact the ledger already knows — the exact disease the housing trio caught
six times.

**The reverse case is the story half.** `runRaiders` gives the richest person
in town who is not the player one look a year at whatever the player floated,
and the money to act on it. It pays the same rising premium out of the same
wallet everyone else spends from, and both sides of the moment go on the
record: `took-control` for them, `lost-control` for the player. That is the
reason to keep a holding after the bell instead of selling the lot.

**Found while verifying this change, and fixed with it.** A live save had a
software company holding **$95.5 million** of capital against a trade ceiling
three orders of magnitude below it. `runBusinesses` had always capped
RETAINED profit at the ceiling; `investInBusinessPlayer` wrote straight to
`business.capital` with nothing checked. Any player with outside money could
therefore ignore the wall completely, and since a month's takings scale with
capital, the business earned without bound — which made the capacity ladder
the owner asked for purely decorative. Deposits now fill only the room that
is actually there, CLAMPED rather than refused: climbing the ladder spends
the till, so a business at its ceiling drops below it the moment a step is
bought and can be topped up again. A refusal would have soft-locked it.

This is the same shape as the housing ledger and the shadow-wallet bugs: one
road into a value enforces the rule and a second road writes the raw record.
The rule has to live where both roads meet, or it is not a rule.

---

## ADR-0046 — A business is an asset, a job, and not a money printer

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 175

Five reports from one session of play, all of them about a business that had
outgrown the systems around it.

### 1. A business could outgrow the town and become unsellable and unlistable

> *"I also have a company right now worth 75 million that is in the freelance
> cannot IPO or sell because nobody has the money to afford it, all companies
> should be able to IPO and stuff and be able to be sold to an NPC"*

Two independent gates, both shut on the same business.

`scaleUpBar` refused on a **whitelist of two trades** — `shop` and
`contracting-firm`. Everything else was permanently a "trade", and a trade
does not list on an exchange. So a freelance consultancy worth seventy-five
million could neither incorporate nor float. **The kind gate is deleted.**
The capital gate already says "big enough" and says it for every trade,
which is what the whitelist was clumsily approximating.

`buyersForBusiness` only ever offered **townspeople with the cash in hand**,
and a town of a few hundred does not hold seventy-five million between them.
An **outside acquirer** now always bids: institutional money from beyond the
world, the same fiction the Series A investors already use, paying 700
per-mille of valuation against a local rival's 1150 — a rival buys the
competition and pays for it, a firm buys the numbers. `buyerId` is still a
real person, the local the firm installs to run it, so employment,
inheritance and the rival market keep working on the machinery they have.

### 2. The business was invisible in the money

> *"You still need to count the income we draw from the company as income
> net worth included this is an asset"*

`netWorthOf` counted a house, a fund and a share of a listed company, and
counted the thing the player actually built at **zero**. It now includes
their slice of every business they own — their slice, because once backers
are on the register part of that value is somebody else's, and the cap table
knows exactly how much.

The draw is now **taxed**. It was credited and nothing else: no tax year, no
return, no record it had ever been earned, so a business owner paid tax on
nothing while a wage earner paid on every cent.

**`businessDrawOf` is deliberately NOT part of `personalIncome`.** That
function feeds the household pass, which CREDITS what it reports, and
`runBusinesses` has already paid the draw. Counting it there would pay it
twice — the exact shape of the shadow-ledger family of bugs. It is income
for the purpose of being seen and being taxed; the crediting keeps one
writer.

### 3. A big business is a full-time job

> *"when someone starts to have a big company say like worth 2 million they
> shouldnt be able to work a full time job too, businesses take time"*

Past two million (base-year cents, so it means the same in 1970 and 2030) a
business takes every hour there is: no new work, and anybody already holding
a job leaves it. **Not a pending question** — he asked for fewer
interruptions in the same message — but a consequence with a line in the
feed. The same rule binds the town, because a rule that only binds the
player is a penalty.

### 4. Scaling was multiplication

> *"it feels so easy to scale a business. Run a test on your own and find
> ways for it to be more challenging"*

**Measured first.** An active player founding a shop and climbing the
capacity ladder every year reached **$23.7M and $34.6M** inside ten years
against a ten-million IPO gate; a passive owner reached $1.2M. So the ladder
was doing its job and the RATE was wrong — the gate was a formality.

One line caused it: earnings were **linear in capital, for ever**. Ten times
the money in the till made ten times the profit, which also implied
something plainly untrue about a small town. Capital now earns at full rate
to four times what the trade costs to open, then three fifths, then a third
(`earningBaseOf`). Re-measured: **$13.8M and $19.3M** — still reachable,
no longer inevitable. Every per-mille lever (price, staff, expansions,
vendor, advertising) is untouched, so running the business WELL matters more
relative to simply feeding it.

### 5. A bad month is not news

> *"the 1 month 2 month thing is a little much, we should get like an alert
> only when we lost on like a yearly amount or literally have no capital and
> go into the red"*

The first version of the warning was written against the opposite complaint
— losing a business with no warning at all — and overcorrected into shouting
every red month, which turns a warning into wallpaper. Two things now
interrupt: a **losing year** (twelve months of books adding to less than
nothing, said once a year), and **no capital left**, which still stops the
clock because the doors are genuinely at risk.

---

## ADR-0047 — A premium is what a takeover costs, not what investing costs

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 175

> *"Another bug is when you buy stock it automatically puts you in the red...
> when you buy stock and it says total return it goes negative instantly"*

**Mine, and a clean own-goal.** ADR-0045 put the control premium inside
`buyShares`, which every purchase in the game runs through. So once a buyer
held more than a tenth of a company, every ordinary order paid above the
market — and a position is marked AT the market, so it was underwater the
instant it was bought. Measured on a probe: a cost basis of $98.06M against
a value of $92.40M, an immediate paper loss of $5.66M, with nothing on the
screen to explain it.

**Ordinary buying transacts at the market price**, exactly as before
takeovers existed. The premium is charged where the decision that justifies
it is actually made — `takeStakePlayer` and `runRaiders` pass
`atControlPrice`. There, the paper loss is not a bug but the meaning of the
mechanic, and the screen now says so BEFORE the button is pressed.

**The lesson, which is the same one as the units bug two ADRs ago:** a
change made inside a shared chokepoint reaches everything that passes
through it. `buyShares` is the single writer for buying, which is exactly
why a rule that only applies to *some* buying must not live in it.

## ADR-0048 — Two numbers that were both right, which is worse than one wrong

**Date:** 2026-08-14 · **Status:** accepted

> *"The 'what you take out' option and the actual books numbers are off way
> off, figure out why they dont read the read numbers"*

They were not disagreeing about a fact; they were answering different
questions, and nothing on the screen said which. The draw dial sets what the
business TRIES to keep. The capital ceiling caps what it CAN hold. Below the
ceiling the two agree exactly — measured at 80% asked and 80% retained. At
the ceiling there is nowhere to put the money, so retention is clamped to
the remaining room and everything else is drawn, which is how a dial reading
"leave it in" produces books showing 93% taken out.

The arithmetic was right and the screen was silent, which is the worst
combination: nothing looks broken, so the player concludes the numbers are
lying. The screen now shows what was actually kept whenever it differs from
what was asked, and names the ceiling as the reason with the remedy — buy
more capacity — next to it.

**Also in this round.** `businessDrawOf` now has a line of its own on the
Money screen (it is deliberately not inside `personalIncome`, which would
pay it twice — see ADR-0046), and Business has its own place on the main
rail directly under Work rather than being a sub-tab of having a job.

---

## ADR-0049 — A stake that asks you something

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 176

**Context.** Owner, playing: *"Never got any board memeber moments eithers
wild having any percentage of stock in a company, never got board member
moments when we sold off our own stake in the company either"*.

Right on both counts, and the gap was not that the parts were missing. The
cap table has marked which investors take a SEAT since it was built,
`boardViewFor` has asked whether a board would back a decision, and the
pending-decision system has been raising questions to the player for
months. Nothing connected a shareholding to a question. Owning a quarter of
a listed company changed a valuation and nothing else, and selling down the
company you founded changed a number in silence.

**Decision.** A blocking stake (250 per-mille) is a seat. Once a year the
largest holding that clears it puts a matter to its shareholders — a
buyback, a dividend cut to fund a plant, a bid for the whole company, a
chief executive's package, a debt-funded expansion.

**What makes it a decision rather than a click.** Every matter is a trade
with money on both sides; none has a right answer. And your stake decides
what your answer is WORTH: past control the vote is simply yours, while a
blocking stake is added to whichever side you took and tips a close room
without being able to force a hostile one (`voteCarries`). The price then
moves on what the MEETING decided, not on what you wanted — which is the
difference between holding a seat and holding an opinion.

**Selling down is a moment.** Crossing back below control or below a seat
now says so, names the company, and goes on the record as `left-the-board`
— with a different sentence for a company you FOUNDED, because losing
control of what you built is not the same event as trimming a position.

**Why the threshold, and why player-only.** Below a blocking stake a
company does not have to care what a holder thinks, and sending a passive
investor an annual vote would be noise wearing a feature's clothes. NPCs
are not asked because the market maths already runs their companies; a
question nobody answers is a pending decision that never clears.

---

## ADR-0050 — A business that happens to you

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 177

**Context.** Owner: *"It feels like every business is dull and nothing to do
until you IPO we need to add things to make it better"*. The operations loop
answered half of that — a shelf, a supplier, a price — but every one of
those is something the OWNER decides to touch. Board votes (ADR-0049) gave
things that arrive on their own to a LISTED company, and a listed company is
a sliver of the time anybody spends owning something.

**Decision.** Six moments that arrive at a private business roughly every
other year: a rival undercutting you, your best hand asking for more, a
supplier going under, a contract too big to be comfortable, the thing the
place runs on failing, and a hand in the till.

**The rule the content had to pass.** No option is free and none is
obviously right. Where one answer is plainly best it is not a decision, it
is a toll gate with extra steps. Standing still — holding your price,
turning the contract down — does nothing on purpose, because refusing to
act is a real answer and the game does not get to punish it twice.

**Every cost comes out of the TILL**, never the owner's pocket, per the
earlier ruling that business money is separate. A moment you cannot afford
is a moment that hurts, which is what makes the draw dial a decision.

**Pacing was the hard part.** He had already told me the monthly warnings
were too much ("the 1 month 2 month thing is a little much"), so this fires
at most once a year on a one-in-two roll, and never while the business is
already in a bad run — stacking a moment on top of a closure warning is how
a question gets lost.

**A bug this turned up.** A business nobody has fiddled with has no ops
record at all, so the first version of "match their price" silently did
nothing. Every other verb reaches ops through `myBusiness`, which falls back
to `freshOps()`; this did not. Caught by a test, not by reading.

**Scope, plainly stated:** six hand-written moments, like the five board
matters. It is a content table, not simulation, and a long game will see
them repeat.

---

## ADR-0051 — The dial is literal; the business has a natural size

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 177

**Context.** Owner's ruling: *"if I choose the 70/30 option I would take
whatever is 70% of the profit and reinvest 30% into the company, like if I
choose the other splits and so on."* He hit the old behaviour twice while
playing. Retention was clamped by the capital ceiling, so an owner at the
ceiling had the whole profit pushed into their hand whatever the dial said —
and the screen reported a split that was not happening.

**Decision.** The dial is honoured exactly. 30% left in is 30% left in.

**What the clamp was really doing, measured.** Removing it and nothing else
was catastrophic and it was caught by a probe rather than by reasoning: a
century produced a richest townsperson worth **$476 trillion** and a corner
business holding **$4.8 billion**. Capital compounds into profit into capital,
and the ceiling was the only thing breaking that loop. The taper on the
earning base does not hold it alone.

**So the loop is broken at the other end.** A business only EARNS on what it
can put to work — capped at the same ceiling the retention clamp used to
enforce. You may leave in whatever share you like, and past that point the
money simply sits in the till. Re-measured: richest $13.4M, biggest business
$2.5M over the same century.

This is the better place for the limit because it is a statement about the
BUSINESS rather than about the owner's choice. A shop with fifty million in
the till does not trade like a fifty-million business; it is a shop with money
in the till. The player's decision stays their own and the screen stops lying.

---

## ADR-0052 — Half a million is a full week, and the player is asked

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 177

**Context.** Owner's ruling: *"whenever a players company is worth over 500k
they should have to leave their job or get a popup that is letting them decide
to quit or focus on the business."*

**Decision.** `BUSINESS_IS_FULL_TIME_AT` drops from two million to five
hundred thousand, and the player is asked rather than walked out.

**Why the question, when the last ruling asked for FEWER interruptions.** At
two million the rule almost never fired, so deleting the job silently was
defensible. At five hundred thousand it lands in an ordinary life, and a job
disappearing without a word is the exact shape of complaint this project keeps
collecting. The town still resolves it automatically: a question nobody
answers is a pending decision that never clears.

**Both answers cost something.** Keeping the wage keeps the business running
in the evenings, and it earns like it — half the owner's attention, for as
long as they hold both. Derived from the two facts rather than stored, so it
cannot fall out of step with them. A choice where both options are free is not
a choice.

---

## ADR-0053 — Taking a seat is not finishing the course

**Date:** 2026-08-14 · **Status:** accepted · **Version:** SIMULATION_VERSION 177

**Context.** Owner, playing: *"when we get the popup in the military thats
like 'a school slot has opened' we take it and then it says we complete it but
we never actually did complete it, not on the record, can still attend the
school etc."*

**The bug.** Accepting wrote a `completed-training` event immediately — so the
feed announced a graduation — then granted the TRADE's qualification and
stopped. It never recorded the attempt, never granted the SCHOOL's badge, and
never sent anybody to the schoolhouse. Eligibility is decided by whether the
soldier holds `school.badge`, so the same course stayed on offer for ever and
could be "completed" repeatedly, each time announcing a graduation that was
nowhere on the record.

**Decision.** The offer grants a SEAT. `runSchools` owns everything after
that, exactly as it does for the reenlistment option and for every soldier in
the town: the class starts, the course runs its months, it can injure or wash
somebody out, and graduating grants the badge, the ribbon and the attempt.

One door, one story. The instant-completion path existed because a short
course "fits inside the month" — but a path that skips the machinery skips
the record too, which is how a graduation with no graduate got shipped.

**Found but NOT fixed here:** the reenlistment `school` option picks the best
open school and silently does nothing when none is open, so a soldier can
spend their reenlistment choice on a reward that never arrives. Left for its
own change rather than bundled into a release.
