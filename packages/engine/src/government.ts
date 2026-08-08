/**
 * WHAT A LEVER COSTS, in words the screen shows under it.
 *
 * The mockup writes the trade-off beside every lever, and it should:
 * a knob with no stated consequence is a cheat code. These are the
 * SAME facts the model actually implements — property tax really does
 * reach a mortgage, police funding really does reach clearance — so the
 * sentence is a description rather than a promise.
 */
export const LEVER_NOTES: Readonly<Record<string, string>> = {
  propertyTaxPerMille:
    'Higher funds the town but raises what every homeowner pays each month, and dents approval.',
  policeFunding: 'More crimes solved, but it comes out of the budget.',
  schoolFunding: 'Raises what a state-schooled child attains across the town.',
  incomeTaxPerMille: 'Funds the government and leans on every wage in it.',
}

/** What a lever is allowed to be. */
export const LEVER_RANGE: Readonly<Record<string, { min: number; max: number }>> = {
  propertyTaxPerMille: { min: 0, max: 40 },
  policeFunding: { min: 0, max: 1000 },
  schoolFunding: { min: 0, max: 1000 },
  incomeTaxPerMille: { min: 0, max: 500 },
}

/** Which levers a seat may actually pull (spec §4). */
export function leversOf(officeId: string): readonly string[] {
  switch (officeId) {
    case 'mayor':
      return ['propertyTaxPerMille', 'policeFunding', 'schoolFunding']
    case 'sheriff':
      return ['policeFunding']
    case 'school-board':
      return ['schoolFunding']
    case 'president':
      return ['incomeTaxPerMille']
    default:
      return []
  }
}

/**
 * Why this person cannot move that lever, or null.
 *
 * The bar pattern: a councillor is told the mayoralty sets the tax rate
 * rather than being shown a slider that does nothing.
 */
export function leverBar(
  world: World,
  personId: EntityId,
  lever: string,
): string | null {
  // THE SEAT THAT SETS THIS LEVER, not merely the first seat this person
  // holds. Even with one-seat-per-person enforced, asking the precise
  // question is what stops a future change from quietly reintroducing the
  // ambiguity that wrote a mayor's approval onto a school board.
  const seats = [...world.officials.values()].filter((h) => h.personId === personId)
  if (seats.length === 0) return 'You hold no office.'
  const seat = seats.find((h) => leversOf(h.officeId).includes(lever))
  if (seat === undefined) {
    const who = OFFICES.find((office) => leversOf(office.id).includes(lever))
    return who === undefined
      ? 'Nobody in this town sets that.'
      : `That is the ${who.title}'s to set, not yours.`
  }
  return null
}

/**
 * SET A LEVER, as the officeholder.
 *
 * The consequence is not modelled here — it is modelled in real estate,
 * in crime, in the schools and in the payroll, which is what phase 2 was
 * for. What happens HERE is that the town notices.
 */
export function setLever(
  world: World,
  personId: EntityId,
  lever: string,
  value: number,
  tick: Tick,
): boolean {
  if (leverBar(world, personId, lever) !== null) return false
  const range = LEVER_RANGE[lever]
  if (range === undefined) return false
  const clamped = Math.max(range.min, Math.min(range.max, Math.trunc(value)))
  const before = (world.policy as unknown as Record<string, number>)[lever] ?? 0
  if (clamped === before) return false
  ;(world as { policy: PolicyState }).policy = {
    ...world.policy,
    [lever]: clamped,
  } as PolicyState

  // APPROVAL ANSWERS FOR IT, and the direction is the honest one: people
  // like being taxed less and funded more, and the two pull against each
  // other, which is the whole of governing. A tax rise costs approval
  // even when it pays for something popular — the bill arrives before the
  // school does.
  const seat = [...world.officials.values()].find(
    (h) => h.personId === personId && leversOf(h.officeId).includes(lever),
  )
  if (seat !== undefined) {
    const raised = clamped > before
    const taxes = lever === 'propertyTaxPerMille' || lever === 'incomeTaxPerMille'
    const swing = taxes === raised ? -35 : 25
    world.officials.set(seat.officeId, {
      ...seat,
      approval: Math.max(0, Math.min(1000, seat.approval + swing)),
    })
  }
  recordEvent(world, tick, { type: 'set-policy', subjectId: personId, detail: lever })
  return true
}

/**
 * WHAT THE TOWN THINKS, month by month.
 *
 * Approval drifts toward what the levers have actually produced rather
 * than toward a number somebody chose: cheap housing and solved crimes
 * and funded schools are popular, and the money for them is not. An
 * officeholder who gives the town everything and taxes nothing is
 * popular right up until the budget is checked — which is phase 4's
 * other half, and the reason `townBudget` exists.
 */
export function townBudget(world: World): number {
  // Per-mille of what the town raises against what it spends. Positive is
  // a surplus. Deliberately coarse: this is a gauge on a screen, not an
  // accounting system, and pretending otherwise would invite somebody to
  // balance it to the cent.
  const revenue = world.policy.propertyTaxPerMille * 30 + world.policy.incomeTaxPerMille * 4
  const spend = world.policy.policeFunding + world.policy.schoolFunding
  return revenue - spend
}

function driftApproval(world: World, tick: Tick): void {
  if (tick % 3 !== 0) return
  const budget = townBudget(world)
  for (const [officeId, holder] of world.officials) {
    const levers = leversOf(officeId)
    if (levers.length === 0) continue
    let toward = 500
    // What their own levers have bought, and what they cost.
    if (levers.includes('policeFunding')) toward += (world.policy.policeFunding - 500) / 6
    if (levers.includes('schoolFunding')) toward += (world.policy.schoolFunding - 500) / 6
    if (levers.includes('propertyTaxPerMille')) toward -= (world.policy.propertyTaxPerMille - 11) * 8
    // A town that cannot pay for what it voted for turns on whoever
    // promised it.
    if (budget < 0) toward -= Math.min(180, -budget / 6)
    const target = Math.max(0, Math.min(1000, Math.trunc(toward)))
    world.officials.set(officeId, {
      ...holder,
      approval: holder.approval + Math.trunc((target - holder.approval) / 4),
    })
  }
}

/**
 * IS A DEBATE DUE TONIGHT? The office id, or null.
 *
 * REPORTS rather than raises. Raising a pending needs player.ts, and
 * player.ts already imports this module for the verbs — asking for it
 * here would close a cycle the ratchet refuses. So government answers the
 * question and `systems.ts`, which can already do both, acts on it.
 *
 * Once per campaign, halfway through: a campaign that debated every month
 * would be a chore rather than a night that matters.
 */
export function debateDue(world: World, tick: Tick): string | null {
  const playerId = world.player.personId
  if (playerId === null) return null
  for (const election of world.elections.values()) {
    if (!election.runners.some((r) => r.personId === playerId)) continue
    if (tick !== election.opensAtTick + 1) continue
    return election.officeId
  }
  return null
}/**
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

import type { EntityId, Money, Tick } from '@life-engine/shared'
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
  // NOBODY HOLDS TWO SEATS AT ONCE. Without this the mayor could also
  // win the school board — and did: a probe found one person sitting in
  // both, which made every lookup-by-person ambiguous and wrote a
  // mayor's approval onto a school-board seat.
  const sitting = new Set(
    [...world.officials.values()]
      .filter((h) => world.people.get(h.personId)?.deathTick === null)
      .map((h) => h.personId),
  )
  for (const person of world.people.values()) {
    if (!eligibleFor(world, person, office, tick)) continue
    // An incumbent may stand again for THEIR OWN seat, and only that one.
    if (sitting.has(person.id) && world.officials.get(officeId)?.personId !== person.id) continue
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
 * WHY THIS PERSON CANNOT STAND, or null when they can (spec §2b).
 *
 * The bar pattern once more: the screen greys the button from the same
 * answer the verb refuses with, and a would-be candidate is told what is
 * in the way rather than shown a dead control.
 */
export function candidacyBar(
  world: World,
  personId: EntityId,
  officeId: string,
  tick: Tick,
): string | null {
  const election = world.elections.get(officeId)
  if (election === undefined) return 'No seat is up for election right now.'
  if (tick >= election.decidesAtTick) return 'That race has already been decided.'
  if (election.runners.some((r) => r.personId === personId)) return 'You are already on this ballot.'
  const person = world.people.get(personId)
  const office = officeById(officeId)
  if (person === undefined || office === undefined) return 'No such race.'
  if (person.deathTick !== null) return 'Nobody is being played.'
  const age = ageAt(person.birthTick, tick)
  if (age < office.minAge) {
    return `You have to be ${String(office.minAge)} to stand for ${office.title}.`
  }
  if (office.needsPrior !== undefined && !eligibleFor(world, person, office, tick)) {
    const wants = office.needsPrior
      .map((id) => officeById(id)?.title ?? id)
      .join(' or ')
    return `${office.title} wants somebody who has served as ${wants} first.`
  }
  // A CONVICTION IS THE LOUDEST THING ON A BALLOT. It does not bar
  // anybody outright — that is the voters' business — but the town has to
  // be told, and standing for a trusted seat with a hard record does not
  // happen (C1, the same gate that closes trusted work).
  const criminal = world.criminal.get(personId)
  if (criminal !== undefined && criminal.jailedUntilTick !== null && tick < criminal.jailedUntilTick) {
    return 'Not from a cell.'
  }
  return null
}

/**
 * STAND FOR THE SEAT.
 *
 * A late entrant starts where an unknown starts: at the bottom of the
 * poll, with the undecideds still to win over. The campaign is what moves
 * that, which is the point of there being one.
 */
export function declareCandidacy(
  world: World,
  personId: EntityId,
  officeId: string,
  tick: Tick,
): boolean {
  if (candidacyBar(world, personId, officeId, tick) !== null) return false
  const election = world.elections.get(officeId)
  const person = world.people.get(personId)
  if (election === undefined || person === undefined) return false
  const partyId = PARTIES[Math.abs(personId) % PARTIES.length]?.id ?? 'commonwealth'
  // Their standing in the town, the same measure everybody else is drawn
  // against, but with none of the seeded head start a declared runner got
  // — nobody has heard of them yet.
  const showing = Math.max(40, Math.floor(standingOf(world, person, tick) / 6))
  world.elections.set(officeId, {
    ...election,
    warChest: (election.warChest ?? 0) as Money,
    runners: [...election.runners, { personId, partyId, polling: showing }],
  })
  recordEvent(world, tick, { type: 'stood-for-office', subjectId: personId, detail: officeId })
  return true
}

/** What a week of campaigning does. The mockup's three. */
export type CampaignAction = 'fundraise' | 'rally' | 'advertise'

/**
 * ONE WEEK OF A CAMPAIGN.
 *
 * Fundraising fills the chest, a rally moves the polls a little on its
 * own, and advertising converts money into reach — which is the only one
 * of the three that costs anything, and the reason the chest exists.
 *
 * Everything comes OUT OF THE UNDECIDED first. A campaign that took
 * points straight off an opponent would be a tug of war; a real one wins
 * over the people who have not made their minds up, and only starts
 * taking from the other side once those are gone.
 */
export function campaign(
  world: World,
  personId: EntityId,
  officeId: string,
  action: CampaignAction,
  tick: Tick,
): boolean {
  const election = world.elections.get(officeId)
  if (election === undefined || tick >= election.decidesAtTick) return false
  const mine = election.runners.find((r) => r.personId === personId)
  if (mine === undefined) return false

  const rng = openStream(world.seed, Stream.Politics, personId, tick + 4_400)
  let chest = (election.warChest ?? 0) as number
  let gain = 0
  if (action === 'fundraise') {
    chest += rng.nextIntInclusive(80_000, 260_000)
  } else if (action === 'rally') {
    gain = rng.nextIntInclusive(8, 26)
  } else {
    // Advertising is bought. No money, no reach — and the refusal is the
    // honest one rather than a free rally wearing another name.
    const spend = Math.min(chest, 150_000)
    if (spend < 40_000) return false
    chest -= spend
    gain = Math.floor(spend / 6_000)
  }

  const undecided = Math.max(
    0,
    1000 - election.runners.reduce((sum, r) => sum + r.polling, 0),
  )
  const fromUndecided = Math.min(gain, undecided)
  let owed = gain - fromUndecided
  const runners = election.runners.map((r) => {
    if (r.personId === personId) return { ...r, polling: r.polling + gain }
    if (owed <= 0) return r
    // Taken from the strongest opponent first, and never below a floor —
    // a campaign does not erase somebody, it overtakes them.
    const take = Math.min(owed, Math.max(0, r.polling - 40))
    owed -= take
    return { ...r, polling: r.polling - take }
  })

  world.elections.set(officeId, { ...election, warChest: chest as Money, runners })
  return true
}

/**
 * THE DEBATE (the mockup's own scene).
 *
 * Same three rails every moment in this game runs on — the reaching
 * answer, the measured one, the safe one — with its own words, because
 * nothing here is selected from a shared string. What differs is the
 * stake: this one moves a poll rather than a performance review, and it
 * is the only place in a campaign where a bad night costs you.
 */
export type DebateChoice = 'attack' | 'policy' | 'personal'

export const DEBATE_OPTIONS: readonly {
  readonly id: DebateChoice
  readonly title: string
  readonly tag: string
}[] = [
  { id: 'attack', title: 'Hit back on their record', tag: 'attack' },
  { id: 'policy', title: 'Pivot to what you would do', tag: 'policy' },
  { id: 'personal', title: 'Get personal and real', tag: 'a gamble' },
]

export const DEBATE_LINES: readonly string[] = [
  'They hit you on crime, live on local television. Six hundred people are watching and your answer sets tomorrow’s headline.',
  'The moderator asks about the tax rise, and your opponent is smiling before you have finished the sentence.',
  'Somebody in the audience asks what you have ever actually done for this town, and the room goes quiet.',
]

/**
 * How the night went, and what it moved.
 *
 * The reaching answer is the one that can fail, as everywhere else. An
 * attack lands hardest and rebounds hardest; a policy answer is nearly
 * always worth a little; getting personal is the gamble the tag says it
 * is — the biggest swing in either direction.
 */
export function debate(
  world: World,
  personId: EntityId,
  officeId: string,
  choice: DebateChoice,
  tick: Tick,
): { good: boolean; swing: number } {
  const election = world.elections.get(officeId)
  if (election === undefined) return { good: false, swing: 0 }
  const person = world.people.get(personId)
  const rng = openStream(world.seed, Stream.Politics, personId * 3 + 7, tick + 9_900)

  // A candidate who has done the reading is harder to catch out.
  const composure = Math.floor(
    ((person?.traits.resilience ?? 500) + (world.education.get(personId)?.attainment ?? 500)) / 2,
  )
  const odds =
    choice === 'attack' ? 420 + composure / 6 : choice === 'policy' ? 700 : 380 + composure / 4
  const good = rng.chance(Math.max(80, Math.min(940, Math.floor(odds))), 1000)
  const size =
    choice === 'policy' ? rng.nextIntInclusive(6, 18) : rng.nextIntInclusive(14, 42)
  const swing = good ? size : -size

  const undecided = Math.max(
    0,
    1000 - election.runners.reduce((sum, r) => sum + r.polling, 0),
  )
  let owed = swing > 0 ? Math.max(0, swing - undecided) : 0
  const runners = election.runners.map((r) => {
    if (r.personId === personId) return { ...r, polling: Math.max(20, r.polling + swing) }
    if (swing < 0) {
      // A bad night hands the room to somebody, and it is the leader.
      return r.personId === election.runners[0]?.personId ? { ...r, polling: r.polling - swing } : r
    }
    if (owed <= 0) return r
    const take = Math.min(owed, Math.max(0, r.polling - 40))
    owed -= take
    return { ...r, polling: r.polling - take }
  })
  world.elections.set(officeId, { ...election, runners })
  recordEvent(world, tick, {
    type: 'debated',
    subjectId: personId,
    detail: `${choice}:${good ? 'well' : 'badly'}`,
  })
  return { good, swing }
}

/** The player's own place on a ballot, for the screen. */
export function myCandidacy(
  world: World,
  personId: EntityId,
): { election: Election; polling: number } | undefined {
  for (const election of world.elections.values()) {
    const mine = election.runners.find((r) => r.personId === personId)
    if (mine !== undefined) return { election, polling: mine.polling }
  }
  return undefined
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
    // AN INCUMBENT RUNS ON THEIR RECORD. A mayor the town approves of
    // starts ahead; one it does not starts behind, which is what makes
    // the levers matter beyond the month they are pulled.
    const sitting = holder !== undefined && alive ? holder : undefined
    const withIncumbency =
      sitting === undefined
        ? runners
        : runners.map((r) =>
            r.personId === sitting.personId
              ? { ...r, polling: Math.max(20, r.polling + Math.trunc((sitting.approval - 500) / 4)) }
              : r,
          )
    // An EMPTY seat cannot wait three months for a campaign; a seat whose
    // term is merely ending can, and should.
    const urgent = holder === undefined || !alive
    world.elections.set(officeId, {
      officeId,
      opensAtTick: tick,
      decidesAtTick: (urgent ? tick + 1 : tick + CAMPAIGN_MONTHS) as Tick,
      runners: withIncumbency,
    })
  }
  applyPartyLean(world)
  driftApproval(world, tick)
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
