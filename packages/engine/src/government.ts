/**
 * GOVERNMENT — who holds the seats, and how they got them.
 *
 * Phase 1 of the owner's `government_revamp_plan.md`, whose build order
 * is explicit about starting here: "a living government exists — seed NPC
 * officeholders + an election calendar + a policy state with sane
 * defaults; the player can vote. (Effects light at first.)"
 *
 * LIGHT ON PURPOSE. The levers are set and read and moved by elections,
 * and they are not yet plugged into the economy, crime or the schools.
 * That is phase 2, one system at a time, so that when a golden hash moves
 * there is exactly one plausible reason for it. Wiring four systems and a
 * new module at once is how you spend a day bisecting your own work.
 *
 * Fictional parties and fictional officeholders, in a real kind of
 * government (charter §3). The parties are named in the mockup.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { openStream, Stream } from './rng.js'
import { recordEvent } from './records.js'
import type { Election, Office, Officeholder, Party, PolicyState, Person, World } from './types.js'

const TICKS_PER_YEAR = 12

/**
 * THE PARTIES. Not a left and a right on a line — a town's politics is
 * about what it is willing to pay for, so each one leans on the levers
 * differently and that lean is what a voter is choosing between.
 *
 * Leans are per-mille of each lever's range. Balance numbers.
 */
export const PARTIES: readonly Party[] = [
  { id: 'progress', name: 'Progress Party', tone: 'accent', taxLean: 700, policeLean: 450, schoolLean: 800 },
  { id: 'heritage', name: 'Heritage Party', tone: 'bad', taxLean: 300, policeLean: 800, schoolLean: 400 },
  { id: 'commonwealth', name: 'Commonwealth Party', tone: 'ok', taxLean: 520, policeLean: 600, schoolLean: 600 },
]

/** How long a ballot is open before it decides. */
export const CAMPAIGN_MONTHS = 3

export function partyById(id: string): Party | undefined {
  return PARTIES.find((party) => party.id === id)
}

/**
 * THE OFFICES, as a ladder (spec §1).
 *
 * Phase 1 seats the local tier only. The state and national rungs are
 * declared because the ladder is the design — `needsPrior` is what makes
 * it a climb rather than a menu, and writing it down now means phase 5
 * adds behaviour rather than re-deciding the shape.
 */
export const OFFICES: readonly Office[] = [
  { id: 'school-board', title: 'School Board member', level: 'local', termYears: 4, minAge: 21 },
  { id: 'council', title: 'City Councillor', level: 'local', termYears: 4, minAge: 21 },
  { id: 'sheriff', title: 'County Sheriff', level: 'local', termYears: 4, minAge: 25 },
  {
    id: 'mayor',
    title: 'Mayor',
    level: 'local',
    termYears: 4,
    minAge: 25,
    needsPrior: ['council', 'school-board'],
  },
  {
    id: 'legislator',
    title: 'State Legislator',
    level: 'state',
    termYears: 2,
    minAge: 25,
    needsPrior: ['council', 'mayor', 'school-board'],
  },
  {
    id: 'governor',
    title: 'Governor',
    level: 'state',
    termYears: 4,
    minAge: 30,
    needsPrior: ['legislator', 'mayor'],
  },
  {
    id: 'representative',
    title: 'U.S. Representative',
    level: 'national',
    termYears: 2,
    minAge: 25,
    needsPrior: ['legislator', 'mayor', 'governor'],
  },
  {
    id: 'senator',
    title: 'U.S. Senator',
    level: 'national',
    termYears: 6,
    minAge: 30,
    needsPrior: ['representative', 'governor'],
  },
  {
    id: 'president',
    title: 'President',
    level: 'national',
    termYears: 4,
    minAge: 35,
    needsPrior: ['senator', 'governor', 'representative'],
  },
]

export function officeById(id: string): Office | undefined {
  return OFFICES.find((office) => office.id === id)
}

/** The seats this town actually fills in phase 1. */
export const SEATED_OFFICES: readonly string[] = ['mayor', 'sheriff', 'council', 'school-board']

/**
 * SANE DEFAULTS (spec §8 step 1).
 *
 * Sized so that phase 2 can plug each one in and see a difference without
 * the starting world being unrecognisable: the property tax is a real
 * number that a household would notice, and the two funding levers start
 * at the middle of their range so there is somewhere to go in both
 * directions.
 */
export function freshPolicy(): PolicyState {
  return {
    // MATCHES THE RATE REAL ESTATE ALREADY CHARGED. Phase 2 wires this
    // lever into ownershipCostOf, and starting it anywhere else would
    // have changed every household's bill on day one — a rate change
    // smuggled in with the wiring, and a golden shift with two causes.
    // A world begins exactly as it did; only a government moves it.
    propertyTaxPerMille: 11,
    policeFunding: 500,
    schoolFunding: 500,
    incomeTaxPerMille: 220,
  }
}

/** Whether somebody could stand for this seat at all. */
export function eligibleFor(world: World, person: Person, office: Office, tick: Tick): boolean {
  if (person.deathTick !== null) return false
  if (ageAt(person.birthTick, tick) < office.minAge) return false
  if (office.needsPrior === undefined) return true
  // THE CLIMB. A seat with prior requirements wants somebody who has
  // actually held one of them — currently or in the past, which is why
  // this reads the ledger rather than the current holders.
  return world.events.some(
    (event) =>
      event.type === 'took-office' &&
      event.subjectId === person.id &&
      office.needsPrior?.includes(event.detail ?? '') === true,
  )
}

/**
 * WHO STANDS, and who wins.
 *
 * Deliberately not a popularity contest between simulated personalities —
 * phase 1 is about the government EXISTING. A candidate's showing is
 * their standing in the town (age, schooling, a clean record) plus a
 * seeded swing, and the swing is what makes an election an election.
 */
function standingOf(world: World, person: Person, tick: Tick): number {
  let score = 300
  const education = world.education.get(person.id)
  score += (education?.attainment ?? 0) / 4
  // Somebody the town has heard of. A record at the courthouse is the
  // loudest thing on a ballot.
  const criminal = world.criminal.get(person.id)
  if (criminal !== undefined && criminal.convictions.length > 0) score -= 220
  const age = ageAt(person.birthTick, tick)
  if (age > 60) score -= (age - 60) * 4
  return Math.max(0, score)
}

/**
 * WHO IS STANDING, and how the town is leaning.
 *
 * Polling is per-mille and deliberately does NOT sum to 1000 — the
 * mockup shows 48% against 45% with the rest undecided, and that gap is
 * the most honest thing on the screen. An election with no undecideds is
 * a result pretending to be a forecast.
 */
function drawRunners(world: World, officeId: string, tick: Tick): Election['runners'] {
  const office = officeById(officeId)
  if (office === undefined) return []
  const rng = openStream(world.seed, Stream.Politics, officeId.length * 31, tick)
  const found: { personId: EntityId; partyId: string; showing: number }[] = []
  for (const person of world.people.values()) {
    if (!eligibleFor(world, person, office, tick)) continue
    if (!rng.chance(Math.max(2, Math.floor(person.traits.ambition / 60)), 1000)) continue
    const partyId = PARTIES[Math.abs(person.id) % PARTIES.length]?.id ?? 'commonwealth'
    found.push({
      personId: person.id,
      partyId,
      showing: standingOf(world, person, tick) + rng.nextIntInclusive(0, 250),
    })
    if (found.length >= 3) break
  }
  if (found.length === 0) return []
  found.sort((a, b) => b.showing - a.showing || a.personId - b.personId)
  const undecided = rng.nextIntInclusive(60, 180)
  const total = found.reduce((sum, r) => sum + r.showing, 0)
  return found.map((r) => ({
    personId: r.personId,
    partyId: r.partyId,
    polling: total <= 0 ? 0 : Math.floor(((1000 - undecided) * r.showing) / total),
  }))
}

/** The ballots open right now, for the screen. */
export function openBallots(world: World): readonly Election[] {
  return [...world.elections.values()].sort((a, b) =>
    a.officeId < b.officeId ? -1 : a.officeId > b.officeId ? 1 : 0,
  )
}

/**
 * Why this ballot cannot be marked, or null. The bar pattern: the screen
 * greys the button from the same answer the verb refuses with.
 */
export function voteBar(
  world: World,
  personId: EntityId,
  officeId: string,
  tick: Tick,
): string | null {
  const election = world.elections.get(officeId)
  if (election === undefined) return 'No ballot is open for that seat.'
  if (tick >= election.decidesAtTick) return 'That election has been decided.'
  const person = world.people.get(personId)
  if (person === undefined || person.deathTick !== null) return 'Nobody is being played.'
  if (ageAt(person.birthTick, tick) < 18) return 'You are not old enough to vote.'
  if (election.playerVote !== undefined) return 'You have already voted in this race.'
  return null
}

export function castVote(
  world: World,
  personId: EntityId,
  officeId: string,
  forPersonId: EntityId,
  tick: Tick,
): boolean {
  if (voteBar(world, personId, officeId, tick) !== null) return false
  const election = world.elections.get(officeId)
  if (election === undefined) return false
  if (!election.runners.some((r) => r.personId === forPersonId)) return false
  world.elections.set(officeId, { ...election, playerVote: forPersonId })
  recordEvent(world, tick, { type: 'voted', subjectId: personId, detail: officeId })
  return true
}

/**
 * WHO WON.
 *
 * The polls decide it with a seeded swing on the day — a forecast that is
 * always right is not a forecast, and an election nobody can be surprised
 * by is not worth showing. The player's vote counts as one vote, which is
 * what it is (spec §2: "your vote is one of many, but it's real
 * participation").
 */
function decide(
  world: World,
  election: Election,
  tick: Tick,
): Election['runners'][number] | undefined {
  const rng = openStream(world.seed, Stream.Politics, election.officeId.length * 977, tick)
  let best: Election['runners'][number] | undefined
  let bestScore = -1
  for (const runner of election.runners) {
    const own = election.playerVote === runner.personId ? 1 : 0
    const score = runner.polling + rng.nextIntInclusive(-90, 90) + own
    if (score > bestScore) {
      bestScore = score
      best = runner
    }
  }
  return best
}

/** Seat somebody, and say so. */
function takeOffice(
  world: World,
  tick: Tick,
  officeId: string,
  personId: EntityId,
  partyId: string,
): void {
  const office = officeById(officeId)
  if (office === undefined) return
  const holder: Officeholder = {
    officeId,
    personId,
    partyId,
    sinceTick: tick,
    termEndsTick: (tick + office.termYears * TICKS_PER_YEAR) as Tick,
    approval: 500,
  }
  world.officials.set(officeId, holder)
  recordEvent(world, tick, { type: 'took-office', subjectId: personId, detail: officeId })
}

/**
 * THE POLICY A GOVERNMENT ACTUALLY SETS.
 *
 * Whoever holds the mayoralty pulls the local levers TOWARD their party's
 * lean rather than to it. A term is not long enough to remake a town, and
 * a government that swung the whole range every four years would make the
 * levers noise rather than policy.
 *
 * PHASE 1 STOPS HERE ON PURPOSE. These numbers move and are shown, and
 * nothing downstream reads them yet — the economy, crime and the schools
 * are wired one at a time in phase 2 so that when a golden hash moves
 * there is exactly one plausible cause for it.
 */
function applyPartyLean(world: World): void {
  const mayor = world.officials.get('mayor')
  const party = mayor === undefined ? undefined : partyById(mayor.partyId)
  if (party === undefined) return
  const current = world.policy
  const toward = (now: number, target: number, step: number): number =>
    now + Math.trunc((target - now) / step)
  ;(world as { policy: PolicyState }).policy = {
    // The tax lean is per-mille of a 0-40 range.
    propertyTaxPerMille: toward(
      current.propertyTaxPerMille,
      Math.floor((party.taxLean * 40) / 1000),
      8,
    ),
    policeFunding: toward(current.policeFunding, party.policeLean, 8),
    schoolFunding: toward(current.schoolFunding, party.schoolLean, 8),
    incomeTaxPerMille: current.incomeTaxPerMille,
  }
}

/**
 * One month of government: decide what is due, open what is coming, and
 * let whoever holds the mayoralty lean on the levers.
 */
export function runGovernment(world: World, tick: Tick): void {
  for (const officeId of SEATED_OFFICES) {
    const holder = world.officials.get(officeId)
    const alive = holder !== undefined && world.people.get(holder.personId)?.deathTick === null

    const election = world.elections.get(officeId)
    if (election !== undefined && tick >= election.decidesAtTick) {
      const winner = decide(world, election, tick)
      world.elections.delete(officeId)
      if (winner !== undefined) {
        takeOffice(world, tick, officeId, winner.personId, winner.partyId)
        continue
      }
    }
    // A campaign in progress is left to run. That wait IS the ballot.
    if (world.elections.has(officeId)) continue

    const ending = holder === undefined || !alive || tick + CAMPAIGN_MONTHS >= holder.termEndsTick
    if (!ending) continue

    const runners = drawRunners(world, officeId, tick)
    if (runners.length === 0) continue
    // An EMPTY seat cannot wait three months for a campaign; a seat whose
    // term is merely ending can, and should.
    const urgent = holder === undefined || !alive
    world.elections.set(officeId, {
      officeId,
      opensAtTick: tick,
      decidesAtTick: (urgent ? tick + 1 : tick + CAMPAIGN_MONTHS) as Tick,
      runners,
    })
  }
  applyPartyLean(world)
}

/** Who holds a seat right now, for the screen. */
export function holderOf(world: World, officeId: string): Officeholder | undefined {
  return world.officials.get(officeId)
}

/** Has this person ever held a seat? The ladder reads it. */
export function heldOffices(world: World, personId: EntityId): readonly string[] {
  const held: string[] = []
  for (const event of world.events) {
    if (event.type !== 'took-office' || event.subjectId !== personId) continue
    const officeId = event.detail ?? ''
    if (!held.includes(officeId)) held.push(officeId)
  }
  return held
}
