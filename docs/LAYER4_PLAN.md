# Layer 4 Plan — Military First

**Status:** ADR-0017 Accepted 2026-07-31; the five military milestones are
COMPLETE through M-HARM. Further Layer 4 institutions are paused by
ADR-0018 (2026-08-01) in favour of the D/P/W arcs.
**Written:** 2026-07-31, with Layers 1–3 built and playable (simulation v6,
168 tests). Companion to `MILITARY_AND_WAR_FOUNDATION.md`, which remains the
design authority; this document is about *building* it against the engine
that now exists.

---

## 1. The sequencing decision

The bootstrap listed Layer 4 as: economy and markets, government and politics,
healthcare, military and war, crime and justice, media, transportation. It did
not order them. The owner's priority — consistent since the original spec,
whose largest single section is §8 Military — is the military system.

**Decision (ADR-0017): Layer 4 is entered military-first.** Economy, government,
media, and transportation are deferred within the layer. (Since written:
crime C1 is COMPLETE; C2 belongs to the player-experience arc per ADR-0018;
C3 stays deferred.) Two consequences are accepted openly:

- Wars will move markets that do not exist yet. Economic consequences of
  conflict (§9 of the foundation doc) will be stubbed as narrative events, not
  modelled prices, until the economy domain arrives.
- Government exists only as far as war requires (a fictional "the government"
  that mobilizes, not an elected one).

This is the motivation trade the milestone plan explicitly permitted from day
one: *"if motivation requires pulling a thin slice of service forward, that
trade is available and is a legitimate choice."*

---

## 2. Foreclosure audit — §17 against the real engine

The foundation doc listed what Layers 1–3 must not foreclose. Audit result:

| Requirement | Status in the engine today |
|---|---|
| Typed extensive person history | ✅ Events + causal records + per-domain record maps (employment, education). A `service` map follows the same pattern. |
| Defining-permanence causal records | ✅ Significance tiers since Milestone 1; wound/death records slot in unchanged. |
| Non-kin persistent bonds | ✅ Typed relationship edges; adding a `comrade` type is a routine union extension + migration (done three times already). |
| Institutional history for places | ⚠️ Places are flat, but events already reference placeIds. Units and installations arrive as new entities with their own history arrays — no retrofit needed. |
| Health beyond alive/dead | ❌ **The one real gap.** Health is a vitality trait and a death tick. Injury, recovery, and permanent disability must be built BEFORE deployment outcomes, or combat resolution has nothing to resolve into. Pulled forward as L4-M2. |
| Foreign geography | ❌ Absent, by design — the world is one town. Nations arrive as a world-level layer beside the town, not a rebuild of it. |
| World-level events | ⚠️ Events are per-person. A war is not. Small type extension: world events with no subject, rendered as news. |

Nothing is painted into a corner. The foundation phase did its job.

---

## 3. The aggregate-nations rule

The most important architectural choice in this plan, drawn from two hard
lessons already paid for:

> **Foreign nations are aggregate-tier only. No individual foreign person is
> ever simulated.** A nation is statistics — population, capability, stability,
> casualties as numbers — exactly as `SIMULATION_LEVELS.md` §2 always intended
> the aggregate tier to work.

Why this is non-negotiable:

- **Measured, not assumed:** the tick loop is O(n²) in simulated people, and
  Milestone 3 proved 10,000 people already cost 210 ms/tick. Simulating even
  one small foreign city would bury the town that is the actual game.
- The player experiences foreign theatres through *their assignment there*,
  not through the theatre's residents. §7's occupational exposure does the
  work individuals would otherwise fake.

Enemy soldiers, foreign civilians, coalition partners: statistics with causal
records, never entities. If a design sketch requires "the enemy commander" as
a person, it fails this rule and gets redesigned.

---

## 4. The milestones

Five vertical slices. Each ships into the playable game, carries its own
SIMULATION_VERSION bump and schema migration, and is a satisfying place to
stop — the same discipline as Milestones 0–6, unchanged.

### L4-M1 · The world beyond the town (geopolitics)

Generated fictional nations (~a dozen) with capabilities, alliances, and a
relationship state machine (peace → tension → … → war → ceasefire →
stabilization, per foundation §4) advancing on the monthly tick. Conflict
*phases* modelled from day one. Every transition writes a causal record — a
war must be explainable (Law 3 at planetary scale).

- Uses **Stream 9, reserved for geopolitics since Milestone 1** — the
  foresight finally pays off.
- Surfaces in the game as news cards in the story feed: the world stops being
  weatherless.
- Tests: wars start AND end; no perpetual world war (long-run stability bands,
  the R-07 pattern); every transition explainable; determinism across
  save/load.
- **No player mechanics. No military service. News only.**

### L4-M2 · Bodies that break (health prerequisite)

Injury, illness, recovery, and permanent disability as person state —
civilian-first, valuable before any war touches it. Accidents that today kill
can instead wound. Disability interacts with employment (existing) and
mortality (existing).

- This is the §17 gap. Deployment outcomes without a health model would be
  a coin labelled died/fine, which the foundation doc forbids.
- New pending kinds where the player's body forces choices (work through it /
  rest). Modest scope; the deep healthcare domain stays deferred.

### L4-M3 · The uniform (service as a career)

Enlistment as a decision — a pending kind at 18+ for the player, propensity-
driven for NPCs, with the existing hasAnswered/education machinery. Fictional
branches, occupational specialty selection (the §7 exposure profiles begin
here), a `ServiceRecord` per person (the employment-record pattern), domestic
postings, service pay through the existing finances, discharge and
reenlistment decisions.

- Peacetime service must already be a complete, playable career — training,
  postings, promotion — before any war can find it. §6's point stands: most
  military work is not combat.

### L4-M4 · The war finds you (deployment and risk)

Active conflicts from L4-M1 generate theatres; service members from L4-M3 are
assigned; danger is computed per §5's factor table as a **vector, never a
scalar, never a country lookup** — the permanent rule, enforced by test.
Monthly tour resolution through occupational exposure; outcomes land on the
L4-M2 health model; death is Defining, fully traced, and asymmetric (the
character knew less than the record shows). Family strain wires into the
existing relationship-strain factors.

### L4-M5 · What remains (awards and veterans)

Awards engine with strict eligibility **enforced in code and tested** — wound
recognition only from enemy action, campaign credit only from qualifying
service. Service records rendered in the UI; veteran identity affecting
civilian work (skill transfer through the existing education/occupation
gates); retrospective and legacy integration — the service record a
grandchild finds is the same one the events wrote.

---

## 5. What is deliberately NOT in these five milestones

Units with persistent lineage (foundation §13) · schools and qualifications
(§12) · Reserve/Guard components · officer pathways · POW/MIA states · the
ribbon-rack UI · media coverage of wars · war economics. All still planned
(`DESIGN_INDEX.md` group 8); none needed for the first honest arc:
*enlist → serve → deploy or not → come home changed or not → be remembered.*

Scope warning, restated from the foundation doc without softening: **this
domain is as large as Layers 1–3 combined.** Five milestones buy the first
arc, not the whole §10 career structure. At the historical pace (~a milestone
per working session, ~10 hrs/week) that is months of work, and the plan
assumes it.

---

## 6. Review gates

Every L4 milestone passes review against the foundation doc before merge:

1. **The permanent rule** — grep-level check: no danger value keyed on a
   country identifier anywhere.
2. **Fictional-world constraint** — no real nation, unit, insignia, or
   conflict.
3. **Tone gates** — neither glorification nor reduction-to-trauma (§1);
   varied veteran outcomes asserted by test where feasible (§15).
4. **Explainability** — every major outcome carries a causal record; the
   asymmetric-information rule (§8) respected in UI text.
5. `military-scope-reviewer` agent (created with this plan, per ADR-0007's
   deferred trigger) runs on every military-touching change.
