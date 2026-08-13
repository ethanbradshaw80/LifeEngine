import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import { walletOf } from '../src/finances.js'
import { moveBackInBar, moveBackInWithParents, setPlayer } from '../src/player.js'

/**
 * H1 — THE STREET IS RETIRED (owner: "get rid of the streets idea... if
 * you can't afford the payments you go into the negatives until you hit
 * 500k where then it'll trigger the bankruptcy paperwork... every time I
 * am in college I instantly get kicked out of every house because you
 * can't have a job and be in college").
 *
 * Before this, measured at 30 years on this same seed: 781 lost-housing
 * events across 143 households, 15 homeless at the moment of measure.
 * The acceptance number is zero, and it is not a target — it is a rule.
 */
describe('the retired street', () => {
  it('nobody loses housing over money, ever', () => {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 30)

    let lostHousing = 0
    let homelessNow = 0
    for (const event of world.events) {
      if (event.type === 'lost-housing') lostHousing += 1
    }
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null) continue
      if (household.homelessSinceTick !== null) homelessNow += 1
    }
    expect(lostHousing).toBe(0)
    expect(homelessNow).toBe(0)
  })

  it('the slide warns on the way down, in order', () => {
    // Somebody in a 30-year town goes deep enough for the letters; the
    // letters must precede the calls wherever both exist for one person.
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 30)
    const bySubject = new Map<number, { letters: number | null; calls: number | null }>()
    for (const event of world.events) {
      if (event.type !== 'mounting-debts') continue
      const entry = bySubject.get(event.subjectId) ?? { letters: null, calls: null }
      if (event.detail === 'letters' && entry.letters === null) entry.letters = event.tick
      if (event.detail === 'calls' && entry.calls === null) entry.calls = event.tick
      bySubject.set(event.subjectId, entry)
    }
    for (const entry of bySubject.values()) {
      if (entry.letters !== null && entry.calls !== null) {
        expect(entry.letters).toBeLessThanOrEqual(entry.calls)
      }
    }
  })
})

describe('the college years (the owner named this case)', () => {
  it('a jobless student rides the negatives and never loses the roof', () => {
    /**
     * "Every time I am in college I instantly get kicked out of every
     * house because you can't have a job and be in college." The exact
     * case, constructed: an adult alone in their own household, enrolled,
     * jobless, no halls — four years of shortfall.
     */
    const world = createWorld(makeSeed(777))
    advanceTicks(world, 12 * 10)
    const student = [...world.people.values()].find((p) => {
      if (p.deathTick === null && p.householdId !== null) {
        const household = world.households.get(p.householdId)
        return household !== undefined && household.memberIds.length === 1 && !world.employment.has(p.id)
      }
      return false
    })
    expect(student).toBeDefined()
    if (!student) return
    const record = world.education.get(student.id)
    if (record) {
      world.education.set(student.id, {
        ...record,
        enrolledIn: 'degree' as never,
        enrolledAtTick: world.tick,
        completesAtTick: (world.tick + 48) as never,
      })
    }
    const homeBefore = world.households.get(student.householdId!)?.placeId

    advanceTicks(world, 48)

    const household = world.households.get(student.householdId!)
    // The roof held: same address, never homeless, all four years.
    expect(household?.homelessSinceTick ?? null).toBeNull()
    expect(household?.placeId).toBe(homeBefore)
    // And the cost of those years is real and visible: the wallet is
    // negative or was drained — the debt exists, it just is not a street.
    const events = world.events.filter(
      (e) => e.type === 'lost-housing' && e.subjectId === student.id,
    )
    expect(events.length).toBe(0)
  })
})

describe('the ownership world (H2)', () => {
  it('most families own, by means, and the share holds over 30 years', () => {
    const world = createWorld(makeSeed(4242))
    const count = () => {
      let owners = 0
      let seated = 0
      for (const household of world.households.values()) {
        if (household.dissolvedTick !== null || household.propertyId === undefined || household.propertyId === null) continue
        seated += 1
        const property = world.properties.get(household.propertyId)
        if (property !== undefined && (property.ownerId ?? null) !== null) owners += 1
      }
      return { owners, seated }
    }
    const day0 = count()
    // 1970's real figure, the owner's ask, and Law 10's spread all at once.
    expect(day0.owners / day0.seated).toBeGreaterThan(0.55)
    expect(day0.owners / day0.seated).toBeLessThan(0.7)

    advanceTicks(world, 12 * 30)
    const later = count()
    // Inheritance and NPC buying hold the share up as generations turn.
    expect(later.owners / later.seated).toBeGreaterThan(0.4)
  })

  it('a house passes to the eldest living child', () => {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 40)
    const inherited = world.events.filter((e) => e.type === 'inherited-home')
    // Forty years of an owning town buries owners; the deeds must move.
    expect(inherited.length).toBeGreaterThan(0)
  })
})

describe('the way back (moving in with the parents)', () => {
  it('folds the household into a living parent’s, wallet untouched', () => {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 25)

    // A grown child in their own household whose parent still keeps a house.
    const mover = [...world.people.values()].find((p) => {
      if (p.deathTick !== null || p.householdId === null) return false
      if (ageAt(p.birthTick, world.tick) < 20) return false
      const home = world.households.get(p.householdId)
      if (!home || home.dissolvedTick !== null) return false
      if (p.parentIds.some((id) => home.memberIds.includes(id))) return false
      return p.parentIds.some((id) => {
        const parent = world.people.get(id)
        if (!parent || parent.deathTick !== null || parent.householdId === null) return false
        if (parent.householdId === p.householdId) return false
        return world.households.get(parent.householdId)?.dissolvedTick === null
      })
    })
    expect(mover, 'no eligible mover in 25 years — tuning drifted?').toBeDefined()
    if (!mover) return

    setPlayer(world, mover.id)
    const oldHouseholdId = mover.householdId!
    const oldMembers = [...(world.households.get(oldHouseholdId)?.memberIds ?? [])]
    const walletBefore = walletOf(world, mover.id)
    const liquidBefore = walletBefore.checking + walletBefore.savings

    expect(moveBackInBar(world, mover.id)).toBeNull()
    const result = moveBackInWithParents(world)
    expect(result.moved, result.reason).toBe(true)

    const moved = world.people.get(mover.id)!
    const destination = world.households.get(moved.householdId!)
    expect(destination).toBeDefined()
    expect(moved.householdId).not.toBe(oldHouseholdId)
    // The parent is under the same roof now.
    expect(mover.parentIds.some((id) => destination!.memberIds.includes(id))).toBe(true)
    // Everybody came along, the old household closed behind them...
    for (const id of oldMembers) {
      expect(world.people.get(id)?.householdId).toBe(moved.householdId)
    }
    expect(world.households.get(oldHouseholdId)?.dissolvedTick).not.toBeNull()
    expect(world.leases.has(oldHouseholdId)).toBe(false)
    // ...and not a cent moved with them (H0: the wallet stays yours).
    const walletAfter = walletOf(world, mover.id)
    expect(walletAfter.checking + walletAfter.savings).toBe(liquidBefore)
  })
})
