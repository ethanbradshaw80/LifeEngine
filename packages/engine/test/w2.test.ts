/**
 * W2 — the American Heartland preset.
 *
 * Half of this file tests that the preset WORKS. The other half tests that
 * it obeys the rulings in docs/WORLD_MODES_PLAN.md, because those are the
 * ones nobody notices breaking: a fictional town is only fictional until
 * someone adds a real one to the list, and "foreign nations stay fictional"
 * is a promise that has to be enforced rather than remembered.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { operationNameFor } from '../src/tours.js'
import { advanceTicks, createWorld, worldHashHex } from '../src/index.js'
import { GOLDEN_SEED } from './determinism.test.js'
import { formatYear } from '../src/clock.js'
import { serviceAtTick } from '../src/service.js'
import { CLASSIC_SPEC, PRESETS, branchSpecFor, specById } from '../src/worldspec.js'
import { HEARTLAND_COUNTY, HEARTLAND_SPEC, HEARTLAND_STATE } from '../src/heartland.js'
import { homeland, relationBetween } from '../src/geopolitics.js'
import { REAL_NATIONS } from '../src/realnations.js'
import { livingPeople } from '../src/systems.js'

describe('the preset is a world that runs', () => {
  it('is registered, resolvable, and distinct from Classic', () => {
    expect(PRESETS.map((p) => p.id)).toContain('american-heartland')
    expect(specById('american-heartland')).toBe(HEARTLAND_SPEC)
    expect(HEARTLAND_SPEC.id).not.toBe(CLASSIC_SPEC.id)
  })

  it('lives a century — births, work, marriages, service, death', () => {
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 1200)

    expect(livingPeople(world).length).toBeGreaterThan(50)
    for (const type of ['born', 'died', 'hired', 'married', 'enlisted'] as const) {
      expect(world.events.some((e) => e.type === type), `no ${type} in a century`).toBe(true)
    }
    // And it is Ashcroft, not Haverlock.
    expect(world.town.name).toBe('Ashcroft')
    expect(homeland(world)?.name).toBe('the United States')
  })

  it('starts in its own year and dates itself from there', () => {
    const world = createWorld(makeSeed(4242), 40, HEARTLAND_SPEC)
    expect(formatYear(world, world.tick)).toBe(String(HEARTLAND_SPEC.startYear))
  })

  it('serves in the real branches, on the same ladders', () => {
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 900)
    const records = [...world.service.values()]
    expect(records.length).toBeGreaterThan(0)

    const names = new Set(HEARTLAND_SPEC.branches.map((b) => b.name))
    expect(names).toContain('the United States Army')
    for (const record of records) {
      const branch = branchSpecFor(world, record.branch)
      expect(names.has(branch.name), `${branch.name} is not one of this preset's`).toBe(true)
      expect(branch.ranks.length).toBeGreaterThan(0)
      // The structure is Classic's, because it was always the real one.
      const classic = CLASSIC_SPEC.branches.find((b) => b.id === record.branch)
      expect(branch.ranks).toEqual(classic?.ranks)
    }
  })
})

describe('the rulings, enforced rather than remembered', () => {
  it('names no real town, street or business — a canary, not a proof', () => {
    // The ruling: a real small town implies real residents, and a real
    // business implies real employees, and this world bankrupts, injures
    // and convicts the people in it. The county and the state ARE real and
    // are the only real places in the gazetteer.
    //
    // BE HONEST ABOUT WHAT THIS TEST IS. It cannot prove a name is
    // invented; it is a canary for the most likely slip, which is reaching
    // for a place that is actually nearby. The list below is real towns in
    // and around Vermillion County — if one of them ever appears as a
    // neighbourhood or a workplace, someone has crossed the line by
    // accident. The W2 review asked for exactly this, having pointed out
    // that the first version would have passed with Terre Haute in it.
    const g = HEARTLAND_SPEC.gazetteer
    expect(HEARTLAND_STATE).toBe('Indiana')
    expect(HEARTLAND_COUNTY).toBe('Vermillion County')
    expect(g.townName).toBe('Ashcroft')

    const realPlacesNearby = [
      'Clinton',
      'Cayuga',
      'Newport',
      'Dana',
      'Perrysville',
      'Universal',
      'Terre Haute',
      'Indianapolis',
      'Vermillion',
      'Indiana',
    ]
    const invented = [g.townName, ...g.neighbourhoods, ...g.workplaces, ...g.civic]
    for (const name of invented) {
      for (const real of realPlacesNearby) {
        expect(name.includes(real), `"${name}" contains the real place "${real}"`).toBe(false)
      }
    }
    // Civic institutions ARE named for their county in life, so the school
    // and the courthouse are allowed the one real name they would carry.
    expect(g.schoolName).toContain('Vermillion County')
  })

  it('posts every service to its own installations', () => {
    // The W2 review's must-fix. Under Classic, posting a sailor to Fort
    // Calder was a harmless fiction about an invented place. With REAL
    // names it is a false claim about a real one, written into a record
    // the game shows to descendants and never rewrites.
    const world = createWorld(makeSeed(12345), 200, HEARTLAND_SPEC)
    advanceTicks(world, 900)

    const byName = new Map(HEARTLAND_SPEC.gazetteer.bases.map((b) => [b.name, b.branches]))
    const records = [...world.service.values()]
    expect(records.length).toBeGreaterThan(0)

    let checked = 0
    for (const record of records) {
      const base = world.places.get(record.baseId)
      expect(base).toBeDefined()
      const branches = byName.get(base?.name ?? '')
      expect(branches, `${base?.name ?? '?'} is not one of this preset's installations`).toBeDefined()
      if (branches && branches.length > 0) {
        expect(branches, `${base?.name ?? '?'} does not post the ${record.branch}`).toContain(
          record.branch,
        )
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)

    // And the same holds for every posting ever recorded, not just the
    // current one: a transfer is the same rule.
    for (const event of world.events) {
      if (event.type !== 'changed-post' || event.placeId === null) continue
      const base = world.places.get(event.placeId)
      const branches = byName.get(base?.name ?? '')
      // THE BRANCH THEY WERE IN THAT MONTH, not the one they are in now.
      // Re-enlistment lets somebody serve in two branches across a life,
      // so a sailor's posting to Norfolk is still correct after they come
      // back in the air guard — and reading the current record against a
      // historical posting reported it as a violation.
      const at = serviceAtTick(world, event.subjectId, event.tick)
      if (!branches || branches.length === 0 || !at) continue
      expect(branches, `${base?.name ?? '?'} took a transfer from the ${at.branch}`).toContain(
        at.branch,
      )
    }
  })

  it('gives every branch a name of its own, with no catch-all', () => {
    const names = HEARTLAND_SPEC.branches.map((b) => b.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual([
      'the United States Army',
      'the United States Navy',
      'the United States Air Force',
    ])
  })

  it('says out loud that it is not history', () => {
    // WORLD_MODES_PLAN.md makes explicit alternate-history framing a
    // CONDITION of the homeland-real ruling, not a nicety: a 1975 headline
    // reading "The United States is at war" in a world of invented enemies
    // otherwise invites exactly one reading.
    const words = HEARTLAND_SPEC.description.toLowerCase()
    expect(words).toContain('alternate history')
    expect(words).toContain('invented')
    expect(HEARTLAND_SPEC.description).toContain('Indiana')
    // Classic says what it is too, so the field is never decorative.
    expect(CLASSIC_SPEC.description.length).toBeGreaterThan(20)
  })

  it('names real countries, and Classic still names none', () => {
    // ADR-0021, owner direction. This reverses the old ruling for THIS
    // preset only. What did not move: Classic is still a wholly invented
    // world, which is the point of keeping it.
    const heartland = HEARTLAND_SPEC.foreignNations.map((n) => n.name)
    expect(heartland).toContain('Russia')
    expect(heartland).toContain('Canada')
    expect(heartland.length).toBe(REAL_NATIONS.length)

    const classic = CLASSIC_SPEC.foreignNations.map((n) => n.name)
    expect(classic).toContain('Varenia')
    for (const name of heartland) {
      expect(classic, `Classic must not have picked up ${name}`).not.toContain(name)
    }

    const world = createWorld(makeSeed(12345), 60, HEARTLAND_SPEC)
    const foreign = [...world.nations.values()].filter((n) => !n.isHomeland).map((n) => n.name)
    expect(foreign.sort()).toEqual([...heartland].sort())
    const homelands = [...world.nations.values()].filter((n) => n.isHomeland)
    expect(homelands.length).toBe(1)
    expect(homelands[0]?.name).toBe('the United States')
  })

  it('starts allies at peace and rivals in tension — and nothing further', () => {
    // ADR-0021 §4: an alignment is a STARTING POSITION, not a judgement. It
    // decides the homeland's own pairs on tick zero, and that is the whole
    // of its authority — the ladder starts moving in month one.
    const world = createWorld(makeSeed(12345), 60, HEARTLAND_SPEC)
    const home = homeland(world)
    expect(home).toBeDefined()
    if (!home) return

    for (const nation of world.nations.values()) {
      if (nation.isHomeland) continue
      const alignment = HEARTLAND_SPEC.foreignNations.find((n) => n.name === nation.name)?.alignment
      const relation = relationBetween(world, home.id, nation.id)
      expect(relation).toBeDefined()
      if (alignment === 'ally') {
        expect(relation?.state, `${nation.name} should start at peace`).toBe('peace')
      } else if (alignment === 'rival') {
        expect(relation?.state, `${nation.name} should start in tension`).toBe('tension')
      }
      // Nobody starts at war. A war has to be generated, by the model, in
      // this world's own time.
      expect(relation?.state).not.toBe('war')
    }

    // AND AN ALLY STANDS IN THE HOMELAND'S BLOC — a standing alliance.
    //
    // This went back and forth and the history is worth keeping. A military
    // review removed it: ADR-0021 §4 called an alignment a starting
    // position, blocs are never re-drawn, so a permanent alliance was more
    // than the label claimed. Then the owner's coalition spec arrived, and
    // the call to arms needs a persistent answer to "who are my allies" —
    // so ADR-0022 §3 puts it back and says so out loud. Disclosure was
    // what the review actually wanted.
    const allyBlocs = new Set(
      [...world.nations.values()]
        .filter(
          (n) =>
            !n.isHomeland &&
            HEARTLAND_SPEC.foreignNations.find((f) => f.name === n.name)?.alignment === 'ally',
        )
        .map((n) => n.bloc),
    )
    expect(allyBlocs, 'allies stand with the homeland (ADR-0022 §3)').toEqual(new Set([0]))
    expect(homeland(world)?.bloc).toBe(0)
  })

  it('says nothing about how two OTHER countries get along', () => {
    // The labels are from the homeland's point of view — they say how
    // Washington sees Moscow, not how Paris sees Beijing. Every pair that
    // does not include the homeland is the simulation's business, so
    // rival-to-rival pairs must not all start alike.
    const world = createWorld(makeSeed(12345), 60, HEARTLAND_SPEC)
    const home = homeland(world)
    const rivals = [...world.nations.values()].filter(
      (n) =>
        !n.isHomeland &&
        HEARTLAND_SPEC.foreignNations.find((f) => f.name === n.name)?.alignment === 'rival',
    )
    expect(rivals.length).toBeGreaterThan(3)

    const states = new Set<string>()
    for (let i = 0; i < rivals.length; i++) {
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i]
        const b = rivals[j]
        if (!a || !b || a.id === home?.id || b.id === home?.id) continue
        const relation = relationBetween(world, a.id, b.id)
        if (relation) states.add(relation.state)
      }
    }
    // If the alignment had leaked past the homeland, every one of these
    // would read the same.
    expect(states.size).toBeGreaterThan(1)
  })

  it('carries no real war, operation or battle name anywhere in the engine', async () => {
    // THE LINE THAT DOES NOT MOVE (ADR-0021, foundation §3). Real countries
    // are a setting; a real war is nobody's to invent around. This scans
    // the source, because a conflict name would arrive as content — a
    // headline template, a campaign medal, a citation.
    //
    // BE HONEST ABOUT WHAT IT CANNOT DO. A literal scan cannot catch the
    // COMPOSITIONAL case — a real country plus a generic template — which
    // is exactly what produced "the Afghanistan Campaign Medal" and got
    // past every test here. That case is handled by not naming decorations
    // after enemies at all (awards.ts), not by this scan.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    // The engine AND the UI: headline and label copy lives in
    // GameScreen.tsx too, and the first version of this scan did not look
    // there (military review).
    const dirs = [
      path.join(here, '..', 'src'),
      path.join(here, '..', '..', '..', 'apps', 'web', 'src'),
    ]

    const realConflicts = [
      'Vietnam',
      'Korean War',
      'World War',
      'Gulf War',
      'Desert Storm',
      'Iraq War',
      'Operation ',
      'Normandy',
      'Pearl Harbor',
      'Afghanistan War',
      'Cold War',
      '9/11',
    ]
    const offenders: string[] = []
    const files: string[] = []
    for (const dir of dirs) {
      for (const name of await fs.readdir(dir)) {
        if (name.endsWith('.ts') || name.endsWith('.tsx')) files.push(path.join(dir, name))
      }
    }
    // ONE SANCTIONED SOURCE OF THE WORD "OPERATION", and nowhere else.
    //
    // The blunt ban on the word was right while the engine had no
    // operations at all: anything real would start with it. The combat
    // revamp's §1 asks for tours to carry "a fictional operation name",
    // so exactly one file may say it — and that file is checked BY
    // CONSTRUCTION in the test below rather than trusted, because an
    // exemption nobody verifies is just a hole.
    const OPERATION_SOURCE = 'tours.ts'
    for (const file of files) {
      const text = await fs.readFile(file, 'utf8')
      const base = path.basename(file)
      for (const [i, line] of text.split('\n').entries()) {
        const code = line.replace(/^\s*(\*|\/\/).*/, '')
        for (const conflict of realConflicts) {
          if (conflict === 'Operation ' && base === OPERATION_SOURCE) continue
          if (code.includes(conflict)) {
            offenders.push(`${base}:${String(i + 1)} — ${conflict}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('and the one place that names operations cannot name a real one', () => {
    // THE EXEMPTION ABOVE, EARNED. Every name the generator can produce is
    // an invented adjective and an invented noun from its own two lists,
    // so there is no input that yields a real operation. Checked over the
    // whole reachable space rather than a sample — the space is small
    // enough to enumerate, which is the point of building it that way.
    const produced = new Set<string>()
    for (let i = 0; i < 4_000; i += 1) produced.add(operationNameFor(i))
    expect(produced.size).toBeGreaterThan(20)
    const banned = [
      'Desert Storm', 'Enduring Freedom', 'Iraqi Freedom', 'Overlord', 'Barbarossa',
      'Rolling Thunder', 'Market Garden', 'Neptune Spear', 'Torch', 'Anaconda',
      'Just Cause', 'Urgent Fury', 'Restore Hope', 'Provide Comfort', 'Inherent Resolve',
    ]
    for (const name of produced) {
      expect(name.startsWith('Operation ')).toBe(true)
      for (const real of banned) {
        expect(name.includes(real), `${name} contains ${real}`).toBe(false)
      }
    }
  })

  it('keeps every named unit and decoration fictional', () => {
    // Real units carry real casualty history and living members.
    expect(HEARTLAND_SPEC.units).toEqual(CLASSIC_SPEC.units)
    expect(HEARTLAND_SPEC.schools).toEqual(CLASSIC_SPEC.schools)
    // Every one invented, in both presets. The list grew when each branch
    // got its own entry unit; what must never change is that none of them
    // is real.
    for (const unit of HEARTLAND_SPEC.units) {
      expect([
        'the Pathfinder Battalion',
        'the Trident Detachment',
        'the Guardian Flight',
        'the Vanguard Group',
        'Task Unit Ember',
        'the Grey Section',
        'the Nighthawk Squadron',
      ]).toContain(unit.name)
    }
    expect(HEARTLAND_SPEC.units.length).toBe(7)
  })

  it('names the branches and nothing else about them', () => {
    // Nominative use of a service's name is one thing; insignia, emblems
    // and seals are licensed and this project ships none. The spec has
    // nowhere to put artwork, and this test is here so it stays that way.
    for (const branch of HEARTLAND_SPEC.branches) {
      // The officer ladder joined the shape when commissions landed. What
      // this test is actually guarding is that NO ARTWORK ever does: the
      // list is names and numbers, and every addition to it has to be one.
      expect(Object.keys(branch).sort()).toEqual(
        [
          // M-ENLIST added two, and both are the kind this list allows:
          // 'combatFlavor' is a word deciding which scenes a branch's
          // moments come from, and 'officerAccession' is how it hands out
          // officer jobs. Names and numbers, no artwork.
          'combatFlavor',
          'competitiveFrom',
          'grades',
          'id',
          'juniorTigMonths',
          'name',
          'officerAccession',
          'officerGrades',
          'officerRanks',
          'ranks',
        ].sort(),
      )
    }
  })

  it('leaves Classic completely alone', () => {
    // A second preset must not touch the first. Classic's own test asserts
    // its golden hash; this asserts the CONTENT it is built from.
    expect(CLASSIC_SPEC.gazetteer.townName).toBe('Haverlock')
    expect(CLASSIC_SPEC.homelandName).toBe('the Republic')
    expect(CLASSIC_SPEC.branches.map((b) => b.name)).toEqual([
      'the Land Forces',
      'the Naval Service',
      'the Air Guard',
    ])
    expect(CLASSIC_SPEC.startYear).toBe(1970)
  })

  it('is frozen like every shipped preset', () => {
    // DETERMINISM.md §8: a shipped preset's content is frozen and
    // additive-only, and rank ladders are append-only because records hold
    // INDEXES into them.
    expect(Object.isFrozen(HEARTLAND_SPEC)).toBe(true)
    expect(Object.isFrozen(HEARTLAND_SPEC.branches)).toBe(true)
    for (const branch of HEARTLAND_SPEC.branches) {
      expect(Object.isFrozen(branch.ranks)).toBe(true)
      expect(Object.isFrozen(branch.grades)).toBe(true)
    }
  })
})

/**
 * The preset's own golden fingerprint.
 *
 * WORLD_MODES_PLAN.md asks for one per preset, and DETERMINISM.md §8 says
 * why: a preset is identified in a save by a STRING, and nothing binds that
 * string to the content behind it. Two builds shipping 'american-heartland'
 * with different streets satisfy every recorded input — same seed, same
 * preset id, same simulation version — and produce different worlds with no
 * warning. This hash is the binding.
 *
 * It moves ONLY when the preset's content deliberately changes, which
 * DETERMINISM.md §8 makes a SIMULATION_VERSION-class decision. Never edit it
 * to make a test pass.
 */
const HEARTLAND_GOLDEN = 'b0e6adec'

describe('the preset is pinned', () => {
  it('reproduces its committed fingerprint', () => {
    const world = createWorld(makeSeed(GOLDEN_SEED), 100, HEARTLAND_SPEC)
    advanceTicks(world, 240)
    expect(worldHashHex(world)).toBe(HEARTLAND_GOLDEN)
  })

  it('is a different world from Classic on the same seed', () => {
    const classic = createWorld(makeSeed(GOLDEN_SEED), 100)
    const heartland = createWorld(makeSeed(GOLDEN_SEED), 100, HEARTLAND_SPEC)
    advanceTicks(classic, 240)
    advanceTicks(heartland, 240)
    expect(worldHashHex(heartland)).not.toBe(worldHashHex(classic))
  })
})

describe('the framing is a condition, not a courtesy (ADR-0021 §3)', () => {
  it('carries a standing notice into the running game, and Classic does not', () => {
    // A player who reads "the United States is at war with Russia" on the
    // news screen has to be able to see, in the same glance, that the
    // simulation made it up. A settings menu they saw once does not count.
    expect(HEARTLAND_SPEC.inGameNotice).not.toBeNull()
    expect((HEARTLAND_SPEC.inGameNotice ?? '').toLowerCase()).toContain('invented')
    // Classic invents everything and needs no disclaimer for it.
    expect(CLASSIC_SPEC.inGameNotice).toBeNull()
  })

  it('makes any preset naming real countries carry one', () => {
    // The rule, not the instance: if a preset ever ships with real nations
    // and no notice, this fails.
    const realNames = new Set(REAL_NATIONS.map((n) => n.name))
    for (const preset of PRESETS) {
      const namesReal = preset.foreignNations.some((n) => realNames.has(n.name))
      if (namesReal) {
        expect(preset.inGameNotice, `${preset.name} names real countries with no notice`).not.toBeNull()
        expect(preset.description.toLowerCase()).toContain('alternate history')
      }
    }
  })
})

describe('who the Republic will post people to', () => {
  it('never sends a peacetime rotation to a rival', () => {
    // THE OWNER, PLAYING: "we can go on peacetime rotation to countries we
    // are not friendly with — I am deployed to North Korea." Bloc 0 is the
    // homeland's alliance and it was drawn at random for everyone who was
    // not an ally, so a quarter of the rivals landed inside it and became
    // valid hosts for a peacetime posting.
    for (let s = 0; s < 25; s++) {
      const world = createWorld(makeSeed(3300 + s), 40, HEARTLAND_SPEC)
      const home = [...world.nations.values()].find((n) => n.isHomeland)
      expect(home).toBeDefined()
      if (!home) return
      for (const nation of world.nations.values()) {
        if (nation.isHomeland) continue
        const entry = REAL_NATIONS.find((r) => r.name === nation.name)
        if (entry?.alignment !== 'rival') continue
        expect(
          nation.bloc,
          `${nation.name} is a rival standing inside the homeland's own alliance`,
        ).not.toBe(home.bloc)
      }
    }
  })

  it('and an ally always stands in the homeland bloc, so the call to arms still works', () => {
    const world = createWorld(makeSeed(3399), 40, HEARTLAND_SPEC)
    const home = [...world.nations.values()].find((n) => n.isHomeland)
    if (!home) throw new Error('no homeland')
    const allies = [...world.nations.values()].filter(
      (n) => REAL_NATIONS.find((r) => r.name === n.name)?.alignment === 'ally',
    )
    expect(allies.length).toBeGreaterThan(0)
    for (const ally of allies) expect(ally.bloc).toBe(home.bloc)
  })
})
