/**
 * M-ECON §8-9. The months money goes wrong, and the bank's verbs.
 *
 * THE CLAIMS: a shock is rare enough to be a shock rather than a tax; it is
 * sized against what a person actually holds, so it stings without wiping
 * anyone out; the player is ASKED where there is a real choice and NPCs are
 * charged on the same numbers (the parity rule); carrying it writes an
 * ordinary loan rather than inventing a second kind of debt; and every bank
 * verb refuses honestly instead of half-doing the thing.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld, setPlayer } from '../src/index.js'
import {
  accountsOf,
  applyMoneyShock,
  bankTransfer,
  borrowPlayer,
  buyHomePlayer,
  divestPlayer,
  investPlayer,
  moveBetweenOwnAccounts,
  netWorthOf,
} from '../src/index.js'
import { eventsFor } from '../src/records.js'
import { walletOf } from '../src/finances.js'
import { spouseOf } from '../src/relationships.js'

/**
 * Put money where this person's money actually lives.
 *
 * H0: a married couple share ONE wallet, on the lower-id spouse's record,
 * and every verb spends it — so a fixture that wrote the raw personal
 * record was funding a ledger the engine no longer spends from. (Measured:
 * these fixtures pick the town's eldest adult, who at seeds 4444 and 6666
 * is a married non-holder.) The personal record still carries the loans,
 * the deed and the tax year; the cash goes to the wallet.
 */
function fund(
  world: ReturnType<typeof createWorld>,
  personId: number,
  savings: number,
  checking = 0,
): void {
  const wallet = walletOf(world, personId as never)
  world.accounts.set(wallet.personId, {
    ...wallet,
    savings: savings as Money,
    checking: checking as Money,
  })
}

/** What this person can actually spend — the joint balance, not the file. */
function liquidOf(world: ReturnType<typeof createWorld>, personId: number): number {
  const wallet = walletOf(world, personId as never)
  return wallet.savings + wallet.checking
}

/**
 * An UNMARRIED adult. The loan claim below — borrowed cash and the debt it
 * creates cancel exactly — is arithmetic about one person's balance sheet.
 * For a married borrower it does not hold and should not: the cash lands in
 * the couple's joint wallet (half of it is now their spouse's) while the
 * loan stays personal, so borrowing really does move wealth. Testing the
 * loan rule on a spouse would be testing marriage instead.
 */
function aSingleAdult(world: ReturnType<typeof createWorld>) {
  const person = [...world.people.values()]
    .filter((p) => p.deathTick === null && spouseOf(world, p.id) === null)
    .sort((a, b) => a.birthTick - b.birthTick)[0]
  expect(person, 'nobody in this town is single').toBeDefined()
  return person!
}

function anAdult(world: ReturnType<typeof createWorld>) {
  const person = [...world.people.values()]
    .filter((p) => p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick)[0]
  expect(person).toBeDefined()
  return person!
}

describe('how often money goes wrong', () => {
  it('is rare — a shock every year would be a tax, not a shock', () => {
    // MEASURED, not guessed: a century of a small town, counting the
    // shock events against the adult-months lived. Tuned from 4 per mille
    // down to 2 after the first run left a third of the town broke.
    const world = createWorld(makeSeed(60606), 80)
    advanceTicks(world, 1200)
    let shocks = 0
    for (const event of world.events) if (event.type === 'money-shock') shocks += 1

    const living = [...world.people.values()].filter((p) => p.deathTick === null).length
    // THE TOWN SURVIVED IT, which is the whole of the claim — not a
    // population target. The threshold was 30 and this seed landed on
    // EXACTLY 30, which made a survival check into a knife edge that
    // every future golden shift would flip.
    //
    // MEASURED before moving it, because "a test failed, lower the bar"
    // is how a suite stops meaning anything. Four seeds of an 80-person
    // town over a century: 30, 79, 60, 84. Re-run with private-school
    // tuition forced to zero — the change under suspicion — and this seed
    // still gives 30, while the others move to 85, 83 and 63. One of them
    // went DOWN when the cost was removed. That is chaotic reshuffling in
    // a town small enough to be at the mercy of it, not a decline, and
    // not anything education did.
    expect(living).toBeGreaterThan(20)
    // Measured on this seed: roughly one shock per person per two decades.
    expect(shocks).toBeGreaterThan(0)
    expect(shocks / Math.max(1, living)).toBeLessThan(12)
  })

  it('never takes more than a person has', () => {
    const world = createWorld(makeSeed(60606), 60)
    advanceTicks(world, 600)
    for (const [personId] of world.accounts) {
      const accounts = accountsOf(world, personId)
      // H1: CHECKING may legitimately sit below zero — arrears ride there
      // as a negative balance by design. A shock still never digs into
      // savings past zero, and every value stays an honest integer.
      expect(Number.isInteger(accounts.checking)).toBe(true)
      expect(accounts.savings).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('the bill itself', () => {
  it('paid now comes out of what they hold, checking first', () => {
    const world = createWorld(makeSeed(1111), 60)
    const person = anAdult(world)
    fund(world, person.id, 500_000, 200_000)

    applyMoneyShock(world, world.tick, person.id, 'medical', 300_000 as Money, false)
    // The bill comes out of the WALLET (H0); the loans stay on the file.
    const accounts = walletOf(world, person.id)
    expect(accounts.checking).toBe(0)
    expect(accounts.savings).toBe(400_000)
    expect(accountsOf(world, person.id).loans).toHaveLength(0)
    expect(eventsFor(world, person.id).some((e) => e.type === 'money-shock')).toBe(true)
  })

  it('carried writes an ordinary personal loan, not a second kind of debt', () => {
    const world = createWorld(makeSeed(1111), 60)
    const person = anAdult(world)
    fund(world, person.id, 0, 0)

    applyMoneyShock(world, world.tick, person.id, 'repairs', 400_000 as Money, true)
    const accounts = accountsOf(world, person.id)
    expect(accounts.loans).toHaveLength(1)
    expect(accounts.loans[0]!.kind).toBe('personal')
    expect(accounts.loans[0]!.monthlyPayment).toBeGreaterThan(0)
  })

  it('records a decision either way, so the timeline can explain it', () => {
    const world = createWorld(makeSeed(1111), 60)
    const person = anAdult(world)
    fund(world, person.id, 900_000)
    applyMoneyShock(world, world.tick, person.id, 'scam', 200_000 as Money, false)
    const decided = world.causalRecords.filter(
      (r) => r.subjectId === person.id && r.decision === 'spending',
    )
    expect(decided.length).toBeGreaterThan(0)
    expect(decided.at(-1)!.chosen).toContain('bill')
  })
})

describe('the bank verbs', () => {
  it('move money between a person’s own two accounts, and no further', () => {
    const world = createWorld(makeSeed(2222), 60)
    const person = anAdult(world)
    fund(world, person.id, 100_000, 250_000)

    const moved = moveBetweenOwnAccounts(world, person.id, 400_000 as Money, true)
    expect(moved).toBe(250_000) // clamped to what checking actually held
    const accounts = walletOf(world, person.id)
    expect(accounts.checking).toBe(0)
    expect(accounts.savings).toBe(350_000)
    // Nothing was created: the two balances still sum to what they did.
    expect(accounts.checking + accounts.savings).toBe(350_000)
  })

  it('refuse honestly when nobody is being played', () => {
    const world = createWorld(makeSeed(3333), 60)
    expect(bankTransfer(world, 1_000, true).moved).toBe(false)
    expect(investPlayer(world, 'industrial', 1_000, false).done).toBe(false)
    expect(divestPlayer(world, 'industrial', false).done).toBe(false)
    expect(borrowPlayer(world, 'personal', 1_000).done).toBe(false)
    expect(buyHomePlayer(world).done).toBe(false)
  })

  it('give the player the same numbers the NPCs get', () => {
    const world = createWorld(makeSeed(4444), 60)
    const person = anAdult(world)
    setPlayer(world, person.id)
    fund(world, person.id, 3_000_000)

    expect(investPlayer(world, 'industrial', 1_000_000, false).done).toBe(true)
    expect(accountsOf(world, person.id).holdings).toHaveLength(1)
    // The refusal is the engine's own, worded for a person to read.
    const broke = investPlayer(world, 'industrial', 900_000_000, false)
    expect(broke.done).toBe(true) // clamped to savings, not refused outright
    const nothingLeft = investPlayer(world, 'defense', 500_000, false)
    expect(nothingLeft.done).toBe(false)
    expect(nothingLeft.reason).toContain('savings')

    expect(divestPlayer(world, 'consumer', false).done).toBe(false)
    expect(divestPlayer(world, 'industrial', false).done).toBe(true)
  })

  it('report a loan refusal in the bank’s words, not a silent false', () => {
    const world = createWorld(makeSeed(5555), 60)
    const person = anAdult(world)
    setPlayer(world, person.id)
    fund(world, person.id, 0)
    const refused = borrowPlayer(world, 'mortgage', 20_000_000)
    if (!refused.done) expect(refused.reason.length).toBeGreaterThan(10)
  })
})

describe('net worth', () => {
  it('does not count borrowed money as wealth', () => {
    const world = createWorld(makeSeed(6666), 60)
    const person = aSingleAdult(world)
    setPlayer(world, person.id)
    fund(world, person.id, 1_000_000)

    const before = netWorthOf(world, person.id)
    expect(borrowPlayer(world, 'personal', 800_000).done).toBe(true)
    // The cash arrived and the debt arrived with it. They cancel, exactly.
    // The cash lands in the WALLET (H0); the debt stays on the personal file.
    expect(liquidOf(world, person.id)).toBe(1_800_000)
    expect(netWorthOf(world, person.id)).toBe(before)
  })
})
