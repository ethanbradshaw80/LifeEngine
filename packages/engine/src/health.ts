/**
 * Health: bodies that break, mend, and carry the marks. L4-M2.
 *
 * Before this milestone, health was a vitality trait and a death tick — a
 * coin labelled died/fine. That could not receive a combat resolution
 * (L4-M4), and it was thin even for civilian life: the town had fatal
 * accidents but no broken legs, pneumonia that killed but never merely
 * ruined a winter.
 *
 * The model, kept deliberately modest (the deep healthcare domain stays
 * deferred):
 *
 *   - One active AILMENT at a time (injury or illness), with an integer
 *     severity that recovery works down. Vitality and youth heal faster.
 *   - PERMANENT DISABILITY, 0–1000, accumulated when bad ailments resolve
 *     badly. It never decreases. It is the field a war pension will one day
 *     read (foundation §17: service-connected disability is lifelong).
 *   - Ailments gate work: severe ones block hiring and drag performance;
 *     disability lowers the ceiling performance can reach.
 *   - Mortality reads health: an active severe ailment and a broken body
 *     both make every month more dangerous.
 *
 * OWNERSHIP: this system is the only writer of health records. Employment
 * and mortality READ them (DOMAIN_MAP one-owner rule).
 *
 * Draws use Stream.Health with salted ticks, so they never collide with the
 * mortality draws on the same stream (the births +7777/+8888 pattern).
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { MACHINES_BY_OCCUPATION, occupationById, PENSION_CENTS_PER_POINT, PENSION_THRESHOLD } from './content.js'
import { raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { BodySite, HealthRecord, Person, World } from './types.js'
import { describeAilment, markFor, pickFieldIllness, pickIllness, pickInjury } from './wounds.js'
import type { InjuryContext } from './wounds.js'

// --- Tunables ---------------------------------------------------------------

/** Physically risky occupations: higher injury odds. */
const RISKY_OCCUPATIONS = new Set(['labourer', 'millhand', 'carpenter', 'machinist', 'electrician', 'cook'])

/** An ailment at or above this severity blocks new hiring and drags work. */
export const SEVERE_AILMENT = 600

/** The severity at which the player is asked how to carry it. */
const CONVALESCE_ASK_SEVERITY = 500

// ---------------------------------------------------------------------------
// Queries — the read side employment and mortality use
// ---------------------------------------------------------------------------

export function healthOf(world: World, personId: EntityId): HealthRecord | undefined {
  return world.health.get(personId)
}

export function isSeverelyAiling(world: World, personId: EntityId): boolean {
  const record = world.health.get(personId)
  return record !== undefined && record.ailment !== null && record.severity >= SEVERE_AILMENT
}

/** Extra monthly mortality per 10,000 from the body's current state. */
export function mortalityFromHealth(record: HealthRecord | undefined): number {
  if (!record) return 0
  const ailing = record.ailment !== null ? Math.floor(record.severity / 60) : 0
  const broken = Math.floor(record.disability / 90)
  return ailing + broken
}

/** A blank record: well, unmarked. Every person gets one at creation. */
export function freshHealth(personId: EntityId): HealthRecord {
  return {
    personId,
    ailment: null,
    ailmentKind: null,
    ailmentSite: null,
    severity: 0,
    peakSeverity: 0,
    sinceTick: null,
    askedConvalesce: false,
    disability: 0,
    ailmentServiceConnected: false,
    serviceDisability: 0,
    marks: [],
  }
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runHealth(world: World, tick: Tick): void {
  for (const person of livingSorted(world)) {
    const record = world.health.get(person.id) ?? freshHealth(person.id)
    const rng = openStream(world.seed, Stream.Health, person.id, tick + 5555)
    const age = ageAt(person.birthTick, tick)

    if (record.ailment !== null) {
      recoverOrWorsen(world, tick, person, record, rng, age)
      continue
    }

    // Onset. Injury tracks the work; illness tracks the years.
    const job = world.employment.get(person.id)
    const risky = job !== undefined && RISKY_OCCUPATIONS.has(occupationById(job.occupationId).id)
    const injuryPerTenK = (risky ? 14 : 5) + Math.floor(Math.max(0, age - 50) / 8)
    const illnessPerTenK =
      3 + Math.floor(Math.max(0, age - 35) / 3) + Math.floor((1000 - person.traits.vitality) / 150)

    if (rng.chanceInTenThousand(injuryPerTenK)) {
      beginAilment(world, tick, person, 'injury', rng.nextBellInt(150, 850), rng, risky ? 'machinery' : 'mishap')
    } else if (rng.chanceInTenThousand(illnessPerTenK)) {
      beginAilment(world, tick, person, 'illness', rng.nextBellInt(150, 900), rng, 'mishap')
    }
  }
}

function livingSorted(world: World): Person[] {
  const living: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick === null) living.push(person)
  }
  living.sort((a, b) => a.id - b.id)
  return living
}

function beginAilment(
  world: World,
  tick: Tick,
  person: Person,
  ailment: 'injury' | 'illness',
  severity: number,
  rng: ReturnType<typeof openStream>,
  context: InjuryContext,
): void {
  // What, specifically (M-WOUNDS): the mill maims differently than the road,
  // and the winter lung is not "illness".
  const age = ageAt(person.birthTick, tick)
  let kind: string
  let site: BodySite | null = null
  if (ailment === 'injury') {
    const injury = pickInjury(rng, context)
    kind = injury.kind
    site = injury.site
  } else {
    kind = pickIllness(rng, age)
  }

  world.health.set(person.id, {
    ...(world.health.get(person.id) ?? freshHealth(person.id)),
    ailment,
    ailmentKind: kind,
    ailmentSite: site,
    severity,
    peakSeverity: severity,
    sinceTick: tick,
    askedConvalesce: false,
    // This is the CIVILIAN path — the mill, the winter lung. Service wounds
    // arrive through inflictWound, which stamps true.
    ailmentServiceConnected: false,
  })

  // A workplace incident NAMES THE MACHINE (M-DEPTH3): "a crush injury to
  // the hand — the planer at the paper mill". The record keeps kind and
  // site as ever; the words of the moment keep the where and the what.
  let description = describeAilment(ailment, kind, site)
  if (ailment === 'injury' && context === 'machinery') {
    const job = world.employment.get(person.id)
    const machines = job === undefined ? undefined : MACHINES_BY_OCCUPATION[job.occupationId]
    if (job !== undefined && machines !== undefined && machines.length > 0) {
      const workplace = world.places.get(job.workplaceId)
      description = `${description} — ${rng.pick(machines)}${workplace ? ` at ${workplace.name}` : ''}`
    }
  }
  recordEvent(world, tick, {
    type: ailment === 'injury' ? 'was-injured' : 'fell-ill',
    subjectId: person.id,
    detail: `${severity >= SEVERE_AILMENT ? 'serious' : 'minor'}:${description}`,
  })
}

/**
 * Recovery is the default; worsening the exception. Youth and vitality speed
 * the mending. A bad ailment that finally clears can leave a permanent mark —
 * the disability that outlives the wound.
 */
function recoverOrWorsen(
  world: World,
  tick: Tick,
  person: Person,
  record: HealthRecord,
  rng: ReturnType<typeof openStream>,
  age: number,
): void {
  // The player is asked, once per ailment, how to carry a serious one.
  if (
    person.id === world.player.personId &&
    !record.askedConvalesce &&
    record.severity >= CONVALESCE_ASK_SEVERITY
  ) {
    // P1: the asked bit burns only when the question actually landed —
    // if another question held the slot this month, the ailment asks
    // again next month instead of losing its one chance silently.
    const landed = raisePending(world, {
      tick,
      kind: 'convalesce',
      personId: person.id,
      otherId: null,
      occupationId: null,
      workplaceId: null,
      monthlyPay: null,
      placeId: null,
      options: ['rest', 'push-on'],
    })
    if (landed) {
      world.health.set(person.id, { ...record, askedConvalesce: true })
      return
    }
  }

  // Worsening: uncommon, likelier for the old and the frail.
  if (rng.chanceInTenThousand(160 + Math.max(0, age - 60) * 6)) {
    const worse = Math.min(1000, record.severity + rng.nextIntInclusive(60, 180))
    world.health.set(person.id, {
      ...record,
      severity: worse,
      peakSeverity: Math.max(record.peakSeverity, worse),
    })
    return
  }

  const healing =
    40 +
    Math.floor(person.traits.vitality / 12) +
    (age < 30 ? 40 : age > 65 ? -25 : 0)
  const severity = record.severity - Math.max(15, healing)

  if (severity > 0) {
    world.health.set(person.id, { ...record, severity })
    return
  }

  // Recovered — possibly marked. Lasting damage is judged by how bad the
  // ailment GOT (peak), not by the residual sliver it ended on — the first
  // draft tested the residual and produced a town where nothing ever left a
  // mark. Disability only ever accumulates — and the mark gets its WORDS,
  // fixed from what caused it (M-WOUNDS).
  let disability = record.disability
  let serviceDisability = record.serviceDisability
  let marks = record.marks
  if (record.peakSeverity >= SEVERE_AILMENT - 100 && rng.chance(record.peakSeverity, 2600)) {
    const added = Math.floor(record.peakSeverity / 9)
    disability = Math.min(1000, disability + added)
    // Provenance was stamped at onset; the pension's ledger accrues here,
    // whenever the wound finally shows what it kept — including years after
    // discharge.
    if (record.ailmentServiceConnected) {
      serviceDisability = Math.min(1000, serviceDisability + added)
    }
    const mark = markFor(record.ailment ?? 'injury', record.ailmentKind, record.ailmentSite)
    if (!marks.includes(mark)) marks = [...marks, mark]
  }

  world.health.set(person.id, {
    ...record,
    ailment: null,
    ailmentKind: null,
    ailmentSite: null,
    severity: 0,
    peakSeverity: 0,
    sinceTick: null,
    askedConvalesce: false,
    disability,
    ailmentServiceConnected: false,
    serviceDisability,
    marks,
  })
  recordEvent(world, tick, {
    type: 'recovered',
    subjectId: person.id,
    ...(disability > record.disability
      ? { detail: `marked:${marks[marks.length - 1] ?? ''}` }
      : {}),
  })

  // A veteran whose service-stamped wound just crossed the pension line gets
  // the board's finding NOW, on the record — income never appears silently
  // (Law 3). Crossing happens once: the ledger only ever rises. The at-
  // discharge case (already over the line when the uniform comes off) is
  // recorded by discharge() instead; these two conditions cannot both fire.
  const serving = world.service.get(person.id)
  if (
    serving !== undefined &&
    serving.dischargedAtTick !== null &&
    record.serviceDisability < PENSION_THRESHOLD &&
    serviceDisability >= PENSION_THRESHOLD
  ) {
    recordEvent(world, tick, {
      type: 'granted-pension',
      subjectId: person.id,
      detail: String(serviceDisability * PENSION_CENTS_PER_POINT),
    })
    recordDecision(world, tick, {
      subjectId: person.id,
      decision: 'pension',
      significance: 'notable',
      inputs: [factor('service-disability', serviceDisability)],
      chosen: 'the pension board recognized the service-connected disability',
      rejected: [],
      streamId: Stream.Health,
    })
  }
}

/**
 * A wound arriving from outside the health system's own tick — battle, for
 * now. Lives HERE because health records have one writer (the one-owner
 * rule); the deployment system asks, this module does. Returns false when an
 * active ailment already occupies the body (the wound then worsens it).
 */
export function inflictWound(
  world: World,
  tick: Tick,
  personId: EntityId,
  severity: number,
  context: InjuryContext,
  rng: { pick: <T>(items: readonly T[]) => T },
): { kind: string; site: BodySite | null; description: string } {
  const record = world.health.get(personId) ?? freshHealth(personId)
  const injury = pickInjury(rng as never, context)
  const description = describeAilment('injury', injury.kind, injury.site)

  if (record.ailment !== null) {
    const worse = Math.min(1000, record.severity + Math.floor(severity / 2))
    world.health.set(personId, {
      ...record,
      severity: worse,
      peakSeverity: Math.max(record.peakSeverity, worse),
    })
    return { kind: injury.kind, site: injury.site, description }
  }
  world.health.set(personId, {
    ...record,
    ailment: 'injury',
    ailmentKind: injury.kind,
    ailmentSite: injury.site,
    severity,
    peakSeverity: severity,
    sinceTick: tick,
    askedConvalesce: false,
    // Every wound through this door came from a deployment — any channel,
    // accident included: line of duty is line of duty. Provenance is
    // stamped NOW because only now is it knowable; the pension reads what
    // this becomes when it resolves, however many years from now.
    ailmentServiceConnected: true,
  })
  return { kind: injury.kind, site: injury.site, description }
}

/**
 * A sickness out of the theatre (M-HARM): the diseases of the field, which
 * history's armies lost more people to than fire. Lives HERE for the same
 * one-writer reason as inflictWound; the deployment system asks. Stamped
 * service-connected — line of duty is line of duty, and the pension reads
 * provenance. Returns false when an active ailment already holds the body.
 */
export function inflictFieldIllness(
  world: World,
  tick: Tick,
  personId: EntityId,
  severity: number,
  rng: { pick: <T>(items: readonly T[]) => T },
): { kind: string; description: string } | null {
  const record = world.health.get(personId) ?? freshHealth(personId)
  if (record.ailment !== null) return null
  const kind = pickFieldIllness(rng as never)
  world.health.set(personId, {
    ...record,
    ailment: 'illness',
    ailmentKind: kind,
    ailmentSite: null,
    severity,
    peakSeverity: severity,
    sinceTick: tick,
    askedConvalesce: false,
    ailmentServiceConnected: true,
  })
  return { kind, description: describeAilment('illness', kind, null) }
}

/**
 * The player's answer to a serious ailment. Both roads are real:
 * rest heals a solid step now; pushing on keeps the month's work sharp but
 * lets the ailment linger. Neither is free — that is what makes it a choice.
 */
/**
 * M-ARMY2. Move a live ailment's severity — what field aid does or fails
 * to do in the hour after a wound. Health owns the write; the deployment
 * and player systems ask (the distributeEstate pattern). Peak severity is
 * NEVER lowered: the body's worst hour is what lasting damage is judged
 * on, and good aid afterwards does not un-happen it.
 */
export function adjustAilmentSeverity(world: World, personId: EntityId, delta: number): void {
  const record = world.health.get(personId)
  if (!record || record.ailment === null) return
  const severity = Math.max(1, Math.min(1000, record.severity + delta))
  world.health.set(personId, {
    ...record,
    severity,
    peakSeverity: Math.max(record.peakSeverity, severity),
  })
}

export function applyConvalescence(world: World, tick: Tick, personId: EntityId, rest: boolean): void {
  void tick
  const record = world.health.get(personId)
  if (!record || record.ailment === null) return

  if (rest) {
    world.health.set(personId, {
      ...record,
      severity: Math.max(1, record.severity - 220),
    })
    const job = world.employment.get(personId)
    if (job) {
      world.employment.set(personId, {
        ...job,
        performance: Math.max(0, job.performance - 60),
      })
    }
  } else {
    const job = world.employment.get(personId)
    if (job) {
      world.employment.set(personId, {
        ...job,
        performance: Math.min(1000, job.performance + 20),
      })
    }
  }
}
