/**
 * WORLD INVARIANTS — things that must never be true, swept over long runs.
 *
 * Most tests here assert that a feature works. This one asserts that the
 * world does not quietly corrupt itself while nobody is looking: a dead man
 * still drawing a wage, a household holding somebody who lives elsewhere, a
 * rank off the end of its own ladder.
 *
 * Every failure message names the person and the tick, because the point of
 * a sweep is to hand the next session a reproduction rather than a mood.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { branchSpecFor } from '../src/index.js'
import type { World } from '../src/types.js'

const SEEDS = [4141, 12345, 9001, 777, 31337]
const YEARS = 60

/**
 * THE WORLDS ARE BUILT ONCE AND SHARED.
 *
 * Sixty years of two hundred people is several seconds a seed. Building
 * them per check made this one file minutes of the suite on its own, which
 * is how a sweep stops being run at all. Nothing here mutates a world, so
 * one set serves every check.
 */
let built: readonly { seed: number; world: World }[] | null = null

/**
 * THE BUILD IS PAID ONCE, HERE, WITH ITS OWN ALLOWANCE.
 *
 * Left inside the first test, the world-building cost counted against that
 * test's timeout — so on a loaded machine the suite reported "believable
 * population FAILED" when the population was fine and the box was simply
 * busy. A timeout dressed up as an assertion failure is worse than either,
 * because it sends the next session hunting a determinism bug that is not
 * there. (It sent this one.)
 */
beforeAll(() => {
  longRuns()
  // Below the global hookTimeout, which meant this file bailed — and took
  // its nine tests with it as "skipped" — while every other heavy file was
  // still allowed fifteen minutes. Same limit as everything else now.
}, 900_000)

function longRuns(): readonly { seed: number; world: World }[] {
  built ??= SEEDS.map((seed) => {
    const world = createWorld(makeSeed(seed), 200)
    advanceTicks(world, YEARS * 12)
    return { seed, world }
  })
  return built
}

/** Collected rather than thrown one at a time: one run should report all. */
function sweep(check: (world: World, seed: number, bad: (why: string) => void) => void): void {
  const failures: string[] = []
  for (const { seed, world } of longRuns()) {
    check(world, seed, (why) => failures.push(`seed ${String(seed)} @${String(world.tick)}: ${why}`))
  }
  expect(failures.slice(0, 10).join('\n')).toBe('')
}

describe('the dead stop doing things', () => {
  it('hold no job, no uniform, and no open business', () => {
    sweep((world, _seed, bad) => {
      for (const person of world.people.values()) {
        if (person.deathTick === null) continue
        if (world.employment.has(person.id)) {
          bad(`${String(person.id)} died and still holds a job`)
        }
        const record = world.service.get(person.id)
        if (record && record.dischargedAtTick === null) {
          bad(`${String(person.id)} died and the service record is still open`)
        }
        for (const business of world.businesses?.values() ?? []) {
          if (business.ownerId === person.id && business.closedTick === null) {
            bad(`${String(person.id)} died and still owns business ${String(business.id)}`)
          }
        }
      }
    })
  }, 60_000)
})

describe('households and the people in them agree', () => {
  it('every member list matches the members’ own householdId', () => {
    sweep((world, _seed, bad) => {
      for (const household of world.households.values()) {
        for (const memberId of household.memberIds) {
          const person = world.people.get(memberId)
          if (!person) {
            bad(`household ${String(household.id)} lists absent person ${String(memberId)}`)
            continue
          }
          if (person.deathTick !== null) {
            bad(`household ${String(household.id)} still lists dead ${String(memberId)}`)
          } else if (person.householdId !== household.id) {
            bad(`${String(memberId)} is listed by ${String(household.id)} but lives in ${String(person.householdId)}`)
          }
        }
      }
      for (const person of world.people.values()) {
        if (person.deathTick !== null || person.householdId === null) continue
        const household = world.households.get(person.householdId)
        if (!household) {
          bad(`${String(person.id)} lives in absent household ${String(person.householdId)}`)
        } else if (!household.memberIds.includes(person.id)) {
          bad(`${String(person.id)} lives in ${String(household.id)} which does not list them`)
        }
      }
    })
  }, 60_000)
})

describe('a job points at a real workplace', () => {
  it('never employs anybody at a place that does not stand', () => {
    sweep((world, _seed, bad) => {
      for (const job of world.employment.values()) {
        if (world.people.get(job.personId)?.deathTick !== null) continue
        /**
         * A WORKPLACE IS A PLACE OR A BUSINESS. Since businesses became
         * somewhere people actually work, a job may name either — ids come
         * from the one entity counter, so there is no ambiguity. The
         * invariant got STRONGER rather than looser: a job at a business
         * that has SHUT is now caught too, which is the failure the
         * closure-layoff pass exists to prevent.
         */
        const business = world.businesses.get(job.workplaceId)
        if (!world.places.has(job.workplaceId) && business === undefined) {
          bad(`${String(job.personId)} works at absent workplace ${String(job.workplaceId)}`)
        }
        if (business !== undefined && business.closedTick !== null) {
          bad(`${String(job.personId)} still works at closed business ${business.name}`)
        }
        if (job.monthlyPay < 0) {
          bad(`${String(job.personId)} is paid ${String(job.monthlyPay)}`)
        }
      }
    })
  }, 60_000)

  it('never has one person in a uniform and a civilian job at once', () => {
    sweep((world, _seed, bad) => {
      for (const record of world.service.values()) {
        if (record.dischargedAtTick !== null) continue
        if (world.employment.has(record.personId)) {
          bad(`${String(record.personId)} serves and holds a civilian job`)
        }
      }
    })
  }, 60_000)
})

describe('a rank is a rung on its own ladder', () => {
  it('never sits off the end of the branch it belongs to', () => {
    sweep((world, _seed, bad) => {
      for (const record of world.service.values()) {
        const spec = branchSpecFor(world, record.branch)
        const ladder = record.commissioned === true ? (spec.officerRanks ?? []) : spec.ranks
        if (ladder.length === 0) {
          bad(`${String(record.personId)} is in ${record.branch}, which has no ladder`)
          continue
        }
        if (record.rank < 0 || record.rank >= ladder.length) {
          bad(`${String(record.personId)} holds rank ${String(record.rank)} of ${String(ladder.length)} in ${record.branch}`)
        }
        if (record.monthlyPay < 0) {
          bad(`${String(record.personId)} is paid ${String(record.monthlyPay)} in uniform`)
        }
      }
    })
  }, 60_000)
})

describe('relationships have two living ends', () => {
  it('never ties somebody to themselves, or leaves a tie open past a death', () => {
    sweep((world, _seed, bad) => {
      for (const tie of world.relationships.values()) {
        if (tie.a === tie.b) bad(`${String(tie.a)} is in a relationship with themselves`)
        if (tie.endedAtTick !== null) continue
        for (const end of [tie.a, tie.b]) {
          const person = world.people.get(end)
          if (!person) bad(`an open tie names absent ${String(end)}`)
          else if (person.deathTick !== null) {
            bad(`open ${tie.type} tie still names dead ${String(end)}`)
          }
        }
      }
    })
  }, 60_000)
})

describe('the money model holds its shape', () => {
  it('keeps every ledger an integer, and nobody secretly rich', () => {
    sweep((world, _seed, bad) => {
      for (const accounts of world.accounts.values()) {
        for (const [field, value] of Object.entries(accounts)) {
          if (typeof value !== 'number') continue
          if (!Number.isInteger(value)) {
            bad(`${String(accounts.personId)} has a fractional ${field}: ${String(value)}`)
          }
          // A cent count past a trillion is not wealth, it is a runaway —
          // the business-capital compounding bug reached $386bn this way.
          if (Math.abs(value) > 1e14) {
            bad(`${String(accounts.personId)} has a runaway ${field}: ${String(value)}`)
          }
        }
      }
    })
  }, 60_000)

  it('never leaves two bankruptcies open on one person', () => {
    sweep((world, _seed, bad) => {
      for (const [personId, filings] of world.bankruptcies) {
        const open = filings.filter((filing) => filing.dischargedAtTick === null).length
        if (open > 1) bad(`${String(personId)} has ${String(open)} open bankruptcies`)
      }
    })
  }, 60_000)
})

describe('the town does not quietly die or explode', () => {
  it('holds a believable population over sixty years', () => {
    // The M-MONEY2 collapse (159 → 50 people) got through because nothing
    // watched the headcount. Now something does.
    // MEASURED across these five seeds at sixty years: 209-301 living, from
    // a founding 200. The band is deliberately wide — this is a tripwire for
    // a collapse or a runaway, not a tuning assertion, and narrowing it
    // would turn every ordinary balance change into a failure here.
    const counts: string[] = []
    for (const { seed, world } of longRuns()) {
      let living = 0
      for (const person of world.people.values()) if (person.deathTick === null) living++
      counts.push(`${String(seed)}:${String(living)}`)
      expect(living, `population ${counts.join(' ')}`).toBeGreaterThan(80)
      expect(living, `population ${counts.join(' ')}`).toBeLessThan(4_000)
    }
  }, 60_000)
})
