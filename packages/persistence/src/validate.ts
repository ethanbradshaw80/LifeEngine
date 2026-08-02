/**
 * Runtime validation of loaded saves.
 *
 * R-23: TypeScript checks nothing at runtime. A save read from IndexedDB — or
 * later from a server — is untyped data, and `data as SaveFile` asserts
 * absolutely nothing. It will happily accept a truncated file, an object from
 * an older build, or arbitrary text someone pasted into devtools.
 *
 * Every field is therefore checked explicitly. This is the boundary; there is
 * no cast anywhere in this file.
 */

import { SaveError } from './schema.js'

export function requireObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SaveError(`${what} is not an object`, 'not-an-object')
  }
  return value as Record<string, unknown>
}

export function requireField(
  object: Record<string, unknown>,
  field: string,
  what: string,
): unknown {
  if (!(field in object)) {
    throw new SaveError(`${what} is missing "${field}"`, 'missing-field')
  }
  return object[field]
}

export function requireNumber(
  object: Record<string, unknown>,
  field: string,
  what: string,
): number {
  const value = requireField(object, field, what)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SaveError(`${what}.${field} is not a finite number`, 'bad-type')
  }
  return value
}

export function requireInteger(
  object: Record<string, unknown>,
  field: string,
  what: string,
): number {
  const value = requireNumber(object, field, what)
  if (!Number.isInteger(value)) {
    throw new SaveError(`${what}.${field} is not an integer`, 'bad-type')
  }
  return value
}

/**
 * A string field that MAY be absent — a field added by a later schema and
 * read from an older save. Returns null rather than throwing, so the caller
 * supplies the default. Every other header field goes through this module's
 * require* helpers (R-23); the optional ones belong here too rather than as
 * an inline typeof at the call site.
 */
export function optionalString(source: Record<string, unknown>, field: string): string | null {
  const value = source[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function requireString(
  object: Record<string, unknown>,
  field: string,
  what: string,
): string {
  const value = requireField(object, field, what)
  if (typeof value !== 'string') {
    throw new SaveError(`${what}.${field} is not a string`, 'bad-type')
  }
  return value
}

export function requireArray(
  object: Record<string, unknown>,
  field: string,
  what: string,
): unknown[] {
  const value = requireField(object, field, what)
  if (!Array.isArray(value)) {
    throw new SaveError(`${what}.${field} is not an array`, 'bad-type')
  }
  return value
}

/**
 * Every array the world body is expected to carry. Checked by name so a save
 * missing an entire domain is refused rather than silently loading a world
 * with, say, no households in it.
 */
export const REQUIRED_WORLD_ARRAYS = [
  'places',
  'people',
  'households',
  'education',
  'employment',
  'relationships',
  'events',
  'causalRecords',
] as const

export function validateWorldBody(value: unknown): Record<string, unknown> {
  const body = requireObject(value, 'save.world')

  requireInteger(body, 'nextEntityId', 'save.world')
  requireInteger(body, 'nextEventId', 'save.world')
  requireInteger(body, 'nextCausalRecordId', 'save.world')

  const town = requireObject(requireField(body, 'town', 'save.world'), 'save.world.town')
  requireString(town, 'name', 'save.world.town')

  for (const name of REQUIRED_WORLD_ARRAYS) {
    requireArray(body, name, 'save.world')
  }

  // v4: the player block. Its inner shape is trusted post-checksum, but its
  // presence is structural — a world without it cannot be hydrated.
  requireObject(requireField(body, 'player', 'save.world'), 'save.world.player')

  return body
}
