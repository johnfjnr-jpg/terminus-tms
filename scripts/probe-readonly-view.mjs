// Another user's record is read only at load. Round 41 W1.
//
// ── WHAT IS MEASURED, AND IT IS NOT "THE BANNER IS THERE" ─────────────────
//
// The walk selected seven assessment scores and typed seven reasons on a record
// it did not own, and was refused per row at Record, seven times, after the
// work. So the claim is about what a person can DO, not about what is on the
// page: every input, textarea and select on the view must be non-interactive,
// and the reason must be stated once, at the top.
//
// CLAUDE.md Verification 27: pointer-events is the property a person
// experiences. Dimming alone is what the walk already had.
//
// TWO RECORDS, which is the whole instrument. A probe that only visited a
// record the session does not own would report "everything is locked" against a
// build that locks everything, including your own deals. Verification 17.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-readonly-view.mjs')
import { readFileSync, mkdirSync, statSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const OUT = new URL('../.verify/readonly/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// NOT MINE: owned by john@, and the dev session is john+test@.
// MINE: created by this session through the API, immediately before the run.
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const { freshOpportunity, tearDown } = await import('./fixtures.mjs')
const { oppId: MINE } = await freshOpportunity('readonly-probe')

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const rows = []

for (const width of [1240, 1920]) {
  for (const [label, id] of [['not mine', NOT_MINE], ['mine', MINE]]) {
    await page.setViewport({ width, height: 900 })
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((rid) => navigate('opportunity-detail', rid), id)
    // Verification 7. The reference tab's display name is set by the record's
    // own render and is empty before it, and it differs between the two records.
    await page.waitForFunction(() => {
      const el = document.getElementById('ref-display-name') || document.getElementById('detail-company')
      return el && el.textContent.trim().length > 0
    }, { timeout: 25000 }).catch(() => {})

    const state = await page.evaluate(() => {
      const view = document.getElementById('view-opportunity-detail')
      const banner = document.getElementById('opp-readonly-banner')
      // ── ENUMERATED BY BEHAVIOUR, NOT BY TAG. 2026-09-02 ─────────────────
      //
      // This read `input, textarea, select` - THE SAME THREE TAGS THE CSS RULE
      // NAMES. The rule and the instrument that checks it shared one blind
      // spot, so the probe confirmed the rule against the rule's own
      // assumptions and reported green while eighteen elements that behave as
      // controls stayed live on another user's record.
      //
      // A div with an onclick that opens an editor is a control. It is now
      // counted as one, so a control added later in a shape nobody has thought
      // of yet is measured rather than missed.
      const formControls = [...view.querySelectorAll('input, textarea, select')]
      const editOpeners = [...view.querySelectorAll(
        '.ref-field-display, .cd-name-display, .deal-toggle, [role="switch"]')]
      const controls = [...formControls, ...editOpeners]
      // THE PROPERTY A PERSON EXPERIENCES, and it takes two questions now:
      // pointer-events stops a mouse, `disabled` and tabindex stop a keyboard,
      // and the reported defect went through the keyboard on a select that had
      // only the first.
      const interactive = controls.filter((el) => {
        if (getComputedStyle(el).pointerEvents === 'none'
          && (el.disabled === true || el.getAttribute('tabindex') === '-1')) return false
        return true
      })
      return {
        klass: view.classList.contains('is-not-mine'),
        bannerText: (banner?.textContent ?? '').trim(),
        controls: controls.length,
        formControls: formControls.length,
        editOpeners: editOpeners.length,
        interactive: interactive.length,
        firstInteractive: interactive[0]?.id || interactive[0]?.className || interactive[0]?.tagName || null,
      }
    })

    const file = `${OUT}readonly-${width}-${label.replace(' ', '-')}.png`
    const rect = await page.evaluate(() => {
      const b = document.getElementById('opp-readonly-banner')
      b.scrollIntoView({ block: 'start' })
      const r = b.getBoundingClientRect()
      return { x: 0, y: Math.max(0, r.y - 8), width: window.innerWidth,
        height: Math.min(window.innerHeight - Math.max(0, r.y - 8), Math.max(r.height, 40) + 260) }
    })
    await page.screenshot({ path: file, clip: rect })
    rows.push({ width, label, ...state, bytes: statSync(file).size })
  }
}

console.log('\n  ANOTHER USER\'S RECORD IS READ ONLY. Round 41 W1.\n')
console.log('  width  record     is-not-mine  controls  still interactive  banner')
for (const r of rows) {
  console.log(`  ${String(r.width).padEnd(6)} ${r.label.padEnd(10)} ${String(r.klass).padEnd(12)} ` +
    `${String(r.controls).padEnd(9)} ${String(r.interactive).padEnd(18)} ${r.bannerText ? JSON.stringify(r.bannerText.slice(0, 46) + '...') : '(none)'}`)
}

const fail = []
for (const width of [1240, 1920]) {
  const not = rows.find((r) => r.width === width && r.label === 'not mine')
  const mine = rows.find((r) => r.width === width && r.label === 'mine')
  if (!not.klass) fail.push(`${width}: another user's record does not carry is-not-mine`)
  if (mine.klass) fail.push(`${width}: YOUR OWN record carries is-not-mine`)
  if (not.controls < 20) fail.push(`${width}: only ${not.controls} controls found, so this may not have reached the view`)
  if (not.interactive !== 0) fail.push(`${width}: ${not.interactive} controls are still typeable on another user's record, first is ${not.firstInteractive}`)
  if (mine.interactive === 0) fail.push(`${width}: NOTHING is typeable on your own record either, so the lock is not discriminating`)
  if (!/belongs to another user/.test(not.bannerText)) fail.push(`${width}: the reason is not stated on the unowned record`)
  if (mine.bannerText) fail.push(`${width}: a read-only banner is showing on your own record`)
  if (not.bytes < 3000 || mine.bytes < 3000) fail.push(`${width}: a capture is under 3KB and is probably blank`)
}
console.log('')
if (fail.length) for (const f of fail) console.log('  FAILED  ' + f)
else console.log('  PASS  locked and stated on another user\'s record, untouched on your own, at both widths')
console.log(`\n  captures: ${OUT}\n`)
await browser.close()
await tearDown()
process.exit(fail.length ? 1 : 0)
