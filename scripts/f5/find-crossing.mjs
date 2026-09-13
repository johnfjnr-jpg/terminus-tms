// Where does a GENUINE cost increase move the median past the ceiling?
// Needed for the sensitivity half: the injection must be a real increase in
// the statement's work, not a lowered threshold (Verification 47 - take the
// threshold from the requirement, never from the result).
import { admin, tagsToSweep } from '../fixtures.mjs'
const db = admin()
const tags = tagsToSweep()
const weighed = []
for (const t of tags) weighed.push({ t, n: (await db.from('record_revisions')
  .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`)).count })
weighed.sort((a, b) => b.n - a.n)

const medianFor = async (n) => {
  const or = weighed.slice(0, n).map((w) => `payload->>name.ilike.${w.t}%`).join(',')
  const r = []
  await db.from('record_revisions').select('id, record_id').or(or).order('id', { ascending: true }).range(0, 999)
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now()
    await db.from('record_revisions').select('id, record_id').or(or).order('id', { ascending: true }).range(0, 999)
    r.push(Date.now() - t0)
  }
  const rows = (await db.from('record_revisions').select('id', { count: 'exact', head: true }).or(or)).count
  return { n, rows, med: [...r].sort((a, b) => a - b)[2], all: r }
}
console.log('  tags  rows walked   median ms   vs 889 ceiling')
for (const n of [3, 8, 16, 24, 33]) {
  if (n > weighed.length) continue
  const r = await medianFor(n)
  console.log(`  ${String(r.n).padStart(4)}  ${String(r.rows).padStart(11)}   ${String(r.med).padStart(9)}   ${r.med >= 889 ? 'OVER  <- crosses here' : 'under'}   [${r.all.join(', ')}]`)
}
