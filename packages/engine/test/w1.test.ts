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
import { ageAt } from '../src/clock.js'
import { createWorld } from '../src/index.js'
import { setPlayer } from '../src/player.js'
import { boardStandingFor, unitOptionsFor } from '../src/service.js'
import { specialUnitById } from '../src/content.js'
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
    rank: 3,
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
    // The literal belongs to Classic's nation table and nowhere else. A
    // preset with a different homeland must not find the old one in a
    // sentence (W1 resistance 6).
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const srcDir = path.join(here, '..', 'src')
    const files = await fs.readdir(srcDir)
    const offenders: string[] = []
    for (const file of files) {
      if (!file.endsWith('.ts') || file === 'geopolitics.ts') continue
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
