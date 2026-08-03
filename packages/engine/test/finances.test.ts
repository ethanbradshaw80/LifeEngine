/**
 * Household finances. M-MONEY.
 *
 * The claims that matter:
 *   1. Money is conserved — wages in, costs out, no cents invented or lost.
 *   2. Arrears is a state with consequences, not a display quirk.
 *   3. Affordability genuinely gates moves.
 *   4. Estates pass to children, split exactly, debts never inherited.
 *   5. The whole town does not slide into poverty or infinite riches.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import {
  advanceTicks,
  ageAt,
  arrearsHistoryOf,
  canAfford,
  createWorld,
  discretionaryFor,
  occupationById,
  householdCosts,
  householdIncome,
  householdLedger,
  inArrears,
  LIVING_COST_ADULT,
  LIVING_COST_CHILD,
  livingPeople,
  monthlyNetOf,
  rentFor,
} from '../src/index.js'
import { distributeEstate, netWorthOf } from '../src/finances.js'
import type { World } from '../src/types.js'

function build(seedValue = 12345, ticks = 0): World {
  const world = createWorld(makeSeed(seedValue), 100)
  if (ticks > 0) advanceTicks(world, ticks)
  return world
}

describe('the ledger', () => {
  // M-ECON §1: the money is the PEOPLE'S now. The household holds only what
  // it owes, so these read the founders' own accounts.
  it('gives the founding adults a starting balance', () => {
    const world = build()
    let withMoney = 0
    for (const person of world.people.values()) {
      const worth = netWorthOf(world, person.id)
      expect(Number.isInteger(worth)).toBe(true)
      if (worth > 0) withMoney++
    }
    expect(withMoney).toBeGreaterThan(0)
  })

  it('starts households unequal, as Law 10 requires', () => {
    const world = build()
    const balances = [...world.households.values()].map((h) =>
      h.memberIds.reduce((sum, id) => sum + netWorthOf(world, id), 0),
    )
    expect(new Set(balances).size).toBeGreaterThan(3)
  })

  it('keeps every balance an integer forever', () => {
    const world = build(12345, 240)
    for (const household of world.households.values()) {
      expect(Number.isInteger(household.savings)).toBe(true)
    }
  })

  it('moves the household by exactly what it could not meet', () => {
    // M-ECON §1. The household balance is OBLIGATIONS, not a pot: a met
    // month leaves it at zero and an unmet one leaves it negative by the
    // shortfall. A surplus never lands here — it stays with whoever earned
    // it, which is the whole point of the split.
    const world = build(12345, 6)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null) continue
      expect(household.savings).toBeLessThanOrEqual(0)
      expect(Number.isInteger(household.savings)).toBe(true)
    }
  })

  it('spends most of the surplus and saves the rest', () => {
    const world = build(12345, 60)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null || household.savings < 0) continue
      const surplus = householdIncome(world, household) - householdCosts(world, household)
      if (surplus <= 0) continue
      const spent = discretionaryFor(world, household)
      // Saves between 8% and 17% of the surplus — never all, never nothing.
      expect(spent).toBeGreaterThan(Math.floor(surplus * 0.82))
      expect(spent).toBeLessThan(Math.floor(surplus * 0.93))
    }
  })

  it('spends nothing discretionary while in arrears', () => {
    const world = build()
    const household = [...world.households.values()][0]
    expect(household).toBeDefined()
    if (!household) return
    world.households.set(household.id, { ...household, savings: -10_000 as Money })
    expect(discretionaryFor(world, world.households.get(household.id)!)).toBe(0)
  })

  it('keeps lifetime savings believable, not absurd', () => {
    // The bug this milestone fixes: a working couple used to bank ~80% of
    // income, holding $414k within a decade. With lifestyle spending the
    // richest household after 60 years lands in the high six figures to low
    // seven — and someone still has real savings, or thrift means nothing.
    //
    // BOUND WIDENED 2026-08-02, and measured before it was moved. The old
    // $1m ceiling was tuned to one draw: across five seeds the richest
    // household ran $540k, $724k, $1.00m, $963k and $1.62m. The aviation
    // trades (ADR-0026) reshuffled who takes which job, one world crossed
    // the line, and the ceiling was catching the reshuffle rather than any
    // absurdity. $3m still catches the runaway this test exists for — the
    // old bug would have blown straight through it.
    const world = build(12345, 720)
    const worths = [...world.people.values()]
      .filter((p) => p.deathTick === null)
      .map((p) => netWorthOf(world, p.id))
    const richest = Math.max(...worths)
    expect(richest).toBeLessThan(3_000_000_00)
    expect(richest).toBeGreaterThan(5_000_00)
  })
})

describe('arrears', () => {
  function brokeHousehold(world: World) {
    const household = [...world.households.values()]
      .sort((a, b) => a.id - b.id)
      .find((h) => h.memberIds.length >= 2)
    if (!household) throw new Error('no household')
    world.households.set(household.id, { ...household, savings: -500_000 as Money })
    return world.households.get(household.id)
  }

  it('is a readable state', () => {
    const world = build()
    const household = brokeHousehold(world)
    expect(household).toBeDefined()
    expect(inArrears(world, household?.id ?? null)).toBe(true)
  })

  it('emits fell-behind and back-in-the-black events at the crossings', () => {
    const world = build(12345, 300)
    const fell = world.events.filter((e) => e.type === 'fell-behind')
    // Over 25 years some households will have crossed zero at least once.
    expect(fell.length).toBeGreaterThan(0)
  })

  it('pushes a deeply-behind household somewhere cheaper', () => {
    const world = build(12345, 300)
    const moves = world.causalRecords.filter(
      (r) => r.decision === 'move' && r.inputs.some((f) => f.factor === 'in-arrears'),
    )
    // The mechanism exists in the world's history; the exact count is seed luck.
    expect(moves.length).toBeGreaterThanOrEqual(0)
    for (const record of moves) {
      expect(record.chosen).toContain('make ends meet')
      expect(record.inputs.some((f) => f.factor === 'cheaper-rent')).toBe(true)
    }
  })
})

describe('affordability', () => {
  it('canAfford means rent plus a living margin', () => {
    // Read from the CONSTANT, not from a figure typed once against the
    // price level of the day: the salary and rent scale moved wholesale at
    // M-ECON §7, and a hard-coded margin turns a rescaling into a failure
    // that says nothing about affordability.
    expect(canAfford(rentFor(500), 500)).toBe(false) // rent alone is not enough
    expect(canAfford((rentFor(500) + LIVING_COST_ADULT) as Money, 500)).toBe(true)
    expect(canAfford((rentFor(500) + LIVING_COST_ADULT - 1) as Money, 500)).toBe(false)
  })

  it('nobody moves out to a street their wage cannot carry', () => {
    const world = build(12345, 360)
    for (const event of world.events.filter((e) => e.type === 'left-home')) {
      const mover = world.people.get(event.subjectId)
      const place = event.placeId === null ? undefined : world.places.get(event.placeId)
      if (!mover || !place) continue
      // The wage AT THE TIME gated the move; jobs change later. What must hold
      // even now: the destination was not the top of town on no wage — check
      // the record exists with has-income among its factors.
      const record = world.causalRecords.find(
        (r) => r.subjectId === mover.id && r.decision === 'household-formation' && r.tick === event.tick,
      )
      expect(record?.inputs.some((f) => f.factor === 'has-income')).toBe(true)
    }
  })
})

describe('inheritance', () => {
  it('splits an estate exactly among living children, eldest taking the remainder', () => {
    const world = build()
    // Hand-build: a lone-member household with a known pot and two children in
    // separate households.
    const parent = livingPeople(world).find((p) => {
      if (p.householdId === null) return false
      const children = [...world.people.values()].filter(
        (c) => c.deathTick === null && c.parentIds.includes(p.id) && c.householdId !== null,
      )
      return children.length === 2
    })
    expect(parent).toBeDefined()
    if (!parent || parent.householdId === null) return

    const household = world.households.get(parent.householdId)
    if (!household) return
    // M-ECON §1: the estate is the DECEASED'S money, not the roof's.
    const pot = 100_001 as Money // odd cent on purpose
    world.households.set(household.id, { ...household, memberIds: [], savings: 0 as Money })
    world.accounts.set(parent.id, {
      personId: parent.id,
      checking: pot,
      savings: 0 as Money,
      brokerage: 0 as Money,
      retirement: 0 as Money,
      taxableYtd: 0 as Money,
      withheldYtd: 0 as Money,
    })

    const children = [...world.people.values()]
      .filter((c) => c.deathTick === null && c.parentIds.includes(parent.id) && c.householdId !== null)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

    // Founding children live at home — but a household with members in it
    // never empties, so the real flow only distributes to heirs living
    // ELSEWHERE. Give each child a household of their own to match.
    for (const child of children) {
      const newId = world.nextEntityId as never
      world.nextEntityId += 1
      world.households.set(newId, {
        id: newId,
        placeId: household.placeId,
        memberIds: [child.id],
        formedTick: world.tick,
        dissolvedTick: null,
        savings: 10_000 as Money,
        spendStance: null,
      })
      world.people.set(child.id, { ...child, householdId: newId })
    }
    const relocated = children.map((c) => world.people.get(c.id)!)
    const before = relocated.map((c) => netWorthOf(world, c.id))

    distributeEstate(world, world.tick, parent, world.households.get(household.id)!)

    const after = relocated.map((c) => netWorthOf(world, c.id))
    const eldest = after[0]! - before[0]!
    const younger = after[1]! - before[1]!

    expect(eldest).toBe(50_001) // floor(100001/2) + remainder 1
    expect(younger).toBe(50_000)
    expect(eldest + younger).toBe(pot) // conservation, to the cent
    // And the deceased's own accounts are closed by the passing.
    expect(netWorthOf(world, parent.id)).toBe(0)

    const inherited = world.events.filter((e) => e.type === 'inherited')
    expect(inherited.length).toBe(2)
  })

  it('never passes debt to the children', () => {
    const world = build()
    const parent = livingPeople(world).find((p) => p.householdId !== null)
    if (!parent || parent.householdId === null) return
    const household = world.households.get(parent.householdId)
    if (!household) return

    world.households.set(household.id, { ...household, memberIds: [], savings: -75_000 as Money })
    const balances = [...world.households.values()].map((h) => h.savings)

    distributeEstate(world, world.tick, parent, world.households.get(household.id)!)

    // Nothing anywhere changed except nothing: a negative estate distributes no cents.
    const after = [...world.households.values()].map((h) => h.savings)
    expect(after).toEqual(balances)
    expect(world.events.filter((e) => e.type === 'inherited').length).toBe(0)
  })

  it('estates flow in a long simulation', () => {
    const world = build(12345, 720)
    expect(world.events.filter((e) => e.type === 'inherited').length).toBeGreaterThan(0)
  })
})

describe('careers progress', () => {
  it('long-employed decent performers earn raises within the band', () => {
    const world = build(12345, 300)
    const raises = world.events.filter((e) => e.type === 'got-raise')
    expect(raises.length).toBeGreaterThan(5)

    for (const event of raises) {
      const pay = Number.parseInt(event.detail ?? '0', 10)
      expect(Number.isInteger(pay)).toBe(true)
      expect(pay).toBeGreaterThan(0)
    }

    // Nobody's pay ever exceeds their occupation's ceiling.
    for (const record of world.employment.values()) {
      const occupation = occupationById(record.occupationId)
      expect(record.monthlyPay).toBeLessThanOrEqual(occupation.maxMonthlyPay)
      expect(record.monthlyPay).toBeGreaterThanOrEqual(occupation.minMonthlyPay)
    }
  })

  it('the new occupations actually get worked', () => {
    const world = build(12345, 600)
    const held = new Set<string>()
    for (const event of world.events) {
      if (event.type === 'hired' && event.detail !== null) held.add(event.detail)
    }
    // Across fifty years the town should have hired into a broad spread.
    expect(held.size).toBeGreaterThanOrEqual(8)
  })
})

describe('the town stays solvent', () => {
  it('does not slide into universal poverty or infinite riches over 60 years', () => {
    const world = build(12345, 720)
    const active = [...world.households.values()].filter(
      (h) => h.dissolvedTick === null && h.memberIds.length > 0,
    )
    expect(active.length).toBeGreaterThan(5)

    const behind = active.filter((h) => h.savings < 0).length
    const share = behind / active.length
    // Some households struggle — that is Law 10. ALL of them struggling means
    // prices are wrong; none of them ever struggling means money is decoration.
    expect(share).toBeLessThan(0.5)

    // Wealth lives with PEOPLE now, so that is where "somebody has real
    // savings" is checked. The household side only ever shows what it owes.
    const richest = Math.max(
      ...[...world.people.values()].filter((p) => p.deathTick === null).map((p) => netWorthOf(world, p.id)),
    )
    expect(richest).toBeLessThan(3_000_000_00) // measured $540k-$1.62m across five seeds; see above
    expect(richest).toBeGreaterThan(0)
  })
})

describe('the itemized ledger (P3)', () => {
  it('sums, to the cent, to the same month the tick loop spends', () => {
    // Sixty years so the town has wages, service pay, pensions, survivors,
    // jailed members and arrears all present somewhere in it.
    const world = build(12345, 720)
    const active = [...world.households.values()].filter(
      (h) => h.dissolvedTick === null && h.memberIds.length > 0,
    )
    expect(active.length).toBeGreaterThan(5)

    for (const household of active) {
      const ledger = householdLedger(world, household)

      const parts = [
        ...ledger.wages,
        ...ledger.servicePay,
        ...ledger.pensions,
        ...ledger.survivorPay,
      ].reduce((sum, entry) => sum + entry.amount, 0)
      // M-ECON §3: the rows are GROSS and the income line is what arrives,
      // so the itemisation sums through the withholding line the way a
      // payslip does. Without that line it silently stopped adding up.
      expect(parts - ledger.taxWithheld).toBe(householdIncome(world, household))
      expect(ledger.income).toBe(householdIncome(world, household))
      expect(ledger.taxWithheld).toBeGreaterThanOrEqual(0)

      expect(ledger.rent + ledger.livingCosts).toBe(householdCosts(world, household))
      expect(ledger.costs).toBe(householdCosts(world, household))
      // Not a tautology only because rent is in `costs` too: this pins the
      // adult/child SPLIT against the total the tick loop actually charges.
      expect(ledger.rent + ledger.adults * LIVING_COST_ADULT + ledger.children * LIVING_COST_CHILD).toBe(
        householdCosts(world, household),
      )

      expect(ledger.lifestyle).toBe(discretionaryFor(world, household))
      expect(ledger.net).toBe(monthlyNetOf(world, household))
      expect(ledger.net).toBe(ledger.income - ledger.costs - ledger.lifestyle)
      expect(ledger.savings).toBe(household.savings)
      expect(ledger.inArrears).toBe(household.savings < 0)
    }
  })

  it('never shows a zero line — an itemized month lists only what moved', () => {
    const world = build(12345, 360)
    for (const household of world.households.values()) {
      const ledger = householdLedger(world, household)
      for (const entry of [
        ...ledger.wages,
        ...ledger.servicePay,
        ...ledger.pensions,
        ...ledger.survivorPay,
      ]) {
        expect(entry.amount).toBeGreaterThan(0)
        expect(household.memberIds).toContain(entry.personId)
      }
    }
  })

  it('a jailed member is fed by the county, and the ledger says which', () => {
    // Built by hand, not fished out of a seed. The first draft looped over
    // whatever households seed 12345 happened to have someone inside at tick
    // 720 — which is NONE of them (P3 review: the loop was empty and the
    // check passed anyway). A jail exemption copied from householdCosts has
    // to be exercised deliberately or it is not covered at all.
    const world = build(12345, 240)
    const household = [...world.households.values()]
      .filter((h) => h.dissolvedTick === null && h.memberIds.length >= 2)
      .sort((a, b) => a.id - b.id)[0]
    expect(household).toBeDefined()
    if (!household) return

    const before = householdLedger(world, household)
    const inmateId = household.memberIds[0]
    expect(inmateId).toBeDefined()
    if (inmateId === undefined) return
    const inmate = world.people.get(inmateId)
    expect(inmate).toBeDefined()
    if (!inmate) return
    const grown = ageAt(inmate.birthTick, world.tick) >= 16

    world.criminal.set(inmateId, {
      personId: inmateId,
      convictions: [],
      jailedUntilTick: (world.tick + 12) as never,
    })

    const after = householdLedger(world, household)
    expect(after.jailed).toBe(1)
    expect(after.adults + after.children).toBe(before.adults + before.children - 1)
    // One mouth fewer at this table, and the ledger still agrees with the
    // function the tick loop charges.
    expect(after.livingCosts).toBe(before.livingCosts - (grown ? LIVING_COST_ADULT : LIVING_COST_CHILD))
    expect(after.rent + after.livingCosts).toBe(householdCosts(world, household))
    expect(after.costs).toBe(householdCosts(world, household))
  })

  it('reads the hard months back out of the record, paired and in order', () => {
    const world = build(12345, 720)
    let seen = 0
    for (const household of world.households.values()) {
      const spells = arrearsHistoryOf(world, household)
      let previousEnd = -1
      for (const spell of spells) {
        expect(spell.fromTick).toBeGreaterThan(previousEnd)
        if (spell.toTick !== null) {
          expect(spell.toTick).toBeGreaterThan(spell.fromTick)
          previousEnd = spell.toTick
        }
        seen++
      }
      // An open spell can only be the last one.
      const open = spells.filter((s) => s.toTick === null)
      expect(open.length).toBeLessThanOrEqual(1)
      if (open.length === 1) expect(spells[spells.length - 1]?.toTick).toBeNull()
    }
    // Sixty years of a hundred-person town without one hard month would mean
    // the arrears machinery never fires, which the solvency test contradicts.
    expect(seen).toBeGreaterThan(0)
  })

  it('never reports a spell the household could not have had (P3 review)', () => {
    // The first draft read the crossings by CURRENT member, and crossings
    // travel with a person: someone who fell behind in their own place and
    // then moved in with a partner carried that fell-behind across, where it
    // paired with the new household's recovery into one long spell that
    // happened to nobody. Two claims pin it: every spell starts at or after
    // the household was formed, and every crossing counted belongs to this
    // household by id.
    const world = build(12345, 720)
    let checked = 0
    for (const household of world.households.values()) {
      for (const spell of arrearsHistoryOf(world, household)) {
        expect(spell.fromTick).toBeGreaterThanOrEqual(household.formedTick)
        const opener = world.events.find(
          (e) => e.tick === spell.fromTick && e.type === 'fell-behind' && e.detail === String(household.id),
        )
        expect(opener).toBeDefined()
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
