// C2 LIVE: EDITING IN PLACE, AND WHAT THE WRITE ACTUALLY DID
//
// Four claims a unit test cannot make:
//
//   1. AN EDIT IN A DRAWER REACHES EVERY READER. The statement, the strip and
//      the OLD pricing cards are three surfaces over one store, and the round
//      rests on their being unable to disagree.
//   2. THE WRITE LANDS AS THE NEXT REVISION, with the new key on the record -
//      read from the database, not from the screen that just claimed it.
//   3. A FROZEN VERSION IS UNTOUCHED by it.
//   4. RESET RE-READS rather than merely clearing.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet/probe-c2-editing.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../../src/lib/rate-resolution.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const TAG = 'c2edit'
const latest = async (id) => must(await db.from('record_revisions')
  .select('payload, revision_number').eq('record_id', id)
  .order('revision_number', { ascending: false }).limit(1), 'rev')[0]

let fx
const b = await puppeteer.launch({ headless: 'new' })
try {
  fx = await freshOpportunity(TAG)
  await api('PATCH', `/opportunities/${fx.oppId}`, {
    payload: {
      ssExisting: 20, aqm: 2, hemir: 2, duration: 60,
      targetMargin: 30, warrantyPct: 2,
      installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
      whtPct: 15, gstPct: 9, grossUp: true,
      factoring: { enabled: true, ratePct: 1.2, termMonths: 6, method: 'straight' },
    },
  })
  // A FROZEN VERSION, MADE BEFORE ANY EDIT, so claim 3 is about something.
  // THE ROUTE IS READ, NOT GUESSED. It takes `inputs` beside `reason`, and
  // the first attempt sent only the reason and was refused with "inputs is
  // required" - Verification 47's own instance, a request shaped by what the
  // caller wanted rather than by the route.
  const snapshot = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', fx.oppId).order('revision_number', { ascending: false }).limit(1), 'snap')[0]
  // AND `expected_revision`: "a version records the revision it was taken
  // from". Sourced from the authority's own answer rather than from anything
  // rendered, which is Architecture 13.
  // AND `rates`: "a version records the rates its screen priced against, so
  // the server can confirm they still agree with the catalog". Taken from the
  // catalog route through the shared translator, not rebuilt here.
  // THROUGH THE SERVER'S OWN RESOLVER, not the raw catalog. The first attempt
  // sent `catalogToRates` output and was refused 409 listing all ten rates as
  // differing: the server compares `frozenRates(resolveRates(payload,
  // catalog))`, which folds the deal's own install overrides in. Reading
  // through the accessor the authoritative consumer uses is Verification 20's
  // remedy, and sending anything else is a second reader by construction.
  const catalog = await api('GET', '/base-costs')
  const { rates: catalogRates } = catalogToRates(catalog.data?.products ?? [])
  const rates = frozenRates(resolveRates(snapshot.payload, catalogRates))
  const version = await api('POST', `/opportunities/${fx.oppId}/deal-sheet-versions`, {
    reason: 'C2 baseline, to prove an edit cannot reach a frozen version',
    inputs: snapshot.payload,
    expected_revision: snapshot.revision_number,
    rates,
  })
  const vid = version.data?.id ?? version.data?.version?.id
  const frozenBefore = vid
    ? must(await db.from('deal_sheet_versions').select('*').eq('id', vid), 'version')[0]
    : null
  check(!!frozenBefore, 'a frozen version exists to be left alone', vid ?? '(none)')

  const before = await latest(fx.oppId)
  console.log(`fixture ${TAG}: ${fx.oppId} at revision ${before.revision_number}`)

  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1100 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
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
    await p.waitForFunction(() =>
      !!document.querySelector('[data-testid="stmt-strip-revenue"]')?.textContent?.trim(),
      { timeout: 45000 })
    await p.click('[data-testid="stmt-expand-all"]')
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    // ── R-C2a ON SCREEN ─────────────────────────────────────────────────
    const cat = await p.evaluate(() => {
      const bases = [...document.querySelectorAll('[data-testid="stmt-basis"]')]
      return {
        bases: bases.length, first: bases[0]?.textContent?.trim() ?? null,
        // A catalog cost must not be an editor. Measured as the absence of an
        // input INSIDE the read-only cell, not as a class name.
        editorsInCatalogCells: [...document.querySelectorAll('td.stmt-catalog')]
          .filter((td) => td.querySelector('input')).length,
      }
    })
    check(cat.bases >= 6, 'every catalog cost names its batch', `${cat.bases} basis lines, e.g. "${cat.first}"`)
    check(cat.editorsInCatalogCells === 0,
      'R-C2a: no catalog cost is editable', `${cat.editorsInCatalogCells} editors found`)

    const read = () => p.evaluate(() => {
      const t = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null
      const old = document.querySelector('[data-testid="pg-price-hwHemir"]')?.textContent?.trim() ?? null
      return { revenue: t('stmt-strip-revenue'), margin: t('stmt-strip-margin'),
        rowRevenue: t('stmt-revenue-total'), oldCardPrice: old }
    })
    const b0 = await read()
    // THE BASELINE IS TAKEN PER WIDTH, not once. The 1440 pass SAVES, so a
    // constant taken before the loop would make the 1240 pass assert against
    // a revision its own predecessor moved - Verification 7, a fixture
    // consumed by an earlier claim, and it reads exactly like a defect.
    const revAtWidth = (await latest(fx.oppId)).revision_number

    // ── EDIT A MARGIN IN THE DRAWER ─────────────────────────────────────
    //
    // hwHemir, NOT hwSs: the 1440 pass leaves a PRICE OVERRIDE on hwSs, and a
    // margin cannot move a line that carries one - which is the either-or
    // working correctly and would read here as the strip failing to update.
    const sel = '[data-testid="stmt-edit-deal-margin-hwHemir"]'
    await p.click(sel)
    await p.evaluate((s) => { document.querySelector(s).select() }, sel)
    await p.type(sel, '55', { delay: 20 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    const b1 = await read()
    check(b1.revenue !== b0.revenue, 'the STRIP moved on a drawer edit', `${b0.revenue} -> ${b1.revenue}`)
    check(b1.rowRevenue === b1.revenue, 'and the SHEET agrees with it', `${b1.rowRevenue}`)
    check(!!b1.oldCardPrice && b1.oldCardPrice !== b0.oldCardPrice,
      'and the OLD pricing card moved too: one store, three readers',
      `${b0.oldCardPrice} -> ${b1.oldCardPrice}`)

    // ── MODIFIED, NOT SAVED ─────────────────────────────────────────────
    const bar = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="stmt-unsaved"]')
      return { present: !!el, visible: !!el && el.getBoundingClientRect().height > 0 }
    })
    check(bar.present && bar.visible, 'the modified-unsaved bar is shown', JSON.stringify(bar))

    // ── R-K: Enter MOVES, and does not save ─────────────────────────────
    const rk = await p.evaluate(() => {
      const all = [...document.querySelectorAll('.stmt-edit')]
      const i = all.findIndex((e) => e === document.activeElement)
      return { count: all.length, focusedIndex: i }
    })
    await p.keyboard.press('Enter')
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)))
    const afterEnter = await p.evaluate(() => {
      const all = [...document.querySelectorAll('.stmt-edit')]
      return { index: all.findIndex((e) => e === document.activeElement) }
    })
    check(afterEnter.index === rk.focusedIndex + 1,
      'R-K: Enter commits and moves to the NEXT editor',
      `${rk.focusedIndex} -> ${afterEnter.index} of ${rk.count}`)
    const revAfterEnter = (await latest(fx.oppId)).revision_number
    check(revAfterEnter === revAtWidth,
      'R-K: and Enter fired NO record-wide save', `revision still ${revAfterEnter}`)

    // ── RESET RE-READS ──────────────────────────────────────────────────
    if (width === 1440) {
      await p.click('[data-testid="stmt-reset"]')
      await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
      const b2 = await read()
      check(b2.revenue === b0.revenue, 'RESET re-read the record', `${b1.revenue} -> ${b2.revenue}`)
      const gone = await p.evaluate(() => !document.querySelector('[data-testid="stmt-unsaved"]'))
      check(gone, 'and the modified bar went with it')

      // ── EDIT A PRICE OVERRIDE, THE NEW KEY, AND SAVE ─────────────────
      //
      // EXPAND-ALL IS A TOGGLE, and clicking it a second time COLLAPSED the
      // drawers - so the editor below was present, invisible, and not
      // clickable. The control is asked what state it is in rather than
      // clicked blind: a probe that assumes a toggle's direction is measuring
      // its own sequence.
      const needsOpen = await p.evaluate(() =>
        document.querySelector('[data-testid="stmt-expand-all"]')?.textContent?.trim() === 'Expand all')
      if (needsOpen) {
        await p.click('[data-testid="stmt-expand-all"]')
        await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      }
      const psel = '[data-testid="stmt-edit-deal-price-hwSs"]'
      await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), psel)
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await p.click(psel)
      await p.type(psel, '400000', { delay: 15 })
      const csel = '[data-testid="stmt-edit-deal-aqm"]'
      await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), csel)
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await p.click(csel)
      await p.evaluate((s) => { document.querySelector(s).select() }, csel)
      await p.type(csel, '7', { delay: 15 })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
      // ── THE SAVE'S OWN ANSWER IS CAPTURED ────────────────────────────
      //
      // Verification 14: when an assertion about an EFFECT fails, the failure
      // detail carries the CAUSE's answer. "The revision did not move" and
      // "the write was refused with 400" are different failures with
      // different fixes, and without this the probe can only report the first.
      const writes = []
      const onResp = async (r) => {
        if (r.request().method() === 'PATCH' && r.url().includes('/opportunities/')) {
          let body = null
          try { body = await r.text() } catch { /* consumed */ }
          writes.push({ status: r.status(), body: (body ?? '').slice(0, 220) })
        }
      }
      p.on('response', onResp)
      await p.click('[data-testid="stmt-save"]')
      let landed = false
      for (let i = 0; i < 40 && !landed; i++) {
        await p.evaluate(() => new Promise((r) => setTimeout(r, 500)))
        landed = (await latest(fx.oppId)).revision_number > revAtWidth
      }
      p.off('response', onResp)
      check(landed, 'Save landed as the next revision',
        writes.length ? writes.map((w) => `${w.status} ${w.body}`).join(' | ') : 'NO PATCH WAS SENT AT ALL')

      // ── DB READ-BACK, PER KEY ────────────────────────────────────────
      const after = await latest(fx.oppId)
      console.log(`  revision ${revAtWidth} -> ${after.revision_number}`)
      check(after.payload?.priceOverrides?.hwSs === 400000,
        'DB READ-BACK: priceOverrides.hwSs stored', JSON.stringify(after.payload?.priceOverrides))
      check(Number(after.payload?.aqm) === 7,
        'DB READ-BACK: the unit count stored', String(after.payload?.aqm))
      check(after.payload?.marginOverrides?.hwSs === undefined,
        'and the margin the Reset discarded was NOT written',
        JSON.stringify(after.payload?.marginOverrides ?? {}))

      // ── THE FROZEN VERSION IS UNTOUCHED ──────────────────────────────
      if (frozenBefore) {
        const frozenAfter = must(await db.from('deal_sheet_versions').select('*').eq('id', vid), 'version')[0]
        check(JSON.stringify(frozenAfter) === JSON.stringify(frozenBefore),
          'the frozen version is byte-identical after the save')
      }
    }

    await p.evaluate(() => document.querySelector('[data-testid="deal-statement"]')
      ?.scrollIntoView({ block: 'start' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}c2-editing-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="deal-statement"]').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.height > 0
    })
    check(inView, `the statement is inside the captured region at ${width}`, shot)
  }
} finally {
  await b.close()
  if (fx) { await tearDown(TAG); console.log(`\ntorn down: ${TAG}`) }
}
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
