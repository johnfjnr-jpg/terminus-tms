// PHASE 0 (c): WHY DOES THE ROUTE COST WHAT IT COSTS?
//
// Three candidate mechanisms, and the fix differs for each: CONCURRENCY
// (N copies contend), PAYLOAD (the answer is large), or THE ROUTE (it is
// simply slow and the tail is its own variance).
//
// THE DISCRIMINATOR IS HOW LATENCY MOVES WITH N. If eight concurrent cost
// ~T each, concurrency is free. If they cost ~8T each, the pile-up IS the
// mechanism.
//
// ── IT GOES THROUGH `api()`, AND THE FIRST VERSION DID NOT ──────────────
//
// Written with a raw `fetch` and refused by `api-client.test.mjs`, correctly.
// A raw fetch does not throw on a non-2xx, so a 401 would have been TIMED AS
// A FAST SUCCESS and reported as a healthy sub-second route - Verification
// 48's shape, a stage that fails faster than it could do its work, arriving
// inside a performance measurement where a small number is the good news.
//
// Verification 48 also says never to assert a single duration against a
// threshold, so every cell is sampled and the MINIMUM is reported beside the
// median: timing noise is additive, so the minimum is a lower bound on the
// true cost and discards exactly the samples that are noise.
//
// UNWIRED: needs a live server and a signed-in session.
import { api } from '../api-client.mjs'

const once = async (path) => {
  const t = Date.now()
  const r = await api('GET', path)          // throws on non-2xx
  const ms = Date.now() - t
  return { ms, n: Array.isArray(r.data) ? r.data.length : null,
    bytes: JSON.stringify(r.data ?? null).length }
}
const stat = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return { min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1], q: (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] }
}

console.log('=== the route alone, 30 serial samples ===')
const serial = []
let shape = null
for (let i = 0; i < 30; i++) { const r = await once('/contacts'); serial.push(r.ms); shape = r }
const ss = stat(serial)
console.log(`  min ${ss.min}  p50 ${ss.q(0.5)}  p75 ${ss.q(0.75)}  p90 ${ss.q(0.9)}  p95 ${ss.q(0.95)}  max ${ss.max}  (spread ${(ss.max / ss.min).toFixed(1)}x)`)
console.log(`  ${shape.bytes} bytes for ${shape.n} contacts (${Math.round(shape.bytes / Math.max(shape.n, 1))} each)`)

console.log('\n=== CONCURRENCY: N identical requests fired together ===')
console.log('  N    each: min / median / max      wall    per-request vs N=1')
for (const n of [1, 2, 4, 8]) {
  const t0 = Date.now()
  const rs = await Promise.all(Array.from({ length: n }, () => once('/contacts')))
  const wall = Date.now() - t0
  const st = stat(rs.map((r) => r.ms))
  console.log(`  ${String(n).padStart(2)}   ${String(st.min).padStart(5)} / ${String(st.med).padStart(6)} / ${String(st.max).padStart(5)} ms`
    + `     ${String(wall).padStart(5)}ms    x${(st.med / ss.q(0.5)).toFixed(1)}`)
}

console.log('\n=== IS IT THIS ROUTE, OR ANY ROUTE? ===')
for (const p of ['/stage-definitions?record_type=contact', '/industries']) {
  const rs = []
  for (let i = 0; i < 6; i++) rs.push(await once(p))
  const st = stat(rs.map((r) => r.ms))
  console.log(`  ${p.padEnd(40)} min ${String(st.min).padStart(4)}  median ${String(st.med).padStart(4)}  (${rs[0].bytes} bytes)`)
}

console.log('\n=== AND THE SCOPED CALL, which W3 already uses ===')
const accounts = await api('GET', '/accounts')
const accId = (accounts.data ?? [])[0]?.id
if (accId) {
  const rs = []
  for (let i = 0; i < 6; i++) rs.push(await once(`/contacts?account_id=${accId}`))
  const st = stat(rs.map((r) => r.ms))
  console.log(`  scoped   min ${st.min}  median ${st.med}  max ${st.max}  (${rs[0].bytes} bytes, ${rs[0].n} rows)`)
  console.log('  -> a 10x smaller answer costs about the same, so the cost is not row count')
}

console.log('\n=== WHAT THE PILE-UP COSTS: draws from the tail ===')
for (const X of [1200, 1500, 2000]) {
  const p = serial.filter((v) => v > X).length / serial.length
  const atLeastOne = (n) => 1 - Math.pow(1 - p, n)
  console.log(`  P(one draw > ${X}ms) = ${(p * 100).toFixed(0)}%`
    + `   P(slowest of 5 > ${X}ms) = ${(atLeastOne(5) * 100).toFixed(0)}%`
    + `   of 2 = ${(atLeastOne(2) * 100).toFixed(0)}%`
    + `   of 1 = ${(atLeastOne(1) * 100).toFixed(0)}%`)
}
