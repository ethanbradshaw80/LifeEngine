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
