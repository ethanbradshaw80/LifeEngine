/**
 * Wellbeing — morale, and the first stat this game has ever stored about how
 * a life FEELS rather than what it contains.
 *
 * From the owner's `player_stats_spec.md`. Everything else on the stats
 * panel derives from state that already exists; this is genuinely new.
 *
 * THE SHAPE, AND WHY IT IS THIS SHAPE. Wellbeing is a value that DRIFTS
 * TOWARD A BASELINE and is knocked off it by things that happen. The
 * baseline is what this life would settle at given the facts of it — work,
 * a roof, a marriage, health, debt — and the knocks are the events. Left
 * alone after a bad month, somebody recovers; left in a bad life, they
 * settle low and stay there. That is the difference between a mood and a
 * condition, and both are real.
 *
 * WHY NOT DERIVE IT. Health is derived, the flag is derived, and both are
 * better for it. Wellbeing is not, because it has MEMORY: the same person
 * with the same facts is in a different place depending on what happened to
 * them last year, and a pure function of current state cannot say that.
 * Storing it is the owner's call in the spec and it is the right one.
 *
 * SINGLE-WRITER. This module owns `world.wellbeing` and nothing else writes
 * it. Every move goes through `nudgeWellbeing`, which is also the only
 * place a cause is recorded — so a value that moved without a reason is not
 * reachable from here.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { spouseOf } from './relationships.js'
import type { Person, WellbeingCause, WellbeingRecord, World } from './types.js'

/** The scale everything on the stats panel uses. Traits already use it. */
export const WELLBEING_MAX = 1000

/** Where a life with nothing much wrong and nothing much right settles. */
export const WELLBEING_NEUTRAL = 550

/**
 * How many causes the panel remembers. Six is what the owner's mockup
 * shows, and a list longer than a screen is not an explanation.
 */
const CAUSES_KEPT = 6

/** How long a cause stays worth showing. A year is a life's memory here. */
const CAUSE_MONTHS = 12

/**
 * How fast a life returns to its baseline: a twenty-fourth of the gap each
 * month.
 *
 * MEASURED AND SLOWED. At a twelfth, the drift erased every event inside a
 * year and the stored value collapsed onto the baseline — ninety per cent
 * of the town sat between 522 and 646, which on the player's 0–100 dial is
 * everybody reading "about 60". A stat that says the same thing about
 * every life is not a stat.
 *
 * The whole argument for STORING wellbeing rather than deriving it is that
 * it has memory. A drift fast enough to forget last year takes that away
 * and leaves a slow, expensive way to compute the baseline.
 */
const DRIFT_DIVISOR = 24

export function wellbeingRecordOf(world: World, personId: EntityId): WellbeingRecord | undefined {
  return world.wellbeing.get(personId)
}

/** The value, 0–1000. Anybody without a record sits at neutral. */
export function wellbeingOf(world: World, personId: EntityId): number {
  return world.wellbeing.get(personId)?.value ?? WELLBEING_NEUTRAL
}

/** What has been moving it lately, newest first, for the panel's "Why?". */
export function wellbeingCausesOf(
  world: World,
  personId: EntityId,
  tick: Tick,
): readonly WellbeingCause[] {
  const record = world.wellbeing.get(personId)
  if (!record) return []
  return [...record.causes]
    .filter((cause) => tick - cause.tick <= CAUSE_MONTHS)
    .sort((a, b) => b.tick - a.tick || Math.abs(b.delta) - Math.abs(a.delta))
}

/**
 * WHERE THIS LIFE WOULD SETTLE, given the facts of it right now.
 *
 * Not a score of how good somebody has it — a place the value returns to
 * when nothing is happening. Every input is state another system owns and
 * this one only reads, which is what keeps the single-writer rule intact.
 */
export function wellbeingBaselineFor(world: World, person: Person, tick: Tick): number {
  let base = WELLBEING_NEUTRAL

  // Temperament. A resilient person's floor is higher; it is the same trait
  // that softens the knocks below, read here as where they come to rest.
  // WIDENED after measuring: at a twelfth of the trait this contributed a
  // range of eighty points across the whole population, which is nothing.
  base += Math.floor((person.traits.resilience - 500) / 5)

  // WORK. Not the pay — the having of it. Idleness in a working-age adult
  // is one of the strongest things in this model.
  const age = ageAt(person.birthTick, tick)
  if (age >= 18 && age < 65) {
    base += world.employment.has(person.id) ? 35 : -70
  }

  // A ROOF, AND WHAT IT COSTS. Homelessness is the floor of this game's
  // safety net and it should read like it.
  const household = person.householdId === null ? undefined : world.households.get(person.householdId)
  if (household !== undefined) {
    if (household.homelessSinceTick !== null) base -= 180
    else if (household.savings < 0) base -= 60
  }

  // THE BODY. A permanent disability is carried for life; an ailment is
  // felt while it lasts and then is not.
  const health = world.health.get(person.id)
  if (health !== undefined) {
    base -= Math.floor(health.disability / 8)
    base -= Math.floor(health.severity / 10)
  }

  // PEOPLE. A marriage is worth more than a friendship, and both are worth
  // something. Read off the relationship system rather than counted here.
  if (spouseOf(world, person.id) !== null) base += 60

  // MONEY, WHICH THE SPEC ASKS FOR AND THE FIRST PASS LEFT OUT ENTIRELY.
  // Not the amount — the SECURITY. What months of cover somebody has is
  // the thing that is actually felt: the difference between a hundred
  // dollars and a thousand is a different life, the difference between a
  // hundred thousand and a million is not.
  const accounts = world.accounts.get(person.id)
  if (accounts !== undefined && age >= 18) {
    const held = accounts.checking + accounts.savings
    if (held <= 0) base -= 55
    else if (held < 200_000) base -= 20
    else if (held > 2_000_000) base += 55
    else if (held > 600_000) base += 25
  }

  return Math.max(0, Math.min(WELLBEING_MAX, base))
}

/**
 * The only way wellbeing moves. A delta, and the words that explain it.
 *
 * RESILIENCE SOFTENS THE BLOWS, NOT THE GIFTS (spec §2a). A resilient
 * person does not enjoy a promotion more than anybody else; they take a
 * funeral better. Applying the buffer to both would have made resilience a
 * flatness trait, which is not what it means.
 */
export function nudgeWellbeing(
  world: World,
  tick: Tick,
  personId: EntityId,
  delta: number,
  words: string,
): void {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null || delta === 0) return

  let applied = delta
  if (delta < 0) {
    // At 1000 resilience a blow lands at half weight; at 0 it lands whole.
    const softening = Math.floor((delta * person.traits.resilience) / 2000)
    applied = delta - softening
  }
  if (applied === 0) return

  const existing = world.wellbeing.get(personId)
  const current = existing?.value ?? WELLBEING_NEUTRAL
  const next = Math.max(0, Math.min(WELLBEING_MAX, current + applied))
  const cause: WellbeingCause = { tick, delta: applied, words }
  world.wellbeing.set(personId, {
    personId,
    value: next,
    // Newest last, oldest dropped. A bounded list, because an unbounded one
    // on every person is a save that grows for ever.
    causes: [...(existing?.causes ?? []), cause].slice(-CAUSES_KEPT),
  })
}

/**
 * The month's drift, for everybody living.
 *
 * Runs AFTER the systems that raise events, so a promotion this month is
 * felt this month rather than next. The event reader below is what turns
 * the world's own ledger into the causal spine the spec asks for — no
 * system has to know wellbeing exists, which is what keeps this from
 * becoming a wire into every module in the game.
 */
export function runWellbeing(world: World, tick: Tick): void {
  // THE MONTH'S EVENTS, READ ONCE.
  //
  // The first version asked `eventsFor(world, personId)` inside the person
  // loop. That helper FILTERS THE WHOLE LEDGER — every event since the
  // world began — so the cost was people × all-history, every month, for
  // ever. In a forty-year town that is millions of comparisons a tick for
  // a handful of hits, and it would have got worse every year the save
  // aged. Events are appended in tick order, so walking back from the end
  // until the tick changes reads exactly this month and stops.
  const struckThisMonth = new Map<EntityId, { delta: number; words: string }[]>()
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (event === undefined) break
    if (event.tick !== tick) break
    const move = MOVES[event.type]
    if (move === undefined) continue
    const list = struckThisMonth.get(event.subjectId)
    if (list === undefined) struckThisMonth.set(event.subjectId, [{ ...move }])
    else list.push({ ...move })
  }

  for (const person of [...world.people.values()].sort((a, b) => a.id - b.id)) {
    if (person.deathTick !== null) continue

    // What happened to them this month. Oldest first, so a month with two
    // events reads in the order they were recorded.
    const struck = struckThisMonth.get(person.id)
    if (struck !== undefined) {
      for (let i = struck.length - 1; i >= 0; i--) {
        const move = struck[i]
        if (move === undefined) continue
        nudgeWellbeing(world, tick, person.id, move.delta, move.words)
      }
    }

    // And the pull back toward where this life sits.
    const record = world.wellbeing.get(person.id)
    const current = record?.value ?? WELLBEING_NEUTRAL
    const baseline = wellbeingBaselineFor(world, person, tick)
    const gap = baseline - current
    if (gap === 0 && record !== undefined) continue
    const step = gap > 0 ? Math.ceil(gap / DRIFT_DIVISOR) : Math.floor(gap / DRIFT_DIVISOR)
    world.wellbeing.set(person.id, {
      personId: person.id,
      value: Math.max(0, Math.min(WELLBEING_MAX, current + step)),
      causes: (record?.causes ?? []).filter((cause) => tick - cause.tick <= CAUSE_MONTHS),
    })
  }
}

/**
 * WHAT A LIFE'S EVENTS ARE WORTH, in the words the panel will print.
 *
 * Read straight off the event ledger, which means every one of these
 * already has a cause recorded elsewhere in the game — this table says what
 * it does to a person, not that it happened.
 *
 * The numbers are a first pass and want measuring. They are deliberately
 * ASYMMETRIC: losing work hurts more than finding it helps, a conviction
 * outweighs a commendation. That asymmetry is the honest shape of the
 * thing, and it is also what stops a busy life from floating to the ceiling.
 */
const MOVES: Readonly<Record<string, { readonly delta: number; readonly words: string }>> = {
  promoted: { delta: 55, words: 'Promoted' },
  hired: { delta: 60, words: 'Found work' },
  'left-job': { delta: -85, words: 'Out of work' },
  married: { delta: 90, words: 'Married' },
  divorced: { delta: -110, words: 'The marriage ended' },
  'had-child': { delta: 70, words: 'A child' },
  'completed-training': { delta: 35, words: 'Finished a course' },
  graduated: { delta: 45, words: 'Graduated' },
  'was-convicted': { delta: -120, words: 'Convicted' },
  'was-acquitted': { delta: 40, words: 'Acquitted' },
  disciplined: { delta: -45, words: 'In trouble at work' },
  wounded: { delta: -80, words: 'Wounded' },
  'fell-ill': { delta: -40, words: 'Taken ill' },
  recovered: { delta: 30, words: 'Back on your feet' },
  'was-assaulted': { delta: -95, words: 'Attacked' },
  'lost-housing': { delta: -150, words: 'Lost the roof' },
  rehoused: { delta: 80, words: 'Back under a roof' },
  'filed-bankruptcy': { delta: -70, words: 'Filed for bankruptcy' },
  'debt-discharged': { delta: 55, words: 'Out from under the debt' },
  'passed-over': { delta: -35, words: 'Passed over' },
  'barred-from-reenlistment': { delta: -60, words: 'The service will not have you back' },
  captured: { delta: -200, words: 'Taken prisoner' },
  repatriated: { delta: 120, words: 'Home from captivity' },
  bereaved: { delta: -100, words: 'A death in the family' },
}
