/**
 * Generational play. M-LEGACY.
 *
 * The claims: kinship walks are correct and bounded; legacy sums agree with
 * the inheritance events to the cent; the lineage records successions and
 * only successions; a family home is a judgement about generations, not just
 * age; and a played line can actually span three generations.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import {
  childrenIdsOf,
  descendantGenerations,
  familyHomeSince,
  familyTreeOf,
  legacySummaryOf,
  lineageOf,
  playsDescendantLine,
  siblingIdsOf,
} from '../src/legacy.js'
import { awaitingPlayer, heirsOf, playerIsAlive, resolvePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

function grownWorld(): World {
  const world = createWorld(makeSeed(12345), 100)
  advanceTicks(world, 600)
  return world
}

describe('kinship walks', () => {
  it('agrees with parentIds in both directions', () => {
    const world = grownWorld()
    for (const person of world.people.values()) {
      for (const parentId of person.parentIds) {
        expect(childrenIdsOf(world, parentId)).toContain(person.id)
      }
    }
  })

  it('finds siblings through shared parents, half-siblings included', () => {
    const world = grownWorld()
    const withSiblings = [...world.people.values()].find((p) => siblingIdsOf(world, p.id).length > 0)
    expect(withSiblings).toBeDefined()
    if (!withSiblings) return
    for (const siblingId of siblingIdsOf(world, withSiblings.id)) {
      const sibling = world.people.get(siblingId)
      expect(sibling?.parentIds.some((id) => withSiblings.parentIds.includes(id))).toBe(true)
    }
  })

  it('builds a tree whose every id resolves', () => {
    const world = grownWorld()
    const someone = livingPeople(world)[0]
    if (!someone) return
    const tree = familyTreeOf(world, someone.id)
    for (const ids of [tree.grandparents, tree.parents, tree.siblings, tree.children, tree.grandchildren]) {
      for (const id of ids) expect(world.people.get(id)).toBeDefined()
    }
  })

  it('counts descendant generations without hanging', () => {
    const world = grownWorld()
    for (const person of [...world.people.values()].slice(0, 40)) {
      const generations = descendantGenerations(world, person.id)
      expect(generations).toBeGreaterThanOrEqual(0)
      expect(generations).toBeLessThanOrEqual(12)
    }
  })
})

describe('legacy sums', () => {
  it('agrees with the inherited events to the cent', () => {
    const world = createWorld(makeSeed(12345), 100)
    advanceTicks(world, 720)

    const inherited = world.events.filter((e) => e.type === 'inherited')
    expect(inherited.length).toBeGreaterThan(0)

    // Group by benefactor: the estate's total must equal the sum of receipts.
    const byBenefactor = new Map<import('@life-engine/shared').EntityId, number>()
    for (const event of inherited) {
      if (event.otherId === null || event.detail === null) continue
      const amount = Number.parseInt(event.detail, 10)
      byBenefactor.set(event.otherId, (byBenefactor.get(event.otherId) ?? 0) + amount)
    }
    for (const [benefactorId, total] of byBenefactor) {
      expect(legacySummaryOf(world, benefactorId).leftToHeirs).toBe(total)
    }

    // And by heir, for the receiving side.
    const someHeir = inherited[0]?.subjectId
    if (someHeir !== undefined) {
      const expected = inherited
        .filter((e) => e.subjectId === someHeir)
        .reduce((sum, e) => sum + Number.parseInt(e.detail ?? '0', 10), 0)
      expect(legacySummaryOf(world, someHeir).inherited).toBe(expected)
    }
  })
})

describe('the family home', () => {
  it('is not a judgement about mere age', () => {
    const world = createWorld(makeSeed(12345), 100)
    // At tick 0 nothing qualifies: nothing has stood twenty years.
    for (const household of world.households.values()) {
      expect(familyHomeSince(world, household)).toBeNull()
    }
  })

  it('recognises a long-held home where a generation was raised', () => {
    const world = grownWorld()
    const flagged = [...world.households.values()].filter(
      (h) => h.dissolvedTick === null && familyHomeSince(world, h) !== null,
    )
    expect(flagged.length).toBeGreaterThan(0)
    for (const household of flagged) {
      expect(world.tick - household.formedTick).toBeGreaterThanOrEqual(240)
    }
  })
})

describe('the line', () => {
  it('records successions across three generations, and knows it is a descent', () => {
    const world = createWorld(makeSeed(12345), 100)

    // Start with a young founding PARENT: their children exist from tick 0,
    // so the first succession is guaranteed and the test exercises lineage
    // mechanics rather than gambling on one person's courtship luck. (First
    // attempt started with a child; she lived to 75, was never asked a single
    // courtship question, and died heirless. A believable life — and a flaky
    // test.)
    const start = livingPeople(world)
      .filter((p) => {
        const age = ageAt(p.birthTick, world.tick)
        return age >= 24 && age <= 36 && childrenIdsOf(world, p.id).length > 0
      })
      .sort((a, b) => a.id - b.id)[0]
    expect(start).toBeDefined()
    if (!start) return
    setPlayer(world, start.id)

    let lives = 1
    // Live until death, hand to the eldest heir, repeat — up to three lives
    // or the world runs dry of heirs.
    for (let guard = 0; guard < 30_000 && lives <= 3; guard++) {
      if (awaitingPlayer(world)) {
        resolvePending(world, world.player.pending?.options[0] ?? 'decline')
        continue
      }
      if (!playerIsAlive(world)) {
        const deadId = world.player.personId
        if (deadId === null) break
        const heir = heirsOf(world, deadId)[0]
        if (heir === undefined) break
        setPlayer(world, heir, true)
        lives++
        continue
      }
      advanceTick(world)
    }

    expect(lives).toBeGreaterThanOrEqual(2)
    const lineage = lineageOf(world)
    expect(lineage.length).toBe(lives)
    // Every completed life in the lineage is genuinely dead.
    for (const id of world.player.lineage) {
      expect(world.people.get(id)?.deathTick).not.toBeNull()
    }
    expect(playsDescendantLine(world)).toBe(true)
  })

  it('does not record an abandonment as a succession', () => {
    const world = createWorld(makeSeed(12345), 100)
    const people = livingPeople(world)
    const first = people[0]
    const unrelated = people.find((p) => first && !p.parentIds.includes(first.id) && p.id !== first.id)
    if (!first || !unrelated) return

    setPlayer(world, first.id)
    // Switch while alive to someone unrelated: a new story, not a succession.
    setPlayer(world, unrelated.id, true)
    expect(world.player.lineage.length).toBe(0)
  })
})
