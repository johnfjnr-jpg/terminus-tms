// ── R10 LIVE, BOTH DIRECTIONS ───────────────────────────────────────────
//
// The claim is not "the rows exist". It is that a Test Bed with no approvers
// named CANNOT LEAVE QUALIFICATION, and that naming them clears exactly those
// three requirements and nothing else.
//
// So both directions run on ONE owned tagged fixture, and each is read TWICE:
// from the exit criteria panel a person sees, and from the transition the gate
// actually refuses. A panel is a display and a refusal is the enforcement, and
// Verification 43 is the whole reason to read both rather than one.
//
// A met payload_field_required row is HIDDEN from the panel (visibleRequirements
// keeps a met row only when it is a process requirement), so direction B's panel
// claim is that the three rows are GONE - paired, per Verification 14, with the
// route still carrying them at met: true, so "absent from the panel" is not
// being satisfied by the requirement having vanished from the gate.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-r10.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { labelFor } from '../lib/approver-gate-rows.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-r10.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-R10-${Date.now()}`
const V = '#view-test-bed-detail'
const QUAL = 'Qualification'
const RULED = ['Commercial', 'Technical', 'Legal'].map((t) => `Requires ${labelFor(t)}`)
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const payloadOf = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'payload') ?? {}).payload ?? {}
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const staff = must(await db.from('terminus_staff').select('name').limit(3), 'staff')
  const before = await payloadOf(fx.bedId)
  const emptyNow = ['commercialAuthority', 'technicalAuthority', 'terminusLegalOwner']
    .filter((k) => !before[k] || String(before[k]).trim() === '')
  check(emptyNow.length === 3, 'the fresh fixture names no approver, which is the state direction A is about',
    JSON.stringify(emptyNow))

  // ── DIRECTION A, THE ENFORCEMENT ────────────────────────────────────
  const refusedA = await call('POST', `/records/${fx.bedId}/transition`, { to_stage: 'Pre-Site Assessment' })
  const blockingA = (refusedA.data?.blocking ?? []).map((b) => b.message)
  evidence.refusedA = { status: refusedA.status, blocking: blockingA }
  check(refusedA.status >= 400, 'A: the transition out of Qualification is refused', String(refusedA.status))
  check(RULED.every((m) => blockingA.includes(m)),
    'A: and the refusal names all three approvers, in the ruled wording',
    JSON.stringify(blockingA.filter((m) => /approver/.test(m))))

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    const open = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${QUAL}"]`)
      // Waits on the SUMMARY LINE, which only the loaded panel can write. The
      // criteria list exists either way, which is the counterfactual this wait
      // has to fail (Verification 7).
      await page.waitForFunction((v) => {
        const s = document.querySelector(`${v} [data-testid="tb-crit-summary"]`)
        return s && /outstanding to move to|All criteria met/.test(s.textContent ?? '')
      }, { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    }
    const readPanel = () => page.evaluate((v) => ({
      summary: document.querySelector(`${v} [data-testid="tb-crit-summary"]`)?.textContent.trim() ?? null,
      rows: [...document.querySelectorAll(`${v} [data-testid="tb-stage-exit-criteria-list"] .tb-crit-row`)]
        .map((r) => ({ text: r.querySelector('.tb-crit-text')?.textContent.trim() ?? '', met: r.getAttribute('data-met') })),
    }), V)

    await open()
    const panelA = await readPanel()
    evidence.panelA = panelA
    console.log(`\n=== Qualification panel, no approvers named ===\n  ${panelA.summary}`)
    for (const r of panelA.rows) console.log(`    [${r.met === 'true' ? 'x' : ' '}] ${r.text}`)
    const approverRowsA = panelA.rows.filter((r) => /approver to be named/.test(r.text))
    check(approverRowsA.length === 3, 'A: the panel shows exactly three approver rows', String(approverRowsA.length))
    check(RULED.every((m) => approverRowsA.some((r) => r.text === m)),
      'A: each carries the ruled wording', JSON.stringify(approverRowsA.map((r) => r.text)))
    check(approverRowsA.every((r) => r.met === 'false'), 'A: and every one of them reads UNSATISFIED',
      JSON.stringify(approverRowsA.map((r) => r.met)))
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)?.scrollIntoView({ block: 'center' }), V)
    await page.screenshot({ path: `${OUT}r10-before-1440.png` })

    // ── DIRECTION B ─────────────────────────────────────────────────────
    const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
    const named = await call('PATCH', `/test-beds/${fx.bedId}`, { payload: {
      commercialAuthority: staff[0].name, technicalAuthority: staff[1].name, terminusLegalOwner: staff[2].name,
    }, expected_revision: rev })
    check(named.status < 300, 'B: the three approver fields are named through the route', String(named.status))

    const refusedB = await call('POST', `/records/${fx.bedId}/transition`, { to_stage: 'Pre-Site Assessment' })
    const blockingB = (refusedB.data?.blocking ?? []).map((b) => b.message)
    evidence.refusedB = { status: refusedB.status, blocking: blockingB }
    check(RULED.every((m) => !blockingB.includes(m)),
      'B: the refusal list LOSES all three approver requirements',
      JSON.stringify(blockingB.filter((m) => /approver/.test(m))))
    // Paired with the claim above, per Verification 14: the gate did not stop
    // asking, it is satisfied. The requirements list still carries them, met.
    const criteria = (await call('GET', `/records/${fx.bedId}/exit-criteria?stage=${encodeURIComponent(QUAL)}`)).data
    const approverReqs = (criteria.requirements ?? []).filter((r) => /approver to be named/.test(r.message ?? ''))
    check(approverReqs.length === 3 && approverReqs.every((r) => r.met === true),
      'B: and the gate still ASKS all three, now met, rather than having dropped them',
      JSON.stringify(approverReqs.map((r) => [r.message, r.met])))
    check(blockingB.length === blockingA.length - 3,
      'B: exactly three requirements moved, and nothing else changed',
      `${blockingA.length} blocking before, ${blockingB.length} after`)

    await open()
    const panelB = await readPanel()
    evidence.panelB = panelB
    console.log(`\n=== Qualification panel, approvers named ===\n  ${panelB.summary}`)
    for (const r of panelB.rows) console.log(`    [${r.met === 'true' ? 'x' : ' '}] ${r.text}`)
    check(!panelB.rows.some((r) => /approver to be named/.test(r.text)),
      'B: the three rows have left the panel, because a met field row is hidden',
      JSON.stringify(panelB.rows.filter((r) => /approver/.test(r.text))))
    const n = (s) => Number(/^(\d+) of (\d+)/.exec(s ?? '')?.[1] ?? NaN)
    check(n(panelB.summary) === n(panelA.summary) - 3,
      'B: and the outstanding count on screen falls by exactly three',
      `${panelA.summary} -> ${panelB.summary}`)
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)?.scrollIntoView({ block: 'center' }), V)
    await page.screenshot({ path: `${OUT}r10-after-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length} (${t.removed.map((r) => r.record_type).join(',')}), remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
