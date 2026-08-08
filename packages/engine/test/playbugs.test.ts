/**
 * Three things the owner hit while actually playing.
 *
 * All three are the same shape of mistake: a rule that was right about
 * the thing it was looking at, and blind to the person's actual situation.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { raisePending } from '../src/player.js'

const world = createWorld(makeSeed(4141), 400)
advanceTicks(world, 50 * 12)

describe('nobody conceives a child from another country', () => {
  it('never records a birth to a parent who was away when it started', () => {
    // Owner: "when I was deployed yesterday my wife and I had a kid
    // because the popup came up... how could we possibly have a kid when
    // im deployed to another country".
    //
    // The model had every reason a couple might NOT start a family —
    // money, age, the plan agreed at the wedding — and no notion of
    // whether the two of them were in the same country.
    let checked = 0
    for (const person of world.people.values()) {
      const [motherId, fatherId] = person.parentIds
      if (motherId === undefined || fatherId === undefined) continue
      // NO GESTATION IS MODELLED — `deliverChild` writes `birthTick: tick`
      // at the moment the roll succeeds, so the month of the birth IS the
      // month of the decision, and that is the month to ask about. The
      // first version of this test subtracted nine months for a pregnancy
      // this simulation does not have, and failed on births that were
      // perfectly legitimate.
      const conceived = person.birthTick as number
      if (conceived < 0) continue
      for (const parentId of [motherId, fatherId]) {
        const tours = world.deployments.get(parentId) ?? []
        for (const tour of tours) {
          const left = tour.startedAtTick
          const back = tour.returnedAtTick
          if (left === undefined || left === null) continue
          // A tour that had begun and had not ended by the month of
          // conception means this child was started while a parent was on
          // the other side of the world.
          const away = conceived > left && (back === null || conceived < back)
          expect(away).toBe(false)
          checked += 1
        }
      }
    }
    // The claim is worthless if no deployed parent was ever examined.
    expect(checked).toBeGreaterThan(0)
  })
})

describe('a refusal lasts', () => {
  it('does not ask the same life question again the very next month', () => {
    // Owner: "if you turn it down and wait itll just keep asking, same
    // thing with turning down a kid". A "no" used to change nothing at
    // all — the roll behind the question came round again next month, so
    // the only way to stop being asked was to say yes.
    const own = createWorld(makeSeed(909), 300)
    advanceTicks(own, 20 * 12)
    const adult = [...own.people.values()].find(
      (person) => person.deathTick === null && ageAt(person.birthTick, own.tick) > 20,
    )
    expect(adult).toBeDefined()
    if (adult === undefined) return

    own.player.personId = adult.id
    own.player.pending = null
    own.player.declinedAtTick = { child: own.tick }

    // The cooldown is on the KIND, so a raise of that kind is refused
    // while it stands — whichever of the fifteen sites tries it.
    const raised = raisePending(own, {
      tick: own.tick,
      kind: 'child',
      personId: adult.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['accept', 'decline'],
    })
    expect(raised).toBe(false)
    expect(own.player.pending).toBeNull()
  })

  it('lets a life change its mind eventually', () => {
    // Long enough that a no is respected, short enough that a couple who
    // did not want a child at twenty-two may want one at twenty-four.
    const own = createWorld(makeSeed(909), 300)
    advanceTicks(own, 20 * 12)
    const adult = [...own.people.values()].find(
      (person) => person.deathTick === null && ageAt(person.birthTick, own.tick) > 20,
    )
    expect(adult).toBeDefined()
    if (adult === undefined) return

    own.player.personId = adult.id
    own.player.pending = null
    own.player.declinedAtTick = { child: (own.tick - 60) as never }
    expect(
      raisePending(own, {
        tick: own.tick,
        kind: 'child',
        personId: adult.id,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline'],
      }),
    ).toBe(true)
  })

  it('still asks about a different job after refusing one', () => {
    // Not every question should stick. A job offer is about a SPECIFIC
    // job and the next one is a different opportunity — putting it on the
    // cooldown table would have turned one "no thanks" into a year of
    // unemployment.
    const own = createWorld(makeSeed(909), 300)
    advanceTicks(own, 20 * 12)
    const adult = [...own.people.values()].find(
      (person) => person.deathTick === null && ageAt(person.birthTick, own.tick) > 20,
    )
    expect(adult).toBeDefined()
    if (adult === undefined) return

    own.player.personId = adult.id
    own.player.pending = null
    own.player.declinedAtTick = { 'job-offer': own.tick }
    expect(
      raisePending(own, {
        tick: own.tick,
        kind: 'job-offer',
        personId: adult.id,
        otherId: null,
        occupationId: 'labourer',
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['accept', 'decline', 'wait'],
      }),
    ).toBe(true)
  })
})
