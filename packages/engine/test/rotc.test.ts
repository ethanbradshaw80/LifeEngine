/**
 * THE ROTC BARGAIN IS OFFERED, NEVER IMPOSED.
 *
 * OWNER, PLAYING: "when I joined college it automatically made me do rotc no
 * option this shouldnt be the way there should be a little button that says
 * join ROTC in the education tab to where you click it and it tells you what
 * that entails."
 *
 * He was right on both counts, and the first is the serious one: a die roll
 * inside `fundingFor` was committing his character to FOUR YEARS IN UNIFORM
 * without asking. The major decided a few lines below already refuses to do
 * that, on exactly this reasoning — "what you read at university is not a
 * thing that should happen to somebody off-screen" — and a commission is a
 * great deal more binding than a subject.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { joinRotc, rotcBar, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'

/** Somebody the town has put into university. */
function aStudent(world: ReturnType<typeof createWorld>) {
  return livingPeople(world).find((p) => world.education.get(p.id)?.enrolledIn === 'college')
}

describe('the ROTC bargain', () => {
  it('is never signed for the player behind their back', () => {
    const world = createWorld(makeSeed(4141), 400)
    // Make somebody the player BEFORE any of this world's college enrolments,
    // so the funding roll would have had every chance to sign them.
    const teen = livingPeople(world)
      .filter((p) => world.tick - p.birthTick < 6 * 12)
      .sort((a, b) => a.id - b.id)[0]
    if (teen === undefined) return
    setPlayer(world, teen.id)
    advanceTicks(world, 30 * 12)

    const record = world.education.get(teen.id)
    if (record === undefined) return
    expect(
      record.funding,
      'the player was enrolled in ROTC without being asked',
    ).not.toBe('rotc')
  })

  it('the town still walks that road on its own', () => {
    // The player being asked must not mean the path goes dead for everybody
    // else — that would trade one silence for another.
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 40 * 12)
    let signed = 0
    for (const record of world.education.values()) {
      if (record.funding === 'rotc') signed += 1
    }
    expect(signed, 'nobody in the whole town took the bargain').toBeGreaterThan(0)
  })

  it('refuses in words outside university, and signs inside it', () => {
    const world = createWorld(makeSeed(4141), 400)
    advanceTicks(world, 30 * 12)
    const student = aStudent(world)
    if (student === undefined) return
    setPlayer(world, student.id)
    ;(world.player as { pending: unknown }).pending = null

    // Somebody not at university is told why, rather than shown a dead button.
    const other = livingPeople(world).find(
      (p) => world.education.get(p.id)?.enrolledIn !== 'college' && p.id !== student.id,
    )
    if (other !== undefined) {
      expect(rotcBar(world, other.id)).not.toBeNull()
    }

    // And inside it, the bar and the verb agree — the bar pattern.
    const bar = rotcBar(world, student.id)
    const done = joinRotc(world)
    if (bar === null) {
      expect(done.signed, done.reason).toBe(true)
      expect(world.education.get(student.id)?.funding).toBe('rotc')
      // Signing is a defining moment and says why (Law 3).
      expect(world.events.some((e) => e.type === 'won-funding' && e.subjectId === student.id)).toBe(true)
    } else {
      expect(done.signed).toBe(false)
      expect(done.reason).toBe(bar)
    }
  })
})
