/**
 * A CHILD CANNOT TAKE A JOB, SIGN A TRUST, OR BUY A LICENCE.
 *
 * THE BUG, reported by a player within hours of the v186 release: "my brother
 * just started playing and he landed a job as a plumber helper at 0 years
 * old."
 *
 * `verbPerson` — the guard EVERY player verb passes through — checked that
 * somebody was alive and that no decision was waiting, and nothing else. The
 * OLD job board asked (`applyForJob` has had `age < 18` all along); the
 * career ladders added a second road into work that did not, and the money
 * verbs built after them inherited the same silence.
 *
 * The ladders made it reachable: `joinBar` gates on schooling, licences and
 * skills; a newborn's schooling is 'none', which satisfies any ladder
 * requiring 'none'; and `paths.test.ts` GUARANTEES an entry rung carries no
 * skill gates. Every ladder open to a school leaver was open to an infant.
 *
 * This test walks the whole family of verbs rather than the one that was
 * reported, because fixing only the reported one is how the second report
 * happens.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { ageAt } from '../src/clock.js'
import { WORKING_AGE } from '../src/content.js'
import { walletOf } from '../src/finances.js'
import { FIRST_SLICE } from '../src/pathcontent.js'
import { causePlaces } from '../src/philanthropy.js'
import {
  commissionBar,
  earnLicencePlayer,
  giveBar,
  joinBar,
  joinPathPlayer,
  setPlayer,
  trustBar,
} from '../src/player.js'
import { livingPeople } from '../src/systems.js'

/** A newborn, made the player, with money in the family purse. */
function anInfant() {
  const world = createWorld(makeSeed(4242), 120)
  advanceTicks(world, 12 * 12)
  const baby = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) === 0)
    .sort((a, b) => a.id - b.id)[0]
  if (!baby) throw new Error('no newborn in this world')
  setPlayer(world, baby.id)
  ;(world.player as { pending: unknown }).pending = null
  const wallet = walletOf(world, baby.id)
  world.accounts.set(wallet.personId, { ...wallet, savings: 900_000_000 as Money })
  return { world, baby }
}

describe('nobody works before they are grown', () => {
  it('refuses every ladder in the game to a newborn, and says why', () => {
    const { world, baby } = anInfant()
    expect(ageAt(baby.birthTick, world.tick)).toBe(0)

    /**
     * EVERY ladder, not a sample. The reported one was plumbing, which is
     * simply the first `requires: 'none'` trade a player is likely to open.
     */
    let open = 0
    for (const path of FIRST_SLICE) {
      const bar = joinBar(world, baby.id, path)
      if (bar === null) open += 1
    }
    expect(open, 'a newborn can still walk into work').toBe(0)

    // And the refusal says the reason, rather than some other one.
    const plumbing = FIRST_SLICE.find((p) => p.id === 'plumbing')
    expect(plumbing).toBeDefined()
    if (!plumbing) return
    expect(joinBar(world, baby.id, plumbing)).toContain('You are 0')
  })

  it('and the verb agrees with the screen', () => {
    // The bar pattern. A card that refuses and a button that does not would
    // be the same bug wearing a different coat.
    const { world, baby } = anInfant()
    const done = joinPathPlayer(world, 'plumbing')
    expect(done.done).toBe(false)
    expect(world.employment.has(baby.id), 'the child was hired anyway').toBe(false)
  })

  it('refuses the papers, the trust, the gift and the builder too', () => {
    /**
     * IT WAS NEVER ONLY THE JOB. A baby could sit a commercial pilot's
     * licence, settle a family trust, endow the county library and
     * commission a manor — every one of those verbs was written to the same
     * guard that let the plumbing through.
     */
    const { world, baby } = anInfant()
    expect(earnLicencePlayer(world, 'cdl').done, 'a newborn bought a licence').toBe(false)
    expect(trustBar(world, baby.id, 50_000_000 as Money)).toContain('You are 0')

    const place = causePlaces(world)[0]
    expect(place).toBeDefined()
    if (place) expect(giveBar(world, baby.id, place.id, 'gift')).toContain('You are 0')

    const street = [...world.places.values()].find((p) => p.kind === 'neighbourhood')
    expect(street).toBeDefined()
    if (street) expect(commissionBar(world, baby.id, street.id, 'house')).toContain('You are 0')
  })

  it('opens up the day they are old enough', () => {
    /**
     * The gate has to OPEN, or it is not a gate. Somebody of working age
     * with no schooling can still walk into a trade that asks for none —
     * which is the whole point of those ladders existing.
     */
    const world = createWorld(makeSeed(4242), 120)
    advanceTicks(world, 25 * 12)
    const grown = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= WORKING_AGE)
      .filter((p) => !world.employment.has(p.id))
      .sort((a, b) => a.id - b.id)[0]
    if (grown === undefined) return
    setPlayer(world, grown.id)
    ;(world.player as { pending: unknown }).pending = null
    const reachable = FIRST_SLICE.filter((path) => joinBar(world, grown.id, path) === null)
    expect(reachable.length, 'nothing is open to a grown adult').toBeGreaterThan(0)
  })
})
