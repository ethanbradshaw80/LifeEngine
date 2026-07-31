# Design Index

Every design specification the project will eventually need.

**Almost all of these do not exist yet, and that is correct.** This index is a map of
the territory, not a to-do list. Writing all of them now would produce a large volume
of speculation about systems whose requirements are not yet known.

**Status:** `Written` · `Outlined` · `Planned` · `Deferred`
**Priority:** `P0` needed before the first prototype · `P1` needed for the layer it
sits in · `P2` long term
**Pre-prototype:** required before Milestone 1 completes?

---

## 1 · Foundation *(Layer 1)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 1.1 | `PROJECT_CHARTER.md` | Purpose, vision, scope, non-goals | — | **Written** | P0 | Yes |
| 1.2 | `SIMULATION_CLOCK.md` | Tick model, calendar, scheduling | 1.1 | Planned | P0 | Yes |
| 1.3 | `PERSON_MODEL.md` | Person state, traits, values | 1.2 | Planned | P0 | Yes |
| 1.4 | `EVENT_MODEL.md` | Event taxonomy, ordering, dispatch | 1.2 | Planned | P0 | Yes |
| 1.5 | `CAUSAL_RECORDS.md` | Why outcomes happened | 1.4 | **Written** | P0 | Yes |
| 1.6 | `WORLD_GENERATION.md` | Town generation, initial population | 1.3 | Planned | P0 | Yes |
| 1.7 | `NAMING_AND_CULTURE.md` | Name generation, regional variation | 1.6 | Planned | P1 | No |

## 2 · People and psychology

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 2.1 | `PERSONALITY_MODEL.md` | Trait structure, stability, change | 1.3 | Planned | P0 | Yes |
| 2.2 | `DECISION_ENGINE.md` | How people choose | 2.1, 1.5 | Planned | P0 | Yes |
| 2.3 | `MEMORY_MODEL.md` | Formation, decay, retrieval, reinforcement | 2.1 | Planned | P1 | No |
| 2.4 | `GOALS_AND_PLANS.md` | Short, medium, long-term ambition | 2.2 | Planned | P1 | No |
| 2.5 | `LIFE_CHAPTERS.md` | Turning points, narrative arc | 2.4 | Deferred | P2 | No |
| 2.6 | `SIMULATION_LEVELS.md` | Deep/medium/light/aggregate tiers | 1.3 | **Written** | P1 | No |

## 3 · Relationships and families *(Layer 2–3)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 3.1 | `RELATIONSHIP_GRAPH.md` | Edge types, strength, decay | 1.3 | Planned | P1 | No |
| 3.2 | `ROMANCE_AND_MARRIAGE.md` | Attraction, partnership, divorce | 3.1 | Planned | P1 | No |
| 3.3 | `PARENTING.md` | Styles, influence, child development | 3.2 | Planned | P1 | No |
| 3.4 | `FAMILY_CULTURE.md` | Traditions, reputation, transmission | 3.3 | Deferred | P2 | No |
| 3.5 | `HOUSEHOLDS.md` | Composition, shared finances | 3.1 | Planned | P1 | No |
| 3.6 | `ESTRANGEMENT.md` | Conflict, drift, reconciliation | 3.1 | Deferred | P2 | No |

## 4 · Education, careers, business *(Layer 2)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 4.1 | `EDUCATION_SYSTEM.md` | Schooling, trades, higher education | 1.3 | Planned | P1 | No |
| 4.2 | `SKILLS_MODEL.md` | Hierarchy, transfer, compounding | 4.1 | Planned | P1 | No |
| 4.3 | `CAREER_SYSTEM.md` | Hiring, performance, promotion | 4.2 | Planned | P1 | No |
| 4.4 | `OCCUPATIONS.md` | Catalogue and requirements | 4.3 | Planned | P1 | No |
| 4.5 | `BUSINESS_MODEL.md` | Firms, financials, competition | 4.3 | Deferred | P2 | No |
| 4.6 | `LABOR_MARKET.md` | Supply, demand, wages | 4.3 | Deferred | P2 | No |

## 5 · Finance, housing, economy *(Layer 2–4)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 5.1 | `PERSONAL_FINANCE.md` | Accounts, credit, debt | 1.3 | Planned | P1 | No |
| 5.2 | `HOUSING.md` | Rent, ownership, mortgages, value | 5.1 | Planned | P1 | No |
| 5.3 | `ECONOMIC_CYCLES.md` | Growth, recession, inflation | 5.1 | Deferred | P2 | No |
| 5.4 | `MARKETS.md` | Stocks tied to simulated firms | 4.5, 5.3 | Deferred | P2 | No |
| 5.5 | `INSURANCE.md` | Risk pooling, claims | 5.1 | Deferred | P2 | No |
| 5.6 | `TAXATION.md` | Tax rules driven by policy | 5.1, 7.1 | Deferred | P2 | No |

## 6 · Health and lifecycle *(Layer 3–4)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 6.1 | `LIFECYCLE.md` | Aging, fertility, mortality | 1.3 | Planned | P1 | No |
| 6.2 | `HEALTH_MODEL.md` | Conditions, treatment, disability | 6.1 | Deferred | P2 | No |
| 6.3 | `MENTAL_HEALTH.md` | Careful, non-stereotyped modelling | 6.2 | Deferred | P2 | No |
| 6.4 | `INHERITANCE.md` | Estates, heirs, succession | 5.1, 6.1 | Planned | P1 | No |

## 7 · Institutions *(Layer 4)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 7.1 | `GOVERNMENT.md` | Levels, elections, policy | — | Deferred | P2 | No |
| 7.2 | `JUSTICE_SYSTEM.md` | Crime, evidence, courts, corrections | 7.1 | Deferred | P2 | No |
| 7.3 | `MEDIA.md` | Coverage, framing, public opinion | 7.1 | Deferred | P2 | No |
| 7.4 | `TRANSPORT.md` | Networks, commuting, accessibility | 1.6 | Deferred | P2 | No |
| 7.5 | `WEATHER_AND_DISASTERS.md` | Climate, hazards, consequences | 1.6 | Deferred | P2 | No |
| 7.6 | `SCIENCE_AND_TECH.md` | Innovation, adoption, displacement | — | Deferred | P2 | No |

## 8 · Military, war, and veteran life *(Layer 4)*

The dedicated military group required by the bootstrap. Deepest single domain in the
design — see `MILITARY_AND_WAR_FOUNDATION.md` §18 on scope.

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 8.0 | `MILITARY_AND_WAR_FOUNDATION.md` | Boundaries for the whole group | 1.5 | **Written** | P1 | No |
| 8.1 | `GEOPOLITICAL_STATE.md` | Countries, relations, escalation | 8.0 | Deferred | P2 | No |
| 8.2 | `CONFLICT_MODEL.md` | War states, phases, progression | 8.1 | Deferred | P2 | No |
| 8.3 | `DEPLOYMENT_RISK.md` | The danger vector; no fixed ratings | 8.2 | Deferred | P2 | No |
| 8.4 | `THEATER_MODEL.md` | Theatres, missions, conditions | 8.3 | Deferred | P2 | No |
| 8.5 | `MILITARY_CAREERS.md` | Entry, training, assignment, promotion | 4.3, 8.0 | Deferred | P2 | No |
| 8.6 | `OCCUPATIONAL_EXPOSURE.md` | Specialty-driven experience | 8.5 | Deferred | P2 | No |
| 8.7 | `COMBAT_RESOLUTION.md` | Traceable, explainable outcomes | 8.4, 8.6 | Deferred | P2 | No |
| 8.8 | `CASUALTY_RECORDS.md` | Injury, disability, death, MIA, capture | 8.7, 6.2 | Deferred | P2 | No |
| 8.9 | `AWARDS_AND_ELIGIBILITY.md` | Strict criteria; wound recognition rules | 8.8 | Deferred | P2 | No |
| 8.10 | `UNIFORM_AND_RIBBON_RACK.md` | Precedence, placement, display | 8.9 | Deferred | P2 | No |
| 8.11 | `MILITARY_SCHOOLS.md` | Selection, effects, qualifications | 8.5 | Deferred | P2 | No |
| 8.12 | `UNIT_HISTORY.md` | Lineage, honours, former members | 8.5 | Deferred | P2 | No |
| 8.13 | `MILITARY_FAMILY_EFFECTS.md` | Relationship and household consequences | 3.2, 8.5 | Deferred | P2 | No |
| 8.14 | `VETERAN_LIFE.md` | Transition, benefits, identity, varied arcs | 8.5 | Deferred | P2 | No |

## 9 · History and legacy *(Layer 3–5)*

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 9.1 | `HISTORICAL_RECORDS.md` | What persists, how it compresses | 1.5 | Planned | P1 | No |
| 9.2 | `BIOGRAPHIES.md` | Life retrospectives, obituaries | 9.1 | Planned | P1 | No |
| 9.3 | `LEGACY.md` | Traits, reputation, generational effects | 9.2 | Deferred | P2 | No |
| 9.4 | `ARCHIVES.md` | Family, business, unit, world archives | 9.1 | Deferred | P2 | No |

## 10 · Player experience

Priorities raised by ADR-0012 — the interface arrives at Milestone 2, not Milestone 5.

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 10.1 | `DIFFICULTY.md` | Easy/Normal/Hard/Realistic — not multipliers | 1.1 | Planned | P1 | No |
| 10.2 | `PROGRESSIVE_DISCLOSURE.md` | Law 9 in practice | — | Planned | **P0** | Yes |
| 10.3 | `NOTIFICATIONS.md` | What interrupts, what resolves silently | 10.2 | Planned | P1 | No |
| 10.4 | `WHY_EXPLANATIONS.md` | Rendering causal records as prose | 1.5 | Planned | **P0** | Yes |
| 10.5 | `ONBOARDING.md` | Teaching a complex simulation | 10.2 | Deferred | P2 | No |
| 10.6 | `RESPONSIVE_LAYOUT.md` | Phone, tablet, desktop — it's a web app | 10.2 | Planned | P1 | No |
| 10.7 | `ACCESSIBILITY.md` | Keyboard, screen reader, contrast, motion | 10.2 | Planned | P1 | No |

10.2 and 10.4 became pre-prototype because the interface now ships at Milestone 2, and
both govern what that interface shows.

## 11 · Accounts and multi-user *(Milestone 6)*

Introduced by ADR-0009 and ADR-0010. **All deferred — none of this exists before
Milestone 6, and Milestones 0–5 need no server at all.**

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 11.1 | `ACCOUNTS.md` | Sign up, sign in, reset, delete | — | Deferred | P1 | No |
| 11.2 | `SAVE_SYNC.md` | Local ↔ server, conflict handling, offline | 11.1 | Deferred | P1 | No |
| 11.3 | `PRIVACY_POLICY.md` | What is stored, why, for how long | 11.1 | Deferred | P1 | No |
| 11.4 | `DATA_RETENTION.md` | Deletion, export, account closure | 11.3 | Deferred | P1 | No |

**11.3 and 11.4 are not optional paperwork.** They handle other people's data, which is
the one part of this project where a mistake causes real-world harm rather than a
broken save. See R-21.

---

## 12 · Product and release *(closed alpha onward)*

Introduced by ADR-0015. **All deferred — none is needed before Milestone 6.**

| # | Document | Purpose | Depends on | Status | Pri | Pre-proto |
|---|---|---|---|---|---|---|
| 12.0 | `PRODUCT_ROADMAP.md` | Stage gates from prototype to 1.0 | — | **Written** | P1 | No |
| 12.1 | `ANALYTICS.md` | What is measured, and what is deliberately not | 11.3 | Deferred | P1 | No |
| 12.2 | `FEEDBACK_CHANNELS.md` | In-app reporting, changelog, triage | 12.0 | Deferred | P1 | No |
| 12.3 | `COMMUNITY_GUIDELINES.md` | Moderation norms, written before needed | 12.0 | Deferred | P1 | No |
| 12.4 | `MONETIZATION.md` | Open question — decided at public beta | 12.0 | Deferred | P2 | No |
| 12.5 | `LAUNCH_CHECKLIST.md` | Entry criteria per stage, as a checklist | 12.0 | Deferred | P2 | No |

**12.3 deserves early thought despite being deferred.** The design covers war,
casualties, mental illness, addiction, crime, and inequality. A community around it will
discuss those topics, and some participants will have lived them. The care Law 10
demands of the simulation applies to the space around it.

---

## Required before Milestone 1 completes

**1.2, 1.3, 1.4, 1.6, 2.1, 2.2** — plus 1.1 and 1.5, already written.

## Required before Milestone 2 completes

**10.2** (progressive disclosure) and **10.4** (why-explanations). Both govern what the
first interface shows, and both are cheap to write and expensive to retrofit once
components exist.

## Everything else waits

Writing document 8.9 before document 1.3 exists would be guessing about a system four
layers up, built on a person model that has not been designed yet. Writing 11.1 now
would be designing accounts a year before they ship, against providers whose terms will
have changed by then.
