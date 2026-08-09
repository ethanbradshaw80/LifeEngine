import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { ageAt } from '../src/clock.js'
import { enlistPerson } from '../src/service.js'
import { SPECIALTIES } from '../src/content.js'
import { resolvePending, setPlayer, takeExtraDuty } from '../src/player.js'

/**
 * THE THIRD REPORT'S SCENARIO, END TO END (owner, in capitals: "STILL
 * GETTING THE X NEXT TO STANDING MEETS BAR AFTER SCORING HIGH ON FITNESS
 * TEST AND DOING EXTRA DUTY FOR YEARS").
 *
 * The first probe of this bug measured the wrong player: it clicked extra
 * duty every single time the six-month cooldown opened, and at that click
 * rate the old system worked — which is exactly why two "fixes" shipped
 * and the report came back twice. The owner plays in YEAR STEPS. One click
 * a year under the old model held a fraction of the boost and the drift
 * spring ate it.
 *
 * So this test plays like the owner: take up the load ONCE, then age in
 * whole years. The commitment has to do the work.
 */
describe('standing for a year-step player', () => {
  it('a median soldier who carries the load clears the schoolhouse bars', () => {
    const world = createWorld(makeSeed(4242))
    const person = [...world.people.values()].find((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return (
        p.deathTick === null && age >= 18 && age <= 24 && Math.abs(p.traits.diligence - 500) < 80
      )
    })
    expect(person).toBeDefined()
    if (!person) return

    setPlayer(world, person.id)
    const specialty = SPECIALTIES.find((s) => s.id === 'rifleman') ?? SPECIALTIES[0]!
    enlistPerson(world, world.tick, person, specialty, [])

    // ONE decision, the way a commitment should be.
    expect(takeExtraDuty(world).done).toBe(true)

    for (let year = 0; year < 10; year += 1) {
      for (let month = 0; month < 12; month += 1) {
        for (let guard = 0; guard < 6 && world.player.pending !== null; guard += 1) {
          resolvePending(world, world.player.pending.options[0] ?? 'yes')
        }
        advanceTicks(world, 1)
      }
    }

    const record = world.service.get(person.id)
    // Discharged along the way (misconduct roll, medical) would make the
    // claim vacuous — the test must know, not shrug.
    expect(record).toBeDefined()
    if (!record) return
    expect(record.dischargedAtTick).toBeNull()

    // The tier the owner kept being refused: sniper 600, EOD/freefall/
    // jumpmaster 620. Ten years of carried load must clear it.
    expect(record.performance).toBeGreaterThanOrEqual(620)
  }, 600_000)
})
