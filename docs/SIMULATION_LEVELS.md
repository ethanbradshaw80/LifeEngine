# Simulation Levels

The world must feel populated without simulating every person in detail. Four tiers
make that possible.

This is also the direct mitigation for the bootstrap's own stated risk: *"unrealistic
expectations about population scale."*

---

## 1. Why tiers exist

Law 2 says every person is the main character of their own life. Law 9 says simulate
what is necessary and show what matters. Both are true, but a literal reading of Law 2
across an entire simulated country is computationally impossible.

The honest position: **Law 2 applies with full force to people who matter to the
player's story, and progressively less to people who do not — but the transition must
never be visible.** A person who becomes relevant must appear to have had a coherent
life all along.

---

## 2. The four tiers

| Tier | Who | Rough population share | Per-tick cost |
|---|---|---|---|
| **Deep** | The player, family, close friends, coworkers, rivals, key NPCs | Tens to low hundreds | Full decision model |
| **Medium** | Acquaintances, neighbours, colleagues, people in the player's institutions | Hundreds to low thousands | Simplified model |
| **Light** | Named people in the local area with minimal state | Thousands | Statistical transitions |
| **Aggregate** | Everyone else — the regional and national population | Unbounded | Statistics only; no individuals exist |

**Aggregate tier stores no people.** It stores population counts, age distributions,
employment rates, and similar figures. Individuals are *materialized* from it on
demand — see §5.

Population share is intentionally given as ranges. Actual numbers must come from
profiling at Milestone 2, not from this document.

---

## 3. State retained at each tier

The bootstrap requires defining exactly what each tier keeps. Losing state on demotion
and inventing it on promotion is the mechanism by which continuity breaks.

| State | Deep | Medium | Light | Aggregate |
|---|---|---|---|---|
| Entity ID | ✔ | ✔ | ✔ | — |
| Name, birth tick, sex | ✔ | ✔ | ✔ | — |
| Personality traits | Full | Full | Coarse | — |
| Values, motivations, fears | ✔ | Reduced | — | — |
| Individual memories | ✔ | — | — | — |
| Relationship edges | All | To Deep/Medium only | To Deep only | — |
| Employment record | Full history | Current only | Job category only | — |
| Education record | Full | Credentials only | Level only | — |
| Finances | Full | Balance only | Income band | — |
| Health | Full | Conditions only | Alive/dead | — |
| Causal records | All tiers | Defining only | — | — |
| Life goals and plans | ✔ | — | — | — |
| Full event history | ✔ | Defining only | Birth/death | — |

**Two invariants, absolute:**

1. **Entity ID, name, birth tick, and death tick survive at every non-aggregate tier
   and are never lost, ever.** These are what make a person the same person across
   tier changes. Losing them is unrecoverable.
2. **Demotion never deletes a Defining causal record or a Defining event.** Those are
   permanent per `CAUSAL_RECORDS.md` §4, regardless of tier.

---

## 4. Promotion and demotion

### Promotion triggers

A person is promoted when they become relevant: the player interacts with them
directly, they enter a relationship with a Deep person, they are hired into the same
workplace, they become a household member, they gain narrative significance (elected,
convicted, famous), or a Deep person begins tracking them.

Promotion is **immediate** — before the interaction resolves, never after.

### Demotion triggers

Demotion happens when relevance decays: no interaction for a sustained period, the
relationship weakens below threshold, geographic separation, or the linking Deep
person dies.

Demotion is **deliberately lagged** — a documented delay after the trigger, so that
a person the player is about to re-contact does not thrash between tiers.

### Rules

- **Promotion may synthesize only backward-compatible history.** Any generated
  detail must be consistent with every record already retained. If Light tier recorded
  "employed in retail since tick 240," promotion may invent *which shop* — never a
  different industry, and never a different start date.
- **Synthesized history is flagged as synthesized** in the record. It is not a lie to
  the player, and it lets a future bug be traced to synthesis rather than simulation.
- **Demotion is lossy and one-way.** Discarded detail does not come back. Re-promotion
  synthesizes fresh detail consistent with what was retained.
- **Tier is never part of the causal record.** A person did not change jobs *because*
  they were promoted to Deep tier. Tier is an implementation concern and must never
  leak into explanations shown to the player.

---

## 5. Materializing from aggregate

Aggregate tier holds no individuals. When one is needed — the player applies to a
company and needs an interviewer — a person is generated from the aggregate
distribution for that place, cohort, and occupation, given a fresh entity ID, and
inserted at Light or Medium tier.

The aggregate counts are decremented so the same person is not generated twice.

Materialization draws from the seeded RNG (`streamId` 1), so the same seed always
produces the same interviewer. It must be deterministic like everything else.

---

## 6. Continuity requirements

These are the properties the whole tier system exists to protect. A violation is a
serious bug.

1. **A person's identity is stable across all tier changes.** Same ID, same name, same
   birth date, forever.
2. **No contradictory history.** Synthesized detail must never conflict with retained
   records. This is the failure players notice first and forgive least.
3. **Death is permanent at every tier**, including aggregate.
4. **Family relationships survive demotion.** A demoted grandparent is still the
   grandparent. Kinship edges are retained even when other relationship edges are
   dropped.
5. **Tier is invisible.** Nothing in the interface, and nothing in any explanation,
   may reveal or depend on a person's tier.

---

## 7. Performance — measured

**Measured at Milestone 3. See `PERFORMANCE_BASELINE.md` for method and raw data.**
Superseded the estimates that previously stood here.

| Population | ms per tick | ms per simulated year | Heap |
|---|---|---|---|
| 100 | 0.27 | 3 | 0.7 MB |
| 1,000 | 3.20 | 38 | 2.7 MB |
| 10,000 | **210** | **2,520** | 20 MB |

Budget: a monthly tick should stay under ~100 ms.

### The measurement changed two assumptions

**1. Cost is super-linear.** Ten times the people costs roughly **66×** the time
per tick, not ten times. That is the signature of work proportional to *pairs*
of people. The cause is friendship formation in `systems.ts`, which filters the
whole living population to build a candidate list for each person.

**Consequence: the Light tier target of tens of thousands is not reachable with
the current algorithm.** At 10,000 people a single month costs 210 ms and a
simulated year takes 2.5 seconds. The fix is either this tier system or a
cohort/spatial index so candidate lookup stops scanning everyone — chosen
deliberately, not reflexively. Milestone 3 measured and did not tune.

**2. CPU bites before memory does.** This section previously assumed browser
memory was the binding constraint. It is not, at these sizes: 10,000 people fit
in about 20 MB, and the whole web page including React measured 11 MB in a real
browser. The tick loop runs out of budget long before a tab runs out of memory.

That does not retire the memory concern — saves grow without bound across
decades and no causal-record compression exists yet — but it reorders the
priorities. **The tier system is needed for CPU first, memory second.**

### Still true

- A tab that exhausts memory is killed without warning, so autosave still
  matters.
- Tier thresholds should be configurable rather than constants, since low-end
  devices will differ.

### Targets, restated

| Tier | Target population | Status |
|---|---|---|
| Deep | Low hundreds | Comfortable today |
| Medium | Low thousands | Reachable today |
| Light | Tens of thousands | **Blocked** on the O(n²) friendship lookup |
| Aggregate | Unbounded — statistics only | No individuals stored |

## 8. Testing strategy

| Test | Assertion |
|---|---|
| **Round-trip** | Deep → Medium → Deep preserves all invariant state (§3) |
| **Continuity** | Synthesized history never contradicts a retained record |
| **Determinism** | Same seed produces identical tier assignments |
| **Materialization** | Same seed produces the same generated person; aggregate counts stay consistent |
| **No leakage** | No explanation string or player-visible field references tier |
| **Thrash** | A person repeatedly near the demotion threshold does not oscillate |
| **Budget** | Tick time stays within budget as Light population grows |

---

## 9. Layer 1 scope

**Milestone 1 uses Deep tier only, for approximately 100 people.**

The tier system is designed now and built later. Implementing four tiers before there
is a working single-tier simulation would be optimizing a system whose costs are still
unknown — and the tier boundaries should be drawn from profiling data, not guesses.

What Milestone 1 must do: **include the tier field on the person record from the first
save written**, set to Deep. That makes the tier system addable later without a save
migration, which is a meaningful saving for near-zero cost today.
