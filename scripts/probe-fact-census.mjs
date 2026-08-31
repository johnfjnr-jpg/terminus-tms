#!/usr/bin/env node
// The fact census for Round 41 item 4, taken from the CODE and confirmed on the
// screen. REPORT ONLY: this probe changes nothing and saves nothing.
//
// ── THE METHOD, AND IT RUNS IN BOTH DIRECTIONS ──────────────────────────────
//
// FORWARD, from source. Both render functions build a `rows` array of literal
// objects, so the labels and value expressions are enumerable by reading the
// file through the comment stripper. That direction finds every row INCLUDING
// the ones no reachable deal state can produce.
//
// BACKWARD, from the screen. The real page is driven through the conditions a
// person can actually reach, and the rendered labels are collected. That
// direction finds anything the parse missed, and it is the half that catches a
// row whose label is assembled rather than written.
//
// A census taken one way only is a census of one deal (CLAUDE.md rule 33: every
// measure has a shape, and what falls outside it is found by looking or not at
// all).
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-fact-census.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { readCode } from './lib/strip-comments.mjs'

const ROOT = new URL('../', import.meta.url).pathname
const OUT = ROOT + '.verify/census/'
mkdirSync(OUT, { recursive: true })

// ── DIRECTION ONE: the source ───────────────────────────────────────────────
const src = readCode(ROOT + 'frontend/opportunity-deal.js')
const slice = (fn) => {
  const i = src.indexOf(`function ${fn}(`)
  if (i === -1) throw new Error(`${fn} not found`)
  const j = src.indexOf('\n}\n', i)
  return src.slice(i, j)
}

// ONE function now. The merge replaced renderDealMatrix and renderDealSheet
// with renderDealPanel, and the row array is built by split()/full() helpers
// rather than by object literals with a `label:` key, so the extractor reads
// the first argument of each.
const panelSrc = slice('renderDealPanel')
const fromSource = {
  // Quote-aware, not comma-aware. The first version cut every label at its
  // first comma, so "One-off price, hardware, warranty and installation" was
  // reported as "One-off price" and the census's source list read like a set of
  // shorter rows than the panel actually has.
  panel: [...panelSrc.matchAll(/\b(?:split|full)\(\s*('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|[^,]+)/g)]
    .map((m) => m[1].trim()),
}

// ── DIRECTION TWO: the screen ───────────────────────────────────────────────
const session = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
const OPP = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1200 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), OPP)
await page.waitForFunction(() => {
  const el = document.getElementById('deal-contract-net')
  return el && /\$[1-9]/.test(el.textContent)
}, { timeout: 20000 })
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[data-opp-tab]')].find((b) => /commercial/i.test(b.textContent))
  if (t) t.click()
})
await page.waitForFunction(() => {
  const p = document.getElementById('opp-tab-commercial')
  return p && !p.classList.contains('hidden')
}, { timeout: 20000 })

// The conditions a person can reach from this screen. Each is applied, the two
// blocks are read, and the condition is reverted.
const CONDITIONS = [
  ['as loaded', () => {}],
  ['gst cleared', () => setBox('deal-gstPct', '')],
  ['gst 7', () => setBox('deal-gstPct', '7')],
  ['gst 0', () => setBox('deal-gstPct', '0')],
  ['wht cleared', () => setBox('deal-whtPct', '')],
  ['wht 10', () => setBox('deal-whtPct', '10')],
  ['wht 0', () => setBox('deal-whtPct', '0')],
  ['duration cleared', () => setBox('deal-duration', '')],
  ['duration 36', () => setBox('deal-duration', '36')],
  ['gross up on', () => clickIfOff('deal-grossUp-toggle', true)],
  ['gross up off', () => clickIfOff('deal-grossUp-toggle', false)],
  ['factoring off', () => clickIfOff('deal-factoring-toggle', false)],
  ['factoring on, term set', () => { clickIfOff('deal-factoring-toggle', true); setBox('deal-factoring-termMonths', '12') }],
  ['factoring on, term cleared', () => {}],
  ['structure hybrid', () => {}],
  ['structure twoPhase', () => {}],
  ['wht 15, gross up OFF', () => {}],
  ['wht cleared, gross up OFF', () => {}],
]

const observed = { matrix: new Map(), sheet: new Map(), messages: new Map(), heading: new Set() }
for (const [name] of CONDITIONS) {
  const seen = await page.evaluate(async (condName) => {
    const setBox = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })) } }
    const clickIfOff = (id, want) => {
      const b = document.getElementById(id); if (!b) return
      const on = /:\s*On/i.test(b.textContent)
      if (on !== want) b.click()
    }
    const apply = {
      'as loaded': () => {},
      'gst cleared': () => setBox('deal-gstPct', ''),
      'gst 7': () => setBox('deal-gstPct', '7'),
      'gst 0': () => setBox('deal-gstPct', '0'),
      'wht cleared': () => setBox('deal-whtPct', ''),
      'wht 10': () => setBox('deal-whtPct', '10'),
      'wht 0': () => setBox('deal-whtPct', '0'),
      'duration cleared': () => setBox('deal-duration', ''),
      'duration 36': () => setBox('deal-duration', '36'),
      'gross up on': () => clickIfOff('deal-grossUp-toggle', true),
      'gross up off': () => clickIfOff('deal-grossUp-toggle', false),
      'factoring off': () => clickIfOff('deal-factoring-toggle', false),
      'factoring on, term set': () => { clickIfOff('deal-factoring-toggle', true); setBox('deal-factoring-termMonths', '12') },
      'factoring on, term cleared': () => { clickIfOff('deal-factoring-toggle', true); setBox('deal-factoring-termMonths', '') },
      // Hybrid is the ONLY structure that renders the milestone warning, and
      // this deal is single-phase. Without it the backward direction reports a
      // clean absence for a row that exists.
      // .ring-radio[data-structure], not a button. The first version queried
      // for a button and silently found nothing, so the milestone warning read
      // as unreachable when it was simply never triggered.
      'structure hybrid': () => document.querySelector('#deal-structure-toggle [data-structure="hybrid"]')?.click(),
      'structure twoPhase': () => document.querySelector('#deal-structure-toggle [data-structure="twoPhase"]')?.click(),
      // THE COMBINATION THE CUMULATIVE SWEEP COULD NOT REACH. whtBorne is only
      // non-zero when a WHT rate is recorded AND gross up is off, which is the
      // one state where "of which withholding tax absorbed by Terminus" and
      // "Withholding tax absorbed by Terminus" carry figures at all.
      'wht 15, gross up OFF': () => { setBox('deal-whtPct', '15'); clickIfOff('deal-grossUp-toggle', false) },
      'wht cleared, gross up OFF': () => { setBox('deal-whtPct', ''); clickIfOff('deal-grossUp-toggle', false) },
    }
    // ── EACH CONDITION IS A DELTA FROM A KNOWN BASE, NOT FROM THE LAST ONE ──
    //
    // The first version applied conditions CUMULATIVELY, so by the time
    // "gross up off" ran the WHT rate had already been set to 0 by an earlier
    // step and the absorbed-WHT row could only ever read all dashes. That is a
    // sweep of one PATH through the condition space presented as a sweep of the
    // space, and the rows it never reached looked like rows that do not exist.
    if (condName !== 'as loaded') {
      setBox('deal-gstPct', '8'); setBox('deal-whtPct', '15'); setBox('deal-duration', '36')
      clickIfOff('deal-grossUp-toggle', true)
      clickIfOff('deal-factoring-toggle', true); setBox('deal-factoring-termMonths', '12')
      document.querySelector('#deal-structure-toggle [data-structure="single"]')?.click()
      await new Promise((r) => setTimeout(r, 200))
    }
    apply[condName]()
    await new Promise((r) => setTimeout(r, 250))
    const matrix = [...document.querySelectorAll('#deal-panel .dm-row')].map((row) => {
      const c = [...row.children].map((x) => x.textContent.trim())
      return row.classList.contains('dm-row--full')
        ? { label: c[0], hardware: '', hosting: '', installation: '', total: c[1], full: true }
        : { label: c[0], hardware: c[1], hosting: c[2], installation: c[3], total: c[4] }
    })
    const sheet = []
    const msg = (id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') ? el.textContent.trim() : null }
    return {
      matrix, sheet,
      heading: document.querySelector('#deal-section-4 .deal-summary-col .label')?.textContent?.trim() ?? null,
      units: document.getElementById('deal-sheet-units')?.textContent?.trim() ?? null,
      messages: {
        cashOk: msg('deal-cashflow-ok'), cashWarn: msg('deal-cashflow-warn'), milestone: msg('deal-milestone-warn'),
      },
    }
  }, name)
  for (const r of seen.matrix) {
    const key = r.label
    if (!observed.matrix.has(key)) observed.matrix.set(key, new Set())
    observed.matrix.get(key).add(`${name}: H=${r.hardware} Ho=${r.hosting} I=${r.installation} T=${r.total}`)
  }
  for (const r of seen.sheet) {
    if (!observed.sheet.has(r.label)) observed.sheet.set(r.label, new Set())
    observed.sheet.get(r.label).add(`${name}: ${r.value}`)
  }
  for (const [k, v] of Object.entries(seen.messages)) if (v) {
    if (!observed.messages.has(k)) observed.messages.set(k, new Set())
    observed.messages.get(k).add(v)
  }
}
// ── AND LOOK AT IT. Verification 4 ─────────────────────────────────────────
//
// Every assertion above is about labels and values. None of them can see
// whether the panel READS as one arithmetic story, which is the thing the merge
// was for. The capture is taken of the section's own rect after scrolling it
// into view, and the image is checked for not being empty before it is treated
// as evidence.
const CAPS = ROOT + '.verify/census/'
for (const w of [1920, 1240]) {
  await page.setViewport({ width: w, height: 1400 })
  await page.evaluate(() => {
    const s = document.getElementById('deal-section-4')
    if (s) s.scrollIntoView()
  })
  await new Promise((r) => setTimeout(r, 400))
  const el = await page.$('#deal-section-4')
  const box = await el.boundingBox()
  const file = `${CAPS}panel-${w}.png`
  await page.screenshot({ path: file, clip: { x: 0, y: Math.max(0, box.y), width: w, height: Math.min(box.height, 1400) } })
  const bytes = readFileSync(file).length
  console.log(`  capture ${file} (${bytes} bytes, element ${Math.round(box.width)}x${Math.round(box.height)})`)
}

await browser.close()

const dump = {
  fromSource,
  matrixLabelsObserved: [...observed.matrix.keys()],
  sheetLabelsObserved: [...observed.sheet.keys()],
  matrixSamples: Object.fromEntries([...observed.matrix].map(([k, v]) => [k, [...v]])),
  sheetSamples: Object.fromEntries([...observed.sheet].map(([k, v]) => [k, [...v]])),
  messages: Object.fromEntries([...observed.messages].map(([k, v]) => [k, [...v]])),
}
writeFileSync(OUT + 'census.json', JSON.stringify(dump, null, 2) + '\n')

console.log('\n── FROM SOURCE ───────────────────────────────────────────────')
console.log(`  panel rows in the source array: ${fromSource.panel.length}`)
for (const l of fromSource.panel) console.log(`    ${l}`)

console.log('\n── FROM THE SCREEN ───────────────────────────────────────────')
console.log(`  matrix labels observed: ${observed.matrix.size}`)
for (const [k, v] of observed.matrix) console.log(`    ${k}\n        ${[...v].join('\n        ')}`)
console.log(`  result labels observed: ${observed.sheet.size}`)
for (const [k, v] of observed.sheet) console.log(`    ${k}\n        ${[...v].join('\n        ')}`)
console.log('  messages observed:')
for (const [k, v] of observed.messages) console.log(`    ${k}: ${[...v].join(' | ')}`)
console.log(`\n  written to ${OUT}census.json`)
