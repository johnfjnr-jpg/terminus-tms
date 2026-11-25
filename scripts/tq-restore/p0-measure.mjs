#!/usr/bin/env node
// TQ_RESTORE Phase 0 (John, 2026-11-25): measurements FROM THE CLICK for
// P1, P3, P4 and P5. A measurement probe, not a gate: it prints READ lines
// and asserts nothing about what the product should do, because Phase 0
// reports what IS. Each reading carries the cause's own answer (the record's
// fingerprint, the dialogue's text, the PATCHes sent).
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/tq-restore/p0-measure.mjs [tag]
//
// Two tagged fixtures: C (priced by Commercials) and T (priced by Term
// quote). Admin writes are declared where made (Verification 47's clause):
// one term_quote version seeded onto C by the service role (P5), and the
// Closed Won stage on both (the account cannot reach it). Settings are READ,
// never written. Teardown by tag, both tags.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api } from '../api-client.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { readTermState } from '../../src/lib/term-params.js'

const TAG = process.argv[2] ?? `tqp0${Date.now().toString(36)}`
const OUT = '.verify/tq-restore'
mkdirSync(OUT, { recursive: true })
const read = (name, value) => console.log(`READ ${name}: ${JSON.stringify(value)}`)
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const sleepless = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, { timeout: ms }, arg).then(() => true, () => false)
const db = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const puppeteer = await loadPuppeteer('tq-restore p0-measure')

const latestRev = async (id) => must(await db.from('record_revisions').select('revision_number, payload').eq('record_id', id)
  .order('revision_number', { ascending: false }).limit(1).single(), 'latest revision')
const versionsOf = async (id) => must(await db.from('deal_sheet_versions').select('id, kind, status, major, minor, inputs')
  .eq('record_id', id).order('created_at').range(0, 199), 'versions')
const fingerprint = async (id) => {
  const r = must(await db.from('records').select('status, updated_at').eq('id', id).single(), 'records')
  const l = await latestRev(id)
  return { status: r.status, updated_at: r.updated_at, revision: l.revision_number, versions: (await versionsOf(id)).length }
}
const pollUntil = async (fn, n = 60) => { for (let i = 0; i < n; i++) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 500)) } return null }

const TC = `${TAG}c`, TT = `${TAG}t`
let browser
try {
  const C = await freshOpportunity(TC)
  const T = await freshOpportunity(TT, { pricingMethod: null })
  read('fixtures', { C: 'commercials-priced', T: (await latestRev(T.oppId)).payload?.pricingMethod ?? 'unset (term default)' })
  const setC = await api('PATCH', `/opportunities/${C.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await latestRev(C.oppId)).revision_number })
  read('C priced through the route', { status: setC.status ?? 200 })

  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1000 })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  const sent = []
  page.on('request', (q) => { if (/\/api\//.test(q.url()) && q.method() !== 'GET') sent.push(`${q.method()} ${new URL(q.url()).pathname}`) })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${REF}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })

  const settled = () => page.waitForFunction(() => (window.__oppLoadsInFlight?.() ?? 1) === 0
    && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })
  const open = async (id) => { await page.evaluate((i) => navigate('opportunity-detail', i), id); await settled() }
  const tab = async (key) => { await page.click(`#opp-detail-tabs [data-opp-tab="${key}"]`); await page.waitForFunction((k) => !document.getElementById(`opp-tab-${k}`)?.classList.contains('hidden'), { timeout: 10000 }, key) }
  const typeInto = async (sel, value) => {
    await page.focus(sel); await page.$eval(sel, (e) => e.select()); await page.keyboard.press('Backspace'); await page.keyboard.type(value)
    await page.keyboard.press('Tab')
  }
  const modal = () => page.evaluate(() => {
    const m = document.getElementById('discard-confirm-modal')
    return { open: !!m && !m.classList.contains('hidden'), text: m ? m.innerText.replace(/\s+/g, ' ').trim() : null }
  })
  const closeModal = async (choice) => { if ((await modal()).open) await page.click(choice === 'discard' ? '#discard-confirm-discard' : '#discard-confirm-keep') }
  const beforeunload = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented })
  const where = (name) => page.evaluate((n) => ({ visibleViews: [...document.querySelectorAll('[id^="view-"]')].filter((v) => !v.classList.contains('hidden') && v.offsetParent !== null).map((v) => v.id), showing: (document.getElementById('view-opportunity-detail')?.innerText ?? '').includes(n) }), name)
  const cState = () => page.evaluate(() => ({
    ssNew: document.getElementById('deal-ssNew')?.value ?? null,
    unsavedStrip: !!document.querySelector('[data-testid="stmt-unsaved"]'),
    saveDisabled: document.getElementById('btn-save-deal')?.disabled ?? null,
    restoreButtons: [...document.querySelectorAll('#opp-tab-commercial [data-restore-version]')].filter((b) => b.offsetParent !== null).length,
    feedback: document.getElementById('deal-version-feedback')?.textContent?.trim() ?? null,
  }))
  const tState = () => page.evaluate(() => ({
    units: document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]')?.value ?? null,
    base: document.querySelector('#opp-tab-term [data-testid="tp-p-base"]')?.textContent?.trim() ?? null,
    restoreButtons: [...document.querySelectorAll('#opp-tab-term [data-restore-version], #opp-tab-term button')].filter((b) => /restore/i.test(b.textContent) && b.offsetParent !== null).length,
    versionList: !!document.querySelector('#opp-tab-term #deal-version-list, #opp-tab-term [data-testid="tq-version-list"]'),
  }))

  // ═══ C: COMMERCIALS ═══════════════════════════════════════════════════
  await open(C.oppId); await tab('commercial')
  await page.waitForFunction(() => document.getElementById('deal-ssNew')?.value === '10', { timeout: 30000 })
  // V0.1 from the click: the card's own reason box and Save version.
  await page.click('#deal-version-reason'); await page.keyboard.type(`${TC} first`)
  await page.click('#btn-save-version')
  const cv1 = await pollUntil(async () => (await versionsOf(C.oppId))[0])
  read('P1 C V0.1 taken from the click', { kind: cv1?.kind, ssNew: cv1?.inputs?.ssNew })
  await settled()
  // Save the record at 12, so the record and V0.1 differ.
  await typeInto('#deal-ssNew', '12')
  await page.waitForFunction(() => !document.getElementById('btn-save-deal')?.disabled, { timeout: 10000 })
  read('P1 C dirty at 12, before save', await cState())
  await page.click('#btn-save-deal')
  await pollUntil(async () => (await latestRev(C.oppId)).payload?.ssNew === 12)
  await settled()
  read('P1 C saved at 12', { record: (await latestRev(C.oppId)).payload?.ssNew, screen: await cState() })

  // P1: Restore V0.1 on a CLEAN form.
  let fp = await fingerprint(C.oppId)
  sent.length = 0
  await page.click(`[data-restore-version="${cv1.id}"]`)
  await new Promise((r) => setTimeout(r, 1500))
  read('P1 Restore on a clean form: dialogue', await modal())
  read('P1 Restore on a clean form: screen', await cState())
  read('P1 Restore on a clean form: requests sent', sent.slice())
  read('P1 Restore on a clean form: record unchanged', { before: fp, after: await fingerprint(C.oppId) })
  // The Reset on the unsaved strip, if there is one.
  if ((await cState()).unsavedStrip) {
    await page.click('[data-testid="stmt-reset"]'); await new Promise((r) => setTimeout(r, 800))
    read('P1 after Reset on the strip', await cState())
  }

  // P1/P3: Restore on a DIRTY form.
  await typeInto('#deal-ssNew', '14')
  sent.length = 0
  await page.click(`[data-restore-version="${cv1.id}"]`)
  await sleepless(page, () => !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), null, 3000)
  read('P3 Restore on a dirty form: dialogue', await modal())
  await closeModal('keep')
  read('P3 Restore dirty, Keep editing: screen', await cState())
  await page.click(`[data-restore-version="${cv1.id}"]`)
  await sleepless(page, () => !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), null, 3000)
  await closeModal('discard'); await new Promise((r) => setTimeout(r, 1500))
  read('P3 Restore dirty, Discard: screen', await cState())
  read('P3 Restore dirty: requests sent', sent.slice())

  // P3: the other triggers, with Commercials dirty (screen at 14).
  await typeInto('#deal-ssNew', '14')
  await tab('reference'); read('P3 C dirty, tab switch to Reference: dialogue', await modal()); await closeModal('keep')
  await tab('commercial'); read('P3 C after tab switch and back', await cState())
  read('P3 C dirty, beforeunload prevented', await beforeunload())
  await page.evaluate((i) => navigate('opportunity-detail', i), T.oppId)
  await new Promise((r) => setTimeout(r, 800))
  read('P3 C dirty, navigate to another record: dialogue', await modal())
  await closeModal('keep'); await settled()
  read('P3 C dirty, navigate: now showing T', await where(`${TT} Opportunity`))
  await open(C.oppId); await tab('commercial')
  read('P3 C after navigating away and back', await cState())
  await typeInto('#deal-ssNew', '14')
  await page.click('#opp-tab-commercial [data-testid="pm-term_quote"]')
  await new Promise((r) => setTimeout(r, 800))
  read('P3 C dirty, method switch: dialogue', await modal())
  await closeModal('keep')
  await pollUntil(async () => (await latestRev(C.oppId)).payload?.pricingMethod === 'term_quote', 20)
  await settled()
  await page.click('#opp-tab-commercial [data-testid="pm-commercials"]').catch(() => {})
  await pollUntil(async () => (await latestRev(C.oppId)).payload?.pricingMethod === 'commercials', 20)
  await settled()
  read('P3 C after method switch and back', await cState())

  // P5: a term version on a Commercials-priced record (service-role fixture, declared).
  const lr = await latestRev(C.oppId)
  must(await db.rpc('insert_deal_sheet_version', {
    p_record_id: C.oppId, p_expected_revision: lr.revision_number, p_reason: `${TC} FIXTURE term version on a Commercials deal`,
    p_inputs: { units: { safesight: 60, air_quality: 0, hemir: 0 }, termMonths: 120, paymentStructure: 'opex' }, p_rates: { params: (await readTermState(db)).params, fixture: TC },
    p_sections: [], p_batch_id: null, p_created_by: session.user.id, p_created_by_email: null, p_kind: 'term_quote',
  }), 'P5 fixture term version')
  const termOnC = (await versionsOf(C.oppId)).find((v) => v.kind === 'term_quote')
  await open(C.oppId); await tab('commercial')
  await sleepless(page, (id) => !!document.querySelector(`[data-restore-version="${id}"]`), termOnC.id)
  read('P5 C before the term restore (dirty?)', await cState())
  if ((await cState()).unsavedStrip) { await page.click('[data-testid="stmt-reset"]'); await new Promise((r) => setTimeout(r, 800)) }
  const errBefore = pageErrors.length
  fp = await fingerprint(C.oppId); sent.length = 0
  await page.click(`[data-restore-version="${termOnC.id}"]`)
  await new Promise((r) => setTimeout(r, 2000))
  read('P5 ...: dialogue', await modal())
  await closeModal('keep')
  read('P5 Restore of a term version on Commercials: screen', await cState())
  read('P5 ...: page errors raised by the click', pageErrors.slice(errBefore))
  read('P5 ...: words anywhere on the Commercials tab', await page.evaluate(() => /term quote version, so it cannot be restored/.test(document.getElementById('opp-tab-commercial')?.innerText ?? '')))
  read('P5 ...: requests sent; record unchanged', { sent: sent.slice(), before: fp, after: await fingerprint(C.oppId) })
  // P5: the restore route over HTTP, as the user.
  const routeTerm = await api('POST', `/deal-sheet-versions/${termOnC.id}/restore`, {})
  read('P5 route on a term version', { kind: routeTerm?.kind ?? routeTerm?.data?.kind, label: routeTerm?.label ?? routeTerm?.data?.label })

  // ═══ T: TERM QUOTE ════════════════════════════════════════════════════
  await open(T.oppId); await tab('term')
  await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  await typeInto('#opp-tab-term [data-testid="tp-units-safesight"]', '60')
  await page.click('#opp-tab-term [data-testid="tp-ladder-120"]')
  await page.click('#opp-tab-term [data-testid="tq-reason"]'); await page.keyboard.type(`${TT} first`)
  await page.click('#opp-tab-term [data-testid="tq-save"]')
  const tv1 = await pollUntil(async () => (await versionsOf(T.oppId))[0])
  read('P4 T V0.1 saved', { kind: tv1?.kind, units: tv1?.inputs?.units?.safesight, months: tv1?.inputs?.termMonths, record: (await latestRev(T.oppId)).payload?.termQuote?.units?.safesight })
  await open(T.oppId); await tab('term')
  await sleepless(page, () => document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]')?.value === '60')
  read('P2 T: Term quote tab today (list and Restore present?)', await tState())
  const dirtyT = async () => { await typeInto('#opp-tab-term [data-testid="tp-units-safesight"]', '80'); await page.click('#opp-tab-term [data-testid="tp-ladder-96"]').catch(() => {}); await new Promise((r) => setTimeout(r, 500)) }
  await dirtyT(); read('P4 T dirty (80, 96)', await tState())

  await tab('commercial'); read('P4 T dirty, tab to Commercials: dialogue', await modal()); await closeModal('keep')
  await tab('term'); read('P4 T after Commercials tab and back', await tState())

  await tab('assessment')
  await page.click('#opp-assessment-mount-strip [data-sub-tab="commercial"]')
  await page.evaluate(() => document.getElementById('opp-assess-reason-assessCommBudgetConfirmed')?.scrollIntoView({ block: 'center' }))
  await page.click('label[for="opp-assess-lv-assessCommBudgetConfirmed-2"]')
  await page.click('#opp-assess-reason-assessCommBudgetConfirmed', { clickCount: 3 }); await page.keyboard.type('No budget conversation yet')
  const revBefore = (await latestRev(T.oppId)).revision_number
  await page.click('#opp-assess-savebar-record')
  await page.waitForFunction(() => /^Saved /.test(document.getElementById('opp-assess-savebar-feedback')?.textContent ?? ''), { timeout: 20000 }).catch(() => {})
  await settled()
  await tab('term')
  read('P4 T after an Assessment save elsewhere on the record', { revision: [revBefore, (await latestRev(T.oppId)).revision_number], ...(await tState()) })

  const mark = await page.evaluate(() => window.__oppPulseStats?.rereads ?? null)
  const out = await api('PATCH', `/opportunities/${T.oppId}`, { payload: { summary: `${TT} outside change` }, expected_revision: (await latestRev(T.oppId)).revision_number })
  const reread = await sleepless(page, (m) => (window.__oppPulseStats?.rereads ?? 0) > m, mark, 45000)
  await settled()
  read('P4 T after an outside save and the pulse re-read', { patched: out?.status ?? 200, reread, ...(await tState()) })

  read('P3/P4 T dirty, beforeunload prevented', await beforeunload())

  await page.evaluate((i) => navigate('opportunity-detail', i), C.oppId)
  await new Promise((r) => setTimeout(r, 800))
  read('P3/P4 T dirty, navigate to another record: dialogue', await modal())
  await closeModal('keep'); await settled()
  read('P3/P4 T dirty, navigate: now showing C', await where(`${TC} Opportunity`))
  await open(T.oppId); await tab('term')
  await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  read('P4 T after navigating away and back', await tState())

  await dirtyT()
  await page.click('#opp-tab-term [data-testid="pm-commercials"]')
  await new Promise((r) => setTimeout(r, 800))
  read('P4 T dirty, method switch: dialogue', await modal())
  await closeModal('keep')
  await pollUntil(async () => (await latestRev(T.oppId)).payload?.pricingMethod === 'commercials', 20)
  await settled()
  read('P4 T after switching to Commercials: tab', await page.evaluate(() => document.querySelector('#opp-tab-term [data-testid="pm-inactive"]')?.innerText?.trim() ?? null))
  await tab('commercial')
  await page.click('#opp-tab-commercial [data-testid="pm-term_quote"]')
  await pollUntil(async () => (await latestRev(T.oppId)).payload?.pricingMethod === 'term_quote', 20)
  await settled(); await tab('term')
  await sleepless(page, () => !!document.querySelector('#opp-tab-term [data-testid="tp-units-safesight"]'))
  read('P4 T after method switch and back', await tState())
  read('P4 T record termQuote throughout', (await latestRev(T.oppId)).payload?.termQuote?.units)

  // ═══ P5: CLOSED WON (admin stage write, declared) ═════════════════════
  for (const [name, id] of [['C', C.oppId], ['T', T.oppId]]) {
    must(await db.from('records').update({ status: 'Closed Won' }).eq('id', id).select('id').single(), `${name} the win`)
    await open(id); await tab('commercial')
    await new Promise((r) => setTimeout(r, 1500))
    read(`P5 ${name} Closed Won, Commercials tab`, await cState())
    await tab('term'); await new Promise((r) => setTimeout(r, 800))
    read(`P5 ${name} Closed Won, Term quote tab`, { won: await page.evaluate(() => !!document.querySelector('#opp-tab-term [data-testid="tq-won"]')), ...(await tState()) })
  }
  read('page errors, whole run', pageErrors)
} finally {
  await browser?.close()
  await tearDown(TC)
  await tearDown(TT)
}
