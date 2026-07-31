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
import { BRANCH_NAMES } from './content.js'
import type { ServiceBranch } from './content.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { Stream } from './rng.js'
import type { AwardKind, AwardRecord, CausalFactor, World, WorldEvent } from './types.js'

/** The wound decoration's name. One per lifetime; later wounds add devices.
 *  Deliberately not triumphal — a laurel is a victory crown, and a wound
 *  decoration recognizes something done TO you (reviewer, tone rule). */
export const WOUND_RECOGNITION_TITLE = 'the Crimson Band'
export const GOOD_CONDUCT_TITLE = 'the Faithful Service Medal'

/** Campaign credit needs this many months in theatre — waived for casualties. */
export const CAMPAIGN_QUALIFYING_MONTHS = 3
/** Good conduct needs the term served at or above this performance. */
export const GOOD_CONDUCT_PERFORMANCE = 400

export function decorationsOf(world: World, personId: EntityId): readonly AwardRecord[] {
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

  return grant(world, tick, personId, {
    kind: 'wound-recognition',
    title: WOUND_RECOGNITION_TITLE,
    qualifying,
    citation: `wounded by enemy action on the ${enemyName} front`,
    inputs: [factor('enemy-action-wound', 1000)],
  })
}

/**
 * Campaign credit: qualifying service in a war's theatre — three months, or
 * any tour ended by wound or death (the casualty waiver, which is the real
 * rule too). The qualifying event is the tour's own close: 'returned-home',
 * or the casualty event that ended it.
 */
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

  return grant(world, tick, personId, {
    kind: 'campaign',
    title: `the ${enemyName} Campaign Medal`,
    qualifying,
    citation: `service in the campaign against ${enemyName}`,
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
  if (
    qualifying.type === 'discharged' &&
    qualifying.detail !== 'end of term' &&
    qualifying.detail !== 'high-year tenure'
  ) {
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
}

function grant(world: World, tick: Tick, personId: EntityId, spec: GrantSpec): AwardRecord | null {
  // No service record, no decoration: the issuing authority is the branch,
  // and a record survives discharge, so this only refuses the impossible.
  const service = world.service.get(personId)
  if (!service) return null
  const issuedBy = BRANCH_NAMES[service.branch as ServiceBranch] ?? service.branch

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

  recordEvent(world, tick, { type: 'awarded', subjectId: personId, detail: spec.title })
  recordDecision(world, tick, {
    subjectId: personId,
    decision: 'award',
    significance: 'notable',
    inputs: [...spec.inputs],
    chosen: `awarded ${spec.title} — ${spec.citation}`,
    rejected: [],
    streamId: Stream.Employment,
  })
  return result
}
