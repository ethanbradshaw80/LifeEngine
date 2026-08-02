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
import { GRADE_TITLES, isFelony, offenceById, RECORD_GATE_YEARS } from './content.js'
import type { Offence } from './content.js'
import { raisePending } from './player.js'
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

    // C2, THE DESPERATION MOMENT. C1 kept the played life a bystander,
    // because an off-screen theft would be an unchosen crime on a chosen
    // timeline. The moment the simulation already rolled is now the
    // player's to answer — and BOTH roads are real: walking away is a
    // choice the record keeps, not a non-event.
    if (person.id === world.player.personId) {
      raisePending(world, {
        tick,
        kind: 'desperation',
        personId: person.id,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: null,
        options: ['take-it', 'go-without'],
      })
      continue
    }

    attemptTheft(world, tick, person, behind, jobless, rng)
  }
}

/**
 * C2 (owner direction). What the courthouse just did, read back off the
 * record so the verdict can be shown as its own moment rather than a line
 * that scrolls past in the feed.
 *
 * Reads the events of ONE tick — the month the court sat — so it answers
 * for the case just heard and nothing earlier. Null when this person had
 * no day in court that month.
 */
export interface CourtOutcome {
  readonly tick: Tick
  /** The charge, in words. */
  readonly charge: string
  readonly grade: string | null
  readonly convicted: boolean
  /** Months of custody; 0 when the answer was money or nothing. */
  readonly sentenceMonths: number
  /** The fine in cents; 0 when it was time or nothing. */
  readonly fine: number
  /** Convictions on the file BEFORE this one. */
  readonly priors: number
  /** Released in this month, if custody was ordered. */
  readonly releasedAtTick: Tick | null
}

export function courtOutcomeOf(world: World, personId: EntityId, tick: Tick): CourtOutcome | null {
  let arrested = false
  let convicted: boolean | null = null
  let detail: string | null = null
  for (const event of world.events) {
    if (event.tick !== tick || event.subjectId !== personId) continue
    if (event.type === 'was-arrested') {
      arrested = true
      detail = event.detail
    }
    if (event.type === 'was-convicted') convicted = true
    if (event.type === 'was-acquitted') convicted = false
  }
  if (!arrested || convicted === null) return null

  const record = world.criminal.get(personId)
  const conviction = convicted
    ? [...(record?.convictions ?? [])].reverse().find((c) => c.tick === tick)
    : undefined
  const offence = conviction === undefined ? undefined : offenceById(conviction.kind)
  const priors = (record?.convictions ?? []).filter((c) => c.tick < tick).length

  return {
    tick,
    charge: offence?.title ?? detail ?? 'theft',
    grade: offence === undefined ? null : GRADE_TITLES[offence.grade],
    convicted,
    sentenceMonths: conviction?.sentenceMonths ?? 0,
    fine: conviction?.fine ?? 0,
    priors,
    releasedAtTick:
      conviction !== undefined && conviction.sentenceMonths > 0
        ? ((tick + conviction.sentenceMonths) as Tick)
        : null,
  }
}

/**
 * C2 (owner direction). Why a given offence is closed to this person right
 * now, or null when the door is open. The Crime tab shows the reason
 * instead of a dead button — the applyForJob pattern, applied to the worst
 * decision in the game.
 */
export function offenceBar(world: World, personId: EntityId, offenceId: string): string | null {
  const person = world.people.get(personId)
  if (!person || person.deathTick !== null) return 'Nobody is being played.'
  const offence = offenceById(offenceId)
  if (!offence) return 'No such charge in the code.'
  if (ageAt(person.birthTick, world.tick) < 18) return 'Not yet eighteen.'
  if (isJailed(world, personId)) return 'From a cell, there is nothing to take.'
  if (isDeployed(world, personId)) return 'Not from a theatre away.'
  if (offence.needsJob && !world.employment.has(personId)) {
    return 'This one needs a job to abuse.'
  }
  if (offence.takesFromHousehold && person.householdId === null) {
    return 'You would need a roof of your own to bring it back to.'
  }
  return null
}

/**
 * C2. Do it — the Crime tab's verb. Log before the roll, the same honest
 * shape every other player verb uses: the asking is on the record whatever
 * the answer turns out to be.
 *
 * Getting away with it is not a reward and getting caught is not a
 * punishment: both are the clearance rate the offence carries, and the
 * courthouse decides the rest. The player is never told the odds.
 */
export function commitOffence(
  world: World,
  tick: Tick,
  person: Person,
  offenceId: string,
): { done: boolean; reason: string } {
  const bar = offenceBar(world, person.id, offenceId)
  if (bar !== null) return { done: false, reason: bar }
  const offence = offenceById(offenceId)
  if (!offence) return { done: false, reason: 'No such charge in the code.' }

  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 5252)

  // What it puts in a pocket. Where a household is robbed the money MOVES
  // — finances owns the transfer, and a victim who loses nothing is a
  // crime that did not happen.
  let taken = 0
  if (offence.gainMax > 0) {
    const wanted = rng.nextIntInclusive(offence.gainMin, offence.gainMax)
    if (offence.takesFromHousehold && person.householdId !== null) {
      const candidates = [...world.households.values()]
        .filter((h) => h.id !== person.householdId && h.dissolvedTick === null && h.savings > 20_000)
        .sort((a, b) => a.id - b.id)
      if (candidates.length === 0) return { done: false, reason: 'No house in town worth the risk.' }
      const victimHousehold = rng.pick(candidates)
      taken = transferBetweenHouseholds(world, tick, victimHousehold.id, person.householdId, wanted)
      const members = victimHousehold.memberIds
        .map((id) => world.people.get(id))
        .filter((p): p is Person => p !== undefined && p.deathTick === null)
        .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
      for (const member of members) {
        if (ageAt(member.birthTick, tick) < 18) continue
        recordEvent(world, tick, { type: 'was-robbed', subjectId: member.id, detail: String(taken) })
      }
    } else if (person.householdId !== null) {
      // Money from outside the town's households — a shop, a stranger, the
      // revenue. It still lands in a real ledger.
      taken = -chargeHousehold(world, tick, person.householdId, -wanted)
    }
  }

  recordEvent(world, tick, {
    type: 'committed-theft',
    subjectId: person.id,
    detail: `${offence.id}:${String(taken)}`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'crime',
    significance: isFelony(offence.grade) ? 'defining' : 'major',
    inputs: [
      factor('own-choice', 1000),
      ...(person.householdId !== null && inArrears(world, person.householdId)
        ? [factor('in-arrears', 700)]
        : []),
      ...(!world.employment.has(person.id) && !isServing(world, person.id)
        ? [factor('lost-work', 500)]
        : []),
    ],
    chosen: `committed ${offence.title}`,
    rejected: ['to leave it alone'],
    streamId: Stream.Crime,
  })

  // Cleared, or not. An uncleared offence stays on the offender's own
  // timeline and nowhere else — which is exactly how getting away with it
  // works, and why the record is the only witness.
  if (!rng.chance(offence.clearance, 1_000)) {
    return { done: true, reason: '' }
  }
  recordEvent(world, tick, { type: 'was-arrested', subjectId: person.id, detail: offence.title })

  const landed = raisePending(world, {
    tick,
    kind: 'plea',
    personId: person.id,
    otherId: null,
    occupationId: offence.id,
    workplaceId: null,
    monthlyPay: taken as never,
    placeId: null,
    options: ['plead-guilty', 'stand-trial'],
  })
  if (!landed) resolveCourt(world, tick, person, taken, rng, null, offence)
  return { done: true, reason: '' }
}

/**
 * C2. The player answered the desperation moment. Taking it runs the SAME
 * theft the automatic path would have run — same victim selection, same
 * clearance, same courthouse — with 'own-choice' on the record. Going
 * without is recorded too: a life that stayed honest while it was hard
 * should be able to say so.
 */
export function answerDesperation(world: World, tick: Tick, person: Person, take: boolean): void {
  if (person.householdId === null) return
  const behind = inArrears(world, person.householdId)
  const jobless = !world.employment.has(person.id) && !isServing(world, person.id)

  if (!take) {
    recordEvent(world, tick, { type: 'went-without', subjectId: person.id })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'crime',
      significance: 'notable',
      inputs: [
        factor('own-choice', 1000),
        ...(behind ? [factor('in-arrears', 700)] : []),
        ...(jobless ? [factor('lost-work', 500)] : []),
      ],
      chosen: 'went without',
      rejected: ['to take what was not theirs'],
      streamId: Stream.Crime,
    })
    return
  }

  // A fresh salt: the month's own draw was spent deciding whether the
  // moment arrived at all.
  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 4141)
  attemptTheft(world, tick, person, behind, jobless, rng, true)
}

function attemptTheft(
  world: World,
  tick: Tick,
  person: Person,
  behind: boolean,
  jobless: boolean,
  rng: ReturnType<typeof openStream>,
  ownChoice = false,
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
      ...(ownChoice ? [factor('own-choice', 1000)] : []),
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

  // C2: the player is not sentenced off-screen. The courthouse waits for a
  // plea — the one moment in the chain where the accused genuinely decides
  // something — and resolveCourt runs from the answer instead.
  if (person.id === world.player.personId) {
    const landed = raisePending(world, {
      tick,
      kind: 'plea',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: taken as never,
      placeId: null,
      options: ['plead-guilty', 'stand-trial'],
    })
    // If another question held the slot, the court still sits: nobody
    // escapes a docket because the month was busy.
    if (landed) return
  }

  resolveCourt(world, tick, person, taken, rng, null)
}

/**
 * The courthouse. Shared by the automatic path and the player's plea, so a
 * verdict is reached the same way whoever is standing there.
 *
 * `plea` is null for everyone the town tries without asking. Pleading
 * guilty trades the chance of acquittal for a lighter hand — the oldest
 * bargain there is, and an honest one to model: certainty of conviction,
 * but a fine where a trial would have meant months.
 */
export function resolveCourt(
  world: World,
  tick: Tick,
  person: Person,
  taken: number,
  rng: ReturnType<typeof openStream>,
  plea: 'plead-guilty' | 'stand-trial' | null,
  offence: Offence | null = null,
): void {
  const priors = world.criminal.get(person.id)?.convictions.length ?? 0
  // A plea of guilty is certain conviction. It is also the only thing in
  // this model that reliably buys a lighter hand, which is the bargain
  // the real thing runs on.
  const convicted =
    plea === 'plead-guilty' ? true : rng.chance(Math.min(950, 700 + priors * 100), 1_000)
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

  let sentenceMonths: number
  let fine: number
  if (offence === null) {
    // The desperation theft C1 modelled, with C1's own numbers — measured
    // and tuned, and not worth perturbing to share a table.
    const jailTime = priors > 0 || taken > 25_000
    sentenceMonths = jailTime ? rng.nextIntInclusive(JAIL_MIN_MONTHS, JAIL_MAX_MONTHS) : 0
    fine = jailTime ? 0 : taken * FINE_MULTIPLIER
  } else {
    // The catalogue's own grade. The range is the statute; where in it the
    // sentence lands is the record — priors push it up, a guilty plea keeps
    // it in the lower half.
    const span = Math.max(0, offence.maxMonths - offence.minMonths)
    const roll =
      plea === 'plead-guilty'
        ? rng.nextIntInclusive(0, Math.floor(span / 2))
        : rng.nextIntInclusive(0, span)
    const priorWeight = Math.min(span, priors * Math.floor(span / 4))
    const months = offence.minMonths + Math.min(span, roll + priorWeight)
    // A fine instead of custody, where the offence allows one at all and
    // the file is clean enough to earn it. Felonies here carry no fine.
    const finable = offence.fine > 0 && priors === 0 && months <= 6
    sentenceMonths = finable ? 0 : months
    fine = finable ? offence.fine : 0
  }

  const existing = world.criminal.get(person.id)
  world.criminal.set(person.id, {
    personId: person.id,
    convictions: [
      ...(existing?.convictions ?? []),
      { kind: offence?.id ?? 'theft', tick, sentenceMonths, fine },
    ],
    jailedUntilTick:
      sentenceMonths > 0
        ? ((tick + sentenceMonths) as Tick)
        : (existing?.jailedUntilTick ?? null),
  })
  const jailTime = sentenceMonths > 0

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
      ? `convicted of ${offence?.title ?? 'theft'}; ${String(sentenceMonths)} months`
      : `convicted of ${offence?.title ?? 'theft'}; fined`,
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
