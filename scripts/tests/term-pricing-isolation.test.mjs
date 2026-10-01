// ── R-TP1: THE TERM PRICING ENGINE AND THE DEAL-SHEET PRICING CODE CANNOT REACH EACH OTHER ──
//
// Ruled by John 2026-10-01, design accepted at Phase 0:
//
//   1. src/lib/term-pricing.js IMPORTS NOTHING. Structural rather than a
//      blocklist, so a pricing file added tomorrow cannot slip past it. The
//      R-TP1 exception list (pure tax or rounding helpers) is EMPTY.
//   2. NOTHING OUTSIDE AN ALLOWLIST IMPORTS IT. The importer side enumerates by
//      structure and fails on the unrecorded instance (Verification 19), so the
//      deal-sheet pricing code is covered without being named file by file.
//   3. IT IS PURE: no UI, database or network reference in its code.
//
// Every scan reads code with comments stripped (Verification 39), so prose
// about an import can neither satisfy nor trip a check. The engine's own name
// is assembled from parts so this file never contains an import of it.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const ENGINE = 'src/lib/' + ['term', 'pricing'].join('-') + '.js'
const ENGINE_NAME = ['term', 'pricing'].join('-')

// Who may import the engine. Phase 3 adds the route and the screen here, in a
// diff somebody reads.
export const ALLOWED_IMPORTERS = [
  'scripts/tests/term-pricing.test.mjs',
  // Phase 2: generates the static mockup's figures from the engine.
  'prototypes/term-pricing/build-mockup.mjs',
]

const SCAN_DIRS = ['src', 'frontend', 'frontend-react/src', 'scripts', 'prototypes']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])
const CODE = /\.(m?js|cjs|ts|tsx|jsx|html?)$/

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (CODE.test(name)) out.push(p)
  }
  return out
}

// Every way one file can pull in another: static import or re-export, dynamic
// import, require, and an HTML script tag. Returns the specifiers.
export function importSpecifiers(code) {
  const specs = []
  const patterns = [
    /\bimport\s+(?:[^'"`;]*?\s+from\s+)?['"`]([^'"`]+)['"`]/g,
    /\bexport\s+[^'"`;]*?\s+from\s+['"`]([^'"`]+)['"`]/g,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/g,
  ]
  for (const re of patterns) for (const m of code.matchAll(re)) specs.push(m[1])
  return specs
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).map((p) => relative(ROOT, p))

test('the scanner can see an import it knows is there (calibration, Verification 12)', () => {
  // deal-inputs.js imports deal-calculator.js; if this reads zero, every
  // "nothing imports X" below is a search that did not run.
  const specs = importSpecifiers(readCode(join(ROOT, 'src/lib/deal-inputs.js')))
  assert.ok(specs.some((s) => s.endsWith('deal-calculator.js')), `saw: ${specs.join(', ')}`)
  assert.ok(files.length > 200, `scanned only ${files.length} files`)
  assert.ok(files.includes('src/lib/deal-calculator.js'), 'the deal-sheet engine is in the scanned population')
})

test('R-TP1 (1): the term pricing engine imports nothing', () => {
  const specs = importSpecifiers(readCode(join(ROOT, ENGINE)))
  assert.deepEqual(specs, [], `the engine imports: ${specs.join(', ')}`)
})

test('R-TP1 (2): nothing outside the allowlist imports the engine', () => {
  const importers = files.filter((f) => f !== ENGINE &&
    importSpecifiers(readCode(join(ROOT, f))).some((s) => s.includes(ENGINE_NAME)))
  const unrecorded = importers.filter((f) => !ALLOWED_IMPORTERS.includes(f))
  assert.deepEqual(unrecorded, [], `unrecorded importers of the engine: ${unrecorded.join(', ')}`)
  // And the allowlist is not stale: every entry exists and really imports it.
  for (const f of ALLOWED_IMPORTERS) assert.ok(importers.includes(f), `${f} is allowlisted but does not import the engine`)
})

test('R-TP1 (3): the engine is pure, and does no float arithmetic on money', () => {
  const code = readCode(join(ROOT, ENGINE))
  const impure = ['fetch', 'document', 'window', 'XMLHttpRequest', 'localStorage', 'process', 'supabase', 'createClient']
    .filter((w) => new RegExp(`\\b${w}\\b`).test(code))
  assert.deepEqual(impure, [], `the engine references: ${impure.join(', ')}`)
  const floaty = ['parseFloat', 'toFixed', 'Math.round', 'Math.floor', 'Math.pow', 'Number.parseFloat']
    .filter((w) => code.includes(w))
  assert.deepEqual(floaty, [], `float money operations in the engine: ${floaty.join(', ')}`)
})
