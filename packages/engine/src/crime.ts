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
import { logVerb, raisePending } from './player.js'
import { isDeployed } from './deployment.js'
import {
  chargeHousehold,
  creditHousehold,
  inArrears,
  transferBetweenHouseholds,
} from './finances.js'
import type { NewsItem } from './geopolitics.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import { discharge as dischargeService, isServing } from './service.js'
import { fullName } from './story.js'
import type { CriminalRecord, Person, World, Conviction, GateStrength, Disposition } from './types.js'

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
/**
 * C3 §5. How hard ONE conviction still gates, given how long ago it was
 * and what it was for.
 *
 * The windows widen with the grade, because that is the honest difference
 * between a night in the cells and an armed robbery — and the two ends of
 * the catalogue stay where they belong:
 *
 *  - a sealed conviction gates NOTHING, at any age (Decision 2)
 *  - a violent felony, or anything capital, stays hard for life: there is
 *    no year at which "he killed somebody" stops being relevant to whether
 *    the army takes him
 *  - everything else walks down the ladder and eventually stops mattering
 */
export function gateStrengthOf(conviction: Conviction, tick: Tick): GateStrength {
  if (conviction.sealed === true) return 'none'
  const offence = offenceById(conviction.kind)
  const years = Math.floor((tick - conviction.tick) / 12)

  // The permanent end. Violence and killing do not fade.
  if (offence !== undefined && (offence.grade === 'capital' || (offence.violent === true && isFelony(offence.grade)))) {
    return 'hard'
  }

  const felony = offence !== undefined && isFelony(offence.grade)
  const hardYears = felony ? 10 : 3
  const softYears = felony ? 25 : 8
  if (years < hardYears) return 'hard'
  if (years < softYears) return 'soft'
  return 'none'
}

/**
 * The hardest gate anybody's record still carries. This is what a door
 * asks: not "how many convictions" but "how much is still held against
 * them".
 */
export function recordGateOf(world: World, personId: EntityId, tick: Tick): GateStrength {
  const record = world.criminal.get(personId)
  if (!record) return 'none'
  let worst: GateStrength = 'none'
  for (const conviction of record.convictions) {
    const strength = gateStrengthOf(conviction, tick)
    if (strength === 'hard') return 'hard'
    if (strength === 'soft') worst = 'soft'
  }
  return worst
}

export function hasRecentConviction(world: World, personId: EntityId): boolean {
  // KEPT, AND NARROWED TO WHAT IT MEANT. Callers that ask this are asking
  // "is a door barred", and that is now the hard grade specifically — a
  // soft gate is a penalty those callers apply themselves (C3 §5).
  return recordGateOf(world, personId, world.tick) === 'hard'
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

/**
 * What everybody carries.
 *
 * CRIME USED TO REQUIRE DESPERATION. The gate wanted 100 and only arrears
 * could approach it, so a solvent, employed town never committed anything
 * at all — fifty years and a hundred and forty people produced one to three
 * thefts and no other offence of any kind, and the courthouse the project
 * built had almost nothing to hear.
 *
 * That was never the claim C1 set out to make. Law 10 asks for believable
 * over balanced, and a town where only the destitute break the law is not
 * believable: people drive drunk, swing at each other outside a bar, and
 * take things they could have paid for. Desperation is still the loudest
 * road by far — arrears alone is nine times this — but it is no longer the
 * only one.
 */
const BASELINE_PRESSURE = 26

/**
 * C3 §2. On probation right now.
 *
 * Probation is NOT custody and the difference is the whole point of the
 * rung: the job survives, the household survives, the person is still in
 * their own life. What it costs is freedom of movement and a second
 * chance — a new offence while it runs imposes the term that was hanging
 * over them.
 */
export function isOnProbation(world: World, personId: EntityId): boolean {
  const record = world.criminal.get(personId)
  const until = record?.probationUntilTick ?? null
  return until !== null && world.tick < until
}

/** Months still hanging over somebody, imposed if probation is revoked. */
export function suspendedTermOf(world: World, personId: EntityId): number {
  return world.criminal.get(personId)?.suspendedMonths ?? 0
}

/**
 * C3 §2. Probation is revoked and the suspended term is imposed.
 *
 * Shared by the NPC path and the player's, because a revocation is a
 * revocation: the same cell, the same record, the same absence from a job
 * and a household.
 */
export function revokeProbation(world: World, tick: Tick, person: Person, why: string): void {
  const record = world.criminal.get(person.id)
  if (!record) return
  const months = Math.max(1, record.suspendedMonths ?? 1)

  world.criminal.set(person.id, {
    ...record,
    jailedUntilTick: (tick + months) as Tick,
    probationUntilTick: null,
    suspendedMonths: 0,
  })
  recordEvent(world, tick, {
    type: 'violated-probation',
    subjectId: person.id,
    detail: `${why}:${String(months)}`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'crime',
    significance: 'major',
    inputs: [factor('own-choice', 700), factor('prior-record', 900)],
    chosen: `had probation revoked and went in for ${String(months)} months`,
    rejected: ['to keep the terms'],
    streamId: Stream.Crime,
  })
  // Jail is absence, and the job goes the same way it goes for a sentence
  // handed down in the first place.
  world.employment.delete(person.id)
}

/**
 * C3 §2. One month of supervision, for everybody serving it.
 *
 * Nothing here is a draw against character — the violation that matters is
 * a NEW OFFENCE, which the crime pass above already models, and this is
 * where it lands. What is drawn is the small remainder: missed obligations,
 * a failed check-in, the ordinary friction of being supervised.
 */
function runProbation(world: World, tick: Tick): void {
  for (const person of livingSorted(world)) {
    const record = world.criminal.get(person.id)
    const until = record?.probationUntilTick ?? null
    if (!record || until === null) continue
    if (record.jailedUntilTick !== null) continue // already inside

    if (tick >= until) {
      world.criminal.set(person.id, {
        ...record,
        probationUntilTick: null,
        suspendedMonths: 0,
      })
      recordEvent(world, tick, { type: 'completed-probation', subjectId: person.id })
      continue
    }

    // A missed obligation. Rare, and it does not by itself send anybody
    // back — the court's patience is what the second chance is made of.
    const rng = openStream(world.seed, Stream.Crime, person.id, tick + 4141)
    if (!rng.chance(12, 1_000)) continue
    if (rng.chance(1, 3)) {
      revokeProbation(world, tick, person, 'missed the terms')
    } else {
      recordEvent(world, tick, {
        type: 'community-service',
        subjectId: person.id,
        detail: 'a warning from the court',
      })
    }
  }
}

/**
 * C3 §4. What the town is like to live in this year, 0-1000.
 *
 * Crime was a per-person roll against a per-person circumstance, which made
 * it invisible: nothing about the town itself pushed or pulled. This is the
 * weather — read from conditions the world already tracks, so it cannot
 * drift from the town it describes:
 *
 *  - how many households are behind on the rent
 *  - how many working-age adults have no work
 *  - and how many constables the town employs, which pulls the other way
 *
 * It is not a scalar danger dial on a country (the permanent rule's
 * cousin): it is computed from the town's own measured conditions, every
 * one of which the player can see elsewhere in the game.
 */
export function crimePressureOf(world: World): number {
  let households = 0
  let behind = 0
  for (const household of world.households.values()) {
    if (household.dissolvedTick !== null || household.memberIds.length === 0) continue
    households += 1
    if (inArrears(world, household.id)) behind += 1
  }

  let adults = 0
  let jobless = 0
  let constables = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 65) continue
    adults += 1
    const job = world.employment.get(person.id)
    if (job === undefined && !isServing(world, person.id)) jobless += 1
    else if (job !== undefined && job.occupationId === 'constable') constables += 1
  }

  if (households === 0 || adults === 0) return 0
  // MEASURED BEFORE SCALING, because the first version read a flat zero on
  // every town and that was nearly honest: these towns run 0-78 households
  // per thousand behind on the rent and 0-22 adults per thousand out of
  // work. Halving numbers that small produced nothing anybody could read.
  // Scaled to the range the world actually produces, a settled town sits
  // near 80 and a struggling one near 300.
  const arrearsShare = Math.floor((behind * 1000) / households)
  const joblessShare = Math.floor((jobless * 1000) / adults)
  const hardship = arrearsShare * 4 + joblessShare * 6

  // AND POLICING SCALES IT RATHER THAN SUBTRACTING. Subtraction let one
  // constable in a small town wipe the whole index to zero — a cliff, and
  // the same shape of mistake the flat conviction gate was. A town with
  // somebody watching has less of this weather; it does not have none.
  const policing = Math.min(500, Math.floor((constables * 12_000) / adults))
  return Math.max(0, Math.min(1000, Math.floor((hardship * (1000 - policing)) / 1000)))
}

/**
 * C3 §3. How much the town's own law enforcement improves the odds that a
 * crime is cleared, per 1000 added to the offence's own rate.
 *
 * A town with nobody looking is a town where things are not solved.
 */
export function clearanceBonusOf(world: World): number {
  let adults = 0
  let constables = 0
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 65) continue
    adults += 1
    if (world.employment.get(person.id)?.occupationId === 'constable') constables += 1
  }
  if (adults === 0) return 0
  return Math.min(200, Math.floor((constables * 200 * 200) / adults / 10))
}

export function runCrime(world: World, tick: Tick): void {
  runProbation(world, tick)

  // Read once for the month, not once per person: it is a fact about the
  // town, and computing it sixty times would say the same thing sixty times.
  const townPressure = crimePressureOf(world)

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
    // C3 §4. THE TOWN LEANS ON THE PERSON. The same Law-10 circumstance
    // logic the individual terms use, lifted to the town: a place where a
    // third of the households are behind makes crime thinkable for more
    // people than a place where nobody is.
    let pressure = BASELINE_PRESSURE + Math.floor(townPressure / 20)
    if (behind) pressure += 90
    if (jobless) pressure += 40
    if (behind && jobless) pressure += 30 // both at once is its own weather
    pressure += Math.floor((1000 - person.traits.diligence) / 50) // 0..20
    // Resilience is what carries somebody through a bad month without doing
    // something stupid in it.
    pressure += Math.floor((1000 - person.traits.resilience) / 100) // 0..10
    if (pressure < BASELINE_PRESSURE) continue

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

    const offence = offenceForCircumstance(behind, jobless, rng)
    if (offence === null) attemptTheft(world, tick, person, behind, jobless, rng)
    else carryOutOffence(world, tick, person, offence, rng)
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

  // A CRIME IS A PLAYER INPUT, and every other verb in the game treats one
  // the same way: refuse while a question waits, one a month, and log
  // before the roll so seed + log still replays the life exactly. Without
  // these the tab was a button you could hold down — the stream is keyed
  // on the month, so a miss missed identically every time while the money
  // moved on every press (review must-fix 3).
  if (world.player.pending !== null) {
    return { done: false, reason: 'A decision is already waiting.' }
  }
  if (world.player.log.some((entry) => entry.kind === 'offence' && entry.tick === tick)) {
    return { done: false, reason: 'Once in a month. The town is small and it notices.' }
  }
  logVerb(world, 'offence', offenceId)

  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 5252)

  // What it puts in a pocket. Where a household is robbed the money MOVES
  // — finances owns the transfer, and a victim who loses nothing is a
  // crime that did not happen.
  let taken = 0
  let victim: Person | undefined
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
      victim = members[0]
      for (const member of members) {
        // Adults carry the memory; but a house of only children still
        // lost the money, so its eldest carries it rather than the
        // savings dropping with no recorded cause (review S7).
        if (member.id !== victim?.id && ageAt(member.birthTick, tick) < 18) continue
        recordEvent(world, tick, { type: 'was-robbed', subjectId: member.id, detail: String(taken) })
      }
    } else if (person.householdId !== null) {
      // Money from outside the town's households — a till, a forged
      // cheque, tax not paid. It still lands in a real ledger, through
      // finances' own crediting door.
      taken = creditHousehold(world, tick, person.householdId, wanted)
    }
  }

  recordEvent(world, tick, {
    type: 'committed-theft',
    subjectId: person.id,
    // otherId is the victim, and crimeNewsSince keys the town's headline
    // off it — without it a player's burglary robbed a real household,
    // wrote was-robbed on its adults, and never reached the paper, while
    // every NPC's did (review S7).
    ...(victim !== undefined ? { otherId: victim.id } : {}),
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
      // 'major', like the take-it road: records.ts discards `rejected`
      // below major, and the honest choice was losing the alternative it
      // turned down while the crime kept its own (review S6). Both roads
      // are meant to be equally real.
      significance: 'major',
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

/**
 * What somebody in these circumstances actually does, or null for the plain
 * theft the town has always had.
 *
 * NOT A CRIME SPREE GENERATOR. The weights say what a small town's docket
 * looks like: mostly drink, mostly noise, mostly stupid rather than wicked.
 * Desperation still points at property; the rest is the ordinary trouble
 * people make when they are bored, drunk or angry, and the felonies are
 * rare on purpose because the courthouse should not be hearing an armed
 * robbery every other year.
 */
function offenceForCircumstance(
  behind: boolean,
  jobless: boolean,
  rng: ReturnType<typeof openStream>,
): Offence | null {
  // Desperation goes for what pays. Half the time it is the plain theft
  // the town already modelled, which keeps its own victim selection.
  if (behind || jobless) {
    if (rng.chance(1, 2)) return null
    return offenceById(rng.pick(['shoplifting', 'bad-check', 'petty-fraud', 'trespassing'])) ?? null
  }
  // Everybody else: the drink, the temper, the car.
  //
  // C3 §16 ASKS FOR THE WHOLE CATALOGUE, WEIGHTED LIKE A REAL DOCKET —
  // misdemeanors common, felonies rarer, violence rarest. The weights below
  // are that shape, not the catalogue's own proportions: 59 charges of
  // which 37 are felonies would be a fantasy of crime if drawn evenly. The
  // bottom eight here carry three quarters of it between them, and the
  // homicides are single digits against a hundred and sixty.
  const id = rng.pickWeighted(
    [
      // The ordinary town, most of the time.
      'public-intoxication',
      'disorderly-conduct',
      'disturbing-peace',
      'dui',
      'reckless-driving',
      'simple-assault',
      'battery',
      'vandalism',
      'trespassing',
      'shoplifting',
      'loitering',
      'suspended-license',
      'drug-possession',
      'resisting-arrest',
      'concealed-weapon',
      'hit-and-run-property',
      // Rarer, and it starts to cost a career.
      'obstruction',
      'evading-police',
      'brandishing',
      'possession-with-intent',
      'receiving-stolen',
      'credit-card-fraud',
      'unlawful-firearm',
      'unlawful-discharge',
      'hit-and-run-injury',
      // Rarer again.
      'commercial-burglary',
      'insurance-fraud',
      'domestic-violence',
      'vehicular-assault',
      'extortion',
      // The serious end. A town of this size sees one of these in a
      // generation, which is why the weights are what they are.
      'assault-deadly-weapon',
      'drug-trafficking',
      'armed-robbery',
      'vehicular-manslaughter',
      'involuntary-manslaughter',
      'kidnapping',
      'murder-second',
    ],
    [
      160, 140, 110, 105, 95, 80, 70, 70, 60, 55, 50, 45, 40, 30, 25, 22,
      14, 12, 12, 10, 10, 8, 8, 6, 6,
      5, 5, 5, 4, 3,
      3, 2, 2, 2, 2, 1, 1,
    ],
  )
  return offenceById(id) ?? null
}

/**
 * An offence, carried out and answered for. Shared by the NPC road and the
 * player's own verb so both walk the same courthouse — the money moves the
 * same way, the clearance is the same roll, and the record reads the same.
 */
function carryOutOffence(
  world: World,
  tick: Tick,
  person: Person,
  offence: Offence,
  rng: ReturnType<typeof openStream>,
): void {
  let taken = 0
  if (offence.gainMax > 0 && person.householdId !== null) {
    const wanted = rng.nextIntInclusive(offence.gainMin, offence.gainMax)
    taken = creditHousehold(world, tick, person.householdId, wanted)
  }

  recordEvent(world, tick, {
    type: 'committed-offence',
    subjectId: person.id,
    detail: `${offence.id}:${String(taken)}`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'crime',
    significance: isFelony(offence.grade) ? 'defining' : 'notable',
    inputs: [
      factor('own-choice', 600),
      ...(person.householdId !== null && inArrears(world, person.householdId)
        ? [factor('in-arrears', 700)]
        : []),
    ],
    chosen: `committed ${offence.title}`,
    rejected: ['to leave it alone'],
    streamId: Stream.Crime,
  })

  // Cleared, or not — the same door the player's own offence goes through.
  // C3 §3. The town's own constables improve the odds it is solved.
  if (!rng.chance(Math.min(1000, offence.clearance + clearanceBonusOf(world)), 1_000)) return
  recordEvent(world, tick, { type: 'was-arrested', subjectId: person.id, detail: offence.title })

  // C3 §2. OFFENDING ON PROBATION IS THE VIOLATION THAT MATTERS. The term
  // hanging over them lands first, and then the new charge is answered for
  // on its own — which is how somebody on a suspended sentence ends up
  // serving both.
  if (isOnProbation(world, person.id)) {
    revokeProbation(world, tick, person, offence.id)
  }
  resolveCourt(world, tick, person, taken, rng, null, offence)
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
/**
 * C3 §1 + §12. Which rung of the ladder this case lands on.
 *
 * Grade sets the range, priors and the plea move within it. The shape the
 * doc asks for, and the shape a real docket has:
 *
 *  - the bottom of the catalogue mostly ends in diversion or money
 *  - the middle is where probation lives, and it is the most useful rung
 *    in the game because it leaves somebody in their life while still
 *    costing them something
 *  - the serious end is custody, and the top of it is custody only: no
 *    probation for a class A felony, none at all for a capital offence
 *
 * A clean file buys a rung down; priors buy rungs up. Deterministic given
 * the same stream, like everything else the court does.
 */
function dispositionFor(
  offence: Offence | null,
  priors: number,
  pleadedGuilty: boolean,
  rng: ReturnType<typeof openStream>,
): Disposition {
  const grade = offence?.grade ?? 'class-a-misdemeanor'
  const clean = priors === 0
  const lenient = clean && pleadedGuilty

  // C3 §12's table, grade by grade, rather than one score for everything —
  // a score let a burglary end in community service, which is not a thing
  // that happens to a class B felon on any docket anywhere.
  switch (grade) {
    case 'capital':
      // No probation, ever.
      return 'jail'
    case 'class-a-felony':
      // No probation. A clean plea can buy a split sentence and nothing more.
      return lenient && rng.chance(1, 4) ? 'split' : 'jail'
    case 'class-b-felony':
      // Custody, with a split for the cleanest files.
      return clean && rng.chance(1, 3) ? 'split' : 'jail'
    case 'class-c-felony':
      // Probation on a clean first offence, else custody.
      if (clean && rng.chance(1, 2)) return pleadedGuilty ? 'probation' : 'split'
      return priors >= 2 ? 'jail' : rng.chance(1, 3) ? 'split' : 'jail'
    case 'class-d-felony':
    case 'class-e-felony':
      if (clean) return pleadedGuilty ? 'probation' : rng.chance(1, 2) ? 'probation' : 'split'
      if (priors === 1) return rng.chance(1, 2) ? 'split' : 'jail'
      return 'jail'
    case 'class-a-misdemeanor':
      if (clean) return rng.chance(1, 2) ? 'service' : 'probation'
      if (priors === 1) return rng.chance(1, 2) ? 'probation' : 'suspended'
      return rng.chance(1, 2) ? 'split' : 'jail'
    case 'class-b-misdemeanor':
      if (clean) return rng.chance(1, 3) ? 'dismissed' : 'fine'
      if (priors === 1) return rng.chance(1, 2) ? 'fine' : 'service'
      return rng.chance(1, 2) ? 'service' : 'probation'
    default:
      // Class C misdemeanor: the bottom of the catalogue.
      if (clean) return rng.chance(1, 2) ? 'dismissed' : 'fine'
      return priors >= 3 ? 'service' : 'fine'
  }
}

/** How long somebody stays on probation for a term of this size. */
function probationMonthsFor(sentenceMonths: number): number {
  return Math.max(6, Math.min(60, sentenceMonths * 2))
}

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
    //
    // A GUILTY PLEA HAS TO BUY SOMETHING HERE TOO (review S4): it used to
    // be ignored on this path, which made it a certain conviction for
    // nothing while the stakes screen promised a lighter hand. It halves
    // the term, and a first offence that would have meant months can end
    // in a fine instead.
    const pleaded = plea === 'plead-guilty'
    const jailTime = (priors > 0 || taken > 25_000) && !(pleaded && priors === 0)
    const full = jailTime ? rng.nextIntInclusive(JAIL_MIN_MONTHS, JAIL_MAX_MONTHS) : 0
    sentenceMonths = pleaded ? Math.max(1, Math.floor(full / 2)) * (jailTime ? 1 : 0) : full
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
    // Priors push the sentence up. `span/4` floored to nothing on every
    // short-range offence — a class C misdemeanor's whole span is one
    // month — so a repeat offender served the same as a first-timer on
    // exactly the offences most people repeat (review S5). Round up.
    const priorWeight = Math.min(span, priors * Math.max(1, Math.ceil(span / 4)))
    const months = offence.minMonths + Math.min(span, roll + priorWeight)
    // A fine instead of custody, where the offence allows one at all and
    // the file is clean enough to earn it. Felonies here carry no fine.
    // The months bound is the offence's OWN low end, not a flat six: at a
    // flat six every felony fine was dead data (their minimum is twelve),
    // and a defendant with priors could roll a zero-month sentence and
    // walk out owing nothing at all — priors acting as a discount.
    const finable =
      offence.fine > 0 && priors === 0 && months <= Math.max(6, offence.minMonths)
    sentenceMonths = finable ? 0 : months
    fine = finable ? offence.fine : 0
    // A conviction always costs something. Without this a defendant whose
    // roll landed on zero months and whose file barred a fine walked out
    // owing nothing, and the record showed "fined $0.00" (review S5).
    if (sentenceMonths === 0 && fine === 0) fine = Math.max(offence.fine, 5_000)
  }

  // THE LADDER (C3 §1). The sentence above is what the statute allows; the
  // disposition is what the court actually does with it, and the two rungs
  // that matter most — probation and a suspended term — leave somebody in
  // their life while still costing them something.
  const disposition = dispositionFor(offence, priors, plea === 'plead-guilty', rng)
  const custodyMonths =
    disposition === 'jail'
      ? Math.max(1, sentenceMonths)
      : disposition === 'split'
        ? Math.max(1, Math.floor(Math.max(1, sentenceMonths) / 3))
        : 0
  const hangingOver =
    disposition === 'suspended' || disposition === 'probation' || disposition === 'split'
      ? Math.max(1, sentenceMonths)
      : 0
  const probationMonths =
    disposition === 'probation' || disposition === 'split'
      ? probationMonthsFor(Math.max(1, sentenceMonths))
      : 0
  // Money still answers for the rungs that are money, and a conviction
  // never costs nothing.
  const finePaid =
    disposition === 'fine' || disposition === 'service'
      ? Math.max(fine, offence?.fine ?? 5_000)
      : disposition === 'dismissed'
        ? 0
        : fine

  // DIVERSION IS NOT A CONVICTION. The case ended and nothing goes on the
  // file — which is the whole point of the bottom rung, and the reason a
  // first small offence should not follow somebody for a decade.
  if (disposition === 'dismissed') {
    recordEvent(world, tick, {
      type: 'was-acquitted',
      subjectId: person.id,
      detail: `${offence?.id ?? 'theft'}:dismissed`,
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'crime',
      significance: 'notable',
      inputs: [factor('own-choice', 300), factor('clean-record', 800)],
      chosen: `the ${offence?.title ?? 'theft'} charge was dismissed`,
      rejected: [],
      streamId: Stream.Crime,
    })
    return
  }

  const existing = world.criminal.get(person.id)
  world.criminal.set(person.id, {
    personId: person.id,
    convictions: [
      ...(existing?.convictions ?? []),
      {
        kind: offence?.id ?? 'theft',
        tick,
        sentenceMonths: custodyMonths,
        fine: finePaid,
        disposition,
      },
    ],
    jailedUntilTick:
      custodyMonths > 0
        ? ((tick + custodyMonths) as Tick)
        : (existing?.jailedUntilTick ?? null),
    probationUntilTick:
      probationMonths > 0
        ? ((tick + custodyMonths + probationMonths) as Tick)
        : (existing?.probationUntilTick ?? null),
    suspendedMonths: hangingOver > 0 ? hangingOver : (existing?.suspendedMonths ?? 0),
    restitutionOwed: existing?.restitutionOwed ?? 0,
  })
  if (probationMonths > 0) {
    recordEvent(world, tick, {
      type: 'placed-on-probation',
      subjectId: person.id,
      detail: String(probationMonths),
    })
  }
  sentenceMonths = custodyMonths
  fine = finePaid
  const jailTime = custodyMonths > 0

  recordEvent(world, tick, {
    type: 'was-convicted',
    subjectId: person.id,
    // The disposition travels with the event, because the paper reads it:
    // custody is a story and a fine is not (owner), and after the ladder
    // "did they go inside" is no longer the same question as "were they
    // convicted".
    detail: jailTime
      ? `jail:${String(sentenceMonths)}:${disposition}`
      : `${disposition}:${String(fine)}`,
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
/**
 * A sentence in words: "3 years, 2 months".
 *
 * The clock this world runs on is MONTHLY, so there are no days to report —
 * a sentence of "4 years, 2 months and 11 days" would be inventing a
 * precision the simulation does not have, the same way a day on the orders
 * sheet did. Years and months are what the court actually handed down.
 */
export function sentenceInWords(months: number): string {
  if (months <= 0) return 'no time'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearPart = years === 0 ? '' : years === 1 ? '1 year' : `${String(years)} years`
  const monthPart = rest === 0 ? '' : rest === 1 ? '1 month' : `${String(rest)} months`
  if (yearPart === '') return monthPart
  if (monthPart === '') return yearPart
  return `${yearPart}, ${monthPart}`
}

export function crimeNewsSince(world: World, sinceTick: Tick): NewsItem[] {
  const items: NewsItem[] = []

  // C3 §4. THE WEATHER, ONCE A YEAR. The index is a fact about the town
  // computed from things the player can already see — how many households
  // are behind, how many people are out of work, how many constables the
  // county employs — and this is where it becomes something they read
  // rather than something that quietly moves the odds.
  if (world.tick % 12 === 0 && world.tick > sinceTick - 12) {
    const pressure = crimePressureOf(world)
    const line =
      pressure >= 260
        ? 'petty crime is up sharply this year, and the courthouse is busy'
        : pressure >= 150
          ? 'petty crime is up this year'
          : pressure <= 40
            ? 'a quiet year for the county courthouse'
            : null
    if (line !== null) items.push({ tick: world.tick, text: line, nearby: false })
  }
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
      // CUSTODY ONLY, AND CUSTODY MEANS JAIL OR A SPLIT SENTENCE (owner).
      // A fine is a bad afternoon; probation, a suspended term and
      // community service all leave somebody in their own life. What the
      // paper prints is the one that takes them out of the town, out of a
      // job and out of a household.
      if (event.detail?.startsWith('jail:') !== true) continue
      const parts = event.detail.split(':')
      const disposition = parts[2] ?? 'jail'
      if (disposition !== 'jail' && disposition !== 'split') continue
      const sentence = sentenceInWords(Number(parts[1] ?? '0'))
      // The charge, from the record rather than assumed: the courthouse
      // hears more than theft now (C2).
      const conviction = [...(world.criminal.get(person.id)?.convictions ?? [])]
        .reverse()
        .find((c) => c.tick === event.tick)
      const charge = offenceById(conviction?.kind ?? 'theft')?.title ?? 'theft'
      items.push({
        tick: event.tick,
        text: `${fullName(person)} was convicted of ${charge} at the courthouse — ${sentence}`,
        nearby: false,
        subjectId: person.id,
        kind: 'crime',
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
