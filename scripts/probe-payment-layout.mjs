// ── L1-L7: THE PAYMENT-TERMS REGION, BUILT AS ONE PASS ───────────────────
//
// Built together because L2/L4/L7 share the same horizontal space and L1/L3
// touch the same panels: separately, each one's measurement is taken against a
// layout the next one changes.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const puppeteer = await loadPuppeteer('payment-layout')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const { oppId } = await freshOpportunity(process.argv[2] ?? 'R41PL')
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
// A HYBRID deal, priced, so the milestone table and the schedule both render.
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { ssNew: 10, duration: 36, targetMargin: 30, structure: 'hybrid',
             factoring: { enabled: true, ratePct: 1.5, termMonths: 12, method: 'straight' } },
  expected_revision: await rev() })

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))

const openAt = async (w) => {
  await page.setViewport({ width: w, height: 1100 })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => !!document.getElementById('deal-po-factoring'), { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
  }, { timeout: 20000 })
  await page.waitForFunction(() =>
    (document.getElementById('deal-po-factoring')?.getBoundingClientRect().width ?? 0) > 0,
    { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 500))
}

await openAt(1920)

// ── STRUCTURE, NOT A TAG COUNT ───────────────────────────────────────────
// Rule 33: balanced totals are consistent with any number of wrong pairings, so
// the parentage is asserted rather than the tags counted.
const shape = await page.evaluate(() => {
  const region = document.querySelector('.deal-payment-region')
  const left = document.querySelector('.payment-terms-panel')
  const po = document.getElementById('deal-po-factoring')
  return {
    regionExists: !!region,
    leftIsChildOfRegion: left?.parentElement === region,
    poIsChildOfRegion: po?.parentElement === region,
    poIsNotInsideLeft: !left?.contains(po),
    section5HasBoth: !!document.getElementById('deal-section-5')?.contains(po),
    section6NotNested: !document.getElementById('deal-section-5')
      ?.contains(document.getElementById('deal-section-6')),
    toggleInPo: !!po?.querySelector('#deal-factoring-toggle'),
    rateInPo: !!po?.querySelector('#deal-factoring-ratePct'),
    termInPo: !!po?.querySelector('#deal-factoring-termMonths'),
    methodInPo: !!po?.querySelector('#deal-factoring-method-toggle'),
  }
})
record('L2: Payment Terms and PO Factoring are SIBLINGS in the region',
  shape.leftIsChildOfRegion && shape.poIsChildOfRegion && shape.poIsNotInsideLeft,
  JSON.stringify({ l: shape.leftIsChildOfRegion, p: shape.poIsChildOfRegion }))
record('and section 6 is not nested inside section 5', shape.section6NotNested)
record('L3/L7: the switch, rate, term and method are ALL in the factoring panel',
  shape.toggleInPo && shape.rateInPo && shape.termInPo && shape.methodInPo,
  JSON.stringify(shape).slice(0, 60))

// ── L1: THE GUIDANCE IS ONE HOVER AWAY, NOT GONE ─────────────────────────
const help = await page.evaluate(() => {
  const dots = [...document.querySelectorAll('#opp-tab-commercial .help-dot')]
  return {
    count: dots.length,
    allCarryText: dots.every((d) => (d.getAttribute('title') ?? '').length > 30
      && (d.getAttribute('aria-label') ?? '').length > 30),
    focusable: dots.every((d) => d.getAttribute('tabindex') === '0'),
    strayNotes: [...document.querySelectorAll('#deal-po-factoring .field-note')].length,
  }
})
record('L1: the notes became hover affordances that keep their words',
  help.count >= 3 && help.allCarryText, `${help.count} help affordances`)
record('L1: and they are reachable by keyboard, not mouse-only', help.focusable)
record('L1: no permanent note is left in the factoring panel', help.strayNotes === 0)

// ── M2: THE MILESTONE FIELD IS THE CONTRACTOR'S OWN SELECTOR ────────────
//
// L6 asked for "the same milestone component as the Contractor lump sum" and
// three of four columns were reshaped while this one stayed a free-text box -
// then reported as the shared component. The probe could not catch it because
// it asserted the three columns that had changed. It asserts this one now, and
// asserts it against the CONTRACTOR's options rather than against a list
// written here, so the two cannot drift apart.
const opts = await page.evaluate(() => {
  const read = (el) => el && el.tagName === 'SELECT'
    ? [...el.options].map((o) => o.value) : null
  return {
    hybridTag: document.getElementById('deal-ms-0-label')?.tagName,
    contractorTag: document.getElementById('deal-cm-0-label')?.tagName,
    hybrid: read(document.getElementById('deal-ms-0-label')),
    contractor: read(document.getElementById('deal-cm-0-label')),
  }
})
const usdFieldWidth = await page.evaluate(() =>
  Math.round(document.getElementById('deal-ms-0-usd')?.getBoundingClientRect().width ?? 0))
record('M2: the hybrid milestone field is a SELECT, not a text box',
  opts.hybridTag === 'SELECT', `<${String(opts.hybridTag).toLowerCase()}>`)
record('M2: and it offers exactly the contractor\'s options, from one source',
  !!opts.hybrid && !!opts.contractor
    && JSON.stringify(opts.hybrid) === JSON.stringify(opts.contractor),
  `${opts.hybrid?.length ?? 0} options vs ${opts.contractor?.length ?? 0}`)

// ── M1/M4/M5: read as peers, and figures near their labels ──────────────
const m145 = await page.evaluate(() => {
  const fs = (el) => el ? parseFloat(getComputedStyle(el).fontSize) : null
  const po = document.getElementById('deal-po-factoring')
  const pay = document.querySelector('.payment-terms-panel')
  return {
    poLabel: fs(po?.querySelector('label')), payLabel: fs(pay?.querySelector('.form-group label')),
    poBtn: fs(po?.querySelector('.view-toggle button')), radio: fs(pay?.querySelector('.ring-radio-label')),
    usdWidth: Math.round(document.getElementById('deal-ms-0-usd')?.getBoundingClientRect().width ?? 0),
  }
})
record('M1: the two panels use one label scale',
  m145.poLabel === m145.payLabel, `po=${m145.poLabel}px pay=${m145.payLabel}px`)
record('M1: and the choice controls match their peers',
  m145.poBtn === m145.radio, `toggle=${m145.poBtn}px radio=${m145.radio}px`)
record('M5: the computed USD field is the width of the figure',
  usdFieldWidth > 0 && usdFieldWidth <= 130, `${usdFieldWidth}px`)

// ── L4/L7: THE REGION HOLDS AT THREE WIDTHS ──────────────────────────────
for (const w of [1240, 1920, 3440]) {
  await openAt(w)
  const m = await page.evaluate(() => {
    const region = document.querySelector('.deal-payment-region')
    const left = document.querySelector('.payment-terms-panel')
    const po = document.getElementById('deal-po-factoring')
    const lr = left.getBoundingClientRect(), pr = po.getBoundingClientRect()
    const rr = region.getBoundingClientRect()
    return {
      sideBySide: Math.abs(lr.y - pr.y) < 8 && pr.x > lr.x,
      poShare: Math.round((pr.width / rr.width) * 100),
      poWidth: Math.round(pr.width),
      overflow: document.body.scrollWidth > document.body.clientWidth,
      poFits: pr.right <= rr.right + 1,
      ysVertical: (() => {
        const lines = [...document.querySelectorAll('.ys-line')]
        if (lines.length < 2) return null
        return lines[1].getBoundingClientRect().y > lines[0].getBoundingClientRect().y
      })(),
    }
  })
  record(`at ${w}: the two panels sit SIDE BY SIDE without wrapping`,
    m.sideBySide && m.poFits && !m.overflow,
    `po ${m.poWidth}px = ${m.poShare}% of the region, overflow=${m.overflow}`)
  record(`at ${w}: the factoring panel is no wider than a quarter`,
    m.poShare <= 26, `${m.poShare}%`)
}

// L6: THE USD IS A COMPUTED FIGURE, SO THE CALC IS THE CLAIM
//
// Checked against the deal's OWN figures on two surfaces rather than a number
// re-derived here: the milestone USD must be a percentage of the hardware and
// installation total, which is what the summary already shows.
//
// THE PRECONDITION IS PROVEN, NOT ASSUMED. oneOffPrice is hardware PLUS
// installation, and this fixture has no installation spend - so the hardware
// total is the base only if installation really is zero. tcv === hardware +
// hosting is what says so, and it is asserted rather than trusted: without it
// this check would pass by coincidence here and mislead on any deal with
// installation in it.
await openAt(1920)
const detail = (await api('GET', `/opportunities/${oppId}`)).data ?? {}
const tcv = detail.total_contract_value
const figs = await page.evaluate(() => {
  const n = (id) => Number((document.getElementById(id)?.textContent ?? '').replace(/[^0-9.]/g, ''))
  return { hardware: n('pg-total-price-hw') }
})
// FROM THE PAYLOAD, not from the hosting figure beside it: pg-total-price-ho
// renders a PER-MONTH number, so tcv === hardware + hosting could never
// balance and the first version of this precondition failed for a reason that
// had nothing to do with installation. The fixture's own inputs are what say
// there is no installation spend.
const installKeys = ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir', 'lumpSumCost']
const installValues = installKeys.map((k) => detail.payload?.[k] ?? 0)
record('the fixture has no installation spend, so hardware IS the one-off total',
  installValues.every((v) => !v), `${installKeys.join('/')} = ${JSON.stringify(installValues)}`)
const oneOff = figs.hardware
record('and there is a real total to be a percentage of', oneOff > 0, `oneOffPrice=${oneOff}`)

const typePct = async (row, pct) => page.evaluate((r, v) => {
  const el = document.getElementById(`deal-ms-${r}-pct`)
  el.focus(); el.value = ''
  for (const ch of String(v)) { el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true })) }
  el.dispatchEvent(new Event('change', { bubbles: true }))
}, row, pct)
const usdOf = (row) => page.evaluate((r) =>
  document.getElementById(`deal-ms-${r}-usd`)?.value ?? '', row)

await page.evaluate(() => {
  const m = document.getElementById('deal-ms-0-month')
  m.focus(); m.value = '6'; m.dispatchEvent(new Event('input', { bubbles: true }))
})
for (const pct of [100, 25]) {
  await typePct(0, pct)
  await new Promise((r) => setTimeout(r, 700))
  const got = await usdOf(0)
  const want = ((pct / 100) * oneOff).toFixed(2)
  record(`L6: ${pct}% of the hardware/installation total computes to ${want}`,
    got === want, `screen="${got}" expected="${want}"`)
}
record('L6: and it carries two decimals, as ruled',
  /^\d+\.\d{2}$/.test(await usdOf(0)), `"${await usdOf(0)}"`)
record('L6: the USD field is computed, not typed',
  await page.evaluate(() => {
    const e = document.getElementById('deal-ms-0-usd')
    return e.readOnly === true && e.getAttribute('tabindex') === '-1'
  }))

// ── THE NUMERIC GUARDS ARE INHERITED, NOT RE-ADDED ──────────────────────
//
// U1's class fix keys on inputmode, so these fields get the guard by DECLARING
// what they take. Asserted by TYPING, not by reading the markup: the claim is
// that letters cannot land, and only typing can show that.
// TYPED WITH REAL KEYSTROKES, not by assigning value. maxlength constrains what
// a person can TYPE and is ignored by programmatic assignment, so the first
// version of these checks measured the strip-guard alone and reported the length
// cap broken while it was working. Two constraints, and only one of them is
// visible to a script that sets .value.
const typeInto = async (id, text) => {
  await page.evaluate((i) => { const el = document.getElementById(i); el.focus(); el.value = '' }, id)
  await page.type(`#${id}`, text)
  return page.evaluate((i) => document.getElementById(i).value, id)
}
record('L5: the milestone month takes digits only, capped at two',
  (await typeInto('deal-ms-0-month', 'a1b2c3')) === '12',
  `-> "${await page.evaluate(() => document.getElementById('deal-ms-0-month').value)}"`)
record('L6: the milestone % takes digits only, capped at three',
  (await typeInto('deal-ms-0-pct', '1x2y3z4')) === '123')
record('L7: the factoring term takes digits only, capped at three',
  (await typeInto('deal-factoring-termMonths', '9a9b9c9')) === '999')
record('L7: the factoring rate keeps ONE decimal point and drops letters',
  (await typeInto('deal-factoring-ratePct', '1.5x')) === '1.5')
record('and none of these re-adds the guard per field',
  !(readFileSync('frontend/index.html', 'utf8').includes('class="int-only"')),
  'the inputmode guard is inherited')

// ── M3 AND M4 ARE TWO-PHASE SURFACES ────────────────────────────────────
//
// The fixture above is HYBRID, where the year schedule does not render at all
// and the invoicing choice is the hybrid group's own. Measured there, M3 read
// "invoicing is not left" and M4 read a null gap - both true of a screen
// neither item is about. The structure is switched rather than the assertions
// loosened.
await api('PATCH', `/opportunities/${oppId}`,
  { payload: { structure: 'twoPhase', recoveryMonths: 24 }, expected_revision: await rev() })
await openAt(1920)
await page.waitForFunction(() => document.querySelectorAll('.ys-line').length > 0, { timeout: 20000 })

// ── M3: INVOICING AND RECOVERY SHARE A LINE, INVOICING LEFT ─────────────
const m3 = await page.evaluate(() => {
  const inv = document.getElementById('deal-invoicing-toggle')
  const rec = document.getElementById('deal-recovery-group')
  if (!inv || !rec) return null
  const a = inv.getBoundingClientRect(), b = rec.getBoundingClientRect()
  // VERTICAL OVERLAP, not equal tops. The row is align-items:flex-end, so a
  // tall radio group and a short field on the SAME line have different y by
  // the height difference - the first version of this read "not on one line"
  // about a layout that was correct.
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return { sameLine: overlap > 0, overlap: Math.round(overlap), invoicingLeft: a.x < b.x }
})
record('M3: invoicing and the recovery term share a line, invoicing left',
  !!m3 && m3.sameLine && m3.invoicingLeft, JSON.stringify(m3))
const m4gap = await page.evaluate(() => {
  const line = document.querySelector('.ys-line')
  const yr = line?.querySelector('.ys-year'), amt = line?.querySelector('.ys-amount')
  return yr && amt ? Math.round(amt.getBoundingClientRect().left - yr.getBoundingClientRect().right) : null
})

record('M4: the figure sits near its label, not across the panel',
  m4gap !== null && m4gap < 220, `${m4gap}px from label to figure (was 491)`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
