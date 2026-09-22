// K1: CAN THE CUSTOMER DETAILS COLUMN HOLD THE CARD?
//
// Measured on the LIVE record with four real contacts, because walk 7 proved
// the fixture is the wrong population: short fixture names gave a 633px floor
// and said FITS at 1440, while the real records hold "Wong Guang Shing" and
// the floor is 664px.
//
// THE FLOOR IS COUNTED IN LINE BOXES, not heights and not overflow. Walk 7
// recorded why: a table COMPRESSES rather than overflowing, so scrollWidth
// says "fits" at any width; and the row height is set by the stance select,
// which is taller than two lines of text, so a wrapped name does not change
// it. A Range over a cell returns one client rect PER LINE.
//
// AND IT WAITS FOR FONTS. A wrap floor is a text measurement: the same
// content read 598px then 664px across two runs until `document.fonts.ready`
// was awaited.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk9/probe-k1-fit.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk9/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

// The richest live record, chosen by measurement rather than named.
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const links = must(await db.from('record_contacts').select('record_id')
  .in('record_id', opps.map((o) => o.id)), 'links')
const counts = {}
for (const l of links) counts[l.record_id] = (counts[l.record_id] ?? 0) + 1
const richest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
const rec = opps.find((o) => o.id === richest[0])
console.log(`measured on ${rec.reference_code}, ${richest[1]} linked contacts\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && !document.querySelector('.wrap.is-loading')
        && v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    console.log(`=== ${width}px ===`, JSON.stringify(await p.evaluate(() => {
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const cust = document.querySelector('[data-testid="ref-customer"]')
      const ccs = getComputedStyle(cust)
      const cb = cust.getBoundingClientRect()
      // WHAT THE TARGET COLUMN CAN ACTUALLY GIVE: the card's inner width,
      // which is what a nested card would have to live in.
      const columnInner = Math.round(cb.width
        - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight))

      const wrapsAt = (w) => {
        const c = kc.cloneNode(true)
        c.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}`
        document.body.appendChild(c)
        let n = 0
        for (const td of c.querySelectorAll('td, th')) {
          if (!td.textContent.trim() || td.querySelector('select, input, button')) continue
          const r = document.createRange(); r.selectNodeContents(td)
          if (r.getClientRects().length > 1) n++
        }
        c.remove(); return n
      }
      const wide = wrapsAt('1200px')
      let lo = 160, hi = 1200
      while (hi - lo > 4) {
        const mid = Math.floor((lo + hi) / 2)
        if (wrapsAt(`${mid}px`) > wide) lo = mid; else hi = mid
      }
      // K2's raw material: each column's width against what it holds.
      const head = [...kc.querySelectorAll('th')].map((e) => e.textContent.trim())
      const firstRow = kc.querySelector('tbody tr')
      const cells = [...firstRow.querySelectorAll('td')].map((td, i) => ({
        col: head[i] ?? '(x)',
        w: Math.round(td.getBoundingClientRect().width),
        controls: [...td.querySelectorAll('select, input, button')].map((e) => ({
          tag: e.tagName.toLowerCase(), w: Math.round(e.getBoundingClientRect().width),
          top: Math.round(e.getBoundingClientRect().top),
        })),
      }))
      // K4: does the stance cell render on ONE row? A shared line is a shared
      // vertical centre, not equal tops.
      const stanceTd = firstRow.querySelectorAll('td')[2]
      const bits = [...stanceTd.querySelectorAll('select, input, button')]
        .filter((e) => !e.hidden).map((e) => e.getBoundingClientRect())
      const stanceOneRow = bits.length > 1
        && bits.every((a) => bits.every((z) => (a.top + a.height / 2) > z.top && (a.top + a.height / 2) < z.bottom))
      // ── THE IRREDUCIBLE MINIMUM, which is what K1's stop must rest on ───
      //
      // The floor above is the floor of the card AS IT STANDS. K2 sizes every
      // field to its data and K4 puts Stance on one row, so stopping on that
      // number would be stopping on a floor this round is about to change.
      //
      // This measures what each column NEEDS at its own content width: the
      // widest text in it, and for the stance cell the three controls sized to
      // what they hold, laid on ONE row as K4 asks. That is the narrowest the
      // card can honestly be made.
      const probe = document.createElement('span')
      const tdCs = getComputedStyle(kc.querySelector('tbody td'))
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${tdCs.font}`
      document.body.appendChild(probe)
      const textW = (s) => { probe.textContent = s; return Math.ceil(probe.getBoundingClientRect().width) }
      const colMax = (idx) => Math.max(...[...kc.querySelectorAll('tbody tr')].map((tr) => {
        const td = tr.querySelectorAll('td')[idx]
        return textW((td?.textContent ?? '').trim())
      }), textW((kc.querySelectorAll('th')[idx]?.textContent ?? '').trim()))
      // The stance controls at their own content width, on one row.
      const sel = firstRow.querySelectorAll('td')[2].querySelector('select')
      const longestStance = Math.max(...[...(sel?.options ?? [])].map((o) => textW(o.text)), 0)
      const PAD = 8, CHROME = 34   // a select's arrow and an input's padding
      const need = {
        contact: colMax(0) + PAD,
        role: colMax(1) + PAD,
        // K4: select + note + Record, side by side and each sized to its data.
        stance: (longestStance + CHROME) + 6 + 140 + 6 + 58 + PAD,
        linked: colMax(3) + PAD,
        x: 25,
      }
      // THE MEASURING SPAN IS REMOVED ONLY ONCE IT HAS BEEN USED. It was
      // detached before `need` was computed, so every column measured 0 and
      // the minimum came back as the padding alone - a confident 368px that
      // was pure arithmetic on nothing.
      probe.remove()
      const minimum = Math.round(Object.values(need).reduce((a, n) => a + n, 0))
      return { cardWidth: Math.round(kc.getBoundingClientRect().width),
        customerColumnInner: columnInner, floor: hi, cells, stanceOneRow,
        fitsInColumn: hi <= columnInner,
        need, irreducibleMinimum: minimum,
        minimumFitsInColumn: minimum <= columnInner }
    }), null, 1))
    await p.screenshot({ path: `${OUT}k1-baseline-${width}.png` })
  }
} finally { await b.close() }
