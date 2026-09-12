// LEADS CARD POLISH, Phase 0: measurement only. Nothing is changed.
//
// The follow-up panel is NOT measured (R7, frozen) and Lead Detail is not
// opened at all.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-polish.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/leads-polish/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p0pol'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const say = (h) => console.log(`\n${h}`)

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER.user.id, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: r.id, revision_number: 1,
    payload: { name: `${TAG} ${label}`, ...payload }, created_by: OWNER.user.id,
  }).select().single(), `rev ${label}`)
  return r
}
// A LEAN card and a BUSY one. The last phase measured height on a card with
// no notes and no follow-up and flagged the busy case as unmeasured; a height
// claim taken on the emptiest possible card is the one-width fault again, in
// the content dimension.
const lean = await mk('Lean', { company: 'Polish Co', source: 'Referral', summary: 'short' })
const busy = await mk('Busy', {
  company: 'Polish Co', source: 'Referral',
  summary: 'A long summary that runs to a couple of lines so the card carries '
    + 'realistic content rather than the emptiest possible case.',
  address: '1 Polish Way', city: 'Singapore', postcode: '069118',
  country: 'Singapore', region: 'APAC',
  notes: Array.from({ length: 10 }, (_, i) => ({
    text: `Note ${i + 1}: a realistic line of history on this lead.`,
    at: new Date(Date.now() - i * 86400000).toISOString(), by: OWNER.user.email,
  })),
})
const created = [lean.id, busy.id]

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=3440,1400'] })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async (w) => {
    await page.setViewport({ width: w, height: 1100 })
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((id, width) => {
      const c = document.querySelector(`[data-testid="lead-card-${id}"]`)
      return c && c.getBoundingClientRect().height > 0 && window.innerWidth === width
    }, { timeout: 20000 }, lean.id, w)
  }

  // ── 1. R1: WHAT THE COMPLETION POPUP OFFERS ───────────────────────────
  say('1. THE QUALIFY COMPLETION FLOW TODAY (R1)')
  await go(1920)
  await page.click(`[data-testid="lead-qualify-${lean.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${lean.id}"]`, { timeout: 15000 })
  const popup = await page.evaluate((id) => {
    const box = document.querySelector(`[data-testid="lead-incomplete-${id}"]`)
    return {
      text: box.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
      lines: [...box.querySelectorAll('li')].map((li) => li.textContent.trim()),
      inputs: box.querySelectorAll('input, select, textarea').length,
      buttons: [...box.querySelectorAll('button')].map((b) => b.textContent.trim()),
    }
  }, lean.id)
  const server = await api('GET', `/records/${lean.id}/exit-criteria`)
  const serverList = (server.data.blocking ?? []).map((b) => b.message ?? b.field)
  console.log(`  the popup lists ${popup.lines.length} missing fields; the server says ${serverList.length}`)
  console.log(`  lists match: ${popup.lines.length === serverList.length
    && popup.lines.every((l) => serverList.includes(l))}`)
  console.log(`  INPUTS FOR ENTRY inside the popup: ${popup.inputs}   <- R1 wants all of them here`)
  console.log(`  buttons in the popup: ${JSON.stringify(popup.buttons)}`)
  console.log(`  message: "${popup.text.slice(0, 90)}..."`)
  const addressInList = popup.lines.filter((l) => /address|city|postcode|country|region/i.test(l))
  console.log(`  address-group fields named in the popup: ${addressInList.length}`)
  console.log(`  ...and the popup offers no way to enter them, so finishing means`)
  console.log(`     leaving it. THAT IS R1'S DEFECT, reproduced.`)
  await page.screenshot({ path: `${OUT}p0-popup-today.png` })
  await page.click(`[data-testid="lead-incomplete-close-${lean.id}"]`)

  // ── 2. ADDRESS TODAY ──────────────────────────────────────────────────
  say('2. ADDRESS TODAY (R2)')
  await page.click(`[data-testid="lead-address-${busy.id}"]`)
  await page.waitForSelector(`#lead-address-panel-${busy.id}`, { timeout: 10000 })
  const addr = await page.evaluate((id) => {
    const p = document.getElementById(`lead-address-panel-${id}`)
    return {
      cells: p.querySelectorAll('.lead-address-cell').length,
      controls: p.querySelectorAll('input, select, textarea, button').length,
      height: Math.round(p.getBoundingClientRect().height),
      inline: true,
    }
  }, busy.id)
  console.log(`  the disclosure is INLINE in the card: ${addr.cells} cells, ${addr.controls} controls, ${addr.height}px tall`)
  console.log(`  R2 wants a POPUP and EDITABLE, so: a new surface, and the door must reach its writes`)

  // ── 3. CARD HEIGHT COMPOSITION ────────────────────────────────────────
  say('3. CARD HEIGHT, LEAN AND BUSY, AT THREE WIDTHS (R3)')
  for (const w of [1240, 1920, 3440]) {
    await go(w)
    const h = await page.evaluate((leanId, busyId) => {
      const parts = (id) => {
        const c = document.querySelector(`[data-testid="lead-card-${id}"]`)
        const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
        return {
          total: px(c),
          head: px(c.querySelector('.lead-card-head')),
          actions: px(c.querySelector('.lead-card-actions')),
          body: px(c.querySelector('.lead-card-body')),
          summary: px(c.querySelector('.lead-card-col')),
          padding: getComputedStyle(c).padding,
        }
      }
      return { lean: parts(leanId), busy: parts(busyId) }
    }, lean.id, busy.id)
    console.log(`  ${w}px  LEAN total ${h.lean.total}px = head ${h.lean.head} + actions ${h.lean.actions} + body ${h.lean.body}  (padding ${h.lean.padding})`)
    console.log(`         BUSY total ${h.busy.total}px = head ${h.busy.head} + actions ${h.busy.actions} + body ${h.busy.body}`)
    const perScreen = Math.floor(1100 / h.lean.total)
    console.log(`         lean cards fitting a 1100px viewport: ${perScreen}`)
    await page.screenshot({ path: `${OUT}p0-height-${w}.png` })
  }

  // ── 4 and 5. SUMMARY AND LAYOUT DELTAS ────────────────────────────────
  say('4/5. SUMMARY AND LAYOUT (R4, R5)')
  await go(1920)
  const layout = await page.evaluate((id) => {
    const c = document.querySelector(`[data-testid="lead-card-${id}"]`)
    const sum = c.querySelector('[data-testid^="lead-summary-"]')
    const head = c.querySelector('.lead-card-head')
    const sub = head.querySelector('.lead-card-sub')
    const actionRow = c.querySelector('.lead-action-row')
    const notes = c.querySelector('[data-testid^="lead-notes-"]')
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width) } }
    return {
      summaryControls: sum.querySelectorAll('input, textarea, button').length,
      summaryTag: sum.querySelector('.lead-card-summary-body')?.tagName,
      actionsOwnRow: Math.abs(r(actionRow).t - r(head).t) > 10,
      subEnd: Math.round(sub.getBoundingClientRect().right),
      notesLeft: r(notes).l,
      cardLeft: r(c).l,
    }
  }, busy.id)
  console.log(`  Summary renders as <${layout.summaryTag}> with ${layout.summaryControls} controls -> R4 needs an editor`)
  console.log(`  the action row is on its OWN row below the head: ${layout.actionsOwnRow}  -> R5 wants it on the top line, middle`)
  console.log(`  Created Date ends at x=${layout.subEnd}; Notes column starts at x=${layout.notesLeft}  -> R5 wants these aligned`)

  // ── 6. THE NEW LEAD GRID ──────────────────────────────────────────────
  say('6. THE NEW LEAD GRID FIELD SET (R6)')
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="nlg-th-name"]', { visible: true })
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="nlg-industry_id-0"]')?.options.length ?? 0) > 1)
  const cols = await page.$$eval('[data-testid^="nlg-th-"]',
    (th) => th.map((x) => x.getAttribute('data-testid').replace('nlg-th-', '')))
  const req = await api('GET', '/contacts/creation-requirements')
  console.log(`  grid columns (${cols.length}): ${cols.join(', ')}`)
  console.log(`  server requires (${req.data.required.length}): ${req.data.required.join(', ')}`)
  await page.screenshot({ path: `${OUT}p0-grid.png` })
} finally {
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  console.log(`\n  soft deleted ${created.length}`)
  await browser.close()
}
