// Phase 0, second pass. Two of the first pass's readings were taken on the
// wrong population, which is Verification 25's clause and worth naming:
//
//  - R1 was measured on the COMPLETION surface. John's words are "fields
//    completed via the POPUP lists", and the card has an address POPUP. The
//    completion surface showed no leftover treatment at all, so either the
//    highlight is elsewhere or it is not a class - both are measured here.
//  - R2's scroll and cropping claims were measured on an EMPTY grid, where
//    scrollHeight equals clientHeight because there is nothing to scroll.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0b-ldc.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/ldc/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const industry = must(await db.from('industries').select('id').limit(1), 'i')[0]
const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
  payload: { name: 'ldc0b Popup', company: 'Consolidation Co', source: 'Referral',
    jobRole: 'Head', email: 'ldc0b@example.invalid', mobile: '+65 9000 0302',
    linkedin: 'https://example.invalid/in/x', address: '1 Way', city: '', postcode: '',
    country: 'Singapore', region: 'APAC', summary: 'A summary.' },
  created_by: OWNER.user.id }).select().single(), 'rev')

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async () => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, r.id)
  }

  // ── R1 ON THE ADDRESS POPUP ───────────────────────────────────────────
  console.log('=== R1: the ADDRESS POPUP, before and after its save ===')
  await go()
  await page.click(`[data-testid="lead-address-${r.id}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${r.id}"]`, { timeout: 10000 })
  const look = (keys) => page.evaluate((x, ks) => Object.fromEntries(ks.map((k) => {
    const e = document.querySelector(`[data-testid="addr-${k}-${x}"]`)
    if (!e) return [k, null]
    const s = getComputedStyle(e)
    return [k, { cls: e.className, bg: s.backgroundColor, colour: s.color,
      borderBottom: s.borderBottomColor, value: e.value,
      // The browser's own autofill treatment is a pseudo-class, not a class.
      autofilled: (() => { try { return e.matches(':autofill') } catch { return 'n/a' } })() }]
  })), r.id, keys)
  const b = await look(['city', 'postcode', 'address'])
  for (const [k, v] of Object.entries(b))
    console.log(`  BEFORE ${k.padEnd(9)} cls="${v?.cls}" bg=${v?.bg} value="${v?.value}"`)
  await page.click(`[data-testid="addr-city-${r.id}"]`)
  await page.keyboard.type('Singapore')
  await page.click(`[data-testid="addr-postcode-${r.id}"]`)
  await page.keyboard.type('069118')
  await page.click(`[data-testid="addr-save-${r.id}"]`)
  await new Promise((x) => setTimeout(x, 2500))
  const stillOpen = await page.evaluate((x) =>
    !!document.querySelector(`[data-testid="address-popup-${x}"]`), r.id)
  console.log(`  popup still open after save: ${stillOpen}`)
  if (!stillOpen) {
    // It closed, so any leftover treatment would be on the CARD's fields.
    const card = await page.evaluate((x) => {
      const c = document.querySelector(`[data-testid="lead-card-${x}"]`)
      return [...c.querySelectorAll('input, textarea, select')].map((e) => ({
        testid: e.dataset.testid ?? '(none)', cls: e.className,
        bg: getComputedStyle(e).backgroundColor })).filter((f) => f.bg !== 'rgb(21, 22, 28)')
    }, r.id)
    console.log(`  card fields whose background is NOT the standard dark: ${card.length}`)
    for (const f of card) console.log(`    ${f.testid}  cls="${f.cls}"  bg=${f.bg}`)
  }
  // And the completion surface, reopened AFTER the popup save.
  await page.click(`[data-testid="lead-qualify-${r.id}"]`)
  await new Promise((x) => setTimeout(x, 1500))
  const reopened = await page.evaluate((x) => {
    const s = document.querySelector(`[data-testid="lead-incomplete-${x}"]`)
    if (!s) return { open: false }
    const odd = [...s.querySelectorAll('input, select, textarea')]
      .map((e) => ({ testid: e.dataset.testid, cls: e.className,
        bg: getComputedStyle(e).backgroundColor }))
      .filter((f) => f.bg !== 'rgb(21, 22, 28)')
    return { open: true, markers: s.querySelectorAll('[data-testid^="lead-needs-"]').length, odd }
  }, r.id)
  console.log(`  completion surface reopened: ${reopened.open}, markers ${reopened.markers ?? '-'},`
    + ` fields with a non-standard background: ${reopened.odd?.length ?? '-'}`)
  for (const f of reopened.odd ?? []) console.log(`    ${f.testid} cls="${f.cls}" bg=${f.bg}`)
  const el = await page.$(`[data-testid="lead-card-${r.id}"]`)
  if (el) await el.screenshot({ path: `${OUT}ldc-p0b-after-popup-save.png` })

  // ── R2 ON A GRID WITH DATA ────────────────────────────────────────────
  console.log('\n=== R2: the grid WITH data typed in ===')
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForSelector('#btn-new-contact', { timeout: 15000 })
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 15000 })
  // Fill enough rows to make the body exceed its box, and one long value so
  // cropping is measurable rather than asserted.
  const LONG = 'Wolfeschlegelsteinhausenbergerdorff Holdings International'
  for (let i = 0; i < 6; i++) {
    const sel = `[data-testid="nlg-name-${i}"]`
    if (!await page.$(sel)) break
    await page.click(sel)
    await page.keyboard.type(i === 0 ? LONG : `Row ${i} name`)
  }
  const filled = await page.evaluate((long) => {
    const g = document.querySelector('[data-testid="new-lead-grid"]')
    const scroll = g.querySelector('.new-lead-scroll')
    const input = g.querySelector('[data-testid="nlg-name-0"]')
    const cell = input?.closest('td')
    const rect = (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width) } }
    return {
      rows: g.querySelectorAll('tbody tr').length,
      scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      scrolls: scroll.scrollHeight > scroll.clientHeight,
      inputWidth: rect(input).w, cellWidth: rect(cell).w,
      scrollWidthOfInput: input.scrollWidth,
      valueCropped: input.scrollWidth > input.clientWidth,
      typedLength: long.length, valueLength: input.value.length,
    }
  }, LONG)
  for (const [k, v] of Object.entries(filled)) console.log(`  ${k.padEnd(20)} ${JSON.stringify(v)}`)
  await page.screenshot({ path: `${OUT}ldc-p0b-grid-filled.png` })

  // scroll persistence, now that there IS something to scroll
  if (filled.scrolls) {
    await page.evaluate(() => { document.querySelector('.new-lead-scroll').scrollTop = 80 })
    const set = await page.evaluate(() => document.querySelector('.new-lead-scroll').scrollTop)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#new-contact-form button, .modal-panel-batch button')]
        .find((x) => /close|cancel/i.test(x.textContent || '') || x.id === 'btn-close-new-contact')
      b?.click()
    })
    await new Promise((x) => setTimeout(x, 500))
    await page.click('#btn-new-contact')
    await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 10000 })
    const after = await page.evaluate(() => document.querySelector('.new-lead-scroll')?.scrollTop)
    console.log(`\n  scrollTop set to ${set}; on reopen it is ${after}  => PERSISTS: ${after > 0}`)
  } else {
    console.log('\n  the body still does not exceed its box, so scroll persistence is untestable here')
  }
} finally {
  await browser.close()
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
  const live = must(await db.from('records').select('id').eq('id', r.id).is('deleted_at', null), 'td')
  console.log(`\nteardown: 1 soft-deleted, ${live.length} still live`)
}
