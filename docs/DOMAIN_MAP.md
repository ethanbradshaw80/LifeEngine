# Domain Map

**Law 12 — architecture must remain modular.**

This document defines who owns what data, how domains communicate, and the rules that
prevent the two failure modes that kill simulation projects: **duplicated authoritative
state** and **circular dependencies**.

---

## 1. The one rule that matters

> **Every piece of data has exactly one owning domain. Only that domain may write it.
> Everyone else reads a copy or asks a question.**

When two domains can both write the same field, they will eventually disagree, and
there is no principled way to decide which is correct. This is the most common cause
of "the save file is corrupt" bugs in simulation games, and it is entirely preventable.

---

## 2. Domains and ownership

Layer assignment per `CLAUDE.md` §8. Domains not in Layer 1 are planned, not built.

| Domain | Layer | Owns (authoritative) | Must never write |
|---|---|---|---|
| **Time** | 1 | Current tick, calendar date, tick scheduling | Anything else |
| **Identity** | 1 | Entity IDs, ID allocation, existence, lifespan bounds | Any domain's state |
| **People** | 1 | Name, birth tick, death tick, traits, values, physical state | Employment, money, relationships |
| **Events** | 1 | The event log, event ordering, dispatch | Any domain's state |
| **Causality** | 1 | Causal records, significance, compression | Any domain's state |
| **Geography** | 1 | Places, regions, distances, place history | People, businesses |
| **Households** | 2 | Household membership, shared finances, dwelling link | Person traits, employment |
| **Relationships** | 2 | The relationship graph, strength, type, history | Person traits, household composition |
| **Education** | 2 | Enrolment, credentials, skills gained | Employment, money |
| **Careers** | 2 | Employment records, job history, wages, performance | Person traits, money balances |
| **Finance** | 2 | Account balances, debts, assets, transactions | Employment, prices |
| **Housing** | 2 | Dwellings, tenure, property values, condition | Household membership |
| **Business** | 2 | Firms, employees list, financials, ownership | Person state, wages *(see §5)* |
| **Lifecycle** | 3 | Aging, fertility, mortality resolution | Health conditions |
| **Inheritance** | 3 | Estate resolution, heirs, transfers | Account balances *(commands Finance)* |
| **Archive** | 3 | Historical records, biographies, legacy | Live entity state |
| **Economy** | 4 | Prices, rates, cycles, labour market conditions | Individual balances |
| **Government** | 4 | Policy, tax rules, elections, officeholders | Individual finances |
| **Health** | 4 | Conditions, treatment, disability, health trajectory | Death *(commands Lifecycle)* |
| **Geopolitics** | 4 | Country relations, conflict state, theatre conditions | Individual assignments |
| **Military** | 4 | Service records, assignments, units, awards | Person health *(commands Health)* |
| **Justice** | 4 | Crimes, cases, verdicts, sentences, records | Person state |
| **Media** | 4 | Publications, coverage, public opinion | Any simulated fact |
| **Transport** | 4 | Networks, accessibility, commute cost | Geography |

Note the recurring pattern: a domain that *causes* a change in another domain sends a
**command**; it does not reach in and write. Health does not kill people — it tells
Lifecycle that a person's condition is terminal, and Lifecycle owns the death.

---

## 3. Communication patterns

Exactly three, in strict preference order.

### Query (preferred)

Synchronous, read-only, no side effects. "What is this person's current wage?"

Always safe. Cannot create cycles at the data level. Use this whenever it works.

### Command

An explicit request to the owning domain to change its own state. "Terminate
employment record E, reason: layoff." The owner validates and may refuse.

Commands are how cross-domain change happens. The caller never writes; the owner
always does.

### Event

A past-tense broadcast that something happened. "PersonDied(id, tick, cause)."
Subscribers react. The publisher does not know or care who listens.

Events decouple, but they make control flow harder to follow and are the usual source
of unexpected ordering bugs. Prefer commands when there is exactly one intended
recipient. Use events when many domains care and the publisher should not know about
any of them.

**Ordering:** event handlers execute in ascending `streamId` of the subscribing
domain, then ascending entity ID. Never in subscription order — that would make
behaviour depend on initialization order, which is a determinism hazard
(`DETERMINISM.md` §3).

---

## 4. Preventing circular dependencies

**Rule 1 — no synchronous query cycles.** If A queries B during a tick, B may not
query A during the same tick. Cycles are broken with an event (deferred to the next
tick) or by moving the shared data to a domain both can depend on.

**Rule 2 — layered dependency direction.** A domain may query domains in its own layer
or below, never above. Layer 4's Military may query Layer 1's People. People may never
query Military. This makes the whole graph acyclic by construction and is why Layer 1
domains must be genuinely foundational.

**Rule 3 — shared primitives live in a common module.** `EntityId`, `Tick`, `Money`,
`PlaceId` belong to a shared kernel that every domain may depend on and that depends
on nothing. Keep it small: types and pure functions only, never behaviour.

**Rule 4 — the dependency graph is tested.** Once code exists, add a test that walks
the import graph and fails on any upward or circular reference. Reviews forget; tests
do not.

The same test enforces the engine purity rule: `packages/engine` may import from
`packages/shared` and nothing else — no React, no DOM, no I/O. See `CLAUDE.md` §6.

---

## 5. Worked example — the wage problem

Illustrates why the rules exist. A person's wage looks like it belongs to three domains.

- **People** knows the person.
- **Careers** knows they are employed.
- **Business** knows the employer pays them.
- **Finance** knows money arrives monthly.

**Owner: Careers.** The wage is an attribute of the *employment relationship*, which is
exactly what Careers owns.

Then:

- Business **queries** Careers to total its payroll. It does not store per-employee wages.
- Finance **subscribes** to `WagePaid` events emitted by Careers, and credits the account.
- People **stores nothing about wages at all.**
- A raise is a **command** to Careers, which validates it, updates the record, and
  emits `WageChanged`.

If instead Business also stored a wage figure, the two copies would drift the first
time a raise was applied through one path and not the other — and the save would then
contain two contradictory truths with no way to tell which is right.

---

## 6. Anti-patterns — explicitly banned

| Banned | Why |
|---|---|
| A `Person` class holding job, house, money, relationships, health, and service record | The god object Law 12 names directly. It makes every domain depend on every other. |
| A `GameManager` or `World` singleton that mutates state | Hides ownership, defeats testing, creates hidden coupling |
| The same field stored in two domains | Guaranteed to drift |
| A domain reaching into another's collections to write | Bypasses validation and causal recording |
| Events used where a command is meant | Obscures who is responsible for a change |
| UI holding state the engine does not have | Directly violates ADR-0003 and ADR-0012 |
| Module-level mutable state anywhere in the engine | Breaks test isolation, replay, and worker portability |
| Any I/O inside the engine — storage, network, clock | Breaks determinism and blocks running server-side |

---

## 7. Layer 1 scope

Only six domains are built for Milestone 1: **Time, Identity, People, Events,
Causality, Geography.**

That is deliberately minimal. It is enough to generate a town, age people, record why
things happened, and save the result — and small enough that the ownership rules can
be validated cheaply before there are twenty domains to untangle.

Everything else in §2 is planned, not built. Do not create placeholder projects or
empty classes for them (`CLAUDE.md` §8: do not create hundreds of placeholder files).
