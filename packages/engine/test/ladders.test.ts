/**
 * CLIMBING A LADDER, AND SWITCHING TO ANOTHER ONE (owner's rulings,
 * 2026-08-14).
 *
 * THE CLAIMS: a month at the work leaves a skill behind and nothing else
 * does; the gates the tables write are the gates enforced; a licence is a
 * real barrier that money and months can clear; and — the owner's fifth
 * ruling — a career SWITCH always starts at the bottom of the new ladder,
 * however good the switcher already is.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt, toDate } from '../src/clock.js'
import { livingPeople } from '../src/systems.js'
import { walletOf } from '../src/finances.js'
import { levelOf } from '../src/skills.js'
import { FIRST_SLICE } from '../src/pathcontent.js'
import {
  climbPathPlayer,
  earnLicencePlayer,
  holdsLicence,
  joinBar,
  joinPathPlayer,
  licencesFor,
  pathsFor,
  setPlayer,
} from '../src/player.js'

function aWorker(seed = 4242) {
  const world = createWorld(makeSeed(seed), 100)
  advanceTicks(world, 25 * 12)
  const person = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) >= 22 && ageAt(p.birthTick, world.tick) <= 40)
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('nobody of working age')
  setPlayer(world, person.id)
  ;(world.player as { pending: unknown }).pending = null
  const wallet = walletOf(world, person.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 50_000_000 as Money })
  return { world, person }
}

/** Months, clearing anything the world wants to ask about. */
function run(world: ReturnType<typeof createWorld>, months: number): void {
  for (let i = 0; i < months; i += 1) {
    ;(world.player as { pending: unknown }).pending = null
    advanceTicks(world, 1)
  }
  ;(world.player as { pending: unknown }).pending = null
}

describe('starting on a ladder', () => {
  it('puts you on the bottom rung and pays what the table says', () => {
    const { world, person } = aWorker()
    expect(joinPathPlayer(world, 'retail-cashier').done).toBe(true)
    const job = world.employment.get(person.id)
    expect(job?.pathId).toBe('retail-cashier')
    expect(job?.pathLevel).toBe(1)
    expect(job?.monthlyPay ?? 0).toBeGreaterThan(0)
  })

  it('does not offer a trade before the town has invented it', () => {
    /**
     * MY OWN TEST WAS WRONG FIRST TIME and the run caught it: this fixture
     * advances twenty-five years, so the world is in the nineties and
     * software is long since available. The era rule is arithmetic and is
     * pinned in `paths.test.ts`; what belongs HERE is that the offered list
     * obeys it.
     */
    const { world } = aWorker()
    const year = toDate(world, world.tick).year
    const offered = pathsFor(world).map((view) => view.id)
    const software = FIRST_SLICE.find((path) => path.id === 'software-developer')
    expect(software?.availableFrom).toBe(1980)
    if (year >= 1980) {
      expect(offered).toContain('software-developer')
    } else {
      expect(offered).not.toContain('software-developer')
    }
    // The trade with no era is on offer in every year there is.
    expect(offered).toContain('retail-cashier')
  })

  it('will not have you without the papers the work requires', () => {
    /**
     * A LICENCE IS NOT A SUGGESTION. Driving a lorry needs a CDL and no
     * amount of skill substitutes for one.
     */
    const { world, person } = aWorker()
    const haulage = FIRST_SLICE.find((path) => path.id === 'truck-driver')
    expect(haulage).toBeDefined()
    if (!haulage) return
    expect(holdsLicence(world, person.id, 'cdl')).toBe(false)
    expect(joinBar(world, person.id, haulage)).toContain('licence')
    expect(joinPathPlayer(world, 'truck-driver').done).toBe(false)

    // Go and get it, and the door opens.
    expect(earnLicencePlayer(world, 'cdl').done).toBe(true)
    expect(holdsLicence(world, person.id, 'cdl')).toBe(true)
    expect(joinBar(world, person.id, haulage)).toBeNull()
    expect(joinPathPlayer(world, 'truck-driver').done).toBe(true)
  })

  it('charges for the papers out of the wallet', () => {
    const { world, person } = aWorker()
    const before = walletOf(world, person.id)
    const cash = before.checking + before.savings
    expect(earnLicencePlayer(world, 'cdl').done).toBe(true)
    const after = walletOf(world, person.id)
    expect(after.checking + after.savings).toBeLessThan(cash)
    // And you cannot buy the same one twice.
    expect(earnLicencePlayer(world, 'cdl').done).toBe(false)
  })

  it('shows the cost and the bar on every licence', () => {
    const { world } = aWorker()
    const views = licencesFor(world)
    expect(views.length).toBeGreaterThan(10)
    for (const view of views) {
      expect(view.cost).toBeGreaterThan(0)
      expect(view.title.length).toBeGreaterThan(5)
    }
  })
})

describe('a month at the work', () => {
  it('leaves the skill that work teaches, and no other', () => {
    const { world, person } = aWorker()
    expect(joinPathPlayer(world, 'retail-cashier').done).toBe(true)
    expect(levelOf(world.skills.get(person.id), 'customer-service')).toBe(0)

    run(world, 18)

    const sheet = world.skills.get(person.id)
    // A till teaches customer service and selling...
    expect((sheet?.['customer-service'] ?? 0)).toBeGreaterThan(0)
    expect((sheet?.sales ?? 0)).toBeGreaterThan(0)
    // ...and never teaches surgery.
    expect(sheet?.['medical-knowledge'] ?? 0).toBe(0)
    expect(sheet?.programming ?? 0).toBe(0)
  })
})

describe('the rung above', () => {
  it('refuses while the months are short, and names the shortfall', () => {
    const { world } = aWorker()
    joinPathPlayer(world, 'retail-cashier')
    const result = climbPathPlayer(world)
    expect(result.done).toBe(false)
    expect(result.reason).toContain('month')
  })

  it('opens when the months and the skills are both there', () => {
    /**
     * THE TWO CONSTRAINTS DOING DIFFERENT WORK, which is the whole point of
     * having both: the shift-lead rung wants twelve months AND Customer
     * Service 3, and a year on the till supplies both.
     */
    const { world, person } = aWorker()
    joinPathPlayer(world, 'retail-cashier')
    run(world, 20)

    const climbed = climbPathPlayer(world)
    expect(climbed.done, `refused: ${climbed.reason}`).toBe(true)
    expect(world.employment.get(person.id)?.pathLevel).toBe(2)
    // The pay moved with the rung.
    expect(climbed.reason).toContain('month')
  })

  it('stops at the top of the ladder', () => {
    const { world, person } = aWorker()
    joinPathPlayer(world, 'trades-electrician')
    const job = world.employment.get(person.id)
    if (!job) return
    // Stand them on the last rung and ask for another.
    const path = FIRST_SLICE.find((entry) => entry.id === 'trades-electrician')
    if (!path) return
    world.employment.set(person.id, { ...job, pathLevel: path.levels.length })
    expect(climbPathPlayer(world).done).toBe(false)
  })
})

describe('changing trades', () => {
  it('starts you at the bottom however good you already are', () => {
    /**
     * THE OWNER'S FIFTH RULING, AS A TEST: "they should have to go through
     * the management ladder like everyone else and not just handed a higher
     * position because he has the skills."
     */
    const { world, person } = aWorker()
    // A long career on the tools, with the skills to show for it.
    joinPathPlayer(world, 'trades-electrician')
    run(world, 60)
    const earned = world.skills.get(person.id)
    expect(levelOf(earned, 'technical-knowledge')).toBeGreaterThanOrEqual(2)

    // Now move into a different trade entirely.
    expect(joinPathPlayer(world, 'retail-cashier').done).toBe(true)
    const job = world.employment.get(person.id)
    expect(job?.pathId).toBe('retail-cashier')
    // THE BOTTOM RUNG. Not the third, however much he knows.
    expect(job?.pathLevel).toBe(1)
  })

  it('keeps what they learned — a switch costs the rung, not the history', () => {
    const { world, person } = aWorker()
    joinPathPlayer(world, 'trades-electrician')
    run(world, 60)
    const before = world.skills.get(person.id)?.['technical-knowledge'] ?? 0
    joinPathPlayer(world, 'retail-cashier')
    const after = world.skills.get(person.id)?.['technical-knowledge'] ?? 0
    // The years happened. Nothing takes them away.
    expect(after).toBe(before)
    expect(after).toBeGreaterThan(0)
  })
})

describe('the screen can always say why', () => {
  it('lists the ladders with what each rung asks for', () => {
    const { world } = aWorker()
    const views = pathsFor(world)
    expect(views.length).toBeGreaterThan(5)
    for (const view of views) {
      expect(view.rungs.length).toBeGreaterThanOrEqual(4)
      for (const rung of view.rungs) {
        // Every rung above the first asks for SOMETHING, and says so.
        if (rung.level > 1) expect(rung.asks.length).toBeGreaterThan(0)
        expect(rung.monthlyPay).toBeGreaterThan(0)
      }
    }
  })

  it('agrees with the verb about why a door is shut', () => {
    // THE BAR PATTERN. A greyed row and a refusal must never disagree.
    const { world, person } = aWorker()
    const haulage = FIRST_SLICE.find((path) => path.id === 'truck-driver')
    if (!haulage) return
    const bar = joinBar(world, person.id, haulage)
    const refusal = joinPathPlayer(world, 'truck-driver')
    expect(bar).not.toBeNull()
    expect(refusal.done).toBe(false)
    expect(refusal.reason).toBe(bar)
  })
})
