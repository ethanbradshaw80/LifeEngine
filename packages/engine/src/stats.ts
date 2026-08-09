/**
 * The body, and the things a person does about it.
 *
 * From the owner's `player_stats_spec.md` phase 2, and his direction while
 * it was being built: *"civs should have civilian stats and ways to work on
 * them as well starting from age like 12"* and *"it should all tie
 * together."*
 *
 * WHAT MOVED, AND WHY IT HAD TO. Fitness lived on the SERVICE RECORD. It was
 * a military promotion-points figure, which meant a civilian had no fitness
 * at all — not a low one, none — and a stat panel offering "Train" to a
 * fourteen-year-old would have been moving a number that did not exist for
 * them. Worse, it meant the body only began at enlistment: somebody who
 * spent their teens and twenties idle arrived at the recruiting station in
 * the same condition as somebody who had not.
 *
 * So the body belongs to the PERSON, from twelve, whatever they go on to
 * do. The service record now reads it. That is the tie the owner asked for:
 * a life spent fit is a life that passes the entry test, clears the school's
 * day-zero standard, and scores on the promotion board — and a life spent
 * otherwise is not.
 *
 * ON THE SCALE. Fitness stays on its 0–300 range rather than being rescaled
 * to the 0–1000 the other stats use. That range IS the promotion-points
 * scale: every military threshold, the board cap, the school day-zero bars
 * and the fitness-failure flag are expressed in it. Rescaling would have
 * rebalanced the whole military ladder as a side effect of building a
 * panel, and a panel is not worth that. The display divides by three.
 *
 * SINGLE-WRITER. This module owns `person.fitness`. The service's fitness
 * TEST still records when it was taken and what it read, because that is a
 * military event about a body — but the body is not the army's.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { MAX_FITNESS_POINTS } from './content.js'
import { openStream, Stream } from './rng.js'
import type { HabitKind, HabitRecord, Person, World } from './types.js'

/**
 * The age a body starts being something a person can work on.
 *
 * The owner's number. Below it a child's condition is their childhood's,
 * not a stat with a training plan attached — and offering an eight-year-old
 * a fitness régime is the kind of thing that makes a life simulation read
 * like a spreadsheet.
 */
export const STATS_FROM_AGE = 12

/** Nobody is at nothing; a living body has some floor under it. */
const FITNESS_FLOOR = 40

/**
 * What keeping at it is worth, at the top of the drift.
 *
 * TUNED. Big enough that a trained body is visibly a different body — sixty
 * points is a fifth of the whole scale — and small enough that it does not
 * out-run age or make a fifty-year-old the fittest person in town.
 */
const TRAINING_LIFT = 60

/**
 * HOW LONG IT TAKES TO BE WORTH THE WHOLE LIFT.
 *
 * THE REWORK BOTH SPECS ASKED FOR (casino §3: "put in the work, don't
 * just toggle it"; sports §"Training is real work": "an ongoing regimen,
 * not a switch... athleticism is EARNED over time, never toggled on").
 *
 * The old model already did the harder half correctly — training moves
 * the TARGET rather than the number, so nobody is handed fitness and the
 * body has to walk there. What it did not do was make the target itself
 * earned: flipping training on granted the full sixty points of ceiling
 * immediately, and a person who had trained for fifteen years had exactly
 * the same ceiling as one who started last month. That is a toggle
 * wearing a trajectory's clothes.
 *
 * Three years to the whole of it. A month of running is worth almost
 * nothing and should be; a decade of it is worth all of it.
 */
const TRAINING_RAMP_MONTHS = 36

/**
 * What a habit is worth right now, per-mille of its full value, given how
 * long it has been kept. Shared by every habit so none of them can
 * quietly become a switch again.
 */
export function habitMaturity(months: number): number {
  if (months <= 0) return 0
  return Math.min(1_000, Math.floor((months * 1_000) / TRAINING_RAMP_MONTHS))
}

/** What a month of study adds, before curiosity has its say. */
const STUDY_STEP = 3

/**
 * Where a body settles at a given age, before anything is done about it.
 *
 * The same shape the service's own test used — vitality and resilience,
 * dragged down by age past thirty — so relocating the number did not
 * silently re-tune it. What is new is that it applies to everybody from
 * twelve, and that a training habit can lift the target above it.
 */
export function fitnessTargetFor(
  person: Person,
  age: number,
  training = false,
  /**
   * HOW LONG THEY HAVE KEPT IT UP, in months. Zero is somebody who took
   * it up this month and gets almost nothing for it yet.
   *
   * Defaulted so every existing caller keeps its meaning — a caller that
   * does not know the months is asking about a habit in the abstract, and
   * the honest answer there is the mature one.
   */
  trainingMonths = TRAINING_RAMP_MONTHS,
): number {
  if (age < STATS_FROM_AGE) return 0
  const base = Math.floor(person.traits.vitality / 5) + Math.floor(person.traits.resilience / 10)
  // Young bodies are still arriving; the teens ramp in rather than starting
  // at an adult's number.
  const youth = age < 18 ? Math.floor(((age - STATS_FROM_AGE) * 100) / (18 - STATS_FROM_AGE)) : 100
  const ageDrag = Math.max(0, (age - 30) * 3)
  let target = Math.floor((base * youth) / 100) - ageDrag
  // TRAINING MOVES THE TARGET, NOT THE NUMBER. This is the whole shape the
  // spec asks for: taking up running does not hand you fitness, it changes
  // where your body is heading, and the drift still has to walk you there
  // over months. Stop, and the target drops back and the body follows it
  // down — which is what a habit decaying actually looks like.
  // AND THE LIFT IS EARNED. This is the toggle the rework exists to kill:
  // the ceiling now arrives over three years rather than the month
  // somebody decides to want it.
  if (training) {
    target += Math.floor((TRAINING_LIFT * habitMaturity(trainingMonths)) / 1_000)
  }
  return Math.max(FITNESS_FLOOR, Math.min(MAX_FITNESS_POINTS, target))
}

/** What this body is, right now. Zero for the too-young, by design. */
export function fitnessOf(world: World, personId: EntityId): number {
  return world.people.get(personId)?.fitness ?? 0
}

/**
 * The month's drift, for every living body old enough to have one.
 *
 * A body moves toward its target rather than sitting on it: a month of
 * being twenty-nine and a month of being fifty-two pull in different
 * directions, and neither happens overnight. The small seeded variance is
 * what stops every person of the same age and traits from reading
 * identically — bodies differ, and the difference is not a decision
 * anybody made.
 */
export function runStats(world: World, tick: Tick): void {
  for (const person of [...world.people.values()].sort((a, b) => a.id - b.id)) {
    if (person.deathTick !== null) continue
    const age = ageAt(person.birthTick, tick)
    if (age < STATS_FROM_AGE) continue

    runHabits(world, person)
    // THE MONTHS ARE PASSED HERE, and this is the one call site where it
    // matters — the monthly drift is what actually walks a body toward
    // its ceiling. Leaving the default in place here would have made the
    // ramp decorative: every screen would say "earned over three years"
    // while the simulation handed out the whole lift on day one.
    const trains = keepsHabit(world, person.id, 'training')
    const target = fitnessTargetFor(
      person,
      age,
      trains,
      trains ? habitMonths(world, person.id, 'training', tick) : 0,
    )
    const current = person.fitness ?? 0
    if (current === 0) {
      // First month at twelve: a body arrives at its own level rather than
      // climbing to it from nothing over years.
      world.people.set(person.id, { ...person, fitness: target })
      continue
    }

    const rng = openStream(world.seed, Stream.Health, person.id, tick + 7717)
    // A twelfth of the gap, and a point of noise either way. Slow enough
    // that a year of neglect shows and a year of work pays.
    const gap = target - current
    const step = gap === 0 ? 0 : gap > 0 ? Math.ceil(gap / 12) : Math.floor(gap / 12)
    const next = Math.max(
      0,
      Math.min(MAX_FITNESS_POINTS, current + step + rng.nextInt(-1, 2)),
    )
    if (next === current) continue
    world.people.set(person.id, { ...person, fitness: next })
  }
}

/**
 * Set the body directly — the single writer, used by the training verb and
 * by anything else that legitimately moves somebody's condition.
 */
export function setFitness(world: World, personId: EntityId, score: number): void {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return
  world.people.set(personId, {
    ...person,
    fitness: Math.max(0, Math.min(MAX_FITNESS_POINTS, Math.floor(score))),
  })
}

/**
 * THE STANDARD THIS BODY IS HELD TO, at this age.
 *
 * Real services age-band their fitness test, and this game needed to for a
 * reason that showed up the moment the body was measured properly: the
 * fitness-failure flag used ONE number, 128, for everybody, while
 * `fitnessTargetFor` drags a body down three points a year past thirty. So
 * the flag was not measuring condition, it was measuring age. Nine of
 * thirty-one serving members were flagged unfit and every single one of
 * them was thirty-three or older — flagged means no school, no promotion
 * and no reenlistment, so the army was quietly ejecting its own senior
 * ranks for the crime of being in their forties.
 *
 * That was true from the day the flag was written; relocating the body is
 * only what made anybody look. The bar now ages at exactly the rate the
 * body does, so what it tests is whether somebody is unfit FOR THEIR AGE.
 */
export function fitnessStandardFor(age: number): number {
  const AT_THIRTY = 128
  return Math.max(45, AT_THIRTY - Math.max(0, (age - 30) * 3))
}

// ---------------------------------------------------------------------------
// The derived stats (phase 3). Computed on read, stored nowhere.
//
// The spec is explicit that Health and Looks are derived rather than stored,
// and it is right: neither has any memory of its own. Health is what the
// health system already knows, read on the panel's scale. Looks is a
// function of the body and the years, and storing either would mean two
// owners for one fact and a lifetime of them drifting apart.
//
// Both answer on the 0–1000 scale the traits and wellbeing use. Fitness is
// the odd one out at 0–300 and stays that way for the reason given at the
// top of this file.
// ---------------------------------------------------------------------------

/** The panel's scale, shared with traits and wellbeing. */
const STAT_MAX = 1000

/**
 * HEALTH — overall bodily condition, 0–1000.
 *
 * Vitality is the constitution somebody was born with; a permanent
 * disability is carried for the rest of their life; an ailment is felt
 * while it lasts and then is not. Age is the slow one underneath all of it.
 *
 * A pure read of state the health system owns. This module never writes it.
 */
export function healthStatOf(world: World, personId: EntityId, tick: Tick): number {
  const person = world.people.get(personId)
  if (!person) return 0
  const age = ageAt(person.birthTick, tick)
  const record = world.health.get(personId)

  let value = 550 + Math.floor((person.traits.vitality - 500) / 3)
  // The body's long decline. Gentle until sixty, then not.
  value -= Math.max(0, (age - 35) * 4)
  value -= Math.max(0, (age - 65) * 6)
  if (record !== undefined) {
    // Permanent harm, and whatever is wrong today.
    value -= record.disability
    value -= Math.floor(record.severity / 2)
  }
  return Math.max(0, Math.min(STAT_MAX, value))
}

/**
 * LOOKS — 0–1000.
 *
 * A GENUINELY NEW STAT, and the spec says so after a build review: there is
 * no attractiveness field on a person anywhere in this game. `desirability`
 * exists but it belongs to a PLACE — it is how appealing a town is, and it
 * drives moving decisions. Reusing it would have made a person as handsome
 * as the city they live in.
 *
 * So it is built from what the game does know: the condition somebody is in,
 * the shape they keep themselves in, and how old they are. That is not the
 * whole of what makes a face, and it is not meant to be — it is the part a
 * life simulation can honestly claim to model, and it moves for reasons the
 * player can see rather than a number rolled at birth.
 *
 * The age curve peaks in the twenties and declines slowly, which is a
 * statement about how this game reads faces rather than a fact about people.
 */
export function looksOf(world: World, personId: EntityId, tick: Tick): number {
  const person = world.people.get(personId)
  if (!person) return 0
  const age = ageAt(person.birthTick, tick)

  // MEASURED AND RESCALED. The first weights were set against the fitness
  // range on paper — 0 to 300 — when a grown world produces roughly 100 to
  // 207. Combined with health's own middling median it capped looks at 539
  // of 1000: the best-looking person in town read 54 on the player's dial
  // and the whole top half of the scale was unreachable. A stat nobody can
  // score well on is as useless as one everybody scores the same on, which
  // is the mistake wellbeing made in the other direction.
  //
  // Condition carries most of it: somebody unwell looks unwell.
  let value = Math.floor(healthStatOf(world, personId, tick) * 0.8)
  // And the body they keep — worth up to about 250 at the fitness this
  // game actually produces.
  value += Math.floor((fitnessOf(world, personId) * 6) / 5)
  // Youth, and then the years. A gentle arc rather than a cliff.
  if (age < 18) value -= (18 - age) * 6
  else value -= Math.max(0, Math.floor(((age - 27) * 3) / 2))
  return Math.max(0, Math.min(STAT_MAX, value))
}

/**
 * SMARTS — 0–1000. Schooling, and the turn of mind that sought it out.
 *
 * Derived from education attainment and curiosity, both of which already
 * exist. Study will raise it when the activities land; nothing stores a
 * dynamic component yet, so this is honest as far as it goes and no
 * further.
 */
export function smartsOf(world: World, personId: EntityId): number {
  const person = world.people.get(personId)
  if (!person) return 0
  const attainment = world.education.get(personId)?.attainment ?? 0
  const studied = world.habits.get(personId)?.studied ?? 0
  return Math.max(
    0,
    Math.min(STAT_MAX, Math.floor(attainment * 0.6 + person.traits.curiosity * 0.4) + studied),
  )
}

/**
 * DISCIPLINE — 0–1000. Diligence, anchored, with room to move.
 *
 * The spec's own recommendation, taken: a diligence base with a bounded
 * band around it, "so service can raise it and misconduct can dent it, but
 * a lazy trait still shows". Service is steadying and a company punishment
 * is not, and both are read off records that already exist.
 */
export function disciplineOf(world: World, personId: EntityId, tick: Tick): number {
  const person = world.people.get(personId)
  if (!person) return 0
  let value = person.traits.diligence
  const record = world.service.get(personId)
  if (record !== undefined) {
    // Time in uniform, up to a bounded lift. Years of it, not months.
    const months = (record.dischargedAtTick ?? tick) - record.enlistedAtTick
    value += Math.min(120, Math.floor(months / 3))
  }
  // Every company punishment in the window costs, and they stack.
  //
  // WALKED BACKWARDS, NOT FILTERED. `world.events.filter(...)` reads the
  // WHOLE ledger — every event since the world began — and this function is
  // called per person per month by the crime system. Profiled at twenty
  // years: crime cost 23.7ms a tick, second only to finances, almost all of
  // it here. Events are appended in tick order, so walking back from the end
  // until the window closes reads only the months that matter.
  //
  // This is the third time this trap has been sprung in this codebase
  // (ADR-0039, then runWellbeing, now here). The rule: never filter
  // world.events inside a per-person loop.
  let marks = 0
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (event === undefined) break
    if (tick - event.tick >= 60) break
    if (event.type === 'disciplined' && event.subjectId === personId) marks += 1
  }
  value -= marks * 70
  return Math.max(0, Math.min(STAT_MAX, value))
}

// ---------------------------------------------------------------------------
// Habits — the activities, as trajectories rather than buttons.
// ---------------------------------------------------------------------------

export function habitsOf(world: World, personId: EntityId): HabitRecord | undefined {
  return world.habits.get(personId)
}

export function keepsHabit(world: World, personId: EntityId, kind: HabitKind): boolean {
  return (world.habits.get(personId)?.active ?? []).some((entry) => entry.kind === kind)
}

/** How long they have kept it up, in months. Zero when they have not. */
export function habitMonths(world: World, personId: EntityId, kind: HabitKind, tick: Tick): number {
  const entry = (world.habits.get(personId)?.active ?? []).find((e) => e.kind === kind)
  return entry === undefined ? 0 : Math.max(0, tick - entry.sinceTick)
}

/** Take one up. Idempotent — taking up a habit you already keep is nothing. */
export function takeUpHabit(world: World, tick: Tick, personId: EntityId, kind: HabitKind): void {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return
  if (keepsHabit(world, personId, kind)) return
  const record = world.habits.get(personId)
  world.habits.set(personId, {
    personId,
    active: [...(record?.active ?? []), { kind, sinceTick: tick }],
    studied: record?.studied ?? 0,
  })
}

/** Give one up. The body will notice; the mind keeps what it learned. */
export function dropHabit(world: World, personId: EntityId, kind: HabitKind): void {
  const record = world.habits.get(personId)
  if (record === undefined) return
  world.habits.set(personId, {
    ...record,
    active: record.active.filter((entry) => entry.kind !== kind),
  })
}

/**
 * The month's work on whatever somebody has taken up.
 *
 * Runs inside `runStats`, before the body drifts, so a month of training is
 * felt in the same month's fitness rather than the next one.
 */
function runHabits(world: World, person: Person): void {
  const record = world.habits.get(person.id)
  if (record === undefined || record.active.length === 0) return

  for (const entry of record.active) {
    if (entry.kind === 'study') {
      // A curious mind gets more from the same hour. Never decays.
      //
      // AND IT PLATEAUS, which is the other half of the rework. The old
      // accrual was FLAT: three points a month plus curiosity, for ever,
      // straight to the cap — so the twentieth year of study taught
      // exactly as much as the first, which is not true of anything.
      // Gains now shrink against the room left, so the curve bends and a
      // long student is genuinely better than a short one without ever
      // becoming unboundedly so.
      const held = world.habits.get(person.id)?.studied ?? 0
      const room = Math.max(0, 1_000 - held)
      const flat = STUDY_STEP + Math.floor(person.traits.curiosity / 250)
      const gain = Math.max(1, Math.floor((flat * room) / 1_000))
      world.habits.set(person.id, {
        ...(world.habits.get(person.id) ?? record),
        studied: Math.min(1000, (world.habits.get(person.id)?.studied ?? 0) + gain),
      })
    }
    // The 'social' habit's effect is applied by `wellbeing.ts`, which owns
    // that number. THE IMPORT RATCHET CAUGHT THIS: calling nudgeWellbeing
    // from here made stats and wellbeing import each other, and through
    // relationships and service that closed a five-module cycle. Habits are
    // plain world state, so the wellbeing module can read them without
    // importing anything from this one — which is the seam rather than an
    // entry on the allowlist.
  }
}
