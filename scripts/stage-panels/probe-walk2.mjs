// ── WALK 2: W6, W9 AND W10 ON THE SCORING SURFACE, AT 1440 ──────────────
//
// Run BEFORE the change as the negative control and AFTER as the proof, same
// instrument, same fixture shape. Every claim is a RELATIONSHIP between two
// elements or a size measured against its own CONTENT, never a number read off
// the result (Verification 47).
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-walk2.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-walk2.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-W2-${Date.now()}`
const V = '#view-test-bed-detail'
const KEY = 'scoreRolloutPath'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  // A recorded score WITH a reason, which is what W10 is about.
  await call('POST', `/test-beds/${fx.bedId}/scores`, { criterion: KEY, score: 4 })
  const revised = await call('POST', `/test-beds/${fx.bedId}/scores`, {
    criterion: KEY, score: 5, reason: 'the rollout path firmed up after the site visit' })
  if (revised.status >= 300) throw new Error(`scoring: ${revised.status} ${JSON.stringify(revised.data)}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 30000 })
    await page.click(`${V} [data-testid="tb-tab-btn-stage-Qualification"]`)
    await page.waitForFunction((v, k) => document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`), { timeout: 20000 }, V, KEY)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })

    const box = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }
    }, sel)

    // ── W10: THE RECORDED REASON, WITH NO DRAFT OPEN ──────────────────
    const w10 = await page.evaluate((v, k) => {
      const sel = document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`)?.getBoundingClientRect()
      const cur = document.querySelector(`${v} [data-testid="tb-score-current-${k}"]`)?.getBoundingClientRect()
      const head = document.querySelector(`${v} [data-testid="tb-score-${k}"] .tb-score-head`)?.getBoundingClientRect()
      const text = document.querySelector(`${v} [data-testid="tb-score-current-${k}"]`)?.textContent.trim() ?? null
      return sel && cur && head
        ? { selRight: Math.round(sel.right), selTop: Math.round(sel.top), curLeft: Math.round(cur.left), curTop: Math.round(cur.top), headBottom: Math.round(head.bottom), text }
        : null
    }, V, KEY)
    evidence.w10 = w10
    console.log(`\n=== W10, the recorded reason ===\n  ${JSON.stringify(w10)}`)
    check(!!w10 && /firmed up after the site visit/.test(w10.text ?? ''),
      'W10: the recorded reason is on screen, so the placement claim is not vacuous', w10?.text?.slice(0, 60))
    check(!!w10 && w10.curLeft > w10.selRight,
      'W10: and it renders RIGHT of the score, where it was entered',
      w10 ? `reason left ${w10.curLeft}, select right ${w10.selRight}` : '')
    check(!!w10 && Math.abs(w10.curTop - w10.selTop) <= 24,
      'W10: level with the score rather than below the row',
      w10 ? `reason top ${w10.curTop}, select top ${w10.selTop}` : '')

    // ── W6: THE SELECT IS SIZED TO ITS CONTENT ────────────────────────
    const w6 = await page.evaluate((v, k) => {
      const sel = document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`)
      if (!sel) return null
      // The widest option, measured in the page's own font rather than guessed.
      const probe = document.createElement('span')
      const cs = getComputedStyle(sel)
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
      document.body.appendChild(probe)
      let widest = 0
      for (const o of sel.options) { probe.textContent = o.label ?? o.textContent; widest = Math.max(widest, probe.getBoundingClientRect().width) }
      probe.remove()
      const r = sel.getBoundingClientRect()
      return { width: Math.round(r.width), widestOption: Math.round(widest) }
    }, V, KEY)
    evidence.w6select = w6
    console.log(`\n=== W6, the select ===\n  ${JSON.stringify(w6)}`)
    // A select shows its widest option plus a chevron. 44px is the chevron and
    // the padding a native control needs, taken from the REQUIREMENT (the
    // content must fit) rather than from what this build happens to render.
    check(!!w6 && w6.width <= w6.widestOption + 44,
      'W6: the select is sized to its content plus a chevron, not to a fixed width',
      w6 ? `${w6.width}px against a widest option of ${w6.widestOption}px` : '')

    // ── W6: THE REASON IS ONE LINE, AND STARTS RIGHT OF THE SELECT ────
    await page.select(`${V} [data-testid="tb-score-select-${KEY}"]`, '3')
    await page.waitForFunction((v, k) => document.querySelector(`${v} [data-testid="tb-score-reason-${k}"]`), { timeout: 10000 }, V, KEY)
    await new Promise((r) => setTimeout(r, 120))
    const one = await page.evaluate((v, k) => {
      const ta = document.querySelector(`${v} [data-testid="tb-score-reason-${k}"]`)
      const sel = document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`)
      const cs = getComputedStyle(ta)
      const line = parseFloat(cs.lineHeight) || 18
      const r = ta.getBoundingClientRect(); const s = sel.getBoundingClientRect()
      return { h: Math.round(r.height), line: Math.round(line), rows: ta.rows,
        left: Math.round(r.left), selRight: Math.round(s.right), gap: Math.round(r.left - s.right) }
    }, V, KEY)
    evidence.w6reason = one
    console.log(`\n=== W6, the reason box, empty ===\n  ${JSON.stringify(one)}`)
    check(one.h < one.line * 2, 'W6: the empty reason box is ONE line, not two',
      `${one.h}px against a ${one.line}px line`)
    check(one.gap >= 8 && one.gap <= 64, 'W6: and it starts right of the select with a clear gap',
      `${one.gap}px between the select and the reason`)

    // LONG ENOUGH TO GENUINELY NEED A SECOND LINE. The first version of this
    // string was 108 characters into a box measured at 754px, which is about
    // one line: the check failed on an input that did not ask for the thing it
    // was testing, rather than on the feature. The requirement is "it grows
    // when the text needs it", so the text has to need it.
    await page.type(`${V} [data-testid="tb-score-reason-${KEY}"]`,
      'a reason long enough that it genuinely needs a second line to be read, which is the only time the box '
      + 'should grow, and long enough again that no plausible width on this surface could fit it onto one line '
      + 'however the card is sized')
    await new Promise((r) => setTimeout(r, 150))
    const grown = await page.evaluate((v, k) => {
      const ta = document.querySelector(`${v} [data-testid="tb-score-reason-${k}"]`)
      return Math.round(ta.getBoundingClientRect().height)
    }, V, KEY)
    evidence.w6grown = grown
    check(grown > one.h, 'W6: and it grows only when the text needs it',
      `${one.h}px empty, ${grown}px with two lines of text`)
    await page.evaluate((v, k) => document.querySelector(`${v} [data-testid="tb-score-${k}"]`)?.scrollIntoView({ block: 'center' }), V, KEY)
    await page.screenshot({ path: `${OUT}walk2-row-1440.png` })

    // ── W9: THE AWAITING-REASON STATE READS AS ONE STATE ──────────────
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 30000 })
    await page.click(`${V} [data-testid="tb-tab-btn-stage-Qualification"]`)
    await page.waitForFunction((v, k) => document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`), { timeout: 20000 }, V, KEY)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    await page.select(`${V} [data-testid="tb-score-select-${KEY}"]`, '1')
    await page.waitForFunction((v, k) => document.querySelector(`${v} [data-testid="tb-score-reason-${k}"]`), { timeout: 10000 }, V, KEY)
    await new Promise((r) => setTimeout(r, 150))
    const w9 = await page.evaluate((v, k) => {
      const rows = [...document.querySelectorAll(`${v} .tb-score-row`)]
      const blockingRow = document.querySelector(`${v} [data-testid="tb-score-${k}"]`)
      const quieted = rows.filter((r) => r !== blockingRow && r.querySelector('select[disabled]'))
      const bg = (el) => el ? getComputedStyle(el).backgroundColor : null
      const bl = (el) => el ? getComputedStyle(el).borderLeftWidth : null
      return {
        rows: rows.length,
        quieted: quieted.length,
        blockingMarked: !!blockingRow?.getAttribute('data-blocking'),
        blockingDiffers: bg(blockingRow) !== bg(quieted[0]) || bl(blockingRow) !== bl(quieted[0]),
        sharedLines: document.querySelectorAll(`${v} [data-testid="tb-score-quieted-note"]`).length,
        oldLockNote: document.querySelectorAll(`${v} [data-testid="tb-score-lock-note"]`).length,
        reasonLabel: document.querySelector(`${v} [data-testid="tb-score-reason-label-${k}"]`)?.textContent.trim() ?? null,
      }
    }, V, KEY)
    evidence.w9 = w9
    console.log(`\n=== W9, the awaiting-reason state ===\n  ${JSON.stringify(w9)}`)
    check(w9.quieted > 0, 'W9: criteria really are quieted, so the claim is not vacuous', String(w9.quieted))
    check(w9.blockingMarked && w9.blockingDiffers,
      'W9: the blocking criterion is visibly marked, and reads differently from a quieted one',
      JSON.stringify({ marked: w9.blockingMarked, differs: w9.blockingDiffers }))
    check(w9.sharedLines === 1, 'W9: the quieted criteria carry exactly ONE shared line naming the block',
      `${w9.sharedLines} shared line(s)`)
    check(w9.oldLockNote === 0, 'W9: and the separate green note is gone, consolidated into it',
      `${w9.oldLockNote} lock note(s)`)
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)?.scrollIntoView({ block: 'start' }), V)
    await new Promise((r) => setTimeout(r, 150))
    await page.screenshot({ path: `${OUT}walk2-awaiting-1440.png` })
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
