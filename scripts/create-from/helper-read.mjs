// R6: the bounded read for helper-mediated creates.
//
// The body-local scan cannot see a route that creates through a helper -
// units/derive proved it. This reads the other direction: find every FUNCTION
// that inserts a records row, then find which routes call it.
//
// The first attempt matched the route-module wrappers (accountsRoutes,
// contactsRoutes, testBedsRoutes) because their bodies contain every route in
// the file. Those are not helpers; they are the file. Excluded by name and the
// exclusion is stated, because an exclusion nobody can see is where the next
// blind spot lives.
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const FILES = []
for (const d of ['src/lib', 'src/routes'])
  for (const f of readdirSync(ROOT + d)) if (f.endsWith('.js')) FILES.push(d + '/' + f)

// Every function declaration, with its body bounded by the next declaration.
const creators = []
for (const f of FILES) {
  const s = stripJs(readFileSync(ROOT + f, 'utf8'))
  const decls = [...s.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)]
  decls.forEach((m, i) => {
    const seg = s.slice(m.index, i + 1 < decls.length ? decls[i + 1].index : s.length)
    const name = m[1]
    if (/Routes$/.test(name)) return               // the module wrapper, not a helper
    if (/\.from\('records'\)[\s\S]{0,220}?\.insert\(/.test(seg)) creators.push({ name, f })
  })
}
console.log(`=== FUNCTIONS THAT INSERT A records ROW (module wrappers excluded): ${creators.length}`)
for (const c of creators) console.log(`  ${c.name}  (${c.f})`)

// Which routes call them?
console.log('\n=== ROUTES THAT CALL ONE')
const names = creators.map((c) => c.name)
let found = 0
for (const f of FILES.filter((x) => x.startsWith('src/routes'))) {
  const s = stripJs(readFileSync(ROOT + f, 'utf8'))
  const hits = [...s.matchAll(/app\.(post|patch|put|delete)\('([^']+)'/g)]
  hits.forEach((m, i) => {
    const seg = s.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : s.length)
    const called = names.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(seg))
    if (called.length) { found++; console.log(`  ${m[1].toUpperCase().padEnd(6)} ${m[2].padEnd(46)} calls ${called.join(', ')}`) }
  })
}
if (!found) console.log('  (none beyond those already listed)')

// And the honest bound.
console.log('\n=== THE BOUND OF THIS READ')
console.log(`  files read: ${FILES.length}  (all of src/lib and src/routes)`)
console.log('  what it can see : a function whose own body inserts into records')
console.log('  what it CANNOT  : a helper that creates through a SECOND helper,')
console.log('                    or through an RPC this scan does not follow.')
console.log('  RPCs are covered separately: the classifier already lists every route')
console.log('  calling one, and the two create-from RPCs are convert_test_bed and')
console.log('  create_opportunity_from_contact, both already on the fix list.')

// ── THE TWO FALSE POSITIVES, VERIFIED AND RECORDED ────────────────────────
// suggestTestBedName only SELECTs from records (a count for a name suffix), and
// appendPayloadSeriesEntry touches record_revisions, not records. Both were
// flagged because the body bound - "up to the next function declaration" - ran
// past each function's end into following code. Read directly, neither inserts.
//
// So the genuine helper-creator is deriveMissingUnitSlots ALONE, already on the
// fix list. Its second caller, PATCH /test-beds/:id, was proven to refuse a
// non-owner in the probe round (403), so it is not a new instance either.
//
// R6's RESULT: the read was done across 45 files; NO NEW INSTANCE joins the fix
// list, and nothing outside the shape was found. The list stays at six.
