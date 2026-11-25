#!/usr/bin/env node
// TERM_QUOTES: the Term quote tab FROM THE CLICK, as the signed-in non-admin
// user (John's PROBES ruling, 2026-11-20). Every claim is the person's path:
// keyboard and clicks on the served bundle, the result read back from the
// DATABASE or the server's own figures, never from the screen that just
// claimed it (Verification 52's "gate the verdict on the action having
// LANDED").
//
//   K1  tab order Reference | Term quote | Commercials | Assessment, landing Reference (V1)
//   K2  mount: the bound screen in the Term quote tab, no settings editors (V3)
//   K3  inputs in and onChange out: typed units and a clicked term price on today's settings
//   K4  save through the seam: the record's termQuote and a term version, both the typed quote
//   K5  submit through the seam: V1.0, frozen as a term quote
//   K6  the inactive tab's line on Commercials, the deal form hidden (V2)
//   K7  the approval page's term ask and Cash flow card (V5, CF2)
//   K8  the what-changed table after a second term version (D4, CF3)
//   K9  factoring on: the tab's cash flow equals the standalone screen's (CF1)
//   K10 the method switch, both ways (V2)
//   K11 the reopened-draft banner, from a TAGGED FIXTURE draft whose stored
//       snapshot differs from today's, seeded by the service role (V4)
//   K12 the Closed Won lock (V6)
//
// Settings are READ, never written. Fixtures by admin write are declared at
// each one (Verification 47's clause): the approval of V1.0 and the win need a
// second person or a stage the account cannot reach, and the surface reads
// the state, not how it arrived. Teardown by tag.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { readTermState } from '../src/lib/term-params.js'
import { termQuoteValue, cashFlowCard, whatMoved, whatMovedSentence, centsMoney } from '../src/lib/term-quote.js'
import { CLOSED_WON_PRICING_REFUSAL } from '../src/lib/pricing-keys.js'

const TAG = process.argv[2] ?? 'tqclick'
const SHOT_DIR = '.verify/term-quotes'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const money = (n) => (n === null || n === undefined ? '--' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const sleepless = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, { timeout: ms }, arg).then(() => true, () => false)

const puppeteer = await loadPuppeteer('probe-term-quote-tab-click.mjs')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const db = admin()
const today = await readTermState(db)
const QUOTE = (units, extra = {}) => ({ units: { safesight: units, air_quality: 0, hemir: 0 }, termMonths: 120, paymentStructure: 'opex', ...extra })
const expected60 = termQuoteValue(QUOTE(60), today.params)
if (expected60.refusal) { console.log(`STOP: today's settings cannot price SafeSight 60 at 120 months (${expected60.refusal.message})`); process.exit(3) }

const opp = await freshOpportunity(TAG, { pricingMethod: null })
const versionsOf = async () => must(await db.from('deal_sheet_versions').select('id, kind, status, major, minor, inputs, frozen_figures, revision_number')
  .eq('record_id', opp.oppId).order('created_at').range(0, 199), 'versions')
const recordPayload = async () => must(await db.from('record_revisions').select('payload, revision_number').eq('record_id', opp.oppId)
  .order('revision_number', { ascending: false }).limit(1).single(), 'latest revision')
let browser
try {
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1000 })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  // Every PATCH the page sends, with its answer: the cause's own field when an
  // effect fails (Verification 14's clause).
  const patches = []
  page.on('response', async (r) => {
    if (r.request().method() !== 'PATCH' || !r.url().includes(`/opportunities/${opp.oppId}`)) return
    let body = null
    try { body = await r.json() } catch { /* not json */ }
    patches.push({ status: r.status(), body: JSON.stringify(body?.error ?? body?.payload?.pricingMethod ?? '').slice(0, 160), sent: r.request().postData()?.slice(0, 120) })
  })
  // F5_TEARDOWN_SCALE ruling K1 (2026-11-25): every /api request the page has
  // in flight, so a click that sends nothing can be read against what the
  // product was doing at that moment.
  const inFlight = new Map()
  const reqKey = (q) => `${q.method()} ${new URL(q.url()).pathname}`
  page.on('request', (q) => { if (q.url().includes('/api/')) inFlight.set(q, reqKey(q)) })
  page.on('requestfinished', (q) => inFlight.delete(q))
  page.on('requestfailed', (q) => inFlight.delete(q))
  // What is at the control's centre, and whether it can take a click. Self
  // contained, because Puppeteer ships it to the page as source. With `want`
  // it answers only "live": present, enabled, and the control (or its child)
  // is what elementFromPoint returns (Verification 14's click clause).
  const liveState = (sel, want) => {
    const el = document.querySelector(sel)
    if (!el) return want ? false : { present: false }
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    const onTop = !!hit && (hit === el || el.contains(hit))
    if (want) return !el.disabled && onTop
    const name = (n) => !n ? null : `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${n.dataset?.testid ? `[${n.dataset.testid}]` : ''}${typeof n.className === 'string' && n.className.trim() ? `.${n.className.trim().split(/\s+/).join('.')}` : ''}`
    return { present: true, disabled: el.disabled, onTop, hit: name(hit), at: [Math.round(cx), Math.round(cy)], viewport: [innerWidth, innerHeight], oppLoads: window.__oppLoadsInFlight?.() ?? null }
  }
  // K1: read the control at first sight, wait (bounded) for it to be live,
  // read it again at the click. K2: a control NOT live at first sight while
  // the product had a request or a load in flight is a product finding (a
  // person's click would be swallowed), reported as its own failed check
  // rather than absorbed by the wait. Returns whether the click was made.
  const clickWhenLive = async (sel, label, ms = 10000) => {
    const present = await sleepless(page, (s) => !!document.querySelector(s), sel, ms)
    if (!present) { check(`${label}: ${sel} is present`, false, `absent after ${ms}ms`); return false }
    await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center', inline: 'center' }))
    const first = { ...(await page.evaluate(liveState, sel)), api: [...inFlight.values()] }
    console.log(`  ${label} first sight: ${JSON.stringify(first)}`)
    const busy = first.api.length > 0 || (first.oppLoads ?? 0) > 0
    if (!(first.disabled === false && first.onTop)) {
      check(`${label}: not live at first sight with nothing in flight (else a click is swallowed)`, !busy, JSON.stringify(first))
    }
    const live = await page.waitForFunction(liveState, { timeout: ms }, sel, true).then(() => true, () => false)
    const atClick = { ...(await page.evaluate(liveState, sel)), api: [...inFlight.values()] }
    console.log(`  ${label} at click: ${JSON.stringify(atClick)}`)
    if (!live) { check(`${label}: ${sel} present, enabled and on top within ${ms}ms`, false, JSON.stringify(atClick)); return false }
    await page.click(sel)
    return true
  }
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${REF}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  const open = async () => {
    await page.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    // NOT the view's is-loading class alone: arriving from another view it was
    // already clear, so the first version typed into a detail still loading
    // (two loads in flight) and the keys were lost (Verification 7, a wait the
    // old state satisfies). The shell's own in-flight count is the state.
    await page.waitForFunction(() => (window.__oppLoadsInFlight?.() ?? 1) === 0
      && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })
  }
  const tab = async (key) => { await page.click(`#opp-detail-tabs [data-opp-tab="${key}"]`); await page.waitForFunction((k) => !document.getElementById(`opp-tab-${k}`)?.classList.contains('hidden'), { timeout: 10000 }, key) }
  // Real keyboard events (Verification 6, the write side): focus, select the
  // whole value, delete it, type. A triple click did not select an input's
  // text here, and the first run typed 60 in front of the 1 already there.
  const typeInto = async (sel, value) => {
    await page.focus(sel)
    await page.$eval(sel, (e) => e.select())
    await page.keyboard.press('Backspace')
    await page.keyboard.type(value)
    const now = await page.$eval(sel, (e) => e.value)
    if (now !== value) throw new Error(`typing into ${sel} left "${now}", not "${value}"`)
  }
  await open()

  // ── K1 ──
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#opp-detail-tabs .detail-tab')].map((t) => t.textContent.trim()))
  check('K1: the tab order begins Reference | Term quote | Commercials | Assessment', JSON.stringify(tabs.slice(0, 4)) === JSON.stringify(['Reference', 'Term quote', 'Commercials', 'Assessment']), tabs.join(' | '))
  const landing = await page.evaluate(() => document.querySelector('#opp-detail-tabs .detail-tab.active')?.textContent.trim())
  check('K1: the landing tab is Reference', landing === 'Reference', landing)

  // ── K2 ──
  await tab('term')
  const mounted = await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  check('K2: the bound Term Pricing screen mounts in the Term quote tab', mounted)
  const noSettings = await page.evaluate(() => !document.querySelector('#opp-tab-term [data-testid="tp-settings"]') && !document.querySelector('#opp-tab-term [data-testid="tp-head-base"]'))
  check('K2: no admin settings editors and no standalone header in the tab', noSettings)

  // ── K3 ──
  await typeInto('#opp-tab-term [data-testid="tp-units-safesight"]', '60')
  await page.click('#opp-tab-term [data-testid="tp-ladder-120"]')
  const priced = await sleepless(page, (t) => document.querySelector('#opp-tab-term [data-testid="tp-p-base"]')?.textContent.trim() === t, money(expected60.tcv))
  const shownBase = await page.$eval('#opp-tab-term [data-testid="tp-p-base"]', (e) => e.textContent.trim()).catch(() => null)
  check('K3: typed units and a clicked term price on today\'s settings', priced, `screen ${shownBase}, engine on today's settings ${money(expected60.tcv)}`)
  const beforeSave = await recordPayload()
  check('K3: an edit is not a write: the record holds no quote until a version is saved', !beforeSave.payload?.termQuote)

  // ── K4 ──
  await typeInto('#opp-tab-term [data-testid="tq-reason"]', `${TAG} first term price`)
  await page.click('#opp-tab-term [data-testid="tq-save"]')
  const savedOne = await sleepless(page, async () => true, null, 1).then(async () => {
    for (let i = 0; i < 60; i++) { if ((await versionsOf()).length >= 1) return true; await new Promise((r) => setTimeout(r, 500)) }
    return false
  })
  const v1 = (await versionsOf())[0]
  const rp = await recordPayload()
  check('K4: Save version took a term version of the typed quote', savedOne && v1?.kind === 'term_quote' && v1?.inputs?.units?.safesight === 60 && v1?.inputs?.termMonths === 120,
    `${v1?.kind} ${JSON.stringify(v1?.inputs?.units)} ${v1?.inputs?.termMonths}`)
  check('K4: and saved the record\'s termQuote first, the same quote', rp.payload?.termQuote?.units?.safesight === 60 && rp.payload?.pricingMethod === 'term_quote')
  const head = (await api('GET', `/opportunities/${opp.oppId}`)).data
  check('K4: the headline is that quote\'s Base TCV on today\'s settings', head.total_contract_value === expected60.tcv, `${head.total_contract_value} vs ${expected60.tcv}`)

  // ── K5 ──
  await open(); await tab('term')
  await sleepless(page, () => /as V1\.0 for approval$/.test(document.querySelector('#opp-tab-term [data-testid="tq-submit"]')?.textContent.trim() ?? ''))
  const submitLabel = await page.$eval('#opp-tab-term [data-testid="tq-submit"]', (e) => e.textContent.trim())
  await page.click('#opp-tab-term [data-testid="tq-submit"]')
  let issued = null
  for (let i = 0; i < 60 && !issued; i++) { issued = (await versionsOf()).find((v) => v.status === 'issued') ?? null; if (!issued) await new Promise((r) => setTimeout(r, 500)) }
  check('K5: Submit, from the click, submits V0.1 as V1.0, frozen as a term quote', submitLabel === 'Submit V0.1 as V1.0 for approval' && issued?.major === 1 && issued?.frozen_figures?.kind === 'term_quote'
    && issued?.frozen_figures?.page?.ask?.baseTcv === expected60.tcv, `${submitLabel}; ${issued?.major}.${issued?.minor} ${issued?.frozen_figures?.kind}`)

  // ── K6 ──
  await open(); await tab('commercial')
  const inactive = await sleepless(page, () => document.querySelector('#opp-tab-commercial [data-testid="pm-inactive"] .pm-inactive-head')?.textContent.trim() === 'Not in use. This deal is priced by Term quote.')
  const formHidden = await page.evaluate(() => getComputedStyle(document.getElementById('deal-form-root')).display === 'none'
    && getComputedStyle(document.getElementById('deal-version-root') ?? document.body).display === 'none')
  check('K6: the Commercials tab shows the artboard 3 line', inactive)
  check('K6: and only that: the deal form and its version card are not displayed (computed style)', formHidden)

  // ── K7 ──
  await page.evaluate((id) => navigate('opportunity-approval', id), opp.oppId)
  const askShown = await sleepless(page, (t) => document.querySelector('[data-testid="tq-ask-base"]')?.textContent.trim() === t, money(expected60.tcv), 30000)
  const card = cashFlowCard(expected60.quote)
  const cf = await page.evaluate(() => ({
    peak: document.querySelector('[data-testid="tq-cf-peak"]')?.textContent.trim(),
    payback: document.querySelector('[data-testid="tq-cf-payback"]')?.textContent.trim(),
    fx: document.querySelector('[data-testid="tq-cf-factoring"]')?.textContent.trim(),
    chips: [...document.querySelectorAll('[data-testid="tq-ask"] .tq-chip')].map((c) => c.textContent.trim()),
  }))
  check('K7: the approval page\'s term ask reads the frozen Base TCV', askShown)
  check('K7: the Cash flow card, as ruled', cf.peak === (card.peakFunding?.text ?? card.noFundingNeed) && cf.payback === card.paybackText && cf.fx === 'PO factoring: off', JSON.stringify(cf))
  check('K7: the two chips', cf.chips.length === 2 && cf.chips.some((c) => /No deal discount: priced at list/.test(c)), JSON.stringify(cf.chips))

  // ── K8: V1.0 approved (admin fixture), then V2.0 under review ──
  // Approval needs a person other than the requester; written by admin and
  // declared. The page reads the approval through the request's
  // frozen_version_id, which is the system's own join.
  const rec = must(await db.from('records').select('status').eq('id', opp.oppId).single(), 'record')
  const req = must(await db.from('transition_requests').insert({
    record_id: opp.oppId, record_type: 'opportunity', from_stage: rec.status, to_stage: rec.status, kind: 'review', status: 'approved',
    frozen_revision: issued.revision_number, frozen_version_id: issued.id, requested_by: session.user.id,
    closed_by: session.user.id, closed_at: new Date().toISOString(), close_reason: `${TAG}: V1.0 approved, admin fixture`,
  }).select('id').single(), 'approved review')
  must(await db.from('approvals').insert({ record_id: opp.oppId, stage: rec.status, revision_number: issued.revision_number, track: 'Commercial',
    tier: null, approver_id: session.user.id, decision: 'approved', comment: `${TAG} fixture`, decided_at: new Date().toISOString(), request_id: req.id }).select('id'), 'approval')
  await open(); await tab('term')
  await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  await typeInto('#opp-tab-term [data-testid="tp-units-safesight"]', '80')
  await typeInto('#opp-tab-term [data-testid="tq-reason"]', `${TAG} more cameras`)
  await page.click('#opp-tab-term [data-testid="tq-save"]')
  for (let i = 0; i < 60 && (await versionsOf()).length < 2; i++) await new Promise((r) => setTimeout(r, 500))
  await open(); await tab('term')
  await sleepless(page, () => /as V2\.0 for approval$/.test(document.querySelector('#opp-tab-term [data-testid="tq-submit"]')?.textContent.trim() ?? ''))
  await page.click('#opp-tab-term [data-testid="tq-submit"]')
  let v2 = null
  for (let i = 0; i < 60 && !v2; i++) { v2 = (await versionsOf()).find((v) => v.major === 2) ?? null; if (!v2) await new Promise((r) => setTimeout(r, 500)) }
  if (!v2) throw new Error(`K8 setup: no V2.0 was submitted; versions ${JSON.stringify((await versionsOf()).map((v) => `${v.major}.${v.minor} ${v.status}`))}`)
  await page.evaluate((id) => navigate('opportunity-approval', id), opp.oppId)
  const tableShown = await sleepless(page, () => !!document.querySelector('[data-testid="tq-changed"]'), null, 30000)
  const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid^="tq-changed-"]')]
    .map((r) => [r.dataset.testid.replace('tq-changed-', ''), { changed: r.dataset.changed, cells: [...r.children].map((c) => c.textContent.trim()) }])))
  check('K8: two term versions: the what-changed table, not a bridge', tableShown && !!v2, `V2 ${v2?.major}.${v2?.minor}`)
  check('K8: SafeSight units changed 60 to 80; HEMIR unchanged and marked so', rows['units.safesight']?.changed === 'true' && rows['units.safesight']?.cells[1] === '60' && rows['units.safesight']?.cells[2] === '80'
    && rows['units.hemir']?.changed === 'false', JSON.stringify([rows['units.safesight'], rows['units.hemir']]))
  check('K8: Base TCV and margin carry their difference; the CF3 rows are present', /^[+-]\d/.test(rows.baseTcv?.cells[3] ?? '') && / pts$/.test(rows.margin?.cells[3] ?? '') && !!rows.peak && !!rows.factoring,
    JSON.stringify([rows.baseTcv, rows.margin, rows.peak?.cells, rows.factoring?.cells]))
  mkdirSync(SHOT_DIR, { recursive: true })
  for (const w of [1240, 1920]) { await page.setViewport({ width: w, height: 1000 }); await page.screenshot({ path: `${SHOT_DIR}/${TAG}-approval-${w}.png`, fullPage: true }) }
  await page.setViewport({ width: 1240, height: 1000 })

  // ── K9: factoring on, the tab against the standalone screen ──
  const factoringOn = async (root) => {
    await page.click(`${root} [data-testid="tp-tab-payment"]`)
    await page.waitForSelector(`${root} [data-testid="tp-factoring-toggle"]`, { timeout: 10000 })
    await page.click(`${root} [data-testid="tp-factoring-toggle"]`)
    await page.waitForSelector(`${root} [data-testid="tp-fx-rate"]`, { timeout: 10000 })
    await typeInto(`${root} [data-testid="tp-fx-rate"]`, '1.0')
    await sleepless(page, (r) => !!document.querySelector(`${r} [data-testid="tp-cf-lowest"]`), root)
    return page.$eval(`${root} [data-testid="tp-cashflow"]`, (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)
  }
  await open(); await tab('term')
  await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  const tabCf = await factoringOn('#opp-tab-term')
  for (const w of [1240, 1920]) { await page.setViewport({ width: w, height: 1000 }); await page.screenshot({ path: `${SHOT_DIR}/${TAG}-tab-payment-factoring-${w}.png`, fullPage: true }) }
  await page.setViewport({ width: 1240, height: 1000 })
  await page.evaluate(() => navigate('term-pricing'))
  await page.waitForSelector('#view-term-pricing [data-testid="tp-units-safesight"]', { timeout: 20000 })
  await typeInto('#view-term-pricing [data-testid="tp-units-safesight"]', '80')
  await page.click('#view-term-pricing [data-testid="tp-ladder-120"]')
  const standCf = await factoringOn('#view-term-pricing')
  check('K9: factoring on, the tab\'s cash flow renders', !!tabCf && /Lowest balance with factoring/i.test(tabCf), (tabCf ?? '').slice(0, 120))
  check('K9: and equals the standalone screen\'s for the same inputs, character for character', !!tabCf && tabCf === standCf, `tab ${tabCf?.length} chars, standalone ${standCf?.length}`)

  // ── K10 ──
  await open(); await tab('term')
  // K1 (2026-11-25): the merged gate's red was this click sending NO request.
  // The control is now read and made to be live before it is clicked.
  const clickedComm = await clickWhenLive('#opp-tab-term [data-testid="pm-commercials"]', 'K10 pm-commercials')
  let m = null
  for (let i = 0; clickedComm && i < 40; i++) { m = (await recordPayload()).payload?.pricingMethod; if (m === 'commercials') break; await new Promise((r) => setTimeout(r, 500)) }
  const termInactive = await sleepless(page, () => document.querySelector('#opp-tab-term [data-testid="pm-inactive"] .pm-inactive-head')?.textContent.trim() === 'Not in use. This deal is priced by Commercials.')
  check('K10: choosing Commercials writes pricingMethod, and the Term quote tab goes inactive', clickedComm && m === 'commercials' && termInactive, `clicked ${clickedComm}; ${m} ${termInactive}; PATCHes ${JSON.stringify(patches.slice(-3))}`)
  await tab('commercial')
  // K4: the same selector, so the same helper.
  await clickWhenLive('#opp-tab-commercial [data-testid="pm-term_quote"]', 'K10 pm-term_quote')
  for (let i = 0; i < 40; i++) { m = (await recordPayload()).payload?.pricingMethod; if (m === 'term_quote') break; await new Promise((r) => setTimeout(r, 500)) }
  check('K10: and back, from the Commercials tab\'s selector', m === 'term_quote', m)

  // ── K11: the TAGGED FIXTURE draft, seeded by the service role ──
  // Its snapshot is today's parameters with ONE value moved (SafeSight at 120
  // months, +10.00), so the banner has exactly one thing to say. Live
  // settings are not touched; the difference lives only in the fixture row.
  const stored = structuredClone(today.params)
  const was = stored.PRICE_LADDER_BY_PRODUCT.safesight['120']
  const moved = (Number(was) * 100 + 1000)
  stored.PRICE_LADDER_BY_PRODUCT.safesight['120'] = `${Math.floor(moved / 100)}.${String(moved % 100).padStart(2, '0')}`
  const latest = await recordPayload()
  const fixtureDraft = must(await db.rpc('insert_deal_sheet_version', {
    p_record_id: opp.oppId, p_expected_revision: latest.revision_number, p_reason: `${TAG} FIXTURE draft, stored snapshot differs from today's`,
    p_inputs: latest.payload.termQuote, p_rates: { params: stored, fixture: TAG }, p_sections: [], p_batch_id: null,
    p_created_by: session.user.id, p_created_by_email: null, p_kind: 'term_quote',
  }), 'fixture draft')
  const savedTcv = termQuoteValue(latest.payload.termQuote, stored).tcv
  const todayTcv = termQuoteValue(latest.payload.termQuote, today.params).tcv
  const diff = Math.round((todayTcv - savedTcv) * 100)
  await open(); await tab('term')
  const banner = await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tq-reopened"]'))
  const b = await page.evaluate(() => Object.fromEntries(['saved', 'today', 'diff', 'moved'].map((k) => [k, document.querySelector(`[data-testid="tq-reopened-${k}"]`)?.textContent.trim()])))
  check('K11: the reopened-draft banner shows for the fixture draft', banner && fixtureDraft?.status === 'draft')
  check('K11: saved, today and the difference, priced by the engine on each snapshot', b.saved === money(savedTcv) && b.today === money(todayTcv)
    && b.diff === `${diff >= 0 ? '+' : '-'}${centsMoney(BigInt(Math.abs(diff)))}`, JSON.stringify(b))
  check('K11: and what moved, in plain words', b.moved === whatMovedSentence(whatMoved(stored, today.params)), b.moved)
  for (const w of [1240, 1920]) { await page.setViewport({ width: w, height: 1000 }); await page.screenshot({ path: `${SHOT_DIR}/${TAG}-tab-reopened-${w}.png`, fullPage: true }) }
  await page.setViewport({ width: 1240, height: 1000 })

  // ── K12: the win (admin stage write and an approved raise, declared) ──
  must(await db.from('transition_requests').insert({
    record_id: opp.oppId, record_type: 'opportunity', from_stage: rec.status, to_stage: 'Closed Won', kind: 'transition', status: 'approved',
    frozen_revision: v2.revision_number, frozen_version_id: v2.id, requested_by: session.user.id,
    closed_by: session.user.id, closed_at: new Date().toISOString(), close_reason: `${TAG}: the win, admin fixture`,
  }).select('id').single(), 'approved raise')
  must(await db.from('records').update({ status: 'Closed Won' }).eq('id', opp.oppId).select('id').single(), 'the win')
  const v2row = (await versionsOf()).find((v) => v.id === v2.id)
  await open(); await tab('term')
  const wonShown = await sleepless(page, (t) => document.querySelector('#opp-tab-term [data-testid="tq-won"] b')?.textContent.trim() === t, CLOSED_WON_PRICING_REFUSAL)
  const lock = await page.evaluate(() => ({
    term: document.querySelector('#opp-tab-term [data-testid="pm-term_quote"]')?.disabled,
    comm: document.querySelector('#opp-tab-term [data-testid="pm-commercials"]')?.disabled,
    save: !!document.querySelector('#opp-tab-term [data-testid="tq-save"]'),
    submit: !!document.querySelector('#opp-tab-term [data-testid="tq-submit"]'),
    base: document.querySelector('#opp-tab-term [data-testid="tq-won-base"]')?.textContent.trim(),
  }))
  check('K12: the won banner in the refusal\'s exact words', wonShown)
  check('K12: the selector disabled, no save, no submit', lock.term === true && lock.comm === true && !lock.save && !lock.submit, JSON.stringify(lock))
  check('K12: the won version\'s frozen Base TCV', lock.base === money(v2row?.frozen_figures?.page?.ask?.baseTcv), `${lock.base} vs ${v2row?.frozen_figures?.page?.ask?.baseTcv}`)
  for (const w of [1240, 1920]) { await page.setViewport({ width: w, height: 1000 }); await page.screenshot({ path: `${SHOT_DIR}/${TAG}-tab-won-${w}.png`, fullPage: true }) }

  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
