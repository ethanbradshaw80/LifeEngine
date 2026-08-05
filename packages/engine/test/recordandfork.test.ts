/**
 * ADR-0033 — two things the owner caught playing.
 *
 *   "it also doesn't seem like convictions are affecting people's ability
 *    to get jobs either"
 *   "can we change the when you graduate high school you instantly get
 *    offered a job? it should ask you the go to college question with the
 *    enlist option and stuff that comes after that first"
 *
 * The second turned out to be a symptom: the log that remembers a
 * once-in-a-life question was never scoped to a life, so an HEIR inherited
 * their parent's answers and was never asked at all.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, createWorld } from '../src/index.js'
import { awaitingPlayer, hasAnswered, jobBar, resolvePending, setPlayer } from '../src/player.js'
import { isTrustSensitive, TRUST_SENSITIVE_OCCUPATIONS, OCCUPATIONS } from '../src/content.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

/** A played adult with a felony conviction the courthouse still counts. */
function aConvictedAdult(seed: number): { world: World; personId: EntityId } {
  const world = createWorld(makeSeed(seed), 100)
  const person = livingPeople(world)
    .filter((p) => {
      const age = ageAt(p.birthTick, world.tick)
      return age >= 25 && age <= 45
    })
    .sort((a, b) => a.id - b.id)[0]
  if (!person) throw new Error('no adult in town')
  setPlayer(world, person.id)
  world.employment.delete(person.id)
  world.education.set(person.id, {
    personId: person.id,
    level: 'college',
    enrolledIn: null,
    enrolledAtTick: null,
    completesAtTick: null,
    attainment: 700,
  })
  return { world, personId: person.id }
}

function convict(world: World, personId: EntityId, kind: string): void {
  world.criminal.set(personId, {
    personId,
    convictions: [{ kind, tick: world.tick, sealed: false }],
  } as never)
}

describe('a conviction reaches the hiring desk', () => {
  it('shuts the badge, the classroom, the ward and the ledger', () => {
    const { world, personId } = aConvictedAdult(4141)
    // Clean first: these doors are open to a qualified person.
    const openBefore = TRUST_SENSITIVE_OCCUPATIONS.filter((id) => jobBar(world, id) === null)
    expect(openBefore.length, 'no trusted work was reachable to begin with').toBeGreaterThan(0)

    convict(world, personId, 'aggravated-assault')

    for (const id of openBefore) {
      const bar = jobBar(world, id)
      expect(bar, `${id} still hires a felon`).not.toBeNull()
      expect(bar).toContain('conviction')
    }
  })

  it('leaves ordinary work open, because failure is a chapter and not a wall', () => {
    // Law 7. A man with a record can still lay bricks. If this ever fails,
    // the offence list has swallowed the whole labour market.
    const { world, personId } = aConvictedAdult(4141)
    convict(world, personId, 'aggravated-assault')
    const ordinary = OCCUPATIONS.filter((o) => !isTrustSensitive(o.id))
    expect(ordinary.some((o) => jobBar(world, o.id) === null)).toBe(true)
  })

  it('keeps the two lists honest about each other', () => {
    for (const id of TRUST_SENSITIVE_OCCUPATIONS) {
      expect(OCCUPATIONS.some((o) => o.id === id), `${id} is not an occupation`).toBe(true)
      expect(isTrustSensitive(id)).toBe(true)
    }
  })
})

describe('the fork at eighteen comes first', () => {
  it('offers the menu, not a job, to a school leaver', () => {
    const world = createWorld(makeSeed(12345), 100)
    const teen = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) < 18)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (!teen) throw new Error('no teenager')
    setPlayer(world, teen.id)

    // Run to the first question this life produces.
    let guard = 0
    while (!awaitingPlayer(world) && guard < 400) {
      advanceTick(world)
      guard++
    }
    // Whatever else happens in a childhood, the FIRST thing the employment
    // system is allowed to say to a school leaver is nothing.
    expect(world.player.pending?.kind).not.toBe('job-offer')
  })

  it('lets the offers resume once the fork is answered with work', () => {
    const world = createWorld(makeSeed(12345), 100)
    const teen = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) < 18)
      .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)[0]
    if (!teen) throw new Error('no teenager')
    setPlayer(world, teen.id)

    let guard = 0
    while (guard < 400) {
      if (awaitingPlayer(world)) {
        if (world.player.pending?.kind === 'education') break
        resolvePending(world, world.player.pending?.options[0] ?? '')
      }
      advanceTick(world)
      guard++
    }
    expect(world.player.pending?.kind).toBe('education')
    expect(world.player.pending?.options).toContain('work')
    resolvePending(world, 'work')
    expect(hasAnswered(world, 'education')).toBe(true)

    // Now the market is open to them, and an offer can arrive.
    let sawOffer = false
    for (let i = 0; i < 120 && !sawOffer; i++) {
      if (world.player.pending?.kind === 'job-offer') sawOffer = true
      else if (awaitingPlayer(world)) resolvePending(world, world.player.pending?.options[0] ?? '')
      else advanceTick(world)
    }
    expect(sawOffer, 'choosing work never led to any work').toBe(true)
  })
})

describe('an heir gets their own life', () => {
  it('is asked a once-in-a-life question their parent already answered', () => {
    const world = createWorld(makeSeed(4141), 100)
    const first = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!first) throw new Error('empty town')
    setPlayer(world, first.id)
    // The parent answers the fork.
    world.player.log.push({
      decisionId: 1,
      tick: world.tick,
      kind: 'education',
      choice: 'college',
      personId: first.id,
    })
    expect(hasAnswered(world, 'education')).toBe(true)

    // The heir takes over. The log is kept — it is the dynasty's record —
    // but it answers for the parent, not for them.
    const heir = livingPeople(world).sort((a, b) => a.id - b.id)[1]
    if (!heir) throw new Error('no second person')
    setPlayer(world, heir.id)
    expect(hasAnswered(world, 'education'), 'the heir inherited an answer').toBe(false)
  })

  it('treats an entry with no owner as answering for nobody', () => {
    // A save written before the field existed. Re-offering a question the
    // player may already have answered is the safe direction: the question
    // has its own age and level gates, so a stale one simply never fires.
    const world = createWorld(makeSeed(4141), 100)
    const person = livingPeople(world).sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('empty town')
    setPlayer(world, person.id)
    world.player.log.push({ decisionId: 1, tick: world.tick, kind: 'education', choice: 'college' })
    expect(hasAnswered(world, 'education')).toBe(false)
  })
})
