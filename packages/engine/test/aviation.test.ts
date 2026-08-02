/**
 * Aviation and the Air Medal (ADR-0026) — the pack's second HOLD item.
 *
 * The claims: the aviation trades exist and are reachable; a mission flown
 * under fire is a recorded event; the Air Medal grants off that event and
 * only that event; it repeats, because the real one does; and no aircrew
 * award exists that nothing can earn.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { AIR_MEDAL, decorationsOf, grantAirMedal } from '../src/awards.js'
import { recordEvent } from '../src/records.js'
import { OCCUPATIONS, SPECIAL_UNITS, SPECIALTIES, SERVICE_SCHOOLS } from '../src/content.js'
import { timelineFor } from '../src/story.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'
import type { EntityId } from '@life-engine/shared'

function anAirman(world: World, specialtyId: string): EntityId {
  const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody')
  world.service.set(person.id, {
    personId: person.id,
    branch: 'air-guard',
    specialtyId,
    rank: 3,
    rankSinceTick: world.tick,
    qualifications: [],
    enlistedAtTick: world.tick,
    baseId: person.id,
    monthlyPay: 139_000 as never,
    performance: 700,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 4_200,
    unitId: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  return person.id
}

describe('aviation', () => {
  it('the trades, the school and the squadron all exist and connect', () => {
    const aviator = SPECIALTIES.find((s) => s.id === 'aviator')
    const aircrew = SPECIALTIES.find((s) => s.id === 'aircrew')
    expect(aviator?.branch).toBe('air-guard')
    expect(aircrew?.branch).toBe('air-guard')
    // The machine is the hazard: accidents outweigh firefights for both, and
    // an aircraft is never in a convoy.
    expect(aviator?.exposure.accident).toBeGreaterThan(aviator?.exposure.directCombat ?? 0)
    expect(aviator?.exposure.convoy).toBe(0)

    // Wings are earnable — the trade's own qualification, then the school.
    expect(aviator?.qualification).toBe('aviator wings')
    expect(aircrew?.qualification).toBe('aircrew wings')
    const school = SERVICE_SCHOOLS.find((s) => s.id === 'flight-school')
    expect(school?.badge).toBe('senior aviator')

    // NO DEAD UNLOCKS. A trade that promises a civilian career the town
    // does not have is a promise the veteran can never collect on — the
    // first draft of this pointed 'aviator' at a 'pilot' job that does not
    // exist in OCCUPATIONS, and nothing caught it.
    for (const specialty of SPECIALTIES) {
      for (const unlock of specialty.civilianUnlocks) {
        expect(OCCUPATIONS.some((o) => o.id === unlock), `${specialty.id} unlocks '${unlock}'`).toBe(true)
      }
    }

    // And the squadron the badge opens. Fictional name, permanently.
    const squadron = SPECIAL_UNITS.find((u) => u.id === 'nighthawks')
    expect(squadron?.requiredBadges).toContain('senior aviator')
    expect(squadron?.feederUnitId).toBe('guardian-flight')
  })

  it('the Air Medal grants off a mission, repeats, and refuses anything else', () => {
    const world = createWorld(makeSeed(8100), 40)
    const personId = anAirman(world, 'aviator')

    const mission = recordEvent(world, world.tick, {
      type: 'aerial-mission',
      subjectId: personId,
      detail: 'flew the aircraft',
    })
    expect(grantAirMedal(world, world.tick, personId, mission, 'Rusalka')).not.toBe(null)
    const first = decorationsOf(world, personId).find((a) => a.title === AIR_MEDAL)
    expect(first?.count).toBe(1)

    // Again, because the real one is awarded again — the clusters are the
    // usual case for aircrew, not the exception.
    const second = recordEvent(world, world.tick, {
      type: 'aerial-mission',
      subjectId: personId,
      detail: 'flew the aircraft',
    })
    grantAirMedal(world, world.tick, personId, second, 'Rusalka')
    expect(decorationsOf(world, personId).find((a) => a.title === AIR_MEDAL)?.count).toBe(2)

    // And it is not a medal anything else can mint.
    const notAMission = recordEvent(world, world.tick, {
      type: 'saw-combat',
      subjectId: personId,
      detail: 'a firefight',
    })
    expect(grantAirMedal(world, world.tick, personId, notAMission, 'Rusalka')).toBe(null)
    // Nor one somebody else's mission can hand over.
    const other = livingPeople(world).sort((a, b) => a.id - b.id)[1]
    if (other) expect(grantAirMedal(world, world.tick, other.id, mission, 'Rusalka')).toBe(null)
  })

  it('a flown mission is legible in the life story', () => {
    const world = createWorld(makeSeed(8101), 40)
    const personId = anAirman(world, 'aircrew')
    recordEvent(world, world.tick, {
      type: 'aerial-mission',
      subjectId: personId,
      detail: 'crewed the aircraft',
    })
    expect(timelineFor(world, personId).some((entry) => entry.text.includes('Flew a mission'))).toBe(true)
  })
})
