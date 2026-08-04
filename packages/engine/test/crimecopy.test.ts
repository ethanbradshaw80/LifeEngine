/**
 * THE SCENE MUST MATCH THE CRIME.
 *
 * The bug these assertions exist to make impossible (owner, playing): one
 * generic template was reused for every offence and every answer, so a
 * white-collar crime showed the burglary text — "a shotgun in the dark" —
 * and offered "go for the safe".
 *
 * The claims:
 *   1. Every offence in the catalogue has a danger profile and an authored
 *      scene. There is no default and no fallback to fall into.
 *   2. The options a crime shows match its profile. A fraud is never offered
 *      a heist's choices.
 *   3. No line is empty, and no line leaks a word from the wrong world — a
 *      ledger has no shotgun, a street has no audit.
 *   4. The wording varies by seed, and the facts never do.
 */

import { describe, expect, it } from 'vitest'
import { OFFENCES, offenceById } from '../src/content.js'
import { PROFILE_BANDS, PROFILE_OPTIONS } from '../src/crimecopy.js'
import type { SceneCopy } from '../src/crimecopy.js'
import {
  CRIME_SCENE_OPTIONS,
  copyFor,
  crimeOutcomeFor,
  crimeSceneFor,
  dangerFor,
  decodeCrimeScene,
  encodeCrimeScene,
  profileOf,
} from '../src/crimescene.js'
import type { CrimeDanger } from '../src/crimescene.js'

const BANDS: readonly CrimeDanger[] = ['quiet', 'occupied', 'hot']
const SLOTS: readonly (keyof SceneCopy)[] = [
  'quiet',
  'occupied',
  'hot',
  'bailed',
  'boldClean',
  'quietClean',
  'seen',
  'wounded',
  'caught',
]

describe('every crime in the catalogue', () => {
  it('carries a danger profile — none falls through to a default', () => {
    for (const offence of OFFENCES) {
      expect(offence.danger, `${offence.id} has no danger profile`).toBeDefined()
    }
  })

  it('has an authored scene of its own', () => {
    const missing = OFFENCES.filter((o) => copyFor(o) === undefined).map((o) => o.id)
    expect(missing).toEqual([])
  })

  it('has no empty line anywhere in it', () => {
    for (const offence of OFFENCES) {
      const copy = copyFor(offence)
      if (!copy) continue
      for (const slot of SLOTS) {
        const pool = copy[slot]
        expect(Array.isArray(pool), `${offence.id}.${slot}`).toBe(true)
        expect((pool as readonly string[]).length, `${offence.id}.${slot} is empty`).toBeGreaterThan(0)
        for (const line of pool as readonly string[]) {
          expect(line.trim(), `${offence.id}.${slot}`).not.toBe('')
          expect(line.length, `${offence.id}.${slot} is a stub`).toBeGreaterThan(20)
        }
      }
      for (const detail of [copy.pressDetail, copy.coolDetail, copy.bailDetail]) {
        expect(detail.trim(), offence.id).not.toBe('')
      }
    }
  })
})

describe('the options match the danger profile', () => {
  it('never offers a fraud a heist’s choices', () => {
    for (const offence of OFFENCES) {
      const profile = profileOf(offence)
      const scene = crimeSceneFor(offence, 'quiet')
      const titles = scene.options.map((o) => o.title)
      expect(titles, offence.id).toEqual([
        PROFILE_OPTIONS[profile].press,
        PROFILE_OPTIONS[profile].cool,
        PROFILE_OPTIONS[profile].bail,
      ])
      expect(scene.options.map((o) => o.id)).toEqual([...CRIME_SCENE_OPTIONS])
    }
  })

  it('names the band in that profile’s own words', () => {
    for (const offence of OFFENCES) {
      const profile = profileOf(offence)
      for (const band of BANDS) {
        expect(crimeSceneFor(offence, band).label).toBe(PROFILE_BANDS[profile][band])
      }
    }
  })
})

describe('no line leaks in from the wrong kind of crime', () => {
  // The exact failure the owner reported, generalised: words that belong to
  // one profile must not appear in another's copy.
  const FORBIDDEN: Record<string, readonly RegExp[]> = {
    discovery: [/shotgun/i, /\bsafe\b/i, /over the fence/i, /constable/i, /\bvan\b/i],
    police: [/shotgun/i, /\bauditor\b/i, /\bledger\b/i, /reconcil/i],
    physical: [/\bauditor\b/i, /\breconcil/i, /\btax return\b/i],
  }

  it('keeps each profile inside its own world', () => {
    const offenders: string[] = []
    for (const offence of OFFENCES) {
      const copy = copyFor(offence)
      if (!copy) continue
      const profile = profileOf(offence)
      const lines = [
        ...SLOTS.flatMap((slot) => copy[slot] as readonly string[]),
        copy.pressDetail,
        copy.coolDetail,
        copy.bailDetail,
      ]
      for (const line of lines) {
        for (const pattern of FORBIDDEN[profile] ?? []) {
          if (pattern.test(line)) offenders.push(`${offence.id} (${profile}): ${line}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the wording varies and the facts do not', () => {
  it('gives different variants different sentences, on the same facts', () => {
    // Every set carries at least one slot with more than one wording, or
    // "pick by seed" would be decoration.
    let withPools = 0
    for (const offence of OFFENCES) {
      const copy = copyFor(offence)
      if (!copy) continue
      if (SLOTS.some((slot) => (copy[slot] as readonly string[]).length > 1)) withPools++
    }
    expect(withPools).toBe(OFFENCES.length)

    const burglary = offenceById('burglary')
    expect(burglary).toBeDefined()
    if (!burglary) return
    const a = crimeSceneFor(burglary, 'hot', 0).tell
    const b = crimeSceneFor(burglary, 'hot', 1).tell
    expect(a).not.toBe(b)
    // Both are still the same band of the same crime.
    expect(crimeSceneFor(burglary, 'hot', 0).label).toBe(crimeSceneFor(burglary, 'hot', 1).label)
  })

  it('is stable: the same variant always reads the same', () => {
    for (const offence of OFFENCES.slice(0, 12)) {
      for (const band of BANDS) {
        expect(crimeSceneFor(offence, band, 7).tell).toBe(crimeSceneFor(offence, band, 7).tell)
      }
    }
  })

  it('never runs off the end of a pool, whatever the variant', () => {
    const offence = offenceById('shoplifting')
    expect(offence).toBeDefined()
    if (!offence) return
    for (const variant of [0, 1, 5, 999, 1_000_000]) {
      expect(crimeSceneFor(offence, 'quiet', variant).tell.trim()).not.toBe('')
      expect(crimeOutcomeFor('quiet', 'press', offence, variant).text.trim()).not.toBe('')
    }
  })
})

describe('every outcome a player can reach', () => {
  it('has words on it, for every crime and every answer', () => {
    for (const offence of OFFENCES) {
      for (const band of BANDS) {
        for (const choice of CRIME_SCENE_OPTIONS) {
          const outcome = crimeOutcomeFor(band, choice, offence, 3)
          expect(outcome.text.trim(), `${offence.id} ${band} ${choice}`).not.toBe('')
          expect(outcome.title.trim()).not.toBe('')
          expect(outcome.consequence.trim()).not.toBe('')
          // Backing out is always empty-handed and always safe.
          if (choice === 'bail') {
            expect(outcome.lootPerMille).toBe(0)
            expect(outcome.clearancePerMille).toBe(0)
          }
        }
      }
    }
  })

  it('reads differently for the same crime answered differently', () => {
    const embezzlement = offenceById('embezzlement')
    expect(embezzlement).toBeDefined()
    if (!embezzlement) return
    const texts = new Set(
      BANDS.flatMap((band) =>
        CRIME_SCENE_OPTIONS.map((choice) => crimeOutcomeFor(band, choice, embezzlement, 0).text),
      ),
    )
    // Six distinct results across nine (band × option) pairs — the two
    // "kept it small" cells share a slot by design, and bailing is one line.
    expect(texts.size).toBe(6)
  })
})

describe('the scene survives the round trip', () => {
  it('carries the offence, the band and the wording on the pending', () => {
    for (const band of BANDS) {
      for (const variant of [0, 3, 42]) {
        const decoded = decodeCrimeScene(encodeCrimeScene('wire-fraud', band, variant))
        expect(decoded).toEqual({ offenceId: 'wire-fraud', danger: band, variant })
      }
    }
  })

  it('reads an old two-part code without a variant as variant zero', () => {
    expect(decodeCrimeScene('burglary:hot')).toEqual({
      offenceId: 'burglary',
      danger: 'hot',
      variant: 0,
    })
  })
})

describe('the band still leans quiet', () => {
  it('rolls hot most for physical crimes and least for paper ones', () => {
    const counts = (id: string): number => {
      const offence = offenceById(id)
      if (!offence) return 0
      let hot = 0
      for (let roll = 1; roll <= 100; roll++) {
        const rng = { nextIntInclusive: () => roll }
        if (dangerFor(offence, rng) === 'hot') hot++
      }
      return hot
    }
    const physical = counts('burglary')
    const police = counts('shoplifting')
    const discovery = counts('embezzlement')
    expect(physical).toBeGreaterThan(police)
    expect(police).toBeGreaterThan(discovery)
    // And none of them is hot often. MEASURED at this setting: 25 / 17 / 9
    // per hundred. The first setting put physical at 51 — a burglary met an
    // armed resident more often than not — which is what this band catches.
    expect(physical).toBe(25)
    expect(police).toBe(17)
    expect(discovery).toBe(9)
  })
})
