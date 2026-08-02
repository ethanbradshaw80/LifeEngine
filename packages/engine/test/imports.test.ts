/**
 * The import graph (DOMAIN_MAP §4 Rule 4) — queued since C1, written here.
 *
 * The rule the project wants is "no cycles between engine modules". The
 * engine does not satisfy it today: several cycles predate this test and
 * dissolving them means introducing a command seam, which is a real
 * refactor and not a test's job.
 *
 * So this test does the useful half honestly: it MEASURES the graph, holds
 * the known cycles in a named allowlist, and fails on any NEW one. That
 * turns an aspiration nobody could enforce into a ratchet that cannot get
 * worse — and every entry below is a debt with a name, which is what
 * makes it payable.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

/** module → the engine modules it imports, by bare name. */
function importGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  for (const file of readdirSync(SRC)) {
    if (!file.endsWith('.ts')) continue
    const name = file.replace(/\.ts$/, '')
    const source = readFileSync(`${SRC}${file}`, 'utf8')
    const targets = new Set<string>()
    // Both `import ... from './x.js'` and `import type ... from './x.js'`.
    for (const match of source.matchAll(/from\s+'\.\/([\w-]+)\.js'/g)) {
      const target = match[1]
      if (target !== undefined && target !== name) targets.add(target)
    }
    graph.set(name, targets)
  }
  return graph
}

/**
 * Every cycle in the graph, each as a sorted, de-duplicated member list.
 *
 * A depth-first back-edge walk. It is DETERMINISTIC (both loops iterate
 * sorted), which is what a ratchet needs — the same source always yields
 * the same set. It does not claim to enumerate every distinct elementary
 * circuit; for that you would want Johnson's algorithm. What it does
 * guarantee is that a newly-introduced cycle changes the set, which is
 * the property this test is for.
 */
function cyclesOf(graph: Map<string, Set<string>>): string[][] {
  const found = new Map<string, string[]>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const seen = new Set<string>()

  const walk = (node: string): void => {
    stack.push(node)
    onStack.add(node)
    for (const next of [...(graph.get(node) ?? [])].sort()) {
      if (onStack.has(next)) {
        const members = stack.slice(stack.indexOf(next))
        const key = [...new Set(members)].sort().join(' ⇄ ')
        if (!found.has(key)) found.set(key, [...new Set(members)].sort())
        continue
      }
      if (!seen.has(next) && graph.has(next)) walk(next)
    }
    stack.pop()
    onStack.delete(node)
    seen.add(node)
  }

  for (const node of [...graph.keys()].sort()) if (!seen.has(node)) walk(node)
  return [...found.values()]
}

/**
 * KNOWN CYCLES, each with the reason it exists. Do not add to this list to
 * make a build pass — a new cycle means two domains started calling each
 * other, and the fix is a seam, not an entry here.
 */
const ALLOWED_CYCLES: readonly string[] = [
  // ALL of these run through `player`, and they exist for one reason: every
  // domain that can reach a player choice point imports raisePending, and
  // player imports each of them back to APPLY the answer through the same
  // shared function the automatic path uses. That is the M-PLAY design —
  // the player is not a special entity — and the seam that would dissolve
  // it is a command queue between the domains and player.ts.
  'finances ⇄ player',
  'player ⇄ relationships',
  'player ⇄ systems',
  'health ⇄ player',
  'deployment ⇄ health ⇄ player',
  'health ⇄ player ⇄ systems',
  'finances ⇄ player ⇄ service',
  'finances ⇄ health ⇄ player ⇄ service',
  'deployment ⇄ finances ⇄ health ⇄ player ⇄ service',
  'crime ⇄ deployment ⇄ health ⇄ player ⇄ systems',
  'finances ⇄ health ⇄ player ⇄ service ⇄ worldgen',
  // worldgen builds the places service posts people to, and finances reads
  // rents off those places. The only cycle here with nothing to do with
  // the player, and the shallowest to break.
  'finances ⇄ service ⇄ worldgen',
]

describe('the engine import graph', () => {
  it('has no cycle that is not a named, documented debt', () => {
    const cycles = cyclesOf(importGraph()).map((members) => members.join(' ⇄ '))
    const unexpected = cycles.filter((cycle) => !ALLOWED_CYCLES.includes(cycle))
    expect(
      unexpected,
      `New import cycle(s). Two domains now call each other — introduce a ` +
        `command seam rather than adding to ALLOWED_CYCLES:\n  ${unexpected.join('\n  ')}`,
    ).toEqual([])
  })

  it('keeps the allowlist honest — every entry is still a real cycle', () => {
    // A debt that has been paid must leave the list, or the list stops
    // meaning anything.
    const cycles = new Set(cyclesOf(importGraph()).map((members) => members.join(' ⇄ ')))
    const stale = ALLOWED_CYCLES.filter((allowed) => !cycles.has(allowed))
    expect(stale, `These cycles are gone — delete them from ALLOWED_CYCLES`).toEqual([])
  })

  // (The engine's one-dependency rule is enforced by purity.test.ts, which
  // reads real import statements rather than pattern-matching prose — an
  // earlier draft of this file matched the words "from 'inherited'" in a
  // comment and reported it as a dependency.)
})
