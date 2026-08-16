/**
 * THE TOWN ON THE OWNER'S LADDERS (task: "now put the town on these ladders").
 *
 * THE CLAIMS, each one a number rather than a relation, because the first
 * attempt at this was reverted after breaking four invariants and the thing
 * that caught it was measurement:
 *
 *   real townspeople start real ladders, in a share that does not swamp the
 *   town's own trades; they STAY on them rather than being poached off by a
 *   pay comparison; they CLIMB them by the player's own gates; and a degree
 *   still points somewhere, which is the invariant the first attempt broke.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { occupationById } from '../src/content.js'
import { FIRST_SLICE } from '../src/pathcontent.js'
import { pathById } from '../src/paths.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

let world: World

beforeAll(() => {
  // Forty years is enough for a cohort to be hired, taught and promoted.
  world = createWorld(makeSeed(9090), 220)
  advanceTicks(world, 40 * 12)
}, 300_000)

function onLadders() {
  return livingPeople(world)
    .map((person) => ({ person, job: world.employment.get(person.id) }))
    .filter((entry) => entry.job?.pathId !== undefined)
}

describe('the town is actually on them', () => {
  it('puts real people on real ladders', () => {
    const walking = onLadders()
    expect(walking.length, 'nobody in town is on a career path').toBeGreaterThan(5)
    for (const { job } of walking) {
      const path = pathById(FIRST_SLICE, job?.pathId ?? '')
      expect(path, `${String(job?.pathId)} is not a ladder that exists`).toBeDefined()
      // The rung they hold is the rung the record says they hold.
      const level = path?.levels.find((entry) => entry.level === job?.pathLevel)
      expect(level, `nobody stands on rung ${String(job?.pathLevel)} of ${String(path?.id)}`).toBeDefined()
      expect(job?.occupationId).toBe(level?.id)
    }
  })

  it('leaves the town its own trades', () => {
    /**
     * THE SHARE IS THE WHOLE RISK. At two in five this collapsed the
     * population — the constable, the nurse and the teacher are what the
     * rest of the simulation is tuned around, and starving them starves it.
     */
    const employed = livingPeople(world).filter((p) => world.employment.has(p.id))
    const share = (onLadders().length * 100) / employed.length
    expect(employed.length).toBeGreaterThan(40)
    expect(share, 'the ladders have swallowed the town').toBeLessThan(45)
    /**
     * MEASURED AT 19 PER CENT, and the floor is well under it so the test
     * fails on a regression rather than on noise. It was 10 per cent until
     * the middle of every ladder stopped leaking — see the poaching rule in
     * `considerBetterJob`. Raising the INTAKE share instead is the move that
     * collapsed the town, so if this number needs to grow, grow it by
     * keeping people rather than by taking more.
     */
    expect(share, 'nobody is on a ladder worth the name').toBeGreaterThan(10)
  })

  it('spreads them across the town’s trades, not into one corner', () => {
    // Twelve distinct ladders at the measured seed. Seven before the leak
    // was closed — and the two jobs it leaked INTO were the same two every
    // time, so the town filled its police station with half-trained
    // accountants and nobody reached the top of anything.
    const used = new Set(onLadders().map((entry) => entry.job?.pathId))
    expect(used.size, 'the whole town is on the same few ladders').toBeGreaterThan(7)
  })

  it('carries somebody to the top half of a ladder', () => {
    /**
     * THE POINT OF A CAREER, and the thing thin spread was hiding: before
     * the leak was closed nobody in town got past rung 4, because the middle
     * of every ladder was where people were poached away from. Somebody
     * reaches rung 5 now — a whole climb, in a life.
     */
    const highest = onLadders().reduce((top, entry) => Math.max(top, entry.job?.pathLevel ?? 0), 0)
    expect(highest, 'nobody in town ever gets past the lower rungs').toBeGreaterThanOrEqual(4)
  })

  it('sends people to sit for the papers their trade demands', () => {
    /**
     * THE LICENCE GAP (owner: "fix the licence gap"). Twelve of the
     * seventy-four ladders ask for papers on the FIRST rung and the town had
     * no way to get any, so those trades were player-only by omission. The
     * wall stood mid-climb too: an NPC who reached a rung wanting a
     * certificate stopped there for the rest of their working life.
     *
     * They pay for it out of their own wallet now, through the same
     * `earnLicence` the player's verb calls.
     */
    const papers = [...world.licences.values()].reduce((n, held) => n + held.length, 0)
    expect(papers, 'nobody in town ever qualified for anything').toBeGreaterThan(0)
  })

  it('never seats anybody above the bottom of a ladder they just joined', () => {
    // "Offered doctor at $200k leaving the army" — the disease Fix 1 cured,
    // which could re-enter through the ladders now that a rung is an
    // ordinary occupation and therefore looked like entry work.
    for (const { job } of onLadders()) {
      if (job === undefined) continue
      if (job.startedAtTick !== job.rungSinceTick) continue // they climbed
      expect(job.pathLevel, 'somebody walked straight into a senior rung').toBe(1)
    }
  })
})

describe('and it climbs them', () => {
  it('carries somebody above the rung they were hired onto', () => {
    /**
     * THE CLIMB IS THE POINT. `runLadderClimbs` existed and was inert for a
     * whole release, because no NPC had a `pathId` to climb from — the code
     * ran every month and did nothing, which is the failure shape this
     * codebase keeps meeting: code that exists but never runs.
     */
    const climbed = onLadders().filter((entry) => (entry.job?.pathLevel ?? 1) > 1)
    expect(climbed.length, 'everybody is stuck on the entry rung').toBeGreaterThan(0)
  })

  it('teaches the people doing the work', () => {
    // A rung's `teaches` is the only way a skill is earned. Somebody who has
    // held one for years must have something to show for it.
    const taught = onLadders().filter((entry) => {
      const sheet = world.skills.get(entry.person.id)
      return sheet !== undefined && Object.values(sheet).some((held) => held > 0)
    })
    expect(taught.length, 'the work teaches nobody anything').toBeGreaterThan(0)
  })
})

describe('a rung is an ordinary job', () => {
  it('pays, and is named, like every other occupation', () => {
    /**
     * WHY THIS MATTERS, with the mechanism: `considerBetterJob` ranks work
     * by `typicalPay(occupationById(id))`. Before rungs were first-class
     * that lookup fell through to a synthetic paying ZERO, so every job in
     * town read as a raise and the first ambition roll pulled the person
     * back off their ladder within a year or two.
     */
    for (const { job } of onLadders()) {
      if (job === undefined) continue
      const occupation = occupationById(job.occupationId)
      expect(occupation.maxMonthlyPay, `${job.occupationId} pays nothing`).toBeGreaterThan(0)
      expect(occupation.title, `${job.occupationId} has no name`).not.toContain('-')
    }
  })

  it('keeps them there — a ladder is not somewhere people pass through', () => {
    // The consequence of the above, measured: somebody, somewhere, has been
    // on their ladder long enough to have climbed it.
    const settled = onLadders().filter(
      (entry) => world.tick - (entry.job?.startedAtTick ?? world.tick) > 60,
    )
    expect(settled.length, 'nobody stays on a ladder').toBeGreaterThan(0)
  })
})
