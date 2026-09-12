// PHASE 0, FOURTH PASS: a finding the screenshot produced and no assertion
// asked for. Verification 4 exactly - the first pass READ the notes' `when`
// text successfully via textContent, so every programmatic check passed,
// and the capture shows the note rows are not inside the card's Notes
// column at all. This measures where they actually are.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0d-lcuf.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcuf/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const px = (n) => (n === null || n === undefined ? '--' : `${Math.round(n)}px`)
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const NOTE = (t, at) => ({ text: t, at, by: 'john+test@terminustechnologies.io' })
const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
  payload: { name: 'lcuf0d Overflow', company: 'UI Fixes Co', source: 'Referral',
    summary: 'A summary.',
    notes: [NOTE('Third note, most recent.', '2026-09-12T06:14:09.321Z'),
            NOTE('Second note.', '2026-09-11T22:02:41.000Z'),
            NOTE('First note.', '2026-09-10T01:45:00.000Z')] },
  created_by: OWNER.user.id }).select().single(), 'rev')

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  for (const W of [1240, 1920, 3440]) {
    await page.setViewport({ width: W, height: 1000 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, r.id)
    const m = await page.evaluate((x) => {
      const col = document.querySelector(`[data-testid="lead-notes-${x}"]`)
      const list = col.querySelector('.cd-notes-list')
      const rows = [...col.querySelectorAll('.ref-notes-row')]
      const b = (e) => { const q = e.getBoundingClientRect()
        return { left: q.left, right: q.right, top: q.top, bottom: q.bottom, w: q.width, h: q.height } }
      const cs = rows[0] ? getComputedStyle(rows[0]) : null
      return {
        col: b(col), list: b(list),
        rowCount: rows.length,
        row0: rows[0] ? b(rows[0]) : null,
        rowDisplay: cs?.display, rowCols: cs?.gridTemplateColumns,
        when0: rows[0] ? b(rows[0].querySelector('.ref-notes-when')) : null,
        text0: rows[0] ? b(rows[0].querySelector('.ref-notes-text')) : null,
        listOverflowX: list ? getComputedStyle(list).overflowX : null,
        // Is any part of row 0 outside its own column?
        escapes: rows[0] ? rows[0].getBoundingClientRect().right > col.getBoundingClientRect().right + 1 : null,
      }
    }, r.id)
    console.log(`\n  ${W}px  Notes column  left ${px(m.col.left)} right ${px(m.col.right)}  w ${px(m.col.w)}`)
    console.log(`        .cd-notes-list  left ${px(m.list.left)} right ${px(m.list.right)}  w ${px(m.list.w)}  overflow-x ${m.listOverflowX}`)
    console.log(`        ${m.rowCount} .ref-notes-row rendered;  row 0  left ${px(m.row0?.left)} right ${px(m.row0?.right)}  w ${px(m.row0?.w)}  h ${px(m.row0?.h)}`)
    console.log(`        row display ${m.rowDisplay}   grid-template-columns ${m.rowCols}`)
    console.log(`        .ref-notes-when  left ${px(m.when0?.left)} right ${px(m.when0?.right)} w ${px(m.when0?.w)}`)
    console.log(`        .ref-notes-text  left ${px(m.text0?.left)} right ${px(m.text0?.right)} w ${px(m.text0?.w)}`)
    console.log(`        ROW ESCAPES ITS COLUMN: ${m.escapes}   by ${px((m.row0?.right ?? 0) - m.col.right)}`)
  }
  await page.setViewport({ width: 1920, height: 1000 })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`), { timeout: 25000 }, r.id)
  await page.screenshot({ path: `${OUT}lcuf-p0d-overflow-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1900), height: b.height } }, r.id) })
} finally {
  await browser.close()
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
  const live = must(await db.from('records').select('id').eq('id', r.id).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: 1 soft-deleted, ${live.length} still live`)
}
