/**
 * TEMPORARY. A robot that plays the game and complains.
 *
 * Not a spec test — a bug-finder. It drives full lives across many seeds,
 * answering every decision that comes up, and reports anything that looks
 * like a defect rather than a life: raw cents in prose, a prompt with no
 * words, a balance that went impossible, an option that does nothing.
 */

import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, createWorld, lifeStory, timelineFor } from '../src/index.js'
import {
  awaitingPlayer,
  describePending,
  playerIsAlive,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { accountsOf, moneyOnHand, netWorthOf } from '../src/finances.js'
import { livingPeople } from '../src/systems.js'
import { worldHash } from '../src/index.js'
import type { World } from '../src/types.js'

interface Complaint {
  readonly seed: number
  readonly year: number
  readonly what: string
  readonly text: string
}

const seenKinds = new Set<string>()
const deadOptions = new Set<string>()

/** Things that should never reach a person's eyes. */
function inspectProse(text: string): string | null {
  if (text.trim() === '') return 'an empty prompt'
  if (/undefined|NaN|\[object Object\]/.test(text)) return 'a leaked value'
  if (/(?<![$\d.,])\b\d{5,}\b(?!\s*(dollars|people|feet))/.test(text)) {
    return 'a raw number that reads like unformatted cents'
  }
  if (/\$\d+\.\d{3,}/.test(text)) return 'money with too many decimal places'
  if (/ {2,}/.test(text)) return 'a double space'
  if (/\bTODO\b|\bFIXME\b|placeholder/i.test(text)) return 'a placeholder'
  if (/\bthe the\b|\ba a\b/i.test(text)) return 'a doubled word'
  if (/\ba [aeiou]/.test(text)) return '"a" before a vowel'
  if (/\ban [b-df-hj-np-tv-z]/.test(text)) return '"an" before a consonant'
  if (/\s[,.;:]/.test(text)) return 'a space before punctuation'
  return null
}

function pickTeenager(world: World) {
  const children = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) < 18)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  return children[0]
}

/** Play one life to its end, answering everything. Returns what it saw. */
function playALife(seedValue: number, style: number): Complaint[] {
  const complaints: Complaint[] = []
  const world = createWorld(makeSeed(seedValue), 90)
  const teen = pickTeenager(world)
  if (!teen) return complaints
  setPlayer(world, teen.id)

  const say = (what: string, text: string) => {
    complaints.push({
      seed: seedValue,
      year: 1970 + Math.floor(world.tick / 12),
      what,
      text: text.slice(0, 200),
    })
  }

  let months = 0
  let answered = 0
  let lastKind = ''
  let sameKindRunning = 0
  while (playerIsAlive(world) && months < 1400) {
    if (awaitingPlayer(world)) {
      const pending = world.player.pending
      if (!pending) break
      seenKinds.add(pending.kind)

      // A decision that comes back over and over without the world moving
      // is a loop, and a loop is how a player gets stuck forever.
      if (pending.kind === lastKind) sameKindRunning += 1
      else sameKindRunning = 0
      lastKind = pending.kind
      if (sameKindRunning > 12) {
        say(`${pending.kind}: asked thirteen times in a row without a month passing`, '')
        break
      }

      const prompt = describePending(world, pending)
      const bad = prompt === null ? 'a decision with no words' : inspectProse(prompt)
      if (bad) say(`${pending.kind}: ${bad}`, prompt ?? '')

      const options = pending.options
      if (options.length === 0) {
        say(`${pending.kind}: a decision with no options`, prompt ?? '')
        break
      }
      if (new Set(options).size !== options.length) {
        say(`${pending.kind}: the same option twice`, options.join(' / '))
      }
      for (const option of options) {
        if (option.trim() === '') say(`${pending.kind}: a blank option`, prompt ?? '')
      }

      const choice = options[(answered + style) % options.length]!
      const beforeHash = worldHash(world)
      try {
        resolvePending(world, choice)
      } catch (error) {
        say(`${pending.kind}: threw on "${choice}"`, String(error))
        break
      }
      answered += 1
      // An answer that changes nothing at all is a dead button.
      if (worldHash(world) === beforeHash) deadOptions.add(`${pending.kind} → ${choice}`)

      const after = accountsOf(world, teen.id)
      if (after.checking < 0 || after.savings < 0) {
        say(
          `${pending.kind}: pushed an account negative`,
          `checking ${String(after.checking)}, savings ${String(after.savings)}`,
        )
      }
      continue
    }
    advanceTick(world)
    months++

    const accounts = accountsOf(world, teen.id)
    if (accounts.checking < 0 || accounts.savings < 0) {
      say(
        'a month left an account negative',
        `checking ${String(accounts.checking)}, savings ${String(accounts.savings)}`,
      )
      break
    }
    if (moneyOnHand(world, teen.id) > 5_000_000_000) {
      say('money on hand went absurd', String(moneyOnHand(world, teen.id)))
      break
    }
    if (!Number.isFinite(netWorthOf(world, teen.id))) {
      say('net worth stopped being a number', '')
      break
    }
  }

  if (months >= 1400) say('the life never ended in 116 years', '')

  // The two things a player actually reads: the feed, and the retrospective.
  for (const entry of timelineFor(world, teen.id)) {
    const bad = inspectProse(entry.text)
    if (bad) say(`the timeline shows ${bad}`, entry.text)
    if (entry.outcome !== null) {
      const badOutcome = inspectProse(entry.outcome)
      if (badOutcome) say(`an outcome shows ${badOutcome}`, entry.outcome)
    }
    if (entry.decision !== null) {
      const badChosen = inspectProse(entry.decision.chosen)
      if (badChosen) say(`a "why" shows ${badChosen}`, entry.decision.chosen)
    }
  }
  for (const line of lifeStory(world, teen.id).split(/\r?\n/)) {
    if (line.trim() === '') continue
    const bad = inspectProse(line)
    if (bad) say(`the life story shows ${bad}`, line)
  }
  return complaints
}

describe('a robot plays the game', () => {
  it('finds nothing worth complaining about', () => {
    const all: Complaint[] = []
    const seeds = [12345, 4141, 777, 2024, 90210, 31415, 5150, 8675309, 1729, 606, 42, 99999]
    for (const seedValue of seeds) {
      for (const style of [0, 1, 2]) {
        all.push(...playALife(seedValue, style))
      }
    }
    const grouped = new Map<string, Complaint>()
    for (const c of all) if (!grouped.has(c.what)) grouped.set(c.what, c)
    const report = [
      `DECISIONS MET (${String(seenKinds.size)}): ${[...seenKinds].sort().join(', ')}`,
      '',
      'ANSWERS THAT CHANGED NOTHING:',
      ...[...deadOptions].sort().map((d) => `  ${d}`),
      '',
      `COMPLAINTS (${String(all.length)} across ${String(grouped.size)} kinds):`,
      ...[...grouped.values()].flatMap((c) => [
        `[seed ${String(c.seed)} ${String(c.year)}] ${c.what}`,
        `    ${c.text}`,
      ]),
    ].join('\n')
    writeFileSync('playthrough-report.txt', report, 'utf-8')
    expect(all.map((c) => c.what)).toEqual([])
  })
})
