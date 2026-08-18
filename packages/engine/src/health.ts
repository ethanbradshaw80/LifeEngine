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

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { MACHINES_BY_OCCUPATION, occupationById, PENSION_CENTS_PER_POINT, PENSION_THRESHOLD } from './content.js'
import { raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream, type Rng } from './rng.js'
import { wellbeingBaselineFor, wellbeingOf } from './wellbeing.js'
import type { BodySite, HealthRecord, Person, World } from './types.js'
import { describeAilment, markFor, pickFieldIllness, pickIllness, pickInjury } from './wounds.js'
import type { InjuryContext } from './wounds.js'

/**
 * WHICH WOUNDS ARE LINE OF DUTY.
 *
 * `inflictWound` used to stamp `ailmentServiceConnected: true` on EVERY wound
 * that came through it, on the reasoning that "every wound through this door
 * came from a deployment". That was never true. `systems.ts` sends ordinary
 * civilian accidents through the same door (`mishap`, severity 600-950),
 * `tick.ts` sends off-duty ones, and `crime.ts` sent muggings — so a man who
 * fell off a ladder at fifty accrued a SERVICE disability rating, and
 * `pensionOf` paid him for it.
 *
 * Provenance is a property of HOW somebody was hurt, so it is read off the
 * context rather than assumed from the call site. Line of duty is line of
 * duty — a truck rolling on a supply run counts as much as fire does, which
 * is why `field-accident` is in this set — but a ladder at home is not.
 */
const LINE_OF_DUTY: ReadonlySet<InjuryContext> = new Set<InjuryContext>([
  'direct-combat',
  'convoy',
  'base-attack',
  'field-accident',
])

// --- Tunables ---------------------------------------------------------------

/** Physically risky occupations: higher injury odds. */
const RISKY_OCCUPATIONS = new Set(['labourer', 'millhand', 'carpenter', 'machinist', 'electrician', 'cook'])

/** An ailment at or above this severity blocks new hiring and drags work. */
export const SEVERE_AILMENT = 600

/**
 * WHERE A WOUND STARTS BEING WORTH SOMETHING FOR LIFE.
 *
 * Well below `SEVERE_AILMENT`, and deliberately: the department rates what a
 * body carries afterwards, not what nearly killed it. Hearing, a back, a
 * knee, a shoulder that aches in the cold — none of those are severe, and all
 * of them are rated in life.
 */
const RATEABLE_SEVERITY = 250

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

/**
 * WHAT A PROSTHETIC OR AID COSTS, base-year cents (M-HEALTH §7).
 *
 * Deliberately a real sum. The whole reason the healthcare layer exists is
 * that care costs money and not everybody has it — a prosthetic somebody
 * could buy out of pocket money would make the BA benefit meaningless and
 * the uninsured case toothless.
 */
export const ADAPTATION_COST = 1_200_000 as Money

/**
 * FIT AN AID TO A PERMANENT CONDITION (M-HEALTH §7, adaptation).
 *
 * WRITES HEALTH AND NOTHING ELSE. The money is the caller's problem — this
 * module owns health records and `finances.ts` owns cents, and health sits
 * UPSTREAM of finances in the import graph (the ratchet refuses the edge,
 * correctly). So the verb in `player.ts` debits and then calls this.
 *
 * Returns false when there is nothing to fit — already adapted, or no such
 * condition — so the caller can refuse before taking anybody's money.
 */
export function fitAdaptation(
  world: World,
  personId: EntityId,
  tick: Tick,
): boolean {
  const record = world.health.get(personId)
  if (record === undefined) return false
  const target = record.permanent.findIndex((c) => (c.adaptedAtTick ?? null) === null)
  if (target < 0) return false

  const permanent = record.permanent.map((condition, i) =>
    i === target ? { ...condition, adaptedAtTick: tick } : condition,
  )
  world.health.set(personId, { ...record, permanent })
  const fitted = record.permanent[target]
  recordEvent(world, tick, {
    type: 'fitted-with-aid',
    subjectId: personId,
    detail: fitted?.site ?? fitted?.kind ?? 'injury',
  })
  return true
}

/**
 * THE BOARD'S GRANT, WRITTEN. One writer, monotone upward — an appeal or a
 * re-filing can raise a granted rating and nothing can lower one, which is
 * the promise that makes filing always safe to click.
 */
export function setBaRating(world: World, personId: EntityId, rating: number): void {
  const record = world.health.get(personId) ?? freshHealth(personId)
  const next = Math.max(record.baRating ?? 0, Math.max(0, Math.min(1000, rating)))
  world.health.set(personId, { ...record, baRating: next })
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
    baRating: null,
    permanent: [],
    ailmentServiceConnected: false,
    serviceDisability: 0,
    marks: [],
  }
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

/**
 * STATS PHASE 6b. CHRONIC LOW WELLBEING DRAGS THE BODY.
 *
 * The spec: "a chronic low Wellbeing slowly drags Health." The word doing
 * the work is CHRONIC — a bad month is a bad month, and it is not supposed
 * to cost anybody their health. What this reads is a life that has been
 * going badly for a long time.
 *
 * It raises the odds of falling ill; it does NOT invent an ailment or write
 * disability. The health system still owns what goes wrong and how badly,
 * which is the single-writer rule holding: this is a thumb on a scale that
 * already exists, not a second author of harm.
 */
export const MISERY_THRESHOLD = 380

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
    const injuryPerTenK =
      (risky ? 14 : 5) + Math.floor(Math.max(0, age - 50) / 8) + (roughSleeping(world, person) ? 6 : 0)
    // M-SAFETY §3. NOWHERE TO SLEEP IS A HEALTH CONDITION. Roughly triple
    // the ordinary rate of falling ill, and a real rise in injury with it —
    // this is the largest of homelessness's consequences and the reason it
    // must never be a cheap way to avoid rent.
    // Read inline rather than importing finances: health is upstream of it
    // in the graph and the import ratchet is right to refuse the edge. The
    // state is two plain lookups (same reasoning as householdCosts reading
    // the jail record inline).
    const rough = roughSleeping(world, person)
    // CHRONIC LOW WELLBEING (phase 6b). Both the current value AND the
    // BASELINE have to be under, and that pairing is what makes it chronic
    // without storing a history: the baseline is where this life settles
    // given its facts — no work, no roof, no money, nobody — so a low one
    // means the life is bad rather than the month. Somebody knocked down by
    // a single bereavement has a low value and a normal baseline, and this
    // does not touch them.
    const morale = wellbeingOf(world, person.id)
    const settled = wellbeingBaselineFor(world, person, tick)
    const ground = morale < MISERY_THRESHOLD && settled < MISERY_THRESHOLD ? 6 : 0
    const illnessPerTenK =
      3 +
      Math.floor(Math.max(0, age - 35) / 3) +
      Math.floor((1000 - person.traits.vitality) / 150) +
      (rough ? 20 : 0) +
      ground

    if (rng.chanceInTenThousand(injuryPerTenK)) {
      beginAilment(world, tick, person, 'injury', rng.nextBellInt(150, 850), rng, risky ? 'machinery' : 'mishap')
    } else if (rng.chanceInTenThousand(illnessPerTenK)) {
      beginAilment(world, tick, person, 'illness', rng.nextBellInt(150, 900), rng, 'mishap')
    }
  }
}

/** M-SAFETY §3. Nowhere to sleep, read straight off the household. */
function roughSleeping(world: World, person: Person): boolean {
  if (person.householdId === null) return false
  return world.households.get(person.householdId)?.homelessSinceTick !== null
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
  let permanent = record.permanent

  /**
   * SOME WOUNDS ARE NOT A DICE ROLL (owner, playing: "I just lost my leg in
   * war and I rested and healed right back up and now im 'back on my feet'
   * no past wounds no nothing — he lost his leg, how can he still serve and
   * fight for the country with 1 leg").
   *
   * He is right, and the model was plainly wrong. Lasting damage was
   * decided by `rng.chance(peakSeverity, 2600)` for EVERY ailment alike —
   * so an amputation was rolled against the same odds as a bad flu, and
   * about two times in three a man who lost a leg walked away with nothing
   * on his record at all.
   *
   * A limb does not grow back. Neither does a severed spinal cord or a
   * destroyed eye. These do not get a roll: they always leave what they
   * always leave, and the floor is high because the injury is.
   */
  const PERMANENT: readonly string[] = ['amputation', 'spinal-injury', 'eye-injury']
  const irreversible = PERMANENT.includes(record.ailmentKind ?? '')
  if (irreversible) {
    /**
     * THE FLOOR CLEARS THE MEDICAL BAR ON PURPOSE, and this is the second
     * half of what he asked ("how can he still serve and fight for the
     * country with 1 leg"). Service already refuses at MEDICAL_LIMIT (400)
     * — it medically discharges a serving member and turns away a
     * re-enlistment. A floor below that would have written the leg onto the
     * record and then let him deploy on it anyway, which is the same bug
     * wearing a receipt.
     *
     * So the floor is 450: past the bar with room to spare, no matter how
     * mild the roll that took the limb.
     */
    /**
     * THE FLOOR SCALES WITH WHAT WAS ACTUALLY LOST (live player, on itch:
     * "everytime I get like an eye injury I heal up and then get medically
     * discharged... Medical discharges are rare and are usually just for
     * the worst of the worst injuries").
     *
     * He is right about eyes and backs. The flat 450 was set for the
     * amputation case — past the 400 medical bar with room to spare, so a
     * one-legged man could not re-enlist — and then applied to every
     * irreversible kind alike, which made EVERY eye injury blinding and
     * EVERY spinal injury paralyzing. A limb is binary; sight and spines
     * are not.
     *
     * Scaled by the wound's own peak, deterministically — no new draw:
     *   - amputation: 450 always. A limb does not partially not grow back.
     *   - eye-injury: partial (peak < 700) floors at 250 — rated, BA-claimable,
     *     career survives; blinding (peak >= 700) floors at 450.
     *   - spinal-injury: moderate (peak < 700) floors at 300; severe at 450.
     *
     * 250 and 300 sit BELOW the 400 medical bar on purpose: those careers
     * continue, carrying the rating — which is exactly the discharge-rarity
     * the player asked for.
     */
    const blinding = record.peakSeverity >= 700
    const added =
      record.ailmentKind === 'amputation'
        ? Math.max(450, Math.floor(record.peakSeverity / 2))
        : record.ailmentKind === 'eye-injury'
          ? blinding ? 450 : 250
          : blinding ? 450 : 300
    disability = Math.min(1000, disability + added)
    if (record.ailmentServiceConnected) {
      serviceDisability = Math.min(1000, serviceDisability + added)
    }
    /**
     * YOU DO NOT LOSE THE SAME EYE TWICE.
     *
     * Seen in a probe of eight wounds: one man finished with THREE permanent
     * eye injuries, each adding its own 250 to the rating. The body does not
     * work that way — a second wound to a part already ruined is a wound to a
     * part already ruined, and the department does not rate it twice.
     *
     * So an identical permanent condition at the same site is not stacked.
     * The wound still happened, still hurt, and still shows in the record;
     * what it does not do is bill for a loss already counted.
     */
    const already = permanent.some(
      (c) => c.kind === (record.ailmentKind ?? 'injury') && c.site === record.ailmentSite,
    )
    if (already) {
      disability = Math.min(1000, disability - added)
      if (record.ailmentServiceConnected) {
        serviceDisability = Math.min(1000, serviceDisability - added)
      }
    }
    const permanentMark = markFor(record.ailment ?? 'injury', record.ailmentKind, record.ailmentSite)
    if (!marks.includes(permanentMark)) marks = [...marks, permanentMark]
    // AND THE SAME FACT IN A SHAPE THE ENGINE CAN READ. The mark above is
    // prose for the narrator; this is what `conditions.ts` derives mobility,
    // fitness ceiling, pain and job restrictions from. Without it a lost leg
    // is a sentence in an obituary and nothing else.
    if (!already) {
      permanent = [
        ...permanent,
        { kind: record.ailmentKind ?? 'injury', site: record.ailmentSite, sinceTick: world.tick },
      ]
    }
  }

  /**
   * WHAT A HEALED WOUND LEAVES BEHIND (MILITARY_DEPTH_PLAN §8).
   *
   * OWNER: "I had playthroughs where I got hurt like 8 times and only got
   * 20%." MEASURED before touching it, across two seeds and 55 years: 645
   * veterans, and a man wounded ONCE had a median rating of 0%. Wounded
   * twice, 0%. Three times, 0%. Thirty men in the whole population carried
   * any rating at all.
   *
   * THE ARITHMETIC WAS NOT THE PROBLEM — ratings already add. Three gates
   * upstream of the adding were:
   *
   *   - a FLOOR at peak 500, so anything short of a severe wound left
   *     nothing, ever. The unglamorous conditions that make up most of a
   *     real rating — hearing, backs, knees, sleep — never qualified.
   *   - a ROLL of `chance(peak, 2600)`, so a peak-700 wound had a 27% chance
   *     of leaving anything. Three in four qualifying wounds vanished.
   *   - a DIVISOR of `peak / 9`, worth about 7.8% when it did land.
   *
   * Eight wounds ran through that to roughly two marks and 16%, which the
   * board's own rounding lifted to almost exactly the 20% he reported. His
   * account reproduces from the code.
   *
   * So the floor drops to where a wound is real rather than severe, the roll
   * becomes the common case rather than the exception, and a rated wound is
   * worth at least ten points — the smallest step the department actually
   * awards. A career of wounds now adds up to something a man would
   * recognise, and NONE of it boards him out: the board reads the body now,
   * not this ledger.
   */
  if (!irreversible && record.peakSeverity >= RATEABLE_SEVERITY && rng.chance(record.peakSeverity + 250, 1_150)) {
    const added = Math.max(100, Math.floor(record.peakSeverity / 6))
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
    permanent,
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
/**
 * How bad each wound KIND can possibly be, 0-1000. The consequence ladder
 * reads severity — evacuation, the convalescence ask, mortality — so this
 * is where "blown-out hearing" stops being able to end a tour. Kinds not
 * listed carry no cap: a gunshot is as bad as the dice say it is.
 */
const WOUND_SEVERITY_CAPS: Readonly<Record<string, number>> = {
  'hearing-damage': 320,
  'concussion': 520,
  'laceration': 560,
  'animal-bite': 480,
  'heatstroke': 540,
  /**
   * FROSTBITE IS NOT A LIFE-THREATENING WOUND (owner, playing: "frostbite is
   * treated really seriously and like its something life threating and stuff
   * we need to fix that").
   *
   * At 540 it landed in the SERIOUS band — evacuated, tour over, months of
   * convalescence, a medical board reading it. Real frostbite in a fit young
   * soldier is a cold-weather injury that hurts coming back and occasionally
   * costs toes; it is not a chest wound. 360 keeps it in the walking-wounded
   * band, where it aches, marks and heals without ending a career.
   */
  'frostbite': 360,
  'smoke-inhalation': 560,
}

function woundSeverityCapFor(kind: string): number {
  return WOUND_SEVERITY_CAPS[kind] ?? 1000
}

export function inflictWound(
  world: World,
  tick: Tick,
  personId: EntityId,
  severity: number,
  context: InjuryContext,
  /**
   * A WHOLE `Rng`, NOT A `{ pick }`.
   *
   * This used to promise callers it needed nothing but `pick`, and then cast
   * `rng as never` on the way into `pickInjury` — so when the injury table
   * gained WEIGHTS (frostbite was one field accident in eight under a uniform
   * pick), the body started calling `pickWeighted` and the signature went on
   * telling every caller it was not needed. The compiler cannot catch a lie it
   * was handed. The type says what the body actually uses now.
   */
  rng: Rng,
): { kind: string; site: BodySite | null; description: string; severity: number } {
  const record = world.health.get(personId) ?? freshHealth(personId)
  const injury = pickInjury(rng, context)
  /**
   * THE KIND CAPS THE SEVERITY (live player, on itch: evacuated home and
   * decorated "for something like blown out hearing").
   *
   * Severity was drawn by the caller — a bell across 300–1000 for a combat
   * month — and the KIND was drawn here, independently. The two never met:
   * a draw could land 'hearing-damage' at severity 800, which the health
   * system then treated as a life-threatening casualty — medevac, the war
   * over, a decoration — for a wound whose real-world worst case is a
   * hearing aid. The consequence machinery was right; the pairing was
   * nonsense.
   *
   * Each kind now carries a ceiling on how bad IT can be. The caller's
   * severity stands wherever it fits under the ceiling, so gunshots and
   * blasts are untouched and the minor kinds stop masquerading as mortal.
   */
  const severityCapped = Math.min(severity, woundSeverityCapFor(injury.kind))
  severity = severityCapped
  const description = describeAilment('injury', injury.kind, injury.site)

  if (record.ailment !== null) {
    const worse = Math.min(1000, record.severity + Math.floor(severity / 2))
    world.health.set(personId, {
      ...record,
      // The NEW wound is the one being carried and the one being treated,
      // so it is the one the record names (review S8: the diagram showed
      // last month's injury — or an illness — beside this month's
      // gunshot). The severity still compounds: the body carries both.
      ailment: 'injury',
      ailmentKind: injury.kind,
      ailmentSite: injury.site,
      severity: worse,
      peakSeverity: Math.max(record.peakSeverity, worse),
      askedConvalesce: false,
      /**
       * THE BODY IS CARRYING BOTH, so provenance is carrying both.
       *
       * This branch renames the record to the NEW wound but used to inherit
       * the old flag untouched, which broke in the direction that costs a
       * man money: a combat wound landing on top of a civilian one kept
       * `false` and never reached the pension. Taking either is the honest
       * rule — the department rates the part it can attribute, and a later
       * scrape does not un-attribute a gunshot.
       */
      ailmentServiceConnected: record.ailmentServiceConnected || LINE_OF_DUTY.has(context),
    })
    return { kind: injury.kind, site: injury.site, description, severity }
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
    // Provenance is stamped NOW because only now is it knowable; the
    // pension reads what this becomes when it resolves, however many years
    // from now. See LINE_OF_DUTY for why this is no longer a bare `true`.
    ailmentServiceConnected: LINE_OF_DUTY.has(context),
  })
  return { kind: injury.kind, site: injury.site, description, severity }
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
  /**
   * A WHOLE `Rng`, NOT A `{ pick }`.
   *
   * This used to promise callers it needed nothing but `pick`, and then cast
   * `rng as never` on the way into `pickInjury` — so when the injury table
   * gained WEIGHTS (frostbite was one field accident in eight under a uniform
   * pick), the body started calling `pickWeighted` and the signature went on
   * telling every caller it was not needed. The compiler cannot catch a lie it
   * was handed. The type says what the body actually uses now.
   */
  rng: Rng,
): { kind: string; description: string } | null {
  const record = world.health.get(personId) ?? freshHealth(personId)
  if (record.ailment !== null) return null
  const kind = pickFieldIllness(rng)
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
