/**
 * What a killing is allowed to say.
 *
 * Two bugs the owner found reading the paper, both introduced by the change
 * that made a fatal hit record WHAT killed somebody:
 *
 *  - people died of "blown-out hearing" and frostbite, because the fatal
 *    draw used the whole injury catalogue
 *  - and the prose asserted mechanisms the wound contradicted: "of
 *    frostbite that opened an artery", "bled out ... of lungs full of
 *    smoke"
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { articleFor } from '../src/newsroom.js'
import { serviceNewsSince } from '../src/service.js'
import { WOUND_CLAUSES, DEATH_OPENERS } from '../src/newsvoice.js'

describe('a killing', () => {
  it('is never caused by something nobody dies of', () => {
    for (const seedValue of [999, 4242, 777]) {
      const world = createWorld(makeSeed(seedValue), 140)
      advanceTicks(world, 720)
      for (const event of world.events) {
        if (event.type !== 'wounded-in-action' && event.type !== 'was-injured') continue
        const detail = event.detail ?? ''
        if (!detail.startsWith('fatal:')) continue
        const wound = detail.slice(6)
        // A soldier does not die of tinnitus.
        expect(
          /hearing|frostbite|heatstroke|injured eye|concussion/.test(wound),
          `somebody died of "${wound}"`,
        ).toBe(false)
      }
    }
  })

  it('is described without claiming a mechanism the wound denies', () => {
    // The wound is named later in the sentence and is the ONLY thing
    // entitled to say how somebody died. Nothing in the pools may
    // contradict it — an artery, bleeding, a road.
    const banned = /artery|bleeding|bled out|off the road/i
    for (const grit of ['low', 'medium', 'high'] as const) {
      for (const clause of WOUND_CLAUSES[grit]) {
        expect(banned.test(clause), `wound clause asserts a mechanism: "${clause}"`).toBe(false)
      }
      for (const opener of DEATH_OPENERS[grit]) {
        expect(banned.test(opener), `opener asserts a mechanism: "${opener}"`).toBe(false)
      }
    }
  })

  it('reads cleanly end to end', () => {
    const world = createWorld(makeSeed(999), 140)
    advanceTicks(world, 720)
    for (const item of serviceNewsSince(world, 0 as never)) {
      const article = articleFor(world, item)
      if (article === null) continue
      // No doubled punctuation, no empty splices, no dangling connectors.
      expect(article.lede).not.toMatch(/\s,|,,|\s\./)
      expect(article.lede).not.toMatch(/\{[a-z]+\}/)
      expect(article.headline).not.toMatch(/\{[a-z]+\}/)
    }
  })
})
