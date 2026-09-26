// ── S1, S2 AND N8: THE CENSUS, BEFORE ANYTHING MOVES ────────────────────
//
// S1 asks for every NUMERIC INPUT on the estate, classified into a format, with
// anything that fits no sensible format listed for John. S2 and N8 ask for
// every FONT in use on the commercial panels, with counts, before and after.
//
// NUMERIC IS A DECLARED PROPERTY, NOT A GUESS. An input counts as numeric when
// the application reads its value as a number, and the estate already says so
// in two places: `CENSUS` in census.ts declares a CONTRACT per field, and the
// grid ids follow fixed shapes. Anything else that LOOKS numeric - an input
// carrying digits, a `type="number"` nobody declared - is reported as
// UNCLASSIFIED rather than assumed, because a census that quietly guesses is
// the shape Verification 19 warns about.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('sizing/census.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { freshOpportunity, freshContact, freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/sizing/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'sizecensus'

const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, whtPct: 15, gstPct: 8, fxContingency: 3,
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', paymentMode: 'capex',
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
  milestones: [{ month: 1, label: 'Contract start', pct: 40 }],
  contractorMilestones: [{ month: 1, label: 'Contract start', pct: 50 }],
} })
const { contactId } = await freshContact(TAG)
const { testBedId } = await freshTestBed(TAG)

const VIEWS = [
  ['leads', null], ['contacts', null], ['accounts', null], ['test-beds', null],
  ['opportunities', null], ['approvals', null],
  ['contact-detail', contactId], ['test-bed-detail', testBedId],
  ['opportunity-detail', oppId], ['opportunity-approval', oppId],
]

const b = await puppeteer.launch({ headless: 'new' })
const rows = []
const fontRows = []
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1440, height: 1900 })
  for (const [view, id] of VIEWS) {
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) },
      id ? `navigate("${view}","${id}")` : `navigate("${view}")`)
    /* WAIT ON THE VIEW THIS NAVIGATION PRODUCES, not on a global loading
       class. `.wrap.is-loading` is cleared by the DETAIL views; the list views
       never set it, so waiting for its absence timed out on `leads` - a wait
       that can never be satisfied reads exactly like a feature that has
       stopped working (Verification 7's inverse). */
    await p.waitForFunction((v) => {
      const el = document.getElementById(`view-${v}`)
      return !!el && !el.classList.contains('hidden')
    }, { timeout: 40000 }, view)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2200)))
    if (view === 'opportunity-detail') {
      // Every tab, because the numeric inputs are spread across them.
      for (const tab of ['Commercials', 'Reference']) {
        await p.evaluate((t) => {
          const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
            .find((x) => x.textContent.trim() === t)
          el?.click()
        }, tab)
        await p.evaluate(() => new Promise((r) => setTimeout(r, 1600)))
        rows.push(...await collect(p, `${view}:${tab}`))
        if (tab === 'Commercials') fontRows.push(...await fonts(p))
      }
      continue
    }
    rows.push(...await collect(p, view))
  }
} finally { await b.close(); await tearDown(TAG) }

async function collect(p, where) {
  const got = await p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    // The retired vanilla blocks render nothing and would double every count.
    const dead = (e) => !!e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    return [...document.querySelectorAll('input')].filter((e) => !dead(e)).map((e) => {
      const cs = getComputedStyle(e)
      const r = e.getBoundingClientRect()
      return {
        id: e.id || null, testid: e.getAttribute('data-testid'), type: e.type,
        inputmode: e.getAttribute('inputmode'), visible: vis(e),
        w: Math.round(r.width), h: Math.round(r.height),
        font: `${cs.fontSize} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
        padL: cs.paddingLeft, padR: cs.paddingRight,
        value: (e.value ?? '').slice(0, 14),
        cls: e.className || null,
      }
    })
  })
  return got.map((g) => ({ ...g, where }))
}
async function fonts(p) {
  return p.evaluate(() => {
    const panels = ['#deal-sections-1-2', '#deal-section-5', '#deal-po-factoring',
      '#deal-section-3', '#deal-section-4']
    const out = []
    for (const sel of panels) {
      const root = document.querySelector(sel) ?? document.getElementById(sel?.slice(1))
      if (!root) continue
      for (const e of root.querySelectorAll('*')) {
        if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
        const t = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!t && e.tagName !== 'INPUT') continue
        const cs = getComputedStyle(e)
        out.push({ panel: sel, tag: e.tagName.toLowerCase(), cls: e.className || '',
          size: cs.fontSize, family: cs.fontFamily.split(',')[0].replace(/["']/g, '') })
      }
    }
    return out
  })
}

// ── CLASSIFY ────────────────────────────────────────────────────────────
/* ── THE DECLARED CONTRACTS, READ FROM SOURCE ────────────────────────────
   The first version of this `await import`ed `census.ts` and caught the
   failure into `{ CENSUS: null }`. Node cannot import TypeScript, so the
   import ALWAYS failed, the set was always empty, and every declared field
   was reported as "declared nowhere" - eighteen of them, which is the entire
   census. A silenced error became a list that read like a finding
   (Verification 8: the error path, silenced, at exactly the point where the
   answer becomes something somebody would quote).

   Parsed from the source text instead, and the parse is ASSERTED: a census
   this file cannot read is a stop, not an empty set. */
const NUMERIC_CONTRACTS = new Set(['numOrNull', 'num', 'numOrUndefined'])
const censusSrc = readFileSync(`${ROOT}/frontend-react/src/deal/census.ts`, 'utf8')
const censusNumeric = new Set()
for (const m of censusSrc.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?contract:\s*'([^']+)'/g)) {
  if (NUMERIC_CONTRACTS.has(m[2])) censusNumeric.add(m[1])
}
// The margin overrides are built by a `.map()` rather than written out, so the
// literal scan above cannot see them. Their contract is declared in that map.
if (/MARGIN_KEYS\.map[\s\S]{0,200}contract: 'numOrUndefined'/.test(censusSrc)) {
  for (const m of readFileSync(`${ROOT}/frontend-react/src/deal/payload.ts`, 'utf8')
    .matchAll(/MARGIN_KEYS[^=]*=\s*\[([\s\S]*?)\]/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) censusNumeric.add(`deal-margin-${k[1]}`)
  }
}
if (censusNumeric.size < 15) {
  throw new Error(`the census parse found only ${censusNumeric.size} numeric fields, `
    + 'so the classification below would be meaningless. Fix the parse, do not report the result.')
}
console.log(`parsed ${censusNumeric.size} declared numeric fields from census.ts\n`)
const GRID = /^deal-(ms|cm)-\d+-(month|pct|usd)$/
const DERIVED = /^deal-(margin|opexfee|opexmargin)-/

const seen = new Map()
for (const r of rows) if (r.id && !seen.has(r.id)) seen.set(r.id, r)
const numeric = [], other = [], unclassified = []
for (const r of seen.values()) {
  const isNum = censusNumeric.has(r.id) || GRID.test(r.id) || DERIVED.test(r.id)
    || r.type === 'number' || ['numeric', 'decimal'].includes(r.inputmode ?? '')
  if (!isNum) { other.push(r); continue }
  numeric.push(r)
  if (!censusNumeric.has(r.id) && !GRID.test(r.id) && !DERIVED.test(r.id)) unclassified.push(r)
}
const rep = []
rep.push(`inputs seen across ${VIEWS.length} views: ${seen.size} distinct ids`)
rep.push(`NUMERIC: ${numeric.length}    non-numeric: ${other.length}`)
rep.push('')
rep.push('── every numeric input, with its rendered width and font ──')
for (const r of numeric.sort((a, b) => a.id.localeCompare(b.id))) {
  rep.push(`  ${r.id.padEnd(30)} ${String(r.w).padStart(4)}px  ${r.font.padEnd(22)}`
    + ` pad ${r.padL}/${r.padR}  ${r.visible ? '' : '(not visible)'}  ${r.where}`)
}
rep.push('')
rep.push('── DECLARED NOWHERE, so listed for John rather than guessed ──')
rep.push(unclassified.length ? unclassified.map((r) => `  ${r.id}  (${r.where})`).join('\n') : '  none')
rep.push('')
rep.push('── widths in use, with counts ──')
const byW = new Map()
for (const r of numeric) byW.set(r.w, (byW.get(r.w) ?? 0) + 1)
for (const [w, n] of [...byW].sort((a, b) => b[1] - a[1])) rep.push(`  ${String(w).padStart(4)}px  x${n}`)
rep.push('')
rep.push('── N8: every font on the commercial panels, with counts ──')
const byF = new Map()
for (const f of fontRows) {
  const k = `${f.size} ${f.family}`
  byF.set(k, (byF.get(k) ?? 0) + 1)
}
for (const [k, n] of [...byF].sort((a, b) => b[1] - a[1])) rep.push(`  ${k.padEnd(26)} x${n}`)
rep.push('')
rep.push('── S2: the Units card against the Installation panel ──')
const inPanel = (sel) => fontRows.filter((f) => f.panel === sel)
const sizes = (sel) => [...new Set(inPanel(sel).map((f) => `${f.size} ${f.family}`))].sort()
rep.push(`  #deal-sections-1-2 carries: ${sizes('#deal-sections-1-2').join(' | ') || '(none)'}`)

const text = rep.join('\n')
writeFileSync(`${OUT}census.txt`, text)
console.log(text)
