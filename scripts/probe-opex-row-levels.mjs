// ── P-RS1: THE ROWS MUST NOT MOVE ───────────────────────────────────────
//
// John's ruling 2026-09-30. Candidate B re-points the fee table's grid
// placement onto a wrapper, and the one thing that must not change is where
// the fee rows and the invoicing rows sit relative to each other.
//
// ── WHY IT IS MEASURED ON MAIN FIRST ────────────────────────────────────
//
// "Unchanged" is a claim about a PAIR of readings, and a probe written after
// the change can only ever report the second one. The baseline is taken on
// main - where the reset control does not exist at all - and written to a
// file, so the comparison has something on both sides (Verification 14).
//
// ── AND WHY THE TOPS ARE RELATIVE ───────────────────────────────────────
//
// Absolute viewport tops move with scroll position and with anything above
// the card, neither of which is the claim. Every row is measured against the
// `.opex-tables` grid's own top, so the reading survives the page around it.
//
// ── THE BASELINE IS A COMMITTED FIXTURE, NOT A RUN ──────────────────────
//
// `scripts/baselines/opex-row-levels-main.json` was recorded on main at
// 518c591, BEFORE candidate B existed, and is committed so the comparison has
// a fixed side. A baseline regenerated beside the change would agree with the
// change by construction.
//
// Usage:
//   node --env-file=.env scripts/probe-opex-row-levels.mjs            compare
//   node --env-file=.env scripts/probe-opex-row-levels.mjs --record   re-record
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-opex-row-levels.mjs')
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const BASELINE = 'scripts/baselines/opex-row-levels-main.json'
const RECORD = process.argv.includes('--record')
const OUT_FILE = process.argv.find((a) => a.endsWith('.json') && a !== BASELINE)
const ROOT = process.cwd()
mkdirSync(`${ROOT}/.verify/opex-reset/`, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'ROWLEVEL'

const BASE = {
  paymentMode: 'opex', structure: 'single',
  ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
  duration: 60, targetMargin: 30, warrantyPct: 0,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
  invoicing: 'monthly',
}
// BOTH STATES, per the ruling. On main neither carries a control; the rows
// must be identical in both anyway, and a state that only exists on the
// branch could not be compared at all.
const STATES = {
  'overrides-present': { ...BASE, opexUnitFees: { ss: 700 }, opexUnitMargins: { aq: 41 } },
  'no-overrides': { ...BASE },
}

const made = {}
for (const [name, payload] of Object.entries(STATES)) {
  const { oppId } = await freshOpportunity(`${TAG}${name.replace(/[^a-z]/gi, '').toUpperCase()}`)
  const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { payload, expected_revision: rev })
  made[name] = oppId
}

const result = {}
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const [state, oppId] of Object.entries(made)) {
    for (const width of [1920, 1240]) {
      await p.setViewport({ width, height: 1200 })
      await p.reload({ waitUntil: 'networkidle0' })
      await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
      await p.waitForFunction(() => {
        const v = document.getElementById('view-opportunity-detail')
        return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
      }, { timeout: 25000 })
      await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
      await p.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"] tbody tr'),
        { timeout: 25000 })
      await p.evaluate(() => document.fonts.ready)
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

      const m = await p.evaluate(() => {
        const grid = document.getElementById('deal-opex-tables')
        const g = grid.getBoundingClientRect()
        const rel = (el) => {
          const r = el.getBoundingClientRect()
          return { top: Math.round(r.top - g.top), left: Math.round(r.left - g.left),
            right: Math.round(r.right - g.left), height: Math.round(r.height) }
        }
        const feeRows = [...document.querySelectorAll('[data-testid="deal-opex-table"] tbody tr')]
          .map((tr) => ({ label: (tr.querySelector('td')?.textContent || '').trim(), ...rel(tr) }))
        const yearRows = [...document.querySelectorAll('#deal-opex-year-slot .ys-line')]
          .map((d) => ({ label: (d.querySelector('.ys-year')?.textContent || '').trim(), ...rel(d) }))
        const table = document.querySelector('[data-testid="deal-opex-table"]')
        return {
          gridWidth: Math.round(g.width),
          table: rel(table),
          feeRows, yearRows,
          // THE RELATIONSHIP, stated as a number: how far each fee row sits
          // from the invoicing row beside it. This is what "level" means, and
          // it is what must not move.
          levels: feeRows.map((f, i) => (yearRows[i] ? f.top - yearRows[i].top : null)),
        }
      })
      result[`${state}@${width}`] = m
      console.log(`${state} @ ${width}: fee ${m.feeRows.length} rows, invoicing ${m.yearRows.length} rows, levels [${m.levels.join(', ')}]`)
    }
  }
} finally {
  await b.close()
  for (const name of Object.keys(STATES)) {
    await tearDown(`${TAG}${name.replace(/[^a-z]/gi, '').toUpperCase()}`)
  }
}

const text = JSON.stringify(result, null, 1)
if (OUT_FILE) { writeFileSync(OUT_FILE, text); console.log(`\nwritten to ${OUT_FILE}`) }

if (RECORD) {
  writeFileSync(BASELINE, text)
  console.log(`baseline RE-RECORDED to ${BASELINE}. This is only correct from main.`)
  process.exit(0)
}

// ── P-RS1 ASSERTION (1): THE ROWS HAVE NOT MOVED ───────────────────────
//
// Compared against the committed baseline, not against a reading taken in the
// same run. The comparison is over the WHOLE measurement - every row's top,
// left, right and height, the table's box and the grid width - rather than
// over the levels alone, because a change that moved the table and the
// invoicing block together would leave the levels identical and the screen
// different.
const expected = JSON.parse(readFileSync(BASELINE, 'utf8'))
const keys = [...new Set([...Object.keys(expected), ...Object.keys(result)])]
let bad = 0
for (const k of keys) {
  const a = JSON.stringify(expected[k]), b = JSON.stringify(result[k])
  if (a === b) { console.log(`  PASS  ${k} unchanged from main`); continue }
  bad += 1
  console.log(`  FAIL  ${k} MOVED`)
  const ex = expected[k] ?? {}, got = result[k] ?? {}
  console.log(`          levels  main ${JSON.stringify(ex.levels)}  now ${JSON.stringify(got.levels)}`)
  console.log(`          table   main ${JSON.stringify(ex.table)}`)
  console.log(`                  now  ${JSON.stringify(got.table)}`)
}
console.log(bad === 0
  ? `\n${keys.length}/${keys.length} states byte-identical to main at ${BASELINE}`
  : `\n${bad} of ${keys.length} states MOVED. P-RS1 says STOP and photograph.`)
process.exitCode = bad === 0 ? 0 : 1
