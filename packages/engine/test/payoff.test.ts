/**
 * ADR-0038 (owner: "there is still no way to payoff your bankruptcy").
 *
 * Two gaps, not one. A chapter 13 plan was invisible — nothing on any
 * screen said what the payment was or how long it had to run — and there
 * was no way to end it early however much money you had.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId, Money } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { createWorld } from '../src/index.js'
import {
  openFilingOf,
  planMonthsLeft,
  planPayoffBar,
  planPayoffFor,
} from '../src/bankruptcy.js'
import { accountsOf, fileBankruptcy, payOffPlan, walletOf } from '../src/finances.js'
import { payOffBankruptcyPlayer, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

/**
 * Somebody deep enough in debt that the court will take the filing.
 *
 * H0: arrears are a NEGATIVE BALANCE on the household head's wallet now,
 * not a number on the building — so the hole is dug on the head's wallet
 * record, and the filer IS that record's holder so every read and write in
 * the machinery lands on the same ledger. The `cash` for settling a plan
 * is granted by `fund()` AFTER filing, because filing folds the negative
 * into the plan and cash sitting in the same wallet beforehand would just
 * cancel the arrears the fixture exists to create.
 */
function aFiler(seed: number, cash: number): { world: World; personId: EntityId; cash: number } {
  const world = createWorld(makeSeed(seed), 100)
  const adult = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 25 && ageAt(p.birthTick, world.tick) <= 50)
    .sort((a, b) => a.id - b.id)[0]
  if (!adult) throw new Error('no adult in town')
  const household = world.households.get(adult.householdId!)
  if (!household) throw new Error('no household')
  const head = household.memberIds
    .map((id) => world.people.get(id))
    .filter((p) => p !== undefined && p.deathTick === null)
    .sort((a, b) => a!.birthTick - b!.birthTick || a!.id - b!.id)[0]
  if (!head) throw new Error('an empty household')
  const wallet = walletOf(world, head.id)
  const person = world.people.get(wallet.personId)
  if (!person) throw new Error('no wallet holder')
  setPlayer(world, person.id)
  // A real hole to climb out of.
  world.accounts.set(person.id, { ...wallet, checking: -4_000_000 as Money, savings: 0 as Money })
  // AND A WAGE. Without one the plan payment floors at a penny a month and
  // the whole plan settles for 36 cents, which is not a test of anything.
  // In play this cannot happen: chaptersOpenTo only offers chapter 13 to
  // somebody with disposable income.
  world.employment.set(person.id, {
    personId: person.id,
    occupationId: 'clerk',
    workplaceId: [...world.places.values()].find((pl) => pl.kind === 'workplace')?.id ?? 1,
    monthlyPay: 400_000 as Money,
    startedAtTick: 0,
    performance: 600,
    trackId: null,
    rungSinceTick: 0,
  } as never)
  return { world, personId: person.id, cash }
}

/** Grant the settle money — used AFTER filing, see aFiler's doc. */
function fund(world: World, personId: EntityId, cash: number): void {
  if (cash <= 0) return
  const accounts = accountsOf(world, personId)
  world.accounts.set(personId, { ...accounts, savings: (accounts.savings + cash) as Money })
}

describe('a plan you can see', () => {
  it('reports the payment, the months left, and what settling costs', () => {
    const { world, personId } = aFiler(4141, 0)
    const filing = fileBankruptcy(world, world.tick, personId, 13)
    expect(filing?.chapter).toBe(13)
    expect(filing?.planMonthly).toBeGreaterThan(0)

    const open = openFilingOf(world, personId)
    const months = planMonthsLeft(open, world.tick)
    expect(months).toBeGreaterThan(0)
    // Settling costs every payment still to come — the plan base, not the
    // original debt, because the months already paid were paid.
    expect(planPayoffFor(open, world.tick)).toBe((open?.planMonthly ?? 0) * months)
  })

  it('says what it would cost rather than greying out in silence', () => {
    const { world, personId } = aFiler(4141, 0)
    fileBankruptcy(world, world.tick, personId, 13)
    const bar = planPayoffBar(openFilingOf(world, personId), 100 as Money, world.tick)
    expect(bar).not.toBeNull()
    expect(bar).toContain('dollars')
  })

  it('tells a chapter 7 filer there is nothing to pay off', () => {
    // Chapter 7 discharges at filing. A greyed button with no reason beside
    // it would read as a bug rather than as the truth.
    const { world, personId } = aFiler(4141, 0)
    fileBankruptcy(world, world.tick, personId, 7)
    const filing = world.bankruptcies.get(personId)?.[0]
    const bar = planPayoffBar(filing, 100_000_000 as Money, world.tick)
    expect(bar).toContain('Chapter 7')
  })
})

describe('a plan you can pay off', () => {
  it('takes the money, closes the filing, and stops the payments', () => {
    const { world, personId, cash } = aFiler(4141, 100_000_000)
    fileBankruptcy(world, world.tick, personId, 13)
    fund(world, personId, cash)
    const open = openFilingOf(world, personId)
    const due = planPayoffFor(open, world.tick)
    const before = accountsOf(world, personId)

    expect(planPayoffBar(open, (before.checking + before.savings) as Money, world.tick)).toBeNull()
    expect(payOffPlan(world, world.tick, personId)).toBe(true)

    const after = accountsOf(world, personId)
    expect(after.checking + after.savings).toBe(before.checking + before.savings - due)
    // The plan is done, so nothing is open any more.
    expect(openFilingOf(world, personId)).toBeUndefined()
    expect(world.events.some((e) => e.type === 'plan-completed' && e.subjectId === personId)).toBe(true)
    expect(world.events.some((e) => e.type === 'debt-discharged' && e.subjectId === personId)).toBe(true)
  })

  it('leaves the filing on the record — money does not buy a clean history', () => {
    const { world, personId, cash } = aFiler(4141, 100_000_000)
    fileBankruptcy(world, world.tick, personId, 13)
    fund(world, personId, cash)
    payOffPlan(world, world.tick, personId)
    const filings = world.bankruptcies.get(personId) ?? []
    expect(filings.length).toBe(1)
    expect(filings[0]?.dischargedAtTick).not.toBeNull()
  })

  it('refuses, in the bar’s own words, when the money is not there', () => {
    const { world, personId, cash } = aFiler(4141, 1_000)
    fileBankruptcy(world, world.tick, personId, 13)
    fund(world, personId, cash)
    const result = payOffBankruptcyPlayer(world)
    expect(result.done).toBe(false)
    expect(result.reason).toContain('dollars')
    expect(openFilingOf(world, personId)).toBeDefined()
  })

  it('goes through the player verb too, and logs it', () => {
    const { world, personId, cash } = aFiler(4141, 100_000_000)
    fileBankruptcy(world, world.tick, personId, 13)
    fund(world, personId, cash)
    expect(payOffBankruptcyPlayer(world).done).toBe(true)
    expect(openFilingOf(world, personId)).toBeUndefined()
    expect(world.player.log.some((e) => e.kind === 'pay-off-plan')).toBe(true)
  })
})

describe('what the plan actually wrote off', () => {
  it('credits every month of a long plan, not a flat thirty-six', () => {
    // THE BUG THIS PINS. The discharge figure used PLAN_MONTHS_MIN for
    // every plan, but a plan runs 36 to 60 months. A sixty-month plan
    // credited the filer with 36 months of payments they had made 60 of,
    // and the life story reported a bigger write-off than really happened.
    const { world, personId, cash } = aFiler(4141, 100_000_000)
    const filing = fileBankruptcy(world, world.tick, personId, 13)
    if (!filing || filing.planEndsAtTick === null) throw new Error('no plan')
    const months = filing.planEndsAtTick - filing.filedAtTick

    fund(world, personId, cash)
    payOffPlan(world, world.tick, personId)
    const settled = (world.bankruptcies.get(personId) ?? [])[0]

    // What is left after every scheduled payment — not after 36 of them.
    expect(settled?.discharged).toBe(
      Math.max(0, filing.owed - filing.planMonthly * months),
    )
    if (months > 36) {
      const wrong = Math.max(0, filing.owed - filing.planMonthly * 36)
      expect(settled?.discharged).not.toBe(wrong)
    }
  })
})
