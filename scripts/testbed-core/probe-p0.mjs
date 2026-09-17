// ── ROUND A PHASE 0: THE SIX WORKFLOW-CORE CLAIMS, LIVE ─────────────────
//
// Committed by ruling R6 (TEST_BED_WORKFLOW_CORE_BRIEF.md). It reproduced
// P0.1-P0.6 against the pre-fix screen; the phases that close each claim re-run
// the same section as their closing proof, so a "closed" reading comes from the
// instrument that read "broken".
//
// UNWIRED, deliberately: it builds a live fixture, drives a browser and takes
// about a minute, so it is not a gate stage. Recorded here and in
// P0_EVIDENCE_INDEX.md rather than left to be found missing.
//
// Run:  PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//       PUPPETEER_EXECUTABLE_PATH=<Chrome for Testing 152 binary> \
//       node --env-file=.env scripts/testbed-core/probe-p0.mjs
// The 152 build is named because the cached 153 build refuses localhost with
// ERR_ADDRESS_INVALID (Phase 0 report, environment).
//
// READ-ONLY AGAINST THE PRODUCT. Its only writes are a tagged fixture (Account,
// Test Bed, Contact) torn down by tag in `finally`, and refused POSTs each
// bracketed by a database fingerprint.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p0.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
// ARTEFACTS ARE NAMED AFTER THE RUN, NOT THE PROBE (Verification 44's time axis):
// the Phase 0 evidence is the "broken" reading, and a closing-proof re-run that
// wrote the same filenames would replace it with the "fixed" one.
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) {
  console.error('TBCORE_RUN is required and names this run (e.g. p1-close); it keys the output directory.')
  process.exit(2)
}
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
console.log(`run ${RUN}, artefacts in ${OUT}`)
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const results = {}
const say = (...a) => console.log(...a)
const yieldFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }); say('bundle freshness: PASS (committed bundle matches source)') }
catch (e) { say('bundle freshness FAILED', String(e.stdout ?? ''), String(e.stderr ?? '')); process.exit(2) }

const TAG = `TBCORE-P0-${Date.now()}`
say(`fixture tag ${TAG}`)
let fx = null, contact = { id: null }
process.on("uncaughtException", async (e) => { console.log("UNCAUGHT", e); await tearDown(TAG).catch(()=>{}); process.exit(1) })
try {
fx = await freshTestBed(TAG)
contact = (await api("POST", "/contacts", {
  name: `${TAG} Contact`, company: `${TAG} Holdings`, email: `${TAG.toLowerCase()}@example.invalid`,
  mobile: '+65 9000 0001', industry_id: (await api("GET", "/industries")).data[0].id, source: 'Direct Outreach',
  jobRole: 'Head of Infrastructure', city: 'Singapore', country: 'Singapore', region: 'Asia Pacific',
})).data
await api('POST', `/contacts/${contact.id}/link-account`, { account_id: fx.accountId })
const cRow = must(await db.from('records').select('parent_record_id').eq('id', contact.id).single(), 'contact')
say(`fixture: bed ${fx.bedId} account ${fx.accountId} contact ${contact.id} (contact parent = account: ${cRow.parent_record_id === fx.accountId})`)
const bedRow = must(await db.from('records').select('status,owner_id').eq('id', fx.bedId).single(), 'bed')
say(`fixture bed status=${bedRow.status} owned by probe identity=${bedRow.owner_id === OWNER.user.id}`)

async function fingerprint() {
  const rev = must(await db.from('record_revisions').select('revision_number,payload').eq('record_id', fx.bedId).order('revision_number', { ascending: false }).limit(1).single(), 'rev')
  const rec = must(await db.from('records').select('status,updated_at').eq('id', fx.bedId).single(), 'rec')
  const { count: audit, error: aErr } = await db.from('audit_log').select('id', { count: 'exact', head: true }).eq('record_id', fx.bedId)
  if (aErr) throw new Error(`audit: ${aErr.message}`)
  const { count: links, error: lErr } = await db.from('record_contacts').select('id', { count: 'exact', head: true }).eq('record_id', fx.bedId)
  if (lErr) throw new Error(`links: ${lErr.message}`)
  const scoreKeys = Object.keys(rev.payload ?? {}).filter((k) => /^score|measurab/.test(k))
  return { revision: rev.revision_number, status: rec.status, updated_at: rec.updated_at, audit, links, scoreKeys: scoreKeys.join(',') }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const net = []
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ t: Date.now(), method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, status: null, resp: null, req: r }) })
  page.on('requestfinished', async (r) => {
    const e = net.find((n) => n.req === r); if (!e) return
    const res = r.response(); e.status = res?.status() ?? null
    try { e.resp = await res.text() } catch { e.resp = '<unreadable>' }
    e.done = true
  })
  const waitReq = async (pred, from, timeout = 20000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const hit = net.slice(from).find((n) => n.done && pred(n)); if (hit) return hit
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error('request never finished')
  }
  const writesSince = (i) => net.slice(i).filter((n) => n.method !== 'GET')

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return v && !v.classList.contains('hidden') && v.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]')
      && v.querySelector('[data-testid="tb-next-stage-btn"]')
  }, { timeout: 30000 })

  // ── Qualification tab ──────────────────────────────────────────────
  let mark = net.length
  await page.click('#view-test-bed-detail [data-testid="tb-tab-btn-stage-Qualification"]')
  const exitResp = await waitReq((n) => n.url.includes(`/records/${fx.bedId}/exit-criteria`) && n.url.includes('Qualification'), mark)
  // Real state: the exit panel settled FOR Qualification (it carries data-stage only once settled).
  await page.waitForFunction(() => document.querySelector('#view-test-bed-detail [data-testid="tb-stage-exit-criteria-list"][data-stage="Qualification"]'), { timeout: 20000 })
  await page.waitForFunction(() => { const c = document.querySelector('#view-test-bed-detail [data-testid="tb-stage-scoring-card"]'); return c && c.dataset.stage === 'Qualification' && !c.hidden }, { timeout: 20000 })
  const critResp = net.find((n) => n.done && n.url.includes('/scoring-criteria'))
  await yieldFrames(page)

  // P0.3
  const ex = JSON.parse(exitResp.resp)
  const p3 = await page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const p = v.querySelector('[data-testid="tb-stage-exit-criteria-list"]')
    return { text: p.innerText.trim(), textContent: p.textContent, rows: p.querySelectorAll('.tb-crit-row').length, ticks: p.querySelectorAll('input[type=checkbox], [role=checkbox]').length, visible: p.getBoundingClientRect().height > 0 }
  })
  // MARKUP-INDEPENDENT: which of the RESPONSE's requirements can a person read in
  // the panel. A requirement counts when its label or its message is in the
  // panel's text, so the reading survives any rewrite of the row markup.
  const shownReqs = (ex.requirements ?? []).filter((r) => [r.label, r.message].filter(Boolean).some((t) => p3.textContent.includes(t)))
  results.P0_3 = { shown: shownReqs.length, status: exitResp.status, isArray: Array.isArray(ex), keys: Object.keys(ex), to_stage: ex.to_stage, requirements: ex.requirements?.length, blocking: ex.blocking?.length, requirementTypes: [...new Set((ex.requirements ?? []).map((r) => r.requirement_type))], panel: p3 }
  say('\n=== P0.3 (B3) exit criteria ===')
  say(`  GET ${exitResp.url} -> ${exitResp.status}; Array.isArray(body)=${Array.isArray(ex)}; keys=${Object.keys(ex).join(',')}`)
  say(`  to_stage=${ex.to_stage} requirements=${ex.requirements?.length} blocking=${ex.blocking?.length} types=${results.P0_3.requirementTypes.join(',')}`)
  say(`  panel text: ${JSON.stringify(p3.text)}`)
  say(`  rows=${p3.rows} tick controls=${p3.ticks} rendered=${p3.visible}; requirements readable in the panel: ${shownReqs.length} of ${ex.requirements?.length}`)

  // P0.2
  const crit = JSON.parse(critResp.resp)
  const p2 = await page.evaluate(() => {
    const c = document.querySelector('#view-test-bed-detail [data-testid="tb-stage-scoring-card"]')
    return { hiddenAttr: c.hidden, display: getComputedStyle(c).display, height: c.getBoundingClientRect().height,
      criteriaRows: c.querySelectorAll('[data-testid^="tb-score-select-"]').length,
      recordButtons: c.querySelectorAll('[data-testid="tb-score-record"]').length, text: c.innerText.trim() }
  })
  results.P0_2 = { status: critResp.status, criteria: crit.length, keys: crit.map((c) => c.criterion_key), card: p2 }
  say('\n=== P0.2 (B2) scoring card ===')
  say(`  GET ${critResp.url} -> ${critResp.status}; ${crit.length} criteria: ${crit.map((c) => c.criterion_key).join(',')}`)
  say(`  gate names scored criteria at Qualification: ${(ex.requirements ?? []).filter((r) => /^score/.test(r.field ?? r.requirement_detail?.field ?? '')).length} (requirements with a score* field)`)
  say(`  card: hidden=${p2.hiddenAttr} display=${p2.display} height=${p2.height} criteria selects=${p2.criteriaRows} record buttons (calibration, same scope)=${p2.recordButtons}`)
  say(`  card text: ${JSON.stringify(p2.text)}`)
  await page.screenshot({ path: `${OUT}tbcore-p0-qualification-1920.png`, fullPage: false })

  // P0.1: the only scoring control reachable is Record scores (no criteria to draft).
  const fpA = await fingerprint()
  mark = net.length
  // AFTER PHASE 2.3 a Record click with nothing drafted is disabled and sends
  // nothing, so "no request" is now a reading rather than a crash: the wait's
  // refusal is caught and reported beside the button's own disabled state.
  const recordDisabled = await page.evaluate(() => document.querySelector('#view-test-bed-detail [data-testid="tb-score-record"]')?.disabled ?? null)
  await page.click('#view-test-bed-detail [data-testid="tb-score-record"]')
  const scoreResp = await waitReq((n) => n.method === 'POST' && n.url.includes('/scores'), mark, recordDisabled ? 3000 : 20000).catch(() => null)
  await yieldFrames(page)
  const fpB = await fingerprint()
  const uiMsg = await page.evaluate(() => [...document.querySelectorAll('#view-test-bed-detail .msg-error, #view-test-bed-detail .msg-success, #view-test-bed-detail [role=alert]')].map((e) => e.innerText.trim()).filter(Boolean))
  // The host's construction for a REAL criterion, sent as the host builds it: { entries: [{ criterion_key, score, reason }] }
  const c0 = crit[0]; const lvl = (c0.levels ?? [])[0]?.value ?? 1
  const hostBody = { entries: [{ criterion_key: c0.criterion_key, score: Number(String(lvl)), reason: null }] }
  const fpC = await fingerprint()
  let direct
  try { const ok = await api("POST", `/test-beds/${fx.bedId}/scores`, hostBody); direct = { ACCEPTED: ok.status, body: ok.data } }
  catch (e) { direct = { error: e.message } }
  const fpD = await fingerprint()
  results.P0_1 = { ui: { recordDisabled, body: scoreResp?.body ?? null, status: scoreResp?.status ?? null, resp: scoreResp?.resp ?? null, messages: uiMsg, unchanged: same(fpA, fpB) }, direct: { body: hostBody, result: direct, unchanged: same(fpC, fpD) }, fpA, fpB }
  say('\n=== P0.1 (B1) record a score ===')
  say(`  Record scores disabled before the click: ${recordDisabled}`)
  say(`  UI click Record scores -> ${scoreResp ? `POST ${scoreResp.url}` : 'NO REQUEST SENT'}`)
  say(`    request body: ${scoreResp?.body ?? '(none)'}`)
  say(`    response: ${scoreResp ? `${scoreResp.status} ${scoreResp.resp}` : '(none)'}`)
  say(`    on-screen messages after: ${JSON.stringify(uiMsg)}`)
  say(`    fingerprint before ${JSON.stringify(fpA)}`)
  say(`    fingerprint after  ${JSON.stringify(fpB)}  unchanged=${same(fpA, fpB)}`)
  say(`  the PRE-FIX host body shape for a real criterion, sent through the route: ${JSON.stringify(hostBody)}`)
  say(`    result: ${JSON.stringify(direct)}  fingerprint unchanged=${same(fpC, fpD)}`)

  // P0.4
  say('\n=== P0.4 (B5) blocked transition ===')
  const btn = await page.evaluate(() => { const b = document.querySelector('#view-test-bed-detail [data-testid="tb-next-stage-btn"]'); return { disabled: b.disabled, label: b.innerText.trim() } })
  say(`  Next Stage button: ${JSON.stringify(btn)}; exit-criteria blocking before click = ${ex.blocking.length}`)
  if (btn.disabled || !ex.blocking.length) throw new Error('P0.4 precondition not met: button disabled or nothing blocking (a click could transition)')
  const fp4a = await fingerprint()
  mark = net.length
  await page.click('#view-test-bed-detail [data-testid="tb-next-stage-btn"]')
  const tr = await waitReq((n) => n.method === 'POST' && n.url.includes('/transition'), mark)
  await yieldFrames(page)
  const p4 = await page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const f = v.querySelector('[data-testid="tb-next-stage-feedback"]')
    return { byId: !!document.getElementById('tb-next-stage-feedback'), testidHTML: f?.innerHTML ?? null,
      blockingLists: v.querySelectorAll('.blocking-list').length, blockedText: v.innerText.includes('Transition blocked') }
  })
  const fp4b = await fingerprint()
  const trBody = JSON.parse(tr.resp)
  say(`  POST ${tr.url} body=${tr.body} -> ${tr.status}; blocking items=${trBody.blocking?.length}`)
  say(`    first blocking messages: ${JSON.stringify((trBody.blocking ?? []).slice(0, 3).map((b) => b.message))}`)
  say(`  DOM: getElementById('tb-next-stage-feedback') present=${p4.byId}; testid element innerHTML=${JSON.stringify(p4.testidHTML)}; .blocking-list count=${p4.blockingLists}; "Transition blocked" on screen=${p4.blockedText}`)
  say(`  fingerprint unchanged=${same(fp4a, fp4b)} (status ${fp4b.status})`)
  await page.screenshot({ path: `${OUT}tbcore-p0-blocked-transition-1920.png` })
  // Calibration, in the browser only (no file changes): give the element its id and click again.
  await page.evaluate(() => { document.querySelector('#view-test-bed-detail [data-testid="tb-next-stage-feedback"]').id = 'tb-next-stage-feedback' })
  mark = net.length
  await page.click('#view-test-bed-detail [data-testid="tb-next-stage-btn"]')
  const tr2 = await waitReq((n) => n.method === 'POST' && n.url.includes('/transition'), mark)
  await yieldFrames(page)
  const p4c = await page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const f = v.querySelector('[data-testid="tb-next-stage-feedback"]')
    return { lis: f.querySelectorAll('.blocking-list li').length, blockedText: f.innerText.includes('Transition blocked') }
  })
  const fp4c = await fingerprint()
  say(`  CALIBRATION (id added in the live DOM only): POST -> ${tr2.status}; feedback "Transition blocked"=${p4c.blockedText}; list items=${p4c.lis} vs blocking=${JSON.parse(tr2.resp).blocking?.length}; fingerprint unchanged=${same(fp4b, fp4c)}`)
  await page.screenshot({ path: `${OUT}tbcore-p0-blocked-transition-calibrated-1920.png` })
  results.P0_4 = { btn, status: tr.status, blocking: trBody.blocking?.length, dom: p4, calibration: p4c, unchanged: same(fp4a, fp4b) && same(fp4b, fp4c) }
  await page.evaluate(() => { document.getElementById('tb-next-stage-feedback')?.removeAttribute('id') })

  // P0.6 sweep on Qualification (stage tab open now)
  const sweep = () => page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const ctrls = [...v.querySelectorAll('button, input, select, textarea, [role=button], [role=radio], [role=checkbox]')]
    const desc = (e) => [e.innerText, e.getAttribute('aria-label'), e.dataset.testid, e.name, e.id, e.closest('label')?.innerText, e.closest('[data-testid]')?.dataset.testid, e.parentElement?.innerText].filter(Boolean).join(' | ')
    return { controls: ctrls.length,
      measurability: ctrls.filter((e) => /measurab|sensors can capture/i.test(desc(e))).length,
      recordScores: ctrls.filter((e) => /record scores/i.test(desc(e))).length,
      nextStage: ctrls.filter((e) => /next stage|pre-site assessment/i.test(desc(e))).length,
      textMentions: (v.innerText.match(/measurab|sensors can capture/gi) ?? []).length,
      mentionAt: [...v.querySelectorAll("*")].filter((e) => e.children.length === 0 && /measurab|sensors can capture/i.test(e.textContent) && e.getBoundingClientRect().height > 0).map((e) => `${e.tagName}[${e.closest("[data-testid]")?.dataset.testid}] ${e.textContent.trim().slice(0, 90)}`) }
  })
  const sweeps = {}
  sweeps.qualification = await sweep()

  // P0.5 buyer link, Reference tab
  say('\n=== P0.5 (B6) buyer contact selection ===')
  // AFTER PHASE 3 the buyer rows are direct-write rows (BuyerLinks), and the
  // lookup FieldRow this section drove is REMOVED. Waiting for it would kill the
  // instrument here and P0.6 would never run (found by the Phase 4 close run).
  // So the wait accepts either shape; the pre-fix shape takes the original
  // reading, and the new shape reports what it finds and points at the probe
  // that proves it (scripts/testbed-core/probe-p3-buyers.mjs).
  const REF_READY = () => document.querySelector('#view-test-bed-detail [data-testid="tb-card-customer"] [data-testid="display-buyer-Client Commercial Buyer"]')
    || document.querySelector('#view-test-bed-detail [data-testid="tb-card-customer"] [data-testid="tb-buyer-rows"]')
  await page.click('#view-test-bed-detail [data-testid="tb-tab-btn-reference"]')
  await page.waitForFunction(REF_READY, { timeout: 20000 })
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 })
  sweeps.reference = await sweep()
  const legacyBuyerRow = await page.evaluate(() => !!document.querySelector('#view-test-bed-detail [data-testid="display-buyer-Client Commercial Buyer"]'))
  if (!legacyBuyerRow) {
    const now5 = await page.evaluate(() => {
      const v = document.getElementById('view-test-bed-detail')
      return { directWriteRows: v.querySelectorAll('[data-testid^="tb-buyer-Client"]').length,
        selects: v.querySelectorAll('[data-testid^="tb-buyer-select-"]').length,
        lookupFieldRows: v.querySelectorAll('[data-testid="display-buyer-Client Commercial Buyer"]').length }
    })
    say(`  the lookup FieldRow is GONE; direct-write buyer rows instead: ${JSON.stringify(now5)}`)
    say('  the write path is proven by scripts/testbed-core/probe-p3-buyers.mjs, not re-driven here')
    results.P0_5 = { superseded: true, ...now5 }
  }
  if (legacyBuyerRow) {
  const fp5a = await fingerprint()
  const rowState = (name) => page.evaluate((name) => {
    const v = document.getElementById('view-test-bed-detail')
    const d = v.querySelector(`[data-testid="display-${name}"]`); const e = v.querySelector(`[data-testid="edit-${name}"]`)
    const bar = v.querySelector('[data-testid="edit-bar"]')
    const r = d.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { displayHidden: d.hidden, editHidden: e?.hidden ?? null, editVisible: e ? e.getBoundingClientRect().height > 0 : null,
      options: e ? [...e.querySelectorAll('option')].map((o) => o.textContent) : null, displayText: d.textContent.trim(),
      pointHitsDisplay: at === d || d.contains(at), canEditFields: window.canEditFields(), rowDirty: d.closest('.field-row')?.dataset.dirty,
      bar: bar ? { hiddenAttr: bar.hidden, display: getComputedStyle(bar).display, count: v.querySelector('[data-testid="dirty-count"]')?.textContent.trim() } : null }
  }, name)
  const BUYER = 'buyer-Client Commercial Buyer'
  mark = net.length
  say(`  before click: ${JSON.stringify(await rowState(BUYER))}`)
  await page.click(`#view-test-bed-detail [data-testid="display-${BUYER}"]`)
  await yieldFrames(page)
  const afterClick = await rowState(BUYER)
  say(`  after MOUSE click on the buyer row: ${JSON.stringify(afterClick)}`)
  await page.focus(`#view-test-bed-detail [data-testid="display-${BUYER}"]`)
  await page.keyboard.press('Enter')
  await yieldFrames(page)
  const afterEnter = await rowState(BUYER)
  say(`  after KEYBOARD Enter on the focused buyer row: ${JSON.stringify(afterEnter)}`)
  await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 })
  const w5 = writesSince(mark)
  say(`  non-GET requests during both attempts: ${w5.length} ${JSON.stringify(w5.map((n) => `${n.method} ${n.url}`))}`)
  // CALIBRATION of the click method and the open-state read: a REGISTERED row on the same card opens.
  const CAL = 'initialLead'
  const calBefore = await rowState(CAL)
  await page.click(`#view-test-bed-detail [data-testid="display-${CAL}"]`)
  await page.waitForFunction((n) => !document.querySelector(`#view-test-bed-detail [data-testid="edit-${n}"]`).hidden, { timeout: 10000 }, CAL)
  const calAfter = await rowState(CAL)
  say(`  CALIBRATION registered row "${CAL}" (same card, same click): before editHidden=${calBefore.editHidden} after editHidden=${calAfter.editHidden} editVisible=${calAfter.editVisible}`)
  await page.screenshot({ path: `${OUT}tbcore-p0-buyer-refused-1920.png` })
  await page.keyboard.press('Escape')
  await yieldFrames(page)
  const calClosed = await rowState(CAL)
  say(`  calibration row after Escape: editHidden=${calClosed.editHidden} bar=${JSON.stringify(calClosed.bar)} (no draft left behind)`)
  const fp5b = await fingerprint()
  say(`  record_contacts links before=${fp5a.links} after=${fp5b.links}; fingerprint unchanged=${same(fp5a, fp5b)}`)
  say(`  buyer-contacts calls across the whole run: ${net.filter((n) => n.url.includes('buyer-contacts')).length}`)
  say(`  network instrument calibration (same listener, same page): writes it captured earlier this run = ${net.filter((n) => n.method !== 'GET').map((n) => `${n.method} ${n.url.split('?')[0]} ${n.status}`).join('; ')}`)
  results.P0_5 = { afterClick, afterEnter, writes: w5.length, calibration: { before: calBefore.editHidden, after: calAfter.editHidden, afterEscape: calClosed.editHidden, bar: calClosed.bar }, links: [fp5a.links, fp5b.links], unchanged: same(fp5a, fp5b) }
  }

  // P0.6 walk: sub-tabs live on Reference, so sweep them while it is open
  const subBtns = await page.evaluate(() => [...document.querySelectorAll('#view-test-bed-detail [role=tab]')].map((b) => b.dataset.testid).filter((t) => t && !t.startsWith("tb-tab-btn-")))
  say(`  sub-tab buttons found on Reference: ${JSON.stringify(subBtns)}`)
  for (const t of subBtns) {
    await page.click(`#view-test-bed-detail [data-testid="${t}"]`)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    sweeps[`sub:${t}`] = await sweep()
  }
  await page.click('#view-test-bed-detail [data-testid="tb-tab-btn-commercials"]')
  await page.waitForFunction(() => document.querySelector('#view-test-bed-detail [data-testid="tb-tab-commercials"]'), { timeout: 20000 })
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 })
  sweeps.commercials = await sweep()
  await page.click('#view-test-bed-detail [data-testid="tb-tab-btn-stage-Qualification"]')
  await page.waitForFunction(() => document.querySelector('#view-test-bed-detail [data-testid="tb-stage-exit-criteria-list"][data-stage="Qualification"]'), { timeout: 20000 })
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 })
  sweeps.qualificationAgain = await sweep()
  const measReqs = net.filter((n) => n.url.includes('/measurability'))
  const measReq = (ex.requirements ?? []).filter((r) => JSON.stringify(r).includes('measurabilityConfirmed'))
  say('\n=== P0.6 (L1) measurability ===')
  say(`  Qualification gate requirement naming measurabilityConfirmed: ${measReq.length} ${JSON.stringify(measReq.map((r) => ({ type: r.requirement_type, met: r.met, label: r.label ?? r.requirement_detail?.label })))}`)
  for (const [k, s] of Object.entries(sweeps)) say(`  sweep ${k.padEnd(40)} controls=${s.controls} measurability=${s.measurability} textMentions=${s.textMentions} | calibration recordScores=${s.recordScores} nextStage=${s.nextStage} mentions=${JSON.stringify(s.mentionAt)}`)
  say(`  requests to /measurability across the whole run: ${measReqs.length}; total /api requests captured: ${net.length}; POSTs captured: ${net.filter((n) => n.method === 'POST').length}`)
  results.P0_6 = { sweeps, measurabilityRequests: measReqs.length, apiRequests: net.length, gateRequirement: measReq.length }
  await page.screenshot({ path: `${OUT}tbcore-p0-qualification-walk-end-1920.png` })
} finally {
  await browser.close()
}
  writeFileSync(`${OUT}network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
  writeFileSync(`${OUT}results.json`, JSON.stringify(results, null, 1))
  say("\n=== teardown ===")
  const r = await tearDown(TAG); globalThis.__tornDown = true
  say(`  tearDown returned: ${JSON.stringify(r)}`)
  const left = must(await db.from('records').select('id,record_type,deleted_at').in('id', [fx.bedId, fx.accountId, contact.id]), 'left')
  for (const l of left) say(`  ${l.record_type} ${l.id} deleted_at=${l.deleted_at}`)
  const kids = must(await db.from('records').select('id').eq('parent_record_id', fx.bedId).is('deleted_at', null), 'kids')
  say(`  live children of the fixture bed: ${kids.length}`)
} catch (e) { console.log("PROBE FAILED", e); process.exitCode = 1 } finally {
  if (!globalThis.__tornDown) { const r = await tearDown(TAG); console.log("  finally tearDown:", JSON.stringify(r)) }
}
