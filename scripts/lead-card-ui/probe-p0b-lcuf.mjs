// LEAD CARD UI FIXES, Phase 0 second pass. Read-only, and the DOM experiments
// below are MEASUREMENTS rather than changes: nothing is written to source.
//
// Three questions the first pass raised:
//   R5a  is the band John saw at the bottom of the CARD, or below the LIST?
//   R4/R5 what does "No notes yet." actually cost the card, measured by
//        removing it in the live DOM rather than computed from the stylesheet?
//   R1   what does the spray look like at its widest, 6 of 6 accounts?
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0b-lcuf.mjs')
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
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER.user.id, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
    payload: { name: `lcuf0b ${label}`, company: 'UI Fixes Co', source: 'Referral', ...payload },
    created_by: OWNER.user.id }).select().single(), `rev ${label}`)
  return r
}
// One fixture per claim, per Verification 7.
const lean = await mk('Lean', { summary: 'One line.' })
const picker = await mk('Picker', {
  jobRole: 'Head of Ops', email: 'lcuf0b@example.invalid', mobile: '+65 9000 0178',
  linkedin: 'https://example.invalid/in/x', address: '1 Way', city: 'Singapore',
  postcode: '069118', country: 'Singapore', region: 'APAC', summary: 'Ready.' })
const created = [lean.id, picker.id]

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const gotoLeads = async (id) => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, id)
  }

  console.log('\nR5a. WHOSE band is it: the card, the list, or the view?')
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 900 })
    await gotoLeads(lean.id)
    const m = await page.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
        return { top: b.top, bottom: b.bottom, h: b.height } }
      const cards = [...document.querySelectorAll('[data-testid^="lead-card-"]')]
      const last = cards[cards.length - 1]
      // The scrolling container the list lives in, found by walking up.
      let sc = last?.parentElement
      while (sc && sc.scrollHeight <= sc.clientHeight + 1 && sc !== document.body) sc = sc.parentElement
      return {
        cards: cards.length,
        lastCard: r(last),
        listWrap: r(last?.closest('[class*="lead-group"], [class*="leads"]') ?? last?.parentElement),
        scroller: sc ? { tag: sc.tagName, cls: sc.className, sh: sc.scrollHeight, ch: sc.clientHeight } : null,
        viewportH: window.innerHeight,
        docH: document.documentElement.scrollHeight,
      }
    })
    const belowLast = m.listWrap && m.lastCard ? m.listWrap.bottom - m.lastCard.bottom : null
    console.log(`  ${w}px  ${m.cards} cards   below the LAST card, inside its wrapper: ${px(belowLast)}`)
    console.log(`         viewport ${px(m.viewportH)}  document ${px(m.docH)}  scroller ${m.scroller ? `${m.scroller.cls || m.scroller.tag} ${m.scroller.sh}/${m.scroller.ch}` : 'none'}`)
  }

  console.log('\nR4/R5. What "No notes yet." costs, measured by removing it live')
  // AT ALL THREE WIDTHS, because R5's answer DIFFERS by width: at 1240 the
  // frozen follow-up column is the driver and R5 says leave it, and at 1920
  // and 3440 it is not. Measuring only the middle width would have answered
  // the wrong question at both ends.
  for (const W of [1240, 1920, 3440]) {
  await page.setViewport({ width: W, height: 1000 })
  // A FULL RELOAD PER WIDTH. The first version of this loop removed the node
  // at 1240 and then measured 1920 and 3440 against a tree the removal had
  // already been applied to - `navigate('leads')` re-renders, it does not
  // remount, so the node stayed gone. Both later widths read `removed: false`
  // and a delta of zero, which is Verification 7's fixture-consumed-by-an-
  // earlier-claim arriving inside one probe's own loop.
  await page.reload({ waitUntil: 'networkidle0' })
  await gotoLeads(lean.id)
  const cols = async (x) => page.evaluate((id) => {
    const h = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().height : null }
    return {
      card: h(`[data-testid="lead-card-${id}"]`),
      Summary: h(`[data-testid="lead-summary-${id}"]`),
      Notes: h(`[data-testid="lead-notes-${id}"]`),
      Follow: h(`[data-testid="lead-followup-${id}"]`),
      notesContent: (() => {
        const col = document.querySelector(`[data-testid="lead-notes-${id}"]`)
        if (!col) return null
        let max = col.getBoundingClientRect().top
        for (const e of col.querySelectorAll('*')) { const b = e.getBoundingClientRect()
          if (b.height > 0 && b.bottom > max) max = b.bottom }
        return max - col.getBoundingClientRect().top
      })(),
    }
  }, x)
  const before = await cols(lean.id)
  console.log(`  ${W}px WITH    card ${px(before.card)}  Notes content ${px(before.notesContent)}  Summary ${px(before.Summary)}  Follow-up ${px(before.Follow)}`)
  await page.screenshot({ path: `${OUT}lcuf-p0b-with-empty-${W}.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height } }, lean.id) })
  // The experiment: remove the node, nothing else. A layout read follows.
  const removed = await page.evaluate((x) => {
    const e = document.querySelector(`[data-testid="lead-notes-${x}"] [data-testid="cd-notes-empty"]`)
    if (!e) return false
    e.remove(); return true
  }, lean.id)
  const after = await cols(lean.id)
  const drivers = { Summary: after.Summary, Notes: after.notesContent, 'Follow-up': after.Follow }
  const driver = Object.keys(drivers).reduce((a, b) => (drivers[a] >= drivers[b] ? a : b))
  console.log(`  ${W}px WITHOUT card ${px(after.card)}  Notes content ${px(after.notesContent)}   removed: ${removed}`)
  if (!removed) { console.error(`  ${W}px READING VOID: the node was not present to remove`); process.exitCode = 3 }
  console.log(`  ${W}px DELTA ${px(before.card - after.card)} per card   NEW DRIVER: ${driver} at ${px(drivers[driver])}`)
  await page.screenshot({ path: `${OUT}lcuf-p0b-without-empty-${W}.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height } }, lean.id) })
  }

  console.log('\nR1. The spray at its widest: a query matching every account')
  await gotoLeads(picker.id)
  await page.click(`[data-testid="lead-qualify-${picker.id}"]`)
  await page.waitForSelector(`[data-testid="lead-account-step-${picker.id}"]`, { timeout: 15000 })
  const sel = `[data-testid="lead-account-step-${picker.id}"] [data-testid="cd-link-search"]`
  for (const q of ['a', 'e']) {
    // SELECT-ALL BY KEYBOARD, not triple-click. Triple-click does not select
    // in this input: the first version of this loop APPENDED, so it read
    // `input="eo"` and reported 0 matches - which looked exactly like a
    // picker that does not re-filter. probe-p0c-lcuf.mjs diagnosed it by
    // reading the input's value back beside the count, which is Verification
    // 14's remedy: the failure detail carries the cause's own answer.
    await page.click(sel)
    await page.keyboard.down('Meta'); await page.keyboard.press('KeyA'); await page.keyboard.up('Meta')
    await page.keyboard.press('Backspace')
    await page.keyboard.type(q)
    await new Promise((r) => setTimeout(r, 400))
    const s = await page.evaluate((x) => {
      const step = document.querySelector(`[data-testid="lead-account-step-${x}"]`)
      const res = step.querySelector('[data-testid="cd-link-results"]')
      const boxes = [...res.querySelectorAll('button')].filter((b) => b.dataset.testid !== 'cd-link-create')
      return { value: step.querySelector('[data-testid="cd-link-search"]').value,
        n: boxes.length, rows: new Set(boxes.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        resH: res.getBoundingClientRect().height, stepH: step.getBoundingClientRect().height,
        labels: boxes.map((b) => b.textContent.trim()) }
    }, picker.id)
    console.log(`  input="${s.value}" -> ${s.n} boxes over ${s.rows} row(s), results ${px(s.resH)}, step ${px(s.stepH)}   ${JSON.stringify(s.labels)}`)
    if (s.value !== q) { console.error(`  READING VOID: meant to type "${q}", the box holds "${s.value}"`); process.exitCode = 3 }
  }
  await page.screenshot({ path: `${OUT}lcuf-p0b-spray-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, 800) } }, picker.id) })
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
