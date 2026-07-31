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

## 7. Performance expectations

**Unmeasured. These are targets, not predictions, and no code exists.**

| Target | Value |
|---|---|
| Monthly tick, typical mid-game | Under ~100 ms |
| Deep population | Low hundreds |
| Medium population | Low thousands |
| Light population | Tens of thousands |
| Aggregate | Unbounded — statistics only |

The tick budget is the number that matters: it determines whether advancing a year
feels instant or sluggish. Everything else is a means to it.

### Browser memory is the binding constraint

The simulation runs in the player's browser (ADR-0010). A browser tab has considerably
less memory headroom than a desktop process, and **a tab that exhausts memory is killed
without warning** — losing unsaved progress with no error message.

This makes tiering more important than it would be on desktop, not less. The aggregate
tier stores no individuals at all, which is where nearly all the leverage is. Memory
per person, not tick time, is the number most likely to force a design change.

Two consequences to design for now:

- **Deep and Medium populations may need to be smaller than the table above** on
  low-end devices. The tier thresholds should be configurable rather than constants.
- **Autosave protects against tab termination.** A player who loses forty simulated
  years to a silent tab kill will not come back.

Milestone 3 replaces this table with profiled measurements taken in a real browser, not
in Node. Do not make architectural commitments based on it meanwhile — `CLAUDE.md` §7
requires profiling evidence over speculation.

---

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
