import { describe, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { householdIncome, householdLedger } from '../src/finances.js'
import { ageAt } from '../src/clock.js'

describe('probe', () => {
  it('which household disagrees', () => {
    const world = createWorld(makeSeed(12345), 400)
    advanceTicks(world, 720)
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null || household.memberIds.length === 0) continue
      const ledger = householdLedger(world, household)
      const parts = [
        ...ledger.wages,
        ...ledger.servicePay,
        ...ledger.pensions,
        ...ledger.survivorPay,
        ...ledger.statePension,
      ].reduce((sum, entry) => sum + entry.amount, 0)
      const support = ledger.support.reduce((sum, entry) => sum + entry.amount, 0)
      const lhs = parts - ledger.taxWithheld + support
      const rhs = householdIncome(world, household)
      if (lhs === rhs) continue
      console.log('MISMATCH lhs', lhs, 'rhs', rhs)
      console.log('  wages', JSON.stringify(ledger.wages))
      console.log('  servicePay', JSON.stringify(ledger.servicePay))
      console.log('  pensions', JSON.stringify(ledger.pensions))
      console.log('  survivorPay', JSON.stringify(ledger.survivorPay))
      console.log('  statePension', JSON.stringify(ledger.statePension))
      console.log('  support', JSON.stringify(ledger.support), 'tax', ledger.taxWithheld)
      for (const id of household.memberIds) {
        const person = world.people.get(id)
        if (!person) continue
        const service = world.service.get(id)
        console.log(
          `  member ${String(id)} age ${String(ageAt(person.birthTick, world.tick))} dead=${String(person.deathTick !== null)}`,
          `job=${String(world.employment.get(id)?.occupationId ?? 'none')}`,
          `service=${service === undefined ? 'none' : `discharged:${String(service.dischargedAtTick)}`}`,
        )
      }
      throw new Error('found it')
    }
  })
})
