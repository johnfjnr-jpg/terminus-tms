// P2.0: THE OPPORTUNITY WRITE SURFACE, ENUMERATED WITHOUT A NAME FILTER.
//
// WHY THIS EXISTS. The R10 probe's route list was built by grepping src/routes
// and then FILTERING on /opportunit|record|score|close-lost/. That filter
// silently dropped `POST /deal-sheet-versions/:vid/restore`, which is the route
// behind the Restore button the census found reachable on an unowned record. A
// filtered enumeration reported as complete is the estate's recurring shape;
// R10 asked for the schema, and it got a UI-shaped grep.
//
// READ-ONLY. It reads source and prints. Nothing is written or attempted.
import { readFileSync, readdirSync } from 'fs'
import { stripJs } from '../lib/strip-comments.mjs'

const DIR = '/Users/johnfryatt/terminus-tms/src/routes'
const routes = []
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = stripJs(readFileSync(`${DIR}/${f}`, 'utf8'))
  src.split('\n').forEach((line, i) => {
    const m = line.match(/app\.(post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/)
    if (m) routes.push({ method: m[1].toUpperCase(), path: m[2], file: f, line: i + 1 })
  })
}

// ── THE CLASSIFICATION RULE, STATED SO IT CAN BE DISAGREED WITH ───────────
//
// A route can touch an OPPORTUNITY record if it is addressed by:
//   - /opportunities/:id...            an Opportunity by name
//   - /records/:id...                  the GENERIC record path; an Opportunity
//                                      is a records row, so these reach one
//   - a CHILD entity of an Opportunity, addressed by its own id:
//     deal-sheet-versions, transition-requests. The parent is resolved server
//     side, so the path never says "opportunity" and a name filter loses them.
// It cannot if it is addressed by /test-beds, /contacts, /accounts, or is a
// catalogue or reference route.
const OPP = /^\/opportunities\//
const GENERIC = /^\/records\//
const CHILD = /^\/(deal-sheet-versions|transition-requests)\//
const OTHER_TYPE = /^\/(test-beds|contacts|accounts)\//

const classify = (p) => {
  if (OPP.test(p)) return 'opportunity (by name)'
  if (GENERIC.test(p)) return 'opportunity (generic /records)'
  if (CHILD.test(p)) return 'opportunity (child entity)'
  if (OTHER_TYPE.test(p)) return 'other record type'
  return 'not record-scoped'
}

// What the R10 probe actually attempted, by path shape.
const ATTEMPTED = [
  '/opportunities/:id/scores', '/opportunities/:id/close-lost', '/opportunities/:id',
  '/opportunities/:id/close-date-move', '/opportunities/:id/probability-override',
  '/opportunities/:id/assessment-reviewed', '/opportunities/:id/key-contacts',
  '/opportunities/:id/key-contacts/:linkId/stance', '/opportunities/:id/key-contacts/:linkId',
  '/opportunities/:id/deal-sheet-versions', '/records/:id/transition-requests',
  '/records/:id/transition', '/records/:id/approvals',
]
const norm = (p) => p.replace(/:\w+/g, ':id')
const attempted = new Set(ATTEMPTED.map(norm))

console.log(`  write routes in src/routes: ${routes.length}\n`)
const buckets = {}
for (const r of routes) { const k = classify(r.path); (buckets[k] ??= []).push(r) }
for (const [k, v] of Object.entries(buckets).sort()) console.log(`  ${String(v.length).padStart(3)}  ${k}`)

const inScope = routes.filter((r) => classify(r.path).startsWith('opportunity'))
const missed = inScope.filter((r) => !attempted.has(norm(r.path)))
const hit = inScope.filter((r) => attempted.has(norm(r.path)))

console.log(`\n  OPPORTUNITY WRITE SURFACE: ${inScope.length} routes`)
console.log(`  attempted by the R10 probe:  ${hit.length}`)
console.log(`  NOT attempted (the delta):   ${missed.length}\n`)
console.log('  THE DELTA, every route R10 never touched:')
for (const r of missed.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`    ${r.method.padEnd(6)} ${r.path.padEnd(52)} ${r.file}:${r.line}`)
}
console.log('\n  For completeness, the routes R10 DID attempt:')
for (const r of hit.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`    ${r.method.padEnd(6)} ${r.path.padEnd(52)} ${r.file}:${r.line}`)
}
