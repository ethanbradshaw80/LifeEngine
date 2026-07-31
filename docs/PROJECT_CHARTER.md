# Project Charter

**Project:** The Life Engine / The Life Simulator
**Phase:** Foundation — documentation and architecture
**Owner:** Ethan
**Team size:** 1
**Time budget:** ~10 hours per week
**Established:** 2026-07-30

---

## 1. Purpose

Build a deterministic simulation framework capable of modelling human lives, families,
institutions, and history — and a **web application** on top of it in which the player
lives one life at a time inside a world that does not revolve around them.

It will eventually support multiple users, each with their own account and their own
save files.

The framework is the durable asset. The game is the first thing built with it.

---

## 2. Vision

An ambitious generational life simulation set in a realistic simulated United States.

The player begins as one person among autonomous simulated people. The world continues
through childhood, education, careers, friendship, romance, marriage, parenting,
business, economic cycles, political change, military service, war, crime, health,
migration, aging, death, and inheritance — across unlimited generations.

Real geography and climate may be used. **All people, companies, brands, politicians,
parties, media organizations, sports organizations, and military units are fictional.**
No real private individuals, ever.

Central philosophy: **Nothing exists in isolation.**

---

## 3. Governing laws

The twelve laws are stated in full in `../CLAUDE.md` §4 and are not duplicated here.
Summarized:

| Law | Principle |
|---|---|
| 1 | The simulation is the source of truth |
| 2 | Every person is the main character of their own life |
| 3 | Everything important has a cause |
| 4 | Everything is interconnected |
| 5 | Time continues |
| 6 | History is persistent |
| 7 | Failure creates new chapters |
| 8 | Legacy continues after death |
| 9 | Simulate what is necessary; show what matters |
| 10 | Prefer believability over artificial balance |
| 11 | Determinism is an engineering requirement |
| 12 | Architecture must remain modular |

Laws 3 and 11 are the two that must be built in from the first commit. Both are
effectively impossible to retrofit.

---

## 4. The Three Gates

Every feature must pass all three: **Realism**, **Interaction** (meaningful connection
to multiple existing systems), **Story** (capable of producing choices, consequences,
memories, or emergent narrative).

Anything adding substantial complexity without sufficient value is rejected,
simplified, aggregated, or deferred.

---

## 5. Scope

### In scope — long term

People and psychology · families and relationships · households · careers and
education · businesses · finance, markets, and housing · government and politics ·
military service, geopolitics, and war · crime, law, and courts · healthcare and human
development · transportation and infrastructure · weather, environment, and disasters ·
media, culture, science, and technology · history, archives, and legacy.

### In scope — now

Layer 1 only. Deterministic time, seeded randomness, identity, basic person state,
events, causal records, save/load, and tests. See `MILESTONE_PLAN.md`.

### Multi-user is not multiplayer

Worth stating precisely, because these are routinely confused and the difference is the
single largest scope question in the project.

| | Multi-user *(required)* | Multiplayer *(rejected)* |
|---|---|---|
| Worlds | One isolated world per user | A world shared between users |
| State | No shared state | Synchronized shared state |
| Networking | Sign in; upload and download saves | Real-time sync, conflict resolution, authority arbitration |
| Determinism | Unaffected | Enormously complicated |
| Cost | Moderate and mostly one-time | Very large and permanent |

Multi-user is approved. Multiplayer remains rejected — and it is the genuinely
expensive thing being avoided.

### Explicit non-goals

These are **not** deferred features. They are rejected, and adding them requires a new
ADR.

| Non-goal | Why |
|---|---|
| Multiplayer, in any form | See above. Enormous permanent burden for a single-player generational simulation |
| Any user seeing another user's world | Same reason. Sharing, social feeds, and leaderboards all fall here |
| Runtime generative AI | Output is neither deterministic nor free, and the simulation must reproduce exactly |
| A network round-trip per tick | The simulation runs locally; the server stores saves. A dead server must not stop play |
| Microtransactions | Distorts every design decision away from believability |
| Retention mechanics — daily rewards, streaks, engagement loops | Same reason. The world continues because it is a simulation, not to make you log in |
| 3D graphics or an asset pipeline | Enormous cost, near-zero contribution to a simulation-driven game |
| Real named people, brands, or units | Privacy, publicity-rights, trademark, and IP exposure |
| Mod support | Revisit at Layer 5 only if the engine is stable and someone actually wants it |
| Real-time or action gameplay | The simulation advances in monthly ticks; twitch mechanics do not fit |
| Historical accuracy about real wars | The geopolitical system is fictional and generated. Modelling real conflicts invites both factual and ethical problems |
| Writing our own authentication | Password hashing, sessions, and reset flows are easy to get dangerously wrong. Use a maintained provider |

### Open, not decided

**Monetization.** Free, optional support, one-time purchase, or subscription — all
remain open (ADR-0015). Decided at public beta using real hosting-cost data, not now.

The non-goals above constrain the *design*, not the price. A subscription is not
microtransactions. But the pressure a subscription creates — to add retention mechanics,
to keep people logging in — is exactly what those non-goals exist to resist, so whatever
model is chosen, the design constraints stand unchanged.

### Now required *(previously rejected)*

**User accounts and a backend.** Superseded by ADR-0013. Scoped tightly: authentication
and save storage only. Shipped at Milestone 6, not before. Every save carries a `userId`
from the first save ever written so this arrives as an additive change rather than a
migration.

### Deferred, not rejected

Native mobile apps · desktop packaging · localization · full accessibility audit ·
offline-first installable app. All reasonable later; none are foundation-phase concerns.

---

## 6. Success criteria

**Foundation phase (now).** Complete, internally consistent documentation. An
architecture recommendation with honest tradeoffs. A first milestone small enough to
actually finish. No gameplay code. No irreversible decisions taken casually.

**Milestone 1.** A deterministic town of ~100 people simulated for 120 monthly ticks,
producing readable causal and historical records, with byte-identical output across
two runs of the same seed.

**Layer 1 complete.** The engine runs, saves, loads, migrates, and is covered by tests
that would actually catch a regression — in a browser, at a URL you can send to someone.

**Milestone 6 complete.** Two people can each hold their own account and their own
saves, neither can reach the other's data, and a restore from backup has actually been
performed rather than merely configured.

**Project-level.** The real measure: *reading the generated life story of a simulated
person is interesting.* If a person's 40-year history is not worth reading as plain
text, no interface will rescue it. This is the honest test of whether the project is
working, and it can be applied as early as Milestone 1.

---

## 7. Product risks

Full register with likelihood and impact in `RISK_REGISTER.md`. The four that could
end the project:

**Scope explosion.** The design scope is genuinely enormous — fourteen major domains,
each individually a substantial project. Mitigated by strict layering, the Three
Gates, and the rule that every layer is a satisfying place to stop.

**Solo capacity.** At ~10 hours a week, the complete five-layer vision is not
realistically achievable by one person still learning to code. This is stated plainly
rather than hidden. The mitigation is not working faster; it is ensuring Layers 1–3
constitute a finished, worthwhile thing on their own.

**Motivation decay.** Solo projects die from lost interest more often than from
technical failure. **Substantially reduced by the web pivot** — ADR-0012 moves a
visible interface to Milestone 2, immediately after the first working tick, rather than
the six months of invisible progress the desktop plan required. Milestone 1 must still
produce genuinely readable life stories, not raw data dumps.

**User data.** Accounts arrive at Milestone 6, and that is the one part of this project
where a mistake harms real people rather than a save file. Mitigated by using a
maintained authentication provider, a mandatory security review, and storing the
minimum data that works. Milestones 0–5 hold no user data at all.

**Sensitive-topic representation.** The design includes war, casualties, death, mental
illness, disability, addiction, crime, incarceration, and inequality. These must be
represented with care — neither glorified nor reduced to stereotype. Law 10 states the
constraint; every relevant design document must apply it concretely, not gesture at it.

---

## 8. Authority

`../CLAUDE.md` is the controlling constitution. `DECISION_LOG.md` records changes to
it. `LIFE_ENGINE_BOOTSTRAP.md` is preserved history and does not override either.

Amendments to this charter require an ADR.
