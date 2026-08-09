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
 * THE CYCLES, AS STRONGLY CONNECTED COMPONENTS.
 *
 * THIS USED TO BE A BACK-EDGE WALK and it had a false positive that cost a
 * real debugging session. The walk recorded one representative per back
 * edge and started from the node list IN SORTED ORDER — so ADDING A LEAF
 * MODULE whose name sorted early (`birth.ts`) changed where the search
 * entered the cycle, renamed a dozen reported cycles, and failed the
 * ratchet without a single new coupling existing. The module in question
 * imported two things and was imported by nothing; it could not have
 * created a cycle if it tried.
 *
 * An SCC is canonical. It does not depend on traversal order, on file
 * names, or on how many leaves the package has. Two modules are in the
 * same component exactly when each can reach the other — which is the
 * definition of "these two call each other" the rule is actually about.
 *
 * TARJAN, ITERATIVE, because the recursive form blows the stack on a graph
 * this size and a test that crashes is worse than one that lies.
 */
function cyclesOf(graph: Map<string, Set<string>>): string[][] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: string[][] = []
  let counter = 0

  const nodes = [...graph.keys()].sort()
  for (const root of nodes) {
    if (index.has(root)) continue
    // Each frame: the node, and how far through its neighbours we are.
    const work: { node: string; edges: string[]; at: number }[] = [
      { node: root, edges: [...(graph.get(root) ?? [])].filter((n) => graph.has(n)).sort(), at: 0 },
    ]
    index.set(root, counter)
    low.set(root, counter)
    counter += 1
    stack.push(root)
    onStack.add(root)

    while (work.length > 0) {
      const frame = work[work.length - 1]
      if (frame === undefined) break
      if (frame.at < frame.edges.length) {
        const next = frame.edges[frame.at] as string
        frame.at += 1
        if (!index.has(next)) {
          index.set(next, counter)
          low.set(next, counter)
          counter += 1
          stack.push(next)
          onStack.add(next)
          work.push({
            node: next,
            edges: [...(graph.get(next) ?? [])].filter((n) => graph.has(n)).sort(),
            at: 0,
          })
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(next) ?? 0))
        }
        continue
      }

      work.pop()
      const parent = work[work.length - 1]
      if (parent !== undefined) {
        low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0))
      }
      if ((low.get(frame.node) ?? 0) === (index.get(frame.node) ?? 0)) {
        const members: string[] = []
        for (;;) {
          const popped = stack.pop()
          if (popped === undefined) break
          onStack.delete(popped)
          members.push(popped)
          if (popped === frame.node) break
        }
        // A component of one is only a cycle if it imports itself, which
        // the graph builder already refuses.
        if (members.length > 1) components.push(members.sort())
      }
    }
  }
  return components.sort((a, b) => a.join().localeCompare(b.join()))
}

/**
 * KNOWN CYCLES, each with the reason it exists. Do not add to this list to
 * make a build pass — a new cycle means two domains started calling each
 * other, and the fix is a seam, not an entry here.
 */
const ALLOWED_CYCLES: readonly string[] = [
  /**
   * ONE COMPONENT, TEN MODULES, and this single line replaces the thirteen
   * that used to be here.
   *
   * NOTHING GOT WORSE. The old list held thirteen back-edge
   * representatives that were every one of them a FRAGMENT of this same
   * strongly connected component — the detector was naming pieces of one
   * knot and the allowlist was recording them as if they were separate
   * debts. Saying it once, whole, is the honest version: ten engine
   * modules can each reach all the others.
   *
   * WHY IT EXISTS, unchanged from the old note: every domain that can
   * reach a player choice point imports `raisePending`, and `player`
   * imports each of them back to APPLY the answer through the same shared
   * function the automatic path uses. That is the M-PLAY design — the
   * player is not a special entity — and the seam that dissolves it is a
   * command queue between the domains and player.ts. `worldgen` and
   * `story` are in here for the same reason at one remove.
   *
   * WHAT THIS STILL CATCHES, which is the point of a ratchet: a module
   * that is NOT in this list joining it. That is what "two domains started
   * calling each other" actually means at this scale, and it is the event
   * worth failing a build over. What it no longer flags — and did not
   * usefully flag before — is a new edge between two modules already
   * inside the knot, which changes nothing about who depends on whom.
   */
  'crime ⇄ deployment ⇄ finances ⇄ health ⇄ player ⇄ relationships ⇄ service ⇄ story ⇄ systems ⇄ worldgen',
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
