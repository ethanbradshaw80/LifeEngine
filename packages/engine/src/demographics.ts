/**
 * Demographics — read-side queries over people and events (D1).
 *
 * This module MEASURES the town; it never steers it. No draws, no writes,
 * no new state: population history is reconstructed from birthTick/deathTick
 * (people are never deleted — Law 6), flows are counted from the event log,
 * and the partnering funnel is read off the live relationship graph. That
 * makes every number here explainable by pointing at the records behind it,
 * which is the whole point: the owner asked why the town grows slowly, and
 * "here is the funnel, stage by stage" is the only honest answer format.
 *
 * Everything returns integer counts (callers divide where they want rates),
 * except median ages, which are whole years.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { TICKS_PER_YEAR } from '@life-engine/shared'
import { ageAt, START_YEAR, toDate } from './clock.js'
import type { World } from './types.js'

/** The fertility window systems.ts rolls against (kept in step by a test). */
export const FERTILITY_MIN_AGE = 20
export const FERTILITY_MAX_AGE = 42

export interface YearDemographics {
  readonly year: number
  /** Living people at the end of the year (or now, for the current year). */
  readonly population: number
  readonly births: number
  readonly deaths: number
  /** Couples wed this year (one event per wedding, not per spouse). */
  readonly marriages: number
  readonly divorces: number
  readonly widowings: number
  readonly courtshipsBegun: number
}

interface YearFlow {
  births: number
  deaths: number
  marriages: number
  divorces: number
  widowings: number
  courtships: number
}

/** One row per simulated year, oldest first. */
export function yearlyDemographics(world: World): YearDemographics[] {
  const flows = new Map<number, YearFlow>()
  const flowOf = (year: number): YearFlow => {
    let entry = flows.get(year)
    if (!entry) {
      entry = { births: 0, deaths: 0, marriages: 0, divorces: 0, widowings: 0, courtships: 0 }
      flows.set(year, entry)
    }
    return entry
  }

  for (const event of world.events) {
    const year = toDate(event.tick).year
    switch (event.type) {
      case 'born':
        flowOf(year).births++
        break
      case 'died':
        flowOf(year).deaths++
        break
      case 'married':
        flowOf(year).marriages++
        break
      case 'divorced':
        flowOf(year).divorces++
        break
      case 'widowed':
        flowOf(year).widowings++
        break
      case 'started-courting':
        flowOf(year).courtships++
        break
      default:
        break
    }
  }

  // Year-end stocks by prefix sum rather than a per-year scan of everyone
  // who ever lived — O(P + Y), not O(P × Y) (review D1-6). Year precision
  // equals tick precision here because stocks are read at each December.
  const lastYear = toDate(world.tick).year
  let base = 0 // alive before the record began (founders)
  const bornInYear = new Map<number, number>()
  const diedInYear = new Map<number, number>()
  for (const person of world.people.values()) {
    const bornYear = toDate(person.birthTick).year
    if (bornYear < START_YEAR) base++
    else bornInYear.set(bornYear, (bornInYear.get(bornYear) ?? 0) + 1)
    if (person.deathTick !== null) {
      const diedYear = toDate(person.deathTick).year
      diedInYear.set(diedYear, (diedInYear.get(diedYear) ?? 0) + 1)
    }
  }

  const rows: YearDemographics[] = []
  let population = base
  for (let year = START_YEAR; year <= lastYear; year++) {
    population += (bornInYear.get(year) ?? 0) - (diedInYear.get(year) ?? 0)
    const flow = flows.get(year)
    rows.push({
      year,
      population,
      births: flow?.births ?? 0,
      deaths: flow?.deaths ?? 0,
      marriages: flow?.marriages ?? 0,
      divorces: flow?.divorces ?? 0,
      widowings: flow?.widowings ?? 0,
      courtshipsBegun: flow?.courtships ?? 0,
    })
  }
  return rows
}

/** Living people at a given tick, reconstructed — never stored. */
export function populationAt(world: World, tick: Tick): number {
  let count = 0
  for (const person of world.people.values()) {
    if (person.birthTick > tick) continue
    if (person.deathTick !== null && person.deathTick <= tick) continue
    count++
  }
  return count
}

/**
 * The partnering funnel as it stands NOW — each stage a count, so the UI
 * (and the audit) can say where single adults actually are in the pipeline
 * instead of guessing. The 18-45 window is the prime partnering span;
 * counts are people (not couples).
 */
export interface PartneringFunnel {
  /** Living adults 18-45. */
  readonly adults: number
  /** Of those, in a courtship today. */
  readonly courtingNow: number
  /** Of those, married today. */
  readonly marriedNow: number
  /** Of those, alone today. */
  readonly singleNow: number
  /** Of the single: never once courted or married in their whole life. */
  readonly neverPartnered: number
  /** Living people of ANY age whose marriage ended (widowed or divorced)
   *  and who have no partner today — the pool remarriage would draw from. */
  readonly formerlyPartneredAlone: number
  /** Weddings on record where a party had been widowed or divorced. */
  readonly remarriagesEver: number
}

export function partneringFunnel(world: World): PartneringFunnel {
  // Pass 1 — the log, in order. The pass is deliberately order-DEPENDENT:
  // a wedding is a remarriage only when the widowing or divorce appears
  // EARLIER in the log, which append-order (events are recorded as they
  // happen) guarantees. 'divorced' is one event per couple carrying both
  // ids — both ex-spouses enter the pool (review D1-2).
  const everBroken = new Set<EntityId>()
  const everPartneredByEvent = new Set<EntityId>()
  let remarriages = 0
  for (const event of world.events) {
    if (event.type === 'married') {
      if (everBroken.has(event.subjectId) || (event.otherId !== null && everBroken.has(event.otherId))) {
        remarriages++
      }
    }
    if (event.type === 'married' || event.type === 'started-courting') {
      everPartneredByEvent.add(event.subjectId)
      if (event.otherId !== null) everPartneredByEvent.add(event.otherId)
    }
    if (event.type === 'widowed' || event.type === 'divorced') {
      everBroken.add(event.subjectId)
      if (event.type === 'divorced' && event.otherId !== null) everBroken.add(event.otherId)
    }
  }

  // Pass 2 — the graph. Founding couples were married BEFORE the record
  // (worldgen writes the spouse edge with no wedding event), so "ever
  // partnered" must also read edges: spouse, courting, and the
  // former-spouse edges that persist forever (review D1-3). The same pass
  // builds a partner map so the person loop never re-sorts the graph
  // (review D1-4).
  const partnerType = new Map<EntityId, 'courting' | 'spouse'>()
  const everPartnered = new Set<EntityId>(everPartneredByEvent)
  for (const relationship of world.relationships.values()) {
    if (relationship.type === 'friend') continue
    everPartnered.add(relationship.a)
    everPartnered.add(relationship.b)
    if (relationship.type === 'courting' || relationship.type === 'spouse') {
      partnerType.set(relationship.a, relationship.type)
      partnerType.set(relationship.b, relationship.type)
    }
  }
  // You cannot lose a partnership you never had: broken ⊆ ever-partnered,
  // by construction, so neverPartnered and formerlyPartneredAlone are
  // disjoint even for founder widows.
  for (const id of everBroken) everPartnered.add(id)

  let adults = 0
  let courting = 0
  let married = 0
  let single = 0
  let never = 0
  let formerlyAlone = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    const current = partnerType.get(person.id)
    if (current === undefined && everBroken.has(person.id)) formerlyAlone++

    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 45) continue
    adults++
    if (current === undefined) {
      single++
      if (!everPartnered.has(person.id)) never++
    } else if (current === 'spouse') {
      married++
    } else {
      courting++
    }
  }

  return {
    adults,
    courtingNow: courting,
    marriedNow: married,
    singleNow: single,
    neverPartnered: never,
    formerlyPartneredAlone: formerlyAlone,
    remarriagesEver: remarriages,
  }
}

/**
 * Completed-fertility cohort: women who lived the WHOLE childbearing window
 * (20-42) INSIDE recorded history — it must both start after tick 0 and end
 * before now. The start bound matters as much as the end: founder women
 * whose window predates the record carry children worldgen never recorded
 * (only co-resident minors are generated), and counting them as childless
 * would poison the number D2 tunes against (review D1-1). The only honest
 * measure of family size — young mothers mid-window undercount by
 * construction, pre-record grandmothers undercount by omission.
 */
export interface FertilityCohort {
  readonly completedWomen: number
  readonly totalChildren: number
  readonly childlessWomen: number
  /** Whole years; null when the cohort is empty. */
  readonly medianAgeAtFirstChild: number | null
  /** Whole years, both spouses counted; null when nobody married. */
  readonly medianAgeAtMarriage: number | null
}

export function fertilityCohort(world: World): FertilityCohort {
  const childCount = new Map<EntityId, number>()
  const firstChildTick = new Map<EntityId, Tick>()
  for (const person of world.people.values()) {
    for (const parentId of person.parentIds) {
      childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1)
      const earliest = firstChildTick.get(parentId)
      if (earliest === undefined || person.birthTick < earliest) {
        firstChildTick.set(parentId, person.birthTick)
      }
    }
  }

  let completed = 0
  let children = 0
  let childless = 0
  const firstChildAges: number[] = []
  for (const person of world.people.values()) {
    if (person.sex !== 'female') continue
    const windowStart = person.birthTick + FERTILITY_MIN_AGE * TICKS_PER_YEAR
    if (windowStart < 0) continue // already fertile when the record began
    const windowEnd = person.birthTick + (FERTILITY_MAX_AGE + 1) * TICKS_PER_YEAR
    if (windowEnd > world.tick) continue // window not finished yet
    if (person.deathTick !== null && person.deathTick < windowEnd) continue // died inside it
    completed++
    const count = childCount.get(person.id) ?? 0
    children += count
    if (count === 0) childless++
    const first = firstChildTick.get(person.id)
    if (first !== undefined) firstChildAges.push(ageAt(person.birthTick, first))
  }

  const marriageAges: number[] = []
  for (const event of world.events) {
    if (event.type !== 'married') continue
    const a = world.people.get(event.subjectId)
    const b = event.otherId !== null ? world.people.get(event.otherId) : undefined
    if (a) marriageAges.push(ageAt(a.birthTick, event.tick))
    if (b) marriageAges.push(ageAt(b.birthTick, event.tick))
  }

  return {
    completedWomen: completed,
    totalChildren: children,
    childlessWomen: childless,
    medianAgeAtFirstChild: median(firstChildAges),
    medianAgeAtMarriage: median(marriageAges),
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // Even lengths round down to a whole year rather than inventing halves.
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : Math.floor(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2)
}
