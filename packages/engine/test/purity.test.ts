/**
 * Enforces the two rules that cannot be retrofitted:
 *
 *   1. The engine imports from @life-engine/shared and nothing else (ADR-0003).
 *   2. The engine contains no non-deterministic construct (docs/DETERMINISM.md §5).
 *
 * These are checked by machine because a human reviewer — especially one who is
 * still learning — will not reliably catch a stray Math.random() in a diff. A
 * single one of these breaks reproducibility silently, and the bug surfaces
 * months later as "this save won't load the same way twice".
 *
 * Reading files here is fine: this is a TEST, not engine code. The purity rule
 * constrains what ships in src/, not what verifies it.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENGINE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC_DIR = join(ENGINE_ROOT, 'src')

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      found.push(full)
    }
  }
  return found
}

/**
 * Strip comments so that documentation mentioning a banned construct does not
 * trip the check. Without this, the header of src/index.ts — which lists the
 * banned APIs by name — would fail its own test.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

interface BannedConstruct {
  readonly pattern: RegExp
  readonly reason: string
}

const BANNED: readonly BannedConstruct[] = [
  { pattern: /\bMath\s*\.\s*random\s*\(/, reason: 'unseeded randomness — use the seeded RNG service' },
  { pattern: /\bDate\s*\.\s*now\s*\(/, reason: 'wall clock — use the simulation clock' },
  { pattern: /\bnew\s+Date\s*\(/, reason: 'wall clock — use the simulation clock' },
  { pattern: /\bperformance\s*\.\s*now\s*\(/, reason: 'wall clock — use the simulation clock' },
  { pattern: /\bcrypto\s*\.\s*randomUUID\s*\(/, reason: 'non-deterministic id — use the sequential allocator' },
  { pattern: /\bcrypto\s*\.\s*getRandomValues\s*\(/, reason: 'non-deterministic — use the seeded RNG service' },
  {
    pattern: /\bMath\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|exp|log|log2|log10|pow|cbrt|sinh|cosh|tanh)\s*\(/,
    reason:
      'ECMAScript leaves precision implementation-defined — results can differ BETWEEN BROWSERS. Use integer maths or a lookup table',
  },
  { pattern: /\bsetTimeout\s*\(/, reason: 'timing-dependent — the tick is synchronous' },
  { pattern: /\bsetInterval\s*\(/, reason: 'timing-dependent — the tick is synchronous' },
  { pattern: /\bqueueMicrotask\s*\(/, reason: 'timing-dependent — the tick is synchronous' },
  { pattern: /\basync\s+function\b/, reason: 'non-deterministic interleaving — the tick is synchronous' },
  { pattern: /\bawait\s+/, reason: 'non-deterministic interleaving — the tick is synchronous' },
  { pattern: /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+/, reason: 'for...in ordering is unreliable — use a Map or an explicit array' },
  { pattern: /\.toLocaleString\s*\(/, reason: 'locale-dependent — format in the UI, not the engine' },
  { pattern: /\.toLocaleDateString\s*\(/, reason: 'locale-dependent — format in the UI, not the engine' },
  { pattern: /\bIntl\s*\./, reason: 'locale-dependent — format in the UI, not the engine' },
  { pattern: /\bwindow\s*\./, reason: 'browser-only — the engine must also run in Node and on a server' },
  { pattern: /\bdocument\s*\./, reason: 'browser-only — the engine must also run in Node and on a server' },
  { pattern: /\blocalStorage\b/, reason: 'I/O — the engine performs none' },
  { pattern: /\bindexedDB\b/, reason: 'I/O — the engine performs none' },
  { pattern: /\bfetch\s*\(/, reason: 'I/O — the engine performs none' },
]

/** Only these may be imported. Relative paths are checked separately. */
const ALLOWED_PACKAGES = new Set(['@life-engine/shared'])

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g

describe('engine purity (ADR-0003)', () => {
  const files = sourceFiles(SRC_DIR)

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [relative(ENGINE_ROOT, f), f] as const))(
    '%s imports only @life-engine/shared',
    (_label, file) => {
      const code = stripComments(readFileSync(file, 'utf8'))
      const offenders: string[] = []

      for (const match of code.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1]
        if (specifier === undefined) continue
        const isRelative = specifier.startsWith('.')
        if (!isRelative && !ALLOWED_PACKAGES.has(specifier)) {
          offenders.push(specifier)
        }
      }

      expect(offenders, `forbidden import(s): ${offenders.join(', ')}`).toEqual([])
    },
  )

  it.each(files.map((f) => [relative(ENGINE_ROOT, f), f] as const))(
    '%s contains no non-deterministic construct',
    (_label, file) => {
      const code = stripComments(readFileSync(file, 'utf8'))
      const violations: string[] = []

      for (const { pattern, reason } of BANNED) {
        const match = pattern.exec(code)
        if (match) {
          const line = code.slice(0, match.index).split('\n').length
          violations.push(`line ${line}: "${match[0].trim()}" — ${reason}`)
        }
      }

      expect(violations, `\n  ${violations.join('\n  ')}\n`).toEqual([])
    },
  )
})
