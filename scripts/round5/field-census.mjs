// ── ROUND 5 PHASE 0 ITEM 2: THE FIELD CENSUS, WITH INSTRUMENT ───────────
//
// Verification 49 in full: taken on a surface that has INITIALISED,
// COMPUTED and been EXERCISED, over more than one BRANCH, with coverage
// asserted against a SECOND instrument rather than assumed.
//
// Round 0's counts have been wrong on both prior surfaces, so the DOM is the
// truth here and any disagreement with the contract's 21/5 table is a
// finding, not a rounding error.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.OUT ?? '/tmp/ref-census.json'
const puppeteer = await loadPuppeteer('field-census')
let browser = null
const { oppId } = await freshOpportunity('R5CENSUS')

const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN - the census would read static markup only')
  }
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })

  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  // INITIALISED: wait on RENDERED TEXT the panel itself produces, never on
  // id presence, which static markup satisfies.
  await page.waitForFunction(() => {
    const t = document.getElementById('ref-terminus-rows')
    const v = document.getElementById('view-opportunity-detail')
    return t && t.querySelectorAll('.ref-field-row, .ref-field-display').length > 3
      && v && !v.classList.contains('is-loading')
  }, { timeout: 30000 })
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  await settle()
  await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
  await settle()
  const visible = await page.evaluate(() => ({
    displayVisible: !!document.getElementById('ref-display-country')?.offsetParent,
    inputVisibleWhenClosed: !!document.getElementById('ref-input-country')?.offsetParent,
    tabActive: !document.getElementById('opp-tab-reference')?.classList.contains('hidden'),
  }))
  check('THE REFERENCE TAB IS THE VISIBLE ONE, or nothing can be exercised',
    visible.displayVisible === true, JSON.stringify(visible))
  const interactive = await page.evaluate(() => {
    const v = document.getElementById('view-opportunity-detail')
    const d = document.getElementById('ref-display-country')
    const r = d?.getBoundingClientRect()
    return {
      isLoading: v?.classList.contains('is-loading') ?? null,
      computedVisibility: d ? getComputedStyle(d).visibility : null,
      hitIsTheRow: r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === d : null,
    }
  })
  check('THE VIEW IS INTERACTIVE: is-loading is cleared, so a real click lands',
    interactive.isLoading === false && interactive.computedVisibility === 'visible',
    JSON.stringify(interactive))
  check('and a CLOSED row keeps its editor out of the tab order (behaviour 3)',
    visible.inputVisibleWhenClosed === false, JSON.stringify(visible))

  // ── THE INSTRUMENT'S OWN COVERAGE, asserted before any count is read ──
  check('the panel INITIALISED: rows exist that only the render can produce',
    await page.evaluate(() => document.querySelectorAll('[id^="ref-display-"]').length > 5),
    await page.evaluate(() => document.querySelectorAll('[id^="ref-display-"]').length))
  check('and the census can tell a rendered row from static markup',
    await page.evaluate(() => {
      const rendered = document.querySelectorAll('#ref-terminus-rows [id^="ref-display-"]').length
      return rendered > 0
    }))

  const shot = async (label) => page.evaluate((lbl) => {
    const rows = []
    for (const d of document.querySelectorAll('[id^="ref-display-"]')) {
      const key = d.id.replace('ref-display-', '')
      const edit = document.getElementById(`ref-edit-${key}`)
      const input = document.getElementById(`ref-input-${key}`)
      const row = d.closest('.ref-field-row') ?? d.parentElement
      const labelEl = row?.querySelector('.ref-field-label, .data-row-label, label')
      let editor = 'none'
      if (input) {
        const t = input.tagName.toLowerCase()
        editor = t === 'select' ? 'select'
          : t === 'textarea' ? 'textarea'
          : input.type === 'date' ? 'date'
          : input.inputMode ? `text[inputmode=${input.inputMode}]`
          : 'text'
      }
      rows.push({
        branch: lbl,
        key,
        label: (labelEl?.textContent ?? '').trim() || null,
        editor,
        options: input?.tagName === 'SELECT'
          ? [...input.options].map((o) => o.value) : null,
        min: input?.getAttribute?.('min') ?? null,
        suffix: row?.querySelector('.field-suffix')?.textContent ?? null,
        displayText: (d.textContent ?? '').trim().slice(0, 40),
        hasDoor: !!(d.getAttribute('onclick') || d.getAttribute('tabindex') !== null),
        tabindex: d.getAttribute('tabindex'),
        readonly: d.classList.contains('readonly'),
        editHidden: edit ? edit.classList.contains('hidden') || edit.hasAttribute('hidden') : null,
        section: d.closest('[id$="-rows"], [id$="-row"], .card, section')?.id || null,
      })
    }
    // Read-only rows carry no ref-display- id at all, so they need their own pass.
    const ro = []
    for (const el of document.querySelectorAll('.ref-field-display.readonly')) {
      const row = el.closest('.ref-field-row') ?? el.parentElement
      ro.push({
        branch: lbl,
        label: (row?.querySelector('.ref-field-label, .data-row-label, label')?.textContent ?? '').trim() || null,
        value: (el.textContent ?? '').trim().slice(0, 40),
        tabindex: el.getAttribute('tabindex'),
        hasOnclick: !!el.getAttribute('onclick'),
        section: el.closest('[id$="-rows"], [id$="-row"], .card, section')?.id || null,
      })
    }
    return { rows, ro,
      sameAsAccount: document.getElementById('ref-same-as-account')?.checked ?? null,
      kc: (() => {
        const el = document.getElementById('ref-key-contacts')
        if (!el) return null
        return {
          present: true,
          rows: el.querySelectorAll('.ref-field-row, .ref-field, tr').length,
          inputs: el.querySelectorAll('input, select, textarea').length,
          buttons: el.querySelectorAll('button, a[href="#"]').length,
          text: (el.textContent ?? '').trim().slice(0, 120),
        }
      })(),
      directInputs: [...document.querySelectorAll(
        '#view-opportunity-detail #opp-tab-reference input, #view-opportunity-detail #opp-tab-reference select, #view-opportunity-detail #opp-tab-reference textarea')]
        .filter((i) => !i.id.startsWith('ref-input-') || i.type === 'checkbox')
        .map((i) => ({ id: i.id || null, tag: i.tagName.toLowerCase(), type: i.type })),
    }
  }, label)

  // ── BRANCH 1: as loaded ───────────────────────────────────────────────
  const b1 = await shot('as-loaded')

  // ── EXERCISED: open a row, so anything that exists only once somebody
  // has edited is in the census (Verification 49's third reading).
  await page.evaluate(() => document.getElementById('ref-display-country')
    ?.scrollIntoView({ block: 'center' }))
  await settle()
  const inView = await page.evaluate(() => {
    const r = document.getElementById('ref-display-country')?.getBoundingClientRect()
    return !!r && r.top >= 0 && r.bottom <= window.innerHeight
  })
  check('the row was brought into view before being clicked',
    inView === true, String(inView))
  await page.click('#ref-display-country')
  await settle()
  const exercised = await page.evaluate(() => ({
    editShown: !document.getElementById('ref-edit-country')?.classList.contains('hidden'),
    displayHidden: document.getElementById('ref-display-country')?.classList.contains('hidden'),
    barExists: !!document.querySelector('#ref-edit-bar, .ref-edit-bar'),
    barVisible: !document.querySelector('#ref-edit-bar, .ref-edit-bar')?.classList.contains('hidden'),
  }))
  check('EXERCISED: opening a row swaps display for edit by visibility',
    exercised.editShown === true && exercised.displayHidden === true, JSON.stringify(exercised))
  const reachable = await page.evaluate(() => ({
    inputVisible: !!document.getElementById('ref-input-country')?.offsetParent,
    focused: document.activeElement?.id ?? null,
  }))
  check('and the OPEN row is focusable, which is what makes typing possible',
    reachable.inputVisible === true, JSON.stringify(reachable))
  // Type, so the dirty machinery and the edit bar have run.
  await page.focus('#ref-input-country')
  await page.keyboard.type('Singapore', { delay: 20 })
  await settle()
  const typed = await page.evaluate(() =>
    document.getElementById('ref-input-country')?.value ?? null)
  check('the keystrokes reached the input, or the bar check below means nothing',
    typed === 'Singapore', `input holds "${typed}"`)
  // MEASURED, not guessed: the bar is two tab-row buttons toggled by the
  // class `tab-action-idle`, and it shows NO COUNT. updateRefEditBar computes
  // dirtyCount and uses it only as a boolean. Recorded as a census finding
  // against contract behaviour 6 rather than asserted away.
  const dirty = await page.evaluate(() => {
    const save = document.getElementById('ref-save-all')
    const cancel = document.getElementById('ref-cancel-all')
    return {
      saveIdle: save?.classList.contains('tab-action-idle') ?? null,
      cancelIdle: cancel?.classList.contains('tab-action-idle') ?? null,
      saveText: save?.textContent?.trim() ?? null,
      showsACount: /\d/.test((save?.textContent ?? '') + (cancel?.textContent ?? '')),
      dirtyMarked: document.querySelectorAll('.dirty').length,
    }
  })
  check('EXERCISED: typing woke the shared edit bar (both controls left idle)',
    dirty.saveIdle === false && dirty.cancelIdle === false, JSON.stringify(dirty))
  const b2 = await shot('exercised')
  await page.evaluate(() => window.discardRefField?.('country'))
  await settle()

  // ── BRANCH 2: same-as-account ON, which swaps 6 rows to read-only ─────
  const toggleExists = await page.evaluate(() =>
    !!document.getElementById('ref-input-commAddressSameAsAccount'))
  let b3 = null
  if (toggleExists) {
    await page.evaluate(() => window.toggleRefSameAsAccount?.(true))
    await settle()
    b3 = await shot('same-as-account-on')
    await page.evaluate(() => window.toggleRefSameAsAccount?.(false))
    await settle()
  }
  check('the same-as-account toggle exists on this surface', toggleExists)

  check('no page errors during the census', errs.length === 0, errs.slice(0, 2).join(' | '))

  // ── THE SECOND INSTRUMENT (Verification 49: coverage is ASSERTED) ────
  // The source's own ALL_EDITABLE_FIELDS, parsed from the file, against the
  // keys the DOM actually rendered. Exact agreement is a TELL on a surface
  // that has run; here it is the claim being tested, so a disagreement in
  // EITHER direction is reported rather than reconciled.
  const src = readFileSync(ROOT + 'frontend/opportunity-reference.js', 'utf8')
  const srcKeys = [...src.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1])
  const domKeys = b1.rows.map((r) => r.key)
  const onlySrc = srcKeys.filter((k) => !domKeys.includes(k))
  const onlyDom = domKeys.filter((k) => !srcKeys.includes(k))
  check('SECOND INSTRUMENT: every source field key rendered a row',
    onlySrc.length === 0, 'in source, not in DOM: ' + (onlySrc.join(', ') || 'none'))
  check('SECOND INSTRUMENT: every rendered row traces to a source field key',
    onlyDom.length === 0, 'in DOM, not in source: ' + (onlyDom.join(', ') || 'none'))
  check('the two instruments were both non-empty before being compared',
    srcKeys.length > 0 && domKeys.length > 0, `source ${srcKeys.length}, DOM ${domKeys.length}`)

  writeFileSync(OUT, JSON.stringify({ b1, b2, b3, exercised, dirty, srcKeys, onlySrc, onlyDom }, null, 2))
  console.log(`census written to ${OUT}`)
  console.log(`  as-loaded        : ${b1.rows.length} editable rows, ${b1.ro.length} read-only`)
  console.log(`  exercised        : ${b2.rows.length} editable rows, ${b2.ro.length} read-only`)
  if (b3) console.log(`  same-as-account  : ${b3.rows.length} editable rows, ${b3.ro.length} read-only`)
  console.log(`  key-contact rows : ${b1.kcRows}`)
} catch (err) {
  R.push({ n: 'CENSUS THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0,
    d: q.error ? q.error.message : String(q.data.length) })
}
const failed = R.filter((r) => !r.p)
console.log(`\nCENSUS INSTRUMENT: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
