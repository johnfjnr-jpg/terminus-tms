// ── ROUND 5 PHASE 0 ITEM 1: THE PANEL BOUNDARY, BOTH DIRECTIONS ─────────
//
// Verification 50: a seam census runs in BOTH directions and covers
// BEHAVIOUR, not only data. A call that changes the other side's state
// crosses the boundary even when no value moves. And the declaration form
// matters: `function`/`var` reach window, `let`/`const` never did.
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)
const REF = 'frontend/opportunity-reference.js'
const APP = 'frontend/app.js'
const refRaw = readFileSync(new URL(REF, ROOT), 'utf8')
const ref = readCode(new URL(REF, ROOT))
const app = readCode(new URL(APP, ROOT))

// CALIBRATION FIRST. A scan that cannot see a known-present thing is not a
// scan, and one satisfied by prose is worse.
if (!ref.includes('initOpportunityReferencePanel')) throw new Error('CALIBRATION: known-present symbol unseen')
if (ref.includes('zzzNoSuchSymbolZZZ')) throw new Error('CALIBRATION: absent symbol seen')
if (!/window\.initOpportunityReferencePanel\s*=/.test(ref)) throw new Error('CALIBRATION: the stripper ate real code')
console.log('scan calibrated: known-present seen, known-absent unseen, real code survives\n')

const declared = new Set()
for (const m of refRaw.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) declared.add(m[1])
for (const m of refRaw.matchAll(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) declared.add(m[1])
for (const m of refRaw.matchAll(/^import\s+\{([^}]+)\}/gm)) {
  for (const n of m[1].split(',')) declared.add(n.trim().split(/\s+as\s+/).pop())
}

const reads = new Map()
for (const m of ref.matchAll(/window\.([A-Za-z_$][\w$]*)/g)) {
  const rest = ref.slice(m.index + m[0].length)
  if (!/^\s*=[^=]/.test(rest)) reads.set(m[1], (reads.get(m[1]) ?? 0) + 1)
}

const SKIP = new Set(['if','for','while','switch','catch','return','typeof','function','await','new','String','Number','Boolean','Array','Object','JSON','Math','Promise','Set','Map','Date','parseInt','parseFloat','isNaN','console','alert','confirm','decodeURIComponent','encodeURIComponent','RegExp','Error'])
const bareCalls = new Map()
for (const m of ref.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
  const n = m[1]
  if (declared.has(n) || SKIP.has(n)) continue
  bareCalls.set(n, (bareCalls.get(n) ?? 0) + 1)
}

const assigns = new Set()
for (const m of ref.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) assigns.add(m[1])
const appUses = new Map()
for (const name of assigns) {
  const n = (app.match(new RegExp(`window\\.${name}\\b|(?<![.\\w$])${name}\\s*\\(`, 'g')) ?? []).length
  if (n) appUses.set(name, n)
}

const refIds = new Set([...ref.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]))
const appIds = new Set([...app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]))
const shared = [...refIds].filter((i) => appIds.has(i)).sort()

console.log('── A. THE PANEL READS, FROM OUTSIDE ITSELF ─────────────────────')
console.log('window.X reads:')
for (const [n, c] of [...reads].sort()) console.log(`  window.${n.padEnd(32)} x${c}`)
console.log('\nbare global calls (declared nowhere in this file):')
for (const [n, c] of [...bareCalls].sort()) console.log(`  ${n.padEnd(39)} x${c}`)

console.log('\n── B. WHAT REACHES INTO THE PANEL ──────────────────────────────')
console.log(`the panel assigns ${assigns.size} window names; app.js uses these:`)
for (const [n, c] of [...appUses].sort()) console.log(`  window.${n.padEnd(32)} x${c} in app.js`)
const unused = [...assigns].filter((a) => !appUses.has(a)).sort()
console.log(`\nassigned but NOT used by app.js (${unused.length}) - markup handlers or dead:`)
for (const n of unused) console.log(`  window.${n}`)

console.log('\n── C. SHARED DOM IDS: a coupling no symbol census can see ──────')
console.log(`${shared.length} ids addressed by BOTH files:`)
for (const i of shared) console.log(`  #${i}`)

console.log('\n── D. TOP-LEVEL DECLARATIONS, SPLIT BY KEYWORD ─────────────────')
const tops = [...refRaw.matchAll(/^(?:export\s+)?(?:async\s+)?(function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)]
const byKind = {}
for (const [, k, n] of tops) (byKind[k] ??= []).push(n)
for (const k of ['function', 'var', 'let', 'const']) {
  const list = (byKind[k] ?? []).sort()
  console.log(`  ${k.padEnd(9)} ${String(list.length).padStart(3)}${list.length ? '  ' + list.join(', ') : ''}`)
}
console.log(`\n  total top-level declarations parsed: ${tops.length}`)
