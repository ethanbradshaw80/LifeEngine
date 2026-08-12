import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import { isServing } from '../src/service.js'
import { fileBAClaim, resolvePending, setPlayer } from '../src/player.js'

/**
 * THE BOARD, THE FLOORS, AND THE LETTER (live player, on itch):
 *  - "I get like an eye injury, I heal up and then get medically
 *    discharged, there is no warning it just happens."
 *  - "Medical discharges are rare and usually just for the worst of the
 *    worst injuries."
 *  - "When you click apply for BA benefits you literally don't get
 *    anything... you need a popup and a system that tells you your rating."
 */
function servingPlayer(seed: number) {
  const world = createWorld(makeSeed(seed))
  advanceTicks(world, 12 * 40)
  const person = [...world.people.values()].find(
    (p) => p.deathTick === null && isServing(world, p.id) && ageAt(p.birthTick, world.tick) < 45,
  )
  expect(person).toBeDefined()
  if (!person) throw new Error('unreachable')
  setPlayer(world, person.id)
  return { world, personId: person.id }
}

function setDisability(world: ReturnType<typeof createWorld>, personId: number, value: number) {
  const health = world.health.get(personId)!
  world.health.set(personId, { ...health, disability: value, serviceDisability: value })
}

describe('the wound floors', () => {
  it('a partial eye injury no longer ends a career', () => {
    // The player's exact case: heal up from an eye wound, career survives.
    const world = createWorld({ seed: 909, townSize: 'small' })
    const personId = [...world.people.keys()][0]!
    const before = world.health.get(personId)!
    world.health.set(personId, {
      ...before,
      ailment: 'injury',
      ailmentKind: 'eye-injury',
      ailmentSite: 'head',
      severity: 1,
      peakSeverity: 500, // partial — below the 700 blinding line
      sinceTick: (world.tick - 6) as Tick,
      ailmentServiceConnected: true,
    })
    advanceTicks(world, 2)
    const after = world.health.get(personId)!
    // Rated — but UNDER the 400 medical bar: the career continues.
    expect(after.disability).toBeGreaterThanOrEqual(250)
    expect(after.disability).toBeLessThan(400)
  })

  it('a blinding eye injury still lands past the bar', () => {
    const world = createWorld({ seed: 909, townSize: 'small' })
    const personId = [...world.people.keys()][1]!
    const before = world.health.get(personId)!
    world.health.set(personId, {
      ...before,
      ailment: 'injury',
      ailmentKind: 'eye-injury',
      ailmentSite: 'head',
      severity: 1,
      peakSeverity: 800,
      sinceTick: (world.tick - 6) as Tick,
      ailmentServiceConnected: true,
    })
    advanceTicks(world, 2)
    expect(world.health.get(personId)!.disability).toBeGreaterThanOrEqual(450)
  })
})

describe('the medical board', () => {
  it('the discretionary band can retain — and the verdict is stable', () => {
    // 400-449: the board decides, keyed to the person, not the tick. Count
    // both outcomes across people; assert the SAME person never flips.
    let retained = 0
    let discharged = 0
    for (let i = 0; i < 12; i += 1) {
      const world = createWorld(makeSeed(100 + i))
      advanceTicks(world, 12 * 40)
      const soldier = [...world.people.values()].find(
        (p) => p.deathTick === null && isServing(world, p.id),
      )
      if (!soldier) continue
      setDisability(world, soldier.id, 415)
      advanceTicks(world, 3)
      const stillIn = isServing(world, soldier.id)
      if (stillIn) {
        retained += 1
        // The board that kept you in March has not changed its mind: three
        // more months, same person, same number — still serving.
        advanceTicks(world, 3)
        expect(isServing(world, soldier.id)).toBe(true)
      } else {
        discharged += 1
      }
    }
    // Both outcomes must be REACHABLE, or the board is a rubber stamp.
    expect(retained).toBeGreaterThan(0)
    expect(discharged).toBeGreaterThan(0)
  })

  it('the player is told before the trapdoor opens', () => {
    const { world, personId } = servingPlayer(4242)
    setDisability(world, personId, 470) // catastrophic band — no retention
    advanceTicks(world, 2)

    // NOT discharged silently: the finding is a pending decision.
    expect(world.player.pending?.kind).toBe('medical-board')
    expect(isServing(world, personId)).toBe(true)

    // Acknowledging it is when the career ends.
    resolvePending(world, 'accept-findings')
    expect(isServing(world, personId)).toBe(false)
  })
})

describe('the rating letter', () => {
  it('filing a claim raises the letter with the true rating', () => {
    const { world, personId } = servingPlayer(777)
    setDisability(world, personId, 470)
    advanceTicks(world, 2)
    resolvePending(world, 'accept-findings') // discharged veteran now
    // The discharge hands over the DD-214 as its own moment — answer it
    // (and anything else the month raises) before walking into the BA.
    for (let guard = 0; guard < 4 && world.player.pending !== null; guard += 1) {
      resolvePending(world, world.player.pending.options[0] ?? 'accept')
    }

    const filed = fileBAClaim(world)
    expect(filed.done).toBe(true)
    expect(world.player.pending?.kind).toBe('ba-claim')
    // The letter carries the rating and a real monthly figure.
    expect(Number(world.player.pending?.occupationId)).toBeGreaterThanOrEqual(400)
    expect(Number(world.player.pending?.monthlyPay)).toBeGreaterThan(0)
    resolvePending(world, 'accept')
    // The letter is answered and gone. (The slot may immediately carry
    // some OTHER moment the life has queued — the DD-214 re-raises until
    // acknowledged — and that is its persistence working, not the claim's.)
    expect(world.player.pending?.kind).not.toBe('ba-claim')
  })

  it('a below-threshold claim gets a denial letter, not silence', () => {
    const { world, personId } = servingPlayer(555)
    setDisability(world, personId, 470)
    advanceTicks(world, 2)
    resolvePending(world, 'accept-findings')
    for (let guard = 0; guard < 4 && world.player.pending !== null; guard += 1) {
      resolvePending(world, world.player.pending.options[0] ?? 'accept')
    }
    // Rewrite the record to a sub-threshold rating before filing.
    setDisability(world, personId, 150)

    const filed = fileBAClaim(world)
    // "Nothing happens" was the bug. A denial is an ANSWER: the letter is
    // raised, the monthly is zero, and the card says why.
    expect(filed.done).toBe(true)
    expect(world.player.pending?.kind).toBe('ba-claim')
    expect(Number(world.player.pending?.monthlyPay)).toBe(0)
  })
})
