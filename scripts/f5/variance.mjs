// Which component carries the variance? If the NETWORK FLOOR - a single
// indexed row - swings as widely as the chunk, the variance is the
// connection and no query change can fix it. If only the chunk swings, the
// scan is the source.
import { admin, tagsToSweep } from '../fixtures.mjs'
const db = admin()
const stats = (r) => { const s = [...r].sort((a, b) => a - b)
  return { min: s[0], p50: s[Math.floor(s.length * 0.5)], p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1] } }
const sampleN = async (fn, n) => { const r = []; await fn()
  for (let i = 0; i < n; i++) { const t = Date.now(); await fn(); r.push(Date.now() - t) } return r }

const tags = tagsToSweep()
const weighed = []
for (const t of tags) weighed.push({ t, n: (await db.from('record_revisions')
  .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`)).count })
weighed.sort((a, b) => b.n - a.n)
const or3 = weighed.slice(0, 3).map((w) => `payload->>name.ilike.${w.t}%`).join(',')

const N = 25
const cases = {
  'network floor  (1 indexed row)': () => db.from('record_revisions').select('id').limit(1),
  'full scan      (0 rows back)  ': () => db.from('record_revisions').select('id, record_id')
    .ilike('payload->>name', 'zzzz-none-%').order('id', { ascending: true }).range(0, 999),
  'THE CHUNK      (3 tags, 1000) ': () => db.from('record_revisions').select('id, record_id').or(or3)
    .order('id', { ascending: true }).range(0, 999),
}
console.log(`  ${N} samples each, idle\n`)
console.log('  case                              min    p50    p90    max   spread')
const out = {}
for (const [name, fn] of Object.entries(cases)) {
  const s = stats(await sampleN(fn, N))
  out[name] = s
  console.log(`  ${name}  ${String(s.min).padStart(4)}  ${String(s.p50).padStart(5)}  ${String(s.p90).padStart(5)}  ${String(s.max).padStart(5)}   ${(s.max / s.min).toFixed(1)}x`)
}
const floor = out['network floor  (1 indexed row)']
const chunk = out['THE CHUNK      (3 tags, 1000) ']
console.log(`\n  the 889ms ceiling is crossed by the chunk's p90? ${chunk.p90 >= 889 ? 'YES' : 'no'}   (p90 ${chunk.p90}ms)`)
console.log(`  the FLOOR alone swings ${(floor.max / floor.min).toFixed(1)}x, max ${floor.max}ms`)
console.log(floor.max > 500
  ? '\n  THE CONNECTION ITSELF IS THE VARIANCE. A single indexed row takes\n  hundreds of ms at the tail, so no query change removes this - and a\n  single-sample assertion against a fixed ceiling will keep crossing it.'
  : '\n  the floor is stable, so the variance belongs to the scan or the fetch.')
