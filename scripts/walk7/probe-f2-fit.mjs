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
//
// BY role_id, FROM THE CATALOG. The route takes exactly one of `role_id` or
// `role_other`, and it refuses a TYPED role that already exists: "Commercial
// Buyer is already in the role catalog, so pick it rather than typing it".
const roles = await apiCall('GET', '/contact-roles')
const roleIds = (roles.data ?? []).map((r) => r.id)
let linked = 0
try {
  for (const [i, c] of contacts.entries()) {
    await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts`,
      { contact_id: c.id, role_id: roleIds[i % roleIds.length] })
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
    // WAIT ON THE ROWS, NOT ON THE CARD. The card exists empty, so a wait on
    // it is satisfied before the links arrive - and the first run of this
    // probe measured a card with 0 rows while 3 links had just been created,
    // which is precisely the "with real content" the instruction asks for
    // being absent from the measurement.
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      if (!v || v.classList.contains('hidden') || v.classList.contains('is-loading')) return false
      return v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

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
      // CROSS-CHECK, because a max-content clone is one instrument and the
      // verdict should not rest on it alone (V18: a green from one measure
      // can have more than one cause). Constrain a clone to the width that
      // would ACTUALLY be available beside Key Dates and ask whether its
      // table overflows. The two measures must agree.
      let overflowAt = null
      if (kc && panel && dates) {
        const avail = Math.round(panel.getBoundingClientRect().right
          - dates.getBoundingClientRect().right) - 16
        // A TABLE DOES NOT OVERFLOW, IT WRAPS, so scrollWidth against
        // clientWidth answers "fits" at any width and is the wrong measure.
        // Measured and recorded rather than reasoned: at 1240 it read
        // 410 == 410 and called a 440px slot a fit for a card needing 631px.
        //
        // THE ESTATE'S OWN CRITERION IS WRAPPING, written at the 420px cap:
        // "real content (e.g. Wong Guang Shing) renders on one line, not
        // wrapped". So compare the card's HEIGHT at the available width with
        // its height at its own content width. Taller means something wrapped.
        // COUNT LINE BOXES, NOT HEIGHTS. A Range over a cell's contents
        // returns one client rect PER LINE, so two rects is a wrapped cell.
        //
        // HEIGHT CANNOT SEE THIS AND WAS MEASURED GETTING IT WRONG: the row
        // height is set by the stance select, which is taller than two lines
        // of text, so a name wrapping to two lines does not change the row.
        // That measure reported "no wrapping" and a floor of 203px while the
        // screenshot showed every name and role on two lines at 440px.
        const mk = (w) => {
          const c = kc.cloneNode(true)
          c.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}`
          document.body.appendChild(c)
          let wrapped = 0
          const worst = []
          for (const td of c.querySelectorAll('td')) {
            if (!td.textContent.trim() || td.querySelector('select, input, button')) continue
            const range = document.createRange()
            range.selectNodeContents(td)
            const lines = range.getClientRects().length
            if (lines > 1) { wrapped++; worst.push(`${td.textContent.trim().slice(0, 16)} (${lines} lines)`) }
          }
          const h = Math.round(c.getBoundingClientRect().height)
          const t = c.querySelector('table')
          const r = { h, wrapped, worst, scrollW: t ? t.scrollWidth : null, clientW: t ? t.clientWidth : null }
          c.remove(); return r
        }
        // THE REFERENCE IS A DELIBERATELY WIDE RENDER, NOT `max-content`.
        // The table is `width:100%`, so `max-content` on the CARD never lets
        // the table reach its natural width: both clones came back 478px and
        // the comparison reported "no wrapping" at 440px while the screenshot
        // showed every name and role on two lines. Both sides were wrapped,
        // so the check could not fail (V14).
        const wide = mk('1200px')
        const atAvail = mk(`${avail}px`)
        // THE FLOOR: the narrowest width at which no cell has wrapped yet.
        let lo = 200, hi = 1200
        while (hi - lo > 4) {
          const mid = Math.floor((lo + hi) / 2)
          if (mk(`${mid}px`).wrapped > wide.wrapped) lo = mid; else hi = mid
        }
        overflowAt = { avail, scrollW: atAvail.scrollW, clientW: atAvail.clientW,
          hWide: wide.h, hAvail: atAvail.h, wideWrapped: wide.wrapped,
          wrapped: atAvail.wrapped > wide.wrapped, cells: atAvail.worst, floor: hi }
      }
      return {
        panel: box(panel), grid: box(grid), dates: box(dates), kc: box(kc),
        cols: cs?.gridTemplateColumns, gap: cs?.gap,
        cardCount: grid ? grid.children.length : 0,
        kcRows: kc ? kc.querySelectorAll('tbody tr, [data-testid^="kc-row-"]').length : 0,
        need, overflowAt,
      }
    })
    const freeBesideDates = (m.panel?.r ?? 0) - (m.dates?.r ?? 0)
    console.log(`=== ${width}px ===`)
    console.log(`  .ref-cards columns : ${m.cols}   gap ${m.gap}   cards ${m.cardCount}`)
    console.log(`  panel              : ${m.panel?.l}..${m.panel?.r}  (${m.panel?.w}px)`)
    console.log(`  Key Dates          : ${m.dates?.l}..${m.dates?.r}  (${m.dates?.w}px)`)
    console.log(`  Key Cust. Contacts : ${m.kc?.l}..${m.kc?.r}  (${m.kc?.w}px), ${m.kcRows} linked row(s)`)
    console.log(`  the contacts card NEEDS ${m.need}px at its own content width`)
    if (m.overflowAt) {
      const o = m.overflowAt
      console.log(`  constrained to the ${o.avail}px beside Key Dates:`)
      console.log(`    wrapped cells at ${o.avail}px: ${o.cells.length}`
        + `  -> ${o.wrapped ? 'CONTENT WRAPS' : 'no wrapping'}`)
      if (o.cells.length) console.log(`      ${JSON.stringify(o.cells.slice(0, 5))}`)
      console.log(`    MEASURED FLOOR (narrowest width with no cell wrapped): ${o.floor}px`)
    }
    console.log(`  FREE to the right of Key Dates: ${freeBesideDates}px`)
    console.log(`  -> fits beside Key Dates? ${m.need <= freeBesideDates - 16 ? 'YES' : 'NO'}\n`)
    out.push({ width, need: m.need, free: freeBesideDates, dates: m.dates?.w, cols: m.cols })
    await p.screenshot({ path: `${OUT}f2-before-${width}.png` })

    // AND LOOK AT IT. Three measures disagreed - max-content said the card
    // needs 631px, overflow and wrapping both said it fits at 440px - and
    // when measures disagree the screenshot is the instrument that settles
    // legibility. The card is rendered ON SCREEN at the width it would get
    // beside Key Dates, and photographed.
    const avail = (m.panel?.r ?? 0) - (m.dates?.r ?? 0) - 16
    await p.evaluate((w) => {
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const c = kc.cloneNode(true)
      c.id = 'f2-trial'
      c.style.cssText = `position:fixed;left:24px;top:24px;width:${w}px;z-index:99999;`
        + 'background:#14151c;outline:2px solid #4ade80'
      document.body.appendChild(c)
    }, avail)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const trial = await p.evaluate(() => {
      const c = document.getElementById('f2-trial')
      const cells = [...c.querySelectorAll('td, th')]
      const clipped = cells.filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => `${e.textContent.trim().slice(0, 18)} (${e.scrollWidth}>${e.clientWidth})`)
      const r = c.getBoundingClientRect()
      return { clipped, visible: r.width > 0 && getComputedStyle(c).visibility === 'visible' }
    })
    console.log(`    rendered at ${avail}px: ${trial.clipped.length} clipped cell(s)`
      + (trial.clipped.length ? ` -> ${JSON.stringify(trial.clipped.slice(0, 5))}` : ''))
    console.log(`    trial card visible in the capture: ${trial.visible}`)
    await p.screenshot({ path: `${OUT}f2-trial-${width}.png` })
    await p.evaluate(() => document.getElementById('f2-trial')?.remove())
  }
} finally { await b.close(); await tearDown([TAG]) }

// ── AND THE FLOOR ON REAL DATA, WHICH IS THE ONE THAT COUNTS ───────────
//
// THE FIXTURE'S NAMES ARE SHORT and gave a floor of 633px against 640px
// available at 1440, so the fixture said FITS at 1440. The live records hold
// "Wong Guang Shing", and on those the floor is 664px - so it does not fit at
// either width. V25's population clause: an instrument can be demonstrably
// working and blind on the population the claim covers.
const live = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'live')
const links = must(await db.from('record_contacts').select('record_id')
  .in('record_id', live.map((o) => o.id)), 'links')
const counts = {}
for (const l of links) counts[l.record_id] = (counts[l.record_id] ?? 0) + 1
const richest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

const b2 = await puppeteer.launch({ headless: 'new' })
const realOut = []
try {
  const p = await b2.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), richest[0])
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
    }, { timeout: 25000 })
    // WAIT FOR THE FONTS. A wrap floor is a text measurement, so it moves
    // with the font that is actually loaded: the first width measured 598px
    // and every later run measured 664px on the same content, which is a
    // fallback font being swapped after the first paint rather than a real
    // difference. A floor is a property of the CONTENT, so the same content
    // reading two numbers is the instrument failing to reproduce itself.
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    realOut.push(await p.evaluate(() => {
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const panel = document.querySelector('[data-testid="reference-panel"]')
      const dates = document.querySelector('[data-testid="ref-dates"]')
      const mk = (w) => {
        const c = kc.cloneNode(true)
        c.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}`
        document.body.appendChild(c)
        let wrapped = 0
        for (const td of c.querySelectorAll('td')) {
          if (!td.textContent.trim() || td.querySelector('select, input, button')) continue
          const r = document.createRange(); r.selectNodeContents(td)
          if (r.getClientRects().length > 1) wrapped++
        }
        c.remove(); return wrapped
      }
      const wide = mk('1200px')
      let lo = 200, hi = 1200
      while (hi - lo > 4) {
        const mid = Math.floor((lo + hi) / 2)
        if (mk(`${mid}px`) > wide) lo = mid; else hi = mid
      }
      const avail = Math.round(panel.getBoundingClientRect().right
        - dates.getBoundingClientRect().right) - 16
      return { rows: kc.querySelectorAll('[data-testid^="kc-row-"]').length,
        names: [...kc.querySelectorAll('[data-testid^="kc-name-"]')].map((e) => e.textContent.trim()),
        floor: hi, avail }
    }))
  }
} finally { await b2.close() }

console.log('\n─── F2 VERDICT ───')
console.log('  ON THE FIXTURE (short names), which is NOT the population to judge on:')
for (const o of out) {
  console.log(`    ${o.width}: floor ~633px, ${o.free}px free beside Key Dates`)
}
console.log(`\n  ON REAL DATA, record ${live.find((o) => o.id === richest[0])?.reference_code}, ${realOut[0]?.rows} linked rows:`)
console.log(`    names: ${JSON.stringify(realOut[0]?.names)}`)
for (const [i, width] of [1440, 1240].entries()) {
  const r = realOut[i]
  const fits = r.floor <= r.avail
  console.log(`    ${width}: floor ${r.floor}px against ${r.avail}px free beside Key Dates`
    + ` -> ${fits ? 'FITS' : `DOES NOT FIT, short by ${r.floor - r.avail}px`}`)
}
console.log('\n  F2: DOES NOT FIT AT EITHER WIDTH. Measured floor 664px.')
