// ── W-TL2: THE STANCE NOTE AND THE LINKED COLUMN ────────────────────────
//
// John's walk 2026-09-30, cosmetic tier: the stance note at DOUBLE its visible
// width, and Linked as dd/mm/yyyy with no time.
//
// ── THE TWO ARE MEASURED AS A PAIR, AND THAT IS THE POINT ───────────────
//
// Verification 28: two changes to one surface must be measured together as well
// as alone, because each can be right on its own and mislead about the pair.
//
// Here it decided the round. Phase 0 measured that doubling the note ALONE does
// not fit at 1240: it adds 150px and only 137px of panel was unused. What made
// it fit is the OTHER half - dropping the time from Linked freed 58px - so the
// table grows by 91px rather than 150. Measuring the note alone would have
// reported an overflow that never happens; measuring Linked alone would have
// reported 58px of slack with nothing to spend it on.
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-wtl2-key-contacts.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/test-log-1/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'WTL2'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1920, 1240]) {
    errs.length = 0
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.waitForFunction(() => !!document.querySelector('[data-testid^="kc-note-"]'), { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const note = document.querySelector('[data-testid^="kc-note-"]')
      const table = note?.closest('table')
      const panel = table?.closest('.pg-card')
      const w = (e) => (e ? Math.round(e.getBoundingClientRect().width) : null)
      const heads = table ? [...table.querySelectorAll('thead th')].map((th) => ({
        text: (th.textContent || '').trim(), w: Math.round(th.getBoundingClientRect().width) })) : []
      const linked = [...table.querySelectorAll('tbody tr')][0]?.querySelectorAll('td')[3]
      const r = table?.getBoundingClientRect(); const pr = panel?.getBoundingClientRect()
      return {
        note: w(note), table: w(table), panel: w(panel), heads,
        linkedText: (linked?.textContent || '').trim(),
        overflowsRight: r && pr ? Math.round(r.right - pr.right) : null,
      }
    })

    console.log(`\n=== ${width}px ===`)
    // ── THE NOTE IS DOUBLE ────────────────────────────────────────────
    check(m.note === 300, `the stance note is 300px, double the measured 150 at ${width}`,
      `${m.note}px`)

    // ── AND IT DID NOT COST THE PANEL ─────────────────────────────────
    //
    // The claim that matters is a RELATIONSHIP, not a property: the table must
    // still sit inside its panel. A width assertion on the note alone is true
    // of a note that has pushed the table off the card.
    check(m.table <= m.panel, `the table still fits its panel at ${width}`,
      `table ${m.table} against panel ${m.panel}, ${m.panel - m.table}px spare`)
    check(m.overflowsRight !== null && m.overflowsRight <= 0,
      `and does not overhang its right edge at ${width}`, `${m.overflowsRight}px past`)

    // ── LINKED IS A DATE ──────────────────────────────────────────────
    check(/^\d{2}\/\d{2}\/\d{4}$/.test(m.linkedText),
      `Linked reads dd/mm/yyyy with no time at ${width}`, `"${m.linkedText}"`)
    check(!/\d{2}:\d{2}/.test(m.linkedText), `and carries no clock time at ${width}`)

    check(errs.length === 0, `no page errors at ${width}`, errs.join(' | '))
    console.log(`  columns: ${m.heads.map((h) => `${h.text || '(actions)'} ${h.w}`).join('  ')}`)

    // CAPTURE AFTER EVERY MEASUREMENT, with the table confirmed in the region.
    await p.evaluate(() => document.querySelector('[data-testid^="kc-note-"]')
      ?.closest('table')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid^="kc-note-"]')?.closest('table')?.getBoundingClientRect()
      return r ? r.top < window.innerHeight && r.bottom > 0 : false
    })
    check(inView, `the contacts table is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}key-contacts-${width}.png` })
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} W-TL2 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
