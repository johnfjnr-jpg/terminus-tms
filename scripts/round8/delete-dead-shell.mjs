// ── ROUND 8 PHASE 2 ITEM 3: THE DEAD SHELL CODE, DELETED ────────────────
//
// Phase 0 measured 33 candidates: 31 dead by per-name deletion, and 2 carrying
// couplings that retire with them. This lands the deletion.
//
// THE DELETION IS THE WORK, so the harness discipline applies to the REHEARSAL
// - it deletes, runs, and reports; the landing is the caller committing the
// result. It still snapshots so a failed run leaves nothing behind.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { topLevelNames } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const APP = ROOT + 'frontend/app.js'
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })

const ORIGINAL = readFileSync(APP)
writeFileSync(SNAP + '/frontend_app.js', ORIGINAL)
if (!readFileSync(SNAP + '/frontend_app.js').equals(ORIGINAL)) {
  console.error('REFUSED: snapshot did not round-trip'); process.exit(2)
}

// The names Phase 0 measured, from its own record.
const measured = JSON.parse(readFileSync(SNAP + '/../r8-dead/dead-shell.json', 'utf8'))
const NAMES = measured.filter((r) => r.verdict !== 'NOT IN app.js').map((r) => r.name)
if (NAMES.length < 30) {
  console.error(`REFUSED: ${NAMES.length} names from the Phase 0 record, expected 33`)
  process.exit(2)
}

const text = ORIGINAL.toString('utf8')
const lines = text.split('\n')
const names = topLevelNames(text).sort((a, b) => a.line - b.line)

// Ranges first, then delete from the BOTTOM UP so earlier line numbers stay
// valid. Deleting top-down shifts every later range and silently cuts the
// wrong code.
const ranges = []
for (const n of NAMES) {
  const i = names.findIndex((x) => x.name === n)
  if (i < 0) { console.log(`  skip (already gone): ${n}`); continue }
  const start = names[i].line
  const end = i + 1 < names.length ? names[i + 1].line - 1 : lines.length
  ranges.push({ name: n, start, end })
}
ranges.sort((a, b) => b.start - a.start)

let out = lines.slice()
let removed = 0
for (const r of ranges) {
  out = out.slice(0, r.start - 1).concat(out.slice(r.end))
  removed += r.end - r.start + 1
}
writeFileSync(APP, out.join('\n'))
console.log(`\ndeleted ${ranges.length} names, ${removed} lines`)
console.log(`app.js: ${lines.length} -> ${out.length} lines`)
