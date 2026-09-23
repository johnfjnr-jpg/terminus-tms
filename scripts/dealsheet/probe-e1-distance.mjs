// E1: HOW FAR IS A FIGURE FROM ITS OWN LABEL?
//
// The statement is a full-width section, so on a wide screen the label sits
// at the left edge and its money columns at the right. The measure is the
// GAP a reader's eye has to cross between the end of the label text and the
// figure that belongs to it.
//
// ── THE MEASURE IS THE PERSON'S, NOT THE DOCUMENT'S ─────────────────────
//
// Verification 27: distance is a property of the layout, a WINDOW is a
// property of the task. The task here is reading one line, so the measure is
// the horizontal gap between the label's own text end and the first money
// cell - not the row width, which is a property of the page and improves
// while the reading gets worse.
//
// THREE WIDTHS, because Verification 10 names 1240 and 1920 and 3440 and this
// is exactly the defect a cap is for: it cannot be seen at 1240 at all.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet/probe-e1-distance.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.E1_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const oppId = must(await db.from('records').select('id')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(1), 'opp')[0].id

// THE REQUIREMENT, WRITTEN BEFORE THE NUMBER IS KNOWN (Verification 47).
// One eye span. Typographic convention puts comfortable saccade reach at
// roughly 25em; at this sheet's 14px label that is about 350px. Taken as the
// ceiling rather than read off whatever the fix happens to produce.
const EYE_SPAN_PX = 350

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1240, 1440, 3440]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1100 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() =>
      !!document.querySelector('[data-testid="stmt-strip-revenue"]')?.textContent?.trim(),
      { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)

    const m = await p.evaluate(() => {
      // THE LABEL'S TEXT END, NOT ITS BOX. The box is a 1fr track and fills
      // whatever is left, so its right edge measures the track rather than
      // the words - which is the difference between measuring the document
      // and measuring the reading.
      const rows = [...document.querySelectorAll('.stmt-row')].filter((r) => r.querySelector('.stmt-lbl'))
      const out = rows.slice(0, 6).map((r) => {
        const lbl = r.querySelector('.stmt-lbl')
        const nums = [...r.querySelectorAll('.stmt-num')]
        if (!lbl || !nums.length) return null
        const range = document.createRange()
        // The label's first text node is the line's own words; the <small>
        // beneath is the driver note and is not what the eye tracks to.
        const textNode = [...lbl.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
        if (!textNode) return null
        range.selectNodeContents(textNode)
        const textEnd = range.getBoundingClientRect().right
        const firstNum = nums[0].getBoundingClientRect().left
        const lastNum = nums[nums.length - 1].getBoundingClientRect().right
        return {
          label: textNode.textContent.trim().slice(0, 34),
          toFirst: Math.round(firstNum - textEnd),
          toLast: Math.round(lastNum - textEnd),
        }
      }).filter(Boolean)
      const sheet = document.querySelector('.stmt-sheet').getBoundingClientRect()
      return { rows: out, sheetW: Math.round(sheet.width),
        strip: Math.round(document.querySelector('[data-testid="stmt-strip"]').getBoundingClientRect().width) }
    })
    console.log(`  sheet ${m.sheetW}px, strip ${m.strip}px`)
    for (const r of m.rows) {
      console.log(`    ${r.label.padEnd(36)} label-end to FIRST figure ${String(r.toFirst).padStart(5)}px`
        + `   to LAST ${String(r.toLast).padStart(5)}px`)
    }
    const worst = Math.max(...m.rows.map((r) => r.toFirst))
    console.log(`  WORST gap to the first figure: ${worst}px against a ${EYE_SPAN_PX}px eye span`)
    check(worst <= EYE_SPAN_PX,
      `a label and its figure sit within one eye span at ${width}`,
      `worst ${worst}px against ${EYE_SPAN_PX}px`)

    await p.evaluate(() => document.querySelector('[data-testid="deal-statement"]')
      ?.scrollIntoView({ block: 'start' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}e1-${TAG}-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="deal-statement"]').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0
    })
    check(inView, `the statement is inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
