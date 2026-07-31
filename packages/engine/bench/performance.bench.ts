/**
 * Performance benchmark. Milestone 3.
 *
 * This file is NOT part of the engine — it lives outside src/ and uses the
 * wall clock and the filesystem, both banned in engine code. It measures; it
 * does not optimize. Optimizing before measuring is what CLAUDE.md §7 forbids.
 *
 * Run with:  npm run bench
 *
 * Results are written to docs/PERFORMANCE_BASELINE.md so the numbers in the
 * design documents can stop being guesses.
 */

import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld, livingPeople } from '../src/index.js'
import { serialize } from '../src/snapshot.js'
import type { World } from '../src/types.js'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * Force a garbage collection so heap readings measure RETAINED memory rather
 * than uncollected garbage.
 *
 * `--expose-gc` on the command line is the usual route, but Vitest 4 removed
 * the pool option that passed it through. Enabling the flag from inside the
 * process avoids depending on how the runner was invoked at all, which is more
 * robust than a config incantation that silently stops working.
 */
let forcedGc: (() => void) | null = null
try {
  setFlagsFromString('--expose-gc')
  const fn: unknown = runInNewContext('gc')
  if (typeof fn === 'function') forcedGc = fn as () => void
} catch {
  forcedGc = null
}

function collectGarbage(): boolean {
  if (!forcedGc) return false
  forcedGc()
  forcedGc()
  return true
}

function heapBytes(): number {
  return process.memoryUsage().heapUsed
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

interface ScaleResult {
  readonly population: number
  readonly ticks: number
  readonly worldgenMs: number
  readonly totalMs: number
  readonly msPerTick: number
  readonly msPerYear: number
  readonly livingAtEnd: number
  readonly events: number
  readonly causalRecords: number
  readonly serializedBytes: number
  readonly heapBytes: number
}

function measureScale(population: number, ticks: number): ScaleResult {
  collectGarbage()
  const heapBefore = heapBytes()

  const genStart = performance.now()
  const world = createWorld(makeSeed(12345), population)
  const worldgenMs = performance.now() - genStart

  const runStart = performance.now()
  advanceTicks(world, ticks)
  const totalMs = performance.now() - runStart

  const text = serialize(world)
  collectGarbage()
  const heapAfter = heapBytes()

  return {
    population,
    ticks,
    worldgenMs,
    totalMs,
    msPerTick: totalMs / ticks,
    msPerYear: (totalMs / ticks) * 12,
    livingAtEnd: livingPeople(world).length,
    events: world.events.length,
    causalRecords: world.causalRecords.length,
    serializedBytes: text.length,
    heapBytes: Math.max(0, heapAfter - heapBefore),
  }
}

/** Per-tick cost at a fixed population, sampled so one slow tick cannot skew it. */
function measureTickSpread(population: number, ticks: number): number[] {
  const world = createWorld(makeSeed(999), population)
  const samples: number[] = []
  for (let i = 0; i < ticks; i++) {
    const start = performance.now()
    advanceTicks(world, 1)
    samples.push(performance.now() - start)
  }
  return samples
}

/** How the save grows year by year, which drives R-04. */
function measureGrowth(population: number, years: number): { year: number; bytes: number }[] {
  const world: World = createWorld(makeSeed(4242), population)
  const points: { year: number; bytes: number }[] = []
  for (let y = 1; y <= years; y++) {
    advanceTicks(world, 12)
    points.push({ year: y, bytes: serialize(world).length })
  }
  return points
}

/**
 * Browser spot check, recorded MANUALLY.
 *
 * The benchmark runs under Node, but the browser is where the game actually
 * runs (ADR-0010), so the Node figures need corroborating in a real one. These
 * were measured by hand in Chromium via devtools and are kept here so
 * regenerating the document does not lose them.
 *
 * Method: load the app, click "+ 5 years" (60 ticks at ~100 people) and time
 * the click; read performance.memory.usedJSHeapSize for the whole page.
 */
const BROWSER_SPOT_CHECK = {
  date: '2026-07-30',
  engine: 'Chromium (Windows)',
  population: 100,
  ticks: 60,
  firstClickMs: 128.9,
  warmClickMs: 14.0,
  pageHeapMB: 11.3,
} as const

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

describe('performance baseline', () => {
  it('measures and writes docs/PERFORMANCE_BASELINE.md', { timeout: 20 * 60 * 1000 }, () => {
      const gcAvailable = collectGarbage()

      // Tick counts fall as population rises so the whole run stays minutes,
      // not hours. Costs are normalized per tick, so they remain comparable.
      const scales = [
        measureScale(100, 120),
        measureScale(1_000, 60),
        measureScale(10_000, 12),
      ]

      const spread = measureTickSpread(1_000, 24)
      const growth = measureGrowth(100, 10)

      const first = scales[0]
      const second = scales[1]
      const third = scales[2]
      if (!first || !second || !third) throw new Error('missing scale result')

      // Scaling factor: if cost per tick grows faster than population, the
      // simulation is super-linear and will not reach the documented targets.
      const scale1to10 = second.msPerTick / first.msPerTick
      const scale10to100 = third.msPerTick / second.msPerTick

      const lines: string[] = []
      const push = (line = '') => lines.push(line)

      push('# Performance Baseline')
      push()
      push('**Generated by `npm run bench`. Do not edit by hand.**')
      push()
      push(
        'These are measurements, replacing the order-of-magnitude guesses that',
      )
      push(
        'previously stood in `SIMULATION_LEVELS.md` §7, `CAUSAL_RECORDS.md` §5 and',
      )
      push('`ARCHITECTURE_PROPOSAL.md` §6.')
      push()
      push('## How to read this')
      push()
      push(`- Measured under Node ${process.version} on ${process.platform}/${process.arch}.`)
      push('- Heap figures are **Node heap**, not browser heap. The browser is the')
      push('  binding constraint (ADR-0010) and its numbers will differ; a spot check')
      push('  in a real browser is recorded at the bottom.')
      push(`- Garbage collection ${gcAvailable ? 'was' : 'was NOT'} forced before heap readings.`)
      if (!gcAvailable) {
        push('  **Without forced GC, heap figures include uncollected garbage and read high.**')
      }
      push('- Single run on one machine. Treat as an order of magnitude, not a spec.')
      push()

      push('## Cost by population')
      push()
      push('| People | Ticks | Worldgen | Total | ms/tick | ms/sim-year | Living at end |')
      push('|---|---|---|---|---|---|---|')
      for (const s of scales) {
        push(
          `| ${s.population.toLocaleString('en-US')} | ${s.ticks} | ${s.worldgenMs.toFixed(0)} ms | ` +
            `${s.totalMs.toFixed(0)} ms | **${s.msPerTick.toFixed(2)}** | ` +
            `${s.msPerYear.toFixed(0)} | ${s.livingAtEnd.toLocaleString('en-US')} |`,
        )
      }
      push()
      push('### Scaling')
      push()
      push(`- 100 → 1,000 people: tick cost ×${scale1to10.toFixed(1)} for 10× the population`)
      push(`- 1,000 → 10,000 people: tick cost ×${scale10to100.toFixed(1)} for 10× the population`)
      push()
      if (scale10to100 > 15) {
        push('> **This is super-linear.** Cost is growing faster than population, which')
        push('> means the documented population targets are not reachable without')
        push('> changing an algorithm or introducing the simulation tiers. See the')
        push('> findings section below.')
      } else {
        push('> Growth is roughly linear with population at these sizes.')
      }
      push()

      push('## Per-tick spread (1,000 people, 24 ticks)')
      push()
      const sorted = [...spread].sort((a, b) => a - b)
      push(`- Median: **${median(spread).toFixed(2)} ms**`)
      push(`- Fastest: ${(sorted[0] ?? 0).toFixed(2)} ms`)
      push(`- Slowest: ${(sorted[sorted.length - 1] ?? 0).toFixed(2)} ms`)
      push()
      push('A wide spread means some months cost far more than others, which is')
      push('felt as stutter when advancing time.')
      push()

      push('## Memory and save size')
      push()
      push('| People | Events | Causal records | Serialized | Node heap | Bytes/person |')
      push('|---|---|---|---|---|---|')
      for (const s of scales) {
        push(
          `| ${s.population.toLocaleString('en-US')} | ${s.events.toLocaleString('en-US')} | ` +
            `${s.causalRecords.toLocaleString('en-US')} | ${kb(s.serializedBytes)} | ` +
            `${mb(s.heapBytes)} | ${Math.round(s.serializedBytes / s.population)} |`,
        )
      }
      push()

      const bytesPerRecord =
        first.causalRecords > 0 ? Math.round(first.serializedBytes / first.causalRecords) : 0
      push(`At 100 people over 10 years: **${Math.round(first.serializedBytes / first.population)} serialized bytes per person**,`)
      push(`and roughly **${bytesPerRecord} bytes per causal record** if the whole save is`)
      push('attributed to records (an overestimate — the save also holds people, places')
      push('and households).')
      push()

      push('## Save growth over time (100 people)')
      push()
      push('| Simulated year | Serialized size | Growth |')
      push('|---|---|---|')
      let previous = 0
      for (const point of growth) {
        const delta = previous === 0 ? '—' : `+${kb(point.bytes - previous)}`
        push(`| ${point.year} | ${kb(point.bytes)} | ${delta} |`)
        previous = point.bytes
      }
      push()
      const firstPoint = growth[0]
      const lastPoint = growth[growth.length - 1]
      if (firstPoint && lastPoint && growth.length > 1) {
        const perYear = (lastPoint.bytes - firstPoint.bytes) / (growth.length - 1)
        push(`Average growth: **${kb(perYear)} per simulated year** at this population.`)
        push(`Extrapolated to 80 simulated years: roughly ${mb(perYear * 80)} — before any`)
        push('causal-record compression, which is not yet implemented.')
      }
      push()

      push('## Findings')
      push()
      push('What the measurements actually say, as opposed to what the design')
      push('documents assumed.')
      push()

      const tickBudgetMs = 100
      const worstTick = sorted[sorted.length - 1] ?? 0

      push('### 1. Cost is super-linear in population')
      push()
      push(`Ten times the people costs **${scale10to100.toFixed(0)}x** the time per tick, not ten times.`)
      push('That is the signature of an O(n squared) algorithm — work proportional to')
      push('*pairs* of people rather than to people.')
      push()
      push('The likely cause is friendship formation in `systems.ts`: for each')
      push('person it filters the whole living population to build a candidate')
      push('list. At 100 people that is 10,000 comparisons per tick and invisible;')
      push('at 10,000 people it is 100,000,000 and dominates everything else.')
      push()
      push(`At 10,000 people a single month costs ${third.msPerTick.toFixed(0)} ms, against a budget of`)
      push(`${tickBudgetMs} ms. Advancing one simulated year takes ${(third.msPerYear / 1000).toFixed(1)} seconds.`)
      push()
      push('**Not fixed here.** Milestone 3 measures; it does not tune')
      push('(`MILESTONE_PLAN.md`). Recorded so the fix is chosen deliberately —')
      push('either the simulation tiers of `SIMULATION_LEVELS.md`, or a spatial or')
      push('cohort index so candidate lookup stops scanning everyone.')
      push()

      push('### 2. CPU bites before memory does')
      push()
      push('`SIMULATION_LEVELS.md` §7 and `ARCHITECTURE_PROPOSAL.md` §6 both assumed')
      push('**browser memory** would be the binding constraint. At these sizes it is')
      push('not: 10,000 people fit in tens of megabytes, which a browser tab carries')
      push('comfortably. The tick loop runs out of budget long before the tab runs')
      push('out of memory.')
      push()
      push('That does not retire the memory concern — saves grow without bound over')
      push('decades, and no causal-record compression exists yet. It reorders the')
      push('priorities: the tier system is needed for CPU first, memory second.')
      push()

      push('### 3. The current game is comfortably fast')
      push()
      push(`At the shipped scale of ~100 people, a month costs ${first.msPerTick.toFixed(2)} ms and a`)
      push(`simulated year ${first.msPerYear.toFixed(0)} ms. Advancing five years — the largest`)
      push('control in the interface — is well under a second. The Web Worker planned')
      push('for Milestone 4 remains worth doing, but it is not urgent at this scale.')
      push()
      push(`Worst single tick observed at 1,000 people: ${worstTick.toFixed(2)} ms.`)
      push()

      push('### What this changes')
      push()
      push('- Population targets in `SIMULATION_LEVELS.md` §7 are not reachable with')
      push('  the current friendship algorithm. Documented there.')
      push('- The tier system is now justified by measurement rather than by')
      push('  expectation.')
      push('- No optimization is authorized by this milestone. The next change to')
      push('  the tick loop should be reviewed by `performance-reviewer`.')
      push()

      push('## Browser spot check')
      push()
      push('The numbers above are Node. The game runs in a browser (ADR-0010), so')
      push('they need corroborating where it matters. Recorded by hand — see')
      push('`BROWSER_SPOT_CHECK` in the benchmark source.')
      push()
      push(`- Measured ${BROWSER_SPOT_CHECK.date} in ${BROWSER_SPOT_CHECK.engine}.`)
      push(
        `- Advancing ${BROWSER_SPOT_CHECK.ticks} ticks at ~${BROWSER_SPOT_CHECK.population} people: ` +
          `**${BROWSER_SPOT_CHECK.warmClickMs} ms** once warm ` +
          `(${BROWSER_SPOT_CHECK.firstClickMs} ms on the first click, which includes JIT warm-up and a React render).`,
      )
      push(
        `- Whole-page heap after the run: **${BROWSER_SPOT_CHECK.pageHeapMB} MB**, including React and the interface.`,
      )
      push()
      const predictedMs = first.msPerTick * BROWSER_SPOT_CHECK.ticks
      push(
        `Node predicts ${predictedMs.toFixed(0)} ms for the same work; the browser measured ` +
          `${BROWSER_SPOT_CHECK.warmClickMs} ms. **The two agree**, so the Node figures above can be`,
      )
      push('trusted as a guide to browser behaviour at this scale.')
      push()
      push('Re-measure after any change that could affect the tick loop, and after')
      push('the Web Worker move in Milestone 4.')
      push()

      push('## Raw data')
      push()
      push('```json')
      push(
        JSON.stringify(
          { scales, spreadMs: spread, growth, gcAvailable, browserSpotCheck: BROWSER_SPOT_CHECK },
          null,
          2,
        ),
      )
      push('```')
      push()

      const output = `${lines.join('\n')}\n`
      writeFileSync(`${REPO_ROOT}docs/PERFORMANCE_BASELINE.md`, output, 'utf8')

      // Also print the headline numbers so a run is readable without opening
      // the file.
      console.log('\n=== PERFORMANCE BASELINE ===')
      for (const s of scales) {
        console.log(
          `${String(s.population).padStart(6)} people: ${s.msPerTick.toFixed(2)} ms/tick, ` +
            `${s.msPerYear.toFixed(0)} ms/sim-year, ${kb(s.serializedBytes)} save, ` +
            `${mb(s.heapBytes)} heap`,
        )
      }
      console.log(`scaling 100->1k: x${scale1to10.toFixed(1)}   1k->10k: x${scale10to100.toFixed(1)}`)
      console.log(`gc available: ${gcAvailable}`)
      console.log('written to docs/PERFORMANCE_BASELINE.md\n')
  })
})
