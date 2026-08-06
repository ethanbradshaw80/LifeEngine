/**
 * M-SCHOOL phase 1 — the catalogue is coherent.
 *
 * The schoolhouse remodel (owner's spec) gives every course a category, a
 * wash-out weight, a seat scarcity and a lifetime attempt cap. None of that
 * has behaviour yet; this pins the DATA, because a school whose gates
 * cannot be met is a school nobody will ever attend, and that failure is
 * silent — it looks exactly like a course that is merely rare.
 */

import { describe, expect, it } from 'vitest'
import { SERVICE_SCHOOLS } from '../src/content.js'

describe('every course in the catalogue', () => {
  it('carries the fields the schoolhouse will read', () => {
    for (const school of SERVICE_SCHOOLS) {
      expect(['pme', 'skill', 'selection'], school.id).toContain(school.category)
      expect(school.difficulty, `${school.id} difficulty`).toBeGreaterThanOrEqual(0)
      expect(school.difficulty, `${school.id} difficulty`).toBeLessThan(1000)
      expect(school.seatScarcity, `${school.id} scarcity`).toBeGreaterThan(0)
      expect(school.seatScarcity, `${school.id} scarcity`).toBeLessThan(1000)
      // A course nobody may ever attend twice is a course a wash-out ends
      // for good, which is the opposite of the road back Law 7 asks for.
      expect(school.maxAttempts, `${school.id} attempts`).toBeGreaterThanOrEqual(2)
    }
  })

  it('never requires a badge no course grants', () => {
    // A DANGLING PREREQUISITE IS AN UNREACHABLE SCHOOL, and it fails
    // silently: the course simply never opens, which reads as "rare".
    const granted = new Set(SERVICE_SCHOOLS.map((s) => s.badge))
    for (const school of SERVICE_SCHOOLS) {
      for (const badge of school.prereqBadges ?? []) {
        expect(granted, `${school.id} requires "${badge}", which no course grants`).toContain(badge)
      }
    }
  })

  it('never requires a badge from a school its own people cannot attend', () => {
    // A branch-locked prerequisite is the same trap one step further out: a
    // course open to the naval service that requires a badge only the land
    // forces can earn is closed to everybody, and says nothing about it.
    const byBadge = new Map(SERVICE_SCHOOLS.map((s) => [s.badge, s]))
    for (const school of SERVICE_SCHOOLS) {
      for (const badge of school.prereqBadges ?? []) {
        const source = byBadge.get(badge)
        if (!source || source.branches.length === 0) continue
        const reachable =
          school.branches.length === 0
            ? source.branches.length === 0
            : school.branches.every((b) => source.branches.includes(b))
        expect(
          reachable,
          `${school.id} is open to [${school.branches.join(', ') || 'all'}] but its prerequisite "${badge}" comes from ${source.id}, open only to [${source.branches.join(', ')}]`,
        ).toBe(true)
      }
    }
  })

  it('makes selection harder than education, which is the whole distinction', () => {
    const pme = SERVICE_SCHOOLS.filter((s) => s.category === 'pme')
    const selection = SERVICE_SCHOOLS.filter((s) => s.category === 'selection')
    expect(pme.length, 'no PME in the catalogue').toBeGreaterThan(0)
    expect(selection.length, 'no selection course in the catalogue').toBeGreaterThan(0)
    // The spec is explicit: PME rarely washes anybody out — the difficulty
    // is getting the seat in time to promote.
    const hardestPme = Math.max(...pme.map((s) => s.difficulty))
    const easiestSelection = Math.min(...selection.map((s) => s.difficulty))
    expect(hardestPme).toBeLessThan(easiestSelection)
  })
})
