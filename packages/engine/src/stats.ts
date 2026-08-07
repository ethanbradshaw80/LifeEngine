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
import type { Person, World } from './types.js'

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
 * Where a body settles at a given age, before anything is done about it.
 *
 * The same shape the service's own test used — vitality and resilience,
 * dragged down by age past thirty — so relocating the number did not
 * silently re-tune it. What is new is that it applies to everybody from
 * twelve, and that a training habit can lift the target above it.
 */
export function fitnessTargetFor(person: Person, age: number): number {
  if (age < STATS_FROM_AGE) return 0
  const base = Math.floor(person.traits.vitality / 5) + Math.floor(person.traits.resilience / 10)
  // Young bodies are still arriving; the teens ramp in rather than starting
  // at an adult's number.
  const youth = age < 18 ? Math.floor(((age - STATS_FROM_AGE) * 100) / (18 - STATS_FROM_AGE)) : 100
  const ageDrag = Math.max(0, (age - 30) * 3)
  const target = Math.floor((base * youth) / 100) - ageDrag
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

    const target = fitnessTargetFor(person, age)
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
