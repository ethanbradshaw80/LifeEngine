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
import {
  applyForJob,
  awaitingPlayer,
  describePending,
  hasAnswered,
  jobBar,
  resolvePending,
  setPlayer,
} from '../src/player.js'
import { isTrustSensitive, TRUST_SENSITIVE_OCCUPATIONS, OCCUPATIONS } from '../src/content.js'
import { occupationById } from '../src/content.js'
import { placesOfKind } from '../src/worldgen.js'
import { hirePerson, livingPeople } from '../src/systems.js'
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

    // BEFORE ANSWERING, THE JOB MARKET IS SHUT. ADR-0033's rule is that
    // the fork at eighteen comes first — college, a trade, the uniform
    // and work are all still live, and taking a job would quietly answer
    // the question. That gate used to sit on the unsolicited offer the
    // careers overhaul deleted, so it sits on the ASKING now.
    // Refused — by the pending itself while the question is still on the
    // screen, and by the fork rule for as long as it goes unanswered.
    // Either way the market is shut; which of the two speaks first is not
    // the claim.
    expect(applyForJob(world, 'labourer').applied).toBe(false)

    resolvePending(world, 'work')
    expect(hasAnswered(world, 'education')).toBe(true)

    // AND AFTERWARDS IT IS OPEN. Not that work ARRIVES — the town does
    // not hand the player a job any more, which is the whole point of the
    // overhaul — but that they may now go and ask for one.
    const after = applyForJob(world, 'labourer')
    expect(
      after.reason.toLowerCase().includes('after school'),
      'the fork still blocks the job market after being answered',
    ).toBe(false)
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

/**
 * ADR-0034 (owner: "when you get the job it just says the 'job opened up'
 * — it should really be saying congrats they have extended a job offer and
 * it tells you to accept, decline, or wait").
 */
describe('a job offer is an offer', () => {
  /**
   * A PLAYER WORTH HEADHUNTING.
   *
   * This used to wait for an unsolicited offer to arrive at a school
   * leaver, which is precisely the behaviour the careers overhaul deleted
   * — "offered doctor at $200k leaving the army". Unsolicited approaches
   * survive only for somebody already ON a ladder, which a rival firm has
   * a reason to call.
   *
   * Everything these tests assert still holds, and should: ADR-0034's
   * wording ("somebody chose you", not a noticeboard) and Law 5's "sleep
   * on it" are about what an offer IS, not about who gets one.
   */
  function anOfferedPlayer(): { world: World; personId: EntityId } {
    const world = createWorld(makeSeed(12345), 100)
    const adult = livingPeople(world)
      .filter((p) => ageAt(p.birthTick, world.tick) >= 22 && ageAt(p.birthTick, world.tick) < 32)
      // THE MOST AMBITIOUS ONE. A headhunt is rolled against ambition and
      // is meant to be rare; the first pick had 416 of it, which is about
      // one expected approach across the whole window.
      .sort((a, b) => b.traits.ambition - a.traits.ambition || a.id - b.id)[0]
    if (!adult) throw new Error('no adult')
    setPlayer(world, adult.id)
    // Put them a rung up a ladder — the state a headhunter reads.
    hirePerson(
      world,
      world.tick,
      adult,
      occupationById('shift-lead'),
      placesOfKind(world, 'workplace')[0]?.id ?? (0 as EntityId),
      40_000 as never,
      [],
      [],
    )
    // TWENTY YEARS, NOT SEVENTY-FIVE. The first version ran 900 ticks and
    // the player simply died of old age before a headhunter called.
    for (let i = 0; i < 260; i++) {
      if (world.player.pending?.kind === 'job-offer') break
      if (world.people.get(adult.id)?.deathTick !== null) break
      // KEEP THEM ON THE LADDER. A headhunter reads a current job, and
      // over twenty years an ordinary career is interrupted — the first
      // version of this ended with the player unemployed and no approach
      // possible, which tested nothing about offers.
      if (!world.employment.has(adult.id)) {
        hirePerson(
          world,
          world.tick,
          adult,
          occupationById('shift-lead'),
          placesOfKind(world, 'workplace')[0]?.id ?? (0 as EntityId),
          40_000 as never,
          [],
          [],
        )
      }
      if (awaitingPlayer(world)) {
        const kind = world.player.pending?.kind
        resolvePending(
          world,
          kind === 'education' ? 'work' : (world.player.pending?.options[0] ?? ''),
        )
      } else advanceTick(world)
    }
    if (world.player.pending?.kind !== 'job-offer') throw new Error('no offer arrived')
    return { world, personId: adult.id }
  }

  it('reads like somebody chose you, and offers a third answer', () => {
    const { world } = anOfferedPlayer()
    const words = describePending(world, world.player.pending!)
    // Not a noticeboard: no "there is an opening".
    expect(words.toLowerCase()).not.toContain('there is an opening')
    expect(words.toLowerCase()).toContain('offer')
    expect(world.player.pending?.options).toContain('wait')
  })

  it('holds the offer while you think, then stops holding it', () => {
    const { world } = anOfferedPlayer()
    const job = world.player.pending?.occupationId
    const pay = world.player.pending?.monthlyPay

    // Sleep on it: the same job, the same money, still there.
    resolvePending(world, 'wait')
    expect(world.player.pending?.kind).toBe('job-offer')
    expect(world.player.pending?.occupationId).toBe(job)
    expect(world.player.pending?.monthlyPay).toBe(pay)
    // And the words say they are waiting on you.
    expect(describePending(world, world.player.pending!).toLowerCase()).toContain('time')

    // The last time of asking drops the option rather than pretending.
    resolvePending(world, 'wait')
    expect(world.player.pending?.kind).toBe('job-offer')
    expect(world.player.pending?.options).not.toContain('wait')
    expect(world.player.pending?.options).toEqual(['accept', 'decline'])

    // Taking it still works after the thinking.
    resolvePending(world, 'accept')
    expect(world.employment.get(world.player.personId!)?.occupationId).toBe(job)
  })
})
