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

## Approval status

**All ADRs are Accepted as of 2026-07-30.** Nothing is outstanding.

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
