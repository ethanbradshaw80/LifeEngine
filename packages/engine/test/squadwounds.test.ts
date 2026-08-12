import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { advanceTicks } from '../src/tick.js'
import { inflictWound } from '../src/health.js'
import { openStream, Stream } from '../src/rng.js'

/**
 * A WOUNDED SQUADMATE IS ACTUALLY WOUNDED (live player, on itch: combat
 * "always says 1 person wounded and 8/10 times its me").
 *
 * The player was seeing the truth: `hitSquadmate` recorded a feed line and
 * a mood hit, and never touched the mate's health record. The player was
 * the only person in the squad whose wounds existed, so every evacuation
 * and every decoration was theirs.
 */
describe('wound reality', () => {
  it('inflictWound writes a real ailment with kind-capped severity', () => {
    const world = createWorld(makeSeed(4242))
    advanceTicks(world, 12)
    const personId = [...world.people.keys()][0]!
    const rng = openStream(world.seed, Stream.CombatResolution, personId, 99)

    const wound = inflictWound(world, world.tick, personId, 900, 'direct-combat', rng)
    const record = world.health.get(personId)!

    expect(record.ailment).toBe('injury')
    expect(record.severity).toBeGreaterThan(0)
    // THE CAP CLAIM: whatever kind was drawn, the stored severity and the
    // returned severity agree, and hearing damage can never be graver
    // than hearing damage.
    expect(record.severity).toBe(wound.severity)
    if (wound.kind === 'hearing-damage') {
      expect(wound.severity).toBeLessThanOrEqual(320)
    }
  })

  it('hearing damage is never evacuation-grade, across many draws', () => {
    // THE PLAYER'S EXACT COMPLAINT: evacuated and decorated "for something
    // like blown out hearing". Severity was drawn independently of kind,
    // so the pairing could be nonsense. Roll many combat wounds; every
    // hearing draw must land under the severe-ailment line.
    let hearingDraws = 0
    for (let salt = 0; salt < 400; salt += 1) {
      const world = createWorld(makeSeed(salt % 7))
      const personId = [...world.people.keys()][salt % 20]!
      const rng = openStream(world.seed, Stream.CombatResolution, personId, salt)
      const wound = inflictWound(world, world.tick, personId, 700 + (salt % 300), 'convoy', rng)
      if (wound.kind === 'hearing-damage') {
        hearingDraws += 1
        expect(wound.severity).toBeLessThanOrEqual(320)
      }
    }
    // The claim must have been TESTED, not vacuously skipped.
    expect(hearingDraws).toBeGreaterThan(5)
  })
})
