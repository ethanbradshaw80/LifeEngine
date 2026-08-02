/**
 * Determinism tests. See docs/DETERMINISM.md §9.
 *
 * Law 11 is an engineering requirement, not an aspiration: same seed, same
 * version, same decisions must produce byte-identical results. These tests are
 * the thing that makes every other guarantee checkable — without them a bug
 * report cannot be reproduced and a refactor cannot be shown to change nothing.
 *
 * On CROSS-PROCESS coverage: the golden-seed test below compares against a
 * constant committed to the repository. Every `npm test` runs in a fresh Node
 * process, so a passing golden test IS a cross-process check — a value that
 * only reproduced within one process would fail here the next time CI ran.
 *
 * CROSS-ENVIRONMENT coverage (Node vs. a real browser) is provided by the web
 * app, which recomputes this same constant in the browser and displays whether
 * it matches. That is the check that catches a banned Math.sin slipping in,
 * since transcendental precision is where engines legitimately differ.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { serialize, worldHash, worldHashHex } from '../src/snapshot.js'
import { lifeStory } from '../src/story.js'

/** The milestone's reference run: seed 12345, 100 people, 120 monthly ticks. */
export const GOLDEN_SEED = 12345
export const GOLDEN_TICKS = 120

/**
 * Committed fingerprint of the reference run.
 *
 * If this changes, simulation behaviour changed. That is sometimes correct —
 * but it always requires a SIMULATION_VERSION bump, never a quiet edit of this
 * constant. Quietly updating it converts "reproducible" into "reproducible
 * except when it isn't", which is worthless.
 *
 * Last changed at Milestone 5, with SIMULATION_VERSION raised to 2: the
 * relationships domain replaced the placeholder friendship model, so every
 * seed produces a different world than it did under v1.
 *
 * Changed at P1 (SIMULATION_VERSION 24): the record reads back — both
 * parents carry had-child, so every seed's event log grew.
 * Changed at D2 (SIMULATION_VERSION 23, schema v17): the town must live —
 * seeking, meetings, family plans, remarriage. Every seed's people now
 * pair, wed and build families at believable ages; populations grow.
 * Changed at C1 (SIMULATION_VERSION 22, schema v16): crime and justice —
 * theft moves money between households, records gate hiring, jail is
 * absence. Stream 11 appended; histories differ wherever desperation bit.
 * Changed at M-LEGACY (schema v6): player.lineage joined the serialized
 * shape. Shape-only — behaviour and SIMULATION_VERSION (4) unchanged.
 * Changed at M-WOUNDS (SIMULATION_VERSION 11): named harm — extra kind/site
 * draws shift histories from v10.
 * Changed at L4-M4 (SIMULATION_VERSION 10): deployment and risk — homeland
 * wars now reach into serving lives, so histories differ from v9.
 * Changed at L4-M3 (SIMULATION_VERSION 9): service careers — enlistments
 * rewrote work histories and incomes for every seed.
 * Changed at L4-M2 (SIMULATION_VERSION 8): health — ailments, disability,
 * survivable accidents. Deaths and work histories differ from v7.
 * Changed at L4-M1 (SIMULATION_VERSION 7): the world beyond the town —
 * nations, wars, news. The town's people are untouched (nations allocate ids
 * last), but the serialized shape and the event log grew.
 * Changed at M-DEPTH2 (SIMULATION_VERSION 6): annual reviews, six new
 * occupations, four new workplaces — hiring pools and incomes shifted.
 * Changed at M-SPEND (SIMULATION_VERSION 5): discretionary spending — every
 * seed's balances and everything money touches differ from v4.
 * Changed at M-MONEY (SIMULATION_VERSION 4): household finances shape moves,
 * strain and separations, so every seed's history differs from v3.
 * Changed at M-DEPTH with SIMULATION_VERSION 3: births moved to a fresh RNG
 * stream (deliverChild) so player-decided and automatic births produce the
 * identical child; NPC children differ from v2 for every seed.
 * Changed at M-PLAY (schema v4): the serialized world gained the
 * `player` block, so the hash of the bytes moved. SIMULATION_VERSION stayed
 * at 2 deliberately — with nobody being played, the simulation behaves
 * identically; only the serialized shape differs. The playable tests assert
 * that a played world differs and a watched world does not.
 */
// P2: moved twice — spendStance entering the serialized shape (verified
// shape-only by stripping the field and reproducing c396b96b exactly),
// then SIMULATION_VERSION 25 (strain model counts a uniform as work;
// service retrain fields) → 843c23ba. M-ARMY2 4b: moved again at
// SIMULATION_VERSION 26 — the reference world is now the 400-person
// founding town (owner direction). Older tests pin population 100 and
// still guard the small-town histories byte for byte.
// The hash moves whenever the unplayed world's bytes move, which includes
// the version field itself; the changelog in snapshot.ts is the full story
// and this comment records only the last reason. LATEST: SIMULATION_VERSION
// 39 — census names (300/500/1000, weighted by real frequency), which
// changed who everybody is called and nothing else.
//
// NOT bumped for C2's review fixes: the desperation moment, the plea and
// the charge sheet are player-path only, so an unplayed world is byte
// identical and DETERMINISM.md §7 puts player-path changes on the schema
// version instead.
export const GOLDEN_HASH_HEX = '14ab0dde'

function runReference() {
  const world = createWorld(makeSeed(GOLDEN_SEED))
  advanceTicks(world, GOLDEN_TICKS)
  return world
}

describe('golden seed', () => {
  it('reproduces the committed fingerprint', () => {
    expect(worldHashHex(runReference())).toBe(GOLDEN_HASH_HEX)
  })
})

describe('double run', () => {
  it('produces byte-identical state from the same seed', () => {
    expect(serialize(runReference())).toBe(serialize(runReference()))
  })

  it('produces identical hashes along the way, not only at the end', () => {
    const a = createWorld(makeSeed(GOLDEN_SEED))
    const b = createWorld(makeSeed(GOLDEN_SEED))

    // Sampled every 10 ticks rather than every tick. Hashing serializes the
    // whole world, so checking all 120 costs far more than it catches — a
    // divergence is still localized to a 10-month window, which is enough to
    // bisect from.
    for (let i = 1; i <= GOLDEN_TICKS; i++) {
      advanceTicks(a, 1)
      advanceTicks(b, 1)
      if (i % 10 === 0) {
        expect(worldHash(a), `diverged by tick ${i}`).toBe(worldHash(b))
      }
    }
  })
})

describe('seed sensitivity', () => {
  it('produces a different world from a different seed', () => {
    const a = createWorld(makeSeed(GOLDEN_SEED))
    const b = createWorld(makeSeed(GOLDEN_SEED + 1))
    advanceTicks(a, 60)
    advanceTicks(b, 60)
    expect(worldHash(a)).not.toBe(worldHash(b))
  })
})

describe('resumption', () => {
  it('gives the same result whether run in one pass or several', () => {
    const straight = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(straight, 120)

    const staged = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(staged, 37)
    advanceTicks(staged, 1)
    advanceTicks(staged, 82)

    // Proves the tick carries no hidden state between calls — a prerequisite
    // for save/load at Milestone 4 and for running in a Web Worker.
    expect(worldHash(staged)).toBe(worldHash(straight))
  })
})

describe('serialization', () => {
  it('is stable across repeated calls', () => {
    const world = runReference()
    expect(serialize(world)).toBe(serialize(world))
  })

  it('carries a header with schema, simulation version, seed and userId', () => {
    const world = runReference()
    const text = serialize(world)
    expect(text).toContain('"schemaVersion":1')
    expect(text).toContain('"simulationVersion":69')
    expect(text).toContain('"userId":"local"')
    expect(text).toContain(`"seed":${GOLDEN_SEED}`)
  })
})

describe('narrative determinism', () => {
  it('renders the same life story from the same seed', () => {
    const a = runReference()
    const b = runReference()
    const [firstPerson] = [...a.people.keys()].sort((x, y) => x - y)
    expect(firstPerson).toBeDefined()
    if (firstPerson === undefined) return
    expect(lifeStory(a, firstPerson)).toBe(lifeStory(b, firstPerson))
  })
})
