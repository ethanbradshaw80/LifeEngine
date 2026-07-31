/**
 * Canonical JSON encoding and a corruption checksum.
 *
 * Two things this handles that plain JSON.stringify does not:
 *
 * 1. KEY ORDER. JSON.stringify follows insertion order, so two structurally
 *    identical saves built in different orders produce different text and
 *    therefore different checksums. Keys are sorted here.
 *
 * 2. BIGINT. JSON.stringify THROWS on a BigInt rather than failing quietly,
 *    which is helpful, but it still has to be handled. Money is a Number today
 *    (exact to about $90 trillion in cents), but ADR-0008 requires BigInt for
 *    aggregate economy figures at Layer 4. Supporting it now means the format
 *    does not need a migration when that arrives.
 */

/** Marker for an encoded BigInt. Chosen to be unlikely in real data. */
const BIGINT_TAG = '$bigint'

interface EncodedBigInt {
  readonly [BIGINT_TAG]: string
}

function isEncodedBigInt(value: object): value is EncodedBigInt {
  return BIGINT_TAG in value && typeof (value as Record<string, unknown>)[BIGINT_TAG] === 'string'
}

/** JSON text with object keys sorted and BigInt encoded. Stable and comparable. */
export function canonicalJson(value: unknown): string {
  if (typeof value === 'bigint') {
    return JSON.stringify({ [BIGINT_TAG]: value.toString() })
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

/** Reverse the BigInt encoding after JSON.parse. */
export function reviveBigInts(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(reviveBigInts)
  if (isEncodedBigInt(value)) return BigInt(value[BIGINT_TAG])

  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = reviveBigInts(entry)
  }
  return result
}

/**
 * FNV-1a over the canonical text, as 8 hex characters.
 *
 * This detects CORRUPTION — a truncated write, a flipped bit, a half-finished
 * IndexedDB transaction. It is deliberately NOT a security measure: anyone can
 * recompute it after editing a save. Save tampering barely matters for a
 * single-player life simulation (ADR-0010), and pretending otherwise would be
 * security theatre.
 */
export function checksumOf(value: unknown): string {
  const text = canonicalJson(value)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
