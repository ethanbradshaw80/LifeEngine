/**
 * Military service as a career. L4-M3.
 *
 * Peacetime only, and deliberately so: LAYER4_PLAN requires service to be a
 * complete, playable career — enlistment, training pay, postings, promotion,
 * discharge, reenlistment — BEFORE L4-M4 lets the wars from the news find the
 * people who signed up. Most military work is not combat (foundation §6), and
 * this milestone is all of the other kind.
 *
 * Design rules honoured here:
 *   - Enlistment is a decision. The player is asked (the fork at eighteen
 *     offers the uniform beside college and trade; recruiters call on the
 *     young and unemployed); NPCs weigh it like any other door out of town.
 *   - THE RECORD SURVIVES DISCHARGE. A service record is the artifact a
 *     descendant finds (foundation §10); nothing deletes one.
 *   - Specialties carry exposure PROFILES, not danger ratings — what a job
 *     does, never how dangerous a country is (the permanent rule).
 *   - Veterans carry their training home: specialty unlocks open civilian
 *     doors education alone would not.
 *
 * OWNERSHIP: this system is the single writer of service records. Employment
 * and finances READ them.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt } from './clock.js'
import {
  BRANCH_NAMES,
  RANKS,
  SERVICE_TERM_MONTHS,
  servicePay,
  SPECIALTIES,
  specialtyById,
} from './content.js'
import type { ServiceSpecialty } from './content.js'
import { educationRank, meetsRequirement } from './content.js'
import { isSeverelyAiling } from './health.js'
import { hasAnswered, raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { CausalFactor, Person, World } from './types.js'
import { placesOfKind } from './worldgen.js'

const ENLIST_MIN_AGE = 18
const ENLIST_MAX_AGE = 26
/** Disability at or above this ends (or bars) service on medical grounds. */
const MEDICAL_LIMIT = 400

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function isServing(world: World, personId: EntityId): boolean {
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick === null
}

export function isVeteran(world: World, personId: EntityId): boolean {
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick !== null
}

/** Monthly service pay for the household ledger. Zero when not serving. */
export function servicePayOf(world: World, personId: EntityId): number {
  const record = world.service.get(personId)
  return record !== undefined && record.dischargedAtTick === null ? record.monthlyPay : 0
}

export function rankTitle(rank: number): string {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, rank))] ?? 'recruit'
}

/** Civilian occupations a veteran's training opened. Empty for non-veterans. */
export function veteranUnlocks(world: World, personId: EntityId): readonly string[] {
  const record = world.service.get(personId)
  if (!record || record.dischargedAtTick === null) return []
  return specialtyById(record.specialtyId).civilianUnlocks
}

function eligibleSpecialties(world: World, person: Person): ServiceSpecialty[] {
  const education = world.education.get(person.id)
  const level = education?.level ?? 'none'
  return SPECIALTIES.filter((sp) => meetsRequirement(level, sp.requires))
}

function canEnlist(world: World, person: Person, tick: Tick): boolean {
  const age = ageAt(person.birthTick, tick)
  if (age < ENLIST_MIN_AGE || age > ENLIST_MAX_AGE) return false
  if (world.service.has(person.id)) return false // one career per life, for now
  if (isSeverelyAiling(world, person.id)) return false
  if ((world.health.get(person.id)?.disability ?? 0) >= MEDICAL_LIMIT) return false
  const education = world.education.get(person.id)
  if (education?.enrolledIn !== null && education !== undefined) return false
  return eligibleSpecialties(world, person).length > 0
}

// ---------------------------------------------------------------------------
// Enlistment
// ---------------------------------------------------------------------------

/** Shared by the player path and the NPC path: one door, one ledger entry. */
export function enlistPerson(
  world: World,
  tick: Tick,
  person: Person,
  specialty: ServiceSpecialty,
  extraInputs: readonly CausalFactor[],
): void {
  const bases = placesOfKind(world, 'base')
  const base = bases[Math.abs(person.id) % Math.max(1, bases.length)]
  if (!base) return

  // Enlisting ends a civilian job; the uniform is not a side line.
  if (world.employment.has(person.id)) {
    world.employment.delete(person.id)
    recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'enlisted' })
  }

  world.service.set(person.id, {
    personId: person.id,
    branch: specialty.branch,
    specialtyId: specialty.id,
    rank: 0,
    enlistedAtTick: tick,
    baseId: base.id,
    monthlyPay: servicePay(specialty, 0),
    performance: Math.floor((person.traits.diligence + 500) / 2),
    termMonthsLeft: SERVICE_TERM_MONTHS,
    dischargedAtTick: null,
    dischargeReason: null,
  })

  recordEvent(world, tick, {
    type: 'enlisted',
    subjectId: person.id,
    placeId: base.id,
    detail: specialty.title,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'enlistment',
    significance: 'defining',
    inputs: [...extraInputs, factor('steady-pay', Math.floor(specialty.basePay / 1000))],
    chosen: `enlisted in ${BRANCH_NAMES[specialty.branch]} as a ${specialty.title}`,
    rejected: ['civilian life'],
    streamId: Stream.Employment,
  })
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runService(world: World, tick: Tick): void {
  for (const person of livingSorted(world)) {
    const record = world.service.get(person.id)

    if (record && record.dischargedAtTick === null) {
      serveMonth(world, tick, person, record)
      continue
    }
    if (record) continue // a veteran; their serving days are recorded, and done

    // Civilian of enlistment age: the door exists. The player gets a
    // recruiter's knock when young, jobless and fit; NPCs weigh the same door
    // with their own feet.
    if (!canEnlist(world, person, tick)) continue

    const rng = openStream(world.seed, Stream.Employment, person.id, tick + 3333)

    if (person.id === world.player.personId) {
      if (!world.employment.has(person.id) && rng.chance(35, 1_000)) {
        raisePending(world, {
          tick,
          kind: 'enlist',
          personId: person.id,
          otherId: null,
          occupationId: null,
          workplaceId: null,
          monthlyPay: null,
          placeId: null,
          options: ['accept', 'decline'],
        })
      }
      continue
    }

    // NPC propensity: modest, and modelled — the jobless and the ambitious
    // hear the recruiter out more often; the settled mostly do not.
    // First tuning gave one enlistment in fifty years: the town hires its
    // young within a month or two, so the jobless window barely exists. The
    // door has to be audible over a paycheck, not only instead of one.
    const jobless = !world.employment.has(person.id)
    const propensity = (jobless ? 110 : 16) + Math.floor(person.traits.ambition / 25)
    if (!rng.chance(propensity, 12_000)) continue

    const options = eligibleSpecialties(world, person)
    if (options.length === 0) continue
    const education = world.education.get(person.id)
    const weights = options.map((sp) => 1 + educationRank(sp.requires) + (education && meetsRequirement(education.level, sp.requires) ? 2 : 0))
    const chosen = rng.pickWeighted(options, weights)

    enlistPerson(world, tick, person, chosen, [
      factor('reached-adulthood', 400),
      ...(jobless ? [factor('way-out-of-town', 500)] : []),
      factor('ambition', person.traits.ambition),
    ])
  }
}

function livingSorted(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((a, b) => a.id - b.id)
  return living
}

/** One month in uniform: drift, review, the term clock, the body's verdict. */
function serveMonth(world: World, tick: Tick, person: Person, record: NonNullable<ReturnType<World['service']['get']>>): void {
  const rng = openStream(world.seed, Stream.Employment, person.id, tick + 4444)

  // Medical discharge: the body rules service in a way it does not rule a desk.
  const disability = world.health.get(person.id)?.disability ?? 0
  if (disability >= MEDICAL_LIMIT) {
    discharge(world, tick, person, record, 'medical', [factor('medically-unfit', disability)])
    return
  }

  // Performance drifts toward what diligence can deliver, as at any work.
  const pull = person.traits.diligence - record.performance
  const performance = Math.max(0, Math.min(1000, record.performance + Math.floor(pull / 40) + rng.nextInt(-8, 9)))

  // Annual review on the service anniversary: promotion closes the rank
  // ladder step by step, earned by recorded performance — never by luck.
  let rank = record.rank
  const monthsIn = tick - record.enlistedAtTick
  if (monthsIn > 0 && monthsIn % TICKS_PER_YEAR === 0 && rank < RANKS.length - 1 && performance >= 480 + rank * 60) {
    rank += 1
    recordEvent(world, tick, {
      type: 'promoted',
      subjectId: person.id,
      detail: rankTitle(rank),
    })
  }

  const specialty = specialtyById(record.specialtyId)
  const termMonthsLeft = record.termMonthsLeft - 1

  world.service.set(person.id, {
    ...record,
    rank,
    performance,
    monthlyPay: servicePay(specialty, rank),
    termMonthsLeft,
  })

  if (termMonthsLeft > 0) return

  // Term's end. The player signs or leaves; an NPC's retention is a weighing
  // of the same things (rank earned, other doors), resolved by their own roll.
  if (person.id === world.player.personId) {
    raisePending(world, {
      tick,
      kind: 'reenlist',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: servicePay(specialty, rank),
      placeId: null,
      options: ['stay', 'leave'],
    })
    // The clock halts on the pending; the term is settled by the answer.
    world.service.set(person.id, { ...world.service.get(person.id)!, termMonthsLeft: 0 })
    return
  }

  const retention = 380 + rank * 90
  if (rng.chance(retention, 1_000)) {
    reenlist(world, tick, person)
  } else {
    discharge(world, tick, person, world.service.get(person.id)!, 'end of term', [factor('term-ended', 600)])
  }
}

export function reenlist(world: World, tick: Tick, person: Person): void {
  const record = world.service.get(person.id)
  if (!record || record.dischargedAtTick !== null) return
  world.service.set(person.id, { ...record, termMonthsLeft: SERVICE_TERM_MONTHS })
  recordEvent(world, tick, { type: 'reenlisted', subjectId: person.id, detail: rankTitle(record.rank) })
}

export function discharge(
  world: World,
  tick: Tick,
  person: Person,
  record: NonNullable<ReturnType<World['service']['get']>>,
  reason: string,
  inputs: readonly CausalFactor[],
): void {
  // The record is CLOSED, never deleted: this is the artifact a descendant
  // finds three generations on (foundation §10).
  world.service.set(person.id, {
    ...record,
    dischargedAtTick: tick,
    dischargeReason: reason,
    termMonthsLeft: 0,
  })
  recordEvent(world, tick, { type: 'discharged', subjectId: person.id, detail: reason })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'enlistment',
    significance: 'major',
    inputs: [...inputs],
    chosen: `left ${BRANCH_NAMES[specialtyById(record.specialtyId).branch]} after ${Math.max(1, Math.floor((tick - record.enlistedAtTick) / TICKS_PER_YEAR))} years' service`,
    rejected: ['to serve on'],
    streamId: Stream.Employment,
  })
}

/** True when the education fork at eighteen should offer the uniform. */
export function educationOffersEnlistment(world: World, person: Person, tick: Tick): boolean {
  return canEnlist(world, person, tick) && !hasAnswered(world, 'enlist')
}
