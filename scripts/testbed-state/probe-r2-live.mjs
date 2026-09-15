// ── R2 LIVE: the follow-up task on a Test Bed, end to end ────────────────
//
// The route half is proven by probe-r2-followup.mjs (refused before, written
// after). This proves the SURFACE: the pair renders as the third cell of the
// top row, a person can type into it, the save reaches the record, and the
// value is still there after a reload - which is the only thing that
// distinguishes a write that landed from one the screen merely remembers.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r2-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/testbed-state/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'tbst3'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-summary"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })

  // MEASURE FIRST, CAPTURE SECOND.
  const geo = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const r = (t) => { const e = v.querySelector(`[data-testid="${t}"]`); return e ? e.getBoundingClientRect() : null }
    const row = v.querySelector('[data-testid="tb-top-row"]')
    const cells = row ? [...row.children].map((c) => Math.round(c.getBoundingClientRect().top)) : []
    const sum = r('tb-card-summary'), notes = r('tb-card-notes')
    // The SHARED component keeps its own testids, `cd-`-prefixed from the
    // surface it was built on. Renaming them for a second consumer would break
    // every assertion that already cites them (Verification 32).
    const fu = v.querySelector('[data-testid="cd-card-followup"]')
    const fr = fu ? fu.getBoundingClientRect() : null
    return {
      cellCount: row ? row.children.length : 0,
      cellsOnOneRow: cells.length ? cells.every((t) => Math.abs(t - cells[0]) < 8) : null,
      cells,
      sumTop: sum ? Math.round(sum.top) : null,
      notesTop: notes ? Math.round(notes.top) : null,
      followUpBox: fr ? [Math.round(fr.width), Math.round(fr.height)] : null,
      followUpTop: fr ? Math.round(fr.top) : null,
      inTopRow: !!(row && fu && row.contains(fu)),
    }
  })
  console.log(`  ${JSON.stringify(geo)}`)
  check(geo.cellCount === 3, `the top row has THREE cells (${geo.cellCount})`)
  // A LAYOUT CLASS IS SIZED FOR A POPULATION. `.lead-card-body` is a
  // three-column grid; a fourth cell would wrap to a second row and every
  // count assertion would still pass, because wrapping preserves DOM order.
  check(geo.cellsOnOneRow === true, `all three share ONE row (tops ${JSON.stringify(geo.cells)})`)
  check(geo.inTopRow, 'the follow-up is INSIDE the top row, not merely on the page')
  check((geo.followUpBox?.[0] ?? 0) > 200 && (geo.followUpBox?.[1] ?? 0) > 40,
    `the follow-up has real size ${JSON.stringify(geo.followUpBox)}`)
  // THE THIRD CELL MUST NOT SQUEEZE THE FIRST. Adding follow-up took the top
  // row from two columns to three, and Summary's value fell to 58px - four
  // wrapped lines for its own placeholder sentence.
  //
  // THE THRESHOLD IS THE REQUIREMENT, NOT THE RESULT (Verification 47): the
  // claim is "the card's own placeholder reads on ONE LINE", which is a
  // sentence about the screen written before any number was known. Asserting
  // `width >= 228` after measuring 228 would pass on a card that still
  // wrapped at a slightly different font.
  const sum = await p.evaluate(() => {
    const card = document.querySelector('#view-test-bed-detail [data-testid="tb-card-summary"]')
    const disp = card?.querySelector('[data-testid="display-summary"]')
    const val = disp?.querySelector('.field-row-value') ?? disp
    if (!val) return null
    const lh = parseFloat(getComputedStyle(val).lineHeight) || 0
    const h = val.getBoundingClientRect().height
    return { lines: lh ? Math.round(h / lh) : null, w: Math.round(val.getBoundingClientRect().width),
             text: (val.textContent ?? '').trim() }
  })
  console.log(`  summary value: ${JSON.stringify(sum)}`)
  check(sum?.lines === 1,
    `the Summary card's own text reads on ONE line, not wrapped ("${sum?.text}" over ${sum?.lines} lines at ${sum?.w}px)`)
  await p.screenshot({ path: `${OUT}r2-followup.png`, fullPage: true })

  // ── Type and save, through the real controls ───────────────────────────
  // SCOPED TO THE TEST BED VIEW. The app is a single document with several
  // views resident at once, and the Contact surface renders this very
  // component - so a document-wide selector answers for whatever is in the
  // DOM rather than for the thing under test (Verification 25). The first run
  // of this probe typed into the CONTACT's follow-up card, in a hidden view,
  // and then failed to click a control that was 0x0 at the origin.
  const V = '#view-test-bed-detail '
  const dateSel = `${V}[data-testid="cd-followUpDate"]`
  const descSel = `${V}[data-testid="cd-followUpDescription"]`
  const saveSel = `${V}[data-testid="cd-followup-save"]`
  const present = await p.evaluate((a, b_, c) => ({
    date: !!document.querySelector(a), desc: !!document.querySelector(b_), save: !!document.querySelector(c),
  }), dateSel, descSel, saveSel)
  check(present.date && present.desc && present.save,
    `the date, description and save controls all exist ${JSON.stringify(present)}`)
  // AND EXACTLY ONE OF EACH IN THIS VIEW, so a count that could silently
  // absorb a neighbouring surface's copy is not what any of this rests on.
  const dupes = await p.evaluate((a) => document.querySelectorAll(a).length,
    `#view-test-bed-detail [data-testid="cd-card-followup"]`)
  check(dupes === 1, `exactly one follow-up card in the Test Bed view (${dupes})`)

  await p.type(descSel, 'Chase the site survey')
  await p.evaluate((sel, v) => {
    const el = document.querySelector(sel)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
  }, dateSel, '2027-04-01')
  // WHEN A CLICK FAILS, ASK WHAT IS AT THE POINT before asking why the handler
  // refused. Present, enabled and in view are three properties of the element;
  // what is on top of it is a fourth, and no assertion about the element can
  // see it (Verification 14).
  const saveState = await p.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { missing: true }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
    const at = document.elementFromPoint(cx, cy)
    return {
      box: [Math.round(r.width), Math.round(r.height)],
      top: Math.round(r.top), disabled: el.disabled, hidden: el.hasAttribute('hidden'),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      atPoint: at ? `${at.tagName}.${at.className}` : null,
      isSelf: at === el,
      text: (el.textContent ?? '').trim().slice(0, 40),
    }
  }, saveSel)
  console.log(`  save control: ${JSON.stringify(saveState)}`)
  await p.click(saveSel)

  // WAIT ON THE RECORD, not on a delay: the claim is that the write LANDED.
  let landed = null
  for (let i = 0; i < 40 && !landed; i++) {
    await new Promise((r) => setTimeout(r, 250))
    const rec = await api('GET', `/test-beds/${tb.bedId}`)
    if (rec.data?.payload?.followUpDate) landed = rec.data.payload
  }
  check(landed?.followUpDate === '2027-04-01',
    `the date reached the RECORD (${JSON.stringify(landed?.followUpDate)})`)
  check(landed?.followUpDescription === 'Chase the site survey',
    `the description reached the record (${JSON.stringify(landed?.followUpDescription)})`)

  // ── And it is still there on a fresh load ──────────────────────────────
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction((sel) => {
    const el = document.querySelector(sel)
    return !!el && el.value.length > 0
  }, { timeout: 30000 }, descSel)
  const after = await p.evaluate((a, b_) => ({
    date: document.querySelector(a)?.value, desc: document.querySelector(b_)?.value,
  }), dateSel, descSel)
  check(after.date === '2027-04-01' && after.desc === 'Chase the site survey',
    `the surface reads it back after a reload ${JSON.stringify(after)}`)
  await p.screenshot({ path: `${OUT}r2-followup-saved.png`, fullPage: true })
} finally {
  await b.close()
  const gone = await tearDown(TAG)
  console.log(`\nteardown ${TAG}: removed ${gone.removed?.length ?? 0}, remaining ${gone.remaining}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
if (bad.length) { for (const c of bad) console.log(`  FAILED: ${c.w}`); process.exit(1) }
