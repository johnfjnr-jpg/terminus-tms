// G1-G6: THE STRUCTURAL TERMS CARDS
//
// ONE LINE PER ROW is measured as the row's CONTENT HEIGHT against its
// tallest child, not as equal tops: a label and a control of different
// heights sit on one line with different tops whenever the row is not
// top-aligned, which is Verification 4's clause and the fault the C1 round
// already hit once on this very screen.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk12/probe-g1-g6-terms.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk12/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.G_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const oppId = must(await db.from('records').select('id')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(1), 'opp')[0].id

const MEASURE = () => {
  const cards = [...document.querySelectorAll('.terms-cards > .pg-card')].map((c) => {
    const rows = [...c.querySelectorAll('.terms-field-row')].map((r) => {
      const cs = getComputedStyle(r)
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const contentH = Math.round(r.getBoundingClientRect().height - pad)
      const kids = [...r.querySelectorAll('.deal-field, .deal-toggle')]
      const tallest = kids.length ? Math.max(...kids.map((k) => Math.round(k.getBoundingClientRect().height))) : 0
      const ctrl = r.querySelector('input, select')
      const lbl = r.querySelector('.deal-field-label')
      return {
        label: (lbl?.textContent ?? '').replace(/\s*\?$/, '').trim().slice(0, 30),
        lines: tallest ? Math.max(1, Math.round(contentH / tallest)) : 1,
        contentH, tallest,
        ctrlW: ctrl ? Math.round(ctrl.getBoundingClientRect().width) : null,
        ctrlTag: ctrl ? ctrl.tagName.toLowerCase() : null,
        // ONE LINE means the label's text and the control share a band.
        sameBand: (lbl && ctrl)
          ? Math.abs(Math.round(lbl.getBoundingClientRect().top) - Math.round(ctrl.getBoundingClientRect().top)) < 20
          : null,
      }
    })
    return { title: c.querySelector('.pg-card-title')?.textContent.trim(), rows }
  })
  return { cards, titles: cards.map((c) => c.title) }
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
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
    await p.waitForFunction(() => !!document.querySelector('.terms-cards'), { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    const m = await p.evaluate(MEASURE)

    for (const c of m.cards) {
      console.log(`  ${String(c.title).padEnd(22)} ${c.rows.length} row(s)`)
      for (const r of c.rows) {
        console.log(`     ${r.label.padEnd(30)} lines ${r.lines}  h ${String(r.contentH).padStart(3)}/${r.tallest}`
          + `  control ${r.ctrlTag ?? '-'} ${String(r.ctrlW ?? '-').padStart(4)}px  sameBand ${r.sameBand}`)
      }
    }
    // G2, G3
    check(m.titles.includes('Duration and Margin'),
      'G2 the card is titled "Duration and Margin"', m.titles.join(' | '))
    const dm = m.cards.find((c) => c.title === 'Duration and Margin') ?? m.cards[0]
    check(/^Contract duration/i.test(dm.rows[0]?.label ?? ''),
      'G3 Contract duration is the FIRST row of that card', dm.rows[0]?.label ?? '(none)')
    // G4, G5
    // ── THE MEASURE IS `sameBand`, NOT `lines`, AND THE FIRST VERSION WAS
    //    THE WRONG AXIS ────────────────────────────────────────────────
    //
    // `lines` compares the ROW's content height with its tallest CHILD. The
    // child is the `.deal-field`, which is itself 50px tall holding a label
    // ABOVE an input - so a two-line field inside a one-child row reads as
    // "1 line" and the check passed while every row was stacked. Verification
    // 33: a measure aimed at the wrong axis of a property that has more than
    // one. The claim is "label then value", which is a RELATIONSHIP between
    // the label and the control, and that is what `sameBand` measures.
    const stacked = m.cards.flatMap((c) => c.rows.filter((r) => r.sameBand === false)
      .map((r) => `${c.title}/${r.label}`))
    check(stacked.length === 0,
      'G4+G5 every row renders ONE line, label then value',
      stacked.length ? stacked.join('; ') : `${m.cards.reduce((n, c) => n + c.rows.length, 0)} rows, all inline`)
    // G6
    const tax = m.cards.find((c) => c.title === 'Tax Adjustments')
    check(!!tax && tax.rows.length === 2,
      'G6 Tax Adjustments lays out as TWO lines exactly', `${tax?.rows.length ?? 0} rows`)
    // G1: a control sized to its data, not to the card
    const wide = m.cards.flatMap((c) => c.rows.filter((r) => (r.ctrlW ?? 0) > 200)
      .map((r) => `${r.label} ${r.ctrlW}px`))
    check(wide.length === 0, 'G1 no control is stretched past its data',
      wide.length ? wide.join('; ') : 'every control at or under 200px')

    await p.evaluate(() => document.querySelector('.terms-cards')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}terms-${TAG}-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('.terms-cards').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.height > 0
    })
    check(inView, `the cards are inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
