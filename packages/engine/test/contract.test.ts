/**
 * The commission fork and the contract documents (§6b/§6c, plus the owner
 * playing: "when you enlist there needs to be an option to commission as an
 * officer if you have a degree — this isn't an option right now so there is
 * no path to officer").
 *
 * He was right twice over. The degree DID commission you, silently, off a
 * field nobody was ever shown — and the recruiter only knocked for the
 * jobless, which is exactly not the graduate. So it was a path that existed
 * and could not be walked.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Money, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { contractFor } from '../src/contract.js'
import { createWorld } from '../src/index.js'
import { requestEnlistment, resolvePending, setPlayer } from '../src/player.js'
import { SPECIALTIES } from '../src/content.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function anAdult(world: World): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 22 && age <= 30
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  return person
}

/** A played adult, with or without the degree the fork turns on. */
function aWalkIn(seed: number, degree: boolean): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seed), 100)
  const person = anAdult(world)
  setPlayer(world, person.id)
  world.employment.delete(person.id)
  world.education.set(person.id, {
    personId: person.id,
    level: degree ? 'college' : 'secondary',
    enrolledIn: null,
    enrolledUntilTick: null,
  })
  return { world, personId: person.id }
}

describe('the commission fork', () => {
  it('is asked of a graduate, and not of somebody without a degree', () => {
    const graduate = aWalkIn(4141, true)
    expect(requestEnlistment(graduate.world).asked).toBe(true)
    expect(graduate.world.player.pending?.kind).toBe('commission')

    const other = aWalkIn(4141, false)
    expect(requestEnlistment(other.world).asked).toBe(true)
    // No degree, no question — the officer ladder is closed at entry and a
    // menu with one item on it is not a choice.
    expect(other.world.player.pending?.kind).toBe('specialty')
  })

  it('is a real fork: the same graduate ends up on either ladder', () => {
    const walkIn = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!walkIn) throw new Error('no walk-in specialty')

    for (const path of ['officer', 'enlisted'] as const) {
      const { world, personId } = aWalkIn(4141, true)
      requestEnlistment(world)
      resolvePending(world, path)
      expect(world.player.pending?.kind).toBe('specialty')
      resolvePending(world, walkIn.id)

      const record = world.service.get(personId)
      expect(record).toBeDefined()
      expect(record?.commissioned === true).toBe(path === 'officer')
    }
  })

  it('says which ladder it was on the record, and in the training that follows', () => {
    const walkIn = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!walkIn) throw new Error('no walk-in specialty')
    const { world, personId } = aWalkIn(4141, true)
    requestEnlistment(world)
    resolvePending(world, 'officer')
    resolvePending(world, walkIn.id)

    // Law 3: the record explains it, in the words that are true of it.
    const decision = world.causalRecords.find(
      (r) => r.subjectId === personId && r.decision === 'enlistment',
    )
    expect(decision?.chosen).toContain('commissioned into')
    expect(decision?.inputs.some((i) => i.factor === 'holds-a-degree')).toBe(true)
    // And an officer does not go to basic.
    const training = world.events.find(
      (e) => e.subjectId === personId && e.type === 'began-training',
    )
    expect(training?.detail).toBe('the commissioning course')
  })

  it('hands the contract over as the last step of signing', () => {
    const walkIn = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!walkIn) throw new Error('no walk-in specialty')
    const { world } = aWalkIn(4141, false)
    requestEnlistment(world)
    resolvePending(world, walkIn.id)

    const pending = world.player.pending
    expect(pending?.kind).toBe('service-contract')
    expect(pending?.options).toEqual(['take-the-oath'])
  })
})

describe('the contract document', () => {
  const walkIn = SPECIALTIES.find((sp) => sp.requires === 'none')
  if (!walkIn) throw new Error('no walk-in specialty')

  function aSignedGraduate(): { world: World; personId: EntityId } {
    const { world, personId } = aWalkIn(4141, true)
    requestEnlistment(world)
    resolvePending(world, 'officer')
    resolvePending(world, walkIn.id)
    return { world, personId }
  }

  const noTerms = { termYears: 4, option: 'none', bonus: 0 as Money }

  it('reads every field off the record, and prints the officer grade', () => {
    const { world, personId } = aSignedGraduate()
    const contract = contractFor(world, world.tick, personId, 'enlistment', noTerms)
    if (!contract) throw new Error('a serving member has a contract')

    const person = world.people.get(personId)
    const record = world.service.get(personId)
    expect(contract.name).toContain(person!.familyName.toUpperCase())
    // The trade under the OFFICER's name for it: nobody is commissioned as
    // a rifleman.
    expect(contract.specialty).toBe(walkIn.officerTitle)
    expect(contract.specialty).not.toBe(walkIn.title)
    expect(contract.station).toBe(world.places.get(record!.baseId)?.name)
    // O-grades, not E-grades: the commission is on the paper.
    expect(contract.grade).toContain('(O-1)')
    // An officer's own form, and an officer's own words on it.
    expect(contract.form).toBe('FORM RA-2')
    expect(contract.commissioned).toBe(true)
    expect(contract.title).toBe('OFFICER APPOINTMENT')
    expect(contract.undertaking).toContain('appointment')
    expect(contract.oathHeading).toBe('Oath of Office')
    expect(contract.signatureLabel).toBe("Officer's signature")
    expect(contract.headline).toContain('COMMISSIONED')
    // The oath swears to the PRESET'S country, never a name typed into prose.
    expect(contract.oath).toContain(world.spec.homelandName)
    expect(contract.oath).toContain(person!.givenName)
  })

  it('hides the lines it has nothing to say on, and prints the ones it does', () => {
    const { world, personId } = aSignedGraduate()
    const bare = contractFor(world, world.tick, personId, 'reenlistment', noTerms)
    expect(bare?.option).toBeNull()
    expect(bare?.bonus).toBe(0)

    const paid = contractFor(world, world.tick, personId, 'reenlistment', {
      termYears: 6,
      option: 'bonus',
      bonus: 480_000 as Money,
    })
    expect(paid?.option).not.toBeNull()
    expect(paid?.bonus).toBe(480_000)
    expect(paid?.termText).toBe('six (6) years')
    expect(paid?.form).toBe('FORM RA-2') // this member is commissioned
    expect(paid?.stamp).toBe('6-YEAR')

    // A school costs the service a promise rather than money — the option
    // line prints, the bonus line does not.
    const school = contractFor(world, world.tick, personId, 'reenlistment', {
      termYears: 3,
      option: 'school',
      bonus: 0 as Money,
    })
    expect(school?.option).toContain('seat')
    expect(school?.bonus).toBe(0)
  })

  it('runs from this month to the end of the term, in months', () => {
    const { world, personId } = aSignedGraduate()
    const four = contractFor(world, world.tick, personId, 'enlistment', noTerms)
    const six = contractFor(world, world.tick, personId, 'enlistment', {
      termYears: 6,
      option: 'none',
      bonus: 0 as Money,
    })
    expect(four?.from).toBe(six?.from)
    // A day would be a precision this world does not have: months only.
    expect(four?.to).not.toBe(six?.to)
    expect(four?.to).toMatch(/^[A-Z]+ \d{4}$/)
  })

  it('is the same paper on a replay, and different paper on another month', () => {
    const { world, personId } = aSignedGraduate()
    const once = contractFor(world, world.tick, personId, 'enlistment', noTerms)
    const twice = contractFor(world, world.tick, personId, 'enlistment', noTerms)
    expect(twice).toEqual(once)

    const later = contractFor(world, (world.tick + 7) as Tick, personId, 'enlistment', noTerms)
    expect(later?.contractNo).not.toBe(once?.contractNo)
  })

  it('keeps the enlisted forms and the enlisted words for enlisted members', () => {
    const { world, personId } = aWalkIn(4141, false)
    requestEnlistment(world)
    resolvePending(world, walkIn.id)

    const first = contractFor(world, world.tick, personId, 'enlistment', noTerms)
    expect(first?.commissioned).toBe(false)
    expect(first?.form).toBe('FORM RA-1')
    expect(first?.title).toBe('ENLISTMENT CONTRACT')
    expect(first?.undertaking).toBe('I enlist in')
    expect(first?.oathHeading).toBe('Oath of Enlistment')
    expect(first?.signatureLabel).toBe("Recruit's signature")
    expect(first?.specialty).toBe(walkIn.title)
    expect(first?.grade).toContain('(E-1)')

    const again = contractFor(world, world.tick, personId, 'reenlistment', noTerms)
    expect(again?.form).toBe('FORM RA-4')
    expect(again?.undertaking).toBe('I reenlist in')
    expect(again?.oathHeading).toBe('Oath of Reenlistment')
  })

  it('has nothing to write for somebody not serving', () => {
    const world = createWorld(makeSeed(4141), 100)
    const civilian = anAdult(world)
    expect(contractFor(world, world.tick, civilian.id, 'enlistment', noTerms)).toBeUndefined()
  })
})
