# The Life Engine

A deterministic generational life simulation, and **The Life Simulator** — the web
application built on top of it.

> **Current phase: playable.** Layers 1–3 are complete and two Layer 4 institutions
> (military service, crime and justice) plus an economy are built and playable.
> ~46,000 lines across 51 engine modules and 23 UI components, with **852 tests**
> covering them.

---

## What this is

Two layers, deliberately separated.

**The Life Engine** — a simulation framework with no user interface. Pure computation:
state in, state out. It runs headless, is tested without a browser, and has no
dependency on React, the DOM, or anything else that could make it non-reproducible.

**The Life Simulator** — the web application. You begin as one person in a simulated
town of autonomous people who pursue their own lives. The world continues through
school, work, money, friendship, marriage, children, business, crime, military
service, war, illness, aging, death, and inheritance — across unlimited generations.

The guiding idea: **nothing exists in isolation.**

---

## What is actually built

| System | What it does |
|---|---|
| **Time and people** | Monthly ticks; birth, aging, illness, injury, death; traits and temperament that drive behaviour |
| **Relationships** | Compatibility-driven friendship, courtship, marriage, divorce, widowhood, children |
| **Education and work** | Schooling levels; 46 occupations priced against real wage data; 9 civilian career tracks with rungs, reviews, and promotion boards |
| **Work moments** | 10 authored scenes where a job becomes a decision, with raises and standing that follow from the answer |
| **Money** | Wages, rent, living costs, savings, credit, debt, mortgages, a market with cycles and shocks, and inflation indexed to the start year |
| **The floors under a life** | Bankruptcy with means tests and repayment plans, homelessness, unemployment insurance, assistance, a state pension |
| **Business** | Five kinds of small business, opened with capital, run monthly, inherited or wound up on death |
| **Military service** | A recruiting station with an entry test, 22 enlisted trades with real job codes, 26 officer roles, three accession models, schools, special-unit selection, promotion boards, and a service contract |
| **War** | Nations, alliances and coalitions, wars that start and end for reasons; deployment, exposure by trade, combat scenes, wounds, capture and captivity, awards, and separation paperwork |
| **Crime and justice** | 23 graded offences, 32 authored crime scenes, motive → clearance → arrest → plea → verdict, fines and sentences, a criminal record that hiring and enlistment both read |
| **The town's memory** | Causal records for every important outcome, a news desk that reports what the simulation produced, obituaries, and a county records office |
| **World presets** | *Classic* (wholly fictional) and *Heartland* (grounded in the real United States), each with its own pinned determinism fingerprint |

Everything above is reachable in play, not just modelled internally.

---

## Stack

| | |
|---|---|
| **Platform** | Web application |
| **Language** | TypeScript, strict mode, end to end |
| **Simulation runs** | In the player's browser, on a Web Worker |
| **Frontend** | React + Vite |
| **Saves** | IndexedDB locally; server sync at Milestone 6 |
| **Accounts** | Architecturally ready; shipped at Milestone 6 |
| **Server** | None yet |

**Multi-user is not multiplayer.** Each user runs an isolated world — no shared state,
no synchronization, no netcode.

Rationale and the five alternatives considered: [docs/ARCHITECTURE_PROPOSAL.md](docs/ARCHITECTURE_PROPOSAL.md).

---

## The rule that matters most

```
packages/engine may import from packages/shared and nothing else.
No React. No DOM. No window, document, localStorage, fetch.
No clock, no timers, no storage, no network, no randomness of its own.
```

The engine is a pure function of (state, seed, inputs) → new state. All I/O lives in
`apps/web`. A test (`purity.test.ts`) fails the build if anything violates it.

This is what makes the engine deterministic, testable, safe to run in a background
thread, and portable between browser and server. The target platform changed twice —
iOS, then Windows desktop, then web — at a total cost of documentation edits and
**zero code**, because of this rule.

---

## Determinism

The same seed, simulation version, and player decisions produce byte-identical
results. This is an engineering requirement, not an aspiration, and it is enforced:

- **Golden fingerprints.** Two preset worlds are simulated for a fixed number of ticks
  and hashed; any drift fails the build. Changing a fingerprint requires bumping
  `SIMULATION_VERSION` and writing down why.
- **Seeded RNG streams.** Every random draw opens a named stream keyed to the world
  seed, a domain, an entity, and a salt. No global RNG.
- **Banned constructs.** `Math.random`, `Date.now`, `Math.sin`, unordered iteration.
- **Integer cents.** No floating-point money, anywhere (ADR-0008).
- **Migrations.** Every persisted-field change gets a numbered migration with a test
  that loads a real old save.

Current: `SIMULATION_VERSION` **92** · `SCHEMA_VERSION` **38** · 852 tests green.

Full rules: [docs/DETERMINISM.md](docs/DETERMINISM.md).

---

## Structure

```
LifeEngine/
├── CLAUDE.md                    # Controlling project constitution — read this first
├── RESUME.md                    # Handoff: current state and the next queue
├── LIFE_ENGINE_BOOTSTRAP.md     # Original specification, preserved unchanged
├── packages/
│   ├── engine/                  # Pure TypeScript simulation. THE PRODUCT. 51 modules.
│   ├── persistence/             # Save serialization, schema versions, 37 migrations
│   └── shared/                  # EntityId, Tick, Money, Seed — types only
├── apps/
│   └── web/                     # React + Vite. Owns all I/O. 23 components.
└── docs/                        # Charter, ADRs, domain map, determinism, plans
```

---

## Running it

```bash
npm install
```

```bash
npm run check
```

Typecheck every workspace, then run the full suite. **Run this before any commit.**

```bash
npm run dev
```

Dev server at http://localhost:5173.

The full suite takes roughly six minutes. `npx vitest run <path>` runs a single file.

---

## Working on it

1. Read [CLAUDE.md](CLAUDE.md) — it is the constitution, not a summary.
2. Read [RESUME.md](RESUME.md) for where the project actually is.
3. Confirm the work passes the Three Gates (realism, interaction, story).
4. Implement the smallest coherent change. Build. Test. Review the diff.
5. Record any significant decision as a new ADR in [docs/DECISION_LOG.md](docs/DECISION_LOG.md).
6. Update documentation in the same commit as the change it describes.

Two house rules worth knowing before touching anything:

- **Measure before tuning.** A band only moves with the measurement recorded in a
  comment beside it. "It felt wrong" is not a reason; "measured 93% business survival
  over a century across three seeds" is.
- **One function behind a locked door.** Wherever the UI greys a row and the engine
  refuses an action, both read the same function — so a greyed row and an honest
  refusal cannot disagree.

Every layer is designed to be a satisfying place to stop.

---

## Content boundaries

People, companies, brands, politicians, parties, media organizations, and **named
military units are fictional**, permanently — a real unit carries real casualty history
and living members, and this simulation kills, wounds, and disgraces the people in it.
Real place names, real job codes, and real service branch names may appear where the
preset's homeland is real. No insignia, emblems, or seals. No real private individuals,
ever.

No sexual content. Nothing graphic or exploitative involving a child, at any setting,
with no dial for it.

---

## Status

| Item | State |
|---|---|
| Layers 1–3 | **Complete** |
| Layer 4 — military and war | **Complete** |
| Layer 4 — crime and justice | Built through C2; C3 scoped |
| Layer 4 — economy and finance | **Complete** |
| Layer 4 — government, healthcare, media, transport | Not started |
| Accounts and cloud saves | Milestone 6, not started |
| Tests | 852 across 73 files, green |

The current arc is player-experience-first (ADR-0018): depth in what a player actually
touches, rather than new institutions. See [RESUME.md](RESUME.md) for the live queue.
