// WALK 8 ITEM 3: THE CURRENT STATE OF L7, L12 AND C9.
// Measured and photographed, nothing changed. These three need John's ruling.
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk8/probe-item3-state.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk8/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
// A Test Bed that HAS notes, so L7's absence is visible rather than vacuous.
const beds = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'test_bed').is('deleted_at', null).limit(20), 'beds')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  let chosen = null
  for (const bed of beds) {
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('test-bed-detail', id), bed.id)
    await p.waitForFunction(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      return v && !v.classList.contains('is-loading') && v.querySelector('[data-testid="tb-view-header"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
    // SCOPED, for the same reason as below: a document-wide count finds the
    // CONTACT screen's hidden rows and reports every bed as having notes.
    const n = await p.evaluate(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      return v ? v.querySelectorAll('.ref-notes-row').length : 0
    })
    if (n > 0) { chosen = bed; break }
  }
  if (!chosen) chosen = beds[0]
  console.log(`measured on ${chosen.reference_code}`)
  await p.evaluate(() => document.fonts.ready)
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  // ── L7 and L12: the header and the notes band ──────────────────────────
  const l7 = await p.evaluate(() => {
    // SCOPED TO THE VISIBLE VIEW. A document-wide `.ref-notes-row` also counts
    // the CONTACT screen's rows, which are in the DOM and hidden: the first
    // run reported 6 rows on a bed that has none, and then could not
    // photograph one, because none of them was on the screen being measured.
    const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
    const rows = [...v.querySelectorAll('.ref-notes-row')]
    return {
      mainNotes: rows.length,
      withChip: rows.filter((r) => r.querySelector('.chip')).length,
      sample: rows.slice(0, 2).map((r) => (r.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70)),
      headerText: (document.querySelector('[data-testid="tb-view-header"]')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120),
      anyTag: [...document.querySelectorAll('[data-testid="tb-view-header"] .tag')].map((e) => e.textContent.trim()),
    }
  })
  console.log(`\nL7  main note rows: ${l7.mainNotes}, carrying a stage chip: ${l7.withChip}`)
  console.log(`    sample: ${JSON.stringify(l7.sample)}`)
  console.log(`L12 header reads: ${JSON.stringify(l7.headerText)}`)
  console.log(`    tags in the header: ${JSON.stringify(l7.anyTag)}`)
  // L12 IS ABOUT THE HEADER, so the header is what is captured for it.
  await p.evaluate(() => document.querySelector('[data-testid="tb-view-header"]')?.scrollIntoView({ block: 'start' }))
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${OUT}item3-L12-header.png` })

  // L7 IS ABOUT THE NOTE ROWS, and the first capture of them was of an empty
  // Notes card: the rows are in the DOM but not where the header sits, so the
  // picture showed the claim's subject nowhere. Scrolled to a ROW, and proven
  // to be in the captured region before the shutter.
  const shot = await p.evaluate(() => {
    const view = [...document.querySelectorAll('[id^="view-"]')]
      .find((x) => !x.classList.contains('hidden'))
    const row = view.querySelector('.ref-notes-row')
    if (!row) return { ok: false, why: 'no note row in the DOM at all' }
    row.scrollIntoView({ block: 'center' })
    const r = row.getBoundingClientRect()
    return { ok: r.top < innerHeight && r.bottom > 0
      && getComputedStyle(row).visibility === 'visible',
      why: `top ${Math.round(r.top)} of ${innerHeight}` }
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  console.log(`    L7 capture: a note row is in the region and visible: ${shot.ok} (${shot.why})`)
  await p.screenshot({ path: `${OUT}item3-L7-notes.png` })

  // ── C9: the unit-count card title, on the Commercials tab ──────────────
  await p.evaluate(() => [...document.querySelectorAll('button')]
    .find((x) => /commercials/i.test(x.textContent ?? ''))?.click())
  await p.waitForFunction(() => document.querySelector('[data-testid="tb-card-sensors"]'), { timeout: 25000 })
  await p.evaluate(() => document.fonts.ready)
  await p.evaluate(() => document.querySelector('[data-testid="tb-card-sensors"]')?.scrollIntoView({ block: 'center' }))
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const c9 = await p.evaluate(() => {
    const card = document.querySelector('[data-testid="tb-card-sensors"]')
    return { title: (card?.querySelector('.pg-card-title, .card-title')?.textContent ?? '').trim(),
      rows: [...card.querySelectorAll('.pg-item-name, .data-row-label, label')].map((e) => e.textContent.trim()).slice(0, 6) }
  })
  console.log(`\nC9  the card title reads: ${JSON.stringify(c9.title)}`)
  console.log(`    its rows: ${JSON.stringify(c9.rows)}`)
  await p.screenshot({ path: `${OUT}item3-C9-card-title.png` })
} finally { await b.close() }
