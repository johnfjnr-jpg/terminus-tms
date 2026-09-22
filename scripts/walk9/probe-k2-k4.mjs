// K2 and K4's GUARD.
//
// K2 is "every field sized to the data it displays", so the assertion is a
// RELATIONSHIP - the control against the widest thing it must show - never a
// pixel count read off the result. Walk 7 recorded the cost of the other
// shape: `>= 130` asserted after measuring 130 passed on a cell that cropped.
//
// K4 is "Stance renders on ONE row", and one row is a SHARED CENTRE. Equal
// tops is the wrong test: walk 5 reported a wrapped header as one line twice
// because two lines that touch have overlapping edges, and this row is
// `align-items: center` so its controls have different tops by design.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk9/probe-k2-k4.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk9/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
// THE RICHEST LIVE RECORD, because walk 7 proved a short-named fixture is the
// wrong population for a sizing claim.
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const links = must(await db.from('record_contacts').select('record_id')
  .in('record_id', opps.map((o) => o.id)), 'links')
const counts = {}
for (const l of links) counts[l.record_id] = (counts[l.record_id] ?? 0) + 1
const richest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
const rec = opps.find((o) => o.id === richest[0])
console.log(`measured on ${rec.reference_code}, ${richest[1]} linked contacts`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    // A SETTLE TIMEOUT IS A FAILED CHECK, NOT A CRASH. Under calibration this
    // probe runs seven times back to back and three runs died here, so the
    // harness read "the check never ran" and scored a real injection SILENT.
    // A probe that throws cannot be calibrated.
    let settled = true
    try {
      await p.waitForFunction(() => {
        const v = document.getElementById('view-opportunity-detail')
        return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
          && !document.querySelector('.wrap.is-loading')
          && v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
      }, { timeout: 45000 })
    } catch { settled = false }
    if (!settled) {
      check(false, `the Opportunity settled with contact rows at ${width}`,
        'the view never settled, so nothing below is a measurement')
      continue
    }
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => document.querySelector('[data-testid="ref-key-contacts"]')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const table = kc.querySelector('.kc-table')
      const card = kc.getBoundingClientRect()
      const probe = document.createElement('span')
      const cs = getComputedStyle(kc.querySelector('tbody td'))
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
      document.body.appendChild(probe)
      const textW = (s) => { probe.textContent = s; return Math.ceil(probe.getBoundingClientRect().width) }
      const colNeed = (i) => Math.max(
        ...[...kc.querySelectorAll('tbody tr')].map((tr) =>
          textW((tr.querySelectorAll('td')[i]?.textContent ?? '').trim())),
        textW((kc.querySelectorAll('th')[i]?.textContent ?? '').trim()))
      const cols = [0, 1, 3].map((i) => ({
        i, need: colNeed(i),
        got: Math.round(kc.querySelectorAll('tbody tr')[0].querySelectorAll('td')[i].getBoundingClientRect().width),
      }))
      const sel = kc.querySelector('[data-testid^="kc-stance-"]')
      const longestStance = Math.max(...[...sel.options].map((o) => textW(o.text)))
      probe.remove()

      // RE-POINTED, walk 10 item 1: the flex row is a DIV INSIDE the cell now,
      // not the cell itself, so that the table keeps one column system for its
      // headers and its rows. The claim is unchanged - these controls share
      // one row - and the element carrying it moved.
      const stanceTd = kc.querySelector('tbody tr .kc-stance')
      const bits = [...stanceTd.querySelectorAll('select, input')]
        .map((e) => e.getBoundingClientRect())
      const oneRow = bits.length > 1 && bits.every((a) =>
        bits.every((z) => (a.top + a.height / 2) > z.top && (a.top + a.height / 2) < z.bottom))
      const addSel = kc.querySelector('[data-testid="kc-add-contact"]')
      return {
        cols, selW: Math.round(sel.getBoundingClientRect().width), longestStance,
        oneRow, tableW: Math.round(table.getBoundingClientRect().width),
        cardInner: Math.round(card.width),
        addSelW: Math.round(addSel.getBoundingClientRect().width),
        visible: getComputedStyle(kc).visibility === 'visible'
          && card.top < innerHeight && card.bottom > 0,
      }
    })
    console.log(`\n=== ${width}px ===`)
    console.log(`  columns need/got: ${m.cols.map((c) => `${c.need}/${c.got}`).join('  ')}`)
    console.log(`  stance select ${m.selW}px for a longest option of ${m.longestStance}px`)
    console.log(`  table ${m.tableW}px inside a ${m.cardInner}px card`)
    check(m.visible, `the card is in the captured region and visible at ${width}`)
    // K2: SIZED TO THE DATA. A column may not be narrower than what it holds,
    // and may not take a share of the row it does not need. The ceiling is
    // generous chrome, not a number read off the result.
    for (const c of m.cols) {
      check(c.got >= c.need && c.got <= c.need + 40,
        `K2 column ${c.i} is sized to its data at ${width}`, `needs ${c.need}, has ${c.got}`)
    }
    check(m.selW >= m.longestStance && m.selW <= m.longestStance + 60,
      `K2 the stance select is sized to its longest option at ${width}`,
      `${m.selW} against ${m.longestStance}`)
    check(m.addSelW < m.cardInner * 0.4,
      `K2 the add picker does not eat the row at ${width}`,
      `${m.addSelW} of ${m.cardInner}`)
    // AND THE TABLE STOPS TAKING THE WHOLE CARD, which is what `width: 100%`
    // did and what made every column a share rather than a size.
    // AGAINST ITS CONTENT, NOT AGAINST THE CARD. "Less than the card" passed
    // at 1046 of 1076 with `width: 100%` reinstated, which is the defect: the
    // card has padding, so a full-width table is always a little less than it.
    const contentNeed = m.cols.reduce((a, c) => a + c.need, 0) + m.selW + 150 + 60
    check(m.tableW <= contentNeed + 60,
      `K2 the table is sized to its CONTENT, not to the card at ${width}`,
      `${m.tableW} against a content need of about ${contentNeed}, in a ${m.cardInner} card`)
    check(m.oneRow, `K4 the stance controls share ONE row at ${width}`)
    await p.screenshot({ path: `${OUT}k2-k4-${width}.png` })
  }
} finally { await b.close() }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
