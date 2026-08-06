/**
 * W1 — the WorldSpec arc, first cut.
 *
 * These are the "resistances" WORLD_MODES_PLAN.md measured before any preset
 * work could begin. Two of them are behavioural and therefore testable here:
 *
 *   4. Display names used as logic keys. A unit's name and a rank's title
 *      belong to a preset's content; matching on them means renaming a unit
 *      silently reopens a file the service had closed.
 *   6. Prose hardcoding "the Republic" — a preset's homeland typed into
 *      engine sentences.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt, formatDate, formatYear } from '../src/clock.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { CLASSIC_SPEC, specById } from '../src/worldspec.js'
import type { WorldSpec } from '../src/types.js'
import { serialize } from '../src/snapshot.js'
import { setPlayer } from '../src/player.js'
import { boardStandingFor, rankTitle, unitOptionsFor } from '../src/service.js'
import { branchSpecFor, schoolFor, specialtyFor, unitFor } from '../src/worldspec.js'
import { occupationById, specialUnitById } from '../src/content.js'
import { homeland } from '../src/geopolitics.js'
import { recordEvent } from '../src/records.js'
import { timelineFor } from '../src/story.js'
import { livingPeople } from '../src/systems.js'
import type { Person, World } from '../src/types.js'

function aServingPlayer(world: World, performance = 800): Person {
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 20 && age <= 40
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult')
  setPlayer(world, person.id)
  world.service.set(person.id, {
    personId: person.id,
    branch: 'land-forces',
    specialtyId: 'rifleman',
    // CPL. Corporal is where the competitive ladder starts since M-PROMO:
    // a specialist's next step is a lateral appointment, so boardStandingFor
    // has no gates to report and returns null.
    rank: 4,
    rankSinceTick: world.tick as never,
    qualifications: [],
    enlistedAtTick: (world.tick - 30) as never,
    baseId: person.id,
    monthlyPay: 139_000 as never,
    performance,
    termMonthsLeft: 40,
    dischargedAtTick: null,
    dischargeReason: null,
    termPerformanceSum: performance * 6,
    unitId: null,
    unitSinceTick: null,
    schoolId: null,
    schoolStartsAtTick: null,
    fitnessScore: 200,
    fitnessTestedAtTick: null,
    priorSpecialtyIds: [],
    specialtyChangedAtTick: null,
  })
  world.employment.delete(person.id)
  // The parachutist badge both units gate on. Written straight into the
  // awards record: how it was earned is M-SPECOPS's test, not this one's.
  world.awards.set(person.id, [
    {
      personId: person.id,
      kind: 'qualification-badge',
      title: 'parachutist',
      tick: world.tick,
      qualifyingEventIds: [],
      issuedBy: 'the Land Forces',
      citation: 'the course, completed',
      count: 1,
    },
  ])
  return person
}

describe('records key on ids, not on display names', () => {
  it('closes the file after two drops recorded by unit id', () => {
    const world = createWorld(makeSeed(12345), 100)
    const soldier = aServingPlayer(world)
    const unit = specialUnitById('pathfinders')
    expect(unit).toBeDefined()
    if (!unit) return

    const openBefore = unitOptionsFor(world, soldier.id).find((o) => o.id === unit.id)
    expect(openBefore?.open).toBe(true)

    for (let i = 0; i < 2; i++) {
      recordEvent(world, world.tick, {
        type: 'dropped-selection',
        subjectId: soldier.id,
        detail: unit.id,
      })
    }

    const closed = unitOptionsFor(world, soldier.id).find((o) => o.id === unit.id)
    expect(closed?.open).toBe(false)
    expect(closed?.reason.length).toBeGreaterThan(0)
  })

  it('does not close it on drops recorded against a different unit', () => {
    const world = createWorld(makeSeed(12345), 100)
    const soldier = aServingPlayer(world)
    for (let i = 0; i < 3; i++) {
      recordEvent(world, world.tick, {
        type: 'dropped-selection',
        subjectId: soldier.id,
        detail: 'task-unit-ember',
      })
    }
    const pathfinders = unitOptionsFor(world, soldier.id).find((o) => o.id === 'pathfinders')
    expect(pathfinders?.open).toBe(true)
  })

  it('counts prior non-selections by ladder index', () => {
    const world = createWorld(makeSeed(12345), 100)
    const soldier = aServingPlayer(world)
    const standing = boardStandingFor(world, soldier.id)
    expect(standing).not.toBeNull()
    if (!standing) return
    expect(standing.priorPassOvers).toBe(0)

    recordEvent(world, world.tick, {
      type: 'passed-over',
      subjectId: soldier.id,
      detail: String(standing.targetRank),
    })
    expect(boardStandingFor(world, soldier.id)?.priorPassOvers).toBe(1)

    // A non-selection at a DIFFERENT rank is a different file.
    recordEvent(world, world.tick, {
      type: 'passed-over',
      subjectId: soldier.id,
      detail: String(standing.targetRank + 1),
    })
    expect(boardStandingFor(world, soldier.id)?.priorPassOvers).toBe(1)
  })

  it('still tells the story in words — from the id, and from a pre-W1 name', () => {
    const world = createWorld(makeSeed(12345), 100)
    const soldier = aServingPlayer(world)

    recordEvent(world, world.tick, {
      type: 'joined-unit',
      subjectId: soldier.id,
      detail: 'task-unit-ember',
    })
    // Exactly what a save written before W1 holds: the name itself.
    recordEvent(world, world.tick, {
      type: 'dropped-selection',
      subjectId: soldier.id,
      detail: 'the Pathfinder Battalion',
    })
    recordEvent(world, world.tick, {
      type: 'passed-over',
      subjectId: soldier.id,
      detail: '4',
    })

    const text = timelineFor(world, soldier.id)
      .map((entry) => entry.text)
      .join('\n')
    expect(text).toContain('Task Unit Ember')
    expect(text).toContain('the Pathfinder Battalion')
    // The ladder index renders as the rank's own title, not as "4".
    expect(text).toMatch(/Went before the \w+/)
    expect(text).not.toContain('the 4 board')
  })
})

describe('the homeland is named by the world, not by the sentence', () => {
  it('has exactly one homeland and it carries its own name', () => {
    const world = createWorld(makeSeed(12345), 100)
    const homelands = [...world.nations.values()].filter((n) => n.isHomeland)
    expect(homelands.length).toBe(1)
    expect(homeland(world)?.name).toBe(homelands[0]?.name)
    expect((homeland(world)?.name ?? '').length).toBeGreaterThan(0)
  })

  it('leaves no "the Republic" typed into engine prose', async () => {
    // The literal belongs to Classic's CONTENT and nowhere else — it moved
    // from geopolitics.ts to content.ts's HOMELAND_NAME when the homeland
    // became the preset's. A preset with a different homeland must not find
    // the old one waiting in a sentence (W1 resistance 6).
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const srcDir = path.join(here, '..', 'src')
    const files = await fs.readdir(srcDir)
    const offenders: string[] = []
    for (const file of files) {
      // The CONTENT modules are allowed to say it, because they are what
      // says it: content.ts holds Classic's data and worldspec.ts assembles
      // Classic's spec (including the sentence describing its world). The
      // rule is about ENGINE PROSE — a sentence that would still say "the
      // Republic" in a preset whose homeland is not.
      const contentModules = ['content.ts', 'worldspec.ts']
      if (!file.endsWith('.ts') || contentModules.includes(file)) continue
      const text = await fs.readFile(path.join(srcDir, file), 'utf8')
      for (const [i, line] of text.split('\n').entries()) {
        // Comments may still discuss the Republic; strings may not.
        const code = line.replace(/^\s*(\*|\/\/).*/, '')
        if (/['"`][^'"`]*[Tt]he Republic/.test(code)) {
          offenders.push(`${file}:${String(i + 1)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the WorldSpec', () => {
  it('changes nothing for Classic — the default IS the preset', () => {
    // W1's exit criterion. Passing the spec explicitly and letting it
    // default must produce the same town down to the byte; if they ever
    // differ, the extraction moved something it should not have.
    const implicit = createWorld(makeSeed(12345), 120)
    const explicit = createWorld(makeSeed(12345), 120, CLASSIC_SPEC)
    expect(serialize(explicit)).toBe(serialize(implicit))

    advanceTicks(implicit, 120)
    advanceTicks(explicit, 120)
    expect(serialize(explicit)).toBe(serialize(implicit))
  })

  it('records its preset on the world, and it never changes', () => {
    const world = createWorld(makeSeed(12345), 60)
    expect(world.spec.id).toBe('classic')
    advanceTicks(world, 240)
    expect(world.spec.id).toBe('classic')
  })

  it('resolves ids without ever throwing — saves carry these strings', () => {
    // Resistance 2: a lookup that throws on an id out of a save file is a
    // worker that dies instead of a world that loads.
    expect(specById('classic')).toBe(CLASSIC_SPEC)
    expect(specById(null)).toBe(CLASSIC_SPEC)
    expect(specById(undefined)).toBe(CLASSIC_SPEC)
    expect(specById('')).toBe(CLASSIC_SPEC)
    expect(specById('a-preset-from-a-later-build')).toBe(CLASSIC_SPEC)
  })

  it('actually decides the world — a different spec builds a different town', () => {
    const spec: WorldSpec = {
      id: 'classic', // resolvable, so newborn naming still finds a pool
      name: 'Test',
      description: 'A test world.',
      inGameNotice: null,
      maleGiven: { names: ['Auberon'], weights: [1] },
      femaleGiven: { names: ['Isolde'], weights: [1] },
      family: { names: ['Vasquez-Nakamura'], weights: [1] },
      gazetteer: {
        townName: 'Little Compton',
        schoolName: 'the schoolhouse',
        neighbourhoods: ['Anvil Row', 'The Green'],
        workplaces: ['the cannery'],
        civic: ['the meeting hall'],
        bases: [{ name: 'Camp Ridge', branches: [] }],
        newsStation: 'KLCT',
      },
      startYear: 1985,
      homelandName: 'the Commonwealth',
      foreignNations: [
        { name: 'Aldaria', alignment: null, combatRating: null },
        { name: 'Brennisk', alignment: null, combatRating: null },
        { name: 'Cothery', alignment: null, combatRating: null },
      ],
      branches: CLASSIC_SPEC.branches,
      specialties: CLASSIC_SPEC.specialties,
      schools: CLASSIC_SPEC.schools,
      units: CLASSIC_SPEC.units,
    }
    const world = createWorld(makeSeed(12345), 40, spec)

    expect(world.town.name).toBe('Little Compton')
    const names = [...world.places.values()].map((place) => place.name)
    expect(names).toContain('Anvil Row')
    expect(names).toContain('the cannery')
    expect(names).toContain('Camp Ridge')
    expect(names).not.toContain('Kestrel Hill')

    for (const person of world.people.values()) {
      expect(person.familyName).toBe('Vasquez-Nakamura')
      expect(['Auberon', 'Isolde']).toContain(person.givenName)
    }

    // Foreign nations AND the homeland come from the spec — W2's premise is
    // that one preset's homeland is the United States while every foreign
    // nation stays fictional in all of them.
    const foreign = [...world.nations.values()].filter((n) => !n.isHomeland).map((n) => n.name)
    expect(foreign).toEqual(['Aldaria', 'Brennisk', 'Cothery'])
    const homelands = [...world.nations.values()].filter((n) => n.isHomeland)
    expect(homelands.length).toBe(1)
    expect(homelands[0]?.name).toBe('the Commonwealth')
  })
})

describe('a preset that is not Classic actually runs', () => {
  /** A spec whose pools are deliberately NOTHING like Classic's lengths. */
  function tinySpec(): WorldSpec {
    return {
      id: 'classic',
      name: 'Test',
      description: 'A test world.',
      inGameNotice: null,
      maleGiven: { names: ['Auberon', 'Corvin'], weights: [3, 1] },
      femaleGiven: { names: ['Isolde', 'Maud', 'Perpetua'], weights: [5, 2, 1] },
      family: { names: ['Vasquez-Nakamura', 'Oyelaran'], weights: [1, 1] },
      gazetteer: {
        townName: 'Little Compton',
        schoolName: 'the schoolhouse',
        neighbourhoods: ['Anvil Row', 'The Green', 'Saltmarsh'],
        workplaces: ['the cannery', 'the ropewalk'],
        civic: ['the meeting hall'],
        bases: [{ name: 'Camp Ridge', branches: [] }],
        newsStation: 'KLCT',
      },
      startYear: 1985,
      homelandName: 'the Commonwealth',
      foreignNations: [
        { name: 'Aldaria', alignment: null, combatRating: null },
        { name: 'Brennisk', alignment: null, combatRating: null },
        { name: 'Cothery', alignment: null, combatRating: null },
      ],
      branches: CLASSIC_SPEC.branches,
      specialties: CLASSIC_SPEC.specialties,
      schools: CLASSIC_SPEC.schools,
      units: CLASSIC_SPEC.units,
    }
  }

  it('runs a century of births without ever leaving its own name pools', () => {
    // The architecture review's must-fix, as a test. The first draft drew a
    // newborn's NAME from the spec and its WEIGHTS from the module
    // constants, which is fine for Classic and a RangeError on the first
    // birth under any pool of a different length — a crash inside the tick,
    // inside the worker. The custom-spec test that existed never advanced a
    // single tick, so nobody was ever born to catch it. (RESUME rule 2: a
    // test that never advances the tick loop tests nothing.)
    const spec = tinySpec()
    const world = createWorld(makeSeed(4242), 120, spec)
    advanceTicks(world, 900)

    const born = world.events.filter((e) => e.type === 'born').length
    expect(born).toBeGreaterThan(0)

    const allowed = new Set([...spec.maleGiven.names, ...spec.femaleGiven.names])
    const families = new Set(spec.family.names)
    for (const person of world.people.values()) {
      expect(allowed.has(person.givenName), `${person.givenName} is not in the preset's pools`).toBe(true)
      expect(families.has(person.familyName)).toBe(true)
    }
  })
})

describe('a branch this build cannot resolve', () => {
  it('is a blank, never another service\u2019s ladder', () => {
    // Substituting branches[0] would re-read every RANK INDEX against the
    // wrong ladder: grades[rank] falls off the end, the ?? 9 fallback makes
    // an E-9, and a twenty-year career ceiling becomes thirty. A different
    // life, not a mislabel (architecture review).
    const world = createWorld(makeSeed(12345), 40)
    const unknown = branchSpecFor(world, 'space-command')

    expect(unknown.id).toBe('space-command')
    expect(unknown.name).toBe('space-command')
    expect(unknown.ranks).toEqual([])
    expect(unknown.grades).toEqual([])
    // Nothing borrowed from the real services.
    const land = branchSpecFor(world, 'land-forces')
    expect(unknown.ranks).not.toEqual(land.ranks)
    expect(unknown.grades).not.toEqual(land.grades)
    // The board and the ladder both freeze rather than inventing a career.
    expect(unknown.competitiveFrom).toBeGreaterThan(1000)
    // And the rank reads as an index, not as somebody else's stripes.
    expect(rankTitle(world, 'space-command', 4)).toBe('#4')
    expect(rankTitle(world, 'land-forces', 4)).toBe('CPL')
  })
})

describe('content ids out of a save never throw (resistance 2)', () => {
  it('resolves a trade, a course, a unit and a job it has never heard of', () => {
    const world = createWorld(makeSeed(12345), 40)

    // A specialty from a preset this build does not ship. It keeps its id as
    // its title so the record still reads, and it does NOTHING — no school,
    // no unlocks, and no exposure, because inventing danger a preset never
    // described is worse than saying nothing.
    const trade = specialtyFor(world, 'orbital-rigger')
    expect(trade.title).toBe('orbital-rigger')
    expect(trade.schoolMonths).toBe(0)
    expect(trade.civilianUnlocks).toEqual([])
    expect(trade.exposure).toEqual({ directCombat: 0, convoy: 0, baseAttack: 0, accident: 0 })
    // Not borrowed from a real trade.
    expect(trade.id).not.toBe(world.spec.specialties[0]?.id)

    // Courses and units answer null: "no such course" and "no unit" are
    // states every caller already handles.
    expect(schoolFor(world, 'orbital-drop-course')).toBeNull()
    expect(unitFor(world, 'the-void-watch')).toBeNull()

    // And an occupation id from a later build reads as itself rather than
    // killing the worker mid-tick.
    const job = occupationById('drone-wrangler')
    expect(job.title).toBe('drone-wrangler')
    expect(job.maxMonthlyPay).toBe(0)

    // The real ones still resolve, obviously.
    expect(specialtyFor(world, 'rifleman').title).toBe('rifleman')
    expect(occupationById('labourer').maxMonthlyPay).toBeGreaterThan(0)
  })
})

describe('the start year is the preset’s', () => {
  it('dates the world from the preset, not from a constant', () => {
    const classic = createWorld(makeSeed(12345), 30)
    expect(formatYear(classic, classic.tick)).toBe('1970')

    const later = createWorld(makeSeed(12345), 30, {
      ...CLASSIC_SPEC,
      startYear: 1985,
    })
    expect(formatYear(later, later.tick)).toBe('1985')
    advanceTicks(later, 24)
    expect(formatYear(later, later.tick)).toBe('1987')
    expect(formatDate(later, later.tick)).toBe('January 1987')
  })

  it('is a label on the ticks, not an input to them', () => {
    // The whole reason this was cheap: nothing in the tick path reads the
    // calendar year. Two worlds that differ ONLY in start year must live
    // identical lives — same people, same events, same everything but the
    // dates printed on them.
    const a = createWorld(makeSeed(777), 60)
    const b = createWorld(makeSeed(777), 60, { ...CLASSIC_SPEC, startYear: 1885 })
    advanceTicks(a, 360)
    advanceTicks(b, 360)
    expect(serialize(b)).toBe(serialize(a))
    expect(formatYear(b, b.tick)).not.toBe(formatYear(a, a.tick))
  })
})

describe('a preset can put its own people in its own uniform', () => {
  it('enlists them into ITS branch, in ITS trades, over a century', () => {
    // The second architecture review's must-fix, as a test. Resolving ids
    // against the spec was only half the extraction: what a world OFFERS
    // was still read from Classic's tables, so a preset's own trades would
    // never have been offered to anyone — and because enlistPerson stamps
    // `specialty.branch` onto the record, every soldier in that preset
    // would have carried a CLASSIC branch id its own spec did not contain,
    // straight onto the blank-branch path.
    const branch = {
      id: 'ranger-corps',
      name: 'the Ranger Corps',
      ranks: ['REC', 'RGR', 'LCPL', 'CPL', 'SGT', 'WO'],
      grades: [1, 2, 3, 4, 5, 6],
      competitiveFrom: 3,
      juniorTigMonths: [6, 6, 12],
    }
    const spec: WorldSpec = {
      ...CLASSIC_SPEC,
      branches: [branch],
      specialties: [
        {
          id: 'scout',
          title: 'scout',
          branch: 'ranger-corps',
          requires: 'none',
          schoolMonths: 3,
          qualification: 'pathfinding',
          boardCutoffOffset: 0,
          exposure: { directCombat: 600, convoy: 200, baseAttack: 150, accident: 300 },
          civilianUnlocks: [],
        },
        {
          id: 'quartermaster',
          title: 'quartermaster',
          branch: 'ranger-corps',
          requires: 'secondary',
          schoolMonths: 4,
          qualification: 'supply',
          boardCutoffOffset: 20,
          exposure: { directCombat: 50, convoy: 400, baseAttack: 200, accident: 350 },
          civilianUnlocks: ['bookkeeper'],
        },
      ],
      schools: [],
      units: [],
    }

    const world = createWorld(makeSeed(12345), 200, spec)
    advanceTicks(world, 1200)

    const records = [...world.service.values()]
    expect(records.length).toBeGreaterThan(0)

    const ownTrades = new Set(spec.specialties.map((sp) => sp.id))
    for (const record of records) {
      expect(ownTrades.has(record.specialtyId), `${record.specialtyId} is not this preset's`).toBe(true)
      expect(record.branch).toBe('ranger-corps')
      // And the branch RESOLVES, so nobody is on the blank path: a real
      // ladder, and a rank that reads as one of its own titles.
      const resolved = branchSpecFor(world, record.branch)
      expect(resolved.ranks.length).toBeGreaterThan(0)
      expect(branch.ranks).toContain(rankTitle(world, record.branch, record.rank))
      expect(record.monthlyPay).toBeGreaterThan(0)
    }

    // Promotions happen on the preset's OWN ladder, not on Classic's.
    const promotions = world.events.filter((e) => e.type === 'promoted')
    expect(promotions.length).toBeGreaterThan(0)
    for (const event of promotions) {
      expect(branch.ranks, `${event.detail ?? ''} is not a Ranger Corps rank`).toContain(event.detail ?? '')
    }
  })
})
