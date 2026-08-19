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
 * BLANK OUT EVERYTHING THAT IS NOT CODE — comments AND string literals.
 *
 * WHY COMMENTS: documentation that mentions a banned construct must not trip
 * the check. The header of src/index.ts lists the banned APIs by name and
 * would otherwise fail its own test.
 *
 * WHY STRINGS (owner, 2026-08-18: "make the scanner skip string literals"):
 * the engine now carries hundreds of lines of written PROSE in its scene
 * files, and prose contains ordinary English. A scene reading "at the
 * second-floor window. It has been there twice" was reported as browser API
 * access, because the old check was a substring match that could not tell a
 * sentence from a property lookup. "document.", "process." and "performance."
 * are all normal English followed by a full stop, and there are several
 * hundred more scenes to write.
 *
 * HOW: a single left-to-right pass, because the regex pair this replaced had
 * the mirror-image bug — it stripped `//` inside a string as though it began
 * a comment, so any URL in engine source silently deleted the rest of its
 * line FROM THE SCAN. One state machine gets both right.
 *
 * WHAT IS PRESERVED. Newlines survive, so the line numbers in a failure
 * report still point at the real line. And a template literal keeps its
 * `${...}` expressions, which ARE code: `${Date.now()}` must still be caught.
 *
 * THE KNOWN LIMIT: a regex literal containing a quote — /don't/ — would be
 * read as opening a string. Engine source has none, and the self-test below
 * exists precisely because a scanner that silently stops scanning is worse
 * than no scanner at all.
 */
export function stripNonCode(source: string, keepStrings = false): string {
  const out: string[] = []
  const blank = (ch: string): string => (ch === '\n' ? '\n' : ' ')
  /** Brace depth at each `${` we are currently inside. */
  const templateExpr: number[] = []
  let depth = 0
  let mode: 'code' | 'line' | 'block' | 'single' | 'double' | 'template' = 'code'
  let i = 0

  while (i < source.length) {
    const ch = source[i] ?? ''
    const next = source[i + 1] ?? ''

    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; out.push(' ', ' '); i += 2; continue }
      if (ch === '/' && next === '*') { mode = 'block'; out.push(' ', ' '); i += 2; continue }
      if (ch === "'") { mode = 'single'; out.push(ch); i += 1; continue }
      if (ch === '"') { mode = 'double'; out.push(ch); i += 1; continue }
      if (ch === '`') { mode = 'template'; out.push(ch); i += 1; continue }
      if (ch === '{') depth += 1
      if (ch === '}') {
        /**
         * CLOSE FIRST, THEN COMPARE — the off-by-one that made this scanner
         * dangerous rather than merely wrong.
         *
         * `${` records the depth OUTSIDE the expression and then enters it,
         * so inside the braces the depth is one greater. Comparing the
         * pre-decrement depth against the recorded one therefore never
         * matched, and a template like
         * `${event.detail ?? 'trouble off duty'}` never closed. The scanner
         * then read the whole rest of the file in the wrong mode: comments
         * stopped being recognised, and `new Date(` sitting in a COMMENT was
         * reported as a real violation while genuine code went unread.
         */
        depth -= 1
        const open = templateExpr[templateExpr.length - 1]
        if (open !== undefined && depth === open) {
          templateExpr.pop()
          mode = 'template'
          out.push(ch)
          i += 1
          continue
        }
      }
      out.push(ch)
      i += 1
      continue
    }

    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out.push(ch) } else out.push(blank(ch))
      i += 1
      continue
    }

    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; out.push(' ', ' '); i += 2; continue }
      out.push(blank(ch))
      i += 1
      continue
    }

    // Inside a string of some kind.
    if (ch === '\\') { out.push(' ', ' '); i += 2; continue } // an escape hides nothing
    if (mode === 'single' && ch === "'") { mode = 'code'; out.push(ch); i += 1; continue }
    if (mode === 'double' && ch === '"') { mode = 'code'; out.push(ch); i += 1; continue }
    if (mode === 'template') {
      if (ch === '`') { mode = 'code'; out.push(ch); i += 1; continue }
      // `${` reopens CODE, which must still be scanned.
      if (ch === '$' && next === '{') {
        templateExpr.push(depth)
        depth += 1
        mode = 'code'
        out.push('$', '{')
        i += 2
        continue
      }
    }
    out.push(keepStrings ? ch : blank(ch))
    i += 1
  }
  return out.join('')
}

/**
 * COMMENTS ONLY, STRINGS KEPT — for the IMPORT scan.
 *
 * Learned by breaking it: blanking string literals failed every import test
 * at once, because a module path (`from './rng.js'`) IS a string literal and
 * the import check has to read them. The banned-construct check is the one
 * that must not see inside a string. Two readers, two needs, one machine.
 */
function stripComments(source: string): string {
  return stripNonCode(source, true)
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

/**
 * THE GUARD ON THE GUARD.
 *
 * `stripNonCode` decides what the purity check is even allowed to see, so a
 * bug in it does not produce a failure — it produces SILENCE, and a purity
 * suite that has quietly stopped looking is worse than no suite at all. It
 * earns its keep only if it still catches the things it is there to catch.
 */
describe('the purity scanner itself', () => {
  it('still sees a violation in real code', () => {
    expect(stripNonCode('const x = Math.random()')).toContain('Math.random(')
  })

  it('does not see one in a comment', () => {
    expect(stripNonCode('// never call Math.random() here')).not.toContain('Math.random(')
  })

  it('does not see one in prose, which is the whole point', () => {
    // The sentence that started this: ordinary English, read as browser access.
    const scene = "tell: 'A face at the second-floor window. It has been there twice.',"
    expect(stripNonCode(scene)).not.toContain('window.')
    // And the banned names really are just words in a sentence.
    expect(stripNonCode("const s = 'He checked the document. Then the process.'")).not.toContain(
      'document.',
    )
  })

  it('still sees one inside a template expression', () => {
    // `${...}` is CODE wearing a string's clothes and must stay visible.
    const code = 'const s = ' + String.fromCharCode(96) + 'at ' + '${Date.now()}'
    expect(stripNonCode(code)).toContain('Date.now(')
  })

  it('is not fooled by a comment marker inside a string', () => {
    // The regex pair this replaced treated // in a string as a comment and
    // deleted the rest of the line from the scan — the mirror-image bug.
    const code = "const url = 'https://example.test'; const n = Math.random()"
    expect(stripNonCode(code)).toContain('Math.random(')
  })

  it('keeps line numbers intact, so a report points at the real line', () => {
    const code = ["const a = 'one'", '// two', 'const b = Math.random()'].join('\n')
    const stripped = stripNonCode(code)
    expect(stripped.split('\n')).toHaveLength(3)
    expect(stripped.split('\n')[2]).toContain('Math.random(')
  })
})

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
      // STRINGS BLANKED HERE. This is the check that must not read prose as
      // code — the engine's scene files are full of written English.
      const code = stripNonCode(readFileSync(file, 'utf8'))
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

/**
 * A source file must be TEXT.
 *
 * newsroom.ts carried two literal NUL bytes for months (in `?? '\0'`
 * fallbacks). TypeScript compiled it happily, the tests passed, and the file
 * ran correctly — but ripgrep classifies a file containing a NUL as BINARY
 * and skips it silently, so every grep over this repo had a hole in it
 * exactly the size of the newsroom. A review found it by cross-checking a
 * file listing against a grep for `import` and noticing one file missing.
 *
 * The tests that matter read with node:fs and were never fooled. Everything
 * else — audits, refactors, "grep for every call site" — was.
 */
describe('the source is text', () => {
  const files = sourceFiles(SRC_DIR)
  it.each(files.map((f) => [relative(ENGINE_ROOT, f), f] as const))(
    '%s has no NUL bytes to hide it from grep',
    (_label, file) => {
      const bytes = readFileSync(file)
      expect(bytes.includes(0), 'contains a NUL byte — greps will skip this file').toBe(false)
    },
  )
})
