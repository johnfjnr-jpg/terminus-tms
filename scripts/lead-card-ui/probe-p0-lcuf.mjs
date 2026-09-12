// LEAD CARD UI FIXES, Phase 0: measurement only. Nothing is changed.
//
// ARTEFACT NAMES CARRY THIS ROUND'S PREFIX, `lcuf-p0-*`. Verification 44's
// lineage clause, promoted at the last close from exactly this fault: a probe
// copied from another inherits its artefact names and its first run destroys
// the source run's evidence. This one is copied from probe-p0-csfix.mjs, so
// the output paths were the first thing re-pointed.
//
// FOUR CLAIMS, FOUR FIXTURES. Verification 7's clause: a fixture consumed by
// an earlier claim cannot serve a later one. R4 needs a lead with NO notes,
// R3 needs one WITH notes, R1 needs one with no account, and R5 needs one
// whose columns are all short - four leads, not one reused four times.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-lcuf.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcuf/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'lcuf0'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const say = (h) => console.log(`\n${h}`)
const px = (n) => (n === null || n === undefined ? '--' : `${Math.round(n)}px`)

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
    payload: { name: `${TAG} ${label}`, company: 'UI Fixes Co', source: 'Referral', ...payload },
  created_by: OWNER.user.id }).select().single(), `rev ${label}`)
  return r
}
const NOTE = (t, at) => ({ text: t, at, by: 'john+test@terminustechnologies.io' })
// R3 + R2: a lead WITH notes, so the header row, the input and the rendered
// `at` are all on screen at once.
const withNotes = await mk('WithNotes', {
  notes: [NOTE('Third note, most recent.', '2026-09-12T06:14:09.321Z'),
          NOTE('Second note.', '2026-09-11T22:02:41.000Z'),
          NOTE('First note.', '2026-09-10T01:45:00.000Z')],
  summary: 'A summary long enough to occupy its column and no longer.',
})
// R4: a lead with NO notes, which is the only state that renders the empty line.
const noNotes = await mk('NoNotes', { summary: 'Short summary.' })
// R1: a lead with no account linked, so the Qualify account step opens.
const forPicker = await mk('Picker', {
  jobRole: 'Head of Ops', email: `${TAG}@example.invalid`, mobile: '+65 9000 0177',
  linkedin: 'https://example.invalid/in/x', address: '1 Way', city: 'Singapore',
  postcode: '069118', country: 'Singapore', region: 'APAC', summary: 'Ready.',
})
// R5: a deliberately LEAN card - no notes, one-line summary, no follow-up - so
// the empty band is measured where it is largest rather than on a busy card.
const lean = await mk('Lean', { summary: 'One line.' })
const created = [withNotes.id, noNotes.id, forPicker.id, lean.id]
console.log(`fixtures: ${created.join(' ')}`)

const browser = await puppeteer.launch({ headless: 'new' })
const FINDINGS = {}
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  // THE RELOAD IS LOAD-BEARING. Seeding localStorage after the app has booted
  // leaves it on the sign-in view; the first run of this probe omitted it and
  // timed out waiting for a card on a page that was never signed in.
  await page.reload({ waitUntil: 'networkidle0' })

  const gotoLeads = async (id) => {
    await page.evaluate(() => navigate('leads'))
    // COUNTERFACTUAL: this card did not exist before this run, so its testid
    // cannot be satisfied by the previous view. Verification 7.
    // Verification 14: the failure detail carries the CAUSE's own answer, so
    // "the card is absent" and "we are not signed in" are distinguishable.
    try {
      await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
        { timeout: 25000 }, id)
    } catch (e) {
      const why = await page.evaluate(() => ({
        view: document.querySelector('.view:not([hidden])')?.id ?? '(none visible)',
        cards: document.querySelectorAll('[data-testid^="lead-card-"]').length,
        signedIn: !!localStorage.getItem('sb-anvildouaacbhsjytkii-auth-token'),
      }))
      console.error(`  WAIT FAILED for ${id}: visible view ${why.view}, ${why.cards} lead cards present, token in storage ${why.signedIn}`)
      throw e
    }
  }
  const rects = async (id) => page.evaluate((x) => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null
      const b = e.getBoundingClientRect(); return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height } }
    const card = `[data-testid="lead-card-${x}"]`
    return {
      card: r(card), body: r(`${card} .lead-card-body`),
      summaryCol: r(`[data-testid="lead-summary-${x}"]`),
      notesCol: r(`[data-testid="lead-notes-${x}"]`),
      followCol: r(`[data-testid="lead-followup-${x}"]`),
      summaryInput: r(`[data-testid="lead-summary-input-${x}"]`),
      summaryTitle: r(`[data-testid="lead-summary-${x}"] .lead-card-col-title`),
      notesTitle: r(`[data-testid="lead-notes-${x}"] .lead-card-col-title`),
      notesHeaderRow: r(`[data-testid="lead-notes-${x}"] [data-testid="cd-notes-header-row"]`),
      addNote: r(`[data-testid="lead-notes-${x}"] [data-testid="cd-add-note-btn"]`),
      noteInput: r(`[data-testid="lead-notes-${x}"] [data-testid="cd-new-note-input"]`),
      noteDiscard: r(`[data-testid="lead-notes-${x}"] [data-testid="cd-note-discard"]`),
      notesEmpty: r(`[data-testid="lead-notes-${x}"] [data-testid="cd-notes-empty"]`),
      firstNoteWhen: r(`[data-testid="lead-notes-${x}"] .ref-notes-when`),
    }
  }, id)

  // ── 1. R2 LIVE: what a person actually sees where a timestamp renders ──
  say('1. R2: the rendered timestamp text, read off the screen')
  await page.setViewport({ width: 1920, height: 1200 })
  await gotoLeads(withNotes.id)
  const whenTexts = await page.evaluate((x) => [...document.querySelectorAll(
    `[data-testid="lead-notes-${x}"] .ref-notes-when`)].map((e) => e.textContent.trim()), withNotes.id)
  const subText = await page.evaluate((x) => document.querySelector(
    `[data-testid="lead-sub-${x}"]`)?.textContent.trim(), withNotes.id)
  console.log(`  notes "when" column, as rendered: ${JSON.stringify(whenTexts)}`)
  console.log(`  card head sub line:               "${subText}"`)
  FINDINGS.r2Raw = whenTexts.some((t) => /\d{4}-\d{2}-\d{2}T/.test(t))
  console.log(`  RAW ISO ON SCREEN: ${FINDINGS.r2Raw}`)
  await page.screenshot({ path: `${OUT}lcuf-p0-notes-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  }, withNotes.id) })

  // ── 2. R3: the notes header and the input's alignment ─────────────────
  say('2. R3: the notes header line and where the input sits')
  const closed = await rects(withNotes.id)
  console.log(`  NOTES title      top ${px(closed.notesTitle?.top)}  left ${px(closed.notesTitle?.left)}  h ${px(closed.notesTitle?.h)}`)
  console.log(`  header row       top ${px(closed.notesHeaderRow?.top)}  left ${px(closed.notesHeaderRow?.left)}  h ${px(closed.notesHeaderRow?.h)}`)
  console.log(`  Add note         top ${px(closed.addNote?.top)}  left ${px(closed.addNote?.left)}`)
  const titleOnHeaderLine = closed.notesTitle && closed.notesHeaderRow
    && Math.abs(closed.notesTitle.top - closed.notesHeaderRow.top) < 4
  console.log(`  TITLE SHARES THE HEADER LINE: ${titleOnHeaderLine}  (gap ${px((closed.notesHeaderRow?.top ?? 0) - (closed.notesTitle?.bottom ?? 0))} between title bottom and header top)`)
  FINDINGS.r3TitleOnLine = !!titleOnHeaderLine
  // open the note editor and measure the input against the Summary field
  await page.click(`[data-testid="lead-notes-${withNotes.id}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${withNotes.id}"] [data-testid="cd-new-note-input"]`, { timeout: 10000 })
  const open = await rects(withNotes.id)
  console.log(`  note input       top ${px(open.noteInput?.top)}  left ${px(open.noteInput?.left)}  h ${px(open.noteInput?.h)}`)
  console.log(`  Summary input    top ${px(open.summaryInput?.top)}  left ${px(open.summaryInput?.left)}  h ${px(open.summaryInput?.h)}`)
  const dTop = (open.noteInput?.top ?? 0) - (open.summaryInput?.top ?? 0)
  console.log(`  MISALIGNMENT, note input vs Summary input:  top ${px(dTop)}`)
  FINDINGS.r3MisalignTop = Math.round(dTop)
  console.log(`  Discard          top ${px(open.noteDiscard?.top)}  left ${px(open.noteDiscard?.left)}`)
  await page.screenshot({ path: `${OUT}lcuf-p0-notes-open-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  }, withNotes.id) })

  // ── 3. R4: the empty-notes line ───────────────────────────────────────
  say('3. R4: where "No notes yet." renders, and what it costs')
  await gotoLeads(noNotes.id)
  const empty = await rects(noNotes.id)
  const emptyText = await page.evaluate((x) => document.querySelector(
    `[data-testid="lead-notes-${x}"] [data-testid="cd-notes-empty"]`)?.textContent.trim(), noNotes.id)
  console.log(`  rendered: ${JSON.stringify(emptyText)}   h ${px(empty.notesEmpty?.h)}`)
  FINDINGS.r4Height = Math.round(empty.notesEmpty?.h ?? 0)

  // ── 4. R5: the empty band, and WHOSE space it is ──────────────────────
  say('4. R5: the band at the bottom of the card, measured at three widths')
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1000 })
    await gotoLeads(lean.id)
    const r = await rects(lean.id)
    const cols = { Summary: r.summaryCol, Notes: r.notesCol, 'Follow-up': r.followCol }
    // The deepest painted content in each column, so a column's own slack is
    // visible rather than only the box it was given.
    const deepest = await page.evaluate((x) => {
      const out = {}
      for (const [k, sel] of [['Summary', 'lead-summary'], ['Notes', 'lead-notes'], ['Follow-up', 'lead-followup']]) {
        const col = document.querySelector(`[data-testid="${sel}-${x}"]`)
        if (!col) { out[k] = null; continue }
        let max = col.getBoundingClientRect().top
        for (const e of col.querySelectorAll('*')) {
          const b = e.getBoundingClientRect()
          if (b.height > 0 && b.bottom > max) max = b.bottom
        }
        out[k] = { colBottom: col.getBoundingClientRect().bottom, contentBottom: max }
      }
      return out
    }, lean.id)
    console.log(`  ${w}px  card h ${px(r.card?.h)}  body h ${px(r.body?.h)}`)
    for (const k of Object.keys(cols)) {
      const d = deepest[k]
      console.log(`        ${k.padEnd(10)} col h ${px(cols[k]?.h)}  content ends ${px(d ? d.contentBottom - (cols[k]?.top ?? 0) : null)}  SLACK ${px(d ? d.colBottom - d.contentBottom : null)}`)
    }
    const bodyBottom = r.body?.bottom ?? 0
    const cardBottom = r.card?.bottom ?? 0
    console.log(`        band below the body, inside the card: ${px(cardBottom - bodyBottom)}`)
    FINDINGS[`r5_${w}`] = {
      card: Math.round(r.card?.h ?? 0),
      slack: Object.fromEntries(Object.keys(cols).map((k) =>
        [k, Math.round(deepest[k] ? deepest[k].colBottom - deepest[k].contentBottom : 0)])),
      belowBody: Math.round(cardBottom - bodyBottom),
    }
    await page.screenshot({ path: `${OUT}lcuf-p0-lean-${w}.png`, clip: await page.evaluate((x) => {
      const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
      return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height }
    }, lean.id) })
  }

  // ── 5. R1: the account picker as it renders today ─────────────────────
  say('5. R1: the account picker - match boxes, and where Create sits')
  await page.setViewport({ width: 1920, height: 1200 })
  await gotoLeads(forPicker.id)
  await page.click(`[data-testid="lead-qualify-${forPicker.id}"]`)
  await page.waitForSelector(`[data-testid="lead-account-step-${forPicker.id}"]`, { timeout: 15000 })
  const search = `[data-testid="lead-account-step-${forPicker.id}"] [data-testid="cd-link-search"]`
  await page.click(search)
  await page.keyboard.type('a')
  await new Promise((r) => setTimeout(r, 400))
  const picker = await page.evaluate((x) => {
    const step = document.querySelector(`[data-testid="lead-account-step-${x}"]`)
    const input = step.querySelector('[data-testid="cd-link-search"]')
    const results = step.querySelector('[data-testid="cd-link-results"]')
    const create = step.querySelector('[data-testid="cd-link-create"]')
    const boxes = [...results.querySelectorAll('button')].filter((b) => b.dataset.testid !== 'cd-link-create')
    const rb = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
      return { top: b.top, left: b.left, bottom: b.bottom, w: b.width, h: b.height } }
    return {
      matchCount: boxes.length,
      rows: new Set(boxes.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      resultsH: rb(results)?.h ?? 0,
      input: rb(input), create: rb(create), firstBox: rb(boxes[0]),
      createBelowInput: create ? create.getBoundingClientRect().top > input.getBoundingClientRect().bottom - 2 : null,
      stepH: rb(step)?.h ?? 0,
    }
  }, forPicker.id)
  console.log(`  one keystroke "a":  ${picker.matchCount} match boxes over ${picker.rows} rows, results block ${px(picker.resultsH)} tall`)
  console.log(`  step height ${px(picker.stepH)}`)
  console.log(`  input  top ${px(picker.input?.top)} left ${px(picker.input?.left)} w ${px(picker.input?.w)}`)
  console.log(`  Create top ${px(picker.create?.top)} left ${px(picker.create?.left)}   BELOW the input: ${picker.createBelowInput}`)
  FINDINGS.r1 = picker
  await page.screenshot({ path: `${OUT}lcuf-p0-picker-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, 900) }
  }, forPicker.id) })
  // How many accounts exist at all, so "N boxes" has a denominator.
  const total = await page.evaluate(() => window.__leadAccountsCount ?? null)
  console.log(`  accounts in the list (window hint): ${total ?? 'not exposed'}`)

  console.log(`\nFINDINGS ${JSON.stringify(FINDINGS, null, 1)}`)
} finally {
  await browser.close()
  // Verification 11: SOFT delete, then re-query rather than trust the result.
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
