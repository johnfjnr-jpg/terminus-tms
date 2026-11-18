#!/usr/bin/env node
// ── THE CALIBRATIONS STAGE: every source-injecting calibrator, in OS temp copies
//
//   node scripts/run-calibrations.mjs
//
// PROBE_TRIAGE R2 (John, 2026-11-18): "calibrators as one stage in an OS temp
// copy, never the served tree." Three calibrators run here:
//
//   golden-deals/calibrate.mjs       the golden deal stage and its stamp (17)
//   term-pricing/calibrate-ladder.mjs the price ladder's claims (26)
//   term-pricing/calibrate.mjs        the term pricing goldens and R-TP1 (100),
//                                     in four shards, one copy each
//
// ── WHY A COPY, AND WHY IT IS SAFE ───────────────────────────────────────
//
// Each calibrator injects faults into source and restores it byte for byte.
// Pointed at the served tree, an injection is live on the dev server for a
// second (it runs under --watch), and a killed run leaves it there. In a copy,
// the worst a killed run can do is leave a broken copy in the OS temp dir.
//
// Each calibrator takes its root from its own location or from its working
// directory, so run from inside a copy every injection lands in that copy.
// That is a property of THEIR code, so this stage does not trust it: it hashes
// every file under src/, scripts/, frontend-react/src/ and GOLDEN_DEALS.md in
// the SERVED tree before and after, and fails if one byte moved.
//
// ── WHY SHARDS ───────────────────────────────────────────────────────────
//
// The term pricing calibrator is 100 injections at about 1.15s each: 118s
// serial, which is half the round's whole +240s budget on its own. Run as four
// shards in four copies, at the same time as the other two, the stage is the
// slowest shard. The shards' printed ids are collected here and must cover the
// injection list EXACTLY once each, so a shard that silently ran nothing cannot
// read as a pass.
//
// The verdict is read from each calibrator's own closing line AND its exit
// code (Verification 16: the coarsest signal that cannot be misread, and the
// line that says WHICH claims fired).

import { cpSync, mkdtempSync, rmSync, symlinkSync, readdirSync, readFileSync, statSync, realpathSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const ROOT = realpathSync(new URL('..', import.meta.url).pathname)
const TMP = realpathSync(tmpdir())
const SHARDS = 4
const COPY = ['src', 'scripts', 'frontend', 'docs', 'package.json', 'GOLDEN_DEALS.md',
  'frontend-react/src', 'frontend-react/package.json']
const WATCHED = ['src', 'scripts', 'frontend-react/src', 'GOLDEN_DEALS.md']

const fail = (msg) => { console.log(`FAIL  ${msg}`); process.exitCode = 1 }

function walk(p, out = []) {
  const s = statSync(p)
  if (s.isDirectory()) { for (const e of readdirSync(p)) walk(join(p, e), out) } else out.push(p)
  return out
}
function treeHash() {
  const h = createHash('sha256')
  let n = 0
  for (const w of WATCHED) for (const f of walk(join(ROOT, w)).sort()) {
    h.update(relative(ROOT, f)); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); n++
  }
  return { hash: h.digest('hex'), files: n }
}

function makeCopy(label) {
  const dir = mkdtempSync(join(TMP, `tms-cal-${label}-`))
  // Refuse a copy that is not under the OS temp dir, or is inside the repo.
  if (!dir.startsWith(TMP + '/') || dir.startsWith(ROOT + '/')) throw new Error(`refusing copy dir ${dir}`)
  for (const p of COPY) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    cpSync(join(ROOT, p), join(dir, p), { recursive: true })
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'))
  return dir
}

function run(label, cwd, args, env = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('close', (code) => resolve({ label, code, out, ms: Date.now() - t0 }))
  })
}

const before = treeHash()
console.log(`served tree before: ${before.files} files, ${before.hash.slice(0, 16)}`)
const copies = []
try {
  const t0 = Date.now()
  const jobs = []
  const g = makeCopy('golden'); copies.push(g)
  jobs.push(run('golden', g, ['scripts/golden-deals/calibrate.mjs'], { TMS_SCRATCH: g }))
  const l = makeCopy('ladder'); copies.push(l)
  jobs.push(run('ladder', l, ['scripts/term-pricing/calibrate-ladder.mjs']))
  for (let i = 0; i < SHARDS; i++) {
    const c = makeCopy(`tp${i}`); copies.push(c)
    jobs.push(run(`term pricing ${i}/${SHARDS}`, c, ['scripts/term-pricing/calibrate.mjs'],
      { TP_CALIBRATE_DIR: join(c, '.tp-calibrate'), TP_CALIBRATE_SHARD: `${i}/${SHARDS}` }))
  }
  console.log(`${copies.length} copies under ${TMP} in ${Date.now() - t0}ms`)
  const results = await Promise.all(jobs)

  for (const r of results) {
    console.log(`${'='.repeat(72)}\n${r.label}  exit ${r.code}  ${r.ms}ms\n${'='.repeat(72)}\n${r.out.trimEnd()}`)
  }
  console.log('='.repeat(72))

  const golden = results.find((r) => r.label === 'golden')
  const gm = /^CALIBRATED: (\d+) of (\d+) fired, reverted green, every file byte-identical\.$/m.exec(golden.out)
  if (golden.code === 0 && gm && gm[1] === gm[2] && Number(gm[1]) > 0) console.log(`PASS  golden deals calibration: ${gm[1]} of ${gm[2]} fired (${golden.ms}ms)`)
  else fail(`golden deals calibration (exit ${golden.code}): ${gm ? `${gm[1]} of ${gm[2]}` : 'no CALIBRATED line'}`)

  const ladder = results.find((r) => r.label === 'ladder')
  const lm = /^(\d+)\/(\d+) FIRED; 0 SILENT$/m.exec(ladder.out)
  const lr = /^final reverted run: \d+ tests, 0 failing/m.test(ladder.out)
  if (ladder.code === 0 && lm && lm[1] === lm[2] && Number(lm[1]) > 0 && lr) console.log(`PASS  price ladder calibration: ${lm[1]}/${lm[2]} fired, reverted green (${ladder.ms}ms)`)
  else fail(`price ladder calibration (exit ${ladder.code}): ${lm ? `${lm[1]}/${lm[2]}` : 'no FIRED line'}, reverted ${lr ? 'green' : 'NOT green'}`)

  const shards = results.filter((r) => r.label.startsWith('term pricing'))
  const seen = []
  let total = null, shardOk = true
  for (const s of shards) {
    const head = /^injections: (\d+) of (\d+) \(shard/m.exec(s.out)
    const tail = /^(\d+)\/(\d+) injections behaved as expected$/m.exec(s.out)
    const rev = /^reverted: pass \d+, fail 0, \d+ms; files byte-identical: true$/m.test(s.out)
    const ids = [...s.out.matchAll(/^(\S+)\s+(FIRED|SILENT \(correct\)|SILENT|FIRED WRONGLY)/gm)].map((m) => m[1])
    seen.push(...ids)
    if (head) total = total ?? Number(head[2])
    const ok = s.code === 0 && head && tail && tail[1] === tail[2] && Number(tail[2]) === Number(head[1]) && ids.length === Number(head[1]) && rev
    if (!ok) { shardOk = false; fail(`${s.label} (exit ${s.code}): ${tail ? `${tail[1]}/${tail[2]}` : 'no verdict line'}, ${ids.length} ids, reverted ${rev ? 'green' : 'NOT green'}`) }
  }
  const unique = new Set(seen)
  if (total === null || seen.length !== total || unique.size !== total) {
    shardOk = false
    fail(`term pricing shards do not cover the list exactly once: ${seen.length} run, ${unique.size} distinct, ${total} in the list`)
  }
  if (shardOk) console.log(`PASS  term pricing calibration: ${total}/${total} behaved as expected, in ${SHARDS} shards (slowest ${Math.max(...shards.map((s) => s.ms))}ms)`)
} catch (e) {
  fail(`harness error: ${e.stack}`)
} finally {
  for (const c of copies) rmSync(c, { recursive: true, force: true })
  const after = treeHash()
  if (after.hash === before.hash && after.files === before.files) console.log(`PASS  the served tree is byte-identical: ${after.files} files, ${after.hash.slice(0, 16)}`)
  else fail(`THE SERVED TREE CHANGED during calibration: ${before.files} -> ${after.files} files, ${before.hash.slice(0, 16)} -> ${after.hash.slice(0, 16)}`)
  console.log(process.exitCode ? '\nCALIBRATIONS FAILED' : '\nALL CALIBRATIONS PASS')
}
