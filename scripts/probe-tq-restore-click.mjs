#!/usr/bin/env node
// TQ_RESTORE FROM THE CLICK, as the signed-in non-admin user (P6 and the
// PROBE ruling, John 2026-11-25; spec v2.2 section 14.9). Verdicts are read
// from the DATABASE and the record's fingerprint (revision, updated_at,
// version count), never from the screen that just claimed them.
//
//   X1     the two-record save on Commercials: A 10/36, B 20/48; open A then B;
//          B shows 20/48 unmarked; 21 typed on B and saved; B holds 21/48
//   LIST   the Term quote tab lists term versions only, newest first, with the
//          frozen Base TCV on an issued row and the "as saved" figure on a
//          draft priced on its OWN stored settings; Commercials lists its own
//   TR     Restore is unsaved edits (TR-1, on TODAY's settings via the engine,
//          ruling T); Reset goes back (TR-2); Save changes writes termQuote
//          only; Restore over unsaved edits asks first
//   B      the restored banner for a version whose stored settings differ
//   GUARD  both tabs: navigating to another record asks the one dialogue,
//          Keep editing keeps the edits, Discard leaves; reload is held
//   WON    Closed Won offers no Restore on either tab
//
// Sections can be run alone (ONLY=X1,GUARD) for calibration. Settings are READ,
// never written. Admin writes are declared at each (Verification 47): a draft
// whose stored snapshot differs from today's, a term version on a
// Commercials-priced record, and the Closed Won stage. Teardown by tag.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { readTermState } from '../src/lib/term-params.js'
import { termQuoteValue } from '../src/lib/term-quote.js'

const TAG = process.argv[2] ?? 'tqrestore'
const ONLY = new Set((process.env.ONLY ?? 'X1,LIST,TR,B,GUARD,WON').split(','))
const SHOT_DIR = '.verify/tq-restore'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const money = (n) => (n === null || n === undefined ? '--' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const sleepless = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, { timeout: ms }, arg).then(() => true, () => false)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await loadPuppeteer('probe-tq-restore-click.mjs')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const db = admin()
const today = await readTermState(db)
const Q = (units, termMonths) => ({ units: { safesight: units, air_quality: 0, hemir: 0 }, termMonths, paymentStructure: 'opex' })
const priced = (q, params = today.params) => termQuoteValue(q, params).tcv

const latestRev = async (id) => must(await db.from('record_revisions').select('revision_number, payload').eq('record_id', id)
  .order('revision_number', { ascending: false }).limit(1).single(), 'latest revision')
const versionsOf = async (id) => must(await db.from('deal_sheet_versions').select('id, kind, status, major, minor, inputs, frozen_figures')
  .eq('record_id', id).order('created_at').range(0, 199), 'versions')
const fingerprint = async (id) => {
  const r = must(await db.from('records').select('status, updated_at').eq('id', id).single(), 'records')
  return JSON.stringify({ ...r, revision: (await latestRev(id)).revision_number, versions: (await versionsOf(id)).length })
}
const pollUntil = async (fn, n = 60) => { for (let i = 0; i < n; i++) { const v = await fn(); if (v) return v; await pause(500) } return null }
const tags = []
const fresh = async (suffix, opts) => { const t = `${TAG}${suffix}`; tags.push(t); return { ...(await freshOpportunity(t, opts)), tag: t } }

let browser
try {
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
  const showing = (name) => page.evaluate((n) => (document.getElementById('view-opportunity-detail')?.innerText ?? '').includes(n), name)
  const open = async (fx) => {
    await page.evaluate((i) => navigate('opportunity-detail', i), fx.oppId)
    await settled()
    await page.waitForFunction((n) => (document.getElementById('view-opportunity-detail')?.innerText ?? '').includes(n), { timeout: 30000 }, `${fx.tag} Opportunity`)
  }
  const tab = async (key) => { await page.click(`#opp-detail-tabs [data-opp-tab="${key}"]`); await page.waitForFunction((k) => !document.getElementById(`opp-tab-${k}`)?.classList.contains('hidden'), { timeout: 10000 }, key) }
  const typeInto = async (sel, value) => {
    await page.focus(sel); await page.$eval(sel, (e) => e.select()); await page.keyboard.press('Backspace'); await page.keyboard.type(value); await page.keyboard.press('Tab')
    const now = await page.$eval(sel, (e) => e.value)
    if (now !== value) throw new Error(`typing into ${sel} left "${now}", not "${value}"`)
  }
  const modal = () => page.evaluate(() => {
    const m = document.getElementById('discard-confirm-modal')
    return { open: !!m && !m.classList.contains('hidden'), heading: document.getElementById('discard-confirm-heading')?.textContent?.trim() ?? null,
      keep: document.getElementById('discard-confirm-keep')?.textContent?.trim() ?? null, discard: document.getElementById('discard-confirm-discard')?.textContent?.trim() ?? null }
  })
  const answer = async (choice) => { if ((await modal()).open) { await page.click(choice === 'discard' ? '#discard-confirm-discard' : '#discard-confirm-keep'); await pause(300) } }
  const held = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented })
  const visibleRestores = (root) => page.evaluate((r) => [...document.querySelectorAll(`${r} [data-restore-version]`)].filter((b) => b.offsetParent !== null).map((b) => b.dataset.restoreVersion), root)
  const T = '#opp-tab-term'
  const termBase = () => page.$eval(`${T} [data-testid="tp-p-base"]`, (e) => e.textContent.trim()).catch(() => null)
  const termStrip = () => page.evaluate((r) => { const s = document.querySelector(`${r} [data-testid="stmt-unsaved"]`); return !!s && s.offsetParent !== null }, T)
  const termReady = () => sleepless(page, (r) => !!document.querySelector(`${r} [data-testid="tp-units-safesight"]`), T)

  // ═══ X1: the two-record save on Commercials ═══════════════════════════
  if (ONLY.has('X1')) {
    const A = await fresh('xa'), B = await fresh('xb')
    await api('PATCH', `/opportunities/${A.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await latestRev(A.oppId)).revision_number })
    await api('PATCH', `/opportunities/${B.oppId}`, { payload: { ssNew: 20, duration: 48 }, expected_revision: (await latestRev(B.oppId)).revision_number })
    const cform = () => page.evaluate(() => ({ ssNew: document.getElementById('deal-ssNew')?.value ?? null, duration: document.getElementById('deal-duration')?.value ?? null,
      unsaved: !!document.querySelector('#opp-tab-commercial [data-testid="stmt-unsaved"]'), saveDisabled: document.getElementById('btn-save-deal')?.disabled ?? null }))
    await open(A); await tab('commercial'); await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '10')
    await open(B); await tab('commercial'); await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '20', null, 8000)
    const b = await cform()
    check('X1: record B opened after A shows B\'s own 20 units and 48 months', b.ssNew === '20' && b.duration === '48', JSON.stringify(b))
    check('X1: and unmarked: no unsaved strip, Save changes disabled', !b.unsaved && b.saveDisabled === true, JSON.stringify(b))
    await typeInto('#deal-ssNew', '21')
    await page.waitForFunction(() => !document.getElementById('btn-save-deal')?.disabled, { timeout: 10000 }).catch(() => {})
    await page.click('#btn-save-deal')
    const landed = await pollUntil(async () => (await latestRev(B.oppId)).payload?.ssNew === 21)
    const pb = (await latestRev(B.oppId)).payload, pa = (await latestRev(A.oppId)).payload
    check('X1: 21 saved on B: B holds 21 units and its own 48 months', !!landed && pb.ssNew === 21 && pb.duration === 48, `B ${pb.ssNew}/${pb.duration}`)
    check('X1: and A is untouched at 10/36', pa.ssNew === 10 && pa.duration === 36, `A ${pa.ssNew}/${pa.duration}`)
  }

  // ── The term fixture shared by LIST, TR, B and GUARD ──
  let TF = null, v10 = null, draftMoved = null, C = null
  const needTerm = ['LIST', 'TR', 'B', 'GUARD', 'WON'].some((s) => ONLY.has(s))
  if (needTerm) {
    TF = await fresh('t', { pricingMethod: null })
    await open(TF); await tab('term'); await termReady()
    await typeInto(`${T} [data-testid="tp-units-safesight"]`, '60')
    await page.click(`${T} [data-testid="tp-ladder-120"]`)
    await typeInto(`${T} [data-testid="tq-reason"]`, `${TF.tag} first term price`)
    await page.click(`${T} [data-testid="tq-save"]`)
    await pollUntil(async () => (await versionsOf(TF.oppId)).length >= 1)
    await open(TF); await tab('term')
    await sleepless(page, (r) => /as V1\.0 for approval$/.test(document.querySelector(`${r} [data-testid="tq-submit"]`)?.textContent.trim() ?? ''), T)
    await page.click(`${T} [data-testid="tq-submit"]`)
    v10 = await pollUntil(async () => (await versionsOf(TF.oppId)).find((v) => v.status === 'issued'))
    if (!v10) throw new Error('setup: V1.0 was not submitted from the click')
    // ADMIN FIXTURE, declared: a term draft whose stored snapshot differs from
    // today's (SafeSight at 120 months +10.00), so a draft's "as saved" figure
    // and banner B have something to say. Live settings are not touched.
    const stored = structuredClone(today.params)
    const was = Number(stored.PRICE_LADDER_BY_PRODUCT.safesight['120']) * 100 + 1000
    stored.PRICE_LADDER_BY_PRODUCT.safesight['120'] = `${Math.floor(was / 100)}.${String(was % 100).padStart(2, '0')}`
    const lr = await latestRev(TF.oppId)
    draftMoved = must(await db.rpc('insert_deal_sheet_version', {
      p_record_id: TF.oppId, p_expected_revision: lr.revision_number, p_reason: `${TF.tag} FIXTURE draft on moved settings`,
      p_inputs: Q(60, 120), p_rates: { params: stored, fixture: TF.tag }, p_sections: [], p_batch_id: null,
      p_created_by: session.user.id, p_created_by_email: null, p_kind: 'term_quote',
    }), 'fixture draft')
    draftMoved.stored = stored
  }

  // ═══ LIST ═════════════════════════════════════════════════════════════
  if (ONLY.has('LIST')) {
    await open(TF); await tab('term'); await termReady()
    await sleepless(page, (r) => document.querySelectorAll(`${r} [data-testid="tq-version-row"]`).length >= 2, T, 15000)
    const rows = await page.evaluate((r) => [...document.querySelectorAll(`${r} [data-testid="tq-version-row"]`)].map((e) => ({
      id: e.dataset.versionId, label: e.querySelector('.ds-label')?.textContent.replace(/\s+/g, ' ').trim(), figure: e.querySelector('[data-testid="tq-version-figure"]')?.textContent.trim() })), T)
    const all = await versionsOf(TF.oppId)
    const termIds = all.filter((v) => v.kind === 'term_quote').sort((a, b) => b.major - a.major || b.minor - a.minor).map((v) => v.id)
    check('LIST: the Term quote tab lists the record\'s term versions only, newest first', JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(termIds), `${JSON.stringify(rows.map((r) => r.label))} vs ${termIds.length} term versions`)
    const issuedRow = rows.find((r) => r.id === v10.id), draftRow = rows.find((r) => r.id === draftMoved.id)
    const frozen = (await versionsOf(TF.oppId)).find((v) => v.id === v10.id)?.frozen_figures?.page?.ask?.baseTcv
    check('LIST: the issued row shows its FROZEN Base TCV', issuedRow?.figure === `Base TCV ${money(frozen)}`, `${issuedRow?.figure} vs ${money(frozen)}`)
    const asSaved = priced(Q(60, 120), draftMoved.stored)
    check('LIST: the draft row shows Base TCV on its OWN stored settings, "as saved" (not today\'s)', draftRow?.figure === `Base TCV ${money(asSaved)} as saved` && asSaved !== priced(Q(60, 120)), `${draftRow?.figure} vs ${money(asSaved)}`)
    // Commercials lists its own: a Commercials-priced record carrying a term version (admin fixture, declared).
    C = await fresh('c')
    await api('PATCH', `/opportunities/${C.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await latestRev(C.oppId)).revision_number })
    await open(C); await tab('commercial'); await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '10')
    await page.click('#deal-version-reason'); await page.keyboard.type(`${C.tag} first`)
    await page.click('#btn-save-version')
    const cv = await pollUntil(async () => (await versionsOf(C.oppId))[0])
    const lr = await latestRev(C.oppId)
    must(await db.rpc('insert_deal_sheet_version', { p_record_id: C.oppId, p_expected_revision: lr.revision_number, p_reason: `${C.tag} FIXTURE term version`,
      p_inputs: Q(60, 120), p_rates: { params: today.params, fixture: C.tag }, p_sections: [], p_batch_id: null, p_created_by: session.user.id, p_created_by_email: null, p_kind: 'term_quote' }), 'term version on C')
    await open(C); await tab('commercial')
    await sleepless(page, (id) => !!document.querySelector(`[data-restore-version="${id}"]`), cv.id)
    const cIds = await visibleRestores('#opp-tab-commercial')
    check('LIST: the Commercials tab lists Commercials versions only', JSON.stringify(cIds) === JSON.stringify([cv.id]), `${cIds.length} rows listed of ${(await versionsOf(C.oppId)).length} versions`)
    // And its Restore still works: the form takes the version, nothing written.
    const fp = await fingerprint(C.oppId)
    await typeInto('#deal-ssNew', '12'); await page.click('#btn-save-deal'); await pollUntil(async () => (await latestRev(C.oppId)).payload?.ssNew === 12); await settled()
    const fp2 = await fingerprint(C.oppId)
    await page.click(`[data-restore-version="${cv.id}"]`)
    const back = await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '10', null, 8000)
    check('LIST: Commercials Restore still fills the form, and writes nothing', back && (await fingerprint(C.oppId)) === fp2 && fp2 !== fp, `form back to 10: ${back}`)
    await page.click('#opp-tab-commercial [data-testid="stmt-reset"]').catch(() => {})
  }

  // ═══ TR (TR-1, TR-2, Save changes, Restore over edits) ════════════════
  if (ONLY.has('TR')) {
    await open(TF); await tab('term'); await termReady()
    // The record's working quote becomes 80/96 through the strip's Save changes.
    await typeInto(`${T} [data-testid="tp-units-safesight"]`, '80')
    await page.click(`${T} [data-testid="tp-ladder-96"]`)
    const stripShown = await sleepless(page, (r) => !!document.querySelector(`${r} [data-testid="stmt-unsaved"]`), T, 5000)
    const vBefore = (await versionsOf(TF.oppId)).length
    await page.click(`${T} [data-testid="stmt-save"]`).catch(() => {})
    const saved8096 = await pollUntil(async () => { const t = (await latestRev(TF.oppId)).payload?.termQuote; return t?.units?.safesight === 80 && t?.termMonths === 96 })
    await settled()
    check('S: an edit shows "Modified, not saved"; Save changes writes termQuote and takes no version', stripShown && !!saved8096 && (await versionsOf(TF.oppId)).length === vBefore, `strip ${stripShown}, saved ${!!saved8096}`)
    const fp = await fingerprint(TF.oppId)
    sent.length = 0
    await page.click(`${T} [data-version-id="${v10.id}"] [data-restore-version]`).catch(() => {})
    const restored = await sleepless(page, (a) => document.querySelector(`${a[0]} [data-testid="tp-p-base"]`)?.textContent.trim() === a[1], [T, money(priced(Q(60, 120)))], 8000)
    check('TR-1: Restore V1.0 reads V1.0\'s quote priced on today\'s settings', restored, `${await termBase()} vs engine ${money(priced(Q(60, 120)))}`)
    check('TR-1: with "Modified, not saved" showing', await termStrip())
    check('TR-1: and nothing written: the fingerprint is unchanged and only the restore was sent', restored && sent.some((s) => /\/restore$/.test(s)) && (await fingerprint(TF.oppId)) === fp && sent.every((s) => /\/restore$/.test(s)), `restored ${restored}; ${sent.join(', ')}`)
    await page.click(`${T} [data-testid="stmt-reset"]`).catch(() => {})
    const reset = await sleepless(page, (a) => document.querySelector(`${a[0]} [data-testid="tp-p-base"]`)?.textContent.trim() === a[1], [T, money(priced(Q(80, 96)))], 5000)
    check('TR-2: Reset returns to the record\'s saved quote, and the strip goes', restored && !!saved8096 && reset && !(await termStrip()), `restored ${restored}, ${await termBase()}`)
    // Restore over unsaved edits asks the one dialogue.
    await typeInto(`${T} [data-testid="tp-units-safesight"]`, '70')
    await page.click(`${T} [data-version-id="${v10.id}"] [data-restore-version]`).catch(() => {})
    await pause(500)
    const m = await modal()
    check('Restore over unsaved edits asks "Discard unsaved changes?" (Keep editing | Discard)', m.open && m.heading === 'Discard unsaved changes?' && m.keep === 'Keep editing' && m.discard === 'Discard', JSON.stringify(m))
    await answer('keep')
    check('Keep editing keeps the edit', m.open && (await page.$eval(`${T} [data-testid="tp-units-safesight"]`, (e) => e.value)) === '70', `asked ${m.open}`)
    await page.click(`${T} [data-version-id="${v10.id}"] [data-restore-version]`).catch(() => {})
    await pause(300); await answer('discard')
    await sleepless(page, (a) => document.querySelector(`${a[0]} [data-testid="tp-p-base"]`)?.textContent.trim() === a[1], [T, money(priced(Q(60, 120)))], 8000)
    await page.click(`${T} [data-testid="stmt-save"]`).catch(() => {})
    const kept = await pollUntil(async () => (await latestRev(TF.oppId)).payload?.termQuote?.units?.safesight === 60)
    check('TR-1: Save changes after the Restore: the record holds V1.0\'s 60/120, no version taken', !!saved8096 && !!kept && (await latestRev(TF.oppId)).payload.termQuote.termMonths === 120 && (await versionsOf(TF.oppId)).length === vBefore)
    await settled()
  }

  // ═══ B ════════════════════════════════════════════════════════════════
  if (ONLY.has('B')) {
    await open(TF); await tab('term'); await termReady()
    await sleepless(page, (a) => !!document.querySelector(`${a[0]} [data-version-id="${a[1]}"] [data-restore-version]`), [T, draftMoved.id], 15000)
    await page.click(`${T} [data-version-id="${draftMoved.id}"] [data-restore-version]`).catch(() => {})
    await answer('discard')
    const shown = await sleepless(page, (r) => !!document.querySelector(`${r} [data-testid="tq-restored"]`), T, 8000)
    const t = await page.$eval(`${T} [data-testid="tq-restored"]`, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '')
    const label = `V${draftMoved.major}.${draftMoved.minor}`
    check('B: restoring a version on moved settings shows the ruled banner, naming it', shown && t.startsWith(`Restored from ${label}. It was priced at ${money(priced(Q(60, 120), draftMoved.stored))} on its own settings; today's settings price it at ${money(priced(Q(60, 120)))}`)
      && t.endsWith('Save changes to keep it as your working quote.'), t.slice(0, 200))
    await page.click(`${T} [data-testid="stmt-reset"]`).catch(() => {})
    await mkdirSync(SHOT_DIR, { recursive: true })
  }

  // ═══ GUARD, both tabs ═════════════════════════════════════════════════
  if (ONLY.has('GUARD')) {
    const other = await fresh('o')
    const dirtyTerm = async () => { await open(TF); await tab('term'); await termReady(); await typeInto(`${T} [data-testid="tp-units-safesight"]`, '77') }
    const G = await fresh('g')
    await api('PATCH', `/opportunities/${G.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await latestRev(G.oppId)).revision_number })
    const dirtyComm = async () => { await open(G); await tab('commercial'); await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '10'); await typeInto('#deal-ssNew', '13') }
    for (const [name, dirty, fx, read] of [
      ['Term quote', dirtyTerm, TF, () => page.$eval(`${T} [data-testid="tp-units-safesight"]`, (e) => e.value)],
      ['Commercials', dirtyComm, G, () => page.$eval('#deal-ssNew', (e) => e.value)],
    ]) {
      await dirty()
      const wasHeld = await held()
      check(`GUARD ${name}: unsaved edits hold a browser close or reload`, wasHeld)
      await page.evaluate((i) => navigate('opportunity-detail', i), other.oppId)
      await pause(600)
      const m = await modal()
      check(`GUARD ${name}: navigating to another record asks "Discard unsaved changes?" (Keep editing | Discard)`, m.open && m.heading === 'Discard unsaved changes?' && m.keep === 'Keep editing' && m.discard === 'Discard', JSON.stringify(m))
      await answer('keep')
      check(`GUARD ${name}: Keep editing stays on the record with the edit`, (await showing(`${fx.tag} Opportunity`)) && !(await showing(`${other.tag} Opportunity`)) && ['77', '13'].includes(await read().catch(() => null)))
      await page.evaluate((i) => navigate('opportunity-detail', i), other.oppId)
      await pause(400)
      const asked = (await modal()).open
      await answer('discard'); await settled()
      check(`GUARD ${name}: Discard leaves for the other record`, asked && await sleepless(page, (n) => (document.getElementById('view-opportunity-detail')?.innerText ?? '').includes(n), `${other.tag} Opportunity`, 15000))
      check(`GUARD ${name}: and the discarded edit is gone: nothing is held any more`, wasHeld && asked && !(await held()))
    }
  }

  // ═══ WON ══════════════════════════════════════════════════════════════
  if (ONLY.has('WON')) {
    // ADMIN FIXTURE, declared: the win, on the term record and a Commercials one.
    const W = C ?? await fresh('w')
    if (!C) {
      await api('PATCH', `/opportunities/${W.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await latestRev(W.oppId)).revision_number })
      await open(W); await tab('commercial'); await sleepless(page, () => document.getElementById('deal-ssNew')?.value === '10')
      await page.click('#deal-version-reason'); await page.keyboard.type(`${W.tag} first`); await page.click('#btn-save-version')
      await pollUntil(async () => (await versionsOf(W.oppId))[0])
    }
    for (const fx of [W, TF]) must(await db.from('records').update({ status: 'Closed Won' }).eq('id', fx.oppId).select('id').single(), 'the win')
    await open(W); await tab('commercial'); await pause(1500)
    const rows = await page.evaluate(() => document.querySelectorAll('#opp-tab-commercial .ds-row').length)
    check('WON: a Closed Won Commercials deal lists its versions and offers no Restore', rows > 0 && (await visibleRestores('#opp-tab-commercial')).length === 0, `${rows} rows, ${(await visibleRestores('#opp-tab-commercial')).length} Restore`)
    await open(TF); await tab('term'); await pause(1000)
    const won = await page.evaluate((r) => ({ panel: !!document.querySelector(`${r} [data-testid="tq-won"]`), rows: document.querySelectorAll(`${r} [data-testid="tq-version-row"]`).length }), T)
    check('WON: a Closed Won term deal keeps the won panel, with no list and no Restore', won.panel && won.rows === 0 && (await visibleRestores(T)).length === 0, JSON.stringify(won))
  }

  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300))
} finally {
  await browser?.close()
  for (const t of tags) await tearDown(t)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
