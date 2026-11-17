#!/usr/bin/env node
// ── TP_LADDER: RE-DERIVE THE GOLDEN FIGURES THAT MOVED, AS JOHN RULED ─────
//
//   node scripts/term-pricing/derive-v2-goldens.mjs            report only
//   node scripts/term-pricing/derive-v2-goldens.mjs --apply    rewrite literals
//
// Ruling (TP_LADDER_BRIEF.md, "Ruling on the golden figures"): SPLIT.
//   PRICE ARITHMETIC  from independent-price.mjs, written from the spec alone;
//   MECHANICS         from v1-oracle.mjs, v1.10 at e123cf6 with only the list
//                     fee read swapped for the price ladder.
//
// How: the golden test file is copied with its engine import pointed at one of
// the two, and its \`assert\` replaced by a recorder that logs every equal and
// deepEqual whose expected and actual differ, with the source line, instead of
// throwing. Each derivation runs the WHOLE file; a case is scored only by the
// derivation its class names. For PRICE cases the oracle runs too, and the
// two must agree on every recorded line, or nothing is applied: two
// independent routes to one figure is the check.
//
// Each literal is replaced where it is written: on the assertion line if it is
// there, otherwise on the ONE line of the file holding it (a table row); a
// literal found on no line or on several is reported, never guessed. Edits go
// through scripts/lib/edit.mjs, so each is journalled. UNWIRED: a derivation
// tool, run once per derivation and recorded in the round report.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildOracle } from './v1-oracle.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const TEST = 'scripts/tests/term-pricing.test.mjs'
const WORK = join(ROOT, '.scratch/derive-v2')
const APPLY = process.argv.includes('--apply')

// The classes, by test name, as ruled: price arithmetic, or mechanics on it.
// The 10.4 shape checks (fee-table terms, a broken set has no figures) and
// v1.7 (C1), which runs a CPI, are not price arithmetic: the oracle scores them.
const PRICE = /^(10\.[1-3] |10\.1|10\.2|10\.3|T[1-9] |T1[0-4] |T4 and|T7 and|T19|T23|T29|T31|B-1 to B-6|BG-|TB-1|flow: a product's bands|v1\.5)/

const RECORDER = `
import real from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
const OUT = process.env.DERIVE_RECORD
const ser = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x))
const site = () => {
  const line = new Error().stack.split('\\n').find((l) => l.includes('derive-copy.test.mjs'))
  const m = line && line.match(/:(\\d+):\\d+\\)?$/)
  return m ? Number(m[1]) : null
}
const rec = (kind, actual, expected) => appendFileSync(OUT, ser({ line: site(), kind, actual, expected }) + '\\n')
const a = (v, m) => real.ok(v, m)
Object.assign(a, real)
a.equal = (actual, expected, m) => { try { real.equal(actual, expected, m) } catch { rec('equal', actual, expected) } }
a.deepEqual = (actual, expected, m) => { try { real.deepEqual(actual, expected, m) } catch { rec('deepEqual', actual, expected) } }
export default a
`

function runWith(name, enginePath) {
  const dir = join(WORK, name)
  if (existsSync(dir)) rmSync(dir, { recursive: true })
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'recorder.mjs'), RECORDER)
  let src = readFileSync(join(ROOT, TEST), 'utf8')
  const swaps = [
    ["'../../src/lib/term-pricing.js'", `'${pathToFileURL(enginePath).href}'`],
    ["'node:assert/strict'", `'${pathToFileURL(join(dir, 'recorder.mjs')).href}'`],
    ["'../term-pricing/capture-factoring-off-baseline.mjs'", `'${pathToFileURL(join(ROOT, 'scripts/term-pricing/capture-factoring-off-baseline.mjs')).href}'`],
    ["new URL('../term-pricing/factoring-off-baseline.json', import.meta.url)", `new URL('${pathToFileURL(join(ROOT, 'scripts/term-pricing/factoring-off-baseline.json')).href}')`],
  ]
  for (const [from, to] of swaps) {
    if (!src.includes(from)) throw new Error(`the test file no longer contains ${from}`)
    src = src.replaceAll(from, to)
  }
  const copy = join(dir, 'derive-copy.test.mjs')
  writeFileSync(copy, src)
  const out = join(dir, 'records.jsonl')
  writeFileSync(out, '')
  let report = ''
  try { report = execFileSync(process.execPath, ['--test', copy], { env: { ...process.env, DERIVE_RECORD: out }, stdio: 'pipe', encoding: 'utf8' }) }
  catch (e) { report = String(e.stdout ?? '') + String(e.stderr ?? '') }
  // Verification 48: a run that produced no result is a STOP, never a score. A
  // copy that failed to load reports one test; the file has over a hundred.
  const ran = Number(report.match(/^ℹ tests (\d+)/m)?.[1] ?? 0)
  if (ran < 100) throw new Error(`the ${name} run did not run the file (${ran} test(s)):\n${report.slice(0, 1500)}`)
  return readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

const lines = readFileSync(join(ROOT, TEST), 'utf8').split('\n')
const testAt = (ln) => {
  for (let i = ln - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*test\(\s*[`'](.+?)[`'],/)
    if (m) return m[1].replace(/\$\{T\}/, 'T')
  }
  return null
}
const key = (r) => `${r.line}|${JSON.stringify(r.expected)}`

const oraclePath = buildOracle(join(WORK, 'oracle-engine'))
const oracle = runWith('oracle', oraclePath)
const indep = runWith('independent', join(ROOT, 'scripts/term-pricing/independent-price.mjs'))
const oracleBy = new Map(oracle.map((r) => [key(r), r]))

const chosen = []
const disagreements = []
for (const r of oracle) {
  const name = testAt(r.line)
  if (!name || PRICE.test(name)) continue
  chosen.push({ ...r, name, source: 'oracle' })
}
for (const r of indep) {
  const name = testAt(r.line)
  if (!name || !PRICE.test(name)) continue
  const o = oracleBy.get(key(r))
  if (!o || JSON.stringify(o.actual) !== JSON.stringify(r.actual)) disagreements.push({ name, line: r.line, expected: r.expected, independent: r.actual, oracle: o?.actual ?? '(oracle matched the old figure)' })
  chosen.push({ ...r, name, source: 'independent' })
}
// A price line the oracle moved but the independent pricer did not reach.
for (const r of oracle) {
  const name = testAt(r.line)
  if (name && PRICE.test(name) && !indep.some((i) => key(i) === key(r))) disagreements.push({ name, line: r.line, expected: r.expected, independent: '(no record: the pricer agreed with the old figure or did not run it)', oracle: r.actual })
}

console.log(`records: oracle ${oracle.length}, independent ${indep.length}; chosen ${chosen.length} (independent ${chosen.filter((c) => c.source === 'independent').length}, oracle ${chosen.filter((c) => c.source === 'oracle').length})`)
console.log(`price cases where the two derivations disagree: ${disagreements.length}`)
for (const d of disagreements) console.log('  DISAGREE', JSON.stringify(d))

// ── The replacements: literal by literal, where it is written ──
const q = (s) => `'${s}'`
const pairsOf = (r) => {
  if (typeof r.expected === 'string' && typeof r.actual === 'string') return [[r.expected, r.actual]]
  if (Array.isArray(r.expected) && Array.isArray(r.actual) && r.expected.length === r.actual.length) {
    return r.expected.flatMap((e, i) => (typeof e === 'string' && typeof r.actual[i] === 'string' && e !== r.actual[i] ? [[e, r.actual[i]]] : []))
  }
  return null
}
const plan = []
const unresolved = []
for (const r of chosen) {
  const pairs = pairsOf(r)
  if (!pairs || !pairs.length) { unresolved.push({ ...r, why: pairs ? 'the difference is not in a string literal' : 'not a string or string array' }); continue }
  // The row: the assertion line, or the one line holding EVERY expected literal.
  const needles = pairs.map(([e]) => q(e))
  let at = needles.every((n) => lines[r.line - 1]?.includes(n)) ? r.line - 1 : -1
  if (at < 0) {
    const hits = lines.map((l, i) => (needles.every((n) => l.includes(n)) ? i : -1)).filter((i) => i >= 0)
    if (hits.length === 1) at = hits[0]
    else { unresolved.push({ ...r, why: `${hits.length} lines hold the expected literal(s)` }); continue }
  }
  plan.push({ at, pairs, name: r.name, source: r.source })
}
console.log(`replacements planned: ${plan.length}; unresolved: ${unresolved.length}`)
for (const u of unresolved) console.log('  UNRESOLVED', u.name, 'line', u.line, u.why, JSON.stringify(u.expected), '->', JSON.stringify(u.actual))
// ── Nested arrays, spread over several lines: replaced inside the test's OWN
// body only, and only where each changed literal maps to ONE new value across
// every record of that test. A literal with two targets is left for a person.
const leaves = (v, out = []) => { if (Array.isArray(v)) v.forEach((x) => leaves(x, out)); else out.push(v); return out }
const bodies = []
for (const r of unresolved.filter((u) => u.why === 'the difference is not in a string literal' || /lines hold/.test(u.why))) {
  const ex = leaves(r.expected), ac = leaves(r.actual)
  if (ex.length !== ac.length) continue
  let start = r.line - 1
  while (start > 0 && !/^\s*test\(/.test(lines[start])) start--
  const b = bodies.find((x) => x.start === start) ?? (bodies.push({ start, end: r.line - 1, name: r.name, map: new Map(), bad: new Set() }), bodies[bodies.length - 1])
  let end = r.line - 1
  while (end < lines.length - 1 && !/^\}\)/.test(lines[end])) end++
  b.end = Math.max(b.end, end)
  ex.forEach((e, i) => {
    if (typeof e !== 'string' || typeof ac[i] !== 'string' || e === ac[i]) return
    if (b.map.has(e) && b.map.get(e) !== ac[i]) b.bad.add(e)
    b.map.set(e, ac[i])
  })
}
const bodyPlan = []
for (const b of bodies) {
  for (const e of b.bad) console.log('  TWO TARGETS, left for a person:', b.name, e)
  for (const [e, a] of b.map) {
    if (b.bad.has(e)) continue
    for (let i = b.start; i <= b.end; i++) if (lines[i].includes(q(e))) bodyPlan.push({ at: i, pairs: [[e, a]], name: b.name, source: 'body' })
  }
}
console.log(`body replacements planned: ${bodyPlan.length} across ${bodies.length} test(s)`)
plan.push(...bodyPlan)
writeFileSync(join(WORK, 'plan.json'), JSON.stringify({ disagreements, plan, unresolved }, (k, x) => (typeof x === 'bigint' ? `${x}n` : x), 1))

if (APPLY) {
  if (disagreements.length) { console.log('NOT APPLIED: the two derivations disagree on a price case.'); process.exit(2) }
  const { beginBatch, edit, endBatch } = await import('../lib/edit.mjs')
  beginBatch('TP_LADDER P1: golden figures re-derived as ruled (split)')
  const byLine = new Map()
  for (const p of plan) {
    const cur = byLine.get(p.at) ?? lines[p.at]
    let next = cur
    for (const [e, a] of p.pairs) {
      const n = next.split(q(e)).length - 1
      if (n < 1) continue
      next = p.source === 'body' ? next.replaceAll(q(e), q(a)) : next.replace(q(e), q(a))
    }
    byLine.set(p.at, next)
  }
  const text = () => readFileSync(join(ROOT, TEST), 'utf8')
  for (const [at, next] of byLine) {
    const cur = text().split('\n')
    let k = 0, old
    for (;;) {
      old = cur.slice(Math.max(0, at - k), at + k + 1).join('\n')
      if (text().split(old).length - 1 === 1) break
      if (++k > 6) throw new Error(`no unique window for line ${at + 1}`)
    }
    const win = cur.slice(Math.max(0, at - k), at + k + 1)
    win[Math.min(k, at)] = next
    edit(TEST, old, win.join('\n'))
  }
  endBatch()
  console.log(`applied ${byLine.size} line(s)`)
}
