// ── ROUND 8 PHASE 0 ITEM 3: EVERY READER OF is-not-mine ─────────────────
//
// THE CHECKPOINT. The door's direction is ruled - a record read - and this
// measures the removal price. If a reader exists beyond CAN_EDIT_BY_VIEW, or a
// sweep feeds anything besides the door, the price changes and returns to John.
//
// Comments are STRIPPED before matching (Verification 39), because a file that
// talks about its own mechanism contains every string a scan of it looks for -
// and this repository's comments discuss `is-not-mine` at length.
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)
const TOKEN = 'is-not-mine'

const walk = (dir) => {
  let out = []
  for (const e of readdirSync(new URL(dir + '/', ROOT), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out = out.concat(walk(rel))
    else if (/\.(js|mjs|ts|tsx|css|html)$/.test(e.name)) out.push(rel)
  }
  return out
}
const kindOf = (f) => f.endsWith('.css') ? 'css'
  : f.endsWith('.html') ? 'html' : 'js'

const files = ['frontend', 'frontend-react/src', 'src', 'scripts'].flatMap(walk)

// CALIBRATION: the scan must be shown to find a mention it is meant to find,
// and to reject one that lives only in prose.
const app = readCode(new URL('frontend/app.js', ROOT), 'js')
if (!app.includes(TOKEN)) {
  console.error('REFUSED: the stripper removed every mention from app.js, so the scan cannot run')
  process.exit(2)
}
const rawApp = readFileSync(new URL('frontend/app.js', ROOT), 'utf8')
const strippedOut = (rawApp.split(TOKEN).length - 1) - (app.split(TOKEN).length - 1)
console.log(`CALIBRATION: app.js mentions ${rawApp.split(TOKEN).length - 1} times raw, `
  + `${app.split(TOKEN).length - 1} in code. ${strippedOut} were PROSE.\n`)

const hits = []
for (const f of files) {
  let code
  try { code = readCode(new URL(f, ROOT), kindOf(f)) } catch { continue }
  if (!code.includes(TOKEN)) continue
  code.split('\n').forEach((line, i) => {
    if (line.includes(TOKEN)) hits.push({ f, line: i + 1, text: line.trim().slice(0, 130) })
  })
}

console.log(`EVERY CODE MENTION OF \`${TOKEN}\` (${hits.length}):\n`)
let last = null
for (const h of hits) {
  if (h.f !== last) { console.log(`  ${h.f}`); last = h.f }
  console.log(`    :${h.line}  ${h.text}`)
}

// ── AND WHAT EACH SWEEP FEEDS BESIDES THE DOOR ────────────────────────────
console.log('\nWHAT EACH SWEEP DOES, line by line:')
const lines = rawApp.split('\n')
for (const [name, needle] of [
  ['TEST BED sweep', "getElementById('view-test-bed-detail')?.classList.toggle('is-not-mine'"],
  ['OPPORTUNITY sweep', "getElementById('view-opportunity-detail')?.classList.toggle('is-not-mine'"],
]) {
  const at = lines.findIndex((l) => l.includes(needle))
  if (at < 0) { console.log(`  ${name}: NOT FOUND`); continue }
  console.log(`\n  ${name}, app.js:${at + 1}`)
  // The enclosing block: walk back to the notMine derivation, forward to the
  // closing brace at the same depth.
  let start = at
  while (start > 0 && !lines[start].includes('const notMine')) start--
  let end = at
  let depth = 0
  for (let i = start; i < Math.min(lines.length, start + 60); i++) {
    depth += (lines[i].match(/\{/g) ?? []).length - (lines[i].match(/\}/g) ?? []).length
    if (i > at && depth <= 0) { end = i; break }
  }
  for (let i = start; i <= end; i++) {
    const t = lines[i].trim()
    if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) {
      console.log(`      :${i + 1}  ${t.slice(0, 120)}`)
    }
  }
}
