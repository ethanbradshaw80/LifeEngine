/**
 * HURT EIGHT TIMES, AND WHAT IT IS WORTH.
 *
 * THE OWNER'S REPORT: "You should only be med boarded in the military if have
 * serious injuries like limbs blown off and stuff like that not based off the
 * percentage but yeah I had playthroughs where I got hurt like 8 times and
 * only got 20%."
 *
 * Both halves of that were true and they had the same cause: the game asked
 * ONE question where reality asks two. `disability` is a lifetime cumulative
 * counter that only ever rises, and the medical board read it — so a man
 * wounded, healed and returned to duty eight times was separated by the
 * arithmetic of his own history while nothing was actually wrong with him.
 * Meanwhile three gates upstream meant most of those wounds left no rating at
 * all: a severity floor of 500, a roughly one-in-four roll, and a divisor
 * worth 7.8% when it did land.
 *
 * This test is his playthrough, run deliberately.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { healthOf, inflictWound } from '../src/health.js'
import { openStream, Stream } from '../src/rng.js'
import { livingPeople } from '../src/systems.js'

/** Wound somebody, then let the body finish with it. */
function woundAndHeal(
  world: ReturnType<typeof createWorld>,
  personId: EntityId,
  severity: number,
  salt: number,
): void {
  const rng = openStream(world.seed, Stream.Health, personId, 90_000 + salt)
  inflictWound(world, world.tick, personId, severity, 'direct-combat', rng)
  // Long enough for the ailment to resolve and whatever it left to accrue.
  for (let i = 0; i < 60 && healthOf(world, personId)?.ailment !== null; i += 1) {
    advanceTicks(world, 1)
  }
}

function aGrownSoldier(world: ReturnType<typeof createWorld>): EntityId | undefined {
  return livingPeople(world)
    .filter((p) => world.service.has(p.id))
    .sort((a, b) => a.id - b.id)[0]?.id
}

describe('eight wounds', () => {
  it('adds up to a rating a man would recognise', () => {
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 20 * 12)
    const personId = aGrownSoldier(world)
    expect(personId, 'nobody is serving in this world').toBeDefined()
    if (personId === undefined) return

    // Eight real wounds — the kind somebody walks away from. None of them is
    // a lost limb; that is the point.
    const severities = [420, 560, 380, 640, 300, 520, 470, 600]
    for (let i = 0; i < severities.length; i += 1) {
      woundAndHeal(world, personId, severities[i] ?? 400, i)
    }

    const rating = healthOf(world, personId)?.disability ?? 0
    /**
     * MEASURED BEFORE THE FIX: this sequence produced about 20%, which is
     * exactly what he reported. The band below is deliberately wide — the
     * claim is "a career of wounds is worth something", not a particular
     * number — but it refuses both the old outcome and a runaway.
     */
    expect(rating, `eight wounds came to ${String(Math.round(rating / 10))}%`).toBeGreaterThan(300)
    expect(rating, `eight wounds came to ${String(Math.round(rating / 10))}%`).toBeLessThanOrEqual(1000)
  })

  it('does not board him out for surviving them', () => {
    /**
     * THE OTHER HALF, and the one he felt as unfair. Healed wounds are not a
     * reason to end a career: the service asks whether you can still do the
     * job, and eight scars answer yes. Only a permanent, duty-ending
     * condition — a limb, a spine — separates anybody now.
     */
    const world = createWorld(makeSeed(4242), 200)
    advanceTicks(world, 20 * 12)
    const personId = aGrownSoldier(world)
    if (personId === undefined) return

    const severities = [420, 560, 380, 640, 300, 520, 470, 600]
    for (let i = 0; i < severities.length; i += 1) {
      woundAndHeal(world, personId, severities[i] ?? 400, i)
    }
    advanceTicks(world, 12)

    const record = world.service.get(personId)
    const permanent = healthOf(world, personId)?.permanent ?? []
    const dutyEnding = permanent.some(
      (c) => c.kind === 'amputation' || c.kind === 'spinal-injury',
    )
    if (dutyEnding) return // a lost limb legitimately ends it

    /**
     * THE EXEMPTION IS EVERY PERMANENT CONDITION, not only the two that end
     * duty outright — and the message used to lie about which case it was in.
     *
     * §8's board reads the BODY: a limb or a spine ends duty outright, and an
     * eye, a crush or an internal injury is ARGUABLE, so the board considers
     * it and usually retains. Considering an arguable permanent condition is
     * the model working. The owner's actual complaint was never about that: it
     * was that HEALED wounds — scars, and nothing left behind — ended careers
     * by arithmetic. That is the claim, and it is the one made here.
     */
    if (permanent.length > 0) return

    expect(
      record?.dischargeReason,
      `boarded out carrying ${String(Math.round((healthOf(world, personId)?.disability ?? 0) / 10))}% with nothing permanent at all`,
    ).not.toBe('medical')
  })
})
