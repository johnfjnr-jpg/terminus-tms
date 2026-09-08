// PHASE 0 ITEM 2: every write route, and what stands between a non-owner and
// the write. Source-derived; the live proofs are separate and named in the map.
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const DIR = ROOT + 'src/routes/'
const rows = []

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = stripJs(readFileSync(DIR + f, 'utf8'))
  const re = /app\.(post|patch|put|delete)\('([^']+)'/g
  const hits = [...src.matchAll(re)]
  hits.forEach((m, i) => {
    const start = m.index
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length
    const seg = src.slice(start, end)
    // What the handler does about ownership, read from the body.
    const guards = []
    if (/sendRefusal\(/.test(seg)) guards.push('route 403 (sendRefusal)')
    if (/!updated\?\.length|!data\?\.length|affected|\.length === 0/.test(seg)) guards.push('zero-rows check')
    if (/owner_id/.test(seg)) guards.push('reads owner_id')
    if (/computeBlocking|blocking/.test(seg)) guards.push('workflow gate')
    if (/isRefusal|42501/.test(seg)) guards.push('maps 42501')
    if (/\.rpc\('/.test(seg)) guards.push('via ' + (seg.match(/\.rpc\('(\w+)'/) ?? [, '?'])[1])
    const tables = [...new Set([...seg.matchAll(/\.from\('(\w+)'\)[\s\S]{0,140}?\.(insert|update|delete|upsert)\(/g)].map((x) => `${x[1]}.${x[2]}`))]
    rows.push({ file: f, method: m[1].toUpperCase(), path: m[2], guards, tables })
  })
}

console.log(`=== WRITE ROUTE CENSUS: ${rows.length} write routes across ${new Set(rows.map(r => r.file)).size} files\n`)
const NONE = []
for (const r of rows.sort((a, b) => a.path.localeCompare(b.path))) {
  const g = r.guards.length ? r.guards.join(', ') : '— NOTHING IN THE ROUTE —'
  if (!r.guards.length) NONE.push(r)
  console.log(`  ${r.method.padEnd(6)} ${r.path}`)
  console.log(`         writes : ${r.tables.join(', ') || '(none directly)'}`)
  console.log(`         guards : ${g}`)
}
console.log(`\n=== ROUTES WITH NO OWNERSHIP GUARD IN THE ROUTE ITSELF: ${NONE.length} of ${rows.length}`)
console.log('  (which is correct wherever RLS is ownership-shaped: the route need not')
console.log('   restate what the database enforces. It is a GAP only where the policy')
console.log('   behind the table is identity-shaped or open - see the entitlement map.)')
for (const r of NONE) console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(48)} -> ${r.tables.join(', ') || '(indirect)'}`)
