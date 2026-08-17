/**
 * SPECIAL DUTY — THE TOURS THAT TAKE YOU OUT OF YOUR UNIT (§10.1).
 *
 * §10.1 calls this "the single biggest gap, and the best fit for a life sim",
 * and it names which one to build first and exactly why:
 *
 * > **Recruiter.** And this is the one worth building first, because a
 * > recruiter gets sent TO A TOWN — possibly YOUR OWN. You go home in
 * > uniform, you sit in a strip-mall office, and YOU ENLIST THE KIDS YOU GREW
 * > UP WITH. A townsperson's enlistment event now has your character's name on
 * > it, twenty years later, in their record. That is Law 4 paying out, and
 * > nothing in the game does it today.
 *
 * That is the whole reason this module exists, and everything else in it is in
 * service of that one sentence being true.
 *
 * FOUR DUTIES, all of them: two or three years away from your unit and your
 * trade, hard on the family, good for promotion.
 *
 *   RECRUITER — posted to a town, and the enlistments carry your name.
 *   DRILL SERGEANT — every recruit who passes through carries you on their
 *     file, which is the same mechanic pointed the other way.
 *   HONOUR GUARD — funerals. It puts a character at the worst day of somebody
 *     else's family's life, repeatedly, for two years.
 *   STAFF — for officers, the tour where a career stops being a platoon.
 *
 * HOW IT IS STORED: on the service record's existing `specialDuty` string and
 * `specialDutyUntilTick`, both optional, so a save written before this loads
 * with nobody on special duty and picks it up from the next posting cycle.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import { factor, recordDecision, recordEvent } from './records.js'
import type { World } from './types.js'

export type SpecialDuty = 'recruiter' | 'drill' | 'honour-guard' | 'staff'

export const DUTY_TITLES: Readonly<Record<SpecialDuty, string>> = {
  recruiter: 'recruiting duty',
  drill: 'drill sergeant duty',
  'honour-guard': 'the honour guard',
  staff: 'a staff tour',
}

/** Two to three years, which is what makes it a chapter and not an errand. */
const DUTY_MONTHS = 30

/** Nobody goes on special duty below this — it is a mid-career thing. */
const DUTY_FROM_RANK = 5

/**
 * WHO IS ON WHAT, right now.
 *
 * Read off the record so there is one writer. Returns null for the great
 * majority of people, who are with their unit doing their job.
 */
export function specialDutyOf(
  world: World,
  personId: EntityId,
): { readonly duty: SpecialDuty; readonly untilTick: Tick } | null {
  const record = world.service.get(personId)
  if (record === undefined || record.dischargedAtTick !== null) return null
  const duty = record.specialDuty
  const until = record.specialDutyUntilTick
  if (duty === undefined || duty === null || until === undefined || until === null) return null
  return { duty: duty as SpecialDuty, untilTick: until }
}

/**
 * ASSIGN AND RELEASE.
 *
 * Once a month: anybody whose tour is up goes back to the unit, and a small
 * share of the eligible get taken away from theirs. The share is deliberately
 * small — special duty is a thing that happens once or twice in a career, and
 * a career where it happens constantly is a career with no unit in it.
 */
export function runSpecialDuty(world: World, tick: Tick): void {
  for (const record of [...world.service.values()].sort((a, b) => a.personId - b.personId)) {
    if (record.dischargedAtTick !== null) continue
    const person = world.people.get(record.personId)
    if (person === undefined || person.deathTick !== null) continue
    // A deployment outranks a special duty: nobody is recruiting from a war.
    const tours = world.deployments.get(record.personId) ?? []
    if (tours.some((tour) => tour.returnedAtTick === null)) continue

    const standing = specialDutyOf(world, record.personId)
    if (standing !== null) {
      if (tick >= standing.untilTick) {
        world.service.set(record.personId, {
          ...record,
          specialDuty: null,
          specialDutyUntilTick: null,
        })
        recordEvent(world, tick, {
          type: 'left-special-duty',
          subjectId: record.personId,
          detail: DUTY_TITLES[standing.duty],
        })
      }
      continue
    }

    if (record.rank < DUTY_FROM_RANK && record.commissioned !== true) continue

    const rng = openStream(world.seed, Stream.Service, record.personId, tick + 95_000)
    // About one eligible person in two hundred a month, which over a long
    // career is most senior people having done one at some point.
    if (!rng.chance(5, 1_000)) continue

    /**
     * WHICH DUTY. An officer goes to staff; an NCO goes where the service
     * needs a face — and the recruiter is weighted highest because it is the
     * one that reaches back into the town.
     */
    const duty: SpecialDuty =
      record.commissioned === true
        ? 'staff'
        : rng.pickWeighted<SpecialDuty>(['recruiter', 'drill', 'honour-guard'], [50, 30, 20])

    world.service.set(record.personId, {
      ...record,
      specialDuty: duty,
      specialDutyUntilTick: (tick + DUTY_MONTHS) as Tick,
    })
    recordEvent(world, tick, {
      type: 'took-special-duty',
      subjectId: record.personId,
      detail: DUTY_TITLES[duty],
    })
    recordDecision(world, tick, {
      subjectId: record.personId,
      decision: 'posting',
      significance: 'notable',
      inputs: [factor('needs-of-the-service', 800), factor('strong-performance', record.performance)],
      chosen: `was taken out of the unit for ${DUTY_TITLES[duty]}`,
      rejected: [],
      streamId: Stream.Service,
    })
  }
}

/**
 * THE RECRUITER WHOSE NAME GOES ON IT.
 *
 * Whoever is on recruiting duty in this world right now, or null. This is what
 * `service.ts` reads when somebody enlists: the enlistment stops being a thing
 * that happened to a townsperson and becomes a thing a PERSON did to them,
 * twenty years later, in their record.
 *
 * If more than one person is recruiting, the lowest id — stable, reproducible,
 * and it does not matter which because the point is that it is somebody.
 */
export function recruiterNow(world: World): EntityId | null {
  let found: EntityId | null = null
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (record.specialDuty !== 'recruiter') continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    if (found === null || record.personId < found) found = record.personId
  }
  return found
}

/**
 * EVERY ENLISTMENT THIS PERSON SIGNED UP, by name.
 *
 * The payoff, read back: a recruiter's own record can list the people they
 * enlisted, which is a thing no other system in the game produces.
 */
export function enlistedBy(world: World, recruiterId: EntityId): readonly EntityId[] {
  const found: EntityId[] = []
  for (const event of world.events) {
    if (event.type !== 'enlisted') continue
    if (event.otherId !== recruiterId) continue
    found.push(event.subjectId)
  }
  return found
}
