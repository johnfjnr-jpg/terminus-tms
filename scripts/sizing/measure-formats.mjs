// ── HOW WIDE IS EACH FORMAT STRING, IN THE INPUT'S OWN FONT? ────────────
//
// S1 says an input's width derives from its format string measured in the
// input's own computed font, PLUS FIXED PADDING, and that the rendered width
// must sit within 100% to 135% of the measured string.
//
// THOSE TWO CLAUSES CONSTRAIN EACH OTHER and the constraint is arithmetic: if
// width = measured + PAD, the ratio is 1 + PAD/measured, which is WORST for
// the SHORTEST format. So the padding a standard can afford is decided by
// `XX`, not by `xxx,xxx.xx`. Measured here before anything is built, because
// if no single padding satisfies every format the standard cannot be met as
// written and that is a finding for John rather than something to invent
// around.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('sizing/measure-formats.mjs')
import { readFileSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'sizefmt'
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, installResp: 'Terminus Contractor - Per Unit',
  structure: 'twoPhase', paymentMode: 'capex',
} })
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1440, height: 1900 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
  await p.waitForFunction(() => {
    const el = document.getElementById('view-opportunity-detail')
    return !!el && !el.classList.contains('hidden')
  }, { timeout: 40000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
      .find((x) => x.textContent.trim() === 'Commercials')
    el?.click()
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1800)))
  const out = await p.evaluate(() => {
    const el = document.querySelector('#deal-ssExisting')
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`
    const c = document.createElement('canvas').getContext('2d')
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const FORMATS = {
      'money-large': 'xxx,xxx.xx', 'money-small': 'x,xxx.xx',
      percent: 'xx.x', months: 'XXX', count: 'XX',
    }
    const widths = {}
    for (const [k, v] of Object.entries(FORMATS)) widths[k] = Math.ceil(c.measureText(v).width)
    // The WIDEST REAL VALUE each format is meant to hold, so the format string
    // can be checked against the thing rather than against itself.
    const REAL = { 'money-large': '999,999.99', 'money-small': '9,999.99',
      percent: '99.9', months: '999', count: '99' }
    const real = {}
    for (const [k, v] of Object.entries(REAL)) real[k] = Math.ceil(c.measureText(v).width)
    return { font, boxSizing: cs.boxSizing, padL: cs.paddingLeft, padR: cs.paddingRight,
      border: cs.borderLeftWidth, widths, real }
  })
  console.log(`input font: ${out.font}`)
  console.log(`box-sizing ${out.boxSizing}   padding ${out.padL}/${out.padR}   border ${out.border}\n`)
  console.log('format        string        measured   widest real value')
  for (const k of Object.keys(out.widths)) {
    console.log(`  ${k.padEnd(12)} ${String(out.widths[k]).padStart(4)}px      ${String(out.real[k]).padStart(4)}px`)
  }
  console.log('\n── what padding the 135% ceiling allows, per format ──')
  for (const k of Object.keys(out.widths)) {
    const m = out.widths[k]
    console.log(`  ${k.padEnd(12)} measured ${String(m).padStart(3)}px  ->  max total width `
      + `${Math.floor(m * 1.35)}px, so at most ${Math.floor(m * 1.35) - m}px of padding`)
  }
  const tightest = Math.min(...Object.values(out.widths).map((m) => Math.floor(m * 1.35) - m))
  console.log(`\nTHE BINDING CONSTRAINT IS THE SHORTEST FORMAT: at most ${tightest}px of `
    + 'total horizontal padding can satisfy every format at once.')
  console.log(`A ${tightest}px allowance is ${tightest >= 6 ? 'workable' : 'very tight'} for a text box.`)
} finally { await b.close(); await tearDown(TAG) }
