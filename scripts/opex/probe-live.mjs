// ── LIVE PROOF: BOTH SWITCH POSITIONS, THE TABLE, AND WHAT IT STORES ────
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opex/probe-live.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api, ApiError } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opex/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'opexlive'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
} })
const payload = async () => (await admin().from('record_revisions').select('payload')
  .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1)).data?.[0]?.payload ?? {}

// ── THE SERVER'S OWN REFUSALS, which no unit test covers ────────────────
console.log('\n══════ the route ══════')
for (const [what, body] of [
  ['a mode that is neither', { paymentMode: 'leasing' }],
  ['a row key that is not a row', { opexUnitFees: { widget: 10 } }],
]) {
  try {
    await api('PATCH', `/opportunities/${oppId}`, { payload: body })
    check(false, `the route refuses ${what}`, 'IT ACCEPTED IT')
  } catch (e) {
    check(e instanceof ApiError && e.status === 400, `the route refuses ${what}`,
      `${e.status} ${(e.body?.error ?? '').slice(0, 60)}`)
  }
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const land = async (width) => {
    await p.setViewport({ width, height: 1700 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))
  }
  const shot = async (n) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}${n}.png` })
    console.log(`     ${n}.png ${statSync(`${OUT}${n}.png`).size} bytes`)
  }
  const table = () => p.evaluate(() => {
    const t = document.querySelector('#deal-opex-table')
    if (!t) return null
    const cell = (id) => {
      const e = document.querySelector(`[data-testid="${id}"]`)
      if (!e) return null
      return { value: e.value ?? e.textContent.trim(), override: e.dataset?.override ?? null,
        weight: getComputedStyle(e).fontWeight, color: getComputedStyle(e).color }
    }
    return {
      heads: [...t.querySelectorAll('th')].map((h) => h.textContent.trim()),
      rows: ['ss', 'aq', 'hemir'].map((k) => ({
        k, units: cell(`deal-opexunits-${k}`), fee: cell(`deal-opexfee-${k}`),
        margin: cell(`deal-opexmargin-${k}`), total: cell(`deal-opextotal-${k}`),
      })),
      oneRow: (() => {
        const tops = [...t.querySelectorAll('thead th')].map((h) => Math.round(h.getBoundingClientRect().top))
        return new Set(tops).size === 1
      })(),
      fits: t.getBoundingClientRect().right
        <= document.querySelector('.payment-terms-panel').getBoundingClientRect().right + 1,
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    check((await table()) === null, 'CAPEX shows no OPEX table', 'the switch starts at CAPEX')
    await shot(`capex-${width}`)
    await p.click('[data-testid="deal-payment-mode-toggle"]')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    const t = await table()
    check(!!t, 'OPEX reveals the table')
    check(JSON.stringify(t.heads) === JSON.stringify(['', '# of Units', 'Monthly Fee', 'Margin %', 'Contract Total']),
      'the ruled headings', t.heads.join(' | '))
    const blank = t.rows.filter((r) => !r.fee.value || !r.margin.value || !r.total.value)
    check(blank.length === 0, 'every derived cell is populated', blank.map((r) => r.k).join(',') || 'none blank')
    check(t.oneRow, 'the header is one row')
    check(t.fits, 'and the table fits inside the panel')
    const single = await p.evaluate(() => {
      const el = document.querySelector('#deal-structure-toggle [aria-checked="true"], #deal-structure-toggle .is-on')
      return el?.getAttribute('data-structure') ?? null
    })
    check(single === 'single', 'OPEX locks the structure to single phase', String(single))
    await shot(`opex-${width}`)
  }

  // ── AN EDITED FEE: amber, stored, and the drawers agreeing ────────────
  console.log('\n══════ an edited fee ══════')
  // SELECT, THEN TYPE. The first version pressed End and twelve Backspaces,
  // and the box came out holding 329000 where 9000 was typed and 3044 where 44
  // was: React re-renders the controlled input between keystrokes and the caret
  // does not survive it, so the deletions and the insertion landed in different
  // places. `select()` is a real selection the next keystroke replaces, and it
  // cannot drift with the caret.
  const type = async (id, v) => {
    await p.click(`[data-testid="${id}"]`)
    await p.evaluate((s) => { document.querySelector(s).select() }, `[data-testid="${id}"]`)
    await p.keyboard.type(v)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    return p.evaluate((s) => document.querySelector(s).value, `[data-testid="${id}"]`)
  }
  const before = await table()
  const typed = await type('deal-opexfee-hemir', '9000')
  check(typed === '9000', 'the box holds exactly what was typed', `"${typed}"`)
  const after = await table()
  const hemir = after.rows.find((r) => r.k === 'hemir')
  check(hemir.fee.override === 'true' && Number(hemir.fee.weight) >= 700,
    'the edited fee wears both signals', `override ${hemir.fee.override}, weight ${hemir.fee.weight}`)
  check(hemir.margin.value !== before.rows.find((r) => r.k === 'hemir').margin.value,
    'and the MARGIN rederived', `${before.rows.find((r) => r.k === 'hemir').margin.value} -> ${hemir.margin.value}`)
  await shot('opex-edited-1240')

  await p.click('[data-testid="stmt-save"]').catch(async () => {
    await p.click('#btn-save-section-5').catch(() => {})
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  const stored = await payload()
  check(stored.paymentMode === 'opex', 'the mode reached the record', String(stored.paymentMode))
  check(Number(stored.opexUnitFees?.hemir) === 9000, 'and the fee reached the record',
    JSON.stringify(stored.opexUnitFees ?? {}))

  // R-OX5: a count change clears the absolute and keeps the margin.
  await type('deal-opexmargin-aq', '44')
  await type('deal-opexunits-aq', '9')
  const cleared = await table()
  const aq = cleared.rows.find((r) => r.k === 'aq')
  const hem = cleared.rows.find((r) => r.k === 'hemir')
  check(hem.fee.override === 'false', 'R-REV cleared the absolute fee on a count change',
    `hemir override ${hem.fee.override}`)
  check(aq.margin.value === '44', 'and the margin persisted', `aq margin ${aq.margin.value}`)
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
