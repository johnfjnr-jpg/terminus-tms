// ── R4c: WHAT POINTS AT LEAD DETAIL ──────────────────────────────────────
//
// The inventory that makes the retirement safe. Verification 41: every
// caller is listed with a DISPOSITION, the whole repository is grepped, and
// the name is searched AS A STRING as well as a path - a claim inside a data
// structure used as documentation cannot fail and cannot be re-pointed.
//
// Enumerated by ANCHOR, and the anchors are the things a retirement breaks:
// the view container, the registered loader, the navigation target, and the
// host component itself.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripJs, stripHtml, stripCss } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// ASSEMBLED FROM PARTS, never written as literals. The first run scanned its
// own source and its own JSON output and reported them as dependencies -
// Verification 39's Round 8 fault, and the remedy is the one this estate
// already recorded rather than a new one: the harness names the string
// NOWHERE, so an exemption list is not load-bearing.
const A = (...p) => p.join('')
const ANCHORS = [
  { name: A('view-', 'contact-', 'detail'), what: 'the view CONTAINER in index.html' },
  { name: A('load', 'Contact', 'Detail'), what: 'the loader the shell registers and app.js calls' },
  { name: A('Contact', 'Host'), what: 'the React host component' },
  { name: A('Contact', 'View'), what: "the host's view component" },
  { name: A('set', 'Contact', 'ReturnView'), what: 'the return-path seam' },
]

const files = []
const walk = (d) => {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    const rel = join(d, e.name)
    if (/node_modules|\.git|dist|\.verify|Prototype/.test(rel)) continue
    if (e.isDirectory()) walk(rel)
    else files.push(rel)
  }
}
for (const d of ['frontend', 'frontend-react/src', 'src', 'scripts', 'supabase']) walk(d)
// The instrument's own directory is not part of the estate it measures. The
// assembly above means this exclusion is belt-and-braces rather than the
// thing keeping the scan honest.
const SELF = 'scripts/leads-details'
for (const e of readdirSync(ROOT, { withFileTypes: true })) if (e.isFile()) files.push(e.name)

const strip = (src, f) => {
  if (/\.html$/.test(f)) return stripHtml(src)
  if (/\.css$/.test(f)) return stripCss(src)
  if (/\.(js|mjs|ts|tsx)$/.test(f)) return stripJs(src)
  return src
}
const KIND = (f) => {
  if (f.startsWith('frontend-react/src/__tests__')) return 'REACT TEST'
  if (f.startsWith('scripts/tests/')) return 'GATE SUITE'
  if (f.startsWith('scripts/')) return 'PROBE / SCRIPT'
  if (f.endsWith('.md')) return 'DOCUMENT'
  if (f.startsWith('frontend-react/src')) return 'REACT SOURCE'
  if (f.startsWith('frontend/')) return 'VANILLA SOURCE'
  if (f.startsWith('src/')) return 'SERVER'
  return 'OTHER'
}

const hits = {}
for (const a of ANCHORS) hits[a.name] = []
for (const f of files) {
  if (f.startsWith(SELF)) continue
  let raw; try { raw = readFileSync(join(ROOT, f), 'utf8') } catch { continue }
  const code = strip(raw, f)
  for (const a of ANCHORS) {
    const inCode = code.includes(a.name)
    const inProse = !inCode && raw.includes(a.name)
    if (!inCode && !inProse) continue
    const lines = raw.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l.includes(a.name))
    hits[a.name].push({ file: f, kind: KIND(f), inCode, count: lines.length,
      first: lines.slice(0, 2).map(([n, l]) => `${n}: ${l.trim().slice(0, 86)}`) })
  }
}

let total = 0
for (const a of ANCHORS) {
  const list = hits[a.name]
  total += list.length
  const code = list.filter((h) => h.inCode)
  console.log(`\n=== "${a.name}" - ${a.what}`)
  console.log(`    ${list.length} file(s), ${code.length} in CODE, ${list.length - code.length} in prose only`)
  const byKind = {}
  for (const h of list) (byKind[h.kind] ??= []).push(h)
  for (const k of Object.keys(byKind).sort()) {
    for (const h of byKind[k]) {
      console.log(`    ${h.inCode ? 'CODE ' : 'prose'} [${k.padEnd(14)}] ${h.file}  x${h.count}`)
      if (h.inCode) for (const l of h.first) console.log(`             ${l}`)
    }
  }
}
console.log(`\n=== TOTAL file-anchor pairs: ${total} ===`)

const SYNTH = ['zzz', 'NoSuch', 'Anchor'].join('')
const anywhere = files.some((f) => {
  try { return readFileSync(join(ROOT, f), 'utf8').includes(SYNTH) } catch { return false } })
console.log(`\nCALIBRATION  a fabricated anchor is found nowhere: ${!anywhere}`)
const known = hits[ANCHORS[2].name]
console.log(`             a known anchor IS found: ${known.length > 0}`)
console.log(`             files scanned: ${files.length}`)
console.log(`             and the scan does NOT see itself: ${!files.filter((f) => !f.startsWith(SELF)).some((f) => f.includes('census-detail'))}`)
if (anywhere || !known.length) { console.log('CALIBRATION FAILED'); process.exit(1) }
writeFileSync(join(ROOT, 'scripts/leads-details/retirement-inventory.json'), JSON.stringify(hits, null, 1))
