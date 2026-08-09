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

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { GRADE_TITLES, isFelony, offenceById, RECORD_GATE_YEARS } from './content.js'
import type { Offence } from './content.js'
import {
  CRIME_SCENE_OPTIONS,
  crimeOutcomeFor,
  dangerFor,
  encodeCrimeScene,
} from './crimescene.js'
import type { CrimeOutcome } from './crimescene.js'
import { logVerb, raisePending } from './player.js'
import { isDeployed } from './deployment.js'
import {
  chargeHousehold,
  householdWealth,
  creditPerson,
  isHomeless,
  inArrears,
  transferBetweenHouseholds,
} from './finances.js'
import type { NewsItem } from './geopolitics.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { eventsFor } from './eventindex.js'
import { openStream, Stream } from './rng.js'
import { disciplineOf } from './stats.js'
import { wellbeingOf } from './wellbeing.js'
import {
  acquits,
  beatSwing,
  counselSwing,
  COUNSEL_COST,
  decodeCase,
  encodeCase,
  evidenceFor,
  nextStage,
  sceneFor,
} from './trial.js'
import type { TrialScene } from './trial.js'
import { inflictWound } from './health.js'
import { performDeath } from './systems.js'
import { discharge as dischargeService, isServing } from './service.js'
import { fullName } from './story.js'
import { sentenceInWords } from './text.js'
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
/** C3 §5. Clean years the court wants before it will hear a petition. */
const EXPUNGEMENT_CLEAN_YEARS = 7

/** What the petition and the lawyer cost, in cents. */
const EXPUNGEMENT_COST = 120_000

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
  const staffing = Math.min(200, Math.floor((constables * 200 * 200) / adults / 10))

  // WHAT THE TOWN VOTED TO SPEND ON IT (government plan §4, phase 2's
  // second lever). Constables are the people; funding is the hours, the
  // vehicles and the forensics behind them, and a force with neither
  // clears very little.
  //
  // Scaled so that the DEFAULT of 500 reproduces exactly what this
  // returned before the lever existed — the wiring changes nothing on the
  // day it lands, and only a government moving the number changes an
  // outcome. Doubling the budget doubles the edge; gutting it removes it.
  //
  // Read off `world.policy` rather than through government.ts: the value
  // is state, and importing the module that writes it would close a cycle
  // for a number this can simply look at.
  const funding = Math.max(0, world.policy.policeFunding)
  return Math.min(400, Math.floor((staffing * funding) / 500))
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
    // M-SAFETY §3. Nowhere to sleep is its own weather, and a heavier one
    // than either of the others.
    if (isHomeless(world, person.id)) pressure += 120
    if (behind && jobless) pressure += 30 // both at once is its own weather
    // STATS PHASE 6. These two were reading raw TRAITS — the fixed things
    // somebody was born with. There are now surfaced stats that say the
    // same thing better, because they MOVE: discipline is diligence plus
    // what service steadied and what misconduct dented, and wellbeing is
    // how the life is actually going.
    //
    // The spec's claim is that "low Wellbeing + low Discipline + money
    // stress raise the offence pressure", and the reason it is worth doing
    // is that it closes a loop: a conviction dents discipline, and a
    // dented discipline makes the next offence likelier. A trait could
    // never do that.
    pressure += Math.floor((1000 - disciplineOf(world, person.id, tick)) / 50) // 0..20
    // Resilience still carries somebody through a bad month — but a life
    // that is already going badly has less to lose by a bad decision.
    pressure += Math.floor((1000 - person.traits.resilience) / 100) // 0..10
    pressure += Math.floor(Math.max(0, 500 - wellbeingOf(world, person.id)) / 25) // 0..20
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
  // INDEXED, AND ONLY THIS TICK'S. This walked the entire ledger to find
  // events from ONE month — every person, every tick, over a history that
  // only ever grows. The index narrows it to this person; walking backwards
  // and stopping at the tick boundary narrows it to the month.
  const own = eventsFor(world, personId)
  for (let i = own.length - 1; i >= 0; i -= 1) {
    const event = own[i]
    if (event === undefined) break
    // Appended in tick order, so the first older one ends the search.
    if (event.tick < tick) break
    if (event.tick !== tick) continue
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

  // THE MONEY DOES NOT MOVE YET (owner: "the screen blanks and money is
  // added... there's no scene"). The room is rolled, the player is shown a
  // tell they can read, and everything below happens only once they have
  // answered it. Nothing is taken, no record is written and no court opens
  // until executeOffence runs.
  const sceneRng = openStream(world.seed, Stream.Crime, person.id, tick + 5252)
  const danger = dangerFor(offence, sceneRng)
  // Which wording out of the scene's pools. Rolled ONCE and carried on the
  // pending, so the sentence the player read before choosing is the one the
  // outcome follows on from — a scene that rewords itself between the tell
  // and the answer is a different scene.
  const variant = sceneRng.nextIntInclusive(0, 999)
  const opened = raisePending(world, {
    tick,
    kind: 'crime-scene',
    personId: person.id,
    otherId: null,
    occupationId: encodeCrimeScene(offence.id, danger, variant),
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: [...CRIME_SCENE_OPTIONS],
  })
  if (opened) return { done: true, reason: '' }
  // No slot for the scene — resolve it the way an unattended crime goes,
  // rather than silently doing nothing with a verb the player just spent.
  executeOffence(world, tick, person, offence, crimeOutcomeFor(danger, 'cool', offence, variant))
  return { done: true, reason: '' }
}

/**
 * The crime itself, once the scene has been answered.
 *
 * Everything that used to happen inside commitOffence lives here: the
 * money, the victim, the record, the clearance roll and the courthouse.
 * What the outcome changes is how much was taken and how likely the
 * constable is to close it — not whether any of it is written down.
 */
export function executeOffence(
  world: World,
  tick: Tick,
  person: Person,
  offence: Offence,
  outcome: CrimeOutcome,
): void {
  // Backing out is not a crime. It is a decision, and it is recorded as one
  // — a life that turned around in a dark house should be able to say so.
  if (outcome.kind === 'bailed') {
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'crime',
      significance: 'notable',
      inputs: [factor('own-choice', 1000)],
      chosen: `backed out of ${offence.title}`,
      rejected: [`going through with it`],
      streamId: Stream.Crime,
    })
    return
  }

  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 5253)

  // What it puts in a pocket. Where a household is robbed the money MOVES
  // — finances owns the transfer, and a victim who loses nothing is a
  // crime that did not happen.
  let taken = 0
  let victim: Person | undefined
  if (offence.gainMax > 0 && outcome.lootPerMille > 0) {
    const full = rng.nextIntInclusive(offence.gainMin, offence.gainMax)
    // What this attempt actually came away with. Pressing on in an empty
    // house gets the safe; slipping out with what is by the door does not.
    const wanted = Math.max(1, Math.floor((full * outcome.lootPerMille) / 1000))
    if (offence.takesFromHousehold && person.householdId !== null) {
      const candidates = [...world.households.values()]
        .filter((h) => h.id !== person.householdId && h.dissolvedTick === null && householdWealth(world, h) > 20_000)
        .sort((a, b) => a.id - b.id)
      // No house worth breaking into. The attempt simply came to nothing —
      // the scene already happened, so this is a night that went nowhere
      // rather than a refusal.
      if (candidates.length === 0) return
      const victimHousehold = rng.pick(candidates)
      taken = transferBetweenHouseholds(world, tick, victimHousehold.id, person.householdId, wanted)
      const members = victimHousehold.memberIds
        .map((id) => world.people.get(id))
        .filter((p): p is Person => p !== undefined && p.deathTick === null)
        .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
      victim = members[0]
      // C3 §6. THE PLAYER'S OWN DOOR. Being robbed was already modelled -
      // the money moved, the event landed - but it happened to them rather
      // than asking them anything, which is the one thing a crime against
      // you should do. Raised here, where the theft actually happens, so
      // the moment names the month it belongs to.
      const playerId = world.player.personId
      if (playerId !== null && victimHousehold.memberIds.includes(playerId)) {
        raisePending(world, {
          tick,
          kind: 'crime-victim',
          personId: playerId,
          otherId: null,
          occupationId: offence.id,
          workplaceId: null,
          monthlyPay: taken as never,
          placeId: null,
          // C3 §15. THE THIRD OPTION IS NOT A FREE ONE. Defending the
          // house with force routes through the same system a crime does,
          // because in America it does: a clean case may never be charged,
          // a questionable one goes to trial.
          options: ['report', 'let-it-go', 'defend'],
        })
      }

      for (const member of members) {
        // Adults carry the memory; but a house of only children still
        // lost the money, so its eldest carries it rather than the
        // savings dropping with no recorded cause (review S7).
        if (member.id !== victim?.id && ageAt(member.birthTick, tick) < 18) continue
        recordEvent(world, tick, { type: 'was-robbed', subjectId: member.id, detail: String(taken) })
      }
    } else {
      // Money from outside the town's households — a till, a forged
      // cheque, tax not paid. It lands in the pocket of whoever took it,
      // through finances' own crediting door.
      //
      // M-ECON §1: this used to credit the HOUSEHOLD balance, which is an
      // obligations counter clamped at or below zero every month — so the
      // proceeds of every till and forged cheque in the town were quietly
      // deleted at the next settle, and C2's whole premise ("what you take
      // is real money") was not true of half the offences.
      taken = creditPerson(world, person.id, wanted as Money)
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
  // HOW IT WENT DECIDES WHETHER IT IS SOLVED. A quiet job is genuinely
  // hard to close; being seen is most of the way to a charge; being caught
  // in the act is not a question at all.
  const clearance = Math.min(
    1_000,
    Math.floor((offence.clearance * outcome.clearancePerMille) / 1_000),
  )
  if (outcome.kind !== 'caught' && outcome.kind !== 'wounded' && !rng.chance(clearance, 1_000)) {
    return
  }
  recordEvent(world, tick, { type: 'was-arrested', subjectId: person.id, detail: offence.title })

  const deal = pleaDealFor(world, person.id, offence, tick)
  if (deal !== null) {
    recordEvent(world, tick, {
      type: 'plea-deal-offered',
      subjectId: person.id,
      detail: `${deal.offenceId}:${String(deal.months)}:${deal.kind}`,
    })
  }
  const landed = raisePending(world, {
    tick,
    kind: 'plea',
    personId: person.id,
    otherId: null,
    occupationId: offence.id,
    workplaceId: null,
    monthlyPay: taken as never,
    placeId: null,
    options:
      deal === null
        ? ['plead-guilty', 'stand-trial']
        : ['take-plea-deal', 'plead-guilty', 'stand-trial'],
  })
  if (!landed) resolveCourt(world, tick, person, taken, rng, null, offence)
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
/**
 * C3 §11. A violent charge has somebody on the other end of it.
 *
 * Until now every offence was a thing that happened to a household's
 * savings. Violence is not: it happens to a PERSON, and the person it
 * happens to is a simulated one with a body, a household and a life that
 * carries on afterwards. Without this an assault was a line on the
 * offender's record and nothing at all on anybody else's.
 *
 * Returns the charge actually committed — which is not always the charge
 * intended. A death during a felony escalates it (C3 §11), which is the
 * felony-murder road, and it is why somebody who set out to rob a house can
 * end up facing a capital offence.
 */
function resolveViolence(
  world: World,
  tick: Tick,
  offender: Person,
  offence: Offence,
  rng: ReturnType<typeof openStream>,
): Offence {
  // Somebody who is not the offender, alive, adult, and in the town.
  const candidates: Person[] = []
  for (const person of world.people.values()) {
    if (person.id === offender.id || person.deathTick !== null) continue
    if (ageAt(person.birthTick, tick) < 16) continue
    candidates.push(person)
  }
  if (candidates.length === 0) return offence
  candidates.sort((a, b) => a.id - b.id)
  const victim = rng.pick(candidates)

  recordEvent(world, tick, {
    type: 'was-assaulted',
    subjectId: victim.id,
    otherId: offender.id,
    detail: offence.id,
  })

  // How badly it goes. A weapon charge is worse than a bar fight, and the
  // homicide charges are the ones that were always going to end this way.
  // MEASURED AND TUNED DOWN, with the tension stated rather than hidden.
  // The first numbers produced eight killings across three fifty-year
  // towns. A real town of a hundred and forty at the American homicide rate
  // sees one in roughly a hundred and forty YEARS, so that was eight times
  // too many — and tuning it to the real rate would mean most playthroughs
  // never see a homicide at all, which makes a third of the C3 catalogue
  // invisible, the exact complaint that started this arc.
  //
  // This sits deliberately above the real rate and well below the first
  // draft: a killing in living memory rather than one a decade, and the
  // charges that model one stay reachable. Law 10 asks for believable over
  // balanced; this is the honest edge of believable.
  const lethalIntent = offence.maxMonths >= 180
  const severity = rng.nextBellInt(lethalIntent ? 500 : 250, 1000)
  const fatal = lethalIntent ? severity >= 760 : severity >= 940 && rng.chance(1, 5)

  if (fatal) {
    performDeath(
      world, tick, victim, `violence at the hands of another`,
      [factor('own-choice', 1000), factor('battlefield-chaos', severity)],
      Stream.Crime,
    )
    // C3 §11. THE CHARGE FOLLOWS THE OUTCOME. A robbery where somebody dies
    // is not a robbery any more — that is what escalatesTo is for, and it
    // is the difference between ten years and the rest of a life.
    const escalated = offence.escalatesTo === undefined ? undefined : offenceById(offence.escalatesTo)
    if (escalated !== undefined) {
      recordEvent(world, tick, {
        type: 'escalated-charge',
        subjectId: offender.id,
        otherId: victim.id,
        detail: `${offence.id}:${escalated.id}`,
      })
      return escalated
    }
    return offence
  }

  inflictWound(world, tick, victim.id, severity, 'direct-combat', rng)
  recordEvent(world, tick, {
    type: 'was-injured',
    subjectId: victim.id,
    otherId: offender.id,
    detail: `${severity >= 600 ? 'serious' : 'minor'}:hurt in an assault`,
  })
  return offence
}

function carryOutOffence(
  world: World,
  tick: Tick,
  person: Person,
  intended: Offence,
  rng: ReturnType<typeof openStream>,
): void {
  // Violence lands on somebody, and what it does to them can change what
  // this was: a death during a felony is a different charge (C3 §11).
  const offence = intended.violent === true ? resolveViolence(world, tick, person, intended, rng) : intended

  let taken = 0
  if (offence.gainMax > 0) {
    const wanted = rng.nextIntInclusive(offence.gainMin, offence.gainMax)
    // The thief's own pocket — see the note in the theft path above.
    taken = creditPerson(world, person.id, wanted as Money)
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
    .filter((h) => h.id !== person.householdId && h.dissolvedTick === null && householdWealth(world, h) > 20_000)
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
    // NO DEAL ON THIS ONE. The C1 desperation theft is not a catalogue
    // charge — there is nothing to bargain the grade down to, and a
    // sentence bargain over a range this short would be theatre.
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
  plea: 'plead-guilty' | 'stand-trial' | 'take-plea-deal' | null,
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
    // C3 §13. THE TRIAL PENALTY IS REAL, and it is the reason anybody takes
    // a deal. A guilty plea keeps the sentence in the lower half. Standing
    // trial and losing is sentenced on the original charge with no
    // discount — and where a deal was on the table and refused, the state
    // asks for the upper half, which is the gap the whole bargain lives in.
    const refusedADeal =
      plea === 'stand-trial' && offence !== null && pleaDealFor(world, person.id, offence, tick) !== null
    const roll =
      plea === 'plead-guilty'
        ? rng.nextIntInclusive(0, Math.floor(span / 2))
        : refusedADeal
          ? Math.floor(span / 2) + rng.nextIntInclusive(0, Math.ceil(span / 2))
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

  // C3 §13. THE DEAL IS A CERTAIN CONVICTION ON AGREED TERMS. No trial, so
  // no acquittal — and no risk of the full sentence either. That trade is
  // the whole of plea bargaining, and it is why the trial penalty below
  // has to be real for the choice to mean anything.
  if (plea === 'take-plea-deal' && offence !== null) {
    const deal = pleaDealFor(world, person.id, offence, tick)
    if (deal !== null) {
      const agreed = offenceById(deal.offenceId) ?? offence
      recordEvent(world, tick, {
        type: 'took-plea-deal',
        subjectId: person.id,
        detail: `${offence.id}:${agreed.id}:${String(deal.months)}`,
      })
      const existingFile = world.criminal.get(person.id)
      world.criminal.set(person.id, {
        personId: person.id,
        convictions: [
          ...(existingFile?.convictions ?? []),
          {
            kind: agreed.id,
            tick,
            sentenceMonths: deal.months,
            fine: deal.months > 0 ? 0 : Math.max(agreed.fine, 5_000),
            disposition: deal.months > 0 ? 'jail' : 'fine',
          },
        ],
        jailedUntilTick: deal.months > 0 ? ((tick + deal.months) as Tick) : (existingFile?.jailedUntilTick ?? null),
        probationUntilTick: existingFile?.probationUntilTick ?? null,
        suspendedMonths: existingFile?.suspendedMonths ?? 0,
        restitutionOwed: existingFile?.restitutionOwed ?? 0,
      })
      recordEvent(world, tick, {
        type: 'was-convicted',
        subjectId: person.id,
        detail:
          deal.months > 0
            ? `jail:${String(deal.months)}:jail`
            : `fine:${String(Math.max(agreed.fine, 5_000))}`,
      })
      recordDecision(world, tick, {
        subjectId: person.id,
        decision: 'justice',
        significance: isFelony(agreed.grade) ? 'defining' : 'major',
        inputs: [factor('own-choice', 1000), factor('prior-record', priors * 200)],
        chosen: `took the plea and was convicted of ${agreed.title}`,
        rejected: ['to stand trial'],
        streamId: Stream.Crime,
      })
      if (deal.months > 0) world.employment.delete(person.id)
      return
    }
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
 * C3 §6. The player answered the burglary.
 *
 * REPORTING IS NOT A FORMALITY. It raises the chance this specific theft is
 * cleared — the constables have something to work with — and a cleared
 * theft is a real person arrested, tried, and possibly ordered to pay the
 * money back. That is a causal loop the player set in motion, which is the
 * whole reason this is a moment and not a notification.
 *
 * Letting it go is recorded too. A choice that leaves no trace is not a
 * choice, and the desperation moment settled that principle already.
 */
export function answerVictimMoment(
  world: World,
  tick: Tick,
  person: Person,
  offenceId: string,
  taken: number,
  report: boolean,
): void {
  const offence = offenceById(offenceId)
  if (!report) {
    recordEvent(world, tick, {
      type: 'declined-to-report',
      subjectId: person.id,
      detail: offenceId,
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'crime',
      significance: 'notable',
      inputs: [factor('own-choice', 1000)],
      chosen: 'let it go rather than report it',
      rejected: ['to report it to the constable'],
      streamId: Stream.Crime,
    })
    return
  }

  recordEvent(world, tick, { type: 'reported-crime', subjectId: person.id, detail: offenceId })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'crime',
    significance: 'notable',
    inputs: [factor('own-choice', 1000)],
    chosen: 'reported it to the constable',
    rejected: ['to let it go'],
    streamId: Stream.Crime,
  })

  // The thief, if the county can find them. A report is worth a real
  // improvement on the odds and no more than that — most burglaries are
  // never solved, and a report that guaranteed an arrest would make the
  // choice a formality in the other direction.
  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 8181)
  const odds = Math.min(900, (offence?.clearance ?? 400) + 150 + clearanceBonusOf(world))
  if (!rng.chance(odds, 1_000)) return

  const thief = recentThiefOf(world, person.id, tick)
  if (thief === undefined) return
  recordEvent(world, tick, { type: 'was-arrested', subjectId: thief.id, detail: offence?.title ?? 'theft' })
  if (isOnProbation(world, thief.id)) revokeProbation(world, tick, thief, offenceId)
  resolveCourt(world, tick, thief, taken, rng, null, offence ?? null)

  // C3 §6. RESTITUTION: the money comes back, where the court can find it.
  const owed = Math.min(taken, 60_000)
  if (owed > 0) {
    recordEvent(world, tick, {
      type: 'ordered-restitution',
      subjectId: thief.id,
      otherId: person.id,
      detail: String(owed),
    })
    const thiefRecord = world.criminal.get(thief.id)
    if (thiefRecord) {
      world.criminal.set(thief.id, {
        ...thiefRecord,
        restitutionOwed: (thiefRecord.restitutionOwed ?? 0) + owed,
      })
    }
  }
}

/** Who robbed this household most recently, if they are still about. */
function recentThiefOf(world: World, victimId: EntityId, tick: Tick): Person | undefined {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event) continue
    if (tick - event.tick > 2) break
    if (event.type !== 'committed-theft') continue
    if (event.otherId !== victimId) continue
    const thief = world.people.get(event.subjectId)
    if (thief && thief.deathTick === null) return thief
  }
  return undefined
}

/**
 * C3 §5. Whether the court would hear a petition to seal this record, and
 * why not when it would not — the `offenceBar` pattern, in plain words.
 *
 * NEVER FOR THE WORST OF IT. A capital offence and a violent felony are the
 * two the fade already keeps hard for life, and sealing them would undo
 * that by another door.
 */
export function expungementBar(world: World, personId: EntityId, tick: Tick): string | null {
  const person = world.people.get(personId)
  const record = world.criminal.get(personId)
  if (!record || record.convictions.length === 0) return 'Nothing on the file to seal.'
  if (record.jailedUntilTick !== null && tick < record.jailedUntilTick) {
    return 'Not from a cell.'
  }
  const probationUntil = record.probationUntilTick ?? null
  if (probationUntil !== null && tick < probationUntil) {
    return 'Not while the court is still supervising you.'
  }

  const open = record.convictions.filter((c) => c.sealed !== true)
  if (open.length === 0) return 'The file is already sealed.'

  for (const conviction of open) {
    const offence = offenceById(conviction.kind)
    if (offence === undefined) continue
    if (offence.grade === 'capital') return 'A capital conviction is never sealed.'
    if (offence.violent === true && isFelony(offence.grade)) {
      return 'A violent felony stays on the file where anybody can read it.'
    }
  }

  // A CLEAN PERIOD, not merely a long one. The petition asks the court to
  // agree the person is not who the record says, and a fresh conviction is
  // the court's answer to that.
  const newest = open.reduce((latest, c) => (c.tick > latest ? c.tick : latest), 0)
  const yearsClean = Math.floor((tick - newest) / 12)
  if (yearsClean < EXPUNGEMENT_CLEAN_YEARS) {
    const wait = EXPUNGEMENT_CLEAN_YEARS - yearsClean
    return `The court wants ${String(wait)} more clean year${wait === 1 ? '' : 's'} first.`
  }
  // The household's money, because that is whose money it is — the same
  // ledger a fine comes out of.
  const householdId = person?.householdId ?? null
  const household = householdId === null ? undefined : world.households.get(householdId)
  const savings = household === undefined ? 0 : householdWealth(world, household)
  if (savings < EXPUNGEMENT_COST) {
    return `A petition and a lawyer cost ${String(Math.floor(EXPUNGEMENT_COST / 100))} dollars, and the house does not have it.`
  }
  return null
}

/**
 * C3 §5, Decision 2. Seal what can be sealed.
 *
 * SEALED, NOT DELETED, and that is the whole of the owner's Decision 2:
 * every gate stops reading these convictions and the person's history still
 * contains them. A descendant reading the life finds what happened; an
 * employer does not. Erasing them would let a record rewrite history, and
 * the engine rests on history being the thing that does not move.
 */
export function petitionForExpungement(
  world: World,
  personId: EntityId,
  tick: Tick,
): { sealed: number; reason: string } {
  const bar = expungementBar(world, personId, tick)
  if (bar !== null) return { sealed: 0, reason: bar }
  const record = world.criminal.get(personId)
  const person = world.people.get(personId)
  if (!record || !person) return { sealed: 0, reason: 'Nobody to petition for.' }

  if (person.householdId !== null) {
    chargeHousehold(world, tick, person.householdId, EXPUNGEMENT_COST)
  }

  let sealed = 0
  const convictions = record.convictions.map((conviction) => {
    if (conviction.sealed === true) return conviction
    const offence = offenceById(conviction.kind)
    // The two that never seal, checked again here rather than trusted from
    // the bar: a mixed file seals what it can and keeps the rest.
    if (offence !== undefined && (offence.grade === 'capital' || (offence.violent === true && isFelony(offence.grade)))) {
      return conviction
    }
    sealed += 1
    return { ...conviction, sealed: true }
  })
  world.criminal.set(personId, { ...record, convictions })

  recordEvent(world, tick, {
    type: 'conviction-expunged',
    subjectId: personId,
    detail: String(sealed),
  })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'justice',
    significance: 'major',
    inputs: [factor('own-choice', 1000), factor('clean-record', 900)],
    chosen: `petitioned the court and had ${String(sealed)} conviction${sealed === 1 ? '' : 's'} sealed`,
    rejected: ['to leave the record open'],
    streamId: Stream.Crime,
  })
  return { sealed, reason: '' }
}

/**
 * C3 §13. What the prosecutor will offer, if anything.
 *
 * THE HONEST INVERSION, and the thing players should feel: a WEAK case
 * bargains and a strong one does not have to. The state's leverage is the
 * evidence — here, how likely the charge was to be cleared in the first
 * place, which is the same number that decided whether there was an arrest
 * at all — crossed with the defendant's priors.
 *
 * A shaky case on a small charge deals generously because a loss at trial
 * costs the state more than a discount does. An overwhelming case on a
 * serious charge deals stiffly or not at all: there is nothing to buy.
 */
export interface PleaDeal {
  /** What they would plead to — sometimes a lesser charge entirely. */
  readonly offenceId: string
  /** Months agreed. Zero means the deal is probation or a fine. */
  readonly months: number
  /** Which of the three real forms this is, for the words on the screen. */
  readonly kind: 'charge' | 'sentence'
}

/** The lesser charge a bargain drops to, where one is reachable. */
function lesserThan(offence: Offence): Offence | undefined {
  // Down one rung of the same family: the charge bargain's whole point is
  // that the grade falls and everything the grade drives falls with it.
  const order: Record<string, string> = {
    burglary: 'trespassing',
    'commercial-burglary': 'trespassing',
    'armed-robbery': 'robbery',
    robbery: 'grand-theft',
    'aggravated-assault': 'simple-assault',
    'assault-deadly-weapon': 'aggravated-assault',
    'attempted-murder': 'assault-deadly-weapon',
    'murder-second': 'voluntary-manslaughter',
    'voluntary-manslaughter': 'involuntary-manslaughter',
    'grand-theft': 'shoplifting',
    'auto-theft': 'grand-theft',
    'drug-trafficking': 'possession-with-intent',
    'possession-with-intent': 'drug-possession',
    'wire-fraud': 'petty-fraud',
    'insurance-fraud': 'petty-fraud',
    'credit-card-fraud': 'petty-fraud',
    battery: 'disorderly-conduct',
    'simple-assault': 'disorderly-conduct',
  }
  const lesser = order[offence.id]
  const target = lesser === undefined ? undefined : offenceById(lesser)
  // AND IT HAS TO ACTUALLY BE LESSER. The table above is hand-written and a
  // pair slipped through where both charges carried the same ceiling
  // (auto-theft and grand-theft are both class C felonies) — a "bargain"
  // that drops nothing is worse than no bargain, because the player takes
  // it believing it bought something.
  if (target === undefined || target.maxMonths >= offence.maxMonths) return undefined
  return target
}

export function pleaDealFor(
  world: World,
  personId: EntityId,
  offence: Offence,
  tick: Tick,
): PleaDeal | null {
  // No deal on the very worst of it. The state does not bargain away a
  // capital charge, and mandatory minimums are the legislature saying so.
  if (offence.grade === 'capital') return null

  const priors = world.criminal.get(personId)?.convictions.length ?? 0
  const rng = openStream(world.seed, Stream.Crime, personId, tick + 9191)

  // STRENGTH OF THE CASE. Clearance is how readily this kind of offence is
  // pinned on somebody; priors make a jury readier still.
  const strength = Math.min(1000, offence.clearance + priors * 60)

  // An overwhelming case on a serious charge has no reason to deal.
  if (strength >= 700 && isFelony(offence.grade) && rng.chance(2, 3)) return null

  const lesser = lesserThan(offence)
  // A weak case buys a charge bargain where one exists — the grade falls,
  // and with it the sentence, the gate and the fade.
  if (strength < 560 && lesser !== undefined) {
    return {
      offenceId: lesser.id,
      months: Math.max(
        lesser.mandatoryMin ?? 0,
        lesser.minMonths + rng.nextInt(0, Math.max(1, Math.floor((lesser.maxMonths - lesser.minMonths) / 4))),
      ),
      kind: 'charge',
    }
  }

  // Otherwise a sentence bargain: the same charge, the bottom of its range,
  // and never below a mandatory minimum — that floor is the whole reason
  // one exists.
  const floor = Math.max(offence.mandatoryMin ?? 0, offence.minMonths)
  const span = Math.max(0, offence.maxMonths - floor)
  return {
    offenceId: offence.id,
    months: floor + rng.nextInt(0, Math.max(1, Math.floor(span / 5))),
    kind: 'sentence',
  }
}

/** The deal in words, for the scene that offers it. */
export function describePleaDeal(deal: PleaDeal): string {
  const offence = offenceById(deal.offenceId)
  const to = offence?.title ?? 'a lesser charge'
  const term = deal.months <= 0 ? 'no custody' : sentenceInWords(deal.months)
  return deal.kind === 'charge'
    ? `Plead guilty to ${to} for ${term}.`
    : `Plead guilty as charged for ${term}.`
}

/**
 * C3 §15. How strong a claim of justified force is, 0-1000.
 *
 * THE AMERICAN SHAPE, and the part players get wrong: using force on
 * somebody in your house does NOT automatically clear you. What decides it
 * is the circumstances, and they are the ones the doc names:
 *
 *  - castle doctrine: were they unlawfully inside the home
 *  - was the intruder armed
 *  - were they FLEEING, which is the weakest case there is — shooting
 *    somebody in the back as they leave is not defence of anything
 *  - and proportionality: what was actually at stake
 *
 * The same frame generalises: defence of others, defence of property
 * (weak — deadly force is rarely justified for property alone), duress and
 * necessity. None of them is an automatic pass, and none is an automatic
 * conviction.
 */
export interface ForceCircumstances {
  readonly inTheHome: boolean
  readonly intruderArmed: boolean
  readonly intruderFleeing: boolean
  /** True where the force used was lethal. */
  readonly lethal: boolean
}

export function justificationOf(circumstances: ForceCircumstances): number {
  let score = 300
  if (circumstances.inTheHome) score += 350
  if (circumstances.intruderArmed) score += 250
  // The one that sinks a case. A fleeing burglar is not a threat, and the
  // law is not sentimental about it.
  if (circumstances.intruderFleeing) score -= 450
  // Killing over property alone is where the proportionality question bites.
  if (circumstances.lethal && !circumstances.intruderArmed) score -= 150
  return Math.max(0, Math.min(1000, score))
}

/**
 * C3 §14. Whether the state files at all.
 *
 * Not every crime reaches a courtroom — the prosecutor decides, and this is
 * what makes §15 honest: a clean self-defence shooting may never be
 * charged, while a questionable one goes to trial. A declined case ends
 * here and is recorded, naming nobody publicly (the C1 asymmetry).
 */
export function chargeDecision(
  world: World,
  tick: Tick,
  person: Person,
  offence: Offence,
  justification: number,
): 'file' | 'decline' {
  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 7373)
  // An overwhelming justification is not charged; a weak one is; the middle
  // is where the grand jury and the prosecutor's judgement live.
  const fileOdds = Math.max(20, Math.min(980, 1000 - justification))
  if (rng.chance(fileOdds, 1_000)) {
    recordEvent(world, tick, { type: 'charged', subjectId: person.id, detail: offence.id })
    return 'file'
  }
  recordEvent(world, tick, {
    type: 'charge-declined',
    subjectId: person.id,
    detail: offence.id,
  })
  recordEvent(world, tick, { type: 'ruled-justified', subjectId: person.id, detail: offence.id })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'justice',
    significance: 'defining',
    inputs: [factor('own-choice', 500), factor('clean-record', justification)],
    chosen: 'used force and the county declined to charge it',
    rejected: [],
    streamId: Stream.Crime,
  })
  return 'decline'
}

/**
 * C3 §15. The self-defence plea, weighed at trial.
 *
 * An affirmative defence: the act is admitted and the justification is what
 * is argued. Justified acquits; not justified convicts on the underlying
 * charge, at its full weight — which is the risk of running it.
 */
export function tryJustification(
  world: World,
  tick: Tick,
  person: Person,
  offence: Offence,
  justification: number,
  rng: ReturnType<typeof openStream>,
): boolean {
  recordEvent(world, tick, { type: 'pleaded-self-defense', subjectId: person.id, detail: offence.id })
  if (!rng.chance(justification, 1_000)) return false
  recordEvent(world, tick, { type: 'ruled-justified', subjectId: person.id, detail: offence.id })
  recordEvent(world, tick, { type: 'was-acquitted', subjectId: person.id, detail: `${offence.id}:justified` })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'justice',
    significance: 'defining',
    inputs: [factor('own-choice', 600), factor('clean-record', justification)],
    chosen: 'was acquitted, the force ruled justified',
    rejected: ['to plead to the charge'],
    streamId: Stream.Crime,
  })
  return true
}

/**
 * C3 §15. The player met the intruder.
 *
 * The force is used, and then the STATE decides what to make of it — which
 * is the honest shape and the one the doc insists on. Nothing here clears
 * anybody automatically.
 */
export function defendTheHouse(
  world: World,
  tick: Tick,
  person: Person,
  offenceId: string,
): void {
  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 6262)
  const thief = recentThiefOf(world, person.id, tick)

  // What the moment actually was. Nothing is asserted that the world does
  // not already imply: it happened in the home, because that is where the
  // burglary was, and the rest is drawn.
  const intruderArmed = rng.chance(1, 3)
  const intruderFleeing = rng.chance(2, 5)
  const lethal = rng.chance(intruderArmed ? 1 : 3, 10) === false ? rng.chance(1, 4) : rng.chance(1, 2)

  recordEvent(world, tick, {
    type: 'used-lethal-force',
    subjectId: person.id,
    ...(thief !== undefined ? { otherId: thief.id } : {}),
    detail: `${offenceId}:${lethal ? 'lethal' : 'force'}`,
  })

  if (thief !== undefined) {
    if (lethal) {
      performDeath(
        world, tick, thief, 'shot during a burglary',
        [factor('own-choice', 800), factor('battlefield-chaos', 700)],
        Stream.Crime,
      )
    } else {
      inflictWound(world, tick, thief.id, 500 + rng.nextInt(0, 300), 'direct-combat', rng)
      recordEvent(world, tick, {
        type: 'was-injured',
        subjectId: thief.id,
        otherId: person.id,
        detail: 'serious:hurt breaking into a house',
      })
    }
  }

  const justification = justificationOf({
    inTheHome: true,
    intruderArmed,
    intruderFleeing,
    lethal,
  })

  // A wounding that hurts nobody badly is not a case at all.
  if (!lethal && justification >= 500) {
    recordEvent(world, tick, { type: 'ruled-justified', subjectId: person.id, detail: offenceId })
    return
  }

  const charge = offenceById(lethal ? 'voluntary-manslaughter' : 'aggravated-assault')
  if (charge === undefined) return
  if (chargeDecision(world, tick, person, charge, justification) === 'decline') return

  // Charged. The trial weighs the same circumstances the prosecutor did.
  if (tryJustification(world, tick, person, charge, justification, rng)) return
  resolveCourt(world, tick, person, 0, rng, 'stand-trial', charge)
}

/**
 * C3 §15b. The case opens: counsel first, then the trial, then the verdict.
 */
export function openCase(
  world: World,
  tick: Tick,
  personId: EntityId,
  offence: Offence,
  taken: number,
): boolean {
  const evidence = evidenceFor(world, personId, offence, tick)
  const scene = sceneFor('counsel', offence, evidence)
  recordEvent(world, tick, { type: 'arraigned', subjectId: personId, detail: offence.id })
  return raisePending(world, {
    tick,
    kind: 'trial',
    personId,
    otherId: null,
    occupationId: encodeCase(offence.id, 'counsel', 0, 0, taken),
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options: scene.options.map((o) => o.id),
  })
}

/** What the pending is currently showing, for the prompt and the buttons. */
export function caseSceneOf(
  world: World,
  personId: EntityId,
  encoded: string | null,
  tick: Tick,
): { scene: TrialScene; offence: Offence } | null {
  const state = decodeCase(encoded)
  const offence = offenceById(state.offenceId)
  if (offence === undefined) return null
  const evidence = evidenceFor(world, personId, offence, tick)
  return { scene: sceneFor(state.stage, offence, evidence), offence }
}

/**
 * One answer in the case. Returns the next scene's encoded state, or null
 * when the case is done — the caller raises it AFTER commit, because
 * raisePending refuses while the answered pending still holds the slot.
 */
export function answerCase(
  world: World,
  tick: Tick,
  person: Person,
  encoded: string | null,
  choice: string,
): { next: string | null } {
  const state = decodeCase(encoded)
  const offence = offenceById(state.offenceId)
  if (offence === undefined) return { next: null }
  const evidence = evidenceFor(world, person.id, offence, tick)
  const scene = sceneFor(state.stage, offence, evidence)
  const chosen = scene.options.find((o) => o.id === choice) ?? scene.options[0]

  let defence = state.defence
  let sympathy = state.sympathy

  if (state.stage === 'counsel') {
    let gained = counselSwing(chosen?.id ?? '')
    // AN ATTORNEY COSTS REAL MONEY, and somebody who cannot pay does not
    // get the benefit of having said it.
    if (chosen?.id === 'hire-attorney') {
      const householdId = person.householdId
      const payer = householdId === null ? undefined : world.households.get(householdId)
      const savings = payer === undefined ? 0 : householdWealth(world, payer)
      if (householdId !== null && savings >= COUNSEL_COST) {
        chargeHousehold(world, tick, householdId, COUNSEL_COST)
      } else {
        gained = counselSwing('public-defender')
      }
    }
    defence += gained
  } else if (state.stage !== 'verdict') {
    let gained = beatSwing(chosen?.id ?? '')
    // Taking the stand is the big swing in BOTH directions, which is why
    // real defendants agonise over it: a record follows you up there.
    if (chosen?.id === 'take-the-stand') {
      const priors = world.criminal.get(person.id)?.convictions.filter((c) => c.sealed !== true).length ?? 0
      if (priors > 0) gained = Math.max(0, gained - priors * 100)
      if (evidence.strength >= 700) gained = Math.floor(gained / 2)
    }
    if (chosen?.id === 'appeal-for-sympathy') sympathy += 200
    defence += gained
  }

  recordEvent(world, tick, {
    type:
      chosen?.id === 'take-the-stand'
        ? 'testified'
        : chosen?.id === 'stay-silent'
          ? 'stayed-silent'
          : state.stage === 'verdict'
            ? 'verdict'
            : 'stood-trial',
    subjectId: person.id,
    detail: `${offence.id}:${state.stage}:${chosen?.id ?? ''}`,
  })
  recordDecision(world, tick, {
    subjectId: person.id,
    decision: 'justice',
    significance: state.stage === 'verdict' ? 'major' : 'notable',
    inputs: [factor('own-choice', 1000)],
    chosen: chosen?.says ?? 'answered the court',
    rejected: scene.options.filter((o) => o.id !== chosen?.id).map((o) => o.says),
    streamId: Stream.Crime,
  })

  const after = nextStage(state.stage)
  if (after !== null) {
    return { next: encodeCase(offence.id, after, defence, sympathy, state.taken) }
  }

  // SCENE 3. The jury returns, and this is what the case was building to.
  const rng = openStream(world.seed, Stream.Crime, person.id, tick + 5959)
  if (acquits(evidence, defence, rng)) {
    recordEvent(world, tick, {
      type: 'was-acquitted',
      subjectId: person.id,
      detail: `${offence.id}:verdict`,
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'justice',
      significance: 'major',
      inputs: [factor('own-choice', Math.min(1000, defence)), factor('clean-record', 600)],
      chosen: 'was acquitted at trial',
      rejected: ['a conviction'],
      streamId: Stream.Crime,
    })
    return { next: null }
  }
  // Guilty. Sympathy earned in the closing is mitigation at sentencing —
  // a guilty plea's discount, bought a different way.
  resolveCourt(
    world, tick, person, state.taken, rng,
    sympathy >= 200 ? 'plead-guilty' : 'stand-trial',
    offence,
  )
  return { next: null }
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
