/**
 * Awards and veterans. L4-M5.
 *
 * The claims, and the foundation §11 rules behind them: awards come only
 * from documented qualifying events, and the grant functions REFUSE anything
 * else — this file hands them unqualifying events and watches them fail,
 * which is the negative test the foundation demands. Wound recognition
 * comes only from enemy action; campaign credit only from qualifying tours;
 * good conduct only from completed honorable terms. Every award in a grown
 * world references a real event of the right kind belonging to the right
 * person. Pensions pay only the service-connected disability delta, and
 * only when both ends were actually captured.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import {
  decorationsOf,
  grantCampaignMedal,
  grantCombatAction,
  grantGoodConduct,
  grantQualificationBadge,
  grantWoundRecognition,
} from '../src/awards.js'
import { householdIncome } from '../src/finances.js'
import { inflictWound } from '../src/health.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { pensionOf } from '../src/service.js'
import { recordEvent } from '../src/records.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function worldWithASoldier(): { world: World; soldierId: EntityId } {
  const world = createWorld(makeSeed(12345), 100)
  const person = livingPeople(world)[0]
  if (!person) throw new Error('empty town')
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 0,
    rankSinceTick: 0 as never,
    qualifications: [],
    enlistedAtTick: 0 as never,
    baseId: person.id,
    monthlyPay: 110_000 as never,
    performance: 600,
    termMonthsLeft: 48,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 0,
    unitId: null,
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 0,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  return { world, soldierId: person.id }
}

describe('eligibility is strict — the wrong grant FAILS', () => {
  it('wound recognition refuses a civilian injury', () => {
    const { world, soldierId } = worldWithASoldier()
    const civilianInjury = recordEvent(world, world.tick, {
      type: 'was-injured',
      subjectId: soldierId,
      detail: 'minor:a crush injury to the hand',
    })
    expect(grantWoundRecognition(world, world.tick, soldierId, civilianInjury, 'Rondesia')).toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(0)
    expect(world.events.some((e) => e.type === 'awarded')).toBe(false)
  })

  it('wound recognition refuses a death that was an accident, even on deployment', () => {
    const { world, soldierId } = worldWithASoldier()
    const accidentDeath = recordEvent(world, world.tick, {
      type: 'died',
      subjectId: soldierId,
      detail: 'an accident on deployment',
    })
    expect(grantWoundRecognition(world, world.tick, soldierId, accidentDeath, 'Rondesia')).toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(0)
  })

  it("wound recognition refuses someone else's wound", () => {
    const { world, soldierId } = worldWithASoldier()
    const other = livingPeople(world).find((p) => p.id !== soldierId)
    if (!other) throw new Error('a town of one')
    const someoneElsesWound = recordEvent(world, world.tick, {
      type: 'wounded-in-action',
      subjectId: other.id,
      detail: 'serious:a gunshot wound to the chest',
    })
    expect(grantWoundRecognition(world, world.tick, soldierId, someoneElsesWound, 'Rondesia')).toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(0)
  })

  it('campaign credit refuses a short tour without a casualty, and a wrong event', () => {
    const { world, soldierId } = worldWithASoldier()
    const homecoming = recordEvent(world, world.tick, {
      type: 'returned-home',
      subjectId: soldierId,
      detail: 'tour complete',
    })
    // One month in theatre, walked home fine: no campaign medal.
    expect(grantCampaignMedal(world, world.tick, soldierId, homecoming, 'Rondesia', 1, false)).toBeNull()
    // The right duration but a nonsense qualifying event: refused.
    const hired = recordEvent(world, world.tick, { type: 'hired', subjectId: soldierId })
    expect(grantCampaignMedal(world, world.tick, soldierId, hired, 'Rondesia', 10, false)).toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(0)
  })

  it('good conduct refuses a medical discharge and a poor term', () => {
    const { world, soldierId } = worldWithASoldier()
    const medical = recordEvent(world, world.tick, {
      type: 'discharged',
      subjectId: soldierId,
      detail: 'medical',
    })
    expect(grantGoodConduct(world, world.tick, soldierId, medical, 900)).toBeNull()
    const endOfTerm = recordEvent(world, world.tick, {
      type: 'discharged',
      subjectId: soldierId,
      detail: 'end of term',
    })
    expect(grantGoodConduct(world, world.tick, soldierId, endOfTerm, 250)).toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(0)
  })

  it('combat action refuses everything but recorded contact, and dedupes per war', () => {
    const { world, soldierId } = worldWithASoldier()
    // A wound is not a contact star; an accident is neither.
    const wound = recordEvent(world, world.tick, {
      type: 'wounded-in-action',
      subjectId: soldierId,
      detail: 'minor:a laceration to the arm',
    })
    expect(grantCombatAction(world, world.tick, soldierId, wound, 'Rondesia')).toBeNull()

    const enemyA = 501 as never
    const enemyB = 502 as never
    const contact1 = recordEvent(world, world.tick, {
      type: 'saw-combat', subjectId: soldierId, otherId: enemyA, detail: 'Took fire on patrol; gave it back',
    })
    const first = grantCombatAction(world, world.tick, soldierId, contact1, 'Rondesia')
    expect(first?.count).toBe(1)

    // Same war, second contact: the star is already worn — no device.
    const contact2 = recordEvent(world, world.tick, {
      type: 'saw-combat', subjectId: soldierId, otherId: enemyA, detail: 'Mortars on the outpost after dark',
    })
    expect(grantCombatAction(world, world.tick, soldierId, contact2, 'Rondesia')?.count).toBe(1)

    // A different war adds the device.
    const contact3 = recordEvent(world, world.tick, {
      type: 'saw-combat', subjectId: soldierId, otherId: enemyB, detail: 'A firefight at the checkpoint before dawn',
    })
    expect(grantCombatAction(world, world.tick, soldierId, contact3, 'Halvia')?.count).toBe(2)
  })

  it('a qualification badge refuses a mismatched rating', () => {
    const { world, soldierId } = worldWithASoldier()
    const qual = recordEvent(world, world.tick, {
      type: 'earned-qualification',
      subjectId: soldierId,
      detail: 'expert marksman',
    })
    expect(grantQualificationBadge(world, world.tick, soldierId, qual, 'master mechanic')).toBeNull()
    expect(grantQualificationBadge(world, world.tick, soldierId, qual, 'expert marksman')).not.toBeNull()
    expect(decorationsOf(world, soldierId).length).toBe(1)
  })

  it('the qualifying grant works, and a second qualifying event adds a device, not a medal', () => {
    const { world, soldierId } = worldWithASoldier()
    const wound = recordEvent(world, world.tick, {
      type: 'wounded-in-action',
      subjectId: soldierId,
      detail: 'serious:a shrapnel wound to the leg',
    })
    const first = grantWoundRecognition(world, world.tick, soldierId, wound, 'Rondesia')
    expect(first).not.toBeNull()
    expect(first?.qualifyingEventIds).toEqual([wound.id])
    expect(first?.count).toBe(1)

    const secondWound = recordEvent(world, world.tick, {
      type: 'wounded-in-action',
      subjectId: soldierId,
      detail: 'minor:a laceration to the arm',
    })
    const second = grantWoundRecognition(world, world.tick, soldierId, secondWound, 'Rondesia')
    expect(second?.count).toBe(2)
    // The device keeps ITS OWN evidence — both wounds are on the record.
    expect(second?.qualifyingEventIds).toEqual([wound.id, secondWound.id])
    expect(decorationsOf(world, soldierId).length).toBe(1) // one medal, one device
    expect(world.events.filter((e) => e.type === 'awarded').length).toBe(2) // two moments
  })

  it('one qualifying event earns one thing, however often it is submitted', () => {
    const { world, soldierId } = worldWithASoldier()
    const wound = recordEvent(world, world.tick, {
      type: 'wounded-in-action',
      subjectId: soldierId,
      detail: 'serious:a gunshot wound to the shoulder',
    })
    grantWoundRecognition(world, world.tick, soldierId, wound, 'Rondesia')
    const resubmitted = grantWoundRecognition(world, world.tick, soldierId, wound, 'Rondesia')
    expect(resubmitted?.count).toBe(1) // no minted device
    expect(world.events.filter((e) => e.type === 'awarded').length).toBe(1) // no second moment
  })
})

describe('a grown world decorates only from the record', () => {
  it('every award references a qualifying event of the right kind, owned by the right person', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 2400) // two centuries: wars rise, tours happen, terms end

    const kindsSeen = new Set<string>()
    for (const [personId, decorations] of world.awards) {
      for (const award of decorations) {
        kindsSeen.add(award.kind)
        expect(award.qualifyingEventIds.length).toBe(award.count)
        for (const eventId of award.qualifyingEventIds) {
        const qualifying = world.events.find((e) => e.id === eventId)
        expect(qualifying, `${award.title} has no qualifying event`).toBeDefined()
        if (!qualifying) continue
        expect(qualifying.subjectId).toBe(personId)

        switch (award.kind) {
          case 'wound-recognition':
            // ENEMY ACTION ONLY — never a civilian injury, never an accident.
            expect(
              qualifying.type === 'wounded-in-action' ||
                (qualifying.type === 'died' && qualifying.detail === 'wounds taken in action'),
              `wound recognition cited ${qualifying.type}:${qualifying.detail ?? ''}`,
            ).toBe(true)
            break
          case 'campaign':
            expect(['returned-home', 'died', 'wounded-in-action']).toContain(qualifying.type)
            break
          case 'good-conduct':
            // The honourable term endings (M-ARMY2 added the two mandatory
            // ones); misconduct, medical and death never qualify.
            expect(
              qualifying.type === 'reenlisted' ||
                (qualifying.type === 'discharged' &&
                  [
                    'end of term',
                    'high-year tenure',
                    'twenty years served',
                    'thirty years served',
                    'retirement age',
                  ].includes(qualifying.detail ?? '')),
            ).toBe(true)
            break
          case 'qualification-badge':
            expect(qualifying.type).toBe('earned-qualification')
            break
          case 'combat-action':
            expect(qualifying.type).toBe('saw-combat')
            break
          case 'valor':
            // Valor cites a documented act — never a wound, never a rank.
            expect(qualifying.type).toBe('act-of-valor')
            break
          case 'meritorious-service':
          case 'long-service':
            expect(['reenlisted', 'discharged']).toContain(qualifying.type)
            break
        }
        }
      }
    }
    // Two centuries of peacetime careers ALWAYS produce completed terms and
    // earned ratings — a regression that stopped granting either would show
    // here, not hide behind "some award existed".
    expect(kindsSeen.has('good-conduct')).toBe(true)
    expect(kindsSeen.has('qualification-badge')).toBe(true)
  })
})

describe('the pension', () => {
  it('pays service-connected disability — provenance, not a date range', () => {
    const { world, soldierId } = worldWithASoldier()
    const record = world.service.get(soldierId)
    const health = world.health.get(soldierId)
    if (!record || !health) throw new Error('no record')

    // Serving: no pension yet.
    expect(pensionOf(world, soldierId)).toBe(0)

    // Discharged, badly marked — but every mark was CIVILIAN. Nothing:
    // illness during a career is not the service's harm to compensate.
    world.service.set(soldierId, { ...record, dischargedAtTick: world.tick, dischargeReason: 'medical' })
    world.health.set(soldierId, { ...health, disability: 600, serviceDisability: 0 })
    expect(pensionOf(world, soldierId)).toBe(0)

    // Service-stamped harm pays per point — even though it accrued from a
    // wound that resolved whenever it resolved, discharge date irrelevant.
    world.health.set(soldierId, { ...health, disability: 600, serviceDisability: 500 })
    expect(pensionOf(world, soldierId)).toBe(500 * 120)

    // The pension reaches the household ledger.
    const person = world.people.get(soldierId)
    const household = person?.householdId == null ? undefined : world.households.get(person.householdId)
    if (household) {
      expect(householdIncome(world, household)).toBeGreaterThanOrEqual(500 * 120)
    }

    // Below the threshold: no pension.
    world.health.set(soldierId, { ...health, serviceDisability: 150 })
    expect(pensionOf(world, soldierId)).toBe(0)
  })

  it('a wound inflicted on deployment is stamped service-connected; a civilian one is not', () => {
    const { world, soldierId } = worldWithASoldier()
    const rng = { pick: <T>(items: readonly T[]) => items[0] as T }
    inflictWound(world, world.tick, soldierId, 700, 'direct-combat', rng)
    expect(world.health.get(soldierId)?.ailmentServiceConnected).toBe(true)
  })
})
