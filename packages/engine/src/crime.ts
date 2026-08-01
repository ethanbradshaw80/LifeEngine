/**
 * Crime and justice. C1 — the second Layer 4 institution (CRIME_PLAN.md).
 *
 * THE RULES THIS FILE KEEPS:
 *  - Single writer: nothing else touches world.criminal. Absence from the
 *    map IS the clean record.
 *  - Theft never touches household.savings directly — finances owns the pot
 *    (M-MONEY), so the money moves through its exported transfer helper.
 *  - Motive is circumstance first, character second (Law 10): the arrears
 *    ledger and joblessness make crime thinkable; personality only nudges.
 *    No trait makes a person criminal.
 *  - Records at decision time: the charge cites the theft, the verdict
 *    cites the charge. A descendant can read the whole chain.
 *  - Conviction is consequence, not game over (Law 7): time is served, the
 *    record follows into hiring and the recruiting office — and stops
 *    gating (never stops existing) after ten clean years.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { RECORD_GATE_YEARS } from './content.js'
import { isDeployed } from './deployment.js'
import { chargeHousehold, inArrears, transferBetweenHouseholds } from './finances.js'
import type { NewsItem } from './geopolitics.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import { discharge as dischargeService, isServing } from './service.js'
import { fullName } from './story.js'
import type { CriminalRecord, Person, World } from './types.js'

/** Sentences and gates. RECORD_GATE_YEARS lives in content.ts so
 *  service.ts, which cannot import this module, reads the same number. */
const FINE_MULTIPLIER = 2
const JAIL_MIN_MONTHS = 6
const JAIL_MAX_MONTHS = 18
export { RECORD_GATE_YEARS }

// ---------------------------------------------------------------------------
// Queries — the read side hiring, enlistment and the UI use
// ---------------------------------------------------------------------------

export function criminalRecordOf(world: World, personId: EntityId): CriminalRecord | undefined {
  return world.criminal.get(personId)
}

export function isJailed(world: World, personId: EntityId): boolean {
  const record = world.criminal.get(personId)
  return record !== undefined && record.jailedUntilTick !== null && world.tick < record.jailedUntilTick
}

/** A conviction recent enough that doors still close on it. */
export function hasRecentConviction(world: World, personId: EntityId): boolean {
  const record = world.criminal.get(personId)
  if (!record) return false
  return record.convictions.some((c) => world.tick - c.tick < RECORD_GATE_YEARS * 12)
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runCrime(world: World, tick: Tick): void {
  for (const person of livingSorted(world)) {
    const record = world.criminal.get(person.id)

    if (record !== undefined && record.jailedUntilTick !== null) {
      // Release first: a sentence ends the month it ends. Either way the
      // month belongs to the county, not to new trouble.
      if (tick >= record.jailedUntilTick) {
        world.criminal.set(person.id, { ...record, jailedUntilTick: null })
        recordEvent(world, tick, { type: 'released-from-jail', subjectId: person.id })
      }
      continue
    }

    // C1 keeps the played life a bystander or victim (CRIME_PLAN.md): the
    // desperation moment with both roads real is C2's pending. An off-screen
    // theft would be an unchosen crime on a chosen timeline.
    if (person.id === world.player.personId) continue

    // Not in town, not in the pool: a deployed soldier cannot rob a house
    // here from a theatre away — and without this gate the deployment
    // system would later close a tour the county jail had interrupted,
    // fabricating a homecoming (review M1).
    if (isDeployed(world, person.id)) continue

    const age = ageAt(person.birthTick, tick)
    if (age < 18 || age > 60) continue
    if (person.householdId === null) continue

    // MOTIVE, modelled: the ledger and the empty weeks. Personality only
    // nudges at the margin — circumstances make crime thinkable (Law 10).
    // isServing, not service.has: records survive discharge, and a jobless
    // veteran is jobless (review S1).
    const behind = inArrears(world, person.householdId)
    const jobless = !world.employment.has(person.id) && !isServing(world, person.id)
    let pressure = 0
    if (behind) pressure += 90
    if (jobless) pressure += 40
    if (behind && jobless) pressure += 30 // both at once is its own weather
    pressure += Math.floor((1000 - person.traits.diligence) / 50) // 0..20
    if (pressure < 100) continue

    const rng = openStream(world.seed, Stream.Crime, person.id, tick)
    if (!rng.chance(pressure, 12_000)) continue

    attemptTheft(world, tick, person, behind, jobless, rng)
  }
}

function attemptTheft(
  world: World,
  tick: Tick,
  person: Person,
  behind: boolean,
  jobless: boolean,
  rng: ReturnType<typeof openStream>,
): void {
  // A victim with something to take, deterministically chosen from the
  // households that have anything: nobody robs an emptier house than their
  // own. The victim is a HOUSEHOLD; the event lands on its eldest adult,
  // because a record needs a person to have happened to.
  const candidates = [...world.households.values()]
    .filter((h) => h.id !== person.householdId && h.dissolvedTick === null && h.savings > 20_000)
    .sort((a, b) => a.id - b.id)
  if (candidates.length === 0) return
  const victimHousehold = rng.pick(candidates)
  const members = victimHousehold.memberIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
  const victim = members[0]
  if (!victim || person.householdId === null) return

  const wanted = rng.nextIntInclusive(8_000, 40_000) // $80–$400
  const taken = transferBetweenHouseholds(world, tick, victimHousehold.id, person.householdId, wanted)
  if (taken <= 0) return

  recordEvent(world, tick, {
    type: 'committed-theft',
    subjectId: person.id,
    otherId: victim.id,
    detail: String(taken),
  })
  // The robbery happened to the HOUSE: every adult under that roof carries
  // the memory, not just the eldest — a played spouse or grown child must
  // not watch the savings drop with no visible cause (review S7).
  for (const member of members) {
    if (member.id !== victim.id && ageAt(member.birthTick, tick) < 18) continue
    recordEvent(world, tick, {
      type: 'was-robbed',
      subjectId: member.id,
      detail: String(taken),
    })
  }
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'crime',
    significance: 'major',
    inputs: [
      ...(behind ? [factor('in-arrears', 700)] : []),
      ...(jobless ? [factor('lost-work', 500)] : []),
      factor('desperation', Math.min(1000, (behind ? 500 : 200) + (jobless ? 300 : 0))),
    ],
    chosen: 'took what was not theirs',
    rejected: ['to go without'],
    streamId: Stream.Crime,
  })

  // Clearance: a small town sees a lot. Witnessed → arrested this month;
  // unwitnessed thefts stay on the thief's own timeline and nowhere else.
  if (!rng.chance(350, 1_000)) return
  recordEvent(world, tick, { type: 'was-arrested', subjectId: person.id })

  // The courthouse answers within the month. Priors weigh; a first offence
  // in hard circumstances is usually a fine.
  const priors = world.criminal.get(person.id)?.convictions.length ?? 0
  const convicted = rng.chance(Math.min(950, 700 + priors * 100), 1_000)
  if (!convicted) {
    recordEvent(world, tick, { type: 'was-acquitted', subjectId: person.id })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'justice',
      significance: 'major',
      inputs: [factor('witnessed', 400), ...(priors === 0 ? [factor('clean-record', 600)] : [])],
      chosen: 'acquitted at the courthouse',
      rejected: ['conviction'],
      streamId: Stream.Crime,
    })
    return
  }

  const jailTime = priors > 0 || taken > 25_000
  const sentenceMonths = jailTime ? rng.nextIntInclusive(JAIL_MIN_MONTHS, JAIL_MAX_MONTHS) : 0
  const fine = jailTime ? 0 : taken * FINE_MULTIPLIER

  const existing = world.criminal.get(person.id)
  world.criminal.set(person.id, {
    personId: person.id,
    convictions: [
      ...(existing?.convictions ?? []),
      { kind: 'theft', tick, sentenceMonths, fine },
    ],
    jailedUntilTick: jailTime ? ((tick + sentenceMonths) as Tick) : (existing?.jailedUntilTick ?? null),
  })

  recordEvent(world, tick, {
    type: 'was-convicted',
    subjectId: person.id,
    detail: jailTime ? `jail:${String(sentenceMonths)}` : `fine:${String(fine)}`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'justice',
    significance: 'defining',
    inputs: [
      factor('witnessed', 700),
      ...(priors > 0 ? [factor('prior-record', Math.min(1000, priors * 400))] : [factor('clean-record', 300)]),
    ],
    chosen: jailTime
      ? `convicted of theft; ${String(sentenceMonths)} months`
      : 'convicted of theft; fined',
    rejected: ['acquittal'],
    streamId: Stream.Crime,
  })

  if (jailTime) {
    // Jail is absence: the job is lost, the wage stops, and a uniform is
    // taken back — the service does not keep a convicted thief.
    if (world.employment.has(person.id)) {
      world.employment.delete(person.id)
      recordEvent(world, tick, { type: 'left-job', subjectId: person.id, detail: 'jailed' })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'employment-change',
        significance: 'notable',
        inputs: [factor('jail-sentence', 900)],
        chosen: 'the job did not wait out the sentence',
        rejected: [],
        streamId: Stream.Crime,
      })
    }
    const service = world.service.get(person.id)
    if (service !== undefined && service.dischargedAtTick === null) {
      dischargeService(world, tick, person, service, 'misconduct', [factor('jail-sentence', 900)], Stream.Crime)
    }
  } else if (person.householdId !== null) {
    chargeHousehold(world, tick, person.householdId, fine)
  }
}

/**
 * The town's crime news — read-side, the same shape the world news uses so
 * the UI can merge two papers into one column. Only what the town would
 * actually know: a robbery is public the day it happens; a thief's name
 * becomes public only at the courthouse. An unconvicted thief's name never
 * makes the paper — that asymmetry is the point.
 */
export function crimeNewsSince(world: World, sinceTick: Tick): NewsItem[] {
  const items: NewsItem[] = []
  for (const event of world.events) {
    if (event.tick < sinceTick) continue
    if (event.type === 'committed-theft') {
      // One item per theft, named for the VICTIM (the otherId): 'was-robbed'
      // now lands on every adult in the house, which would duplicate the
      // headline, and the thief's own event never prints the thief's name.
      const victim = event.otherId !== null ? world.people.get(event.otherId) : undefined
      if (victim) items.push({ tick: event.tick, text: `the ${victim.familyName} house was robbed`, nearby: false })
    } else if (event.type === 'was-convicted') {
      const person = world.people.get(event.subjectId)
      if (!person) continue
      const sentence =
        event.detail?.startsWith('jail:') === true ? `${event.detail.slice(5)} months` : 'fined'
      items.push({
        tick: event.tick,
        text: `${fullName(person)} was convicted of theft at the courthouse — ${sentence}`,
        nearby: false,
      })
    }
  }
  return items
}

function livingSorted(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((a, b) => a.id - b.id)
  return living
}
