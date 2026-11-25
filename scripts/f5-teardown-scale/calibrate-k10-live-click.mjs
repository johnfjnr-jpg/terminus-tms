#!/usr/bin/env node
// F5_TEARDOWN_SCALE, ruling K3 of 2026-11-25: calibrate the K10 live-click
// instrument in scripts/probe-term-quote-tab-click.mjs.
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/f5-teardown-scale/calibrate-k10-live-click.mjs
//
// Needs the dev server on :3000 and a live session-ref.json. About four
// minutes: three runs of the probe.
//
// THE CLAIMS:
//   COVER     a transparent cover over the viewport at the click FIRES the
//             named failure, and the reading names the cover as the hit.
//   DISABLED  the control disabled in the DOM FIRES the named failure, and
//             the reading says disabled.
//   reverted  the probe as it stands passes every check.
//
// EACH RUN ON A TEMP COPY (Verification 44), each injection a run of its own
// (Verification 51). The copy's probe is the WORKING TREE's bytes, recorded by
// hash so the commit can be shown to carry exactly what was calibrated. A
// verdict is read from the named check text, never the exit code
// (Verification 9's clause). Each run has its own tag; the harness re-reads
// that tag from the database and requires zero live records left.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tagOr } from '../lib/tag-filter.mjs'

const REPO = '/Users/johnfryatt/terminus-tms'
const PROBE = 'scripts/probe-term-quote-tab-click.mjs'
const OUT = join(REPO, '.verify', 'f5-teardown-scale')
const RUN_ID = Date.now().toString(36)
mkdirSync(OUT, { recursive: true })
if (!process.env.PUPPETEER_PATH) { console.error('refused: no PUPPETEER_PATH, so the probe cannot run'); process.exit(2) }

const SRC = readFileSync(join(REPO, PROBE), 'utf8')
const SHA = createHash('sha256').update(SRC).digest('hex').slice(0, 16)
const COPY = mkdtempSync(join(tmpdir(), 'f5-k10-cal-'))
execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${COPY}"`])
for (const f of ['node_modules', '.env', 'session-ref.json']) symlinkSync(join(REPO, f), join(COPY, f))
if (existsSync(join(COPY, '.scratch'))) { console.error('refused: the copy carries a .scratch ledger'); process.exit(2) }
const MARKER = join(COPY, '.calibration-in-flight')
writeFileSync(MARKER, RUN_ID)

const inject = (src, anchor, replacement) => {
  const n = src.split(anchor).length - 1
  if (n !== 1) throw new Error(`anchor occurs ${n} times: ${anchor.slice(0, 80)}`)
  const out = src.replace(anchor, replacement)
  if (out === src) throw new Error('the injection did not change the source')
  return out
}
const ANCHOR = "  const clickedComm = await clickWhenLive("
const COMM = '#opp-tab-term [data-testid="pm-commercials"]'
const undo = "  await page.evaluate(() => document.getElementById('k3-cover')?.remove())\n"
const COVER = "  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'k3-cover'; Object.assign(d.style, { position: 'fixed', inset: '0', zIndex: '99999', background: 'transparent' }); document.body.appendChild(d) })\n"
const DISABLE = `  await page.$eval('${COMM}', (e) => { e.disabled = true })\n`
const NAMED = /FAIL {2}K10 pm-commercials: #opp-tab-term \[data-testid="pm-commercials"\] present, enabled and on top within 10000ms {2}\[(.*)\]/
const RUNS = [
  { id: 'COVER', src: inject(SRC, ANCHOR, COVER + ANCHOR).replace(/(const clickedComm = await clickWhenLive\([^\n]*\n)/, `$1${undo}`),
    want: (t) => { const m = t.match(NAMED); return !!m && /"hit":"div#k3-cover"/.test(m[1]) && /"onTop":false/.test(m[1]) },
    expect: 'FAILS the named live check, the reading naming div#k3-cover as the hit' },
  { id: 'DISABLED', src: inject(SRC, ANCHOR, DISABLE + ANCHOR),
    want: (t) => { const m = t.match(NAMED); return !!m && /"disabled":true/.test(m[1]) },
    expect: 'FAILS the named live check, the reading saying disabled true' },
  { id: 'reverted', src: SRC,
    want: (t, code) => code === 0 && /^(\d+)\/\1 checks passed$/m.test(t) && /K10 pm-commercials at click: .*"onTop":true/.test(t),
    expect: 'exit 0, every check passed, the at-click reading on top' },
]

const fixtures = await import(pathToFileURL(join(COPY, 'scripts/fixtures.mjs')).href)
const db = fixtures.admin()
async function liveLeft(tag) {
  const { data, error } = await db.from('record_revisions').select('record_id').or(tagOr([tag])).range(0, 999)
  if (error) throw new Error(`residue read ${tag}: ${error.message}`)
  const ids = [...new Set(data.map((r) => r.record_id))]
  if (!ids.length) return { ids: 0, live: 0 }
  const { count, error: e2 } = await db.from('records').select('id', { count: 'exact', head: true }).in('id', ids).is('deleted_at', null)
  if (e2) throw new Error(`residue count ${tag}: ${e2.message}`)
  return { ids: ids.length, live: count }
}

const runProbe = (tag) => new Promise((resolve) => {
  const t0 = Date.now()
  const p = spawn(process.execPath, ['--env-file=.env', PROBE, tag], { cwd: COPY, stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
  let text = ''
  p.stdout.on('data', (d) => { text += d }); p.stderr.on('data', (d) => { text += d })
  p.on('exit', (code) => resolve({ code, text, ms: Date.now() - t0 }))
})

console.log(`probe sha256 ${SHA} (working tree)`)
let stopped = null
let good = 0
for (const run of RUNS) {
  writeFileSync(join(COPY, PROBE), run.src)
  if (readFileSync(join(COPY, PROBE), 'utf8') !== run.src) { stopped = `${run.id}: the copy's probe did not read back as written`; break }
  const tag = `k3cal${RUN_ID}${run.id.toLowerCase()}`
  const r = await runProbe(tag)
  writeFileSync(join(OUT, `${RUN_ID}-k10-${run.id}.txt`), r.text)
  // A run that printed no result did not run (Verification 48): stop, never score it.
  if (!/\d+\/\d+ checks passed/.test(r.text)) { stopped = `${run.id}: no result line after ${r.ms}ms, so it did not run`; break }
  const left = await liveLeft(tag)
  const ok = run.want(r.text, r.code) && left.live === 0 && left.ids > 0
  if (ok) good++
  console.log(`${run.id.padEnd(9)} ${ok ? 'AS EXPECTED' : 'NOT AS EXPECTED'}  exit ${r.code}  ${r.ms}ms  tag ${tag}: ${left.ids} records, ${left.live} live`)
  console.log(`          expected: ${run.expect}`)
  for (const l of r.text.split('\n').filter((x) => /K10|checks passed/.test(x))) console.log(`          ${l.trim().slice(0, 300)}`)
  if (left.live) { stopped = `${run.id}: ${left.live} live records of its tag remain`; break }
  if (!ok) { stopped = `${run.id} not as expected`; break }
}
if (readFileSync(join(COPY, PROBE), 'utf8') !== SRC && !stopped) stopped = "the copy does not end on the working tree's probe"
if (stopped) { console.log(`STOPPED: ${stopped}. Copy left at ${COPY} with its in-flight marker.`); process.exit(3) }
rmSync(MARKER)
rmSync(COPY, { recursive: true, force: true })
console.log(`${good}/${RUNS.length} as expected; probe sha256 ${SHA}; transcripts in ${OUT}/${RUN_ID}-k10-*.txt`)
