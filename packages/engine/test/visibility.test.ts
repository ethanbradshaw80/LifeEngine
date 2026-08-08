/**
 * THE RATCHET FOR FAILURE SHAPE 3.
 *
 * The rule: "a new event must be made VISIBLE — a story.ts case, an
 * EVENT_EXPLAINED_BY entry, and an icon — or it is written to the ledger and
 * appears nowhere in the game." It was enforced by reviewers noticing, and
 * it did not hold. An audit found TWENTY-EIGHT person-level event types
 * recorded and rendered nowhere: a commission, the entire arc from charge to
 * verdict to the end of probation, and the victim's own choices.
 *
 * Reviewers are not an enforcement mechanism for a rule a machine can check.
 * This is, and it reads the type union itself so a new event type is covered
 * the moment somebody declares it.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { seed as makeSeed } from '@life-engine/shared'
import { createWorld } from '../src/index.js'
import { recordEvent } from '../src/records.js'
import { timelineFor } from '../src/story.js'
import { livingPeople } from '../src/systems.js'

/**
 * Events about the WORLD, not about a person.
 *
 * A war beginning is not a thing that happened to YOU — it is the newsroom's
 * job, and putting it on one person's timeline would read as though they did
 * it. Adding to this list is a design decision, not a shortcut: if an event
 * genuinely happens to somebody, write the sentence instead.
 */
const WORLD_LEVEL = new Set([
  'war-began',
  'ceasefire',
  'peace-restored',
  'tensions-shifted',
  'call-to-arms',
  'joined-war',
  'declined-call',
  'asked-exemption',
  'recruiting-drive',
  // A rating change is news about a COMPANY, not about the person it is
  // hung on. It belongs on the market screen, and putting it in somebody's
  // life story would say "you were downgraded to Hold" about a human being.
  'analyst-change',
  'company-news',
  // A delisting is the same kind of fact: it happens to a COMPANY, and it
  // is recorded with no subject because there is no one person it happened
  // to. Everybody who held it feels it — through the holding vanishing,
  // which is a money event and shows up as one.
  'delisted',
])

/**
 * DELIBERATELY SILENT, each with its reason already written beside the
 * `return null` in story.ts. These are not oversights — a portfolio is a
 * balance rather than a life event, and two lines for one firing would be
 * two events. The list is short and every entry is a decision somebody
 * defended in a comment.
 *
 * The distinction that matters: these render nothing ON PURPOSE. The
 * twenty-eight this test was written for rendered nothing because nobody
 * wrote the sentence.
 */
const DELIBERATELY_SILENT = new Set([
  'left-job', // the arrival line reads better alone on a job change
  'laid-off', // 'left-job' already tells it
  'drew-unemployment', // a balance, not a life event
  'drew-assistance',
  'filed-taxes',
  'bought-investment', // a portfolio is a balance
  'sold-investment',
  'work-moment', // only the ones that MOVED something reach a timeline
  // Same shape, same reason: the detail carries which moment it was, and
  // a bare event with none is not a thing that happened to anybody. The
  // education suite pins that a REAL one renders, so this entry cannot
  // quietly hide a school moment that shows up nowhere.
  'school-moment',
])

/** Every member of the EventType union, read from its own declaration. */
function declaredEventTypes(): string[] {
  const source = readFileSync(
    fileURLToPath(new URL('../src/types.ts', import.meta.url)),
    'utf8',
  )
  const start = source.indexOf('export type EventType =')
  if (start < 0) throw new Error('EventType union not found — did it move or get renamed?')
  // The union runs to the next top-level declaration.
  const rest = source.slice(start + 'export type EventType ='.length)
  const end = rest.search(/\n(export |declare |\/\*\*[\s\S]*?\*\/\nexport )/)
  const body = end < 0 ? rest : rest.slice(0, end)
  const found = [...body.matchAll(/\|\s*'([a-z0-9-]+)'/g)].map((m) => m[1] ?? '')
  if (found.length < 50) throw new Error(`only parsed ${String(found.length)} event types — the parse is wrong`)
  return [...new Set(found)]
}

describe('every event a person can have leaves a trace', () => {
  it('renders in the life story, or is a declared world-level event', () => {
    const invisible: string[] = []
    for (const type of declaredEventTypes()) {
      if (WORLD_LEVEL.has(type) || DELIBERATELY_SILENT.has(type)) continue
      const world = createWorld(makeSeed(4141), 60)
      const subject = livingPeople(world).sort((a, b) => a.id - b.id)[0]
      if (!subject) throw new Error('empty town')
      const before = timelineFor(world, subject.id).length
      recordEvent(world, world.tick, { type: type as never, subjectId: subject.id })
      if (timelineFor(world, subject.id).length === before) invisible.push(type)
    }
    expect(
      invisible,
      `written to the ledger and shown nowhere: ${invisible.join(', ')}`,
    ).toEqual([])
  })

  it('parses enough of the union to be worth trusting', () => {
    // A parse that silently matched nothing would make the test above pass
    // for the worst possible reason.
    const types = declaredEventTypes()
    expect(types.length).toBeGreaterThan(100)
    expect(types).toContain('commissioned')
    expect(types).toContain('was-convicted')
  })
})
