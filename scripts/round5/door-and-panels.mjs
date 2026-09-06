// ── ROUND 5 PHASE 0, ITEMS 2 (tail), 3, 4 and 5 ─────────────────────────
// The door's readers, the read-only tab-stop question, the key-contacts
// sub-panel and same-as-account, measured on a live initialised surface.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.OUT ?? '/tmp/door.json'
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 220) })
const puppeteer = await loadPuppeteer('door-and-panels')
let browser = null
const { oppId } = await freshOpportunity('R5DOOR')
let out = {}
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
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => {
    const t = document.getElementById('ref-terminus-rows')
    const v = document.getElementById('view-opportunity-detail')
    return t && t.querySelectorAll('.ref-field-display').length > 3
      && v && !v.classList.contains('is-loading')
  }, { timeout: 30000 })
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
  await settle()

  // ── ITEM 2 TAIL: who authored the read-only rows' tab stop ────────────
  const ro = await page.evaluate(() => [...document.querySelectorAll('.ref-field-display.readonly')]
    .map((el) => ({
      label: el.closest('.ref-field')?.querySelector('.ref-field-label span')?.textContent ?? null,
      tabindex: el.getAttribute('tabindex'),
      ariaDisabled: el.getAttribute('aria-disabled'),
      onclick: el.getAttribute('onclick'),
    })))
  out.readonlyRows = ro
  check('the 5 read-only rows carry NO opener, as the contract says',
    ro.length === 5 && ro.every((r) => !r.onclick), `${ro.length} rows`)
  check('BUT they carry a tab stop the row renderer never emitted',
    ro.every((r) => r.tabindex === '0'), ro.map((r) => r.tabindex).join(','))
  check('and app.js is the author: only its sweep sets aria-disabled',
    ro.every((r) => r.ariaDisabled === 'false'), ro.map((r) => r.ariaDisabled).join(','))

  // ── ITEM 3: every reader of is-not-mine on this surface ───────────────
  out.door = await page.evaluate(() => ({
    classOnView: document.getElementById('view-opportunity-detail')?.className,
    notMine: document.getElementById('view-opportunity-detail')?.classList.contains('is-not-mine'),
    editOpeners: document.querySelectorAll('#view-opportunity-detail .ref-field-display:not(.readonly)').length,
    withTabindex0: document.querySelectorAll('#view-opportunity-detail .ref-field-display[tabindex="0"]').length,
    withTabindexMinus1: document.querySelectorAll('#view-opportunity-detail .ref-field-display[tabindex="-1"]').length,
  }))
  check('this fixture is OWNED, so the door is open (the baseline for item 3)',
    out.door.notMine === false, JSON.stringify(out.door))

  // ── ITEM 4: the key-contacts sub-panel ────────────────────────────────
  out.kc = await page.evaluate(() => {
    const el = document.getElementById('ref-key-contacts')
    if (!el) return { present: false }
    const ids = [...el.querySelectorAll('[id]')].map((e) => e.id)
    return {
      present: true,
      html: el.innerHTML.length,
      text: (el.textContent ?? '').trim().slice(0, 160),
      ids,
      inputs: [...el.querySelectorAll('input, select, textarea')]
        .map((i) => ({ id: i.id || null, tag: i.tagName.toLowerCase(), type: i.type })),
      clickables: [...el.querySelectorAll('[onclick], button')]
        .map((b) => ({ tag: b.tagName.toLowerCase(), cls: b.className,
          onclick: (b.getAttribute('onclick') ?? '').slice(0, 60) })),
      fieldRows: el.querySelectorAll('.ref-field-display').length,
    }
  })
  check('the key-contacts sub-panel renders', out.kc.present === true)
  check('and it uses NO field rows, so it is its own component, not row material',
    out.kc.fieldRows === 0, `ref-field-display inside it: ${out.kc.fieldRows}`)

  // ── ITEM 5: same-as-account, as behaviours ────────────────────────────
  const box = '#ref-input-commAddressSameAsAccount'
  out.saa = { before: await page.evaluate((s) => {
    const el = document.querySelector(s)
    return { checked: el?.checked, editable: document.querySelectorAll('#ref-customer-rows .ref-field-display:not(.readonly)').length,
      readonly: document.querySelectorAll('#ref-customer-rows .ref-field-display.readonly').length }
  }, box) }
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), box)
  await settle()
  await page.click(box)
  await settle()
  out.saa.afterOn = await page.evaluate((s) => {
    const el = document.querySelector(s)
    return { checked: el?.checked,
      editable: document.querySelectorAll('#ref-customer-rows .ref-field-display:not(.readonly)').length,
      readonly: document.querySelectorAll('#ref-customer-rows .ref-field-display.readonly').length,
      saveIdle: document.getElementById('ref-save-all')?.classList.contains('tab-action-idle'),
      emptyNote: document.querySelector('#ref-customer-rows .ref-empty-inline')?.textContent?.trim().slice(0, 80) ?? null }
  }, box)
  check('ticking same-as-account SWAPS the six address rows to read-only',
    out.saa.afterOn.readonly > out.saa.before.readonly, JSON.stringify(out.saa))
  check('and it makes the surface dirty, so it rides the batched save',
    out.saa.afterOn.saveIdle === false, `saveIdle=${out.saa.afterOn.saveIdle}`)
  await page.click(box)
  await settle()
  out.saa.afterOff = await page.evaluate((s) => ({
    checked: document.querySelector(s)?.checked,
    saveIdle: document.getElementById('ref-save-all')?.classList.contains('tab-action-idle'),
  }), box)
  check('and ticking it back to the original clears the draft (dirty by comparison)',
    out.saa.afterOff.saveIdle === true, JSON.stringify(out.saa.afterOff))

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  writeFileSync(OUT, JSON.stringify(out, null, 2))
} catch (err) {
  R.push({ n: 'THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0, d: String(q.data?.length ?? '?') })
}
const failed = R.filter((r) => !r.p)
console.log(`\nDOOR AND PANELS: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
