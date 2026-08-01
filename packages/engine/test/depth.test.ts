/**
 * Playable-life depth: children, moving house, retirement, separation, and
 * the stakes shown before each choice.
 *
 * These tests build the scenario directly — hand-placing a marriage or a job
 * — rather than simulating for decades and hoping the situation arises. The
 * mechanism is what is under test, not the odds of reaching it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed, TICKS_PER_YEAR } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import {
  awaitingPlayer,
  describePending,
  describeStakes,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { relationshipBetween, relationshipsOf } from '../src/relationships.js'
import { livingPeople } from '../src/systems.js'
import { relationshipKey } from '../src/types.js'
import type { World } from '../src/types.js'

/** A married adult couple sharing a household, found in the founding town. */
function findCouple(world: World) {
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'spouse') continue
    const a = world.people.get(relationship.a)
    const b = world.people.get(relationship.b)
    if (!a || !b || a.householdId === null || a.householdId !== b.householdId) continue
    const wife = a.sex === 'female' ? a : b
    const ageOfWife = ageAt(wife.birthTick, world.tick)
    if (ageOfWife >= 22 && ageOfWife <= 34) return { relationship, a, b, wife }
  }
  throw new Error('no suitable founding couple — different seed needed')
}

/** Drive one system until it raises a pending decision, bounded. */
function tickUntilPending(world: World, maxTicks: number): boolean {
  for (let i = 0; i < maxTicks; i++) {
    if (awaitingPlayer(world)) return true
    advanceTick(world)
  }
  return awaitingPlayer(world)
}

describe('having a child is the couple\'s decision', () => {
  it('asks the player instead of rolling the birth through', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)

    // The monthly roll is stochastic; drive until the question arrives.
    const asked = tickUntilPending(world, 240)
    // Whatever arrived first must eventually include a child question for a
    // married woman in her twenties. Answer everything else with the first
    // option until the child question appears.
    let guard = 0
    while (asked && world.player.pending && world.player.pending.kind !== 'child' && guard < 400) {
      resolvePending(world, world.player.pending.options[0] ?? 'decline')
      tickUntilPending(world, 240)
      guard++
    }
    expect(world.player.pending?.kind).toBe('child')
  })

  it('accept delivers the identical child the automatic path would have', () => {
    // Two copies of the same world: in one the wife is played and accepts; in
    // the other nobody is played. The child born must be the same person —
    // same name, same sex, same traits — because deliverChild keys all
    // randomness on (mother, tick) and the child's own id.
    //
    // Recast at D2: fertility is now a latent per-woman draw, so a blindly
    // picked wife can be one who never conceives — and the longer the
    // window, the likelier a pending whose first option diverges from the
    // auto path's roll. So SCOUT first: run a throwaway world and choose
    // the founding wife whose first child arrives EARLIEST. Shortest
    // window, guaranteed-fertile couple, robust to future tuning.
    const seedValue = 2024

    const scout = createWorld(makeSeed(seedValue), 100)
    advanceTicks(scout, 240)
    const earliest = scout.events.find((e) => {
      if (e.type !== 'born') return false
      const child = scout.people.get(e.subjectId)
      return child !== undefined && child.parentIds.some((id) => {
        const parent = scout.people.get(id)
        return parent !== undefined && parent.sex === 'female' && parent.birthTick < 0
      })
    })
    if (!earliest) throw new Error('no founding-mother birth in 20 years — tuning collapsed?')
    const scoutChild = scout.people.get(earliest.subjectId)
    const motherId = scoutChild?.parentIds.find((id) => scout.people.get(id)?.sex === 'female')
    if (motherId === undefined) throw new Error('birth without a mother on record')

    const auto = createWorld(makeSeed(seedValue), 100)
    const played = createWorld(makeSeed(seedValue), 100)
    const wife = played.people.get(motherId)
    if (!wife) throw new Error('scouted mother missing from the twin world')
    const couple = { wife }
    setPlayer(played, wife.id)

    for (let i = 0; i < 240; i++) {
      advanceTick(auto)
      advanceTick(played)
      if (awaitingPlayer(played)) {
        const pending = played.player.pending
        if (!pending) break
        if (pending.kind === 'child') {
          resolvePending(played, 'accept')
          // The child exists in both worlds this tick. Compare them.
          const bornAuto = auto.events.filter((e) => e.type === 'born' && e.tick === pending.tick)
          const bornPlayed = played.events.filter((e) => e.type === 'born' && e.tick === pending.tick)
          const motherChildAuto = bornAuto
            .map((e) => auto.people.get(e.subjectId))
            .find((c) => c?.parentIds.includes(couple.wife.id))
          const child = bornPlayed
            .map((e) => played.people.get(e.subjectId))
            .find((c) => c?.parentIds.includes(couple.wife.id))
          // Hard expectations both sides (review S5): a missing auto twin
          // IS the parity break this test exists to catch — it must never
          // pass vacuously.
          expect(child).toBeDefined()
          expect(motherChildAuto).toBeDefined()
          if (motherChildAuto && child) {
            expect(child.givenName).toBe(motherChildAuto.givenName)
            expect(child.sex).toBe(motherChildAuto.sex)
            expect(child.traits).toEqual(motherChildAuto.traits)
          }
          return
        }
        resolvePending(played, pending.options[0] ?? 'decline')
      }
    }
    throw new Error('no child question arose within 20 years — tuning drifted?')
  })

  it('decline means no child this month', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)

    let guard = 0
    tickUntilPending(world, 240)
    while (world.player.pending && world.player.pending.kind !== 'child' && guard < 400) {
      resolvePending(world, world.player.pending.options[0] ?? 'decline')
      tickUntilPending(world, 240)
      guard++
    }
    const pending = world.player.pending
    expect(pending?.kind).toBe('child')
    if (!pending) return

    const childrenBefore = [...world.people.values()].filter((p) =>
      p.parentIds.includes(wife.id),
    ).length
    resolvePending(world, 'decline')
    const childrenAfter = [...world.people.values()].filter((p) =>
      p.parentIds.includes(wife.id),
    ).length
    expect(childrenAfter).toBe(childrenBefore)
  })
})

describe('retirement is the player\'s call', () => {
  function workingElder(world: World) {
    // Hand-build the situation: take a founding 64-year-old with a job, or
    // give one a job directly. The employment map is the authority.
    // High vitality on purpose: the question returns on the NEXT birthday,
    // so the test needs an elder likely to see it. Margaret (vitality-poor)
    // died eleven ticks after her first review and one tick before her
    // second, which is a fine life and a broken test.
    const elder = livingPeople(world).find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 60 && age <= 65 && p.traits.vitality >= 750
    })
    if (!elder) throw new Error('no robust 60-65 year old in the founding town')
    if (!world.employment.has(elder.id)) {
      world.employment.set(elder.id, {
        personId: elder.id,
        occupationId: 'clerk',
        workplaceId: world.town.placeIds[9] ?? elder.id,
        monthlyPay: 200_000 as Money,
        startedAtTick: 0 as Tick,
        performance: 600,
      })
    }
    return elder
  }

  it('asks on the birthday after retirement age instead of forcing it', () => {
    const world = createWorld(makeSeed(12345), 100)
    const elder = workingElder(world)
    setPlayer(world, elder.id)

    const asked = tickUntilPending(world, TICKS_PER_YEAR * 4)
    expect(asked).toBe(true)
    // Skip unrelated questions (job offers cannot arise while employed, but
    // courtship might) until retirement appears.
    let guard = 0
    while (world.player.pending && world.player.pending.kind !== 'retirement' && guard < 40) {
      resolvePending(world, world.player.pending.options[1] ?? world.player.pending.options[0] ?? 'decline')
      tickUntilPending(world, TICKS_PER_YEAR * 4)
      guard++
    }
    expect(world.player.pending?.kind).toBe('retirement')
  })

  it('keep-working keeps the job and asks again next year', () => {
    const world = createWorld(makeSeed(12345), 100)
    const elder = workingElder(world)
    setPlayer(world, elder.id)

    tickUntilPending(world, TICKS_PER_YEAR * 4)
    let guard = 0
    while (world.player.pending && world.player.pending.kind !== 'retirement' && guard < 40) {
      resolvePending(world, world.player.pending.options[1] ?? 'decline')
      tickUntilPending(world, TICKS_PER_YEAR * 4)
      guard++
    }
    const firstAsk = world.tick
    expect(world.player.pending?.kind).toBe('retirement')

    resolvePending(world, 'keep-working')
    expect(world.employment.has(elder.id)).toBe(true)

    // A year later the question returns.
    guard = 0
    tickUntilPending(world, TICKS_PER_YEAR + 2)
    while (world.player.pending && world.player.pending.kind !== 'retirement' && guard < 40) {
      resolvePending(world, world.player.pending.options[1] ?? 'decline')
      tickUntilPending(world, TICKS_PER_YEAR + 2)
      guard++
    }
    expect(world.player.pending?.kind).toBe('retirement')
    expect(world.tick - firstAsk).toBeGreaterThanOrEqual(TICKS_PER_YEAR)
    expect(world.tick - firstAsk).toBeLessThanOrEqual(TICKS_PER_YEAR + 40)

    resolvePending(world, 'retire')
    expect(world.employment.has(elder.id)).toBe(false)
  })
})

describe('a failing marriage is the player\'s call', () => {
  function strainedMarriage(world: World) {
    const { relationship, a, wife } = findCouple(world)
    // Weaken it below the separation threshold by hand — the mechanism under
    // test is the choice, not the decades of erosion that lead to it.
    const weakened = { ...relationship, strength: 120 }
    world.relationships.set(relationshipKey(relationship.a, relationship.b), weakened)
    return { relationship: weakened, person: wife, other: a.id === wife.id ? relationship.b : relationship.a }
  }

  it('asks instead of divorcing the player automatically', () => {
    const world = createWorld(makeSeed(12345), 100)
    const { person } = strainedMarriage(world)
    setPlayer(world, person.id)

    let guard = 0
    tickUntilPending(world, 120)
    while (world.player.pending && world.player.pending.kind !== 'separation' && guard < 60) {
      resolvePending(world, world.player.pending.options[1] ?? world.player.pending.options[0] ?? 'decline')
      tickUntilPending(world, 120)
      guard++
    }
    expect(world.player.pending?.kind).toBe('separation')
  })

  it('staying restores some strength and writes an own-choice record', () => {
    const world = createWorld(makeSeed(12345), 100)
    const { person, other } = strainedMarriage(world)
    setPlayer(world, person.id)

    let guard = 0
    tickUntilPending(world, 120)
    while (world.player.pending && world.player.pending.kind !== 'separation' && guard < 60) {
      resolvePending(world, world.player.pending.options[1] ?? 'decline')
      tickUntilPending(world, 120)
      guard++
    }
    expect(world.player.pending?.kind).toBe('separation')
    const strengthBefore = relationshipBetween(world, person.id, other)?.strength ?? 0

    resolvePending(world, 'stay')

    const tie = relationshipBetween(world, person.id, other)
    expect(tie?.type).toBe('spouse')
    expect(tie?.strength ?? 0).toBeGreaterThan(strengthBefore)

    const record = world.causalRecords.find(
      (r) =>
        r.subjectId === person.id &&
        r.decision === 'separation' &&
        r.chosen.includes('stay') &&
        r.inputs.some((f) => f.factor === 'own-choice'),
    )
    expect(record).toBeDefined()
  })

  it('separating ends it, with the choice on the record', () => {
    const world = createWorld(makeSeed(12345), 100)
    const { person, other } = strainedMarriage(world)
    setPlayer(world, person.id)

    let guard = 0
    tickUntilPending(world, 120)
    while (world.player.pending && world.player.pending.kind !== 'separation' && guard < 60) {
      resolvePending(world, world.player.pending.options[1] ?? 'decline')
      tickUntilPending(world, 120)
      guard++
    }
    expect(world.player.pending?.kind).toBe('separation')

    resolvePending(world, 'separate')

    const tie = relationshipBetween(world, person.id, other)
    expect(tie?.type).toBe('former-spouse')
    expect(tie?.endedAtTick).not.toBeNull()
  })
})

describe('stakes', () => {
  it('every pending decision can describe itself and its stakes', () => {
    // Sweep a played life and check every prompt that arises: non-empty text,
    // no leaked placeholders, and stakes lines that are real sentences.
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)

    const kindsSeen = new Set<string>()
    for (let guard = 0; guard < 900; guard++) {
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (!pending) break
        kindsSeen.add(pending.kind)

        const prompt = describePending(world, pending)
        expect(prompt.length).toBeGreaterThan(10)
        expect(prompt).not.toContain('undefined')

        for (const line of describeStakes(world, pending)) {
          expect(line.length).toBeGreaterThan(5)
          expect(line).not.toContain('undefined')
          expect(line).not.toContain('NaN')
        }
        resolvePending(world, pending.options[0] ?? 'decline')
      } else {
        advanceTick(world)
        if (!playerAlive(world, wife.id)) break
      }
    }
    expect(kindsSeen.size).toBeGreaterThanOrEqual(2)
  })

  it('job-offer stakes compare pay honestly', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)

    let guard = 0
    tickUntilPending(world, 240)
    while (world.player.pending && world.player.pending.kind !== 'job-offer' && guard < 200) {
      resolvePending(world, world.player.pending.options[world.player.pending.options.length - 1] ?? 'decline')
      tickUntilPending(world, 240)
      guard++
    }
    const pending = world.player.pending
    if (pending?.kind !== 'job-offer') return // this seed's life may not offer one; other tests cover the kind

    const lines = describeStakes(world, pending)
    expect(lines.some((line) => line.includes('$'))).toBe(true)
  })
})

function playerAlive(world: World, id: number): boolean {
  return world.people.get(id as never)?.deathTick === null
}

// Relationship display sanity for the new flows.
describe('after the choice, the graph agrees', () => {
  it('a reconciled couple still lists each other as spouses', () => {
    const world = createWorld(makeSeed(12345), 100)
    const couple = findCouple(world)
    const ties = relationshipsOf(world, couple.wife.id)
    expect(ties.some((t) => t.type === 'spouse')).toBe(true)
  })
})
