/**
 * NO RAW ENGINE IDS ON A BUTTON.
 *
 * Found by playing: a financial shock rendered its two answers as "pay-now"
 * and "pay-over-time", because optionLabel falls through to the option's own
 * id when the table has no entry for it. That fallback is the right
 * behaviour — a missing label should not blank a button — but nothing was
 * checking it, so a whole decision kind shipped speaking in ids.
 *
 * This plays lives until it has met every decision the simulation can raise,
 * and reads the label of every option on every one of them.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import {
  advanceTick,
  ageAt,
  awaitingPlayer,
  createWorld,
  livingPeople,
  playerIsAlive,
  resolvePending,
  setPlayer,
} from '@life-engine/engine'
import type { PendingDecision, World } from '@life-engine/engine'
import { KINDS_WITH_THEIR_OWN_BUTTONS, optionLabel } from './PlayerPanel.js'

/** An id is kebab-case or a bare lowercase word; a label has a capital or a space. */
function looksLikeAnId(world: World, pending: PendingDecision, option: string, label: string): boolean {
  if (label !== option) return false
  // Single lowercase words and kebab ids are the fallback's signature.
  if (!/^[a-z]+(-[a-z]+)*$/.test(label)) return false
  // A trade's TITLE is a lowercase word too — "rifleman" is the real name of
  // the job, not an id that escaped. If the option names a specialty the
  // world knows, the label came from a lookup and is genuine.
  if (world.spec.specialties.some((sp) => sp.id === option)) return false
  void pending
  return true
}

describe('every option a player can click', () => {
  it('has words on it, not an engine id', () => {
    const offenders = new Set<string>()
    const kinds = new Set<string>()

    for (const seedValue of [12345, 4141, 777, 2024, 90210, 31415, 5150, 8675309]) {
      for (const style of [0, 1, 2]) {
        const world = createWorld(makeSeed(seedValue), 90)
        const teen = livingPeople(world)
          .filter((p) => ageAt(p.birthTick, world.tick) < 18)
          .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
        if (!teen) continue
        setPlayer(world, teen.id)

        let months = 0
        let answered = 0
        while (playerIsAlive(world) && months < 1400) {
          if (awaitingPlayer(world)) {
            const pending = world.player.pending
            if (!pending) break
            kinds.add(pending.kind)
            if (KINDS_WITH_THEIR_OWN_BUTTONS.includes(pending.kind)) {
              const choice = pending.options[(answered + style) % pending.options.length]
              if (choice === undefined) break
              resolvePending(world, choice)
              answered += 1
              continue
            }
            for (const option of pending.options) {
              const label = optionLabel(world, pending, option)
              expect(label.trim()).not.toBe('')
              if (looksLikeAnId(world, pending, option, label)) {
                offenders.add(`${pending.kind} → ${option}`)
              }
            }
            const choice = pending.options[(answered + style) % pending.options.length]
            if (choice === undefined) break
            resolvePending(world, choice)
            answered += 1
            continue
          }
          advanceTick(world)
          months++
        }
      }
    }

    // Coverage is part of the claim: a run that met three decision kinds
    // would pass this vacuously.
    expect(kinds.size).toBeGreaterThan(20)
    expect([...offenders].sort()).toEqual([])
  })
})
