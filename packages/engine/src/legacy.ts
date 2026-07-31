/**
 * Legacy: the generational read side. M-LEGACY.
 *
 * Everything here is a QUERY over records that already exist — kinship on
 * Person.parentIds, money movements in 'inherited' events, homes in
 * households. Nothing is stored twice, nothing is invented at read time, and
 * a legacy line in a retrospective can always be traced back to the event
 * that made it true (Law 3, Law 6).
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import type { Household, World } from './types.js'

// ---------------------------------------------------------------------------
// Kinship walks
// ---------------------------------------------------------------------------

/** Living or dead — kinship does not expire. Sorted for determinism. */
export function childrenIdsOf(world: World, personId: EntityId): EntityId[] {
  const children: EntityId[] = []
  for (const person of world.people.values()) {
    if (person.parentIds.includes(personId)) children.push(person.id)
  }
  children.sort((a, b) => a - b)
  return children
}

export function grandchildrenIdsOf(world: World, personId: EntityId): EntityId[] {
  const grandchildren = new Set<EntityId>()
  for (const childId of childrenIdsOf(world, personId)) {
    for (const grandchildId of childrenIdsOf(world, childId)) {
      grandchildren.add(grandchildId)
    }
  }
  return [...grandchildren].sort((a, b) => a - b)
}

/** Siblings share at least one parent. Half-siblings count; the person does not. */
export function siblingIdsOf(world: World, personId: EntityId): EntityId[] {
  const person = world.people.get(personId)
  if (!person || person.parentIds.length === 0) return []
  const siblings = new Set<EntityId>()
  for (const other of world.people.values()) {
    if (other.id === personId) continue
    if (other.parentIds.some((id) => person.parentIds.includes(id))) siblings.add(other.id)
  }
  return [...siblings].sort((a, b) => a - b)
}

export function grandparentIdsOf(world: World, personId: EntityId): EntityId[] {
  const person = world.people.get(personId)
  if (!person) return []
  const grandparents = new Set<EntityId>()
  for (const parentId of person.parentIds) {
    const parent = world.people.get(parentId)
    if (!parent) continue
    for (const grandparentId of parent.parentIds) grandparents.add(grandparentId)
  }
  return [...grandparents].sort((a, b) => a - b)
}

/**
 * The rows of a compact family tree centred on one person: two generations up
 * and two down, plus siblings. Rows are omitted when empty rather than padded
 * — the founding generation has no recorded ancestors, and that absence is
 * honest (their parents lived before the simulation began).
 */
export interface FamilyTree {
  readonly grandparents: EntityId[]
  readonly parents: EntityId[]
  readonly siblings: EntityId[]
  readonly children: EntityId[]
  readonly grandchildren: EntityId[]
}

export function familyTreeOf(world: World, personId: EntityId): FamilyTree {
  const person = world.people.get(personId)
  return {
    grandparents: grandparentIdsOf(world, personId),
    parents: person ? [...person.parentIds].sort((a, b) => a - b) : [],
    siblings: siblingIdsOf(world, personId),
    children: childrenIdsOf(world, personId),
    grandchildren: grandchildrenIdsOf(world, personId),
  }
}

/**
 * How many generations of descendants exist — 0 for none, 1 for children,
 * 2 for grandchildren, and so on. Bounded: a cycle in parentIds would be a
 * grave data bug, but a walk should not hang on one.
 */
export function descendantGenerations(world: World, personId: EntityId): number {
  let generation = childrenIdsOf(world, personId)
  let depth = 0
  while (generation.length > 0 && depth < 12) {
    depth++
    const next = new Set<EntityId>()
    for (const id of generation) for (const childId of childrenIdsOf(world, id)) next.add(childId)
    generation = [...next]
  }
  return depth
}

// ---------------------------------------------------------------------------
// Money across generations
// ---------------------------------------------------------------------------

export interface LegacySummary {
  /** Cents this person received from estates during their life. */
  readonly inherited: Money
  /** Cents this person's estate actually delivered to their heirs. */
  readonly leftToHeirs: Money
  readonly childCount: number
  readonly grandchildCount: number
  /** Generations of descendants alive or dead — the reach of this life. */
  readonly generations: number
}

/**
 * Sums are taken from 'inherited' events — the same records the timeline
 * shows — so the retrospective's money lines and the life story can never
 * disagree with each other.
 */
export function legacySummaryOf(world: World, personId: EntityId): LegacySummary {
  let inherited = 0
  let leftToHeirs = 0
  for (const event of world.events) {
    if (event.type !== 'inherited') continue
    const amount = event.detail === null ? 0 : Number.parseInt(event.detail, 10)
    if (!Number.isFinite(amount)) continue
    if (event.subjectId === personId) inherited += amount
    if (event.otherId === personId) leftToHeirs += amount
  }
  return {
    inherited: inherited as Money,
    leftToHeirs: leftToHeirs as Money,
    childCount: childrenIdsOf(world, personId).length,
    grandchildCount: grandchildrenIdsOf(world, personId).length,
    generations: descendantGenerations(world, personId),
  }
}

// ---------------------------------------------------------------------------
// The family home
// ---------------------------------------------------------------------------

/**
 * A household is a FAMILY HOME once it has stood for a generation and holds
 * (or held) parent and child together. Twenty years is the threshold — long
 * enough that a child was raised there.
 *
 * Read-only judgement, recomputed from state; nothing stores "is a family
 * home" because nothing needs to (one-owner rule: derived facts are not
 * fields).
 */
export function familyHomeSince(world: World, household: Household): Tick | null {
  if (world.tick - household.formedTick < 20 * TICKS_PER_YEAR) return null

  // Parent and child both members, now or before members left: use current
  // members — a home empties of children eventually, so also accept any
  // member whose parent EVER belonged. Cheap check: any current member with a
  // parent among current members, or any member who is a parent of a person
  // whose first household was this one (birth household = mother's household
  // at birth; we approximate with parentIds ∩ members).
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member) continue
    if (member.parentIds.some((parentId) => household.memberIds.includes(parentId))) {
      return household.formedTick
    }
    // A parent still living where their children grew up counts too.
    for (const person of world.people.values()) {
      if (person.parentIds.includes(memberId) && person.householdId === household.id) {
        return household.formedTick
      }
    }
  }

  // A lone survivor in a long-held home: the home is still the family's.
  const anyMemberRaisedSomeone = household.memberIds.some((memberId) => {
    for (const person of world.people.values()) {
      if (person.parentIds.includes(memberId)) return true
    }
    return false
  })
  return anyMemberRaisedSomeone ? household.formedTick : null
}

// ---------------------------------------------------------------------------
// The line being played
// ---------------------------------------------------------------------------

/** People played in this save, in order, ending with the current player. */
export function lineageOf(world: World): EntityId[] {
  const lineage = [...world.player.lineage]
  if (world.player.personId !== null) lineage.push(world.player.personId)
  return lineage
}

/** True when the current player descends from the first life played. */
export function playsDescendantLine(world: World): boolean {
  const lineage = lineageOf(world)
  if (lineage.length < 2) return false
  for (let i = 1; i < lineage.length; i++) {
    const current = world.people.get(lineage[i]!)
    if (!current) return false
    if (!current.parentIds.includes(lineage[i - 1]!)) return false
  }
  return true
}

/** Whether ancestors of `personId` include `ancestorId`, bounded walk. */
export function isDescendantOf(world: World, personId: EntityId, ancestorId: EntityId): boolean {
  let frontier = [personId]
  for (let depth = 0; depth < 12 && frontier.length > 0; depth++) {
    const next: EntityId[] = []
    for (const id of frontier) {
      const person = world.people.get(id)
      if (!person) continue
      if (person.parentIds.includes(ancestorId)) return true
      next.push(...person.parentIds)
    }
    frontier = next
  }
  return false
}
