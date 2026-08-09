import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/worldgen.js'
import { planBirth, registerBirth, seedFromName } from '../src/birth.js'

/**
 * A NEW LIFE HAS TO BE A NEW FAMILY.
 *
 * The owner, playing: "everytime you start a new life the NPC family doesn't
 * start with a job and they are also named the same everytime".
 *
 * The second half was this: with no registry code typed, the birth seed was
 * `givenName.length * 977 + familyName.length * 131`. Lengths only. Real
 * names cluster around the same few lengths, so "John Smith" and "Mark
 * Jones" — both four-and-five — seeded identically and produced the same
 * mother, father and siblings. The family looked hard-coded because, for
 * most inputs, it effectively was.
 */
describe('the birth seed', () => {
  it('differs for names of the same length', () => {
    // The exact collision the owner hit: same lengths, different people.
    expect(seedFromName('John', 'Smith')).not.toBe(seedFromName('Mark', 'Jones'))
  })

  it('is stable for the same name, so a registry code still means something', () => {
    expect(seedFromName('John', 'Smith')).toBe(seedFromName('John', 'Smith'))
    // Typed casually — a name is not a password.
    expect(seedFromName(' john ', 'SMITH')).toBe(seedFromName('John', 'Smith'))
  })

  it('gives a different family to different players', () => {
    // NOT A SPOT CHECK. The old scheme passed any single comparison you
    // happened to pick that differed in length; what it failed was VOLUME.
    // So: a spread of ordinary names, and the parents' names must vary
    // across them rather than collapsing onto one family.
    const world = createWorld(makeSeed(4242))
    const names: readonly (readonly [string, string])[] = [
      ['John', 'Smith'],
      ['Mark', 'Jones'],
      ['Anna', 'Brown'],
      ['Paul', 'Davis'],
      ['Ruth', 'Clark'],
      ['Dean', 'Evans'],
      ['Kate', 'Floyd'],
      ['Neil', 'Grant'],
    ]

    const families = new Set<string>()
    for (const [given, family] of names) {
      const plan = planBirth(
        world,
        {
          givenName: given,
          familyName: family,
          sex: 'male',
          placeId: null,
          station: null,
          birthTick: null,
        },
        seedFromName(given, family),
      )
      // The parents' GIVEN names are what the player actually reads on the
      // certificate — the surname is theirs by construction.
      const parents = plan.family
        .filter((member) => member.relation === 'father' || member.relation === 'mother')
        .map((member) => member.givenName)
        .join('+')
      families.add(parents)
    }

    // Eight names, and the old scheme collapsed most of them together.
    // Six distinct parent-pairs is a low bar that it could not clear.
    expect(families.size).toBeGreaterThanOrEqual(6)
  })
})

/**
 * THE OTHER HALF OF THE SAME REPORT: "the NPC family doesn't start with a
 * job". They were written into a running world with no employment record at
 * all, and `runEmployment` — a monthly pass with a chance gate — would not
 * reach them before the player read the certificate.
 */
describe('the birth family', () => {
  it('has grown-ups who work', () => {
    let employedParents = 0
    let parents = 0
    for (const [given, family] of [
      ['John', 'Smith'],
      ['Anna', 'Brown'],
      ['Paul', 'Davis'],
      ['Ruth', 'Clark'],
      ['Neil', 'Grant'],
    ] as const) {
      const world = createWorld(makeSeed(4242))
      const plan = planBirth(
        world,
        { givenName: given, familyName: family, sex: 'male', placeId: null, station: null, birthTick: null },
        seedFromName(given, family),
      )
      const childId = registerBirth(world, plan, seedFromName(given, family))
      expect(childId).not.toBeNull()
      if (childId === null) continue
      const child = world.people.get(childId)
      const householdId = child?.householdId ?? null
      expect(householdId).not.toBeNull()
      if (householdId === null) continue
      for (const memberId of world.households.get(householdId)?.memberIds ?? []) {
        const person = world.people.get(memberId)
        if (person === undefined) continue
        // Parents only — a newborn and a small sibling should NOT have work,
        // and a test that counted them would pass on the wrong thing.
        const age = (world.tick - person.birthTick) / 12
        if (age < 18) continue
        parents += 1
        if (world.employment.has(memberId)) employedParents += 1
      }
    }
    expect(parents).toBeGreaterThan(5)
    // Not everybody: `hireIntoStartingWork` honestly says no when nothing
    // fits, and some people are not employed. But it was ZERO before.
    expect(employedParents).toBeGreaterThan(parents / 2)
  })
})
