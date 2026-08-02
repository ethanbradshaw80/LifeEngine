/**
 * The awards pack (owner spec, 2026-08-02) and the one rule it is built on:
 * NO BADGE OR RIBBON EXISTS THAT CANNOT BE EARNED.
 *
 * That rule is what makes real decoration names safe to use (ADR-0024). A
 * rack is a record of what happened, not a costume, and the way it stays
 * that way is that every award grants from a qualifying recorded event and
 * refuses everything else.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  ACHIEVEMENT_TITLE,
  COMBAT_ACTION_BADGE,
  COMBAT_INFANTRY_BADGE,
  COMBAT_MEDICAL_BADGE,
  COMBAT_MERIT_TITLE,
  COMMENDATION_TITLE,
  EXPEDITIONARY_MEDAL,
  GOOD_CONDUCT_TITLE,
  LONG_SERVICE_TITLE,
  MERITORIOUS_TITLE,
  NATIONAL_DEFENSE_TITLE,
  NCO_DEVELOPMENT_TITLE,
  OVERSEAS_TITLE,
  SERVICE_RIBBON_TITLE,
  VALOR_TITLE_HEAVY,
  VALOR_TITLE_LIGHT,
  VALOR_TITLE_OVERRUN,
  WOUND_RECOGNITION_TITLE,
  grantAchievement,
  grantCombatAction,
  grantCombatMerit,
  grantCommendation,
  grantNationalDefense,
  grantNcoDevelopment,
  grantOverseas,
  grantServiceRibbon,
} from '../src/awards.js'
import { HEARTLAND_SPEC } from '../src/heartland.js'
import { recordEvent } from '../src/records.js'
import type { AwardKind, World } from '../src/types.js'

/** Every kind the engine can hold, and the title it wears. */
const EVERY_KIND: readonly AwardKind[] = [
  'wound-recognition',
  'combat-action',
  'valor',
  'meritorious-service',
  'long-service',
  'campaign',
  'good-conduct',
  'qualification-badge',
  'combat-merit',
  'commendation',
  'achievement',
  'national-defense',
  'overseas',
  'nco-development',
  'service-ribbon',
  'pow',
]

function aSoldier(world: World, performance = 800): number {
  const person = [...world.people.values()]
    .filter((p) => p.deathTick === null)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody')
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    rank: 4,
    rankSinceTick: world.tick as never,
    qualifications: [],
    enlistedAtTick: (world.tick - 40) as never,
    baseId: person.id,
    monthlyPay: 150_000 as never,
    performance,
    termMonthsLeft: 8,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: performance * 40,
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

describe('the names are real', () => {
  it('carries the real decorations, by owner override (ADR-0024)', () => {
    // Reverted twice in this repo before. They are here by decision, and
    // this test is a second place that says so.
    expect(WOUND_RECOGNITION_TITLE).toBe('the Purple Heart')
    expect(GOOD_CONDUCT_TITLE).toBe('the Good Conduct Medal')
    expect(MERITORIOUS_TITLE).toBe('the Meritorious Service Medal')
    // The owner swapped this one deliberately: the Medal of Honor is also a
    // video-game trademark, and the DSC is the real award just below it.
    expect(VALOR_TITLE_OVERRUN).toBe('the Distinguished Service Cross')
    expect(VALOR_TITLE_HEAVY).toBe('the Silver Star')
    expect(VALOR_TITLE_LIGHT).toContain('Bronze Star')
    expect(COMBAT_INFANTRY_BADGE).toBe('the Combat Infantryman Badge')
  })

  it('keeps the campaign medal GENERIC — never named for a war it invented', () => {
    // The owner's own exception, and it independently fixes the bug the last
    // military review caught: `the ${enemy} Campaign Medal` was minting the
    // verbatim name of a real decoration onto a permanent record.
    expect(EXPEDITIONARY_MEDAL).toBe('the Armed Forces Expeditionary Medal')
    for (const name of ['Russia', 'China', 'Afghanistan', 'Iran']) {
      expect(EXPEDITIONARY_MEDAL).not.toContain(name)
    }
  })
})

describe('no award exists that cannot be earned', () => {
  it('every kind the engine can hold is granted from somewhere', async () => {
    // The pack's rule, enforced against the SOURCE: a kind with no grant
    // behind it is an unearnable award, which is the one thing the pack
    // forbids. HOLD items are absent from the union entirely for the same
    // reason (ADR-0024 §4).
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const awards = await fs.readFile(path.join(here, '..', 'src', 'awards.ts'), 'utf8')

    for (const kind of EVERY_KIND) {
      expect(awards, `nothing grants '${kind}'`).toContain(`kind: '${kind}'`)
    }
    // 'pow' is IN the union now, and the rule is the reason it is allowed to
    // be: the capture system exists (ADR-0025), so grantPow can reach it.
    // 'air' is still HOLD and still absent — an aviation unit has to exist
    // before an Air Medal is a thing anybody could earn.
    expect(awards).toContain("kind: 'pow'")
    const types = await fs.readFile(path.join(here, '..', 'src', 'types.ts'), 'utf8')
    const union = types.slice(types.indexOf('export type AwardKind'), types.indexOf('export interface AwardRecord'))
    expect(union).toContain("| 'pow'")
    expect(union).not.toContain("| 'air'")
  })

  it('refuses an event that does not qualify, every time', () => {
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const personId = aSoldier(world)
    const wrong = recordEvent(world, world.tick, { type: 'married', subjectId: personId as never })

    expect(grantServiceRibbon(world, world.tick, personId as never, wrong)).toBeNull()
    expect(grantNcoDevelopment(world, world.tick, personId as never, wrong, 'small-unit leader')).toBeNull()
    expect(grantAchievement(world, world.tick, personId as never, wrong, 900)).toBeNull()
    expect(grantOverseas(world, world.tick, personId as never, wrong)).toBeNull()
    expect(grantCommendation(world, world.tick, personId as never, wrong, 600)).toBeNull()
    expect(grantCombatMerit(world, world.tick, personId as never, wrong, 900)).toBeNull()

    // Somebody else's event is not yours, either.
    const other = [...world.people.values()].find((p) => p.id !== personId)
    if (other) {
      const theirs = recordEvent(world, world.tick, {
        type: 'completed-training',
        subjectId: other.id,
        detail: 'basic training',
      })
      expect(grantServiceRibbon(world, world.tick, personId as never, theirs)).toBeNull()
    }
  })

  it('grants each new ribbon from the event that actually earns it', () => {
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const personId = aSoldier(world)

    const basic = recordEvent(world, world.tick, {
      type: 'completed-training',
      subjectId: personId as never,
      detail: 'basic training',
    })
    expect(grantServiceRibbon(world, world.tick, personId as never, basic)?.title).toBe(SERVICE_RIBBON_TITLE)

    const course = recordEvent(world, world.tick, {
      type: 'completed-training',
      subjectId: personId as never,
      detail: 'the Junior Leaders Course',
    })
    expect(grantNcoDevelopment(world, world.tick, personId as never, course, 'small-unit leader')?.title).toBe(
      NCO_DEVELOPMENT_TITLE,
    )
    // ...and not for any other course.
    expect(grantNcoDevelopment(world, world.tick, personId as never, course, 'parachutist')).toBeNull()

    expect(grantAchievement(world, world.tick, personId as never, course, 900)?.title).toBe(ACHIEVEMENT_TITLE)
    // A mediocre course is not an achievement.
    expect(grantAchievement(world, world.tick, personId as never, course, 300)).toBeNull()

    const home = recordEvent(world, world.tick, {
      type: 'returned-home',
      subjectId: personId as never,
      detail: 'rotation complete',
    })
    expect(grantOverseas(world, world.tick, personId as never, home)?.title).toBe(OVERSEAS_TITLE)

    const war = recordEvent(world, world.tick, { type: 'wartime-service', subjectId: personId as never })
    expect(grantNationalDefense(world, world.tick, personId as never, war)?.title).toBe(
      NATIONAL_DEFENSE_TITLE,
    )
    // Once in a lifetime, however many wars.
    const second = recordEvent(world, world.tick, { type: 'wartime-service', subjectId: personId as never })
    expect(grantNationalDefense(world, world.tick, personId as never, second)?.count).toBe(1)
  })

  it('separates the commendation from the meritorious medal by the work', () => {
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const personId = aSoldier(world)
    const discharged = recordEvent(world, world.tick, {
      type: 'discharged',
      subjectId: personId as never,
      detail: 'end of term',
    })

    // A commendable term earns the commendation and NOT the meritorious.
    expect(grantCommendation(world, world.tick, personId as never, discharged, 600)?.title).toBe(
      COMMENDATION_TITLE,
    )
    // A distinguished one is above the commendation's ceiling.
    expect(grantCommendation(world, world.tick, personId as never, discharged, 900)).toBeNull()
  })

  it('gives the merit Bronze Star only to a term with a combat tour behind it', () => {
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const personId = aSoldier(world)
    const discharged = recordEvent(world, world.tick, {
      type: 'discharged',
      subjectId: personId as never,
      detail: 'end of term',
    })

    // No deployments: no combat zone, no Bronze Star, however good the term.
    expect(grantCombatMerit(world, world.tick, personId as never, discharged, 950)).toBeNull()

    world.deployments.set(personId as never, [
      {
        personId: personId as never,
        tourNumber: 1,
        kind: 'combat',
        enemyId: null,
        hostId: null,
        warA: null,
        warB: null,
        startedAtTick: (world.tick - 12) as never,
        endsAtTick: (world.tick - 2) as never,
        returnedAtTick: (world.tick - 2) as never,
        capturedAtTick: null,
      },
    ])
    expect(grantCombatMerit(world, world.tick, personId as never, discharged, 950)?.title).toBe(
      COMBAT_MERIT_TITLE,
    )
  })
})

describe('combat recognition takes its face from the trade', () => {
  it('gives the infantryman, the medic and everyone else their own badge', () => {
    // One `saw-combat` event, three badges (owner's pack §5). The
    // qualifying event is identical in all three cases — only the face of
    // the recognition changes, which is exactly how it works.
    const titles = new Set<string>()
    for (const [trade, expected] of [
      ['rifleman', COMBAT_INFANTRY_BADGE],
      ['medic', COMBAT_MEDICAL_BADGE],
      ['transport-driver', COMBAT_ACTION_BADGE],
    ] as const) {
      const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
      const personId = aSoldier(world)
      const record = world.service.get(personId as never)
      if (!record) throw new Error('no record')
      world.service.set(personId as never, { ...record, specialtyId: trade })

      const contact = recordEvent(world, world.tick, {
        type: 'saw-combat',
        subjectId: personId as never,
        otherId: 1 as never,
      })
      const granted = grantCombatAction(world, world.tick, personId as never, contact, 'Iran')
      expect(granted?.title, `${trade} got the wrong badge`).toBe(expected)
      titles.add(granted?.title ?? '')
    }
    expect(titles.size, 'three trades, three badges').toBe(3)
  })

  it('still refuses an event that is not contact', () => {
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const personId = aSoldier(world)
    const notContact = recordEvent(world, world.tick, {
      type: 'promoted',
      subjectId: personId as never,
    })
    expect(grantCombatAction(world, world.tick, personId as never, notContact, 'Iran')).toBeNull()
  })
})

describe('the long-service medal keeps a real generic name', () => {
  it('is an armed forces service medal, not a war-named one', () => {
    expect(LONG_SERVICE_TITLE).toBe('the Armed Forces Service Medal')
  })
})

describe('the ribbons show up in a real career', () => {
  it('a century of Heartland produces earned racks and nothing else', () => {
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 1200)

    let anyAward = 0
    for (const [personId, awards] of world.awards) {
      for (const award of awards) {
        anyAward++
        // EVERY award points at the events that earned it. That is the
        // whole rule, and it is checkable on the record itself.
        expect(award.qualifyingEventIds.length, `${award.title} has no evidence`).toBeGreaterThan(0)
        for (const eventId of award.qualifyingEventIds) {
          const event = world.events.find((e) => e.id === eventId)
          expect(event, `${award.title} cites an event that does not exist`).toBeDefined()
          expect(event?.subjectId).toBe(personId)
        }
      }
    }
    expect(anyAward).toBeGreaterThan(0)
  })
})
