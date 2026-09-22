// D3: THE INSTALLATION MARGIN, DRIVEN AND READ BACK
//
// The claim is not that a box renders. It is that turning the box CHANGES THE
// ONE DERIVATION every reader shares, and that the value REACHES THE RECORD -
// which is the half a rendering test cannot see, because `marginOverrides` is
// built by looping an allowlist and a key missing from it is discarded in
// silence (Architecture 9).
//
// SO THIS PROBE IS GATED ON THE WRITE HAVING LANDED, read from the database
// rather than from the screen that just claimed it. "The price is 400000" is
// exactly what a run where nothing was saved would report, because the screen
// recomputes locally.
//
// THE INPUT IS DRIVEN WITH REAL KEYBOARD EVENTS. React's per-input value
// tracker dedupes a synthetic `.value` write, so the DOM shows the text and
// the component's state never receives it.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk11/probe-d3-install-margin.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk11/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const TAG = 'walk11d3'
const COST = 200000, TARGET = 30, OVERRIDE = 50
// EXPRESSED, NEVER RESTATED. A hand-typed 285714 would be a second reader of
// the calculator, and it would agree today and drift on the first rounding
// change (Verification 20).
const priceAt = (pct) => Math.round(COST / (1 - pct / 100))

const stored = async (oppId) => {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  return { ov: (rev?.payload?.marginOverrides ?? {}).inLump, n: rev?.revision_number }
}

let fx
const b = await puppeteer.launch({ headless: 'new' })
try {
  fx = await freshOpportunity(TAG)
  console.log(`fixture ${TAG}: opportunity ${fx.oppId} at revision ${fx.revision}`)
  // Built the way the SYSTEM builds it: the same PATCH the deal panel's own
  // save uses, not an admin write behind the route.
  await api('PATCH', `/opportunities/${fx.oppId}`, {
    payload: { installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: COST, targetMargin: TARGET },
  })
  const before = await stored(fx.oppId)
  check(before.ov === undefined,
    'the fixture starts with NO inLump override, so the write is the change',
    `marginOverrides.inLump = ${before.ov ?? '(none)'}, revision ${before.n}`)

  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), fx.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => !!document.querySelector('[data-testid="btn-toggle-detail"]'),
      { timeout: 45000 })
    await p.evaluate(() => {
      const t = document.querySelector('[data-testid="btn-toggle-detail"]')
      if (t.getAttribute('aria-expanded') !== 'true') t.click()
    })
    await p.waitForFunction(() => !!document.querySelector('[data-testid="pg-price-inGroup"]'),
      { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)

    const read = () => p.evaluate(() => {
      const n = (t) => Number((document.querySelector(`[data-testid="${t}"]`)?.textContent ?? '')
        .replace(/[^0-9.]/g, ''))
      const box = document.querySelector('[data-testid="deal-margin-inLump"]')
      return {
        cost: n('pg-cost-inGroup'), price: n('pg-price-inGroup'),
        note: document.querySelector('[data-testid="pg-note-inGroup"]')?.textContent.trim(),
        totalPrice: n('pg-total-price-hw'),
        hwPrice: n('pg-price-hwSs') + n('pg-price-hwAqm') + n('pg-price-hwHemir') + n('pg-price-hwWarranty'),
        boxes: document.querySelectorAll('[data-testid="deal-margin-inLump"]').length,
        boxValue: box ? box.value : null,
      }
    })

    const r0 = await read()
    console.log(`  cost ${r0.cost}  price ${r0.price}  note "${r0.note}"`)
    check(r0.boxes === 1, 'exactly ONE margin box for inLump exists in the document',
      `${r0.boxes} found`)
    check(r0.cost === COST, 'the line carries the lump sum COST', `${r0.cost}`)
    // ── THE EXPECTATION IS DERIVED FROM THE RECORD, NOT FROM THE LOOP ────
    //
    // The first version asserted the TARGET price at both widths and failed
    // at 1240, because the 1440 pass had SAVED an override: the second claim
    // was measuring a fixture the first claim had consumed (Verification 7).
    // The honest expectation is whatever margin the record carries at the
    // moment of the read, so the assertion is the same one at both widths and
    // is still capable of failing - it fires if the screen and the record
    // disagree, which is the thing worth watching.
    const onRecord = (await stored(fx.oppId)).ov ?? TARGET
    check(r0.price === priceAt(onRecord),
      `the price is the derivation of the margin the RECORD carries (${onRecord}%)`,
      `${r0.price} against ${priceAt(onRecord)}`)
    check(r0.totalPrice === r0.hwPrice + r0.price,
      'the card TOTAL includes the installation line', `${r0.totalPrice} = ${r0.hwPrice} + ${r0.price}`)

    if (width !== 1440) continue   // the write is driven once, at 1440

    // ── DRIVE IT ────────────────────────────────────────────────────────
    await p.click('[data-testid="deal-margin-inLump"]')
    await p.type('[data-testid="deal-margin-inLump"]', String(OVERRIDE), { delay: 20 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const r1 = await read()
    check(r1.boxValue === String(OVERRIDE),
      'the typed margin reached the CONTROLLED input', `value "${r1.boxValue}"`)
    check(r1.price === priceAt(OVERRIDE),
      'and the ONE derivation every reader shares moved with it',
      `${r1.price} against ${priceAt(OVERRIDE)}`)

    // ── SAVE, AND PROVE IT LANDED FROM THE DATABASE ────────────────────
    // `#btn-save-deal` IS THE SAVE, and it is static markup rather than a
    // React node: the swap left `.form-actions` alone so the revert stays one
    // line, and the panel binds to it by id. The per-section buttons exist
    // only for sections that render one, and section 4 does not.
    //
    // ITS DISABLED STATE IS THE ONLY THING SAYING THERE IS ANYTHING TO SAVE,
    // so it is asserted before the click: a click on a disabled button is a
    // no-op, and the read-back that followed would report "nothing stored"
    // for a reason that has nothing to do with the allowlist.
    const saveState = await p.evaluate(() => {
      const b2 = document.getElementById('btn-save-deal')
      return b2 ? { present: true, disabled: b2.disabled } : { present: false }
    })
    check(saveState.present && !saveState.disabled,
      'the deal save is enabled, so the typed margin registered as dirty',
      JSON.stringify(saveState))
    await p.click('#btn-save-deal')
    // Wait on the RECORD, not on the screen: the revision advancing is the
    // authority's own answer, and it is what the next read-back depends on.
    let advanced = false
    for (let i = 0; i < 40 && !advanced; i++) {
      await p.evaluate(() => new Promise((r) => setTimeout(r, 500)))
      advanced = (await stored(fx.oppId)).n > before.n
    }
    check(advanced, 'the save landed within the wait', `revision moved from ${before.n}`)

    const after = await stored(fx.oppId)
    check(after.n > before.n, 'the save advanced the record revision',
      `${before.n} -> ${after.n}`)
    check(after.ov === OVERRIDE,
      'DB READ-BACK: marginOverrides.inLump is stored on the record',
      `stored ${after.ov ?? '(none)'}, expected ${OVERRIDE}`)

    // And the derivation survives a reload, which is what says the record
    // rather than the screen is now carrying it.
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), fx.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => !!document.querySelector('[data-testid="btn-toggle-detail"]'), { timeout: 45000 })
    await p.evaluate(() => {
      const t = document.querySelector('[data-testid="btn-toggle-detail"]')
      if (t.getAttribute('aria-expanded') !== 'true') t.click()
    })
    await p.waitForFunction(() => !!document.querySelector('[data-testid="pg-price-inGroup"]'), { timeout: 45000 })
    const r2 = await read()
    check(r2.price === priceAt(OVERRIDE) && r2.boxValue === String(OVERRIDE),
      'and it survives a reload, from the record', `price ${r2.price}, box "${r2.boxValue}"`)

    await p.evaluate(() => document.querySelector('[data-testid="pg-price-inGroup"]')
      ?.closest('.pg-card')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}d3-install-line.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="pg-price-inGroup"]').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.width > 0
    })
    check(inView, 'the installation line is inside the captured region', shot)
  }
} finally {
  await b.close()
  if (fx) { await tearDown(TAG); console.log(`\ntorn down: ${TAG}`) }
}
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
