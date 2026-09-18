// K3: per-test durations of the database suite, compared across runs.
// Reads the spec reporter's top-level lines, "✔ name (Nms)", from either a raw
// `npm run test:db` capture or the database section of a gate output file.
import { readFileSync } from 'node:fs'
const [, , ...files] = process.argv
const parse = (f) => {
  let text = readFileSync(f, 'utf8')
  const s = text.search(/^database suite\s+\(npm run test:db\)/m)
  if (s >= 0) { const rest = text.slice(s); const e = rest.slice(1).search(/^={10,}\n[A-Za-z][^\n]*\s{2}\((?:npm|node)/m); text = e >= 0 ? rest.slice(0, e + 1) : rest }
  const total = (text.match(/exit: \d+\s+in (\d+)ms/) ?? [])[1]
  const seen = new Map(); const tests = new Map()
  for (const m of text.matchAll(/^[✔✖] (.+) \(([\d.]+)ms\)$/gm)) {
    const n = (seen.get(m[1]) ?? 0) + 1; seen.set(m[1], n)
    tests.set(n > 1 ? `${m[1]} #${n}` : m[1], Number(m[2]))
  }
  const sum = [...tests.values()].reduce((a, b) => a + b, 0)
  return { f, total: total ? Number(total) : null, tests, sum }
}
const runs = files.map(parse)
for (const r of runs) console.log(`${r.f.split('/').pop()}: ${r.tests.size} top-level tests, sum ${(r.sum / 1000).toFixed(1)}s${r.total ? `, stage ${(r.total / 1000).toFixed(1)}s` : ''}`)
if (runs.length < 2) process.exit(0)
const base = runs[0]
const cmp = runs.slice(1)
const names = [...base.tests.keys()].filter((n) => cmp.every((r) => r.tests.has(n)))
console.log(`\ntests present in every run: ${names.length}; only in later runs: ${[...cmp.at(-1).tests.keys()].filter((n) => !base.tests.has(n)).length}`)
const rows = names.map((n) => ({ n, b: base.tests.get(n), c: cmp.map((r) => r.tests.get(n)) }))
  .map((x) => ({ ...x, minC: Math.min(...x.c), d: Math.min(...x.c) - x.b }))
const grew = rows.filter((x) => x.d > 0).reduce((a, x) => a + x.d, 0)
console.log(`summed growth over shared tests, base -> min(later): +${(grew / 1000).toFixed(1)}s`)
const top = [...rows].sort((a, b) => b.d - a.d).slice(0, 12)
console.log('\nlargest movers (base ms -> each later run ms, delta against the later minimum):')
for (const x of top) console.log(`  +${(x.d / 1000).toFixed(1)}s  ${x.b.toFixed(0)} -> ${x.c.map((v) => v.toFixed(0)).join(' / ')}  ${x.n.slice(0, 110)}`)
const share = top.slice(0, 5).reduce((a, x) => a + x.d, 0) / (grew || 1)
console.log(`\nthe top 5 movers account for ${(share * 100).toFixed(0)}% of the summed growth`)
const newOnes = [...cmp.at(-1).tests.entries()].filter(([n]) => !base.tests.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 6)
console.log(`\ntests absent from the base run, longest in the latest run: ${newOnes.map(([n, v]) => `${(v / 1000).toFixed(1)}s ${n.slice(0, 70)}`).join(' | ') || 'none'}`)
console.log(`summed time of tests absent from the base: ${([...cmp.at(-1).tests.entries()].filter(([n]) => !base.tests.has(n)).reduce((a, [, v]) => a + v, 0) / 1000).toFixed(1)}s`)
