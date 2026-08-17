/** TEMPORARY PROBE. Not a keeper. */
import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { moneyOnHand, personalIncome, walletOf } from '../src/finances.js'
import { rankTitle } from '../src/service.js'

describe('probe: a TOWNSPERSON soldier with no home', () => {
  it('measures', () => {
    const out: string[] = []
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 45 * 12)

    let shown = 0
    for (const record of world.service.values()) {
      if (record.dischargedAtTick !== null) continue
      const person = world.people.get(record.personId)
      if (person === undefined || person.deathTick !== null) continue
      if (person.fromAway !== undefined) continue // townspeople only
      if (shown >= 6) break
      const house = person.householdId === null ? undefined : world.households.get(person.householdId)
      out.push(
        `#${String(record.personId)} ${person.givenName} ${person.familyName} ` +
          `${rankTitle(world, record.branch, record.rank, record.commissioned === true)}` +
          `  householdId ${String(person.householdId)}` +
          `  place ${String(house?.placeId ?? 'none')}` +
          `  homelessSince ${String(house?.homelessSinceTick ?? 'no')}`,
      )
      out.push(
        `    income ${String(personalIncome(world, record.personId))}  onHand ${String(moneyOnHand(world, record.personId))}  walletHolder #${String(walletOf(world, record.personId).personId)}`,
      )
      shown += 1
    }
    writeFileSync('probe-out.txt', out.join('\n'), 'utf8')
  })
})
