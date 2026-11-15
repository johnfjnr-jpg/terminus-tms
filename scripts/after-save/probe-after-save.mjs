// AFTER-SAVE STATE AND READER LINKS, Phase 2: the proof for B, A and C.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/after-save/probe-after-save.mjs
//
//   AS_ONLY=lenses,keyboard,tabs,outside,drops,reopen,forced,release,links
//   AS_OUT=<dir>   AS_LABEL=<run>   AS_REOPENS=<n, default 6>
//
// UNWIRED, deliberately: a round proof that builds and tears down its own
// fixtures, needs a SECOND identity (session-ref-approver.json, john+test2),
// and reads two named live records it does not own. Recorded here as unwired
// with that reason.
//
// Every read follows a QUIESCED page: network idle for 1.5s, then 750ms of no
// mutation and two frames. A save is followed by a reload that the pulse
// starts on its own, so each case waits for THAT reload (the pulse's reread
// counter moving and the assessment bar node being replaced) before it reads,
// and says it did.
//
//   lenses    on each of the five lenses: a real save, then the pulse's reload;
//             the same top tab, the same lens and the same scroll are shown, the
//             bar reads the exact sentence, and the entry is at the authority
//   keyboard  a tab reached by the ARROW KEYS, which sets no click guard, is
//             still showing after a reload of the same record
//   tabs      on every top tab, an outside reload keeps the tab and keeps the
//             element at the middle of the window where it was on screen
//   outside   ANOTHER IDENTITY's real write (john+test2 approving a track)
//             reloads the view, the change is visible, and tab, lens, scroll and
//             message are kept
//   drops     the save message's four ruled drop conditions, one each
//   reopen    an in-page reopen after an outside change, AS_REOPENS times: one
//             load each, landing on Reference by the arrival rule
//   forced    the same race made certain by holding the record's GET for 4s:
//             still one load
//   release   a record load forced to FAIL (an in-page 500) is followed by a
//             pulse tick that runs
//   links     on two not-mine records the key contact's name opens the contact
//             by a real click, read only; on an owned record, unchanged
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const puppeteer = await loadPuppeteer('after-save/probe-after-save.mjs')
const ONLY = new Set((process.env.AS_ONLY ?? 'lenses,keyboard,tabs,outside,drops,reopen,forced,release,links').split(','))
const OUT = process.env.AS_OUT ?? '.verify/after-save'
const LABEL = process.env.AS_LABEL ?? 'run'
const REOPENS = Number(process.env.AS_REOPENS ?? 6)
mkdirSync(OUT, { recursive: true })
const TAG = 'AFSV' + Date.now().toString(36).toUpperCase()
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const OTHER = JSON.parse(readFileSync('session-ref-approver.json', 'utf8'))
// The second identity's writes go through the real API with ITS token, by the
// throwing client's own override (probe-lifecycle's callAs), never the service
// role and never a raw fetch: a non-2xx throws rather than passing quietly.
const asOther = async (method, path, body) => {
  const had = process.env.TMS_ACCESS_TOKEN
  process.env.TMS_ACCESS_TOKEN = OTHER.access_token
  try { return await api(method, path, body) }
  finally { if (had === undefined) delete process.env.TMS_ACCESS_TOKEN; else process.env.TMS_ACCESS_TOKEN = had }
}
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }
const fixtures = []
const seats = []

const b = await puppeteer.launch({ headless: 'new' })

// Installed before the document: every record load is counted, with its caller.
const HOOK = () => {
  window.__loads = []
  window.__wrapLoads = () => {
    const f = window.loadOpportunityDetail
    if (typeof f !== 'function' || f.__w) return
    const w = function (...a) {
      const st = (new Error().stack ?? '').split('\n').slice(2, 6).join(' ')
      window.__loads.push({ t: Math.round(performance.now()), by: /oppPulseTick/.test(st) ? 'pulse' : /navigate/.test(st) ? 'navigate' : 'other' })
      return f.apply(this, a)
    }
    w.__w = true; window.loadOpportunityDetail = w
  }
}
const settle = (p) => p.evaluate(() => new Promise((res) => {
  let t; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 750) })
  const done = () => { mo.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => res(true))) }
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); t = setTimeout(done, 750)
}))
const quiesce = async (p) => { await p.waitForNetworkIdle({ idleTime: 1500, timeout: 30000 }).catch(() => {}); await settle(p) }

const open = async (id, { intercept } = {}) => {
  const p = await b.newPage()
  const writes = []
  p.on('request', (rq) => { if (rq.method() !== 'GET' && rq.url().includes('/api/')) writes.push(`${rq.method()} ${rq.url().replace(/^.*\/api/, '').replace(/[0-9a-f-]{36}/g, ':id')}`) })
  if (intercept) { await p.setRequestInterception(true); p.on('request', (rq) => intercept(rq)) }
  await p.setViewport({ width: 1440, height: 1100 })
  await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.evaluateOnNewDocument(HOOK)
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate(() => window.__wrapLoads())
  await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
  await p.waitForFunction((rid) => currentOppDetailId === rid && Array.isArray(oppCriteria)
    && !document.getElementById('view-opportunity-detail').classList.contains('is-loading'), { timeout: 30000 }, id)
  await quiesce(p)
  return { p, writes }
}

// What a person sees, in one read.
const place = (p) => p.evaluate(() => {
  const sc = document.querySelector('.app-content-scroll')
  return {
    tab: document.querySelector('#view-opportunity-detail [data-opp-tab].active')?.dataset.oppTab ?? null,
    lens: document.querySelector('#opp-assessment-mount-strip [data-sub-tab][aria-selected="true"]')?.dataset.subTab ?? null,
    scroll: sc ? Math.round(sc.scrollTop) : null,
    message: document.getElementById('opp-assess-savebar-feedback')?.textContent.trim() ?? null,
  }
})
// WHAT THE PERSON IS LOOKING AT, not the scroll number. Measured: an outside
// change that grows content ABOVE the reader (the summary) moves scrollTop by
// that amount while the browser's scroll anchoring keeps the content still,
// and forcing the old number back would shift it. So the claim is held to the
// thing at the middle of the window: the nearest element with an id, and
// where it sits on screen. Same id, same place, within 2px.
const anchor = (p) => p.evaluate(() => {
  const v = document.getElementById('view-opportunity-detail')
  const r = v.getBoundingClientRect()
  let e = document.elementFromPoint(r.left + r.width / 2, innerHeight / 2)
  while (e && !e.id) e = e.parentElement
  return e && v.contains(e) ? { id: e.id, top: Math.round(e.getBoundingClientRect().top) } : null
})
const anchorNow = (p, id) => p.evaluate((id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : null }, id)
const held = (a, top) => !!a && top !== null && Math.abs(top - a.top) <= 2

// The reload the pulse starts by itself, waited for and confirmed rather than
// assumed: the reread counter moves AND the assessment bar is a new node.
const markBar = (p) => p.evaluate(() => { window.__barMark = document.getElementById('opp-assess-savebar'); window.__rereadMark = window.__oppPulseStats.rereads })
const awaitReload = (p, ms = 15000) => p.waitForFunction(() => window.__oppPulseStats.rereads > window.__rereadMark
  && document.getElementById('opp-assess-savebar') && document.getElementById('opp-assess-savebar') !== window.__barMark, { timeout: ms })
  .then(() => true).catch(() => false)

const toLens = async (p, lens) => {
  await p.click(`#opp-assessment-mount-strip [data-sub-tab="${lens}"]`)
  await p.waitForFunction((k) => document.querySelector(`#opp-assessment-mount-strip [data-sub-tab="${k}"]`)?.getAttribute('aria-selected') === 'true', { timeout: 5000 }, lens)
}
const draft = async (p, key, lv, reason) => {
  await p.evaluate((k) => document.getElementById(`opp-assess-reason-${k}`).scrollIntoView({ block: 'center' }), key)
  await p.click(`label[for="opp-assess-lv-${key}-${lv}"]`)
  if (reason) { await p.click(`#opp-assess-reason-${key}`, { clickCount: 3 }); await p.keyboard.type(reason) }
}
const save = async (p) => {
  await p.click('#opp-assess-savebar-record')
  await p.waitForFunction(() => /^Saved /.test(document.getElementById('opp-assess-savebar-feedback')?.textContent ?? ''), { timeout: 20000 }).catch(() => {})
}
const latestRevision = async (id) => must(await db.from('record_revisions').select('revision_number')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'revision')[0].revision_number
// An outside change as THIS identity, made through the real API from outside
// the page: the record's summary, which moves its freshness.
const outsideChange = async (id) => api('PATCH', `/opportunities/${id}`, { payload: { summary: `outside change ${Date.now()}` }, expected_revision: await latestRevision(id) })
const fresh = async (suffix) => { const fx = await freshOpportunity(TAG + suffix); fixtures.push(TAG + suffix); return fx }

const LENS_CASES = [
  ['commercial', 'assessCommBudgetConfirmed', '2', 'No budget conversation yet'],
  ['organisational', 'assessOrgChampion', '2', 'Nobody has stepped forward'],
  ['technical', 'assessTechNeedDefinition', '2', 'Need not described'],
  ['legal', 'assessLegalProcurementRoute', '2', 'Route not stated'],
  ['deal-dynamics', 'assessDealClientResponsiveness', '1', 'Two follow-ups unanswered'],
]

try {
  // ── LENSES: a save on each, then the pulse's own reload ────────────────
  if (ONLY.has('lenses')) {
    console.log('\n== lenses: after a save and its reload, the person is where they were')
    const fx = await fresh('L')
    const { p, writes } = await open(fx.oppId)
    // A shorter window, so every lens has somewhere to scroll to: at 1100 three
    // of the five fit entirely and a kept scroll of 0 would prove nothing.
    await p.setViewport({ width: 1440, height: 760 })
    await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
    await settle(p)
    for (const [lens, key, lv, reason] of LENS_CASES) {
      await toLens(p, lens)
      await draft(p, key, lv, reason)
      // The person scrolls, with the wheel, to a place of their own.
      await p.mouse.move(700, 500)
      await p.mouse.wheel({ deltaY: 260 })
      await settle(p)
      await markBar(p)
      await save(p)
      // The place the person is at once the save has reported, which is what
      // the reload must not take away.
      const before = await place(p)
      const a = await anchor(p)
      const reloaded = await awaitReload(p)
      await quiesce(p)
      const after = await place(p)
      const top = a ? await anchorNow(p, a.id) : null
      check(held(a, top), `${lens}: #${a?.id} stays where it was on screen (${a?.top} -> ${top})`)
      const at = (await api('GET', `/opportunities/${fx.oppId}`)).data.payload?.[key]?.at(-1)
      check(reloaded, `${lens}: the pulse reloaded the record after the save`)
      check(after.tab === 'assessment' && after.lens === lens, `${lens}: same top tab and lens after the reload (${after.tab}, ${after.lens})`)
      check(before.scroll > 0 && Math.abs(after.scroll - before.scroll) <= 2, `${lens}: same scroll (${before.scroll} -> ${after.scroll})`)
      check(after.message === 'Saved 1 of 1.', `${lens}: the bar reads "${after.message}"`)
      check(at?.reason === reason && String(at?.value) === lv, `${lens}: the entry is at the authority (${at?.value}, "${at?.reason}")`)
    }
    check(writes.length === 5 && writes.every((w) => /scores$/.test(w)), `five writes, all scores (${writes.length})`)
    await p.screenshot({ path: `${OUT}/${LABEL}-lens-after-reload.png` })
    await p.close()
  }

  // ── KEYBOARD: a tab reached without a click ────────────────────────────
  if (ONLY.has('keyboard')) {
    console.log('\n== keyboard: a tab reached by the arrow keys survives a reload')
    const fx = await fresh('K')
    const { p } = await open(fx.oppId)
    await p.focus('#view-opportunity-detail [data-opp-tab="reference"]')
    // Reference, Commercials, Assessment: two steps right, by keyboard only.
    for (let i = 0; i < 4 && (await place(p)).tab !== 'assessment'; i++) await p.keyboard.press('ArrowRight')
    await settle(p)
    const before = await place(p)
    const picked = await p.evaluate(() => oppUserPickedTab)
    check(before.tab === 'assessment' && picked === false, `reached by keyboard: tab ${before.tab}, click guard ${picked}`)
    await markBar(p)
    await outsideChange(fx.oppId)
    const reloaded = await awaitReload(p)
    await quiesce(p)
    const after = await place(p)
    check(reloaded, 'an outside change reloaded the record')
    check(after.tab === 'assessment', `the tab is still Assessment after the reload (${after.tab})`)
    await p.close()
  }

  // ── TABS: the scroll on every top tab across an outside reload ─────────
  if (ONLY.has('tabs')) {
    console.log('\n== tabs: each top tab keeps its scroll across a reload')
    const fx = await fresh('T')
    const { p } = await open(fx.oppId)
    await p.setViewport({ width: 1440, height: 760 })
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#opp-detail-tabs [data-opp-tab]')].map((b) => b.dataset.oppTab))
    for (const t of tabs) {
      await p.click(`#view-opportunity-detail [data-opp-tab="${t}"]`)
      await quiesce(p)
      await p.mouse.move(700, 500)
      await p.mouse.wheel({ deltaY: 400 })
      await settle(p)
      const before = await place(p)
      if (!(before.scroll > 0)) { console.log(`  (${t}: nothing to scroll at 760, skipped)`); continue }
      const a = await anchor(p)
      await markBar(p)
      await outsideChange(fx.oppId)
      const reloaded = await awaitReload(p)
      await quiesce(p)
      const after = await place(p)
      const top = a ? await anchorNow(p, a.id) : null
      check(reloaded && after.tab === t && held(a, top), `${t}: tab kept, and #${a?.id} stays where it was on screen (${a?.top} -> ${top}; scrollTop ${before.scroll} -> ${after.scroll})`)
    }
    await p.close()
  }

  // ── OUTSIDE: another identity's real write ─────────────────────────────
  if (ONLY.has('outside')) {
    console.log('\n== outside: john+test2 approves a track; the view follows and keeps the place')
    const fx = await fresh('O')
    await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
    await api('POST', `/records/${fx.oppId}/transition-requests`, { to_stage: 'Solution Alignment', kind: 'transition' })
    const iso = new Date().toISOString()
    await api('PATCH', `/opportunities/${fx.oppId}`, {
      payload: { exitSolKeyStakeholders: iso, exitSolBuyersKnown: iso, exitSolTechnicalSolution: iso, exitSolTermsReviewed: iso },
      expected_revision: await latestRevision(fx.oppId),
    })
    await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
    // ONE SEAT, RECORD-SCOPED, for the second identity: the three global seats
    // belong to neither test account, so without it the decision is a 403 and
    // the case measures the wrong thing. Built directly because no route
    // grants a seat, and removed at teardown (Verification 47).
    const seat = must(await db.from('track_approvers').insert({ record_type: 'opportunity', track: 'Technical', user_id: OTHER.user.id, record_id: fx.oppId }).select('id'), 'seat')
    seats.push(seat[0].id)

    const { p } = await open(fx.oppId)
    await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
    await settle(p)
    await toLens(p, 'legal')
    await draft(p, 'assessLegalPaperProcess', '2', 'Paper process unknown')
    await markBar(p)
    await save(p)
    await awaitReload(p)
    await quiesce(p)
    // The raise is the person's own, made through the API: it freezes the record.
    await markBar(p)
    await api('POST', `/records/${fx.oppId}/transition-requests`, { to_stage: 'Proposal', kind: 'transition' })
    const raisedReload = await awaitReload(p)
    await quiesce(p)
    const req = must(await db.from('transition_requests').select('id').eq('record_id', fx.oppId).eq('status', 'open'), 'request')[0]
    const before = await place(p)
    const a = await anchor(p)
    const bannerBefore = await p.evaluate(() => document.getElementById('opp-freeze-banner')?.innerText ?? '')
    check(raisedReload && /Proposal/.test(bannerBefore), `the raise reloaded the view and froze it (banner names Proposal: ${/Proposal/.test(bannerBefore)})`)

    await markBar(p)
    const decided = await asOther('POST', `/transition-requests/${req.id}/approvals`, { track: 'Technical', decision: 'approved' })
    check(decided.status >= 200 && decided.status < 300, `john+test2 approved Technical through the real API (${decided.status} ${JSON.stringify(decided.data?.error ?? '')})`)
    const row = must(await db.from('approvals').select('track, decision, approver_id').eq('request_id', req.id).eq('track', 'Technical'), 'approval')
    check(row.length === 1 && row[0].approver_id === OTHER.user.id, `the authority holds the approval by the second identity (${row.length})`)
    const reloaded = await awaitReload(p)
    await quiesce(p)
    const after = await place(p)
    const bannerAfter = await p.evaluate(() => document.getElementById('opp-freeze-banner')?.innerText ?? '')
    check(reloaded, 'the other identity\'s write reloaded the view')
    check(bannerAfter !== bannerBefore && /Technical/.test(bannerAfter), 'the change is visible: the banner changed and names Technical')
    console.log(`  (Technical line before: "${(bannerBefore.split('\n').find((l) => /Technical/.test(l)) ?? '').trim()}", after: "${(bannerAfter.split('\n').find((l) => /Technical/.test(l)) ?? '').trim()}")`)
    check(after.tab === 'assessment' && after.lens === 'legal', `tab and lens kept (${after.tab}, ${after.lens})`)
    const top = a ? await anchorNow(p, a.id) : null
    check(before.scroll > 0 && held(a, top), `the place is kept: #${a?.id} stays where it was on screen (${a?.top} -> ${top}; scrollTop ${before.scroll} -> ${after.scroll})`)
    check(after.message === 'Saved 1 of 1.', `message kept through two outside reloads ("${after.message}")`)
    await p.screenshot({ path: `${OUT}/${LABEL}-outside.png` })
    await p.close()
  }

  // ── DROPS: the four ruled conditions, one each ─────────────────────────
  if (ONLY.has('drops')) {
    console.log('\n== drops: the save message goes at each ruled condition, and stays gone')
    const fx = await fresh('D')
    const { p } = await open(fx.oppId)
    await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
    await settle(p)
    await toLens(p, 'organisational')
    // Kept first, so each drop below is a change from a message that WAS there.
    await draft(p, 'assessOrgChampion', '2', 'Nobody has stepped forward')
    await markBar(p); await save(p); await awaitReload(p); await quiesce(p)
    check((await place(p)).message === 'Saved 1 of 1.', 'baseline: the message survives the reload')

    // 1. the next draft change
    await draft(p, 'assessOrgEconomicBuyer', '4', '')
    const m1 = (await place(p)).message
    await markBar(p); await outsideChange(fx.oppId); await awaitReload(p); await quiesce(p)
    const m1b = (await place(p)).message
    check(m1 === '' && m1b === '', `a draft change drops it, and a reload does not bring it back ("${m1}", "${m1b}")`)
    await p.evaluate(() => cancelAllOppAssess())

    // 2. Cancel, after a partial save that kept a draft
    await draft(p, 'assessOrgChampion', '4', '')
    await draft(p, 'assessOrgEconomicBuyer', '4', '')
    await markBar(p); await save(p); await awaitReload(p); await quiesce(p)
    const partial = (await place(p)).message
    check(/^Saved 1 of 2\. Not saved: /.test(partial), `a partial save's message survives its reload ("${partial}")`)
    await p.click('#opp-assess-savebar-cancel')
    const m2 = (await place(p)).message
    await markBar(p); await outsideChange(fx.oppId); await awaitReload(p); await quiesce(p)
    const m2b = (await place(p)).message
    check(m2 === '' && m2b === '', `Cancel drops it, and a reload does not bring it back ("${m2}", "${m2b}")`)

    // 3. the next save: a partial first, then a full one; the second's sentence
    //    is the one that survives, not the first's.
    await draft(p, 'assessOrgChampion', '5', '')
    await draft(p, 'assessOrgPrioritisation', '2', 'Not yet a priority')
    await markBar(p); await save(p); await awaitReload(p); await quiesce(p)
    const first = (await place(p)).message
    await draft(p, 'assessOrgChampion', '5', 'Verified in writing')
    await markBar(p); await save(p); await awaitReload(p); await quiesce(p)
    const second = (await place(p)).message
    check(/Not saved/.test(first) && second === 'Saved 1 of 1.', `the next save replaces it ("${first.slice(0, 40)}..." then "${second}")`)

    // 4. leaving the record: to the list and back is an arrival
    await p.evaluate(() => navigate('opportunities'))
    await settle(p)
    await p.evaluate((rid) => navigate('opportunity-detail', rid), fx.oppId)
    await p.waitForFunction(() => !document.getElementById('view-opportunity-detail').classList.contains('is-loading'), { timeout: 30000 })
    await quiesce(p)
    const back = await place(p)
    check(back.tab === 'reference', `arriving lands on Reference, by the arrival rule (${back.tab})`)
    await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
    await settle(p)
    const m4 = await place(p)
    check(m4.message === '' && m4.lens === 'commercial', `leaving the record drops it, and arrival resets the lens ("${m4.message}", ${m4.lens})`)
    await p.close()
  }

  // ── REOPEN: natural runs ───────────────────────────────────────────────
  if (ONLY.has('reopen')) {
    console.log(`\n== reopen: an in-page reopen right after an outside change, ${REOPENS} times`)
    const fx = await fresh('R')
    let doubles = 0
    for (let i = 1; i <= REOPENS; i++) {
      const { p } = await open(fx.oppId)
      await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
      await settle(p)
      await outsideChange(fx.oppId)
      await p.evaluate(() => { window.__loads.length = 0 })
      await p.evaluate((rid) => navigate('opportunity-detail', rid), fx.oppId)
      await new Promise((r) => setTimeout(r, 9000))
      const loads = await p.evaluate(() => window.__loads)
      const tab = (await place(p)).tab
      if (loads.length !== 1) doubles++
      check(loads.length === 1 && tab === 'reference', `reopen ${i}: ${loads.length} load(s) (${loads.map((l) => l.by).join(', ')}), landed on ${tab}`)
      await p.close()
    }
    check(doubles === 0, `${doubles} double loads in ${REOPENS} reopens`)
  }

  // ── FORCED: the same race made certain ────────────────────────────────
  if (ONLY.has('forced')) {
    console.log('\n== forced: the record GET held for 4s, so the pulse is certain to tick during the load')
    const fx = await fresh('F')
    let hold = false
    const re = new RegExp(`/api/opportunities/${fx.oppId}$`)
    const { p } = await open(fx.oppId, { intercept: (rq) => {
      if (hold && rq.method() === 'GET' && re.test(rq.url())) { hold = false; setTimeout(() => rq.continue(), 4000); return }
      rq.continue()
    } })
    await outsideChange(fx.oppId)
    await p.evaluate(() => { window.__loads.length = 0; window.__skip0 = window.__oppPulseStats.skippedLoading })
    hold = true
    await p.evaluate((rid) => navigate('opportunity-detail', rid), fx.oppId)
    await new Promise((r) => setTimeout(r, 11000))
    const loads = await p.evaluate(() => window.__loads)
    const skipped = await p.evaluate(() => window.__oppPulseStats.skippedLoading - window.__skip0)
    check(skipped > 0, `the pulse came due during the held load (${skipped} tick(s) held back), so the next line is not vacuous`)
    check(loads.length === 1, `one load (${loads.map((l) => l.by).join(', ')})`)
    await p.close()
  }

  // ── RELEASE: a failed load releases the guard ──────────────────────────
  if (ONLY.has('release')) {
    console.log('\n== release: a record load that FAILS is followed by a pulse tick that runs')
    const fx = await fresh('E')
    let failNext = false
    const re = new RegExp(`/api/opportunities/${fx.oppId}$`)
    const { p } = await open(fx.oppId, { intercept: (rq) => {
      if (failNext && rq.method() === 'GET' && re.test(rq.url())) { failNext = false; return rq.respond({ status: 500, contentType: 'application/json', body: '{"error":"stubbed by probe-after-save"}' }) }
      rq.continue()
    } })
    failNext = true
    await p.evaluate(() => { window.__loads.length = 0 })
    await outsideChange(fx.oppId)
    // The pulse sees the change and rereads; that read is the one answered 500.
    const failed = await p.waitForFunction(() => window.__loads.some((l) => l.by === 'pulse'), { timeout: 15000 }).then(() => true).catch(() => false)
    await new Promise((r) => setTimeout(r, 800))
    const inFlight = await p.evaluate(() => window.__oppLoadsInFlight())
    const polls0 = await p.evaluate(() => window.__oppPulseStats.polls)
    await new Promise((r) => setTimeout(r, 8000))
    const polls1 = await p.evaluate(() => window.__oppPulseStats.polls)
    const pulseLoads = await p.evaluate(() => window.__loads.filter((l) => l.by === 'pulse').length)
    check(failed && !failNext, `the pulse's reread was answered 500 (stub consumed: ${!failNext})`)
    check(inFlight === 0, `the guard released after the failed load (${inFlight} in flight)`)
    check(polls1 > polls0, `a pulse tick ran after the failure (${polls0} -> ${polls1} polls)`)
    check(pulseLoads >= 2, `and it reread the record again, successfully this time (${pulseLoads} pulse loads)`)
    await p.close()
  }

  // ── LINKS: a reader opens a key contact ────────────────────────────────
  if (ONLY.has('links')) {
    console.log('\n== links: the key contact name opens the contact for a reader')
    // Two live opportunities the session does NOT own that carry a key
    // contact, found from the database rather than named, so the case is
    // about the shape and not about two records that may change.
    const me = S.user.id
    // From the LIVE not-mine opportunities outward: record_contacts holds
    // thousands of rows for soft-deleted fixtures, and a sample of it first
    // found none (Verification 25, a population too narrow for the claim).
    const live = must(await db.from('records').select('id').eq('record_type', 'opportunity').is('deleted_at', null).neq('owner_id', me), 'not-mine opportunities').map((r) => r.id)
    const rc = live.length ? must(await db.from('record_contacts').select('record_id').in('record_id', live), 'record_contacts') : []
    const notMine = [...new Set(rc.map((r) => r.record_id))].sort().slice(0, 2)
    check(notMine.length === 2, `two not-mine opportunities with a key contact (${notMine.map((x) => x.slice(0, 8)).join(', ')})`)
    const clickContact = async (oppId, expectMine) => {
      const { p, writes } = await open(oppId)
      const name = await p.$('#opp-tab-reference .kc-name')
      const st = await p.evaluate(() => { const e = document.querySelector('#opp-tab-reference .kc-name')
        return e ? { inert: e.classList.contains('is-inert-action'), ti: e.getAttribute('tabindex'), aria: e.getAttribute('aria-disabled'), pe: getComputedStyle(e).pointerEvents, view: document.getElementById('view-opportunity-detail').classList.contains('is-not-mine') } : null })
      const want = await p.evaluate(() => document.querySelector('#opp-tab-reference .kc-name')?.textContent.trim())
      await name.evaluate((e) => e.scrollIntoView({ block: 'center' }))
      await name.click().catch(() => {})
      const opened = await p.waitForFunction(() => !document.getElementById('view-contact-detail').classList.contains('hidden')
        && !document.getElementById('view-contact-detail').classList.contains('is-loading'), { timeout: 15000 }).then(() => true).catch(() => false)
      await quiesce(p)
      const c = await p.evaluate(() => {
        const v = document.getElementById('view-contact-detail')
        const all = [...v.querySelectorAll('input, textarea, select')]
        return { notMine: v.classList.contains('is-not-mine'), total: all.length, enabled: all.filter((x) => !x.disabled).length, text: v.innerText.slice(0, 400) }
      })
      return { st, want, opened, c, writes, p }
    }
    for (const id of notMine) {
      const r = await clickContact(id, false)
      check(!!r.st && r.st.view && !r.st.inert && r.st.ti === '0' && r.st.aria === null && r.st.pe !== 'none',
        `${id.slice(0, 8)}: the name is live on a not-mine record (inert ${r.st?.inert}, tabindex ${r.st?.ti}, aria-disabled ${r.st?.aria}, pointer-events ${r.st?.pe})`)
      check(r.opened && r.c.text.includes(r.want), `${id.slice(0, 8)}: a real click opened the contact "${r.want}" (${r.opened})`)
      check(r.c.notMine && r.c.total > 0 && r.c.enabled === 0, `${id.slice(0, 8)}: the contact is read-only for the reader (${r.c.total} fields, ${r.c.enabled} enabled, is-not-mine ${r.c.notMine})`)
      check(r.writes.length === 0, `${id.slice(0, 8)}: 0 writes (${r.writes.join(', ') || 'none'})`)
      await r.p.screenshot({ path: `${OUT}/${LABEL}-link-${id.slice(0, 8)}.png` })
      await r.p.close()
    }
    // Owned: a key contact linked through the real API.
    const fx = await fresh('C')
    const link = await api('POST', `/opportunities/${fx.oppId}/key-contacts`, { contact_id: fx.contactId, role_other: 'Probe sponsor' })
    check(link.status >= 200 && link.status < 300, `owned: a key contact linked through the real API (${link.status})`)
    const r = await clickContact(fx.oppId, true)
    check(!!r.st && !r.st.view && !r.st.inert && r.st.ti === '0', `owned: the name is live, unchanged (inert ${r.st?.inert}, tabindex ${r.st?.ti})`)
    check(r.opened && !r.c.notMine && r.c.enabled > 0, `owned: the click opens an editable contact (${r.c.enabled} of ${r.c.total} enabled)`)
    check(r.writes.length === 0, `owned: 0 writes (${r.writes.join(', ') || 'none'})`)
    await r.p.close()
  }
} finally {
  await b.close()
  // Open requests are withdrawn FIRST: a frozen record refuses its own teardown.
  const byTag = async (tag) => [...new Set(must(await db.from('record_revisions').select('record_id')
    .like('payload->>name', `${tag}%`), 'fixture revisions').map((r) => r.record_id))]
  for (const tag of fixtures) {
    const ids = await byTag(tag)
    const open = ids.length ? must(await db.from('transition_requests').select('id').in('record_id', ids).eq('status', 'open'), 'open requests') : []
    for (const q of open) await api('POST', `/transition-requests/${q.id}/withdraw`, { reason: 'probe teardown' })
    if (open.length) console.log(`teardown: withdrew ${open.length} open request(s) first`)
    await tearDown(tag)
    const left = ids.length ? must(await db.from('records').select('reference_code, record_type, deleted_at').in('id', ids), 'teardown') : []
    for (const x of left) console.log(`teardown: ${x.record_type} ${x.reference_code ?? ''} deleted_at ${x.deleted_at}`)
    check(left.length > 0 && left.every((x) => !!x.deleted_at), `${tag}: every fixture record is soft-deleted (${left.length})`)
  }
  for (const id of seats) {
    must(await db.from('track_approvers').delete().eq('id', id).select('id'), 'seat removal')
    const left = must(await db.from('track_approvers').select('id').eq('id', id), 'seat check')
    check(left.length === 0, `the record-scoped seat for john+test2 is removed (${id.slice(0, 8)})`)
  }
}
console.log(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
