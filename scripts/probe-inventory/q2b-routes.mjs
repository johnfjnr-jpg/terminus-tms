// ── Q2b: DETECTORS CALLING ROUTES THAT DO NOT EXIST ──────────────────────
//
// Read-only, which matters: R1 makes this a measurement round, and nearly
// every probe in the unwired set BUILDS FIXTURES, so the unwired population
// cannot be audited by running it without writing data. This is the static
// substitute and its limits are stated in the report.
//
// Verification 47's caller clause: a request shaped by what the reader
// wanted rather than by what the route serves is invisible to every layer
// above the network. Two were shipped in Round 7 alone.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, kindOf } from '../lib/strip-comments.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p, out) }
    else if (/\.(mjs|js|ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const read = (f) => { try { return readFileSync(join(ROOT, f), 'utf8') } catch { return '' } }

// ── THE ROUTES THE SERVER ACTUALLY SERVES ────────────────────────────────
const routeFiles = walk(join(ROOT, 'src')).map((f) => relative(ROOT, f))
const served = new Set()
for (const f of routeFiles) {
  for (const m of stripComments(read(f), 'js').matchAll(/app\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g))
    served.add(`${m[1].toUpperCase()} ${m[2]}`)
}
// Match on SHAPE, so :id and a real uuid compare equal.
const shape = (p) => p.replace(/\/api\//, '/')
  .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
  .replace(/\/\$\{[^}]+\}/g, '/:id')
  .replace(/:[A-Za-z_]+/g, ':id')
  .replace(/\/+$/, '')
const servedShapes = new Set([...served].map((s) => {
  const [m, p] = s.split(' '); return `${m} ${shape(p)}`
}))

const isDetector = (f) => /\.test\.(mjs|ts|tsx)$/.test(f) || /^scripts\/.*(probe|census|calibrate|walk)/.test(f)
const detectors = [...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'frontend-react/src'))]
  .map((f) => relative(ROOT, f)).filter(isDetector)

// ── CALIBRATION (R2) ─────────────────────────────────────────────────────
const KNOWN_SERVED = 'GET /contacts'
const KNOWN_ABSENT = 'GET /api/stages'     // Round 7 shipped this; the real route is /api/stage-definitions
console.log('=== Q2b CALIBRATION ===')
const has = (mp) => { const [m, p] = mp.split(' '); return servedShapes.has(`${m} ${shape(p)}`) }
console.log(`  known SERVED "${KNOWN_SERVED}" recognised: ${has(KNOWN_SERVED)}   (must be TRUE)`)
console.log(`  known ABSENT "${KNOWN_ABSENT}" recognised: ${has(KNOWN_ABSENT)}   (must be FALSE)`)
const calOk = has(KNOWN_SERVED) && !has(KNOWN_ABSENT)
console.log(calOk ? '  CALIBRATED.\n' : '  *** NOT CALIBRATED. ***\n')

console.log(`=== Q2b RESULT ===`)
console.log(`  routes the server serves : ${served.size}`)
const bad = []
for (const f of detectors) {
  const s = stripComments(read(f), kindOf(f))
  for (const m of s.matchAll(/['"`](?:GET|POST|PATCH|PUT|DELETE)['"`]\s*,\s*[`'"]([^`'"]+)[`'"]/g)) {
    const p = m[1]
    if (!p.startsWith('/')) continue
    const verb = /['"`](GET|POST|PATCH|PUT|DELETE)['"`]/.exec(m[0])[1]
    if (!servedShapes.has(`${verb} ${shape(p)}`)) bad.push({ f, call: `${verb} ${p}` })
  }
}
const byFile = {}
for (const b of bad) (byFile[b.f] ??= new Set()).add(b.call)
console.log(`  detectors examined       : ${detectors.length}`)
console.log(`  calls to a route the server does not serve: ${bad.length} across ${Object.keys(byFile).length} files\n`)
for (const [f, calls] of Object.entries(byFile).sort((a,b)=>b[1].size-a[1].size).slice(0, 15))
  console.log(`  ${f}\n      ${[...calls].join('\n      ')}`)
if (!calOk) process.exit(2)
