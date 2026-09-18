// ── R11 COSMETICS, BEFORE AND AFTER, WITH THE SAME INSTRUMENT ───────────
//
// Two findings that only looking could produce (Verification 4), so the proof
// is captures at three widths plus measurements that say what the eye saw.
//
// THE MEASURES ARE RELATIONSHIPS, NEVER CSS PROPERTIES. "The pair matches the
// scoring card" is the pair's border and padding EQUAL the scoring card's, read
// off all three; "the approver lines read as one list" is the gap between
// consecutive lines, compared against the gap inside the list above them.
// Asserting `border-width: 1px` would pass on a card that matched nothing
// (Verification 4's mechanism clause).
//
// RUN IT BEFORE THE CHANGE TOO. The before run is the negative control: these
// assertions must FAIL on the current tree, or they are not measuring the
// finding. Same file, same fixture shape, same widths.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-r11.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-r11.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
// The calibration harnesses each set their own run label, and a probe that
// answers to only one of them exits 2 and reports SILENT for a reason that has
// nothing to do with the claim (Verification 51's caveat, met head on: the
// first attempt at this did exactly that).
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-R11-${Date.now()}`
const V = '#view-test-bed-detail'
const PRE = 'Pre-Site Assessment'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const staff = must(await db.from('terminus_staff').select('name').limit(3), 'staff')
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: {
    commercialAuthority: staff[0].name, technicalAuthority: staff[1].name, terminusLegalOwner: staff[2].name,
  }, expected_revision: rev })
  // Real scores, so the scoring card RENDERS on Pre-Site under R4 rather than
  // sitting hidden. A hidden element still reports a computed border, so the
  // comparison would have passed on a card nobody can see: the claim is that
  // three panels look like each other on screen, and that needs three panels on
  // screen (Verification 4).
  for (const [criterion, score] of [['scoreRolloutPath', 4], ['scoreDataRights', 3]]) {
    const r = await call('POST', `/test-beds/${fx.bedId}/scores`, { criterion, score })
    if (r.status >= 300) throw new Error(`scoring ${criterion}: ${r.status} ${JSON.stringify(r.data)}`)
  }

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })

    for (const width of [1240, 1440, 1920]) {
      await page.setViewport({ width, height: 1100 })
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${PRE}"]`)
      await page.waitForFunction((v) => {
        const s = document.querySelector(`${v} [data-testid="tb-crit-summary"]`)
        return s && /outstanding to move to|All criteria met/.test(s.textContent ?? '')
      }, { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })

      // MEASURE FIRST, CAPTURE SECOND, and never photograph the element whose
      // geometry is the claim (Verification 4's capture clause).
      const m = await page.evaluate((v) => {
        const chrome = (sel) => {
          const el = document.querySelector(`${v} [data-testid="${sel}"]`)
          if (!el) return null
          const s = getComputedStyle(el)
          return { border: s.borderTopWidth, borderColor: s.borderTopColor, padding: s.paddingTop, w: Math.round(el.getBoundingClientRect().width) }
        }
        const lines = ['Commercial', 'Technical', 'Legal']
          .map((t) => document.querySelector(`${v} [data-testid="tb-stage-approver-${t}"]`))
          .filter(Boolean).map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) } })
        const gaps = lines.slice(1).map((l, i) => Math.round(l.top - lines[i].bottom))
        // What separates the GROUP from what follows it. A list is tighter
        // inside than outside, and that relation is the requirement: it is a
        // sentence about reading rather than a number read off this build.
        const after = document.querySelector(`${v} [data-testid="tb-stage-approval-row"]`)
        const outer = after && lines.length
          ? Math.round(after.getBoundingClientRect().top - lines[lines.length - 1].bottom)
          : null
        return {
          scoring: chrome('tb-stage-scoring-card'),
          documents: chrome('tb-stage-documents-section'),
          criteria: chrome('tb-stage-exit-criteria-list'),
          approverGaps: gaps, groupToTrackList: outer,
        }
      }, V)
      evidence[width] = m
      console.log(`\n=== ${width} ===`)
      console.log(`  scoring   ${JSON.stringify(m.scoring)}`)
      console.log(`  documents ${JSON.stringify(m.documents)}`)
      console.log(`  criteria  ${JSON.stringify(m.criteria)}`)
      console.log(`  approver line gaps ${JSON.stringify(m.approverGaps)}, group to track list ${m.groupToTrackList}`)

      const same = (a, b) => !!a && !!b && a.border === b.border && a.borderColor === b.borderColor && a.padding === b.padding
      check((m.scoring?.w ?? 0) > 0, `${width}: the scoring card is on screen, so the comparison is between three visible panels`,
        `scoring width ${m.scoring?.w}`)
      check(same(m.documents, m.scoring), `${width}: the documents panel wears the same chrome as the scoring card`,
        `${m.documents?.border}/${m.documents?.padding} against ${m.scoring?.border}/${m.scoring?.padding}`)
      check(same(m.criteria, m.scoring), `${width}: the exit criteria panel wears the same chrome as the scoring card`,
        `${m.criteria?.border}/${m.criteria?.padding} against ${m.scoring?.border}/${m.scoring?.padding}`)
      // ONE LIST, NOT THREE PARAGRAPHS, stated as a relation rather than a
      // number: a list is tighter INSIDE than OUTSIDE. A threshold read off
      // this build would be a tautology (Verification 47), and the first
      // version of this check compared the lines against the criteria ROWS,
      // whose boxes touch at 0px because they are bordered rows rather than
      // lines of text: a measure aimed at the wrong thing (Verification 33).
      const worstApprover = Math.max(...(m.approverGaps.length ? m.approverGaps : [NaN]))
      check(Number.isFinite(worstApprover) && m.groupToTrackList !== null && worstApprover < m.groupToTrackList,
        `${width}: the approver lines read as one list, tighter inside than outside`,
        `worst gap between lines ${worstApprover}px against ${m.groupToTrackList}px from the group to the track list`)

      await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-documents-section"]`)?.scrollIntoView({ block: 'center' }), V)
      await new Promise((r) => setTimeout(r, 150))
      await page.screenshot({ path: `${OUT}r11-${width}.png` })
    }
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
