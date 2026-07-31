# Causal Records

**Law 3 — everything important has a cause.**

The game must be able to explain *why* a person changed careers, ended a relationship,
moved, enlisted, deployed, was injured, was denied an award, or retired — and the
explanation must be **assembled from what the simulation actually recorded at the
time**, never invented afterward.

This is the difference between a simulation and a random event generator with good
prose. It is also, along with determinism, one of the two things that cannot be
retrofitted.

---

## 1. The central tension

Storing every input to every decision for every person forever is impossible. A
thousand people over a hundred simulated years generates an unbounded amount of
reasoning.

Storing nothing means explanations must be fabricated after the fact, which Law 3
explicitly forbids and which players notice immediately — invented explanations
contradict each other.

**The resolution: record decisions at the moment they are made, in a compact
structured form, and compress aggressively as they age.** Recording is cheap.
Reconstructing is impossible.

---

## 2. The seven parts of a causal record

The bootstrap requires distinguishing these. Each has a different lifetime.

| Part | What it is | Retention |
|---|---|---|
| **Source facts** | World state referenced by the decision — wages, health, distance, relationship strength | Not copied. Referenced by entity ID + tick. |
| **Decision inputs** | The specific factors weighed, with their weights | Stored, compressed at 5 years |
| **Selected action** | What was chosen | Permanent |
| **Rejected alternatives** | Options considered and not chosen | Only for major decisions; dropped at 5 years |
| **Outcome** | What actually resulted | Permanent |
| **Explanation projection** | Human-readable text generated *on demand* from the above | Never stored |
| **Historical summary** | The compressed long-term form | Permanent |

**The explanation projection is never stored.** It is generated when the player asks
"Why?". Storing generated prose would double the data and let text drift out of sync
with the facts it describes.

---

## 3. Record shape

Conceptually (not a final API):

```
CausalRecord
  recordId          stable, sequential
  tick              when the decision was made
  subjectId         whose decision
  decisionType      enum — CareerChange, RelationshipEnd, Enlist, Move, ...
  significance      Trivial | Notable | Major | Defining
  inputs[]          (factorId, weight, referencedEntityId?)
  chosen            actionId
  rejected[]        actionId[]      — Major and Defining only
  outcome           outcomeId, resolved possibly ticks later
  rngStreamId       which stream, for reproducibility
```

Notes:

- **`inputs` stores factor identifiers and weights, not prose.** `(FactorId.WageGap,
  weight: 340)` — not `"the pay was much better"`. The words are generated later;
  storing them wastes space and freezes phrasing.
- **`significance` drives retention.** It is assigned when the record is created, by
  the subsystem that owns the decision, and determines everything downstream.
- **`rngStreamId`** ties the record to determinism, so any recorded decision can be
  re-derived and verified.

---

## 4. Significance tiers

| Tier | Examples | Full record retained | Compressed to |
|---|---|---|---|
| **Trivial** | Routine monthly activity | Not recorded at all | — |
| **Notable** | Small purchase, casual acquaintance, minor illness | 2 sim-years | One-line summary |
| **Major** | Job change, move, relationship start/end, enlistment, injury | 10 sim-years | Summary + top 3 inputs |
| **Defining** | Marriage, divorce, birth, death, war service, conviction, business founding | Forever | Never compressed |

Trivial events are not recorded. Recording them would dominate storage and explain
nothing anyone will ever ask about.

**Compression is one-way and lossy.** Once a Major record is compressed, its rejected
alternatives and minor inputs are gone. That is intended. A player asking why their
grandfather took a job in 1974 deserves "better pay, closer to family, the plant was
closing" — not a fifty-factor weight vector.

---

## 5. Growth — measured

**Measured at Milestone 3. See `PERFORMANCE_BASELINE.md`.** Replaces the
order-of-magnitude guess that previously stood here.

At 100 people over 10 simulated years:

| | |
|---|---|
| Causal records written | 168 |
| Events written | 457 |
| Serialized save | 168 KB |
| Serialized bytes per person | ~1,700 |
| Save growth | **~8 KB per simulated year** |

Extrapolating that growth rate to an 80-year lifetime gives roughly 0.6 MB for a
100-person town — comfortable. At 10,000 people the save reached 8.6 MB after a
single decade, which is not.

**Compression is not urgent at the current scale, and is unavoidable at the
target scale.** The significance tiers in §4 remain the plan; the tier field is
already written on every record, so compression can be added without a save
migration.

Only **deep-tier** people produce full causal records. Medium tier produces
Defining records only. Light and aggregate tiers produce none — see
`SIMULATION_LEVELS.md`.

**Measured caveat.** Records and events are held in browser memory for the life
of a save, so they are a leading candidate for the first thing that has to be
trimmed. Design the compression path before it is needed, not after a tab gets
killed.

## 6. Generating explanations

When the player asks "Why did she leave that job?":

1. Look up the `CausalRecord` by subject and decision type.
2. Read `inputs`, sorted by weight descending.
3. Resolve referenced entities to current names and states.
4. Render the top N factors through a template keyed on `decisionType` and `factorId`.
5. If the record has been compressed, render the summary and say so plainly.

**Hard rules.**

- Never invent a factor absent from `inputs`.
- Never reorder factors for narrative effect. Weight order is the truth.
- If no record exists, say so honestly — "no record of why" is a legitimate answer and
  vastly better than a plausible fabrication.
- The *character* does not get omniscient knowledge. A soldier does not know the
  intelligence assessment that put their convoy on that road. The **player**, viewing
  history afterward, may. Keep these two views distinct.

---

## 7. What this is not

**Not a log file.** Logs are for developers and are unstructured. Causal records are
game data, are queryable, and ship with the save.

**Not an event stream.** Events say *what happened*. Causal records say *why a
decision was made*. A person catching a cold is an event with no causal record; a
person quitting a job is both.

**Not generated text.** No prose is stored. See §2.

---

## 8. Layer 1 scope

Milestone 1 implements the minimum that proves the concept:

- The `CausalRecord` type with significance tiers
- Recording for a deliberately small set of decision types: employment change,
  household formation, move, and death
- On-demand explanation generation for exactly those types
- **No compression yet** — but the tier field exists from the first record written, so
  compression can be added without a migration

Everything else is Layer 2 or later. The structure must exist early; the coverage grows.
