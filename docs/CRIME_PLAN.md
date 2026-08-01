# Crime & Justice — the second Layer 4 institution

**Status: Accepted (owner choice, 2026-07-31).** Layer 4 entered military-first
(ADR-0017, complete through M-HARM). The owner selected crime & justice as the
next arc over government/politics and businesses/economy.

## Three Gates

- **Realism.** A real town has petty crime, and this one finally has real
  motive: the arrears ledger (M-MONEY) means desperation is *modelled*, not
  invented. A theft can cite the four months of shortfall behind it.
- **Interaction.** Money (theft moves real cents between real households),
  employment (a record gates hiring the way severe ailments already do),
  family (jail is absence — the strain model and the household ledger both
  feel it), military (enlistmentBar gains a criminal-record clause),
  mortality and health untouched but adjacent (prison is not a spa).
- **Story.** The life-sim pillar: temptation, the knock at the door, the
  courtroom, the sentence, the coming home. Player choices on both sides —
  and a victim's story is a story too.

## Rules for this domain (in the constitution's spirit)

1. **`crime.ts` owns criminal records and jail state; single writer.**
   Nothing else writes a charge, a verdict, or a sentence.
2. **Theft never touches `household.savings` directly.** Finances is the
   single writer of the pot (M-MONEY); crime calls an exported
   `transferBetweenHouseholds` helper that finances owns. No second writer.
3. **Motive is circumstance first, character second.** Arrears months and
   joblessness drive propensity; personality nudges at the margin. Law 10:
   believability without stereotype — no trait makes a person *criminal*,
   circumstances make crime *thinkable*.
4. **Records at decision time, as always.** The charge cites the theft
   event; the verdict cites the charge; the sentence cites the verdict.
   A descendant should be able to read the whole chain.
5. **Conviction is consequence, not game over** (Law 7). Time is served,
   the record follows into hiring and enlistment — and fades from *gates*
   (never from history) after enough clean years.
6. **Independent review required** (CLAUDE.md §10: decision logic and core
   person state): architecture-reviewer on the C1 domain shape;
   scope-risk-reviewer if the milestone grows past its spec.

## Vertical milestones

- **C1 — Petty crime and the town's answer** (NPC world + the player as
  bystander/victim). Property theft with modelled motive; victim households
  lose real money through the finances helper; clearance → arrest → court →
  verdict → fine or a jail term in months. Jail = absent: no work, no wage,
  household strain. Criminal record on the person (schema bump + migration:
  empty — nobody's past is invented). Hiring reads it; `enlistmentBar` reads
  it. Feed/News surfaces it. Court is `the courthouse` — the workplace that
  has stood in `content.ts` since M-DEPTH2, waiting.
- **C2 — The player and the law.** The desperation moment (deep arrears →
  a pending with both roads real), being caught or not, the plea question,
  months served on-screen, the record following you into every application
  the Jobs tab already models. Same interception pattern as everything.
- **C3 — Justice depth.** Sentencing variety, probation, the constable as
  an occupation, town crime pressure as news, record-fade gates, and the
  victim's side as player experience.

Deferred beyond C3, deliberately: violent crime (needs care the first pass
should not rush), organized crime, civil disputes, juvenile justice.
