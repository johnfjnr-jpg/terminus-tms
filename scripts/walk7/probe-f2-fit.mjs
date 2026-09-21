// F2. DOES KEY CUSTOMER CONTACTS FIT BESIDE KEY DATES?
//
// MEASURED WITH REAL CONTENT, which is the whole instruction: the card is a
// table whose width demand comes from its ROWS, and an empty card would
// report a floor it never has in use. Contacts are linked through the real
// route first, so the card measured is the card John has.
//
// THE CLAIM IS A RELATIONSHIP, not a CSS property: what the contacts card
// NEEDS against what is free beside Key Dates. A property of either one alone
// cannot answer it.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk7/probe-f2-fit.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api as apiCall } from '../api-client.mjs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk7/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = 'w7f2'

const opp = await freshOpportunity(TAG)
const oppRow = must(await db.from('records').select('account_id').eq('id', opp.oppId).single(), 'opp')
const contacts = must(await db.from('records').select('id')
  .eq('record_type', 'contact').eq('parent_record_id', oppRow.account_id)
  .is('deleted_at', null), 'contacts')

// LINKED THROUGH THE REAL ROUTE, so the rows are the rows the screen builds.
// `api-client` adds the /api prefix itself, and every stop path from here on
// tears the fixture down: a throw before the try block would leak it.
let linked = 0
try {
  for (const c of contacts) {
    await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts`,
      { contact_id: c.id, role: 'Commercial Buyer' })
    linked++
  }
} catch (e) { console.log(`   link refused: ${String(e).slice(0, 200)}`) }
console.log(`linked ${linked} of ${contacts.length} contacts onto the fixture\n`)
if (linked === 0) { await tearDown([TAG]); throw new Error('no contacts linked, so the card has no real content to measure') }

const b = await puppeteer.launch({ headless: 'new' })
const out = []
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && v.querySelector('[data-testid="kc-row-"], [data-testid="ref-key-contacts"] table, [data-testid="ref-key-contacts"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))

    const m = await p.evaluate(() => {
      const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect()
        return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) } }
      const grid = document.querySelector('.ref-cards')
      const dates = document.querySelector('[data-testid="ref-dates"]')
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const panel = document.querySelector('[data-testid="reference-panel"]')
      const cs = grid ? getComputedStyle(grid) : null
      // WHAT THE CARD NEEDS: measured by letting it size to its own content
      // off-layout, rather than reading the width the full-row rule gives it.
      let need = null
      if (kc) {
        const clone = kc.cloneNode(true)
        clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:max-content'
        document.body.appendChild(clone)
        need = Math.ceil(clone.getBoundingClientRect().width)
        clone.remove()
      }
      return {
        panel: box(panel), grid: box(grid), dates: box(dates), kc: box(kc),
        cols: cs?.gridTemplateColumns, gap: cs?.gap,
        cardCount: grid ? grid.children.length : 0,
        kcRows: kc ? kc.querySelectorAll('tbody tr, [data-testid^="kc-row-"]').length : 0,
        need,
      }
    })
    const freeBesideDates = (m.panel?.r ?? 0) - (m.dates?.r ?? 0)
    console.log(`=== ${width}px ===`)
    console.log(`  .ref-cards columns : ${m.cols}   gap ${m.gap}   cards ${m.cardCount}`)
    console.log(`  panel              : ${m.panel?.l}..${m.panel?.r}  (${m.panel?.w}px)`)
    console.log(`  Key Dates          : ${m.dates?.l}..${m.dates?.r}  (${m.dates?.w}px)`)
    console.log(`  Key Cust. Contacts : ${m.kc?.l}..${m.kc?.r}  (${m.kc?.w}px), ${m.kcRows} linked row(s)`)
    console.log(`  the contacts card NEEDS ${m.need}px at its own content width`)
    console.log(`  FREE to the right of Key Dates: ${freeBesideDates}px`)
    console.log(`  -> fits beside Key Dates? ${m.need <= freeBesideDates - 16 ? 'YES' : 'NO'}\n`)
    out.push({ width, need: m.need, free: freeBesideDates, dates: m.dates?.w, cols: m.cols })
    await p.screenshot({ path: `${OUT}f2-before-${width}.png` })
  }
} finally { await b.close(); await tearDown([TAG]) }

console.log('─── F2 VERDICT ───')
for (const o of out) {
  console.log(`  ${o.width}: needs ${o.need}px, ${o.free}px free beside Key Dates -> ${o.need <= o.free - 16 ? 'FITS' : `DOES NOT FIT, floor is ${o.need}px`}`)
}
