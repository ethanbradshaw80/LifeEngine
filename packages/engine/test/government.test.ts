/**
 * Government phase 1 — a living government that exists, holds elections,
 * and can be voted in.
 *
 * The spec's build order starts here deliberately: "seed NPC
 * officeholders + an election calendar + a policy state with sane
 * defaults; the player can vote. (Effects light at first.)" The levers
 * move and are shown; nothing downstream reads them until phase 2, one
 * system at a time, so that a golden shift has one plausible cause.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import type { Person, World } from '../src/types.js'
import {
  CAMPAIGN_MONTHS,
  campaign,
  candidacyBar,
  declareCandidacy,
  LEVER_NOTES,
  LEVER_RANGE,
  leverBar,
  leversOf,
  myCandidacy,
  setLever,
  GRAFT_OFFERS,
  graftById,
  takeGraft,
  townBudget,
  warPowerBar,
  OFFICES,
  PARTIES,
  SEATED_OFFICES,
  castVote,
  eligibleFor,
  freshPolicy,
  heldOffices,
  officeById,
  partyById,
  voteBar,
} from '../src/government.js'
import { livingPeople } from '../src/systems.js'
import { homeland, sueForPeace } from '../src/geopolitics.js'
import { ownershipCostOf } from '../src/realestate.js'
import { creditPerson, walletOf } from '../src/finances.js'
import { clearanceBonusOf } from '../src/crime.js'
import { BASELINE_INCOME_RATE, withholdingFor } from '../src/tax.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 60 * 12)

describe('a government exists', () => {
  it('fills every seat the town has', () => {
    // THE TOWN'S OWN SEATS. The state and national rungs are seated too
    // (phase 5), but they are reached by CLIMBING — the presidency wants
    // a senator or a governor behind it — and sixty years is not always
    // long enough for a four-hundred-person town to produce one. A vacant
    // presidency in a young world is the ladder working, not failing.
    /**
     * A SEAT MAY BE EMPTY. A SEAT MAY NOT BE HELD BY A CORPSE.
     *
     * This used to require all four town seats filled at every moment, which
     * is not a claim the simulation can honour: an officeholder who dies
     * vacates the chair in the same tick (see `performDeath`) and the
     * by-election takes months to run. The two halves of the old assertion
     * were in tension from the instant anybody died in office — filling the
     * seat instantly would have meant inventing a successor, and leaving the
     * dead man in it meant a screen could name him as the sitting mayor.
     *
     * OWNER'S RULING: allow the short vacancy. So the test now pins the two
     * things that are actually true — nobody dead holds a seat, and the town
     * is not simply ungoverned — instead of one thing that cannot be.
     */
    const seats = ['mayor', 'sheriff', 'council', 'school-board']
    let filled = 0
    for (const officeId of seats) {
      const holder = world.officials.get(officeId)
      if (holder === undefined) continue // a by-election is running
      filled += 1
      const person = world.people.get(holder.personId)
      expect(person).toBeDefined()
      expect(person?.deathTick, `${officeId} is held by a dead person`).toBeNull()
      expect(partyById(holder.partyId)).toBeDefined()
    }
    // A vacancy is a by-election; four vacancies is a government that has
    // stopped seating anybody, which is the failure this test exists for.
    expect(filled, 'every town seat is empty at once').toBeGreaterThan(seats.length / 2)
  })

  it('turns over — a seat is not a life appointment', () => {
    // MEASURED: 58 swearings-in across four seats in sixty years, and
    // nine different mayors. Four-year terms over sixty years is fifteen
    // per seat, which is what a calendar that actually runs looks like.
    const sworn = world.events.filter((e) => e.type === 'took-office')
    expect(sworn.length).toBeGreaterThan(20)
    const mayors = new Set(sworn.filter((e) => e.detail === 'mayor').map((e) => e.subjectId))
    expect(mayors.size).toBeGreaterThan(3)
  })

  it('never seats somebody below the age the office asks for', () => {
    for (const officeId of SEATED_OFFICES) {
      const holder = world.officials.get(officeId)
      const office = officeById(officeId)
      const person = holder === undefined ? undefined : world.people.get(holder.personId)
      if (holder === undefined || office === undefined || person === undefined) continue
      expect(ageAt(person.birthTick, holder.sinceTick)).toBeGreaterThanOrEqual(office.minAge)
    }
  })
})

describe('the ladder', () => {
  it('is a climb, not a menu', () => {
    const president = officeById('president')
    expect(president?.needsPrior?.length ?? 0).toBeGreaterThan(0)
    expect(OFFICES.some((o) => o.level === 'state')).toBe(true)
    expect(OFFICES.some((o) => o.level === 'national')).toBe(true)
  })

  it('refuses a seat to somebody who has held nothing', () => {
    const president = officeById('president')
    expect(president).toBeDefined()
    if (president === undefined) return
    const nobody = livingPeople(world).find(
      (person) =>
        ageAt(person.birthTick, world.tick) > 40 &&
        !world.events.some((e) => e.type === 'took-office' && e.subjectId === person.id),
    )
    expect(nobody).toBeDefined()
    if (nobody === undefined) return
    expect(eligibleFor(world, nobody, president, world.tick)).toBe(false)
  })
})

describe('the ballot', () => {
  it('opens before it decides, so there is something to look at', () => {
    // The mockup shows a BALLOT — candidates, parties, live polling, a
    // Vote button. That is only possible if an election is a SEASON
    // rather than an instant resolving the month a term ends. Building
    // from the mockup is what turned that up.
    expect(CAMPAIGN_MONTHS).toBeGreaterThan(0)
    const own = createWorld(makeSeed(909), 300)
    let sawOpen = false
    for (let i = 0; i < 12 * 12 && !sawOpen; i++) {
      advanceTicks(own, 1)
      if (own.elections.size > 0) sawOpen = true
    }
    expect(sawOpen, 'no ballot was ever open to look at').toBe(true)
  })

  it('leaves some of the town undecided', () => {
    // Polling deliberately does not sum to 1000. An election with no
    // undecideds is a result pretending to be a forecast.
    const own = createWorld(makeSeed(909), 300)
    for (let i = 0; i < 12 * 12; i++) {
      advanceTicks(own, 1)
      const election = [...own.elections.values()][0]
      if (election === undefined || election.runners.length === 0) continue
      const total = election.runners.reduce((sum, r) => sum + r.polling, 0)
      expect(total).toBeLessThan(1000)
      expect(total).toBeGreaterThan(400)
      return
    }
  })

  it('lets a citizen vote once, and says why when they cannot', () => {
    const own = createWorld(makeSeed(909), 300)
    let officeId: string | undefined
    for (let i = 0; i < 12 * 12; i++) {
      advanceTicks(own, 1)
      officeId = [...own.elections.keys()][0]
      if (officeId !== undefined) break
    }
    expect(officeId).toBeDefined()
    if (officeId === undefined) return

    const adult = livingPeople(own).find((p) => ageAt(p.birthTick, own.tick) >= 18)
    const child = livingPeople(own).find((p) => ageAt(p.birthTick, own.tick) < 18)
    expect(adult).toBeDefined()
    if (adult === undefined) return

    // A child is refused and TOLD WHY, rather than shown a dead button.
    if (child !== undefined) {
      expect(voteBar(own, child.id, officeId, own.tick)).toContain('old enough')
    }

    const runner = own.elections.get(officeId)?.runners[0]
    expect(runner).toBeDefined()
    if (runner === undefined) return
    expect(voteBar(own, adult.id, officeId, own.tick)).toBeNull()
    expect(castVote(own, adult.id, officeId, runner.personId, own.tick)).toBe(true)
    // And not twice.
    expect(voteBar(own, adult.id, officeId, own.tick)).toContain('already voted')
    expect(castVote(own, adult.id, officeId, runner.personId, own.tick)).toBe(false)
  })
})

describe('standing for office', () => {
  /** An open local race, and somebody who could stand in it. */
  function aRace(): { world: World; officeId: string; runner: Person } | undefined {
    const own = createWorld(makeSeed(909), 300)
    for (let i = 0; i < 20 * 12; i++) {
      advanceTicks(own, 1)
      const officeId = [...own.elections.keys()].find(
        (id) => id === 'council' || id === 'school-board',
      )
      if (officeId === undefined) continue
      const runner = livingPeople(own).find((p) => {
        const age = ageAt(p.birthTick, own.tick)
        return age >= 25 && age < 60
      })
      if (runner === undefined) continue
      return { world: own, officeId, runner }
    }
    return undefined
  }

  it('puts a newcomer at the bottom of the poll', () => {
    // Nobody has heard of them. Climbing out of that IS the campaign,
    // which is the point of there being one.
    const found = aRace()
    expect(found).toBeDefined()
    if (found === undefined) return
    const { world: own, officeId, runner } = found
    expect(candidacyBar(own, runner.id, officeId, own.tick)).toBeNull()
    expect(declareCandidacy(own, runner.id, officeId, own.tick)).toBe(true)
    const mine = myCandidacy(own, runner.id)
    expect(mine).toBeDefined()
    const best = Math.max(...(mine?.election.runners.map((r) => r.polling) ?? [0]))
    expect(mine?.polling ?? 0).toBeLessThanOrEqual(best)
  })

  it('turns money into reach, and refuses when there is none', () => {
    // Only advertising costs anything, which is what makes the war chest
    // mean something. MEASURED: two fundraisers built $3,435 and took
    // polling from 75 to 115 with an ad buy and a rally.
    const found = aRace()
    if (found === undefined) return
    const { world: own, officeId, runner } = found
    declareCandidacy(own, runner.id, officeId, own.tick)

    // Broke: the refusal is honest rather than a free rally in disguise.
    expect(campaign(own, runner.id, officeId, 'advertise', own.tick)).toBe(false)

    expect(campaign(own, runner.id, officeId, 'fundraise', own.tick)).toBe(true)
    expect(campaign(own, runner.id, officeId, 'fundraise', own.tick)).toBe(true)
    const chest = myCandidacy(own, runner.id)?.election.warChest ?? 0
    expect(chest).toBeGreaterThan(0)

    const before = myCandidacy(own, runner.id)?.polling ?? 0
    expect(campaign(own, runner.id, officeId, 'advertise', own.tick)).toBe(true)
    expect(myCandidacy(own, runner.id)?.polling ?? 0).toBeGreaterThan(before)
    // And it cost something.
    expect(myCandidacy(own, runner.id)?.election.warChest ?? 0).toBeLessThan(chest)
  })

  it('wins over the undecided before it takes anybody else’s votes', () => {
    // A campaign that took points straight off an opponent would be a tug
    // of war. A real one wins over the people who have not made up their
    // minds, and only then starts overtaking somebody.
    const found = aRace()
    if (found === undefined) return
    const { world: own, officeId, runner } = found
    declareCandidacy(own, runner.id, officeId, own.tick)
    const opponentsBefore = (myCandidacy(own, runner.id)?.election.runners ?? [])
      .filter((r) => r.personId !== runner.id)
      .reduce((sum, r) => sum + r.polling, 0)

    campaign(own, runner.id, officeId, 'rally', own.tick)
    const opponentsAfter = (myCandidacy(own, runner.id)?.election.runners ?? [])
      .filter((r) => r.personId !== runner.id)
      .reduce((sum, r) => sum + r.polling, 0)
    // A single rally is smaller than the undecided share, so nobody lost a
    // vote for it.
    expect(opponentsAfter).toBe(opponentsBefore)
  })

  it('tells a would-be candidate what is in the way', () => {
    // The bar pattern: the Mayor's office wants a Councillor or School
    // Board member behind you, and says so rather than greying out.
    const found = aRace()
    if (found === undefined) return
    const { world: own } = found
    const child = livingPeople(own).find((p) => ageAt(p.birthTick, own.tick) < 18)
    if (child === undefined) return
    const bar = candidacyBar(own, child.id, found.officeId, own.tick)
    expect(bar).not.toBeNull()
    expect(bar).toContain('to stand for')
  })
})

describe('the ladder above the town', () => {
  const tall = createWorld(makeSeed(4141), 400)
  advanceTicks(tall, 80 * 12)

  it('fills every tier, not just the local one', () => {
    // A ladder whose upper rungs are decorative is not a ladder. The
    // spec's point is that each step needs a record behind it, and a
    // record is worthless with nothing above to climb to.
    // THE CLAIM IS THAT EVERY TIER GETS HELD, not that all nine seats are
    // occupied at one instant. MEASURED at eighty years: seven of nine
    // filled, with the legislature and the presidency mid-election. A
    // seat between terms is the calendar working.
    expect(SEATED_OFFICES.length).toBeGreaterThan(6)
    const everHeld = new Set(
      tall.events.filter((e) => e.type === 'took-office').map((e) => e.detail ?? ''),
    )
    for (const tier of ['mayor', 'legislator', 'governor', 'representative', 'senator']) {
      expect(everHeld, `${tier} was never held by anybody`).toContain(tier)
    }
  })

  it('produces careers, not appointments', () => {
    // MEASURED over eighty years: nineteen people held more than one
    // office, and the sitting president's own path read school board ->
    // state legislator -> U.S. representative -> governor -> president.
    // That is emergent from `needsPrior`, not scripted.
    let climbers = 0
    for (const person of tall.people.values()) {
      if (heldOffices(tall, person.id).length > 1) climbers += 1
    }
    expect(climbers).toBeGreaterThan(2)
  })

  it('never seats a president who has held nothing', () => {
    // READ FROM THE LEDGER, not from current occupancy. A seat between
    // terms is the calendar working, and the presidency is vacant in this
    // world at this tick — which made three tests fail for a reason that
    // had nothing to do with what they were checking.
    const sworn = tall.events.filter((e) => e.type === 'took-office' && e.detail === 'president')
    expect(sworn.length, 'nobody ever became president').toBeGreaterThan(0)
    const wants = officeById('president')?.needsPrior ?? []
    for (const event of sworn) {
      const held = heldOffices(tall, event.subjectId)
      expect(
        held.some((id) => wants.includes(id)),
        'somebody reached the presidency with no prior office',
      ).toBe(true)
    }
  })

  it('gives the presidency the levers the spec asks for', () => {
    const levers = leversOf('president')
    expect(levers).toContain('incomeTaxPerMille')
    expect(levers).toContain('militaryBudget')
    // And nobody else commands the armed forces.
    const mayor = tall.officials.get('mayor')
    if (mayor !== undefined) {
      expect(warPowerBar(tall, mayor.personId)).toContain('President')
    }
  })

  it('cannot conjure a war, only push for the end of one', () => {
    // Wars here start from bloc rivalry, resource competition and old
    // grudges — the factors are in the causal records. A president who
    // could declare one from a button would make all of that decoration.
    // Suing for peace can FAIL, because the other side has a say.
    const noWar = createWorld(makeSeed(4141), 200)
    advanceTicks(noWar, 12)
    const home = homeland(noWar)
    expect(home).toBeDefined()
    if (home === undefined) return
    expect(sueForPeace(noWar, noWar.tick, home.id)).toBe(false)
  })
})

describe('corruption', () => {
  it('never investigates somebody clean', () => {
    // The spec insists the honest path stays "fully viable", and that only
    // holds if being clean is genuinely SAFE rather than merely
    // lower-risk. Exposure is the only input to the odds.
    const own = createWorld(makeSeed(4141), 300)
    advanceTicks(own, 40 * 12)
    for (const holder of own.officials.values()) {
      if ((holder.exposure ?? 0) > 0) continue
      const investigated = own.events.some(
        (e) => e.type === 'investigated' && e.subjectId === holder.personId,
      )
      expect(investigated, 'a clean officeholder was investigated').toBe(false)
    }
  })

  it('pays real money and leaves a real trail', () => {
    const own = createWorld(makeSeed(4141), 300)
    advanceTicks(own, 30 * 12)
    const mayor = own.officials.get('mayor')
    expect(mayor).toBeDefined()
    if (mayor === undefined) return

    // The graft lands in the mayor's WALLET (H0) — a married official's
    // money lives on the joint record, not their personal file.
    const before = walletOf(own, mayor.personId).savings + walletOf(own, mayor.personId).checking
    let credited = 0
    const took = takeGraft(own, mayor.personId, 'rezoning', own.tick, (id, amount) => {
      credited += amount
      creditPerson(own, id, amount)
    })
    expect(took).toBeGreaterThan(0)
    expect(credited).toBe(took)
    // The money is REQUESTED, never written here — the same single-writer
    // rule everything else obeys.
    expect(walletOf(own, mayor.personId).savings + walletOf(own, mayor.personId).checking)
      .toBeGreaterThan(before)
    // And it is on the file.
    expect(own.officials.get('mayor')?.exposure ?? 0).toBeGreaterThan(0)
    expect(own.events.some((e) => e.type === 'took-graft')).toBe(true)
  })

  it('is worth more at the top, and no safer', () => {
    // A president's signature on a defence contract is worth more than a
    // mayor's on a rezoning. A small town notices things a capital does
    // not, so the exposure does not scale down with the seat.
    const offer = graftById('contract')
    expect(offer).toBeDefined()
    expect(offer?.exposure ?? 0).toBeGreaterThan(0)
    for (const each of GRAFT_OFFERS) {
      expect(each.payoff).toBeGreaterThan(0)
      expect(each.exposure).toBeGreaterThan(0)
      expect(each.line.length).toBeGreaterThan(30)
    }
  })
})

describe('policy', () => {
  it('starts somewhere sane and moves toward whoever won', () => {
    // MEASURED after sixty years under a Progress mayor: tax 14 -> 21,
    // schools 500 -> 793, police 500 -> 457. The levers CONVERGE on the
    // party's lean rather than snapping to it, because a term is not long
    // enough to remake a town and a government that swung the whole range
    // every four years would make the levers noise rather than policy.
    const fresh = freshPolicy()
    expect(fresh.propertyTaxPerMille).toBeGreaterThan(0)
    expect(fresh.policeFunding).toBe(500)
    expect(fresh.schoolFunding).toBe(500)

    const mayor = world.officials.get('mayor')
    const party = mayor === undefined ? undefined : partyById(mayor.partyId)
    expect(party).toBeDefined()
    if (party === undefined) return
    const moved = world.policy.schoolFunding - 500
    const wanted = party.schoolLean - 500
    if (Math.abs(wanted) > 100) expect(Math.sign(moved)).toBe(Math.sign(wanted))
  })

  it('reaches a household bill — the first lever actually wired', () => {
    // Phase 2, step 1 of the plan: property tax into real estate. This is
    // the Law-4 payoff and the point of the whole module — who won an
    // election changes what your house costs you.
    //
    // MEASURED: under a Heritage mayor the rate sat at 13 (drifting down
    // from earlier Progress administrations, so policy has HISTORY), and
    // forcing the lever to the top of its range took a homeowner's
    // monthly cost from $545 to $1,053.
    const property = [...world.properties.values()][0]
    expect(property).toBeDefined()
    if (property === undefined) return

    const cheap = ownershipCostOf(
      { ...world, policy: { ...world.policy, propertyTaxPerMille: 5 } } as never,
      property,
      0 as never,
    )
    const dear = ownershipCostOf(
      { ...world, policy: { ...world.policy, propertyTaxPerMille: 40 } } as never,
      property,
      0 as never,
    )
    expect(dear.propertyTax).toBeGreaterThan(cheap.propertyTax * 3)
    expect(dear.total).toBeGreaterThan(cheap.total)
  })

  it('starts at the rate real estate already charged', () => {
    // The wiring changed nobody's bill on the day it landed. Starting the
    // lever anywhere other than the constant it replaced would have been
    // a rate change smuggled in with the wire, and a golden shift with
    // two causes instead of one.
    expect(freshPolicy().propertyTaxPerMille).toBe(11)
  })

  it('puts police funding into whether crimes get solved', () => {
    // Phase 2, step 2. Constables are the PEOPLE; funding is the hours,
    // the vehicles and the forensics behind them.
    //
    // MEASURED: 0 -> 0, 250 -> 87, 500 -> 174, 1000 -> 348. The default
    // of 500 reproduces exactly what this returned before the lever
    // existed, so the wiring changed no outcome on the day it landed.
    const at = (n: number): number =>
      clearanceBonusOf({ ...world, policy: { ...world.policy, policeFunding: n } } as never)
    expect(at(0)).toBe(0)
    expect(at(1000)).toBeGreaterThan(at(500))
    expect(at(500)).toBeGreaterThan(at(250))
  })

  it('puts school funding into state-schooled children, and only them', () => {
    // Phase 2, step 3. MEASURED over twenty-five years with the lever
    // held: starved 486, default 529, funded 570 — an 84-point spread
    // against a private-school premium of 90. A town starving its schools
    // is visible in its children without overwhelming who they are.
    //
    // A STATE-SCHOOLED CHILD ONLY. The whole point of paying for a
    // private education is that it does not depend on what the council
    // decided this year, and a lever moving both would make the private
    // premium meaningless.
    const hold = (funding: number): number => {
      const own = createWorld(makeSeed(4141), 200)
      for (let i = 0; i < 20 * 12; i++) {
        ;(own as { policy: typeof own.policy }).policy = { ...own.policy, schoolFunding: funding }
        advanceTicks(own, 1)
      }
      const marks: number[] = []
      for (const person of own.people.values()) {
        if (person.deathTick !== null) continue
        const record = own.education.get(person.id)
        if (record?.schooling !== 'public') continue
        marks.push(record.attainment)
      }
      return marks.length === 0 ? -1 : marks.reduce((a, b) => a + b, 0) / marks.length
    }
    expect(hold(1000)).toBeGreaterThan(hold(0))
  }, 300_000)

  it('puts the federal rate into what a wage actually keeps', () => {
    // Phase 2, step 4 — the last lever, and the one that reaches
    // everybody rather than only homeowners, only the policed or only
    // state-schooled children.
    //
    // SCALED IN PROPORTION so the schedule keeps its shape. Flattening
    // every band to one rate would turn a progressive system into a flat
    // one the moment a government touched it, which is not what a rate
    // change is.
    const wage = 400_000 as never
    const low = withholdingFor(wage, 1000, 110)
    const base = withholdingFor(wage, 1000, BASELINE_INCOME_RATE)
    const high = withholdingFor(wage, 1000, 440)
    expect(low).toBeLessThan(base)
    expect(high).toBeGreaterThan(base)

    // The default reproduces the schedule exactly as it was written, so
    // the wiring changed nobody's bill on the day it landed.
    expect(withholdingFor(wage, 1000)).toBe(base)
    // And it stays progressive: a big earner keeps paying a larger share
    // than a small one at every setting.
    const small = 200_000 as never
    const shareSmall = (withholdingFor(small, 1000, 440) * 1000) / small
    const shareBig = (withholdingFor(wage, 1000, 440) * 1000) / wage
    expect(shareBig).toBeGreaterThan(shareSmall)
  })

  it('never seats one person in two offices at once', () => {
    // A REAL BUG THIS FOUND. `drawRunners` did not exclude sitting
    // officeholders, so the mayor also won the school board — and every
    // lookup-by-person then became ambiguous. `setLever` picked whichever
    // seat came first and wrote the mayor's approval onto the school
    // board, which is why raising a tax appeared to cost nothing.
    const held = new Map<number, string>()
    for (const [officeId, holder] of world.officials) {
      const already = held.get(holder.personId)
      expect(already, `${String(holder.personId)} holds ${String(already)} and ${officeId}`).toBeUndefined()
      held.set(holder.personId, officeId)
    }
  })

  it('lets an officeholder set only their own levers, and says whose it is', () => {
    const mayor = world.officials.get('mayor')
    const sheriff = world.officials.get('sheriff')
    expect(mayor).toBeDefined()
    if (mayor === undefined) return
    expect(leversOf('mayor')).toContain('propertyTaxPerMille')
    expect(leverBar(world, mayor.personId, 'propertyTaxPerMille')).toBeNull()
    if (sheriff !== undefined) {
      // Told whose it is, rather than shown a slider that does nothing.
      expect(leverBar(world, sheriff.personId, 'propertyTaxPerMille')).toContain('Mayor')
    }
  })

  it('makes approval answer for a decision', () => {
    // The mockup writes the trade-off under every lever, and it should: a
    // knob with no stated consequence is a cheat code. A tax rise costs
    // approval even when it pays for something popular, because the bill
    // arrives before the school does.
    const own = createWorld(makeSeed(4141), 300)
    advanceTicks(own, 30 * 12)
    const mayor = own.officials.get('mayor')
    if (mayor === undefined) return

    const before = own.officials.get('mayor')?.approval ?? 0
    expect(setLever(own, mayor.personId, 'schoolFunding', 900, own.tick)).toBe(true)
    const funded = own.officials.get('mayor')?.approval ?? 0
    expect(funded).toBeGreaterThan(before)

    expect(setLever(own, mayor.personId, 'propertyTaxPerMille', 38, own.tick)).toBe(true)
    expect(own.officials.get('mayor')?.approval ?? 0).toBeLessThan(funded)
  })

  it('will not let a town have everything for nothing', () => {
    // Fund everything and tax nobody and the budget goes under, which is
    // the other half of governing.
    const own = createWorld(makeSeed(4141), 300)
    advanceTicks(own, 30 * 12)
    const mayor = own.officials.get('mayor')
    if (mayor === undefined) return
    setLever(own, mayor.personId, 'schoolFunding', 1000, own.tick)
    setLever(own, mayor.personId, 'policeFunding', 1000, own.tick)
    setLever(own, mayor.personId, 'propertyTaxPerMille', 0, own.tick)
    expect(townBudget(own)).toBeLessThan(0)
  })

  it('writes the trade-off beside every lever it offers', () => {
    for (const lever of leversOf('mayor')) {
      expect(LEVER_NOTES[lever], `${lever} has no note`).toBeDefined()
      expect(LEVER_RANGE[lever], `${lever} has no range`).toBeDefined()
    }
  })

  it('gives every party a design token rather than a colour', () => {
    // The lesson from the restyle: the mockups carry their own palette,
    // and this app has semantic tokens and a light mode. A hex here would
    // be a dark dot on a white page.
    for (const party of PARTIES) {
      expect(['accent', 'bad', 'ok']).toContain(party.tone)
      expect(party.name).not.toContain('#')
    }
  })
})
