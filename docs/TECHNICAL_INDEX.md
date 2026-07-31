# Technical Index

Every technical specification the project will eventually need.

Companion to `DESIGN_INDEX.md`: design documents say *what the world does*, technical
documents say *how the software works*.

**Almost none of these exist yet, and that is correct.** This is a map, not a to-do list.

**Status:** `Written` · `Planned` · `Deferred`
**Priority:** `P0` before the first prototype · `P1` for its milestone · `P2` long term

---

## 1 · Architecture and structure

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T1.1 | `ARCHITECTURE_PROPOSAL.md` | Stack comparison and recommendation | **Written** | P0 | 0 |
| T1.2 | `DOMAIN_MAP.md` | Data ownership, commands, queries, events | **Written** | P0 | 1 |
| T1.3 | `DECISION_LOG.md` | ADRs | **Written** | P0 | — |
| T1.4 | `MONOREPO_LAYOUT.md` | Package boundaries, import rules, tooling | Planned | P0 | 0 |
| T1.5 | `ENGINE_API.md` | The public surface between engine and app | Planned | P0 | 2 |
| T1.6 | `CODING_STANDARDS.md` | TypeScript conventions, strict-mode settings | Planned | P1 | 0 |

## 2 · Simulation core

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T2.1 | `DETERMINISM.md` | Seeds, streams, ordering, banned constructs | **Written** | P0 | 1 |
| T2.2 | `SIMULATION_CLOCK.md` | Tick model, calendar, scheduling | Planned | P0 | 1 |
| T2.3 | `EVENT_SCHEDULING.md` | Queues, priority, dispatch order | Planned | P0 | 1 |
| T2.4 | `ENTITY_IDS.md` | Allocation, stability, reuse policy | Planned | P0 | 1 |
| T2.5 | `PERSON_STATE.md` | Authoritative person shape | Planned | P0 | 1 |
| T2.6 | `DECISION_ENGINE_TECH.md` | How decisions are computed and recorded | Planned | P0 | 1 |
| T2.7 | `CAUSAL_RECORDS.md` | Structure, tiers, compression | **Written** | P0 | 1 |
| T2.8 | `SIMULATION_LEVELS.md` | Tiering, promotion, demotion | **Written** | P1 | 5+ |
| T2.9 | `MEMORY_MODEL_TECH.md` | Storage and retrieval of person memories | Deferred | P2 | 5+ |
| T2.10 | `RELATIONSHIP_GRAPH_TECH.md` | Graph representation and traversal cost | Planned | P1 | 5 |
| T2.11 | `HISTORICAL_COMPRESSION.md` | How history is summarized over time | Planned | P1 | 4 |

## 3 · Persistence

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T3.1 | `SAVE_FORMAT.md` | Serialized shape, header, checksums | Planned | P0 | 4 |
| T3.2 | `SAVE_MIGRATIONS.md` | Version policy, migration authoring, tests | Planned | P0 | 4 |
| T3.3 | `INDEXEDDB_STORAGE.md` | Browser storage, quotas, eviction | Planned | P1 | 4 |
| T3.4 | `SCHEMA_VALIDATION.md` | Runtime validation at every boundary (R-23) | Planned | **P0** | 4 |
| T3.5 | `BIGINT_HANDLING.md` | Serializing `BigInt` for Layer 4 economy | Planned | P1 | 4 |

**T3.4 is P0 despite arriving at Milestone 4.** TypeScript checks nothing at runtime; a
`as SaveFile` cast will happily accept corrupt data. Every boundary validates.

## 4 · Testing and quality

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T4.1 | `TESTING_STRATEGY.md` | What is tested, at which boundary, and why | Planned | P0 | 1 |
| T4.2 | `DETERMINISM_TESTS.md` | Golden seed, double-run, cross-process/environment | Planned | P0 | 1 |
| T4.3 | `IMPORT_GRAPH_TEST.md` | Enforcing engine purity automatically | Planned | P0 | 1 |
| T4.4 | `PROPERTY_TESTS.md` | Invariants over exhaustive cases | Planned | P1 | 3 |
| T4.5 | `CI_PIPELINE.md` | What runs on every commit | Planned | P1 | 1 |

## 5 · Performance and observability

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T5.1 | `PERFORMANCE_BASELINE.md` | Measured numbers — replaces every guess | Planned | P0 | 3 |
| T5.2 | `MEMORY_BUDGET.md` | Browser memory per person and per record | Planned | P0 | 3 |
| T5.3 | `WEB_WORKER.md` | Running the engine off the main thread | Planned | P1 | 4 |
| T5.4 | `PROFILING_GUIDE.md` | How to measure before optimizing | Planned | P1 | 3 |
| T5.5 | `DEBUG_TOOLING.md` | State hashing, tick bisection, RNG draw logs | Planned | P1 | 1 |

**T5.5 should be built during Milestone 1, before it is needed.** Adding state-hashing
helpers mid-panic is much harder than adding them early — see `DETERMINISM.md` §10.

## 6 · Frontend

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T6.1 | `UI_ARCHITECTURE.md` | Component structure; UI holds no sim state | Planned | P0 | 2 |
| T6.2 | `STATE_BINDING.md` | Rendering engine state without duplicating it | Planned | P0 | 2 |
| T6.3 | `RESPONSIVE_LAYOUT_TECH.md` | Breakpoints, touch targets, phone-first | Planned | P1 | 2 |
| T6.4 | `ACCESSIBILITY_TECH.md` | Semantics, focus, contrast, reduced motion | Planned | P1 | 2 |
| T6.5 | `BUILD_AND_DEPLOY.md` | Vite build, static hosting, cache headers | Planned | P1 | 2 |

## 7 · Backend and accounts *(Milestone 6)*

**None of this exists before Milestone 6.** Milestones 0–5 need no server.

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T7.1 | `BACKEND_ARCHITECTURE.md` | API surface, hosting, database choice | Deferred | P1 | 6 |
| T7.2 | `AUTHENTICATION.md` | Provider choice — never hand-rolled | Deferred | P1 | 6 |
| T7.3 | `DATABASE_SCHEMA.md` | Users, saves, metadata | Deferred | P1 | 6 |
| T7.4 | `SAVE_SYNC_TECH.md` | Upload, download, conflict, offline | Deferred | P1 | 6 |
| T7.5 | `SECURITY.md` | Threat model, validation, rate limiting, secrets | Deferred | **P1** | 6 |
| T7.6 | `BACKUP_AND_RESTORE.md` | Backups, and a *tested* restore | Deferred | P1 | 6 |
| T7.7 | `PRIVACY_TECH.md` | Data minimization, retention, deletion, export | Deferred | P1 | 6 |

**T7.5 and T7.6 are the two that matter most.** An untested backup is not a backup, and
security is the one area where a learner cannot reliably self-review — hence the
mandatory `web-security-reviewer` pass (ADR-0014).

## 8 · Long-term domain technical specs

| # | Document | Purpose | Status | Pri | Milestone |
|---|---|---|---|---|---|
| T8.1 | `DATA_GENERATION.md` | Procedural names, places, populations | Planned | P1 | 1 |
| T8.2 | `GEOPOLITICAL_SIM_TECH.md` | Country and conflict state representation | Deferred | P2 | Layer 4 |
| T8.3 | `CONFLICT_RESOLUTION_TECH.md` | Traceable, explainable combat resolution | Deferred | P2 | Layer 4 |
| T8.4 | `MILITARY_ASSIGNMENT_TECH.md` | Assignment matching and constraints | Deferred | P2 | Layer 4 |
| T8.5 | `AWARD_ELIGIBILITY_TECH.md` | Rule engine for strict award criteria | Deferred | P2 | Layer 4 |
| T8.6 | `LOCALIZATION.md` | Text externalization, plurals, dates | Deferred | P2 | — |

---

## Required before Milestone 1 completes

**T1.4, T1.6, T2.2, T2.3, T2.4, T2.5, T2.6, T4.1, T4.2, T4.3, T5.5, T8.1** — plus
T1.1, T1.2, T1.3, T2.1, T2.7, T2.8, already written.

That is a meaningful amount of writing, but each is short — a page or two fixing one
decision. The alternative is discovering at Milestone 4 that entity IDs were allocated
in a way that cannot be migrated.
