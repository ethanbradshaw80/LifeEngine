/**
 * The separation documents (owner's spec).
 *
 * THE CLAIM: the sheet is a summary of a career, not a composition. Every
 * block is read from the record, the character of service follows how the
 * career actually ended, and the two judgements on the paper — character
 * and reentry code — never contradict each other.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { requestEnlistment, resolvePending, setPlayer } from '../src/player.js'
import {
  retirementCertificateFor,
  separationFor,
  separationTermsFor,
} from '../src/separation.js'
import { SPECIALTIES } from '../src/content.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function anAdult(world: World): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 20 && age <= 26
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  return person
}

/** A player who enlisted, ready to be separated for whatever reason. */
function aServingPlayer(seed = 4141): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seed), 100)
  const person = anAdult(world)
  setPlayer(world, person.id)
  world.employment.delete(person.id)
  world.education.set(person.id, {
    personId: person.id,
    level: 'secondary',
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: 600,
  })
  const walkIn = SPECIALTIES.find((sp) => sp.requires === 'none')
  if (!walkIn) throw new Error('no walk-in specialty')
  requestEnlistment(world)
  resolvePending(world, walkIn.id)
  resolvePending(world, 'take-the-oath')
  return { world, personId: person.id }
}

/** Close the record by hand, for a stated reason and length of service. */
function separate(world: World, personId: EntityId, reason: string, years: number): void {
  const record = world.service.get(personId)
  if (!record) throw new Error('not serving')
  world.service.set(personId, {
    ...record,
    dischargedAtTick: (record.enlistedAtTick + years * 12) as Tick,
    dischargeReason: reason,
    termMonthsLeft: 0,
  })
}

describe('character of service and the reentry code', () => {
  it('never contradict each other, on any reason the engine writes', () => {
    // The two judgements on the sheet are read together by employers and by
    // the recruiting office. A file that reads HONORABLE and bars the door,
    // or the reverse, is a document arguing with itself.
    const reasons = [
      'end of term',
      'completed the term',
      'medical',
      'high-year tenure',
      'misconduct',
      'twenty years served',
      'thirty years served',
      'retirement age',
      'died in service',
    ]
    for (const reason of reasons) {
      const terms = separationTermsFor(reason, 6)
      expect(terms.authority.length, `${reason} has no authority line`).toBeGreaterThan(0)
      if (terms.character === 'UNDER OTHER THAN HONORABLE') {
        expect(terms.reentry, `${reason} bars nothing`).toContain('RE-4')
      }
      if (terms.reentry.startsWith('RE-1')) {
        expect(terms.character, `${reason} opens the door on a bad file`).toBe('HONORABLE')
      }
    }
  })

  it('puts misconduct out under other than honorable, and a term served honorably', () => {
    expect(separationTermsFor('misconduct', 6).character).toBe('UNDER OTHER THAN HONORABLE')
    expect(separationTermsFor('misconduct', 6).reentry).toContain('RE-4')
    expect(separationTermsFor('end of term', 6).character).toBe('HONORABLE')
    expect(separationTermsFor('end of term', 6).reentry).toContain('RE-1')
    // Medical is not a failing, and the paper must not read like one.
    expect(separationTermsFor('medical', 3).character).toBe('HONORABLE')
    // Nor is high-year tenure: the service simply had no billet at grade.
    expect(separationTermsFor('high-year tenure', 12).character).toBe('HONORABLE')
  })
})

describe('the DD-214', () => {
  it('is undefined while they serve, and written once the record closes', () => {
    const { world, personId } = aServingPlayer()
    expect(separationFor(world, personId)).toBeUndefined()

    separate(world, personId, 'end of term', 4)
    const sheet = separationFor(world, personId)
    if (!sheet) throw new Error('a closed record has a sheet')
    expect(sheet.totalService).toBe('4 years')
    expect(sheet.character).toBe('HONORABLE')
    expect(sheet.reentryCode).toContain('RE-1')
    expect(sheet.retirementEligible).toBe(false)
  })

  it('reads the awards, the schools and the tours off the record', () => {
    // A real career rather than a hand-built one: serve it, then read it.
    const { world, personId } = aServingPlayer()
    let guard = 0
    while (guard < 12 * 12) {
      if (world.player.pending !== null) {
        const options = world.player.pending.options
        // Never 'leave' — this career is meant to run.
        const stay = options.find((o) => o !== 'separate' && o !== 'leave') ?? options[0]
        resolvePending(world, stay ?? 'accept')
        continue
      }
      advanceTick(world)
      guard++
    }
    const record = world.service.get(personId)
    if (!record || record.dischargedAtTick !== null) return // separated on its own; fine

    separate(world, personId, 'end of term', 12)
    const sheet = separationFor(world, personId)
    if (!sheet) throw new Error('no sheet')

    // Twelve years in uniform leaves SOMETHING on the sheet — a career that
    // renders as three empty blocks would mean the record is not being read.
    expect(sheet.awards.length + sheet.schools.length).toBeGreaterThan(0)
    // Everything listed is a real title, not an id or a blank.
    for (const line of [...sheet.awards, ...sheet.schools, ...sheet.tours]) {
      expect(line.trim().length).toBeGreaterThan(0)
      expect(line).not.toContain('undefined')
    }
    expect(sheet.grade).toContain('E-')
    expect(sheet.name).toContain(world.people.get(personId)!.familyName.toUpperCase())
  })

  it('is the same sheet on a replay', () => {
    const { world, personId } = aServingPlayer()
    separate(world, personId, 'end of term', 4)
    expect(separationFor(world, personId)).toEqual(separationFor(world, personId))
  })
})

describe('the retirement certificate', () => {
  it('is issued at twenty years and not before', () => {
    const { world, personId } = aServingPlayer()

    separate(world, personId, 'end of term', 19)
    expect(separationFor(world, personId)?.retirementEligible).toBe(false)
    expect(retirementCertificateFor(world, personId)).toBeUndefined()

    separate(world, personId, 'twenty years served', 20)
    expect(separationFor(world, personId)?.retirementEligible).toBe(true)
    const certificate = retirementCertificateFor(world, personId)
    if (!certificate) throw new Error('twenty years earns a certificate')
    // Spelled, because a certificate does not print a numeral.
    expect(certificate.years).toBe('twenty years')
    expect(certificate.name).toContain(world.people.get(personId)!.familyName)
    expect(certificate.date).toMatch(/^the [a-z]+ of [A-Z][a-z]+, \d{4}$/)
  })

  it('spells the longer careers too', () => {
    const { world, personId } = aServingPlayer()
    separate(world, personId, 'thirty years served', 32)
    expect(retirementCertificateFor(world, personId)?.years).toBe('thirty-two years')
  })
})

describe('out-processing', () => {
  it('hands the player the sheet the month the uniform comes off', () => {
    const { world, personId } = aServingPlayer()
    // Run the term down to its last month; the discharge follows.
    const record = world.service.get(personId)!
    world.service.set(personId, { ...record, termMonthsLeft: 1, performance: 200 })

    let guard = 0
    while (world.player.pending?.kind !== 'separation' && guard < 60) {
      if (world.player.pending !== null) {
        const options = world.player.pending.options
        // Take the door out when offered — this test is about leaving.
        const leave = options.find((o) => o === 'separate' || o === 'leave') ?? options[0]
        resolvePending(world, leave ?? 'separate')
        continue
      }
      advanceTick(world)
      guard++
    }

    expect(world.player.pending?.kind, 'no separation sheet was ever raised').toBe('separation')
    expect(world.player.pending?.options).toEqual(['acknowledge'])
    expect(separationFor(world, personId)).toBeDefined()

    // And acknowledging it does not chain a certificate on a short career.
    resolvePending(world, 'acknowledge')
    expect(world.player.pending?.kind).not.toBe('retirement-certificate')
  })

  it('does not ask the dead to out-process', () => {
    const { world, personId } = aServingPlayer()
    const person = world.people.get(personId)!
    world.people.set(personId, {
      ...person,
      deathTick: world.tick,
      causeOfDeath: 'wounds taken in action',
    })
    const record = world.service.get(personId)!
    world.service.set(personId, { ...record, termMonthsLeft: 1 })

    advanceTicks(world, 2)
    // A person killed in service is not out-processing. Their record still
    // closes and still holds everything the sheet would have said.
    expect(world.player.pending?.kind).not.toBe('separation')
  })
})
