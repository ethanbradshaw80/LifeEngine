/**
 * Helpers for appending events and causal records.
 *
 * The distinction matters (docs/CAUSAL_RECORDS.md §7):
 *   - An EVENT says WHAT happened. Cheap, recorded liberally.
 *   - A CAUSAL RECORD says WHY a decision was made. Recorded only for the
 *     decision types in scope, at the moment the decision is taken.
 *
 * Causal records are never reconstructed after the fact. Once the decision has
 * been made, the inputs that drove it are gone unless they were written down
 * here and now.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import type {
  CausalFactor,
  CausalRecord,
  DecisionType,
  EventType,
  Significance,
  World,
  WorldEvent,
} from './types.js'


interface EventSpec {
  readonly type: EventType
  readonly subjectId: EntityId
  readonly otherId?: EntityId
  readonly placeId?: EntityId
  readonly detail?: string
}

export function recordEvent(world: World, tick: Tick, spec: EventSpec): WorldEvent {
  const event: WorldEvent = {
    id: world.nextEventId,
    tick,
    type: spec.type,
    subjectId: spec.subjectId,
    otherId: spec.otherId ?? null,
    placeId: spec.placeId ?? null,
    detail: spec.detail ?? null,
  }
  world.nextEventId += 1
  world.events.push(event)
  return event
}

interface DecisionSpec {
  readonly subjectId: EntityId
  readonly decision: DecisionType
  readonly significance: Significance
  readonly inputs: readonly CausalFactor[]
  readonly chosen: string
  readonly rejected?: readonly string[]
  readonly streamId: number
}

export function recordDecision(world: World, tick: Tick, spec: DecisionSpec): CausalRecord {
  // Rejected alternatives are kept only for weightier decisions. Storing them
  // for every routine choice would dominate the record with noise nobody asks
  // about.
  const keepRejected = spec.significance === 'major' || spec.significance === 'defining'

  const record: CausalRecord = {
    id: world.nextCausalRecordId,
    tick,
    subjectId: spec.subjectId,
    decision: spec.decision,
    significance: spec.significance,
    inputs: spec.inputs,
    chosen: spec.chosen,
    rejected: keepRejected ? (spec.rejected ?? []) : [],
    streamId: spec.streamId,
  }
  world.nextCausalRecordId += 1
  world.causalRecords.push(record)
  return record
}

export function factor(
  id: CausalFactor['factor'],
  weight: number,
  referencedEntityId: EntityId | null = null,
): CausalFactor {
  return { factor: id, weight, referencedEntityId }
}

export function eventsFor(world: World, personId: EntityId): WorldEvent[] {
  return world.events.filter((e) => e.subjectId === personId || e.otherId === personId)
}

export function decisionsFor(world: World, personId: EntityId): CausalRecord[] {
  return world.causalRecords.filter((r) => r.subjectId === personId)
}

/**
 * Which decision type, if any, explains an event of this type.
 *
 * Events say what happened; causal records say why a decision was made. Not
 * every event has a decision behind it — being born, or a friendship lapsing,
 * are things that happen to a person rather than choices they made. Those
 * correctly have no explanation, and the UI must say so rather than invent one.
 */
const EVENT_EXPLAINED_BY: Partial<Record<EventType, DecisionType>> = {
  hired: 'employment-change',
  'left-job': 'employment-change',
  'left-home': 'household-formation',
  'moved-in-together': 'household-formation',
  'moved-house': 'move',
  died: 'death',
}

/**
 * The causal record behind an event, or null if the event was not a decision.
 *
 * Matched on subject and tick — a decision and the event it produced are always
 * written in the same tick by the same system.
 */
export function decisionForEvent(world: World, event: WorldEvent): CausalRecord | null {
  const decision = EVENT_EXPLAINED_BY[event.type]
  if (decision === undefined) return null

  for (const record of world.causalRecords) {
    if (record.tick === event.tick && record.subjectId === event.subjectId && record.decision === decision) {
      return record
    }
  }
  return null
}

/** People whose parents include this person, in id order. */
export function childrenOf(world: World, personId: EntityId): EntityId[] {
  const children: EntityId[] = []
  for (const person of world.people.values()) {
    if (person.parentIds.includes(personId)) children.push(person.id)
  }
  children.sort((a, b) => a - b)
  return children
}
