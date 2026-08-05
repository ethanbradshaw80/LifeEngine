/**
 * ADR-0037 — the Article 15: a notification, a paper you sign, and a bridge
 * from the courthouse to the orderly room.
 *
 * The discipline itself is NOT under test here — the M-ARMY2 misconduct
 * pass already had its own coverage and is untouched. What is new is that
 * it produces a document, that only the consequential ones do, and that a
 * civilian conviction now reaches a serving member.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Tick } from '@life-engine/shared'
import { article15For } from '../src/article15.js'
import { ageAt } from '../src/clock.js'
import { advanceTick, createWorld } from '../src/index.js'
import { describePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import { BRANCH_RANKS } from '../src/content.js'
import type { World } from '../src/types.js'

/** Somebody serving, played, with a stripe to lose. */
function aServingPlayer(seed: number): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seed), 200)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 22 && ageAt(p.birthTick, world.tick) <= 40)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  setPlayer(world, person.id)
  world.employment.delete(person.id)
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    unitSinceTick: null,
    commissioned: false,
    rank: 5,
    rankSinceTick: 0 as Tick,
    qualifications: [],
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
    enlistedAtTick: 0 as Tick,
    baseId: null,
    monthlyPay: 200_000,
    performance: 600,
    termMonthsLeft: 40,
    termMonths: 48,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: 0,
    unitId: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 600,
    fitnessTestedAtTick: null,
  } as never)
  return { world, personId: person.id }
}

function markDisciplined(world: World, personId: EntityId, detail: string): Tick {
  const tick = world.tick
  world.events.push({
    id: 800_000 + world.events.length,
    tick,
    type: 'disciplined',
    subjectId: personId,
    otherId: null,
    placeId: null,
    detail,
  } as never)
  return tick
}

describe('the paper', () => {
  it('reads the punishment off the record, and names the grade lost', () => {
    const { world, personId } = aServingPlayer(4141)
    // SGT is rank 5 on the ground ladder; the bust already happened, so the
    // record holds the grade AFTER it, exactly as the real path leaves it.
    world.service.set(personId, { ...world.service.get(personId)!, rank: 4 })
    const tick = markDisciplined(world, personId, 'a fight that went too far — busted a stripe')

    const sheet = article15For(world, personId, tick)
    expect(sheet).toBeDefined()
    expect(sheet?.reduced).toBe(true)
    // Both grades on the paper: the one they hold and the one they held.
    expect(sheet?.grade).toContain(BRANCH_RANKS['land-forces'][4])
    expect(sheet?.grade).toContain(BRANCH_RANKS['land-forces'][5])
    // The infraction is the real text, with the bust stripped off it.
    expect(sheet?.offence).toBe('a fight that went too far')
    expect(sheet?.title).toContain('Article 15')
    expect(sheet?.markNumber).toBe(1)
    expect(sheet?.findings.length).toBeGreaterThan(2)
  })

  it('is the same paper on a replay, and says so about a clean bust', () => {
    const { world, personId } = aServingPlayer(4141)
    const tick = markDisciplined(world, personId, 'asleep on watch')
    const first = article15For(world, personId, tick)
    const second = article15For(world, personId, tick)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    // No stripe lost, so nothing claims one was.
    expect(first?.reduced).toBe(false)
    expect(first?.grade).not.toContain('reduced')
  })

  it('refuses to invent a document for a punishment that did not happen', () => {
    const { world, personId } = aServingPlayer(4141)
    expect(article15For(world, personId, world.tick)).toBeUndefined()
  })

  it('counts the marks that stand, and says when the third ends it', () => {
    const { world, personId } = aServingPlayer(4141)
    markDisciplined(world, personId, 'late off leave')
    markDisciplined(world, personId, 'missed movement')
    const third = markDisciplined(world, personId, 'insubordination before the company')
    const sheet = article15For(world, personId, third)
    expect(sheet?.markNumber).toBe(3)
    expect(sheet?.findings.join(' ')).toContain('career ends here')
  })
})

describe('the bridge from the courthouse', () => {
  it('turns a fine into an Article 15, and a jail term into nothing', () => {
    // A conviction with no confinement is exactly the case nonjudicial
    // punishment exists for. A conviction WITH confinement already removes
    // the soldier from duty and belongs to the separation path.
    for (const [sentenceMonths, expected] of [
      [0, true],
      [18, false],
    ] as const) {
      const { world, personId } = aServingPlayer(4141)
      world.criminal.set(personId, {
        personId,
        // Handed down this month; the orderly room answers it next month.
        convictions: [
          { kind: 'theft', tick: world.tick, sentenceMonths, fine: sentenceMonths === 0 ? 50_000 : 0 },
        ],
      } as never)

      const before = world.events.filter((e) => e.type === 'disciplined').length
      advanceTick(world)
      const after = world.events.filter(
        (e) => e.type === 'disciplined' && e.subjectId === personId,
      ).length
      expect(after > before, `sentence ${String(sentenceMonths)}`).toBe(expected)
      if (expected) {
        const mark = world.events.find(
          (e) => e.type === 'disciplined' && e.subjectId === personId,
        )
        expect(mark?.detail).toContain('civilian conviction')
      }
    }
  })

  it('hands the player the paper, and hands an NPC only the record', () => {
    const { world, personId } = aServingPlayer(4141)
    world.criminal.set(personId, {
      personId,
      convictions: [{ kind: 'theft', tick: world.tick, sentenceMonths: 0, fine: 50_000 }],
    } as never)
    advanceTick(world)
    expect(world.player.pending?.kind).toBe('article15')
    // And the prompt says what happened rather than "paperwork".
    expect(describePending(world, world.player.pending!).toLowerCase()).toContain('punishment')

    // The same case, nobody playing: a record, and no pending at all.
    const other = aServingPlayer(4141)
    setPlayer(other.world, null)
    other.world.criminal.set(other.personId, {
      personId: other.personId,
      convictions: [{ kind: 'theft', tick: other.world.tick, sentenceMonths: 0, fine: 50_000 }],
    } as never)
    advanceTick(other.world)
    expect(
      other.world.events.some((e) => e.type === 'disciplined' && e.subjectId === other.personId),
    ).toBe(true)
    expect(other.world.player.pending).toBeNull()
  })
})
