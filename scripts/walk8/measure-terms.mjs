// How many columns does `.terms-cards` actually have at each width, and how
// wide is each card? "Spans two columns" is only possible where two exist.
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk8/measure-terms.mjs')
import { readFileSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
const S = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const TAG = 'w8m'
const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
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
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => document.querySelector('.terms-cards'), { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    console.log(`=== ${width} ===`, JSON.stringify(await p.evaluate(() => {
      const g = document.querySelector('.terms-cards')
      const cs = getComputedStyle(g)
      const cards = [...g.children].map((e) => {
        const r = e.getBoundingClientRect()
        return { title: (e.querySelector('.pg-card-title')?.textContent ?? '').trim(),
          l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), t: Math.round(r.top) }
      })
      // COLUMNS COUNTED FROM THE USED TRACK LIST, not inferred from the cards.
      const tracks = cs.gridTemplateColumns.split(' ').filter(Boolean)
      return { gridW: Math.round(g.getBoundingClientRect().width),
        usedTracks: cs.gridTemplateColumns, columns: tracks.length, gap: cs.gap, cards }
    }), null, 1))
  }
} finally { await b.close(); await tearDown([TAG]) }
