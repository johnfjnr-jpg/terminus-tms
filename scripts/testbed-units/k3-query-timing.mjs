// K3 (ruling R5): the teardown test's tag-weighing query, timed alone and explained.
// READ-ONLY: exact counts and a plan request; writes nothing.
import { admin, tagsToSweep } from '../fixtures.mjs'
const db = admin()
const N = 5
const time = async (label, build) => {
  const ms = []; let count = null; let err = null
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    const { count: c, error } = await build()
    ms.push(performance.now() - t0)
    if (error) { err = { message: error.message, code: error.code, details: error.details, hint: error.hint }; break }
    count = c
  }
  const min = Math.min(...ms)
  console.log(`${label.padEnd(58)} count=${count ?? 'n/a'}  min ${min.toFixed(0)}ms  samples ${ms.map((x) => x.toFixed(0)).join('/')}${err ? `  ERROR ${JSON.stringify(err)}` : ''}`)
  return { label, count, min, ms, err }
}
const weigh = (table, tag) => () => db.from(table).select('id', { count: 'exact', head: true }).ilike('payload->>name', `${tag}%`)
const total = (table) => () => db.from(table).select('id', { count: 'exact', head: true })

console.log('== table sizes')
const rr = await time('record_revisions total rows', total('record_revisions'))
const rec = await time('records total rows', total('records'))

const ledger = tagsToSweep()
console.log(`\n== the ledger the test weighs: ${ledger.length} tags (it excludes its own two)`)

console.log('\n== one weigh query, the exact shape the test runs, by tag population')
const heavy = await time('a1deep (the test\'s own, heavy)', weigh('record_revisions', 'a1deep'))
const pad = await time('a1pad1 (the test\'s pad tag)', weigh('record_revisions', 'a1pad1'))
const light = await time('TBUNITS-P06-1789651962133 (one run, light)', weigh('record_revisions', 'TBUNITS-P06-1789651962133'))
const none = await time('zz-no-such-tag (population ZERO, control)', weigh('record_revisions', 'zz-no-such-tag'))

console.log('\n== the same shape on records, the query my Phase 0 attempt used')
const recHeavy = await time('records: a1deep', weigh('records', 'a1deep'))

console.log('\n== the whole weighing loop, once, as the test runs it')
const t0 = performance.now(); let loopErr = null; let rows = 0
for (const t of ledger.filter((t) => t !== 'a1deep' && t !== 'a1keep')) {
  const { count, error } = await weigh('record_revisions', t)()
  if (error) { loopErr = { tag: t, message: error.message, code: error.code }; break }
  rows += count ?? 0
}
const loopMs = performance.now() - t0
console.log(`weighing loop over ${ledger.length - 2} tags: ${(loopMs / 1000).toFixed(1)}s, rows matched in total ${rows}${loopErr ? `  ERROR ${JSON.stringify(loopErr)}` : ''}`)

console.log('\n== EXPLAIN, through PostgREST\'s plan media type')
try {
  const { data, error } = await db.from('record_revisions').select('id', { count: 'exact', head: false }).ilike('payload->>name', 'a1deep%').limit(1).explain({ analyze: true, format: 'text' })
  if (error) console.log(`explain ERROR ${JSON.stringify({ message: error.message, code: error.code, details: error.details, hint: error.hint })}`)
  else console.log(String(data))
} catch (e) { console.log(`explain THREW ${e.message}`) }

console.log('\n== summary')
console.log(JSON.stringify({ recordRevisions: rr.count, records: rec.count, ledgerTags: ledger.length,
  weighMinMs: { heavy: [heavy.count, Math.round(heavy.min)], pad: [pad.count, Math.round(pad.min)], light: [light.count, Math.round(light.min)], zero: [none.count, Math.round(none.min)] },
  recordsHeavyMinMs: [recHeavy.count, Math.round(recHeavy.min)], loopSeconds: +(loopMs / 1000).toFixed(1) }))
