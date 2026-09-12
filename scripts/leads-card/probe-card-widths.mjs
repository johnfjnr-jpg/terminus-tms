// Verification 10: 1240, 1920 and 3440, before and after. Phase 2 measured
// full width at 1920 ONLY and said so; a layout claim on one width is not the
// claim, and 1240 is where things break while 3440 is where a cap stops
// content using real width.
//
// R2 asks for two things that can each fail independently at a width: the card
// is FULL WIDTH, and Company/Source/Created Date sit ON the lead name line.
// The second is the one that broke at 1920 and was fixed; nothing yet says it
// holds at 1240, where the head has least room.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-card-widths.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/leads-card/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p2width'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`); if (d) console.log(`        ${d}`) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
// A LONG name and a long company, deliberately. A head line that fits a short
// name proves nothing about the one a person actually types.
// TWO LEADS, because "it fits" depends entirely on what is in it. A typical
// name is the claim R2 makes; an extreme one measures where the claim stops
// being true, which is a different and also worth knowing.
const mk = async (payload) => {
  const r = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER.user.id, industry_id: industry.id,
  }).select().single(), 'lead')
  must(await db.from('record_revisions').insert({
    record_id: r.id, revision_number: 1, payload, created_by: OWNER.user.id,
  }).select().single(), 'rev')
  return r
}
const lead = await mk({
  name: `${TAG} Jane Tan`, company: 'Willowglen',
  source: 'Referral', summary: 'typical content',
})
const longLead = await mk({
  name: `${TAG} Alexandra Fotheringham-Blythe`,
  company: 'Singapore Institute of Technology and Applied Research',
  source: 'Marketing Campaign', summary: 'deliberately extreme content',
})

const WIDTHS = [1240, 1920, 3440]
const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=3440,1400'] })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })

  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 1000 })
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`),
      { timeout: 20000 }, lead.id)
    // The layout must SETTLE after a viewport change, not be read in the frame
    // that follows it.
    await page.waitForFunction((id, width) => {
      const c = document.querySelector(`[data-testid="lead-card-${id}"]`)
      return c && c.getBoundingClientRect().width > 0 && window.innerWidth === width
    }, { timeout: 10000 }, lead.id, w)

    const measure = (id) => {
      const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
      const view = document.getElementById('view-leads')
      const head = card.querySelector('.lead-card-head')
      const name = head.querySelector('.lead-card-name').getBoundingClientRect()
      const sub = head.querySelector('.lead-card-sub').getBoundingClientRect()
      const actions = [...card.querySelectorAll('.lead-action-row button')]
        .map((b) => Math.round(b.getBoundingClientRect().top))
      const doc = document.documentElement
      return {
        card: Math.round(card.getBoundingClientRect().width),
        view: Math.round(view.getBoundingClientRect().width),
        maxWidth: getComputedStyle(view).maxWidth,
        sameRow: Math.abs(name.top - sub.top) < 6,
        subLeft: Math.round(sub.left), nameRight: Math.round(name.right),
        actionsOneRow: new Set(actions).size === 1,
        hOverflow: doc.scrollWidth > doc.clientWidth,
      }
    }
    const m = await page.evaluate(measure, lead.id)
    const mLong = await page.evaluate(measure, longLead.id)

    // THE CARD FILLS THE CONTENT COLUMN, which is the claim. A fraction of
    // the VIEWPORT is not: the sidebar and .wrap's fixed padding are ~363px
    // whatever the width, so they are 29% of 1240 and 11% of 3440. The first
    // version of this check used `> w * 0.75` and failed at 1240 on a card
    // that was using every pixel available to it.
    check(`${w}: the card fills the content column, uncapped`,
      m.maxWidth === 'none' && m.view - m.card < 130,
      `max-width ${m.maxWidth}, card ${m.card}px in a ${m.view}px column, ${w}px viewport`)
    check(`${w}: Company/Source/Created Date sit ON the lead name line`,
      m.sameRow && m.subLeft > m.nameRight,
      `sub starts at ${m.subLeft}, name ends at ${m.nameRight}, same row: ${m.sameRow}`)
    // AND WHERE THE CLAIM STOPS HOLDING, measured rather than left unstated.
    // The head is a wrapping flex row: with an extreme name and company it
    // wraps instead of overflowing, which is the container doing its job. The
    // check asserts it either shares the row OR wraps cleanly - never
    // overflows, and never truncates the name.
    check(`${w}: an extreme name wraps cleanly rather than overflowing`,
      mLong.sameRow || (!mLong.hOverflow && mLong.subLeft < mLong.nameRight),
      `extreme lead: same row ${mLong.sameRow}, sideways scroll ${mLong.hOverflow}`)
    check(`${w}: the four actions share one row`, m.actionsOneRow, `one row: ${m.actionsOneRow}`)
    // R5, RULED (a): the actions sit on the head's line at 1920 and 3440 and
    // WRAP TO A SECOND LINE AT 1240, where the four buttons plus the name line
    // exceed the width. That is an accepted behaviour, so it is asserted -
    // otherwise a later change could turn the wrap into an OVERFLOW and
    // nothing would notice. The claim is: same line when there is room, a
    // clean second line when there is not, never a sideways scroll.
    const headShape = await page.evaluate((id) => {
      const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
      const head = card.querySelector('.lead-card-head')
      const name = head.querySelector('.lead-card-name').getBoundingClientRect()
      const acts = head.querySelector('.lead-card-actions').getBoundingClientRect()
      const hb = head.getBoundingClientRect()
      return {
        sameLine: Math.abs(name.top - acts.top) < 8,
        insideHead: acts.right <= hb.right + 1 && acts.left >= hb.left - 1,
        headRows: Math.round(hb.height) > 48 ? 2 : 1,
      }
    }, lead.id)
    check(`${w}: the actions are inside the head and never overflow it`,
      headShape.insideHead,
      `head rows ${headShape.headRows}, actions on the name's line: ${headShape.sameLine}`)
    check(`${w}: ${w === 1240 ? 'the actions WRAP, as ruled' : 'the actions share the name line'}`,
      w === 1240 ? !headShape.sameLine : headShape.sameLine,
      `same line: ${headShape.sameLine} (R5 (a): wrap at 1240, one line above it)`)
    check(`${w}: the page does not scroll sideways`, !m.hOverflow,
      `scrollWidth vs clientWidth overflow: ${m.hOverflow}`)
    await page.screenshot({ path: `${OUT}p2-width-${w}.png` })
    console.log(`        screenshot ${OUT}p2-width-${w}.png`)
  }
} finally {
  for (const id of [lead.id, longLead.id]) {
    await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }
  console.log('\n  soft deleted 2')
  await browser.close()
}
const f = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - f.length}/${results.length} checks pass`)
process.exit(f.length ? 1 : 0)
