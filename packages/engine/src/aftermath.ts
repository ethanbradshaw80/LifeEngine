/**
 * WHAT A WAR LEAVES (MILITARY_DEPTH_PLAN §5.1, §5.2, §6, §7).
 *
 * Four things that all hang off one another, which is why they are one module
 * and why §15 puts §7 last: trauma is driven by what specifically happened,
 * and "what specifically happened" is §5.1's engagement result and §6's bond.
 *
 *   §5.1 THE ENGAGEMENT, ALWAYS REPORTED. What it cost both sides, who did
 *   what, who was hurt, BY NAME. Squad results are always visible.
 *
 *   §5.2 PERSONAL ATTRIBUTION, RARE AND UNCERTAIN. Fire is collective and
 *   most infantrymen never confirm one. A count exists only where a real
 *   person would have one — a sniper's, SPOTTER-CONFIRMED, which turns a
 *   statistic into a relationship. NO LIFETIME COUNTER TO FARM.
 *
 *   §6 BOND IS EARNED, NOT WAITED OUT. Months become the smallest input.
 *   What moves it: coming through a bad contact together, him being hit, you
 *   being hit and him staying, losing somebody you both knew.
 *
 *   §7 LASTING PSYCHOLOGICAL INJURY. Well under half, MEASURED and reported
 *   rather than asserted, driven by WHO — a named squadmate lost, a
 *   mass-casualty event, a near miss — never by "was deployed". It routes
 *   into wellbeing, the medical board and the claim path, and RECOVERY IS
 *   REAL (Law 7): this is not a permanent stat debuff.
 *
 * ALL OF IT IS DERIVED FROM THE EVENT RECORD, which already holds every input
 * these four need. No new world state, nothing to migrate, and a save written
 * before this reads its own history correctly.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { eventsFor } from './eventindex.js'
import { hash32, Stream } from './rng.js'
import type { World } from './types.js'

/**
 * §6. WHAT THIS TWO PEOPLE HAVE BEEN THROUGH, 0–1000.
 *
 * Months are the smallest input — a year of standing next to somebody in a
 * motor pool is worth less than one afternoon on a ridge, and that is the
 * correction §6 asks for.
 */
export interface Bond {
  readonly strength: number
  /** What actually built it, in the order it happened. */
  readonly reasons: readonly string[]
}

export function warBondWith(
  world: World,
  personId: EntityId,
  mateId: EntityId,
  sinceTick: Tick,
  tick: Tick,
): Bond {
  const reasons: string[] = []
  let strength = 0

  // TIME, AND IT IS THE SMALLEST INPUT. Twelve months together is worth about
  // as much as one bad afternoon, which is the whole point of §6.
  const months = Math.max(0, tick - sinceTick)
  const fromTime = Math.min(120, months * 4)
  strength += fromTime
  if (months >= 6) reasons.push(`${String(months)} months in the same squad`)

  const mine = eventsFor(world, personId)
  const theirs = eventsFor(world, mateId)

  // COMING THROUGH A BAD CONTACT TOGETHER. Same tick, both of them, in it.
  const myContacts = new Set(mine.filter((e) => e.type === 'saw-combat').map((e) => e.tick))
  let shared = 0
  for (const event of theirs) {
    if (event.type !== 'saw-combat') continue
    if (event.tick < sinceTick || event.tick > tick) continue
    if (myContacts.has(event.tick)) shared += 1
  }
  if (shared > 0) {
    strength += Math.min(300, shared * 90)
    reasons.push(`${String(shared)} contact${shared === 1 ? '' : 's'} together`)
  }

  // HIM BEING HIT, and you being hit and him staying. Both directions,
  // because they are not the same experience and both build the same thing.
  const hurtBetween = (events: readonly { type: string; tick: Tick }[]): number =>
    events.filter((e) => e.type === 'wounded-in-action' && e.tick >= sinceTick && e.tick <= tick)
      .length
  const heWasHit = hurtBetween(theirs)
  const iWasHit = hurtBetween(mine)
  if (heWasHit > 0) {
    strength += Math.min(220, heWasHit * 140)
    reasons.push(heWasHit === 1 ? 'he was hit and you were there' : 'he was hit more than once')
  }
  if (iWasHit > 0) {
    strength += Math.min(220, iWasHit * 140)
    reasons.push('you were hit and he stayed')
  }

  // LOSING SOMEBODY YOU BOTH KNEW. The strongest single input there is.
  const lost = sharedLosses(world, personId, mateId, sinceTick, tick)
  if (lost > 0) {
    strength += Math.min(300, lost * 200)
    reasons.push(lost === 1 ? 'you buried the same man' : `you buried ${String(lost)} of the same men`)
  }

  return { strength: Math.max(0, Math.min(1000, strength)), reasons }
}

/** How many people both of them served beside died in the window. */
function sharedLosses(
  world: World,
  personId: EntityId,
  mateId: EntityId,
  sinceTick: Tick,
  tick: Tick,
): number {
  const tours = world.deployments.get(personId) ?? []
  const together = new Set<EntityId>()
  for (const tour of tours) {
    if (!(tour.squad ?? []).some((m) => m.personId === mateId)) continue
    for (const mate of tour.squad ?? []) {
      if (mate.personId !== personId && mate.personId !== mateId) together.add(mate.personId)
    }
  }
  let lost = 0
  for (const id of together) {
    const them = world.people.get(id)
    if (them?.deathTick === undefined || them.deathTick === null) continue
    if (them.deathTick >= sinceTick && them.deathTick <= tick) lost += 1
  }
  return lost
}

/**
 * §5.2. WHETHER THIS TRADE COUNTS AT ALL, and who confirms it.
 *
 * "No lifetime counter to farm." A count exists where a real person would
 * have one and nowhere else, and the sniper's is SPOTTER-CONFIRMED — the
 * confirmation being a named person is what turns a statistic into a
 * relationship.
 */
export interface Attribution {
  /** Null where this trade does not count, which is almost everybody. */
  readonly confirmed: number | null
  /** The person who confirmed them, where the trade works in pairs. */
  readonly confirmedBy: EntityId | null
  readonly words: string
}

const COUNTING_SPECIALTIES = new Set(['sniper', 'scout-sniper', 'special-forces', 'reconnaissance'])

export function attributionFor(world: World, personId: EntityId, tick: Tick): Attribution {
  const record = world.service.get(personId)
  if (record === undefined) {
    return { confirmed: null, confirmedBy: null, words: '' }
  }
  const counts =
    COUNTING_SPECIALTIES.has(record.specialtyId) || record.unitId !== null
  if (!counts) {
    /**
     * THE HONEST ANSWER FOR ALMOST EVERYBODY, and it is a better line than a
     * number: "fire is collective; most infantrymen never confirm one."
     */
    return {
      confirmed: null,
      confirmedBy: null,
      words:
        'Fire is collective and nobody here counts. You have fired at people and you do not know, and you are not going to.',
    }
  }

  // The contacts they were actually in, which is the only thing a count can
  // be built from — no free-floating lifetime number.
  const contacts = eventsFor(world, personId).filter(
    (event) => event.type === 'saw-combat' && event.tick <= tick,
  )
  let confirmed = 0
  for (const contact of contacts) {
    // Uncertain by default even for the trades that count: most contacts
    // confirm nothing at all.
    const draw = hash32(world.seed, Stream.CombatResolution, personId, 99_000 + contact.tick)
    if (draw % 100 < 34) confirmed += 1 + (draw % 2)
  }
  if (confirmed === 0) {
    return {
      confirmed: 0,
      confirmedBy: null,
      words: 'Nothing confirmed. Plenty of rounds, and no answers.',
    }
  }

  // THE SPOTTER, BY NAME. A sniper's count is somebody else's word.
  const tour = (world.deployments.get(personId) ?? []).find(
    (each) => each.startedAtTick <= tick && (each.returnedAtTick === null || each.returnedAtTick >= tick),
  )
  const spotter = (tour?.squad ?? []).find((mate) => mate.personId !== personId)
  const them = spotter === undefined ? undefined : world.people.get(spotter.personId)
  return {
    confirmed,
    confirmedBy: spotter?.personId ?? null,
    words:
      them === undefined
        ? `${String(confirmed)} confirmed, and no second pair of eyes on any of them.`
        : `${String(confirmed)} confirmed, every one of them by ${them.givenName} ${them.familyName}, who was lying next to you and wrote them down.`,
  }
}

/**
 * §7. WHAT IT DID TO THEM, 0–1000 — and WHO it was about.
 *
 * "Driven by what specifically happened — losing a named squadmate, a
 * mass-casualty event, a near miss — never by 'was deployed'."
 *
 * The returned `causes` are people and events, not a number, which is what
 * lets the game explain it (Law 3) and what makes recovery mean something.
 */
export interface Aftermath {
  readonly burden: number
  /**
   * Named people and specific days, together. Kept because it is the plain
   * "can this explain itself" check, and Law 3 is about being able to.
   */
  readonly causes: readonly string[]
  /**
   * THE TWO KINDS, SEPARATED — and they have to be, because they cannot go in
   * one sentence.
   *
   * OWNER, reading the first version: "the wordings doesnt make sense." It
   * joined these into one list with commas and produced "It is about Roy
   * Dillard, the day you were hit, being held." People and events are
   * different grammar; a screen can only write them properly if it is given
   * them apart.
   */
  readonly lost: readonly string[]
  readonly own: readonly string[]
  /** Whether it crossed into something a doctor would put a name to. */
  readonly lasting: boolean
}

/** Above this it is a condition rather than a bad few years. */
export const LASTING_AT = 620

export function aftermathOf(world: World, personId: EntityId, tick: Tick): Aftermath {
  const record = world.service.get(personId)
  if (record === undefined) {
    return { burden: 0, causes: [], lost: [], own: [], lasting: false }
  }

  const lost: string[] = []
  const own: string[] = []
  let burden = 0

  // LOSING SOMEBODY BY NAME. The single largest input, and it is a person.
  const tours = world.deployments.get(personId) ?? []
  const knew = new Set<EntityId>()
  for (const tour of tours) for (const mate of tour.squad ?? []) knew.add(mate.personId)
  knew.delete(personId)
  for (const id of [...knew].sort((a, b) => a - b)) {
    const them = world.people.get(id)
    if (them?.deathTick === undefined || them.deathTick === null) continue
    if (them.deathTick > tick) continue
    burden += 150
    lost.push(`${them.givenName} ${them.familyName}`)
  }

  const mine = eventsFor(world, personId)
  // BEING HIT YOURSELF.
  const wounds = mine.filter((e) => e.type === 'wounded-in-action' && e.tick <= tick).length
  if (wounds > 0) {
    burden += Math.min(200, wounds * 90)
    own.push(wounds === 1 ? 'you were hit once' : `you were hit ${String(wounds)} times`)
  }
  // CAPTIVITY, which is its own category and always is.
  if (tours.some((tour) => tour.capturedAtTick !== null)) {
    burden += 260
    own.push('you were taken prisoner')
  }
  // A LOT OF CONTACT is an input, but a small one — §7 is explicit that this
  // is about WHO rather than how many months in country.
  const contacts = mine.filter((e) => e.type === 'saw-combat' && e.tick <= tick).length
  burden += Math.min(120, contacts * 8)

  /**
   * AND IT RECEDES (Law 7, and §7: "recovery is real... this is not a
   * permanent stat debuff"). Time since the last of it does real work, and a
   * man twenty years home is mostly not the man who came back.
   */
  let lastHard = 0
  for (const event of mine) {
    if (event.tick > tick) continue
    if (event.type === 'saw-combat' || event.type === 'wounded-in-action') {
      if (event.tick > lastHard) lastHard = event.tick
    }
  }
  const yearsSince = lastHard === 0 ? 0 : Math.floor((tick - lastHard) / 12)
  burden -= Math.min(400, yearsSince * 18)

  const bounded = Math.max(0, Math.min(1000, burden))
  return {
    burden: bounded,
    causes: [...lost, ...own],
    lost,
    own,
    lasting: bounded >= LASTING_AT,
  }
}
