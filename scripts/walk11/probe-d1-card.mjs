// D1: DOES THE CONTACTS CARD READ AS ONE OF THE ESTATE'S DATA GRIDS?
//
// ── THE MEASURE ─────────────────────────────────────────────────────────
//
// "Consistent with the estate's data grids" is a comparison, so it is
// measured as one: a reference `<table class="doc-table">` is injected into
// the live document and the card's computed header and cell styles are read
// against IT, never against numbers typed into this file. A literal here
// would be a second reader of the stylesheet and would go stale the day
// somebody retunes `doc-table` (Verification 20).
//
// The reference table is removed before anything is captured, and its removal
// is asserted.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk11/probe-d1-card.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk11/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

// The record with the MOST linked contacts, so the grid is measured with
// rows in it rather than empty.
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
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && !document.querySelector('.wrap.is-loading')
        && v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
    }, { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => document.querySelector('[data-testid="key-contacts"]')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    // ── THE COMPARISON AGAINST A REAL doc-table ─────────────────────────
    const cmp = await p.evaluate(() => {
      const panel = document.querySelector('[data-testid="key-contacts"]')
      const kc = panel.querySelector('table')
      const ref = document.createElement('table')
      ref.className = 'doc-table'
      ref.style.position = 'absolute'; ref.style.visibility = 'hidden'
      ref.innerHTML = '<thead><tr><th>x</th></tr></thead><tbody><tr><td>y</td></tr></tbody>'
      panel.appendChild(ref)
      const PROPS = ['fontFamily', 'fontSize', 'letterSpacing', 'textTransform',
        'color', 'textAlign', 'paddingTop', 'paddingRight', 'paddingBottom',
        'paddingLeft', 'borderBottomWidth', 'borderBottomColor']
      const TD_PROPS = ['fontSize', 'paddingTop', 'paddingRight', 'paddingBottom',
        'paddingLeft', 'verticalAlign', 'borderBottomWidth', 'borderBottomColor']
      const pick = (el, props) => Object.fromEntries(props.map((k) => [k, getComputedStyle(el)[k]]))
      const out = {
        th: { kc: pick(kc.querySelector('thead th'), PROPS), ref: pick(ref.querySelector('th'), PROPS) },
        td: { kc: pick(kc.querySelector('tbody td'), TD_PROPS), ref: pick(ref.querySelector('td'), TD_PROPS) },
      }
      ref.remove()
      out.refRemoved = !panel.querySelector('table.doc-table:not(.kc-table)')
      // Overflow is a RELATIONSHIP between the table and the box holding it.
      const pr = panel.getBoundingClientRect(), tr = kc.getBoundingClientRect()
      out.tableW = Math.round(tr.width); out.panelW = Math.round(pr.width)
      out.overflowPx = Math.round(tr.right - pr.right)
      // The card's own vocabulary and its note.
      const note = panel.querySelector('input[type="text"]')
      out.note = note ? {
        placeholder: note.placeholder, aria: note.getAttribute('aria-label'),
        clipped: note.scrollWidth > note.clientWidth + 1,
        w: Math.round(note.getBoundingClientRect().width),
      } : null
      out.text = panel.innerText
      // ARMED, because the save control is hidden until a stance changes.
      const sel = panel.querySelector('select[data-testid^="kc-stance-"]')
      if (sel && sel.options.length > 1) {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
        setter.call(sel, sel.options[1].value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return out
    })
    // YIELD between the interaction and the read: React re-renders async.
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const armed = await p.evaluate(() => {
      const panel = document.querySelector('[data-testid="key-contacts"]')
      const btn = panel.querySelector('button[data-testid^="kc-record-"]')
      return { label: btn?.textContent.trim() ?? null, shown: btn ? !btn.hidden : false,
        cls: btn?.className ?? null }
    })

    const diffs = []
    for (const k of Object.keys(cmp.th.kc)) {
      if (cmp.th.kc[k] !== cmp.th.ref[k]) diffs.push(`th.${k}: ${cmp.th.kc[k]} vs ${cmp.th.ref[k]}`)
    }
    for (const k of Object.keys(cmp.td.kc)) {
      if (cmp.td.kc[k] !== cmp.td.ref[k]) diffs.push(`td.${k}: ${cmp.td.kc[k]} vs ${cmp.td.ref[k]}`)
    }
    check(cmp.refRemoved, 'the reference table was removed before anything else was read')
    check(diffs.length === 0,
      'the card wears the ESTATE\'s data-grid treatment, compared against a live doc-table',
      diffs.length ? `\n        ${diffs.join('\n        ')}` : `${Object.keys(cmp.th.kc).length + Object.keys(cmp.td.kc).length} properties identical`)
    check(cmp.overflowPx <= 1, 'the grid does not overflow its panel',
      `table ${cmp.tableW}px in panel ${cmp.panelW}px, right edge ${cmp.overflowPx > 0 ? '+' : ''}${cmp.overflowPx}px`)
    check(!!cmp.note?.placeholder, 'the stance note carries a placeholder', `"${cmp.note?.placeholder}"`)
    check(/note/i.test(cmp.note?.aria ?? ''), 'and an accessible name naming it', `"${cmp.note?.aria}"`)
    check(!cmp.note?.clipped, 'and the placeholder is NOT clipped in its box', `${cmp.note?.w}px`)
    check(armed.shown && armed.label === 'Save',
      'the armed save control reads Save', `"${armed.label}" shown=${armed.shown} class="${armed.cls}"`)
    check(!/\bRecord(ed)?\b/i.test(cmp.text),
      'and the word Record appears NOWHERE on the card')

    await p.evaluate(() => document.querySelector('[data-testid="key-contacts"]')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}d1-card-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="key-contacts"]').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0
    })
    check(inView, `the card is inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
