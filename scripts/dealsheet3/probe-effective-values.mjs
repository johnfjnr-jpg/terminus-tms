// ── LIVE PROOF: THE DRAWER REPOPULATED, AN OVERRIDE STORED, AND CLEARED ──
//
// Four claims no unit test can make, on the real server against a real record:
//
//   1. The drawer from John's screenshot RENDERS ITS FIGURES, at 1440 and
//      1240, on a record created and populated the way the system does it.
//   2. A typed override wears both signals, measured as COMPUTED style rather
//      than as a class name, and its amber clears 4.5 to 1 on its own ground.
//   3. The override REACHES THE RECORD, read from the database rather than
//      from the screen that just claimed it.
//   4. Clearing it REMOVES the key, with no residue, and the box returns to
//      the derived figure rather than to blank.
//
// Measure first, capture second, and capture the PAGE: an element screenshot
// suppresses the scrollbar and does not put it back, so a probe that
// photographs the thing whose geometry it is about measures its own instrument.
//
// A controlled input is driven with REAL KEYBOARD EVENTS. React's per-input
// value tracker dedupes a synthetic value write, so the DOM would show the
// text while the component's state never received it.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet3/probe-effective-values.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = process.env.C_TAG ?? 'ds3live'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const parse = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number)

const DEAL = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60,
  targetMargin: 30, warrantyPct: 2, recoveryMonths: 24,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
  whtPct: 15, gstPct: 9, grossUp: true,
}
const BOX = '[data-testid="stmt-edit-deal-margin-hwSs"]'
const latest = async (id) => must(await db.from('record_revisions')
  .select('payload, revision_number').eq('record_id', id)
  .order('revision_number', { ascending: false }).limit(1), 'rev')[0]

const fx = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${fx.oppId}`, { payload: DEAL })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const openDrawers = async () => {
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
    await p.evaluate(() => {
      const x = document.querySelector('[data-testid="stmt-expand-all"]')
      if (x && x.textContent.trim() === 'Expand all') x.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
  }
  const land = async (width) => {
    await p.setViewport({ width, height: 1400 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${fx.oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1000)))
    await openDrawers()
  }
  const shot = async (name) => {
    const f = `${OUT}${name}.png`
    await p.screenshot({ path: f })
    const bytes = statSync(f).size
    console.log(`     captured ${name}.png ${bytes} bytes${bytes < 20000 ? '  <-- SUSPECT' : ''}`)
    return bytes
  }

  // ── CLAIM 1: THE DRAWER RENDERS ITS FIGURES, BOTH WIDTHS ──────────────
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    const boxes = await p.evaluate(() =>
      [...document.querySelectorAll('.stmt-edit')].map((e) => ({
        id: e.getAttribute('data-testid'), value: e.value, override: e.dataset.override,
      })))
    const blank = boxes.filter((x) => (x.value ?? '').trim() === '')
    check(boxes.length >= 14, `${boxes.length} statement editors present`, `at ${width}`)
    check(blank.length === 0, 'every one renders its effective value',
      blank.length ? `blank: ${blank.map((x) => x.id).join(', ')}` : `0 blank of ${boxes.length}`)
    const hwSs = boxes.find((x) => x.id === 'stmt-edit-deal-margin-hwSs')
    check(!!hwSs && hwSs.value !== '', "John's own line, hardware SafeSight margin",
      `reads "${hwSs?.value}" where it read ""`)
    await p.evaluate(() => document.querySelector('.stmt-edit')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    await shot(`repopulated-${width}`)
  }

  // ── CLAIM 2 AND 3: TYPE AN OVERRIDE, SEE IT, AND READ IT BACK ─────────
  console.log('\n══════ an override typed ══════')
  await land(1440)
  const before = await latest(fx.oppId)
  const derived = await p.evaluate((s) => document.querySelector(s).value, BOX)
  await p.click(BOX)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 200)))
  const whileFocused = await p.evaluate((s) => ({
    value: document.querySelector(s).value, placeholder: document.querySelector(s).placeholder,
  }), BOX)
  check(whileFocused.value === '' && whileFocused.placeholder === derived,
    'a focused box is genuinely empty, so it can be cleared',
    `value "${whileFocused.value}" placeholder "${whileFocused.placeholder}"`)
  await p.keyboard.type('42')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  const styled = await p.evaluate((s) => {
    const e = document.querySelector(s)
    const cs = getComputedStyle(e)
    let bg = 'rgba(0, 0, 0, 0)', n = e
    while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement }
    return { value: e.value, override: e.dataset.override, weight: cs.fontWeight, color: cs.color, bg }
  }, BOX)
  check(styled.value === '42' && styled.override === 'true', 'the box holds the typed value', styled.value)
  // THE COMPUTED STYLE, not the class name: a class assertion passes on a rule
  // that never won the cascade.
  check(Number(styled.weight) >= 700, 'signal one, WEIGHT', `font-weight ${styled.weight}`)
  const cr = ratio(parse(styled.color), parse(styled.bg))
  check(styled.color !== 'rgb(242, 242, 240)', 'signal two, COLOUR', `${styled.color} on ${styled.bg}`)
  check(cr >= 4.5, 'and the amber clears the walk-12 floor on its own ground', `${cr.toFixed(2)}:1`)
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), BOX)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
  await shot('override-typed-1440')

  await p.click('[data-testid="stmt-save"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="stmt-unsaved"]'), { timeout: 30000 })
  const after = await latest(fx.oppId)
  const stored = after?.payload?.marginOverrides?.hwSs
  check(after.revision_number > before.revision_number, 'the save advanced the revision',
    `${before.revision_number} -> ${after.revision_number}`)
  check(String(stored) === '42', 'and the RECORD carries the override', `marginOverrides.hwSs = ${JSON.stringify(stored)}`)

  // ── CLAIM 4: CLEAR IT, AND THE KEY GOES ──────────────────────────────
  console.log('\n══════ and cleared ══════')
  await p.click(BOX)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 200)))
  // REAL KEYS, and not a select-all: `Meta+A` does not map in headless Chrome,
  // so the first attempt left the box holding "42" and the failure presented
  // as a missing save button. End then Backspace deletes what is actually
  // there, and it is what a person does.
  await p.keyboard.press('End')
  for (let i = 0; i < 8; i += 1) await p.keyboard.press('Backspace')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
  // THE FAILURE DETAIL CARRIES THE CAUSE'S OWN ANSWER. "The save button was
  // not there" and "the clear never reached the component" are different
  // failures with different fixes, and a missing selector cannot tell them
  // apart on its own.
  const afterClear = await p.evaluate((s) => {
    const e = document.querySelector(s)
    return {
      value: e ? e.value : 'THE BOX IS GONE',
      bar: !!document.querySelector('[data-testid="stmt-unsaved"]'),
      save: !!document.querySelector('[data-testid="stmt-save"]'),
    }
  }, BOX)
  check(afterClear.value === '', 'the clear reached the component',
    `box "${afterClear.value}", unsaved bar ${afterClear.bar}, save button ${afterClear.save}`)
  await p.click('[data-testid="stmt-save"]')
  await p.waitForFunction(() => !document.querySelector('[data-testid="stmt-unsaved"]'), { timeout: 30000 })
  const cleared = await latest(fx.oppId)
  const key = cleared?.payload?.marginOverrides ?? {}
  check(!('hwSs' in key), 'the key is REMOVED, not set to an empty string or a zero',
    `marginOverrides = ${JSON.stringify(key)}`)
  const rest = await p.evaluate((s) => {
    const e = document.querySelector(s)
    return { value: e.value, override: e.dataset.override, weight: getComputedStyle(e).fontWeight }
  }, BOX)
  check(rest.value === derived, 'and the box returns to the DERIVED figure, not to blank',
    `"${rest.value}" against the derivation "${derived}"`)
  check(rest.override === 'false' && Number(rest.weight) < 700, 'both signals are off again',
    `override ${rest.override}, weight ${rest.weight}`)
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), BOX)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
  await shot('cleared-1440')
} finally {
  await b.close()
  await tearDown(TAG)
}

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
