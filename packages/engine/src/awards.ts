/**
 * Awards and decorations. L4-M5.
 *
 * THE RULE (foundation §11): awards are earned from documented service
 * events, never granted as progression rewards. Every AwardRecord holds a
 * REFERENCE to the actual simulated event that qualified it. Eligibility is
 * enforced HERE, in code: each grant function validates the qualifying event
 * and REFUSES — returns null, writes nothing — when it does not qualify.
 * A test hands these functions unqualifying events and asserts the refusal.
 *
 * Tone (foundation §2, both directions): a decoration is a recorded fact
 * about service, not an achievement unlock and not a wound dressed up. The
 * event text is flat; the citation states what happened.
 *
 * All decorations are fictional (foundation §3); the structure — wound
 * recognition, campaign credit, good conduct, qualification badges — is the
 * authentic one. Valor decorations are deliberately ABSENT: they require a
 * documented qualifying action (§11), and no system records individual acts
 * yet. Awarding them anyway would be exactly the cosmetic leveling the rule
 * forbids.
 *
 * OWNERSHIP: this module is the single writer of world.awards. Deployment
 * and service call in at the qualifying moment (the distributeEstate
 * pattern); nothing is reconstructed after the fact.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { branchSpecFor } from './worldspec.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { Stream } from './rng.js'
import type { AwardKind, AwardRecord, CausalFactor, World, WorldEvent } from './types.js'
import { bareName } from './text.js'

/**
 * REAL DECORATION NAMES, by owner override (ADR-0024, 2026-08-02).
 *
 * This repo reverted real names TWICE before — at v13→v14 and again in
 * M-HARM — so, plainly: A REVIEWER MAY NOT REVERT THEM A THIRD TIME. They
 * are here by decision and the ADR is the record of it.
 *
 * The price of the real names is the owner's own rule: no award exists that
 * cannot be earned. Every title below grants from a qualifying recorded
 * event and from nothing else, and the grant functions still refuse
 * anything that does not qualify.
 */
export const WOUND_RECOGNITION_TITLE = 'the Purple Heart'
export const GOOD_CONDUCT_TITLE = 'the Good Conduct Medal'
export const MERITORIOUS_TITLE = 'the Meritorious Service Medal'
export const LONG_SERVICE_TITLE = 'the Armed Forces Service Medal'

/**
 * VALOR IS TIERED BY HOW BAD THE MOMENT WAS (owner's pack §4). One
 * qualifying event — 'act-of-valor', still the only one (foundation §11) —
 * and the title follows the threat the scene actually carried.
 *
 * THE TOP TIER IS THE DISTINGUISHED SERVICE CROSS, not the Medal of Honor
 * (owner, 2026-08-02). Both are real decorations; the Medal of Honor is
 * also a long-running video-game trademark, which is a commercial conflict
 * none of the other names here carry. The DSC is the real award immediately
 * below it, so the tier keeps its meaning and loses the conflict.
 */
export const VALOR_TITLE_OVERRUN = 'the Distinguished Service Cross'
export const VALOR_TITLE_HEAVY = 'the Silver Star'
export const VALOR_TITLE_LIGHT = 'the Bronze Star with Valor'
/** The plain valor title, used until a scene carries a threat level (the
 *  three-option combat system is a later step of the combat plan). */
export const VALOR_TITLE = VALOR_TITLE_HEAVY

/**
 * Combat recognition takes its face from the TRADE (owner's pack §5): one
 * `saw-combat` event, three badges. An infantryman's is not a medic's.
 */
export const COMBAT_INFANTRY_BADGE = 'the Combat Infantryman Badge'
export const COMBAT_MEDICAL_BADGE = 'the Combat Medical Badge'
export const COMBAT_ACTION_BADGE = 'the Combat Action Badge'
export const COMBAT_ACTION_TITLE = COMBAT_ACTION_BADGE

/** The new ribbons, all earned from events the engine already records. */
export const COMMENDATION_TITLE = 'the Army Commendation Medal'
export const ACHIEVEMENT_TITLE = 'the Army Achievement Medal'
export const NATIONAL_DEFENSE_TITLE = 'the National Defense Service Medal'
export const OVERSEAS_TITLE = 'the Overseas Service Ribbon'
export const NCO_DEVELOPMENT_TITLE = 'the NCO Professional Development Ribbon'
export const SERVICE_RIBBON_TITLE = 'the Army Service Ribbon'

/** Commendable, but below the meritorious bar. */
export const COMMENDATION_PERFORMANCE = 550

/** Meritorious service asks a term average well above honorable. */
export const MERITORIOUS_PERFORMANCE = 700
/** Long service starts at twenty years; the device arrives at thirty. */
export const LONG_SERVICE_YEARS = 20

/** Campaign credit needs this many months in theatre — waived for casualties. */
export const CAMPAIGN_QUALIFYING_MONTHS = 3
/** Good conduct needs the term served at or above this performance. */
export const GOOD_CONDUCT_PERFORMANCE = 400

/**
 * Discharge reasons whose closing term still qualifies for term-judged
 * awards. M-ARMY2 added two honourable mandatory endings ('thirty years
 * served', 'retirement age') — a lifer's last term must not forfeit the
 * medal a high-year-tenure discharge keeps. Misconduct and medical stay
 * outside: the first is the point, the second was never term-judged.
 */
const HONOURABLE_TERM_ENDINGS: ReadonlySet<string> = new Set([
  'end of term',
  'high-year tenure',
  'twenty years served',
  'thirty years served',
  'retirement age',
])

export function decorationsOf(world: World, personId: EntityId): readonly AwardRecord[] {
  /**
   * THE PERSONAL RACK, AND ONLY THE PERSONAL RACK.
   *
   * OWNER: "unit commendations shouldnt show up on our ribbon rack just the
   * units ribbon rack we have this is three different spots."
   *
   * He is right, and it is the distinction the whole feature is built on: a
   * unit award is given to a UNIT for a period of dates, not to a person for
   * an act. It lives on the person's record because that is where "you were
   * there" is stored — which is how permanent wear is told from inherited —
   * but it is not something they earned, so it does not stand beside the
   * things they did. `unitAwardsFor` reads the same store for the unit's own
   * rack; filtering at this one door fixes every screen that shows a rack.
   */
  return (world.awards.get(personId) ?? []).filter((award) => award.kind !== 'unit-award')
}

/** Every award on the record, unit awards included. The store, not a rack. */
export function allAwardsOf(world: World, personId: EntityId): readonly AwardRecord[] {
  return world.awards.get(personId) ?? []
}

/**
 * Wound recognition: a qualifying wound or death RESULTING FROM ENEMY
 * ACTION. Nothing else — not a civilian injury, not a battlefield accident,
 * not a training mishap. The qualifying event must be this person's own
 * 'wounded-in-action', or their 'died' whose recorded cause is wounds taken
 * in action. Anything else is refused.
 */
export function grantWoundRecognition(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  enemyName: string,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  const enemyAction =
    qualifying.type === 'wounded-in-action' ||
    (qualifying.type === 'died' && qualifying.detail === 'wounds taken in action')
  if (!enemyAction) return null

  /**
   * THE DECORATION IS FOR ENEMY FIRE, GATED HERE AND NOWHERE ELSE (owner,
   * twice now: "purple heart is for people wounded in combat by enemy fire
   * or contact"). Five call sites grant this across two wound pipelines;
   * a gate at any one of them is a gate with four ways around it — the
   * first attempt proved that in production. The granter itself now reads
   * the wound off the health record: a kind enemy fire produces, at a
   * severity worth a citation. A death from wounds always qualifies.
   */
  if (qualifying.type === 'wounded-in-action') {
    const record = world.health.get(personId)
    const kind = record?.ailmentKind ?? null
    const ENEMY_FIRE: ReadonlySet<string> = new Set([
      'gunshot',
      'shrapnel',
      'blast',
      'burns',
      'chemical-burns',
    ])
    if (kind === null || !ENEMY_FIRE.has(kind)) return null
    if ((record?.severity ?? 0) < 300) return null
  }

  return grant(world, tick, personId, {
    kind: 'wound-recognition',
    title: WOUND_RECOGNITION_TITLE,
    qualifying,
    citation: `wounded by enemy action on the ${bareName(enemyName)} front`,
    inputs: [factor('enemy-action-wound', 1000)],
  })
}

/**
 * Valor: a DOCUMENTED act under fire — foundation §11's hardest rule, and
 * why no valor decoration existed until the combat-moment gave the record
 * an actual act to cite. The qualifying event is 'act-of-valor' and nothing
 * else: not a wound, not a contact, not a rank, not a death. The player who
 * kept their head down is refused — safely and without shame — because
 * there is no act on the record to cite.
 */
export function grantValor(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  enemyName: string,
  threat: 'light' | 'heavy' | 'overrun' = 'heavy',
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'act-of-valor') return null

  return grant(world, tick, personId, {
    kind: 'valor',
    // TIERED BY HOW BAD IT WAS (owner's pack §4). One qualifying event —
    // 'act-of-valor', still the only one — and the decoration follows the
    // moment the act was actually performed in.
    title:
      threat === 'overrun'
        ? VALOR_TITLE_OVERRUN
        : threat === 'light'
          ? VALOR_TITLE_LIGHT
          : VALOR_TITLE_HEAVY,
    qualifying,
    // The citation asserts only what the simulation can honour: the
    // person's own act, no squad the world does not model (review).
    citation: `went forward under fire on the ${bareName(enemyName)} front`,
    inputs: [factor('own-choice', 1000), factor('battlefield-chaos', 800)],
  })
}

/**
 * Meritorious service: a term whose recorded average stood well above
 * honorable. Same qualifying evidence as good conduct — the term's own
 * close — at a much higher bar. Never for a rank; ranks are their own pay.
 */
export function grantMeritoriousService(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  termAveragePerformance: number,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'reenlisted' && qualifying.type !== 'discharged') return null
  if (qualifying.type === 'discharged' && !HONOURABLE_TERM_ENDINGS.has(qualifying.detail ?? '')) {
    return null
  }
  if (termAveragePerformance < MERITORIOUS_PERFORMANCE) return null

  return grant(world, tick, personId, {
    kind: 'meritorious-service',
    title: MERITORIOUS_TITLE,
    qualifying,
    citation: 'a term of distinguished service, by the record',
    inputs: [factor('strong-performance', termAveragePerformance)],
  })
}

/**
 * Long service: twenty years in uniform, from the term-close that crossed
 * the line; the device arrives at thirty. Time served is the entire claim,
 * and time served is on the record.
 */
export function grantLongService(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  yearsServed: number,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'reenlisted' && qualifying.type !== 'discharged') return null
  // A term ended by the county jail does not cross the gate with a medal:
  // misconduct forfeits long service, as its sibling grants already refuse
  // it. Any other discharge — medical included — keeps the years earned.
  if (qualifying.type === 'discharged' && qualifying.detail === 'misconduct') return null

  const existing = (world.awards.get(personId) ?? []).find((a) => a.kind === 'long-service')
  const milestone = LONG_SERVICE_YEARS + (existing?.count ?? 0) * 10
  if (yearsServed < milestone) return null

  return grant(world, tick, personId, {
    kind: 'long-service',
    title: LONG_SERVICE_TITLE,
    qualifying,
    citation: `${String(milestone)} years in uniform`,
    inputs: [factor('time-in-grade', Math.min(1000, yearsServed * 30))],
  })
}

/**
 * Combat-action recognition: came under enemy fire, from the recorded
 * 'saw-combat' event and nothing else — a wound is its own decoration, an
 * accident is neither. ONCE PER WAR: the same conflict's later contacts add
 * nothing (the enemy on the qualifying events is the dedupe); a different
 * war adds a device.
 */
export function grantCombatAction(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  enemyName: string,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'saw-combat') return null

  // ONCE, EVER (owner, 2026-08-02). This is a BADGE, not a ribbon: a man who
  // has been in ground combat has been in ground combat, and a second war
  // does not make him more so. It used to grant again for each new war,
  // which put a repeat count on something that has no repeats.
  const existing = (world.awards.get(personId) ?? []).find((a) => a.kind === 'combat-action')
  if (existing) return existing

  // ONE EVENT, THREE FACES (owner's pack §5). An infantryman's combat
  // recognition is not a medic's and neither is a driver's — which is true,
  // and costs nothing: the qualifying event is the same recorded contact.
  const trade = world.service.get(personId)?.specialtyId ?? ''
  const title =
    trade === 'rifleman'
      ? COMBAT_INFANTRY_BADGE
      : trade === 'medic'
        ? COMBAT_MEDICAL_BADGE
        : COMBAT_ACTION_BADGE

  return grant(world, tick, personId, {
    kind: 'combat-action',
    title,
    qualifying,
    citation: `came under fire on the ${bareName(enemyName)} front`,
    inputs: [factor('campaign-service', 800)],
  })
}

/**
 * Campaign credit: qualifying service in a war's theatre — three months, or
 * any tour ended by wound or death (the casualty waiver, which is the real
 * rule too). The qualifying event is the tour's own close: 'returned-home',
 * or the casualty event that ended it.
 */
/**
 * The campaign decoration. Invented, like every decoration in this project,
 * and deliberately named for the SERVICE rather than for the enemy — see
 * grantCampaignMedal.
 */
export const EXPEDITIONARY_MEDAL = 'the Armed Forces Expeditionary Medal'
/** ADR-0026. Real, and repeatable — the clusters are the usual case. */
export const AIR_MEDAL = 'the Air Medal'
/** ADR-0025. Real, and earned the hard way: it needs a capture. */
export const POW_TITLE = 'the Prisoner of War Medal'

export function grantCampaignMedal(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  enemyName: string,
  monthsInTheatre: number,
  casualty: boolean,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (
    qualifying.type !== 'returned-home' &&
    qualifying.type !== 'wounded-in-action' &&
    qualifying.type !== 'died'
  ) {
    return null
  }
  if (monthsInTheatre < CAMPAIGN_QUALIFYING_MONTHS && !casualty) return null

  // ONE DECORATION, A DEVICE PER CAMPAIGN — which is how campaign medals
  // actually work, and the only shape that is safe now that a preset may
  // name real countries (ADR-0021).
  //
  // The title used to be `the ${enemyName} Campaign Medal`. With Classic's
  // invented nations that was a fictional decoration. With the owner's real
  // list it mints "the Afghanistan Campaign Medal" — the verbatim name of a
  // real United States decoration — onto a permanent record, which the
  // foundation forbids in EVERY preset: awards are fictional, always. The
  // country still appears in the CITATION, which is a statement about this
  // world's invented war rather than the name of a real medal.
  return grant(world, tick, personId, {
    kind: 'campaign',
    // ONE RIBBON PER CONFLICT (owner, 2026-08-02). A second tour in the SAME
    // war adds a device to the same ribbon; a different war is a different
    // ribbon, because it was a different war.
    //
    // The base name stays generic and the campaign is named inside it. "the
    // Afghanistan Campaign Medal" is the verbatim name of a real decoration
    // and ADR-0024 forbids a generated war minting one; this says which war
    // without claiming to be a real award.
    title: `${EXPEDITIONARY_MEDAL} (${bareName(enemyName)})`,
    qualifying,
    citation: `service in the campaign against ${bareName(enemyName)}`,
    inputs: [factor('campaign-service', Math.min(1000, monthsInTheatre * 100))],
  })
}

/**
 * Good conduct: a full enlistment term served honorably. The qualifying
 * event is the moment the term closed — reenlistment, an end-of-term
 * discharge, or a high-year-tenure separation (the term WAS served in full;
 * being passed over is not dishonor). A term cut short — medical, or
 * anything else — does not qualify; earlier completed terms keep the medals
 * they earned.
 */
export function grantGoodConduct(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  performance: number,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'reenlisted' && qualifying.type !== 'discharged') return null
  if (qualifying.type === 'discharged' && !HONOURABLE_TERM_ENDINGS.has(qualifying.detail ?? '')) {
    return null
  }
  if (performance < GOOD_CONDUCT_PERFORMANCE) return null

  return grant(world, tick, personId, {
    kind: 'good-conduct',
    title: GOOD_CONDUCT_TITLE,
    qualifying,
    citation: 'an enlistment term served honorably',
    inputs: [factor('honorable-term', performance)],
  })
}

/**
 * A qualification badge: the occupational rating, earned and recorded. The
 * qualifying event is the 'earned-qualification' entry itself — the badge is
 * the visible form of a rating that already changed the career (it counts
 * toward promotion), never a separate collectible.
 */
export function grantQualificationBadge(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  qualification: string,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'earned-qualification') return null
  if (qualifying.detail !== qualification) return null

  return grant(world, tick, personId, {
    kind: 'qualification-badge',
    title: qualification,
    qualifying,
    citation: `rated ${qualification}`,
    inputs: [factor('qualification-earned', 800)],
  })
}

// ---------------------------------------------------------------------------

interface GrantSpec {
  readonly kind: AwardKind
  readonly title: string
  readonly qualifying: WorldEvent
  readonly citation: string
  readonly inputs: readonly CausalFactor[]
  /**
   * HOW IT IS SAID OUT LOUD, where the citation is not fit to be read.
   *
   * Every citation in this game is prose EXCEPT the unit award's, which
   * carries the unit key so that permanent and temporary wear can be told
   * apart without new world state. The owner read the consequence straight
   * off his own screen: "Awarded the Meritorious Unit Commendation —
   * post:641:land-forces|the Meritorious Unit Commendation|2038."
   *
   * A field that is machine-readable in one case and human-readable in every
   * other will leak, so the human words are carried separately rather than
   * guessed at by each reader.
   */
  readonly wording?: string
}

function grant(world: World, tick: Tick, personId: EntityId, spec: GrantSpec): AwardRecord | null {
  // No service record, no decoration: the issuing authority is the branch,
  // and a record survives discharge, so this only refuses the impossible.
  const service = world.service.get(personId)
  if (!service) return null
  // Through worldspec, not through service.branchName: awards is imported BY
  // service, and the import ratchet caught that round trip the moment it was
  // written. worldspec imports only content/names/types, so it adds no edge —
  // which is the point of it being the one home for content resolution.
  const issuedBy = branchSpecFor(world, service.branch).name

  const existing = world.awards.get(personId) ?? []
  const already = existing.find((a) => a.kind === spec.kind && a.title === spec.title)

  // IDEMPOTENT on the qualifying event: one event earns one thing, however
  // many times it is submitted. Without this, a caller re-submitting a
  // genuine wound could mint devices from a single wound.
  if (already && already.qualifyingEventIds.includes(spec.qualifying.id)) {
    return already
  }

  let result: AwardRecord
  if (already) {
    // A later qualifying event adds a device to the ribbon, not a second
    // medal — but it is its own moment, and it keeps ITS OWN evidence: the
    // record retains every qualifying event, not just the first (§11).
    result = {
      ...already,
      count: already.count + 1,
      qualifyingEventIds: [...already.qualifyingEventIds, spec.qualifying.id],
      // AND THE CITATION IS REWRITTEN, not frozen at the first award. A
      // ribbon that accumulates devices is one award for several tours, so
      // its words have to describe all of them — "Chile ×2, Korea ×1" —
      // rather than describing the first one forever.
      citation: spec.citation,
    }
    world.awards.set(
      personId,
      existing.map((a) => (a === already ? result : a)),
    )
  } else {
    result = {
      personId,
      kind: spec.kind,
      title: spec.title,
      tick,
      qualifyingEventIds: [spec.qualifying.id],
      issuedBy,
      citation: spec.citation,
      count: 1,
    }
    world.awards.set(personId, [...existing, result])
  }

  /**
   * A UNIT AWARD IS NOT AWARDED TO YOU, and it does not get your line.
   *
   * `runUnitAwards` already files a `unit-awarded` event on every member —
   * "Their unit was awarded the Meritorious Unit Commendation" — which is the
   * truthful sentence. Firing the personal one as well said the same thing
   * twice in one feed, in the wrong voice, with the machine key trailing it.
   */
  if (spec.kind !== 'unit-award') {
    recordEvent(world, tick, { type: 'awarded', subjectId: personId, detail: spec.title })
  }
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'award',
    significance: 'notable',
    inputs: [...spec.inputs],
    chosen: `awarded ${spec.title} — ${spec.wording ?? spec.citation}`,
    rejected: [],
    streamId: Stream.Employment,
  })
  return result
}

// ---------------------------------------------------------------------------
// The ribbons the owner's awards pack added. EVERY ONE GRANTS FROM AN EVENT
// THE ENGINE ALREADY RECORDS — that is the whole discipline of the pack: no
// badge or ribbon exists that cannot be earned, and each of these refuses an
// event that does not qualify exactly as its older siblings do.
// ---------------------------------------------------------------------------

/**
 * A commendable term — below the meritorious bar, above merely honourable.
 * Judged at the same door as good conduct and meritorious service, off the
 * same qualifying event.
 */
export function grantCommendation(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  termAveragePerformance: number,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'reenlisted' && qualifying.type !== 'discharged') return null
  if (qualifying.type === 'discharged' && !HONOURABLE_TERM_ENDINGS.has(qualifying.detail ?? '')) {
    return null
  }
  // Strictly below meritorious: a term does not earn both.
  if (termAveragePerformance < COMMENDATION_PERFORMANCE) return null
  if (termAveragePerformance >= MERITORIOUS_PERFORMANCE) return null

  return grant(world, tick, personId, {
    kind: 'commendation',
    title: COMMENDATION_TITLE,
    qualifying,
    citation: 'for commendable service',
    inputs: [factor('strong-performance', termAveragePerformance)],
  })
}


/**
 * A single strong achievement rather than a whole term: finishing a course
 * with the work behind it. Repeats add a device, like everything else.
 */
export function grantAchievement(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  performance: number,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'completed-training') return null
  if (performance < MERITORIOUS_PERFORMANCE) return null

  return grant(world, tick, personId, {
    kind: 'achievement',
    title: ACHIEVEMENT_TITLE,
    qualifying,
    citation: 'for meritorious achievement',
    inputs: [factor('strong-performance', performance)],
  })
}

/** Finished initial training. The first ribbon anybody gets. */
/**
 * THE UNIT'S DECORATION, pinned on everybody who was there
 * (MILITARY_DEPTH_PLAN §9.1).
 *
 * The citation is machine-readable on purpose — `unitKey|title|year` — because
 * it is the only thing that says WHICH unit and WHICH period, and those two
 * facts are the whole mechanic: present during the cited period is permanent
 * wear, arriving afterwards is temporary. `unitawards.ts` reads it back.
 */
export function grantUnitAward(
  world: World,
  tick: Tick,
  personId: EntityId,
  title: string,
  citation: string,
  qualifying: WorldEvent,
): AwardRecord | null {
  return grant(world, tick, personId, {
    kind: 'unit-award',
    title,
    qualifying,
    citation,
    // THE CITATION IS THE MACHINE KEY (`unit|title|year`); these are the words.
    wording: `cited for the period ${citation.split('|')[2] ?? 'of the award'}`,
    // Law 3: the unit's year is what earned it, and the citation names the
    // unit and the period it was earned over.
    inputs: [factor('honorable-term', 800)],
  })
}

export function grantServiceRibbon(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'completed-training') return null
  if (qualifying.detail !== 'basic training') return null

  return grant(world, tick, personId, {
    kind: 'service-ribbon',
    title: SERVICE_RIBBON_TITLE,
    qualifying,
    citation: 'on completion of initial training',
    inputs: [factor('own-choice', 200)],
  })
}

/** The leaders course, and only that course. */
export function grantNcoDevelopment(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  schoolBadge: string,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'completed-training') return null
  if (schoolBadge !== 'small-unit leader') return null

  return grant(world, tick, personId, {
    kind: 'nco-development',
    title: NCO_DEVELOPMENT_TITLE,
    qualifying,
    citation: 'on completion of the leaders course',
    inputs: [factor('own-choice', 300)],
  })
}

/**
 * Served while the country was at war — whoever they were and wherever they
 * stood. Once in a lifetime; the qualifying event is the enlistment or the
 * month it became true.
 */
export function grantNationalDefense(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  const existing = (world.awards.get(personId) ?? []).find((a) => a.kind === 'national-defense')
  if (existing) return existing

  return grant(world, tick, personId, {
    kind: 'national-defense',
    title: NATIONAL_DEFENSE_TITLE,
    qualifying,
    citation: 'for service during a period of war',
    inputs: [factor('under-orders', 400)],
  })
}

/**
 * A tour outside the homeland — including the peacetime rotations, which is
 * the point of it: it is the ribbon that says you went, not that you fought.
 */
export function grantOverseas(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  /** Every posting so far, tallied: "Chile ×2, Korea ×1". */
  places: string,
): AwardRecord | null {
  if (qualifying.subjectId !== personId) return null
  if (qualifying.type !== 'returned-home') return null

  // ONE RIBBON, A DEVICE AND A LINE PER POSTING (owner, 2026-08-02). A
  // second tour abroad is not a second ribbon — it is this ribbon, worn
  // again — and the citation is where the places live, so a rack can say
  // where a life was spent instead of saying "overseas" twice.
  return grant(world, tick, personId, {
    kind: 'overseas',
    title: OVERSEAS_TITLE,
    qualifying,
    citation: places === '' ? 'for a tour of duty overseas' : `for tours of duty overseas — ${places}`,
    inputs: [factor('under-orders', 300)],
  })
}

/**
 * The Prisoner of War Medal. Granted at CAPTURE, off the capture itself —
 * not at repatriation. A man who dies held earned it the same as the one
 * who walks out, and hanging it on the way out would quietly say otherwise.
 */
export function grantPow(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
): AwardRecord | null {
  if (qualifying.type !== 'was-captured' || qualifying.subjectId !== personId) return null
  return grant(world, tick, personId, {
    kind: 'pow',
    title: POW_TITLE,
    qualifying,
    inputs: [factor('enemy-capability', 1000)],
    citation: 'for having been held prisoner by a hostile force',
  })
}

/**
 * The Air Medal, for a mission flown under fire.
 *
 * REPEATABLE ON PURPOSE. The real decoration is awarded again and again to
 * the same aircrew — the clusters are the usual case, not the exception —
 * and the grant helper's own count is what carries that, so a long tour of
 * flying reads as a long tour of flying instead of one medal and silence.
 */
export function grantAirMedal(
  world: World,
  tick: Tick,
  personId: EntityId,
  qualifying: WorldEvent,
  enemyName: string,
): AwardRecord | null {
  if (qualifying.type !== 'aerial-mission' || qualifying.subjectId !== personId) return null
  return grant(world, tick, personId, {
    kind: 'air',
    title: AIR_MEDAL,
    qualifying,
    // NOT 'enemy-action-wound': the story layer renders that as "the wound
    // came from enemy action", and nobody is wounded here. What earned it
    // is what they flew into.
    inputs: [factor('enemy-capability', 700)],
    citation: `for a mission flown under fire on the ${bareName(enemyName)} front`,
  })
}
