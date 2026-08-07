import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTick, createWorld } from '../src/index.js'
import { wellbeingCausesOf, wellbeingOf } from '../src/wellbeing.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'

describe('probe', () => {
  it('follows single lives and reports the range each one travels', () => {
    for (const seed of [4141, 9001, 777]) {
      const world = createWorld(makeSeed(seed), 300)
      const watched = livingPeople(world)
        .filter((p) => ageAt(p.birthTick, world.tick) >= 16 && ageAt(p.birthTick, world.tick) <= 22)
        .sort((a, b) => a.id - b.id)
        .slice(0, 6)
      const seen = new Map<number, number[]>(watched.map((p) => [p.id, []]))
      for (let i = 0; i < 45 * 12; i++) {
        advanceTick(world)
        for (const p of watched) {
          if (world.people.get(p.id)?.deathTick !== null) continue
          seen.get(p.id)?.push(wellbeingOf(world, p.id))
        }
      }
      const ranges: number[] = []
      for (const [id, values] of seen) {
        if (values.length < 60) continue
        const lo = Math.min(...values)
        const hi = Math.max(...values)
        ranges.push(hi - lo)
        if (ranges.length === 1) {
          const why = wellbeingCausesOf(world, id as never, world.tick)
          console.log(`  sample life ${String(id)}: ${String(lo)}..${String(hi)} · recent: ${why.map((c) => `${c.delta > 0 ? '+' : ''}${String(c.delta)} ${c.words}`).join(', ') || 'nothing lately'}`)
        }
      }
      ranges.sort((a, b) => a - b)
      console.log(
        `SEED ${String(seed)} lives ${String(ranges.length)} | range travelled: min ${String(ranges[0] ?? 0)} median ${String(ranges[Math.floor(ranges.length / 2)] ?? 0)} max ${String(ranges[ranges.length - 1] ?? 0)}`,
      )
    }
    expect(true).toBe(true)
  }, 900_000)
})
