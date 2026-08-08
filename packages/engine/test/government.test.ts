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
import {
  CAMPAIGN_MONTHS,
  OFFICES,
  PARTIES,
  SEATED_OFFICES,
  castVote,
  eligibleFor,
  freshPolicy,
  officeById,
  partyById,
  voteBar,
} from '../src/government.js'
import { livingPeople } from '../src/systems.js'
import { ownershipCostOf } from '../src/realestate.js'
import { clearanceBonusOf } from '../src/crime.js'
import { BASELINE_INCOME_RATE, withholdingFor } from '../src/tax.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 60 * 12)

describe('a government exists', () => {
  it('fills every seat the town has', () => {
    for (const officeId of SEATED_OFFICES) {
      const holder = world.officials.get(officeId)
      expect(holder, `${officeId} is vacant`).toBeDefined()
      if (holder === undefined) continue
      const person = world.people.get(holder.personId)
      expect(person).toBeDefined()
      expect(person?.deathTick).toBeNull()
      expect(partyById(holder.partyId)).toBeDefined()
    }
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
