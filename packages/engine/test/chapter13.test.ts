import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import { accountsOf, fileBankruptcy, payOffPlan } from '../src/finances.js'
import { planPayoffFor, openFilingOf } from '../src/bankruptcy.js'

/**
 * THE DISCHARGE MUST ACTUALLY DISCHARGE.
 *
 * A live player, on itch: "There is no way to pay off your chapter 13 debt,
 * every time I click payoff amount it pays like a percentage and just keeps
 * the rest of the debt causing the player to fall into a constant cycle of
 * switching street."
 *
 * He was right, twice over. Chapter 13 never touched `accounts.loans` at
 * any point in its lifecycle — the `discharged` figure was bookkeeping the
 * life story printed while the loans sat in the accounts — and during the
 * plan, `serviceDebts` went on collecting those same loans monthly ON TOP
 * of the plan payment. A filer paid twice, then kept the debt.
 */
describe('chapter 13', () => {
  /** A grown person with a consumer loan, a student loan, and a filing. */
  function filer() {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12 * 30)
    const person = [...world.people.values()].find(
      (p) => p.deathTick === null && ageAt(p.birthTick, world.tick) >= 25 && p.householdId !== null,
    )
    expect(person).toBeDefined()
    if (!person) throw new Error('unreachable')

    const accounts = accountsOf(world, person.id)
    const setAccountsVia = {
      ...accounts,
      checking: 500_000 as Money,
      savings: 100_000 as Money,
      loans: [
        {
          kind: 'personal' as const,
          balance: 900_000 as Money,
          ratePerMille: 120,
          monthlyPayment: 20_000 as Money,
          missedMonths: 0,
          openedAtTick: world.tick as Tick,
        },
        {
          kind: 'student' as const,
          balance: 1_200_000 as Money,
          ratePerMille: 50,
          monthlyPayment: 10_000 as Money,
          missedMonths: 0,
          openedAtTick: world.tick as Tick,
        },
      ],
    }
    world.accounts.set(person.id, setAccountsVia as never)
    const filing = fileBankruptcy(world, world.tick, person.id, 13)
    expect(filing).toBeDefined()
    return { world, personId: person.id }
  }

  it('the early payoff clears every loan the plan consolidated', () => {
    const { world, personId } = filer()
    const filing = openFilingOf(world, personId)
    expect(filing).toBeDefined()

    // Fund the settle and pay it off.
    const accounts = accountsOf(world, personId)
    const due = planPayoffFor(filing, world.tick)
    world.accounts.set(personId, {
      ...accounts,
      checking: (due + 100_000) as Money,
    } as never)

    expect(payOffPlan(world, world.tick, personId)).toBe(true)

    // THE CLAIM THAT FAILED ON THE OLD CODE: the consumer loan is GONE.
    const after = accountsOf(world, personId)
    expect(after.loans.some((l) => l.kind === 'personal')).toBe(false)
    // AND THE RULING HOLDS: the student loan survives every bankruptcy in
    // this game — that is documented design, not an oversight.
    expect(after.loans.some((l) => l.kind === 'student')).toBe(true)
  })

  it('the stay freezes planned debts — no double collection, no growth', () => {
    const { world, personId } = filer()
    const before = accountsOf(world, personId)
    const personalBefore = before.loans.find((l) => l.kind === 'personal')
    expect(personalBefore).toBeDefined()

    // Months pass under the plan. The old code collected the personal
    // loan every one of these months on top of the plan payment, and
    // grew it with interest besides.
    advanceTicks(world, 6)

    const after = accountsOf(world, personId)
    const personalAfter = after.loans.find((l) => l.kind === 'personal')
    // Still open (the plan is running, discharge has not happened) —
    // unless the plan already completed, which six months cannot do.
    expect(openFilingOf(world, personId)).toBeDefined()
    expect(personalAfter).toBeDefined()
    // FROZEN. Not collected, not compounding, no missed-month marks —
    // its balance is a number nobody will ever be asked for.
    expect(personalAfter?.balance).toBe(personalBefore?.balance)
    expect(personalAfter?.missedMonths).toBe(0)
  })

  it('a served term clears the loans the same way the settle does', () => {
    const { world, personId } = filer()
    const filing = openFilingOf(world, personId)
    expect(filing).toBeDefined()
    if (!filing || filing.planEndsAtTick === null) return

    // Keep the filer solvent enough that the plan is never dismissed for
    // missed payments, and serve the whole term.
    const months = filing.planEndsAtTick - world.tick
    for (let i = 0; i < months + 2; i += 1) {
      const accounts = accountsOf(world, personId)
      if (accounts.checking < 100_000) {
        world.accounts.set(personId, { ...accounts, checking: 500_000 as Money } as never)
      }
      advanceTicks(world, 1)
    }

    const closed = (world.bankruptcies.get(personId) ?? []).find((f) => f.chapter === 13)
    expect(closed?.dischargedAtTick).not.toBeNull()
    // The two discharge sites share one writer, so this must match the
    // early-payoff behaviour exactly.
    const after = accountsOf(world, personId)
    expect(after.loans.some((l) => l.kind === 'personal')).toBe(false)
    expect(after.loans.some((l) => l.kind === 'student')).toBe(true)
  })
})
