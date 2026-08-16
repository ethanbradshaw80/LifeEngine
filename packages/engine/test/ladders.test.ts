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
  resolvePending,
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

/**
 * THE WHOLE HIRING, as a player actually walks it (owner: "you also dont get
 * interviewed for the job or nothing you just get it doesnt matter").
 *
 * Ask → the room → the offer → accept. These tests used to assert that
 * `joinPathPlayer` hired you on the spot, which is precisely the behaviour
 * he objected to, so they were rewritten rather than kept green.
 *
 * The room can say NO, and that is the point of it, so this tries a few
 * months before giving up.
 */
function hireOnto(world: ReturnType<typeof createWorld>, pathId: string): boolean {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    ;(world.player as { pending: unknown }).pending = null
    const asked = joinPathPlayer(world, pathId)
    if (!asked.done) return false
    if (world.player.pending?.kind === 'interview') resolvePending(world, 'straight')
    if (world.player.pending?.kind === 'job-offer') resolvePending(world, 'accept')
    ;(world.player as { pending: unknown }).pending = null
    if (world.employment.get(world.player.personId as never)?.pathId === pathId) return true
    advanceTicks(world, 1)
  }
  return false
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
    expect(hireOnto(world, 'retail-cashier'), 'never got through the room').toBe(true)
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
    // And now the asking is allowed — it opens a room rather than a job.
    expect(joinPathPlayer(world, 'truck-driver').done).toBe(true)
    expect(world.player.pending?.kind).toBe('interview')
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
    expect(hireOnto(world, 'retail-cashier')).toBe(true)
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
    hireOnto(world, 'retail-cashier')
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
    hireOnto(world, 'retail-cashier')
    run(world, 20)

    const climbed = climbPathPlayer(world)
    expect(climbed.done, `refused: ${climbed.reason}`).toBe(true)
    expect(world.employment.get(person.id)?.pathLevel).toBe(2)
    // The pay moved with the rung.
    expect(climbed.reason).toContain('month')
  })

  it('stops at the top of the ladder', () => {
    const { world, person } = aWorker()
    hireOnto(world, 'trades-electrician')
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
    hireOnto(world, 'trades-electrician')
    run(world, 60)
    const earned = world.skills.get(person.id)
    expect(levelOf(earned, 'technical-knowledge')).toBeGreaterThanOrEqual(2)

    // Now move into a different trade entirely.
    expect(hireOnto(world, 'retail-cashier')).toBe(true)
    const job = world.employment.get(person.id)
    expect(job?.pathId).toBe('retail-cashier')
    // THE BOTTOM RUNG. Not the third, however much he knows.
    expect(job?.pathLevel).toBe(1)
  })

  it('keeps what they learned — a switch costs the rung, not the history', () => {
    const { world, person } = aWorker()
    hireOnto(world, 'trades-electrician')
    run(world, 60)
    const before = world.skills.get(person.id)?.['technical-knowledge'] ?? 0
    hireOnto(world, 'retail-cashier')
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

/**
 * THE TOWN IS NOT ON THE LADDERS YET, AND THAT IS DELIBERATE.
 *
 * It was built and then TAKEN BACK OUT, because putting townspeople on
 * career paths broke four separate invariants at once and the suite caught
 * every one:
 *
 *   the population collapsed — 150 years ending with 45 people against a
 *   floor of 59 — because a share of every cohort stopped reaching the
 *   occupations the rest of the simulation is tuned around;
 *   graduates stopped following their field, since paths carry no notion of
 *   a major;
 *   pay-band checks failed, because a rung id is not an occupation id and
 *   `occupationById` returns a zero band for one;
 *   and a military promotion test read "farm manager is not a rank".
 *
 * The last two are the real obstacle and they are the same obstacle: a job
 * on a ladder stores a RUNG id in `occupationId`, and the rest of the world
 * assumes that field names something in the occupation table. Until rungs
 * are first-class there, the town cannot hold one safely.
 *
 * `runLadderClimbs` stays in `systems.ts` and is inert while nobody in town
 * is on a path — so the day rungs become first-class, the climbing already
 * works. The PLAYER's ladders are unaffected and fully tested above.
 */
describe('the player climbs, and is never handed it', () => {
  it('never hands the player a promotion', () => {
    // The owner's whole complaint about the old ladder was that promotion
    // happened TO you. The town's pass skips the player deliberately.
    const { world, person } = aWorker()
    hireOnto(world, 'retail-cashier')
    run(world, 40)
    // Forty months is well past the twelve the second rung asks for.
    expect(world.employment.get(person.id)?.pathLevel).toBe(1)
    // It is there for the taking — the player just has to take it.
    expect(climbPathPlayer(world).done).toBe(true)
  })
})
