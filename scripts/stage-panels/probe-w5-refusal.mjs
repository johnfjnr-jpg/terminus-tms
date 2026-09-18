// ── W5's OTHER DIRECTION, AND 3.5 ───────────────────────────────────────
//
// The queue must not have removed the refusal. A GENUINELY stale write - one
// made while somebody else has moved the record - must still be refused, and
// must now say the ruled sentence rather than naming a second session.
//
// The second editor is real here: the record is advanced through the API while
// the browser holds its own revision, which is exactly what the queue cannot
// and must not compensate for.
//
// And 3.5: the message's reload control must reload THE SURFACE THAT RENDERED
// IT. Proven on the Test Bed and on the Contact, by clicking it and reading
// which record is on screen afterwards.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-w5-refusal.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-w5-refusal.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-W5R-${Date.now()}`
const RULED = 'This record moved on while you were working'
const SUPERSEDED = 'changed in another session'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
// A timeout that does not say WHICH wait timed out is a diagnostic that names
// no cause (Verification 14's clause). Every wait below runs through `at`, so
// the failure line carries the step.
let step = 'start'
const at = async (label, fn) => { step = label; return fn() }
let fx, opp
try {
  fx = await freshTestBed(TAG)
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    const net = []
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), req: r, done: false }) })
    page.on('requestfinished', (r) => { const e = net.find((n) => n.req === r); if (e) { e.status = r.response()?.status() ?? null; e.done = true } })
    const settle = () => page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })
    const waitFor = async (fn, ms = 20000) => {
      const t = Date.now()
      while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) }
      throw new Error(`waited ${ms}ms and the condition never became true`)
    }
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })

    // ── THE TEST BED, WITH A REAL SECOND EDITOR ───────────────────────
    await at('open the test bed', () => page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId))
    await at('the test bed renders', () => page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, '#view-test-bed-detail', TAG))
    await at('the test bed settles', () => settle())

    // ── THE SHELL'S OWN ANSWERS, BEFORE ANY WRITE ──────────────────────
    //
    // The voice and the dispatch are properties of `staleWriteHtml` and
    // `reloadAfterStaleWrite`, so they are exercised DIRECTLY here rather than
    // only through a save. Calibrating them through the save meant an injection
    // that changed the sentence also changed what the probe was waiting for,
    // and the run died before the assertion: a check only ever reached when it
    // passes (Verification 9). These run first and need no fixture write.
    const wiring = await at('read the shell renderer', () => page.evaluate(() => {
      const fn = window.staleWriteHtml
      return typeof fn === 'function'
        ? { testBed: fn('abc', 'test_bed'), contact: fn('abc', 'contact'), unknown: fn('abc') }
        : null
    }))
    evidence.wiring = wiring
    check(!!wiring && /'test_bed'/.test(wiring.testBed) && /'contact'/.test(wiring.contact),
      '3.5: the shell renders the control wired to whichever surface asks',
      JSON.stringify(wiring && { testBed: /'test_bed'/.test(wiring.testBed), contact: /'contact'/.test(wiring.contact) }))
    check(!!wiring && /'opportunity'/.test(wiring.unknown),
      '3.5: and an absent kind keeps the Opportunity behaviour, so its callers are unchanged')
    check(!!wiring && wiring.testBed.includes(RULED) && !wiring.testBed.includes(SUPERSEDED),
      'the shell renderer carries the ruled sentence', JSON.stringify(wiring?.testBed?.slice(0, 90)))

    // And the reloader itself, called as the control calls it.
    await at('navigate away', () => page.evaluate(() => navigate('test-beds')))
    await at('the list renders', () => page.waitForFunction(() => getComputedStyle(document.querySelector('#view-test-bed-detail')).display === 'none', { timeout: 20000 }))
    await at('reload through the control\'s own path', () => page.evaluate((id) => window.reloadAfterStaleWrite(id, 'test_bed'), fx.bedId))
    const dispatched = await at('the right surface came back', () => page.waitForFunction((v, t) => {
      const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`)
      return getComputedStyle(document.querySelector(v)).display !== 'none' && h && h.textContent.includes(t)
    }, { timeout: 20000 }, '#view-test-bed-detail', TAG).then(() => true).catch(() => false))
    check(dispatched, '3.5: reloadAfterStaleWrite brings back the TEST BED, not an Opportunity')
    await at('settle after the dispatch', () => settle())
    // The screen is loaded and holding a revision. NOW somebody else writes.
    const held = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
    const other = await call('PATCH', `/test-beds/${fx.bedId}`, {
      payload: { estGoLiveDate: '2027-06-01' }, expected_revision: held })
    check(other.status < 300, 'a second editor advances the record while the screen holds its own revision',
      `${other.status}, revision ${held} -> ${held + 1}`)

    let mark = net.length
    await at('open Commercials', () => page.click('#view-test-bed-detail [data-testid="tb-tab-btn-commercials"]'))
    await at('the count row renders', () => page.waitForFunction((v) => document.querySelector(`${v} [data-testid="display-airQualitySensors"]`), { timeout: 20000 }, '#view-test-bed-detail'))
    await at('open the editor', () => page.click('#view-test-bed-detail [data-testid="display-airQualitySensors"]'))
    await at('the editor is open', () => page.waitForFunction((v) => document.querySelector(`${v} [data-field="airQualitySensors"] input`), { timeout: 10000 }, '#view-test-bed-detail'))
    await at('type', () => page.type('#view-test-bed-detail [data-field="airQualitySensors"] input', '7'))
    await at('blur', () => page.click('#view-test-bed-detail [data-testid="tb-detail-name"]'))
    await at('the edit bar shows', () => page.waitForFunction((v) => { const b = document.querySelector(`${v} [data-testid="edit-bar"]`); return b && !b.hidden }, { timeout: 10000 }, '#view-test-bed-detail'))
    mark = net.length
    await at('save', () => page.click('#view-test-bed-detail [data-testid="save-all"]'))
    // ── THE WAIT MUST NOT READ THE THING UNDER TEST ────────────────────
    //
    // This first waited for the ruled sentence to appear. Calibrated, the
    // injection that puts the OLD sentence back made that wait unsatisfiable,
    // so the probe died at this line and the verdict came back SILENT with the
    // assertion never reached - Verification 9's clause, arriving inside the
    // wait rather than inside the assertion.
    //
    // It waits for the WRITE to have answered instead, which is true whichever
    // sentence the screen then shows.
    await at('the save answers', () => waitFor(() => net.slice(mark).some(
      (n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url) && n.done), 20000))
    // The feedback ELEMENT, not its words: it exists whichever sentence the
    // screen shows, so this wait survives the calibration that changes the
    // sentence. `waitForNetworkIdle` was tried here and hung, which is a wait
    // on the absence of something rather than the presence of anything.
    await at('and the screen has rendered it', () => page.waitForFunction(
      (v) => !!document.querySelector(`${v} [data-testid="tb-save-feedback"]`),
      { timeout: 20000 }, '#view-test-bed-detail'))
    const refused = net.slice(mark).find((n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url))
    const screen = await page.evaluate(() => document.body.innerText)
    evidence.testBed = { status: refused?.status ?? null, ruled: screen.includes(RULED), superseded: screen.includes(SUPERSEDED) }
    console.log(`\n=== the Test Bed, second editor ===\n  ${JSON.stringify(evidence.testBed)}`)
    check(refused?.status === 409, 'the genuinely stale write is STILL refused, so the queue did not soften the gate',
      String(refused?.status))
    check(screen.includes(RULED), 'and the screen says the ruled sentence')
    check(!screen.includes(SUPERSEDED), 'and no longer names a second session')

    // 3.5: the control reloads THIS record type.
    const btn = await page.$('#view-test-bed-detail .stale-reload')
    check(!!btn, 'the message carries its reload control')
    if (btn) {
      const onclick = await page.evaluate((el) => el.getAttribute('onclick'), btn)
      check(/'test_bed'/.test(onclick ?? ''), '3.5: and it is wired to THIS surface\'s loader', String(onclick))
      await btn.click()
      await settle()
      const stillHere = await page.evaluate((t) => {
        const h = document.querySelector('#view-test-bed-detail [data-testid="tb-detail-name"]')
        // `!el?.hidden` reads TRUE for an element that does not exist, which is
        // a comparison with nothing on one side reported as a finding
        // (Verification 14). Presence and visibility are separated.
        // And VISIBILITY is the computed display, not the `hidden` attribute:
        // `navigate` switches views by class, so every view reads
        // `hidden === false` and a field called `shown` built on it would be
        // true of a view nobody can see (Verification 4's attribute clause).
        const shown = (sel) => {
          const el = document.querySelector(sel)
          return el ? getComputedStyle(el).display !== 'none' : null
        }
        return {
          onTestBed: !!h && h.textContent.includes(t),
          testBedViewShown: shown('#view-test-bed-detail'),
          oppViewShown: shown('#view-opportunity-detail'),
        }
      }, TAG)
      evidence.reloadTestBed = stillHere
      check(stillHere.onTestBed && stillHere.testBedViewShown === true && stillHere.oppViewShown === false,
        '3.5: clicking it reloads the TEST BED, not an Opportunity',
        JSON.stringify(stillHere))
    }

    // ── THE CONTACT, the same control on the other surface ────────────
    opp = await at('build a contact fixture', () => freshOpportunity(`${TAG}-C`))
    await at('open the contact', () => page.evaluate((id) => navigate('contact-detail', id), opp.contactId))
    await at('the contact renders', () => page.waitForFunction(() => document.querySelector('#view-contact-detail [data-testid="cd-add-note-btn"]'), { timeout: 30000 }))
    await at('the contact settles', () => settle())
    const cHeld = must(await db.from('records').select('id').eq('id', opp.contactId).single(), 'contact').id
    const cRev = (await call('GET', `/contacts/${cHeld}`)).data.latest_revision_number
    await call('PATCH', `/contacts/${cHeld}`, { payload: { city: 'Another city' }, expected_revision: cRev })
    mark = net.length
    await at('open the note box', () => page.click('#view-contact-detail [data-testid="cd-add-note-btn"]'))
    await at('the note box is open', () => page.waitForFunction(() => document.querySelector('#view-contact-detail [data-testid="cd-new-note-input"]'), { timeout: 10000 }))
    await at('type the note', () => page.type('#view-contact-detail [data-testid="cd-new-note-input"]', 'a note against a moved contact'))
    await at('save the note', () => page.click('#view-contact-detail [data-testid="cd-add-note-btn"]'))
    await at('the note write answers', () => waitFor(() => net.slice(mark).some(
      (n) => n.method === 'PATCH' && /\/api\/contacts\/[^/]+$/.test(n.url) && n.done), 20000))
    const cPatch = net.slice(mark).find((n) => n.method === 'PATCH' && /\/api\/contacts\/[^/]+$/.test(n.url))
    evidence.contact = { status: cPatch?.status ?? null }
    console.log(`\n=== the Contact, second editor ===\n  ${JSON.stringify(evidence.contact)}`)
    check(cPatch?.status === 409, 'the Contact refuses a genuinely stale write too', String(cPatch?.status))

    await page.screenshot({ path: `${OUT}w5-refusal-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete at step "${step}": ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  for (const t of [TAG, `${TAG}-C`]) { const r = await tearDown(t); console.log(`teardown ${t}: removed ${r.removed.length}, remaining ${r.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
