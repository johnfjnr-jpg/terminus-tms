// ── THE DECISIVE MEASUREMENT: the same statement, under the load the gate
// actually applies ──────────────────────────────────────────────────────
//
// Idle, the heaviest chunk medians ~408ms against an 889ms ceiling. Gate 2
// measured 1178ms. The scan component is only ~126ms of the idle total, so
// TABLE GROWTH cannot account for a 770ms excess.
//
// The gate runs TEN test files concurrently against one database. This
// samples the chunk while that is happening, which is the condition the
// test actually runs under and the one the ceiling was never derived for.
import { spawn } from 'node:child_process'
import { admin, tagsToSweep } from '../fixtures.mjs'
const db = admin()

const tags = tagsToSweep()
const weighed = []
for (const t of tags) weighed.push({ t, n: (await db.from('record_revisions')
  .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`)).count })
weighed.sort((a, b) => b.n - a.n)
const or3 = weighed.slice(0, 3).map((w) => `payload->>name.ilike.${w.t}%`).join(',')

const sample = async () => {
  const t = Date.now()
  const { error } = await db.from('record_revisions').select('id, record_id').or(or3)
    .order('id', { ascending: true }).range(0, 999)
  return error ? null : Date.now() - t
}

console.log('=== IDLE baseline, 6 samples ===')
const idle = []
for (let i = 0; i < 6; i++) idle.push(await sample())
idle.sort((a, b) => a - b)
console.log(`  ${idle.join(', ')}  median ${idle[3]}ms`)

console.log('\n=== UNDER LOAD: sampling while npm run test:db runs ===')
const child = spawn('npm', ['run', 'test:db'], { cwd: '/Users/johnfryatt/terminus-tms', stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 4000))   // let the ten files get going
const loaded = []
while (child.exitCode === null && loaded.length < 30) {
  const ms = await sample()
  if (ms !== null) loaded.push(ms)
  await new Promise((r) => setTimeout(r, 400))
}
child.kill('SIGTERM')
loaded.sort((a, b) => a - b)
const med = loaded[Math.floor(loaded.length / 2)]
console.log(`  ${loaded.length} samples: min ${loaded[0]}ms  median ${med}ms  max ${loaded[loaded.length - 1]}ms`)
console.log(`  over the 889ms ceiling: ${loaded.filter((x) => x >= 889).length} of ${loaded.length}`)

console.log('\n=== VERDICT ===')
console.log(`  idle median      ${idle[3]}ms`)
console.log(`  loaded median    ${med}ms   (${(med / idle[3]).toFixed(1)}x)`)
console.log(`  gate 2 measured  1178ms`)
console.log(med > idle[3] * 1.8
  ? '  CONTENTION IS THE DOMINANT TERM. The ceiling was derived for cold cache\n  and margin, and never for the concurrency the suite itself creates.'
  : '  contention does NOT explain the excess; look elsewhere.')
