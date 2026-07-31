# The Life Engine

A deterministic generational life simulation, and **The Life Simulator** — the web
application built on top of it.

> **Current phase: Foundation.**
> **No gameplay has been implemented. No engine code exists yet.**
> This repository currently contains planning, architecture, and design documentation only.

---

## What this is

Two layers, deliberately separated:

**The Life Engine** — a simulation framework with no user interface. It models people,
families, careers, education, finances, housing, businesses, government, healthcare,
crime, military service, war, weather, media, and history. It is pure computation:
state in, state out. It runs headless and is tested without a browser.

**The Life Simulator** — the web application. You begin as one person in a simulated
United States populated by autonomous people who pursue their own lives. The world
continues through education, work, relationships, parenting, business, war, aging,
death, and inheritance, across unlimited generations.

The guiding idea: **nothing exists in isolation.**

---

## Stack

| | |
|---|---|
| **Platform** | Web application |
| **Language** | TypeScript, end to end |
| **Simulation runs** | In the player's browser |
| **Frontend** | React + Vite |
| **Saves** | IndexedDB locally; server sync at Milestone 6 |
| **Accounts** | Architecturally ready now; shipped at Milestone 6 |
| **Server** | None until Milestone 6 |

**Multi-user is not multiplayer.** Each user runs an isolated world — no shared state,
no synchronization, no netcode.

Rationale and the five alternatives considered: [docs/ARCHITECTURE_PROPOSAL.md](docs/ARCHITECTURE_PROPOSAL.md).

---

## The rule that matters most

```
packages/engine may import from packages/shared and nothing else.
No React. No DOM. No window, document, localStorage, fetch.
No clock, no timers, no storage, no network.
```

The engine is a pure function of (state, seed, inputs) → new state. All I/O lives in
`apps/web`.

This is what makes the engine deterministic, testable, safe to run in a background
thread, and portable between browser and server. The target platform has already
changed twice — iOS, then Windows desktop, then web — at a total cost of documentation
edits and **zero code**, because of this rule.

---

## Planned structure

```
life-engine/
├── CLAUDE.md                    # Controlling project constitution — read this first
├── LIFE_ENGINE_BOOTSTRAP.md     # Original specification, preserved unchanged
├── packages/
│   ├── engine/                  # Pure TypeScript simulation. THE PRODUCT.
│   ├── persistence/             # Save serialization, versions, migrations
│   └── shared/                  # EntityId, Tick, Money, Seed — types only
├── apps/
│   ├── web/                     # React + Vite. Owns all I/O.
│   └── api/                     # Does not exist yet. Milestone 6.
└── docs/
    ├── PROJECT_CHARTER.md       # Purpose, vision, scope, non-goals, success criteria
    ├── ARCHITECTURE_PROPOSAL.md # Stack options compared; recommendation
    ├── DECISION_LOG.md          # ADRs — every significant decision and why
    ├── DOMAIN_MAP.md            # Who owns what data; how domains talk
    ├── SIMULATION_LEVELS.md     # Deep / medium / light / aggregate NPC tiers
    ├── DETERMINISM.md           # Seeding, RNG streams, ordering, replay
    ├── CAUSAL_RECORDS.md        # How the engine explains why things happened
    ├── MILITARY_AND_WAR_FOUNDATION.md
    ├── MILESTONE_PLAN.md        # Small vertical milestones with exit criteria
    ├── PRODUCT_ROADMAP.md       # How it reaches players: alpha, beta, 1.0
    ├── RISK_REGISTER.md         # Ranked risks and mitigations
    ├── DESIGN_INDEX.md          # Index of all design specs eventually required
    ├── TECHNICAL_INDEX.md       # Index of all technical specs eventually required
    └── CLAUDE_RULES.md          # Expanded AI-development rules
```

Only `docs/`, `CLAUDE.md`, and the bootstrap exist today. The rest is the plan.

---

## Before any code is written

Two prerequisites are **not yet satisfied** on the development machine:

1. **Node.js is not installed.** Download the LTS release from https://nodejs.org and
   verify:
   ```bash
   node --version
   ```
2. **Git identity is not configured.** Commits will be rejected until you run:
   ```bash
   git config --global user.name "Your Name"
   ```
   ```bash
   git config --global user.email "you@example.com"
   ```

The .NET SDK is **no longer required** — that was the previous, superseded plan.

---

## Development workflow

1. Read [CLAUDE.md](CLAUDE.md) — it is the constitution, not a summary.
2. Pick the next milestone from [docs/MILESTONE_PLAN.md](docs/MILESTONE_PLAN.md). Do not skip ahead.
3. Confirm the work passes the Three Gates (realism, interaction, story).
4. Implement the smallest coherent change. Build. Test. Review the diff.
5. Record any significant decision as a new ADR in [docs/DECISION_LOG.md](docs/DECISION_LOG.md).
6. Update documentation in the same commit as the change it describes.

Every layer is designed to be a satisfying place to stop. If the project ends after
Layer 1, Layer 1 should still be a finished, working thing.

---

## Status

| Item | State |
|---|---|
| Foundation documentation | Complete |
| Architecture | **Approved 2026-07-30** |
| All ADRs | **Accepted** — none outstanding |
| Node.js installed | **No — this is the blocker** |
| Engine code | Not started |
| Gameplay | Not started |
| First executable milestone | **Authorized** |

The architecture is settled and Milestone 0 is authorized. The only thing standing
between here and the first line of code is the two prerequisites above.
