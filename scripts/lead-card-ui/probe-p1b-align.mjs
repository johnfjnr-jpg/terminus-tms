// R3's 9px, measured rather than guessed. Every box between the column's top
// and its first field, on both columns, so the residual has a named owner.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1b-align.mjs')
import { readFileSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
  payload: { name: 'lcuf1b Align', company: 'UI Fixes Co', source: 'Referral',
    summary: 'A summary.', notes: [{ text: 'n', at: '2026-09-12T06:14:09.321Z', by: 'x' }] },
  created_by: OWNER.user.id }).select().single(), 'rev')
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`), { timeout: 25000 }, r.id)
  await page.click(`[data-testid="lead-notes-${r.id}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${r.id}"] [data-testid="cd-new-note-input"]`, { timeout: 10000 })
  const m = await page.evaluate((x) => {
    const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const c = getComputedStyle(e)
      return { top: Math.round(b.top), h: Math.round(b.height), mt: c.marginTop, mb: c.marginBottom,
        pt: c.paddingTop, minH: c.minHeight, tag: e.tagName.toLowerCase(), cls: e.className } }
    const sCol = document.querySelector(`[data-testid="lead-summary-${x}"]`)
    const nCol = document.querySelector(`[data-testid="lead-notes-${x}"]`)
    return {
      summary: { col: box(sCol), head: box(sCol.querySelector('.card-col-head')),
        title: box(sCol.querySelector('.lead-card-col-title')),
        wrap: box(sCol.querySelector('.lead-summary-edit')),
        field: box(sCol.querySelector(`[data-testid="lead-summary-input-${x}"]`)) },
      notes: { col: box(nCol), head: box(nCol.querySelector('.cd-notes-header-row')),
        title: box(nCol.querySelector('[data-testid="cd-notes-title"]')),
        wrap: box(nCol.querySelector('.cd-note-input-wrap')),
        field: box(nCol.querySelector('[data-testid="cd-new-note-input"]')) },
    }
  }, r.id)
  for (const side of ['summary', 'notes']) {
    console.log(`\n${side.toUpperCase()}`)
    for (const k of ['col', 'head', 'title', 'wrap', 'field']) {
      const b = m[side][k]
      console.log(`  ${k.padEnd(6)} ${b ? `top ${String(b.top).padStart(4)}  h ${String(b.h).padStart(3)}  mt ${b.mt} mb ${b.mb} pt ${b.pt} minH ${b.minH}  ${b.cls}` : '(absent)'}`)
    }
  }
  const s = m.summary, n = m.notes
  console.log(`\n  head heights: summary ${s.head?.h} vs notes ${n.head?.h}   difference ${(n.head?.h ?? 0) - (s.head?.h ?? 0)}px`)
  console.log(`  wrap top offset from head bottom: summary ${(s.wrap?.top ?? 0) - ((s.head?.top ?? 0) + (s.head?.h ?? 0))}  notes ${(n.wrap?.top ?? 0) - ((n.head?.top ?? 0) + (n.head?.h ?? 0))}`)
  console.log(`  field top: summary ${s.field?.top}  notes ${n.field?.top}   DELTA ${(n.field?.top ?? 0) - (s.field?.top ?? 0)}px`)
} finally {
  await browser.close()
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
  console.log(`\nteardown: 1 soft-deleted`)
}
