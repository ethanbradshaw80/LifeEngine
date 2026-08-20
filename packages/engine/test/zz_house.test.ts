import { describe, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { accountsOf, buyHome, walletOf, homePurchaseBar } from '../src/finances.js'
import { spouseOf } from '../src/relationships.js'

describe('probe', () => {
  it('who holds the money', () => {
    const world = createWorld(makeSeed(9009), 60)
    const person = [...world.people.values()]
      .filter((p) => p.deathTick === null)
      .sort((a, b) => a.birthTick - b.birthTick)[0]
    if (!person) throw new Error('none')
    const household = person.householdId === null ? null : world.households.get(person.householdId)
    world.accounts.set(person.id, { ...accountsOf(world, person.id), savings: 90_000_000 as Money })

    const own = accountsOf(world, person.id)
    const purse = walletOf(world, person.id)
    const spouse = spouseOf(world, person.id)
    const bar = homePurchaseBar(world, person.id, household!.placeId, 'mortgage')
    const bought = buyHome(world, world.tick, person.id, household!.placeId)
    const afterOwn = accountsOf(world, person.id)
    const afterPurse = walletOf(world, person.id)
    throw new Error(
      `HOUSE >> person=${String(person.id)} spouse=${String(spouse)} purseHolder=${String(purse.personId)} ` +
        `ownSavings=${String(own.savings)} purseSavings=${String(purse.savings)} ` +
        `bar=${String(bar)} bought=${String(bought)} ` +
        `afterOwn=${String(afterOwn.savings)} afterPurse=${String(afterPurse.savings)}`,
    )
  })
})
