# CLAUDE.md — The Life Engine

**This file is the controlling project constitution.** It governs all work in this
repository. The original specification is preserved in `LIFE_ENGINE_BOOTSTRAP.md`;
where the two disagree, this file and `docs/DECISION_LOG.md` win.

Current phase: **Foundation — documentation and architecture. No gameplay implemented.**

---

## 1. Repository scope and isolation

These instructions apply only to this `LifeEngine` repository. It is deliberately
separate from every other project on this machine.

Do not:

- Read, modify, create, delete, or depend upon files outside this repository.
- Modify the user-level `CLAUDE.md`, user-level Claude settings, or global Claude Code config.
- Modify another repository.
- Install global dependencies.
- Import code, assets, credentials, configuration, or assumptions from unrelated projects.
- Add external directories to the workspace, or create symlinks pointing outside the repo.
- Use information from unrelated projects merely because it exists elsewhere on this machine.

When requesting permission to run a command, state plainly whether it stays inside
this repository. If an operation would touch anything outside it, stop and ask.

This is a practical isolation rule for project hygiene. It does not override
system, organization, or user-level policy.

---

## 2. Project identity

Two conceptually separate layers.

### The Life Engine

A modular, deterministic, offline-first simulation framework modelling people and
psychology, families and relationships, households, careers and education,
businesses, finance and markets, government and politics, military service and
war, crime and law, healthcare, transportation, weather and disasters, media and
culture, and history and legacy.

The engine has **no dependency on any UI framework.** The application layer may
send commands to the engine and query its state. Interface state is never the
authoritative source of simulation truth.

### The Life Simulator

The first game built on top of the engine. **Target platform: the web.**

It will eventually support multiple users, each with their own account and their own
save files. **Multi-user is not multiplayer** — every user runs an isolated world with
no shared state, no synchronization, and no netcode.

See ADR-0009 and ADR-0010 in `docs/DECISION_LOG.md`. The platform has changed twice
(iOS → Windows desktop → web) at a total cost of documentation edits and zero code,
because of the engine independence rule above. Protect that rule.

---

## 3. Product vision

An ambitious generational life simulation set in a realistic simulated United States.

Real geography, cities, states, regional characteristics, and climate patterns may
be used where legally and ethically appropriate. **People, companies, brands,
politicians, parties, media organizations, sports organizations, and military units
are fictional** — this reduces privacy, licensing, trademark, publicity-rights, and
IP risk. No real private individuals, ever.

The player begins as one person in a world of autonomous simulated people. The world
continues through childhood, education, careers, friendship, romance, marriage,
parenting, business, economic cycles, political change, military service, war, crime,
health, migration, aging, death, inheritance, and unlimited generations.

**The player is not the center of the universe.** Other people pursue their own goals,
relationships, careers, and beliefs.

Central philosophy: **Nothing exists in isolation.**

---

## 4. The twelve governing laws

**Law 1 — The simulation is the source of truth.**
Important events originate from simulated state and behaviour. News reports what the
simulation produced. Reputations reflect recorded actions. Businesses succeed or fail
from simulated conditions. Avoid scripted outcomes that contradict the simulation.

**Law 2 — Every person is the main character of their own life.**
Important NPCs have their own identity, personality, values, fears, goals, habits,
memories, relationships, finances, career, health, reputation, and life plan. They do
not exist to reward, punish, serve, or entertain the player.

**Law 3 — Everything important has a cause.**
Major outcomes retain causal records. The game must be able to explain why a person
changed careers, ended a relationship, moved, started a business, committed a crime,
enlisted, deployed, was injured, or was denied an award — generated from actual
simulation records, never fabricated after the fact.

**Law 4 — Everything is interconnected.**
People affect families; families affect children; workers affect businesses;
businesses affect industries; government affects everything; war affects personnel,
families, supply chains, opinion, and the economy. New systems integrate with existing
systems rather than becoming isolated minigames.

**Law 5 — Time continues.**
The world does not wait indefinitely for the player. Initial model: world simulation
advances monthly; the player visibly ages every six months; background events may
resolve silently; important events notify; major events may pause for a decision;
opportunities expire. Exact scheduling remains subject to technical review.

**Law 6 — History is persistent.**
Important events become permanent records — births, deaths, marriages, divorces,
education, careers, service, promotions, awards, deployments, wars, businesses,
property, elections, laws, crimes, court cases, investments, disasters, traditions,
heirlooms, memorials. History is summarized and compressed, not stored as unlimited
raw detail.

**Law 7 — Failure creates new chapters.**
Failure is allowed and consequential, but most failures retain realistic recovery
paths. Job loss, bankruptcy, divorce, illness, conviction, separation, injury, and
disability change a life without ending the game. Hard game-over states are rare.

**Law 8 — Legacy continues after death.**
Death ends a life, not necessarily the save. Produce a retrospective: biography,
timeline, relationships, career, service record, finances, property, achievements,
failures, reputation, obituary, legacy. The player may continue through an heir.
Family history, wealth, debt, memories, traditions, and consequences persist across
unlimited generations.

**Law 9 — Simulate what is necessary; show what matters.**
The engine may simulate extensively. The interface prioritizes relevance. Use
progressive disclosure, summaries, notifications, timelines, and optional "Why?"
explanations. Do not expose every internal calculation.

**Law 10 — Prefer believability over artificial balance.**
Outcomes need not be equal. Circumstances, geography, family, education, health,
opportunity, policy, luck, and decisions create unequal results. Results must remain
coherent, explainable, playable, and respectful. Realism does not justify tedious,
inaccessible, exploitative, cruel, or stereotyped design.

**Law 11 — Determinism is an engineering requirement.**
All stochastic behaviour uses explicit seeded RNG. The same starting state, seed,
simulation version, and player decisions produce the same results unless a documented
migration intentionally changes behaviour. Randomness influences circumstances; it
never replaces causal modelling.

**Law 12 — Architecture must remain modular.**
Systems communicate through stable contracts, commands, events, and queries. No
duplicated authoritative state, circular domain ownership, god objects, giant
`Person` / `World` / `GameManager` classes, UI-driven simulation logic, or hidden
coupling. The engine must be testable without a UI.

---

## 5. The Three Gates

Every proposed feature must pass all three.

1. **Realism** — would it behave believably in the simulated world?
2. **Interaction** — does it meaningfully connect with multiple existing systems?
   (Three integrations is a useful target; foundational infrastructure may justify fewer.)
3. **Story** — can it produce meaningful choices, consequences, relationships,
   memories, or emergent stories?

Reject, simplify, aggregate, or defer anything that adds substantial complexity
without sufficient value.

---

## 6. Confirmed technical stack

| Decision | Choice | ADR |
|---|---|---|
| Target platform | Web application | ADR-0009 |
| Language | TypeScript, end to end | ADR-0009 |
| Simulation runs | In the browser; server-capable unchanged | ADR-0010 |
| Multi-user | Ready from day one; shipped at Milestone 6 | ADR-0010 |
| Engine dependencies | None — no framework, no DOM, no I/O | ADR-0003 |
| Frontend | React + Vite | ADR-0011 |
| Persistence | IndexedDB now; server sync at Milestone 6 | ADR-0004, ADR-0010 |
| Presentation | Minimal UI from Milestone 2 | ADR-0012 |

Full rationale in `docs/ARCHITECTURE_PROPOSAL.md` and `docs/DECISION_LOG.md`.

### The engine purity rule

> `packages/engine` may import from `packages/shared` and nothing else.
> No React. No DOM. No `window`, `document`, `localStorage`, `fetch`.
> No clock, no timers, no storage, no network, no randomness of its own.

The engine is a pure function of (state, seed, inputs) → new state. Everything that
touches the outside world lives in `apps/web`. This one rule is what keeps the engine
deterministic, testable, worker-safe, and portable between browser and server. It has
already survived two complete platform changes. It is not negotiable.

---

## 7. Engineering constraints

- Ordinary gameplay works **without a network round-trip per tick**. The simulation
  runs locally. The network is for loading the app, and later for authentication and
  save sync.
- **No runtime generative AI.** Absolute.
- An account is **not** required for local play — only for saves that follow a user
  across devices.
- The game degrades gracefully offline: a loaded session keeps simulating and saves locally.
- Simulation logic is testable **without a UI**.
- The UI renders engine state and sends commands. **It never holds simulation state of
  its own.**
- User data is real-world data. A leak harms people, not a save file. Never write your
  own authentication.
- Seeded deterministic randomness everywhere.
- Causal records retained for important outcomes.
- Stable domain boundaries. Explicit persistence versioning. Tested save migrations.
- Do not silently lose data. Do not duplicate authoritative truth. Do not create a
  giant global singleton.
- Do not add dependencies without documented justification. Do not choose frameworks
  because they are fashionable. No premature microservices. **No multiplayer in any
  form** — multi-user accounts are approved; shared worlds are not.
- Do not copy copyrighted assets. Do not use real private-person data. Do not commit secrets.
- Do not delete or weaken tests to get a green result. Do not suppress warnings without
  justification. No large uncontrolled rewrites.
- Do not change public contracts without migration or compatibility notes.
- Update documentation when architecture changes. Meaningful behavioural changes
  require tests.
- Avoid irreversible choices during the foundation phase.
- Favour clarity over cleverness. Favour profiling evidence over speculative optimization.

---

## 8. Development strategy — layers

Design the full long-term vision; implement in layers. **Every layer must be a
satisfying place to stop.**

- **Layer 1 — Core simulation.** Deterministic time, seeded randomness, identity,
  basic person state, events, causal records, save/load, tests.
- **Layer 2 — Living world.** Relationships, education, employment, household
  finances, housing, basic businesses, geographic movement.
- **Layer 3 — Generational systems.** Families, children, aging, death, inheritance,
  heirs, archives, legacy.
- **Layer 4 — Deep institutional simulation.** Economy and markets, government and
  politics, healthcare, military and war, crime and justice, media, transportation.
- **Layer 5 — Expansion.** Geographic depth, additional careers, culture, sports,
  technology, advanced history, modding.

Do not create hundreds of placeholder source files. Do not implement broad systems
before dependencies and authoritative data ownership are defined. Prefer small
vertical milestones producing executable, inspectable, testable results.

---

## 9. Controlled verification loops

Use bounded engineering loops, never blind repetition.

Read the spec → inspect existing implementation → define the narrow intended change →
implement the smallest coherent change → build → run tests → analyse failures →
fix root causes → rerun → review the diff → update docs → stop when acceptance
criteria are met.

Every loop needs an objective, explicit acceptance criteria, a bounded iteration
limit, an escalation rule, and final verification.

**Never** run an unbounded loop, make random changes without learning, delete tests to
get green, weaken requirements without approval, fabricate test execution, hide
failures, or claim success without evidence.

When progress stalls: report the failure observed, evidence collected, attempts made,
likely causes, and recommended next action.

---

## 10. Agents and model routing

Use subagents only where specialization, independent review, parallel research, or
context isolation gives real benefit. Do not spawn agents for trivial work. The lead
agent owns final integration, architectural consistency, conflict resolution, scope
control, and reporting.

Every delegated task defines: role, bounded assignment, inputs, allowed tools,
expected output, acceptance criteria, selected model, and why that model suffices.

**Model routing** — use the least expensive model that can reliably do the job.

- **Haiku-class** — repository inventory, formatting, simple doc checks, narrow
  classification, repetitive validation, file discovery, mechanical transformation.
  Not for ambiguous architecture or cross-system reasoning.
- **Sonnet-class** — standard implementation, routine refactoring, unit and
  integration tests, normal debugging, docs from established decisions, isolated
  component review.
- **Opus-class** — architecture, cross-domain design, hard debugging, persistence
  strategy, performance architecture, high-impact refactors, simulation consistency,
  military and geopolitical architecture, resolving conflicting proposals, reviewing
  hard-to-reverse decisions.
- **Fable-class** — only for sustained autonomy, unusually large context,
  repository-wide investigation, or extended multi-stage coordination.

Do not reach for the largest model just because a task feels important. If a named
model is unavailable, use the nearest capability class and report the substitution.

Parallelize independent read-only investigation. Never let parallel agents edit the
same files — assign explicit file ownership first. Never parallelize work depending on
an unresolved shared decision. Agents must not recursively spawn unlimited agents.

**Independent review is required** for changes to simulation scheduling, deterministic
randomness, core person state, decision logic, memory, relationship graphs, economy
calculations, military and war resolution, persistence, save migration, generational
transitions, performance-critical code, shared domain interfaces, and major refactors.
The reviewer must not be the author.

---

## 11. Tone and honesty

Be skeptical and technically honest. Do not flatter the concept. Actively identify
contradictions, excessive scope, unrealistic population assumptions, performance
dangers, and systems needing aggregation or simplification.

The objective is not to make the project look impressive. It is to give it a
disciplined foundation with a realistic chance of being finished.
