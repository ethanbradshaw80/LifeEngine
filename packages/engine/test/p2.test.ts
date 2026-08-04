/**
 * P2 — the verbs. Player-initiated actions, all resolved through the same
 * shared functions the automatic paths use, all log-before-roll, all honest
 * about refusal.
 *
 * These tests build scenarios by hand (the depth.test.ts lesson): the
 * mechanism is under test, not the odds of the town wandering into it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import type { Money, Tick } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { advanceTick, createWorld, worldHashHex } from '../src/index.js'
import { discretionaryFor, setSpendStance } from '../src/finances.js'
import {
  askForRaise,
  chooseSpendStance,
  courtFriend,
  endCourtship,
  lookForPlace,
  propose,
  quitJob,
  requestDischarge,
  requestEnrolment,
  resolvePending,
  setConvalescenceStance,
  setPlayer,
  spendTimeWith,
  tendTheMarriage,
  tryForChild,
  walkOut,
  raisePending,
} from '../src/player.js'
import { decisionForEvent } from '../src/records.js'
import { openStream, Stream } from '../src/rng.js'
import { relationshipBetween } from '../src/relationships.js'
import { enlistPerson } from '../src/service.js'
import { SPECIALTIES } from '../src/content.js'
import { monthlyConceptionChance } from '../src/systems.js'
import { relationshipKey } from '../src/types.js'
import type { Person, World } from '../src/types.js'

// ---------------------------------------------------------------------------
// Scenario builders
// ---------------------------------------------------------------------------

/** Two single adults who could court: opposite sex, of age, unpartnered,
 *  not kin, close enough in years. */
function findSingles(world: World): { a: Person; b: Person } {
  const living = [...world.people.values()].filter((p) => p.deathTick === null)
  for (const a of living) {
    const ageA = ageAt(a.birthTick, world.tick)
    if (ageA < 20 || ageA > 34) continue
    if (isPartnered(world, a.id)) continue
    for (const b of living) {
      if (b.id === a.id || b.sex === a.sex) continue
      const ageB = ageAt(b.birthTick, world.tick)
      if (ageB < 20 || ageB > 34) continue
      if (Math.abs(ageA - ageB) > 12) continue
      if (isPartnered(world, b.id)) continue
      if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id)) continue
      if (a.parentIds.some((id) => b.parentIds.includes(id))) continue
      return { a, b }
    }
  }
  throw new Error('no courtable singles in the founding town — different seed needed')
}

function isPartnered(world: World, id: number): boolean {
  for (const tie of world.relationships.values()) {
    if (tie.type !== 'spouse' && tie.type !== 'courting') continue
    if (tie.a === id || tie.b === id) return true
  }
  return false
}

/** Hand-place a friendship of the given strength. */
function befriend(world: World, a: Person, b: Person, strength: number): void {
  const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
  world.relationships.set(relationshipKey(a.id, b.id), {
    a: lo,
    b: hi,
    type: 'friend',
    strength,
    formedAtTick: (world.tick - 24) as Tick,
    typeSinceTick: (world.tick - 24) as Tick,
    endedAtTick: null,
    familySizeAspiration: null,
  })
}

/** A married cohabiting couple from the founding town, wife in her twenties. */
function findCouple(world: World) {
  for (const tie of world.relationships.values()) {
    if (tie.type !== 'spouse') continue
    const a = world.people.get(tie.a)
    const b = world.people.get(tie.b)
    if (!a || !b || a.householdId === null || a.householdId !== b.householdId) continue
    const wife = a.sex === 'female' ? a : b
    const age = ageAt(wife.birthTick, world.tick)
    if (age >= 22 && age <= 32) return { tie, wife, husband: wife.id === a.id ? b : a }
  }
  throw new Error('no suitable founding couple — different seed needed')
}

/** Answer whatever waits with the safest option, preferring decline. */
function resolveSafely(world: World): void {
  const pending = world.player.pending
  if (pending === null) return
  resolvePending(world, pending.options.includes('decline') ? 'decline' : (pending.options[0] ?? ''))
}

/** Advance n REAL months — advanceTick no-ops while a question waits, so
 *  pendings are answered (safest option) as they arrive. */
function passMonths(world: World, months: number): void {
  let passed = 0
  let guard = 0
  while (passed < months && guard < months * 10 + 20) {
    resolveSafely(world)
    const before = world.tick
    advanceTick(world)
    if (world.tick > before) passed++
    guard++
  }
  if (passed < months) throw new Error('could not pass the months — pending storm?')
}

/**
 * Hand a person a job at the given performance and pay.
 *
 * THE PAY IS BASE-YEAR MONEY. The world starts in 1970 and the occupation
 * bands are 1970 bands; a fixture written in modern dollars sits above the
 * top of every band, and the raise verb correctly answers "pay tops out
 * where yours already is" instead of the thing the test is about.
 */
function giveJob(world: World, person: Person, performance: number, pay: number): void {
  const workplace = [...world.places.values()].find((p) => p.kind === 'workplace')
  if (!workplace) throw new Error('no workplace in town')
  world.employment.set(person.id, {
    personId: person.id,
    occupationId: 'labourer',
    workplaceId: workplace.id,
    monthlyPay: pay as Money,
    startedAtTick: world.tick,
    performance,
    trackId: 'industrial',
    rungSinceTick: world.tick,
  })
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

describe('courtFriend', () => {
  it('refuses honestly, then courts through the shared path', () => {
    const world = createWorld(makeSeed(9100), 100)
    const { a, b } = findSingles(world)
    setPlayer(world, a.id)

    // Not friends at all.
    expect(courtFriend(world, b.id).reason).toContain('not friends')

    // Friends, but not close enough.
    befriend(world, a, b, 300)
    expect(courtFriend(world, b.id).reason).toContain('not that close')

    // Close enough: the ask lands through promoteToCourting.
    befriend(world, a, b, 620)
    const result = courtFriend(world, b.id)
    expect(result.reason).toBe('')
    expect(result.courting).toBe(true)
    expect(relationshipBetween(world, a.id, b.id)?.type).toBe('courting')
    const event = world.events.find((e) => e.type === 'started-courting' && (e.subjectId === a.id || e.subjectId === b.id))
    expect(event).toBeDefined()
    // The record credits the choice TO THE CHOOSER — whichever side of the
    // pair holds the lower id (architecture review M1: own-choice must
    // never land in the partner's file).
    const record = world.causalRecords.find(
      (r) => r.decision === 'courtship' && r.tick === world.tick,
    )
    expect(record?.subjectId).toBe(a.id)
    expect(record?.inputs.some((i) => i.factor === 'own-choice')).toBe(true)
    // The ask is in the log — replay walks the same road.
    expect(world.player.log.some((entry) => entry.kind === 'court-friend')).toBe(true)
  })

  it('refuses when the other is spoken for', () => {
    const world = createWorld(makeSeed(9100), 100)
    const { a, b } = findSingles(world)
    setPlayer(world, a.id)
    befriend(world, a, b, 620)
    // Marry b off by hand.
    const third = [...world.people.values()].find(
      (p) =>
        p.deathTick === null &&
        p.id !== a.id &&
        p.id !== b.id &&
        p.sex !== b.sex &&
        ageAt(p.birthTick, world.tick) >= 20,
    )
    if (!third) throw new Error('no third adult')
    const [lo, hi] = b.id < third.id ? [b.id, third.id] : [third.id, b.id]
    world.relationships.set(relationshipKey(b.id, third.id), {
      a: lo,
      b: hi,
      type: 'spouse',
      strength: 800,
      formedAtTick: 0 as Tick,
      typeSinceTick: 0 as Tick,
      endedAtTick: null,
      familySizeAspiration: null,
    })
    expect(courtFriend(world, b.id).reason).toContain('spoken for')
  })
})

describe('propose / endCourtship', () => {
  it('holds the automatic bar, then marries; ending demotes with the event', () => {
    const world = createWorld(makeSeed(9100), 100)
    const { a, b } = findSingles(world)
    setPlayer(world, a.id)
    befriend(world, a, b, 620)
    courtFriend(world, b.id)

    // Too young a courtship.
    expect(propose(world).reason).toContain('month')

    // Backdate the courtship past the bar and strengthen it.
    const key = relationshipKey(a.id, b.id)
    const tie = world.relationships.get(key)
    if (!tie) throw new Error('courtship vanished')
    world.relationships.set(key, {
      ...tie,
      strength: 620,
      typeSinceTick: (world.tick - 15) as Tick,
    })
    const married = propose(world)
    expect(married.reason).toBe('')
    expect(relationshipBetween(world, a.id, b.id)?.type).toBe('spouse')
    expect(world.events.some((e) => e.type === 'married')).toBe(true)
  })

  it('endCourtship emits the schema\'s waiting event and the Why? resolves', () => {
    const world = createWorld(makeSeed(9100), 100)
    const { a, b } = findSingles(world)
    setPlayer(world, a.id)
    befriend(world, a, b, 620)
    courtFriend(world, b.id)

    const ended = endCourtship(world)
    expect(ended.ended).toBe(true)
    expect(relationshipBetween(world, a.id, b.id)?.type).toBe('friend')
    const event = world.events.find((e) => e.type === 'courtship-ended')
    expect(event).toBeDefined()
    expect(event?.subjectId).toBe(a.id)
    // Law 3: the game can say why.
    const why = event === undefined ? null : decisionForEvent(world, event)
    expect(why?.inputs.some((i) => i.factor === 'own-choice')).toBe(true)
    // Nothing left to end.
    expect(endCourtship(world).reason).toContain('no courtship')
  })
})

describe('tendTheMarriage / walkOut / spendTimeWith', () => {
  it('tend strengthens on a cooldown; walkOut separates through the shared path', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { tie, wife } = findCouple(world)
    setPlayer(world, wife.id)
    const before = world.relationships.get(relationshipKey(tie.a, tie.b))?.strength ?? 0

    expect(tendTheMarriage(world).tended).toBe(true)
    const after = world.relationships.get(relationshipKey(tie.a, tie.b))?.strength ?? 0
    expect(after).toBe(Math.min(1000, before + 60))
    expect(world.events.some((e) => e.type === 'tended-marriage')).toBe(true)

    // Quarterly at most.
    expect(tendTheMarriage(world).reason).toContain('making the time')

    // Walking out is allowed always, and honest about whose choice it was.
    const separated = walkOut(world)
    expect(separated.separated).toBe(true)
    expect(relationshipBetween(world, tie.a, tie.b)?.type).toBe('former-spouse')
    expect(world.events.some((e) => e.type === 'divorced')).toBe(true)
    const record = world.causalRecords.find((r) => r.decision === 'separation' && r.tick === world.tick)
    expect(record?.inputs.some((i) => i.factor === 'own-choice')).toBe(true)
  })

  it('spendTimeWith reinforces a friendship, once a month', () => {
    const world = createWorld(makeSeed(9100), 100)
    const { a, b } = findSingles(world)
    setPlayer(world, a.id)
    befriend(world, a, b, 400)

    expect(spendTimeWith(world, b.id).spent).toBe(true)
    expect(world.relationships.get(relationshipKey(a.id, b.id))?.strength).toBe(440)
    expect(world.events.some((e) => e.type === 'spent-time')).toBe(true)
    expect(spendTimeWith(world, b.id).reason).toContain('visiting')
  })
})

describe('tryForChild', () => {
  it('gates honestly and rolls the birth model\'s own odds', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)
    // Unpartnered: honest refusal.
    expect(tryForChild(world).reason).toContain('nobody to try with')

    // Let the first tick run so settleFamilyPlans gives the founders their
    // plans, then cast the couple with the BEST monthly odds — the test may
    // read the model to cast correctly (latent infertility and slowness are
    // hidden in play, not in here).
    passMonths(world, 1)
    let best: { wife: Person; husband: Person; chance: number } | null = null
    for (const tie of world.relationships.values()) {
      if (tie.type !== 'spouse') continue
      const pa = world.people.get(tie.a)
      const pb = world.people.get(tie.b)
      if (!pa || !pb || pa.deathTick !== null || pb.deathTick !== null) continue
      const wife = pa.sex === 'female' ? pa : pb
      const husband = wife.id === pa.id ? pb : pa
      const chance = monthlyConceptionChance(world, world.tick, wife, husband.id)
      if (best === null || chance > best.chance) best = { wife, husband, chance }
    }
    if (best === null || best.chance <= 0) throw new Error('no fertile founding couple — recast the seed')
    setPlayer(world, best.wife.id)

    // Trying opens the month; the answer must be EXACTLY the model's own
    // roll — predicted here with the verb's stream before each ask.
    let born = false
    for (let month = 0; month < 120 && !born; month++) {
      resolveSafely(world)
      const wifeNow = world.people.get(best.wife.id)
      if (!wifeNow || wifeNow.deathTick !== null) throw new Error('wife died mid-test')
      const chance = monthlyConceptionChance(world, world.tick, wifeNow, best.husband.id)
      const predicted =
        chance > 0 &&
        openStream(world.seed, Stream.LifeEventTiming, wifeNow.id, world.tick + 3333)
          .chanceInTenThousand(chance)
      const result = tryForChild(world)
      expect(result.conceived).toBe(predicted)
      if (result.conceived) {
        born = true
        break
      }
      expect(result.reason).toBe('Not this month.')
      passMonths(world, 1)
    }
    expect(born).toBe(true)
    expect(world.events.some((e) => e.type === 'born')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------

describe('quitJob / askForRaise', () => {
  it('quit releases the job with the honest detail', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)
    expect(quitJob(world).reason).toContain('no job')

    giveJob(world, a, 700, 18_750)
    expect(quitJob(world).quit).toBe(true)
    expect(world.employment.has(a.id)).toBe(false)
    expect(world.events.some((e) => e.type === 'left-job' && e.detail === 'quit')).toBe(true)
  })

  it('a raise rolls against real performance and pays the review formula', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)

    // Poor work: honest no, and the asking is recorded.
    giveJob(world, a, 300, 12_500)
    expect(askForRaise(world).reason).toContain('does not argue')
    expect(world.events.some((e) => e.type === 'turned-down' && e.detail === 'a raise')).toBe(true)

    // Cooldown: the same half-year refuses.
    expect(askForRaise(world).reason).toContain('half-year')

    // Strong work: ask every cooldown until the yes lands. p(fail) per ask
    // is under 0.38, so twenty asks failing is ~3e-9 — a hang here is a bug.
    world.employment.set(a.id, { ...world.employment.get(a.id)!, performance: 1000 })
    let raised = false
    for (let round = 0; round < 20 && !raised; round++) {
      passMonths(world, 6)
      resolveSafely(world)
      if (!world.employment.has(a.id)) giveJob(world, a, 1000, 12_500)
      world.employment.set(a.id, { ...world.employment.get(a.id)!, performance: 1000 })
      raised = askForRaise(world).raised
    }
    expect(raised).toBe(true)
    expect(world.events.some((e) => e.type === 'got-raise')).toBe(true)
  })
})

describe("the foreman's warning", () => {
  it('warns the player once per spell before the dismissal zone', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)
    giveJob(world, a, 230, 15_000)

    // Drift and rival pendings can each steal a month; hold the performance
    // down and wait for the foreman.
    let warned = false
    for (let i = 0; i < 12 && !warned; i++) {
      if (world.employment.has(a.id)) {
        world.employment.set(a.id, { ...world.employment.get(a.id)!, performance: 230 })
      } else {
        giveJob(world, a, 230, 15_000)
      }
      advanceTick(world)
      if (world.player.pending?.kind === 'foremans-warning') warned = true
      else resolveSafely(world)
    }
    expect(warned).toBe(true)
    expect(world.events.some((e) => e.type === 'warned-at-work')).toBe(true)

    const before = world.employment.get(a.id)?.performance ?? 0
    resolvePending(world, 'knuckle-down')
    const after = world.employment.get(a.id)?.performance ?? 0
    expect(after).toBe(Math.min(1000, before + 80))

    // Slipping again in the SAME job: the warning came once.
    world.employment.set(a.id, { ...world.employment.get(a.id)!, performance: 210 })
    for (let i = 0; i < 3; i++) {
      advanceTick(world)
      expect(world.player.pending?.kind).not.toBe('foremans-warning')
      resolveSafely(world)
      if (!world.employment.has(a.id)) return // the modelled dismissal is allowed to fire
      world.employment.set(a.id, { ...world.employment.get(a.id)!, performance: 210 })
    }
  })
})

// ---------------------------------------------------------------------------
// Education, money, health, service
// ---------------------------------------------------------------------------

describe('requestEnrolment', () => {
  it('opens the same 18–24 window the town keeps, honestly', () => {
    const world = createWorld(makeSeed(2024), 100)
    const young = [...world.people.values()].find((p) => {
      if (p.deathTick !== null) return false
      const age = ageAt(p.birthTick, world.tick)
      const education = world.education.get(p.id)
      return age >= 18 && age <= 24 && education?.level === 'secondary' && education.enrolledIn === null
    })
    if (!young) throw new Error('no eligible young adult in the founding town')
    setPlayer(world, young.id)

    const result = requestEnrolment(world, 'college')
    expect(result.enrolled).toBe(true)
    expect(world.education.get(young.id)?.enrolledIn).toBe('college')
    expect(requestEnrolment(world, 'trade').reason).toContain('Already enrolled')

    const old = [...world.people.values()].find(
      (p) => p.deathTick === null && ageAt(p.birthTick, world.tick) >= 30,
    )
    if (!old) throw new Error('no elder in town')
    setPlayer(world, old.id)
    expect(requestEnrolment(world, 'college').reason.length).toBeGreaterThan(0)
  })
})

describe('spending stance', () => {
  it('moves discretionary spending the way the stance says, and only for the chooser', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)
    // A surplus to steer: hand the wife a good wage.
    giveJob(world, wife, 800, 50_000)
    const household = world.households.get(wife.householdId!)
    if (!household) throw new Error('couple without a household')
    const base = discretionaryFor(world, household)
    if (base <= 0) throw new Error('cast a household with a surplus')

    expect(chooseSpendStance(world, 'thrifty').set).toBe(true)
    const thrifty = discretionaryFor(world, world.households.get(household.id)!)
    expect(thrifty).toBeLessThan(base)
    expect(world.events.some((e) => e.type === 'changed-spending' && e.detail === 'thrifty')).toBe(true)
    const record = world.causalRecords.find((r) => r.decision === 'spending')
    expect(record?.inputs.some((i) => i.factor === 'own-choice')).toBe(true)

    // One change a month.
    expect(chooseSpendStance(world, 'loose').reason).toContain('settled this month')

    passMonths(world, 1)
    resolveSafely(world)
    expect(chooseSpendStance(world, 'loose').set).toBe(true)
    const loose = discretionaryFor(world, world.households.get(household.id)!)
    expect(loose).toBeGreaterThan(thrifty)
  })

  it('setSpendStance is a no-op when nothing changes', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    const events = world.events.length
    setSpendStance(world, world.tick, wife.id, null)
    expect(world.events.length).toBe(events)
  })
})

describe('lookForPlace', () => {
  it('moves the household when the rent is honest, refuses when it is not', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)
    const household = world.households.get(wife.householdId!)
    if (!household) throw new Error('no household')
    // Fatten the pot's income by hand: give the wife a good job.
    giveJob(world, wife, 800, 50_000)

    const streets = [...world.places.values()]
      .filter((p) => p.kind === 'neighbourhood' && p.id !== household.placeId)
      .sort((a, b) => a.desirability - b.desirability)
    const target = streets[0]
    if (!target) throw new Error('a one-street town')

    const result = lookForPlace(world, target.id)
    expect(result.moved).toBe(true)
    expect(world.households.get(household.id)?.placeId).toBe(target.id)
    expect(world.events.some((e) => e.type === 'moved-house')).toBe(true)

    // Half-year cooldown.
    const next = streets[1]
    if (next) expect(lookForPlace(world, next.id).reason).toContain('settle')
  })
})

describe('convalesce stance', () => {
  it('is repeatable monthly while anything ails', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)
    expect(setConvalescenceStance(world, true).reason).toContain('Nothing ails')

    const record = world.health.get(a.id)
    world.health.set(a.id, {
      ...(record ?? {
        personId: a.id,
        ailment: null,
        ailmentKind: null,
        ailmentSite: null,
        severity: 0,
        peakSeverity: 0,
        sinceTick: null,
        disability: 0,
        askedConvalesce: false,
        marks: [],
        serviceDisability: 0,
        ailmentServiceConnected: false,
      }),
      ailment: 'illness' as const,
      severity: 640,
      peakSeverity: 640,
      sinceTick: world.tick,
    })

    expect(setConvalescenceStance(world, true).set).toBe(true)
    expect(world.health.get(a.id)?.severity).toBe(420)
    expect(world.events.some((e) => e.type === 'convalesced' && e.detail === 'rest')).toBe(true)

    // Once a month —
    expect(setConvalescenceStance(world, false).reason).toContain('already being carried')
    // — but next month again, unlike the old once-per-ailment ask.
    passMonths(world, 1)
    resolveSafely(world)
    if ((world.health.get(a.id)?.ailment ?? null) !== null) {
      expect(setConvalescenceStance(world, false).set).toBe(true)
    }
  })
})

describe('requestDischarge / retrain', () => {
  it('the discharge request is an honest no with the term on it', () => {
    const world = createWorld(makeSeed(2024), 100)
    const { a } = findSingles(world)
    setPlayer(world, a.id)
    expect(requestDischarge(world).reason).toContain('Not serving')

    const specialty = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!specialty) throw new Error('no walk-in specialty')
    enlistPerson(world, world.tick, a, specialty, [])
    const logBefore = world.player.log.length
    const eventsBefore = world.events.length
    const recordBefore = world.service.get(a.id)
    const refusal = requestDischarge(world)
    expect(refusal.discharged).toBe(false)
    expect(refusal.reason).toContain('month')
    // A pure refusal: no log entry burned, no event, no state moved.
    expect(world.player.log.length).toBe(logBefore)
    expect(world.events.length).toBe(eventsBefore)
    expect(world.service.get(a.id)).toEqual(recordBefore)
  })

  it('signing again raises the retrain question, and the trade can change', () => {
    const world = createWorld(makeSeed(2024), 100)
    // Someone with secondary schooling, so alternatives exist.
    const soldier = [...world.people.values()].find((p) => {
      if (p.deathTick !== null) return false
      const age = ageAt(p.birthTick, world.tick)
      return age >= 18 && age <= 24 && world.education.get(p.id)?.level === 'secondary'
    })
    if (!soldier) throw new Error('nobody to enlist')
    setPlayer(world, soldier.id)
    const specialty = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!specialty) throw new Error('no walk-in specialty')
    enlistPerson(world, world.tick, soldier, specialty, [])

    // Run the term down to its last month by hand; the question follows.
    const record = world.service.get(soldier.id)
    if (!record) throw new Error('enlistment did not take')
    world.service.set(soldier.id, { ...record, termMonthsLeft: 1 })
    let guard = 0
    while (world.player.pending?.kind !== 'reenlist' && guard < 24) {
      if (world.player.pending !== null) resolveSafely(world)
      advanceTick(world)
      guard++
    }
    expect(world.player.pending?.kind).toBe('reenlist')
    // C3-era reenlistment is a CHAIN: agree, choose a term, choose an
    // option where one is offered, then take the oath. Driving it end to
    // end is what a player does.
    //
    // AND THE TRADE QUESTION IS ONE OF THE OPTIONS (owner: "I don't think we
    // should be able to change jobs every single time we reenlist"). It used
    // to follow every oath for free; now it has to be bought with the slot
    // the bonus would have taken, so this drive elects it deliberately.
    resolvePending(world, 'reenlist')
    let sawOptions = false
    while (
      world.player.pending !== null &&
      (world.player.pending.kind === 'reenlist-term' ||
        world.player.pending.kind === 'reenlist-option' ||
        world.player.pending.kind === 'service-contract')
    ) {
      const options = world.player.pending.options
      if (world.player.pending.kind === 'reenlist-option') {
        expect(options).toContain('reclass')
        sawOptions = true
        resolvePending(world, 'reclass')
        continue
      }
      resolvePending(world, options[0] ?? 'take-the-oath')
    }
    expect(sawOptions).toBe(true)

    const followUp = world.player.pending
    if (followUp === null) {
      // No same-branch alternative admits this schooling — allowed, but with
      // the walk-in trades in content there should be one; flag if not.
      const alternatives = SPECIALTIES.filter(
        (sp) => sp.branch === specialty.branch && sp.id !== specialty.id,
      )
      expect(alternatives.length).toBe(0)
      return
    }
    expect(followUp.kind).toBe('retrain')
    const alternative = followUp.options.find((option) => option !== 'keep')
    if (alternative === undefined) throw new Error('retrain question with no alternative')
    const retrainTick = followUp.tick
    resolvePending(world, alternative)
    const after = world.service.get(soldier.id)
    expect(after?.specialtyId).toBe(alternative)
    // The old trade joins the record's history — nothing served is erased —
    // and the school clock starts (military review M1/S2).
    expect(after?.priorSpecialtyIds).toContain(specialty.id)
    expect(after?.specialtyChangedAtTick).toBe(retrainTick)
    const newSchool = SPECIALTIES.find((sp) => sp.id === alternative)
    expect(
      world.events.some(
        (e) =>
          e.type === 'began-training' &&
          e.tick === retrainTick &&
          e.detail === `${newSchool?.title ?? ''} school`,
      ),
    ).toBe(true)
    expect(
      world.causalRecords.some(
        (r) => r.decision === 'training' && r.tick === retrainTick && r.subjectId === soldier.id,
      ),
    ).toBe(true)
  })

  it('and a term signed for anything else leaves the trade alone', () => {
    const world = createWorld(makeSeed(2024), 100)
    const soldier = [...world.people.values()].find((p) => {
      if (p.deathTick !== null) return false
      const age = ageAt(p.birthTick, world.tick)
      return age >= 18 && age <= 24 && world.education.get(p.id)?.level === 'secondary'
    })
    if (!soldier) throw new Error('nobody to enlist')
    setPlayer(world, soldier.id)
    const specialty = SPECIALTIES.find((sp) => sp.requires === 'none')
    if (!specialty) throw new Error('no walk-in specialty')
    enlistPerson(world, world.tick, soldier, specialty, [])

    const record = world.service.get(soldier.id)
    if (!record) throw new Error('enlistment did not take')
    world.service.set(soldier.id, { ...record, termMonthsLeft: 1 })
    let guard = 0
    while (world.player.pending?.kind !== 'reenlist' && guard < 24) {
      if (world.player.pending !== null) resolveSafely(world)
      advanceTick(world)
      guard++
    }
    expect(world.player.pending?.kind).toBe('reenlist')

    resolvePending(world, 'reenlist')
    while (
      world.player.pending !== null &&
      (world.player.pending.kind === 'reenlist-term' ||
        world.player.pending.kind === 'reenlist-option' ||
        world.player.pending.kind === 'service-contract')
    ) {
      const options = world.player.pending.options
      // Anything that is not reclassification — the school, the money, the
      // station. A trade you can walk away from every four years for free is
      // not a trade.
      const pick = options.find((o) => o !== 'reclass') ?? 'take-the-oath'
      resolvePending(world, pick)
    }

    expect(world.player.pending?.kind).not.toBe('retrain')
    const after = world.service.get(soldier.id)
    expect(after?.specialtyId).toBe(specialty.id)
    expect(after?.specialtyChangedAtTick).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Move pendings carry the candidate list
// ---------------------------------------------------------------------------

describe('move choices offer every candidate', () => {
  it("resolving 'to-<placeId>' moves to that street, not the engine's pick", () => {
    const world = createWorld(makeSeed(2024), 100)
    const { wife } = findCouple(world)
    setPlayer(world, wife.id)
    const household = world.households.get(wife.householdId!)
    if (!household) throw new Error('no household')
    const streets = [...world.places.values()].filter(
      (p) => p.kind === 'neighbourhood' && p.id !== household.placeId,
    )
    const [suggested, chosen] = streets
    if (!suggested || !chosen) throw new Error('too few streets')

    raisePending(world, {
      tick: world.tick,
      kind: 'move-house',
      personId: wife.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: suggested.id,
      options: ['accept', 'decline', `to-${String(chosen.id)}`],
    })
    resolvePending(world, `to-${String(chosen.id)}`)
    expect(world.households.get(household.id)?.placeId).toBe(chosen.id)
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('verbs are deterministic inputs', () => {
  it('same seed + same verbs at the same ticks = byte-identical worlds', () => {
    const run = () => {
      const world = createWorld(makeSeed(9100), 100)
      const { a, b } = findSingles(world)
      setPlayer(world, a.id)
      befriend(world, a, b, 620)
      courtFriend(world, b.id)
      spendTimeWith(world, b.id)
      passMonths(world, 6)
      return worldHashHex(world)
    }
    expect(run()).toBe(run())
  })
})
