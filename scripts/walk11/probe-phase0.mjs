// WALK 11 PHASE 0: the BEFORE measurement for D1, D2 and D3.
//
// Nothing is asserted as a pass or fail here. This is the before half of the
// before-and-after pair Verification 10 requires, taken at 1440 and 1240, and
// the numbers D2's stop condition will be judged against.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk11/probe-phase0.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk11/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

// THE LUMP-SUM RECORD, because D3's figure is a lump-sum figure. Chosen by
// reading the payload rather than by name, so it cannot silently become a
// per-unit deal underneath the probe.
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
let target = null
for (const o of opps) {
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', o.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  if (!rev) continue
  const p = rev.payload ?? {}
  if (String(p.installResp ?? '').includes('Lump Sum') && Number(p.lumpSumCost) === 200000) {
    target = { ...o, payload: p }; break
  }
}
if (!target) throw new Error('no lump-sum opportunity at cost 200000 found')
console.log(`D3 measured on ${target.reference_code}: lumpSumCost=${target.payload.lumpSumCost}`
  + ` targetMargin=${target.payload.targetMargin}%`
  + ` marginOverrides.inLump=${(target.payload.marginOverrides ?? {}).inLump ?? '(none)'}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), target.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })

    // ── D1, on the REFERENCE tab ────────────────────────────────────────
    const d1 = await p.evaluate(() => {
      const card = document.querySelector('[data-testid="ref-key-contacts"]')
      if (!card) return { absent: true }
      const rows = [...card.querySelectorAll('[data-testid^="kc-row-"]')]
      const first = rows[0]
      const cells = first ? [...first.children].map((c) => ({
        tag: c.tagName, w: Math.round(c.getBoundingClientRect().width),
        x: Math.round(c.getBoundingClientRect().left),
        align: getComputedStyle(c).textAlign,
      })) : []
      const note = card.querySelector('input[type="text"]')
      const btns = [...card.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean)
      const tbl = card.querySelector('table')
      return {
        rows: rows.length,
        display: tbl ? getComputedStyle(tbl).display : '(no table)',
        cells,
        notePlaceholder: note ? (note.placeholder || '(none)') : '(no input)',
        noteLabelled: note ? !!(note.labels?.length || note.getAttribute('aria-label')) : null,
        buttons: btns,
      }
    })
    console.log('  D1 key contacts card:')
    console.log(`     rows ${d1.rows}, table display ${d1.display}`)
    console.log(`     first row cells: ${d1.cells.map((c) => `${c.tag} ${c.w}px@${c.x} ${c.align}`).join(' | ')}`)
    console.log(`     stance note placeholder: "${d1.notePlaceholder}"  labelled: ${d1.noteLabelled}`)
    console.log(`     buttons: ${d1.buttons.join(' / ')}`)

    // ── D2 and D3, on the COMMERCIALS tab ───────────────────────────────
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => {
      const el = document.querySelector('.terms-cards')
      return el && el.getBoundingClientRect().width > 0
    }, { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const d2 = await p.evaluate(() => {
      const grid = document.querySelector('.terms-cards')
      const cs = getComputedStyle(grid)
      const cards = [...grid.children].map((c) => {
        const r = c.getBoundingClientRect()
        const s = getComputedStyle(c)
        return {
          title: c.querySelector('.pg-card-title')?.textContent.trim() ?? '?',
          w: Math.round(r.width), x: Math.round(r.left), top: Math.round(r.top),
          usable: Math.round(r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
            - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth)),
          gridColumn: s.gridColumn,
        }
      })
      const pair = grid.querySelector('.terms-wht-pair')
      const items = pair ? [...pair.children].map((c) => {
        const r = c.getBoundingClientRect()
        return {
          label: (c.querySelector('label')?.textContent ?? c.textContent).trim().slice(0, 28),
          w: Math.round(r.width), top: Math.round(r.top),
        }
      }) : []
      const gap = pair ? parseFloat(getComputedStyle(pair).gap) || 0 : 0
      const sum = items.reduce((s, i) => s + i.w, 0) + gap * Math.max(0, items.length - 1)
      const tops = new Set(items.map((i) => i.top))
      return {
        cols: cs.gridTemplateColumns, gridW: Math.round(grid.getBoundingClientRect().width),
        colCount: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
        cards, items, gap, sum, rowsUsed: tops.size,
        pairW: pair ? Math.round(pair.getBoundingClientRect().width) : null,
      }
    })
    console.log('  D2 terms cards:')
    console.log(`     grid ${d2.gridW}px, template "${d2.cols}" -> ${d2.colCount} column(s)`)
    for (const c of d2.cards) {
      console.log(`     ${c.title.padEnd(20)} ${String(c.w).padStart(4)}px @x${String(c.x).padStart(4)}`
        + ` top${String(c.top).padStart(5)}  usable ${c.usable}px  grid-column ${c.gridColumn}`)
    }
    console.log(`     WHT pair items: ${d2.items.map((i) => `${i.label} ${i.w}px`).join(' | ')}`)
    console.log(`     sum incl ${d2.gap}px gaps = ${d2.sum}px   pair box ${d2.pairW}px`
      + `   ROWS USED: ${d2.rowsUsed}${d2.rowsUsed > 1 ? '  <- WRAPPED' : ''}`)

    const d3 = await p.evaluate(() => {
      const open = document.querySelector('[data-testid="btn-toggle-detail"]')
      if (open && open.getAttribute('aria-expanded') !== 'true') open.click()
      return new Promise((r) => requestAnimationFrame(() => {
        const cards = [...document.querySelectorAll('#deal-detail-panel .pg-card')].map((c) => ({
          title: c.querySelector('.pg-card-title')?.textContent.trim(),
          rows: [...c.querySelectorAll('.pg-row:not(.pg-total)')].map((x) =>
            x.querySelector('.pg-item-name')?.textContent.trim()),
          hasMarginInput: c.querySelectorAll('.pg-margin-input').length,
        }))
        const signpost = document.querySelector('[data-testid="deal-detail-signpost"]')
        r({
          cards,
          signpostHidden: signpost ? signpost.classList.contains('hidden') : null,
          installTablePresent: !!document.querySelector('#deal-install-table:not(.hidden)'),
          lumpGroupPresent: !!document.querySelector('#deal-contractor-group:not(.hidden)'),
          installTotalPrice: document.querySelector('[data-testid="deal-install-total-price"]')?.textContent.trim() ?? null,
        })
      }))
    })
    console.log('  D3 pricing cards:')
    for (const c of d3.cards) {
      console.log(`     ${String(c.title).padEnd(24)} rows: ${c.rows.join(', ')}`)
      console.log(`     ${''.padEnd(24)} margin inputs: ${c.hasMarginInput}`)
    }
    console.log(`     install table shown: ${d3.installTablePresent}   lump group shown: ${d3.lumpGroupPresent}`)
    console.log(`     signpost hidden: ${d3.signpostHidden}   install total price on screen: ${d3.installTotalPrice}`)

    await p.evaluate(() => document.querySelector('.terms-cards')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.screenshot({ path: `${OUT}p0-terms-${width}.png` })
  }
} finally { await b.close() }
console.log(`\nscreenshots in ${OUT}`)
