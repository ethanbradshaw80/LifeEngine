/**
 * WHAT A WOUND IS LIKE (plan §4.4c).
 *
 * OWNER: "we also need to change up the 'you were hit - the shoulder - its
 * bad' writting too this sucks this needs to be way more in detail and
 * descriptive as well."
 *
 * §4.4c asks for four things, and the test holds all four: what hit him,
 * where and what is under it, what it cost to get him out, and what he is
 * like afterwards.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Tick } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { evacMinutes, tierOfSeverity, woundStory } from '../src/woundwords.js'
import type { BodySite, InjuryKind } from '../src/types.js'

const KINDS: readonly InjuryKind[] = [
  'gunshot', 'shrapnel', 'blast', 'burns', 'crush', 'fracture', 'concussion',
  'laceration', 'amputation', 'hearing-damage', 'spinal-injury',
  'internal-injury', 'eye-injury', 'electrocution', 'chemical-burns',
  'smoke-inhalation', 'heatstroke', 'frostbite', 'near-drowning', 'animal-bite',
]
const SITES: readonly BodySite[] = ['leg', 'arm', 'hand', 'chest', 'head', 'back', 'shoulder', 'foot']

describe('the wound, written', () => {
  it('says all four things for every mechanism and every site', () => {
    for (const kind of KINDS) {
      for (const site of SITES) {
        const story = woundStory(kind, site, 620, 45)
        // Four paragraphs at tier 4: mechanism, anatomy, the evacuation, after.
        expect(story.lines.length, `${kind}/${site} is thin`).toBe(4)
        for (const line of story.lines) {
          // Not a label. The old version printed the site and stopped.
          expect(line.length, `${kind}/${site}: "${line}"`).toBeGreaterThan(40)
        }
        // WHERE, AND WHAT IS UNDER IT — the site is described, not named.
        expect(story.lines[1]).toContain(site === 'leg' ? 'thigh' : site)
        // WHAT IT COST TO GET HIM OUT: the minutes are on the page.
        expect(story.lines[2]).toContain('45')
      }
    }
  })

  it('does not describe an evacuation for a man who was never evacuated', () => {
    // A near miss and a scratch have no ride, and inventing one would be the
    // same fault as printing three words for a serious wound.
    for (const severity of [40, 200]) {
      const story = woundStory('gunshot', 'arm', severity, 90)
      expect(story.lines.some((line) => line.includes('90'))).toBe(false)
    }
    // And a serious one always does.
    expect(woundStory('gunshot', 'arm', 620, 90).lines.some((l) => l.includes('90'))).toBe(true)
  })

  it('reads the tier off severity rather than drawing it again', () => {
    // The design decision recorded in the module: wiring casualty.ts as the
    // DECIDER would re-roll every wound through a second distribution, and
    // its own comments record that going wrong once at 57% tour-ending.
    expect(tierOfSeverity(0)).toBe(1)
    expect(tierOfSeverity(119)).toBe(1)
    expect(tierOfSeverity(120)).toBe(2)
    expect(tierOfSeverity(479)).toBe(3)
    // The line that matters: 3 stays, 4 goes on the aircraft.
    expect(tierOfSeverity(480)).toBe(4)
    expect(tierOfSeverity(899)).toBe(5)
    expect(tierOfSeverity(1000)).toBe(6)
    // Monotone, so a worse wound is never a lesser tier.
    let last = 0
    for (let severity = 0; severity <= 1000; severity += 7) {
      const tier = tierOfSeverity(severity)
      expect(tier).toBeGreaterThanOrEqual(last)
      last = tier
    }
  })

  it('gives the same wounding the same minutes for ever, and a medic halves them', () => {
    const world = createWorld(makeSeed(4242), 100)
    const anybody = [...world.people.values()][0]
    if (anybody === undefined) return
    const alone = evacMinutes(world, anybody.id, 300 as Tick, false)
    const withMedic = evacMinutes(world, anybody.id, 300 as Tick, true)
    expect(evacMinutes(world, anybody.id, 300 as Tick, false)).toBe(alone)
    expect(withMedic).toBeLessThan(alone)
    expect(withMedic).toBeGreaterThanOrEqual(6)
  })
})
