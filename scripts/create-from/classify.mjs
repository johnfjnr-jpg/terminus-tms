// PHASE 0 ITEM 1: which write routes carry the CREATE-FROM shape?
//
// The shape, from the brief: takes a SOURCE record id, creates or materially
// changes something, and is reachable by a non-owner of that source.
//
// The mechanical test, per route body, comment-stripped:
//   (a) the path carries a :id segment  -> it names a source record
//   (b) the body INSERTS a new records row, or calls an RPC that does
// A route that only updates the record :id names is NOT the shape: that is an
// ordinary owner-scoped write, and the last two rounds proved those refuse.
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const DIR = ROOT + 'src/routes/'
const rows = []
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = stripJs(readFileSync(DIR + f, 'utf8'))
  const hits = [...src.matchAll(/app\.(post|patch|put|delete)\('([^']+)'/g)]
  hits.forEach((m, i) => {
    const seg = src.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : src.length)
    const insertsRecord = /\.from\('records'\)[\s\S]{0,220}?\.insert\(/.test(seg)
    // A ROUTE CAN CREATE THROUGH A HELPER, and a body-local scan cannot see it.
    // units/derive was missed by the first version: it calls
    // deriveMissingUnitSlots(db, bed.id, counts, request.user.id), which inserts
    // the unit records in src/lib/units.js. The tell is a call passing
    // request.user.id to something that is not a route - an actor id is only
    // needed by code that WRITES.
    const viaHelper = [...seg.matchAll(/\b(\w+)\s*\([^)]{0,160}request\.user\.id/g)]
      .map((x) => x[1]).filter((n) => !['send', 'code', 'log', 'error'].includes(n))
    const rpc = (seg.match(/\.rpc\('(\w+)'/) ?? [])[1]
    rows.push({
      f, method: m[1].toUpperCase(), path: m[2],
      hasSource: /:id/.test(m[2]), insertsRecord, rpc, viaHelper,
      children: [...new Set([...seg.matchAll(/\.from\('(\w+)'\)[\s\S]{0,160}?\.(insert|upsert)\(/g)].map((x) => x[1]))],
    })
  })
}
const shape = rows.filter((r) => r.hasSource && (r.insertsRecord || r.rpc || r.viaHelper?.length))
console.log(`=== ${rows.length} write routes; ${shape.length} carry a source id AND create something\n`)
for (const r of shape) {
  console.log(`  ${r.method.padEnd(6)} ${r.path}`)
  console.log(`         inserts a records row: ${r.insertsRecord}   rpc: ${r.rpc ?? '-'}   via helper: ${r.viaHelper?.join(', ') || '-'}`)
  console.log(`         children: ${r.children.join(', ') || '(none)'}`)
}
console.log(`\n=== NOT the shape (${rows.length - shape.length})`)
for (const r of rows.filter((x) => !shape.includes(x))) {
  console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(52)} ${r.hasSource ? 'source id, but creates no record' : 'no source id'}`)
}
