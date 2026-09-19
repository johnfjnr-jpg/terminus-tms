// ── V2 AND V3: THE CONTACT'S TOP ROW ────────────────────────────────────
//
// V2: "There should be a slight gap in the border for the summary/notes/
// followup task and the personal details panel."
// V3: "When ALL is selected the only panel that requires to extend down is the
// notes panel. It doesn't make sense to extend summary and follow up task."
//
// Both are relationships between two elements, so both are measured as one
// (Verification 4's mechanism clause). V2's threshold comes from a NEIGHBOUR -
// the gap between the cards in the row - rather than from whatever this build
// happens to render (Verification 47).
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/walk3/probe-v2-v3.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v2-v3.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `W3-V23-${Date.now()}`
const C = '#view-contact-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
let opp
try {
  opp = await freshOpportunity(TAG)
  // Enough notes that ALL genuinely extends the panel. That is V3's condition,
  // built the way the surface gets it.
  const rev = (await call('GET', `/contacts/${opp.contactId}`)).data.latest_revision_number
  const notes = Array.from({ length: 12 }, (_, i) => ({
    at: new Date(Date.now() - i * 86400000).toISOString(),
    by: 'john+test@terminustechnologies.io',
    text: `Note ${12 - i}: a call summary long enough to occupy a row of its own.`,
  }))
  await call('PATCH', `/contacts/${opp.contactId}`, { payload: { notes }, expected_revision: rev })

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('contact-detail', id), opp.contactId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-top-row"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })

    // V3's condition: ALL selected, so the notes list is at full length.
    await page.evaluate((c) => document.querySelector(`${c} [data-testid="cd-notes-show-all"]`)?.click(), C)
    await new Promise((r) => setTimeout(r, 350))

    const m = await page.evaluate((c) => {
      const box = (sel) => {
        const el = document.querySelector(`${c} ${sel}`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }
      }
      const row = document.querySelector(`${c} [data-testid="cd-top-row"]`)
      const kids = row ? [...row.children] : []
      const rowBox = row ? row.getBoundingClientRect() : null
      // The gap BETWEEN the cards in the row: V2's threshold comes from here.
      const tops = kids.map((k) => k.getBoundingClientRect())
      const innerGap = tops.length > 1 ? Math.round(tops[1].left - tops[0].right) : null
      // The next section down, whatever it is.
      const next = row ? row.nextElementSibling : null
      const nextBox = next ? next.getBoundingClientRect() : null
      return {
        summary: box('[data-testid="cd-card-summary"]'),
        notes: box('[data-testid="cd-card-notes"]'),
        followUp: kids.length > 2 ? (() => { const r = kids[2].getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) } })() : null,
        innerGap,
        rowBottom: rowBox ? Math.round(rowBox.bottom) : null,
        nextTop: nextBox ? Math.round(nextBox.top) : null,
        gapToNext: rowBox && nextBox ? Math.round(nextBox.top - rowBox.bottom) : null,
        nextTestId: next ? next.getAttribute('data-testid') : null,
      }
    }, C)
    evidence.measured = m
    console.log(`\n=== the Contact's top row at 1440, ALL notes shown ===\n${JSON.stringify(m, null, 1)}`)

    check(!!m.notes && m.notes.h > 300, 'the notes panel is genuinely long, so V3 is not vacuous',
      `notes ${m.notes?.h}px`)

    // V3: only the notes panel extends. Summary and Follow-up keep their own
    // height rather than being stretched to match it.
    check(!!m.summary && !!m.notes && m.summary.h < m.notes.h - 40,
      'V3: the Summary panel does NOT stretch to the notes panel\'s height',
      `summary ${m.summary?.h}px against notes ${m.notes?.h}px`)
    check(!!m.followUp && !!m.notes && m.followUp.h < m.notes.h - 40,
      'V3: and neither does the Follow-up task',
      `follow-up ${m.followUp?.h}px against notes ${m.notes?.h}px`)

    // V2: the row and the panel below it are separated at least as much as the
    // cards inside the row are separated from each other.
    check(m.gapToNext !== null && m.innerGap !== null && m.gapToNext >= m.innerGap,
      'V2: the top row and the panel below it are separated at least as much as the cards inside it',
      `gap below ${m.gapToNext}px against ${m.innerGap}px between the cards`)

    await page.evaluate((c) => document.querySelector(`${c} [data-testid="cd-top-row"]`)?.scrollIntoView({ block: 'start' }), C)
    await new Promise((r) => setTimeout(r, 200))
    await page.screenshot({ path: `${OUT}v2-v3-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`)
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
