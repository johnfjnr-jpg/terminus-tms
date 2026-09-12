// LEAD CARD UI FIXES, Phase 1: the live measurement.
//
// ARTEFACTS ARE `lcuf-p1-*`. Verification 44's lineage clause: this probe is
// copied from the Phase 0 one, so its output paths were re-pointed BEFORE its
// assertions. Phase 0's images stay on disk beside these.
//
// EVERY CAPTURE GOES THROUGH THE ELEMENT, never a page-coordinate clip. Phase
// 0 photographed pure background below a card inside a scrolling container
// and the image read as notes failing to render.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1-lcuf.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcuf/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OTHER = JSON.parse(readFileSync(`${ROOT}/session-ref-approver.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const px = (n) => (n === null || n === undefined ? '--' : `${Math.round(n)}px`)
const say = (h) => console.log(`\n${h}`)
const FAIL = []
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) FAIL.push(what) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2) }

const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const NOTE = (t, at) => ({ text: t, at, by: 'john+test@terminustechnologies.io' })
const mk = async (label, payload, owner = OWNER.user.id) => {
  const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
    owner_id: owner, industry_id: industry.id }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
    payload: { name: `lcuf1 ${label}`, company: 'UI Fixes Co', source: 'Referral', ...payload },
    created_by: owner }).select().single(), `rev ${label}`)
  return r
}
// ONE FIXTURE PER CLAIM (Verification 7).
const withNotes = await mk('WithNotes', {
  notes: [NOTE('Third note, most recent.', '2026-09-12T06:14:09.321Z'),
          NOTE('Second note.', '2026-09-11T22:02:41.000Z'),
          NOTE('First note.', '2026-09-10T01:45:00.000Z')],
  summary: 'A summary long enough to occupy its column and no longer.' })
const lean = await mk('Lean', { summary: 'One line.' })
const forPicker = await mk('Picker', {
  jobRole: 'Head of Ops', email: 'lcuf1@example.invalid', mobile: '+65 9000 0180',
  linkedin: 'https://example.invalid/in/x', address: '1 Way', city: 'Singapore',
  postcode: '069118', country: 'Singapore', region: 'APAC', summary: 'Ready.' })
// A RECORD THE USER CAN SEE AND MUST NOT EDIT. Built by admin write with a
// REAL second auth.users id, per Verification 47's clause: one account cannot
// reach this state, and the door reads owner_id rather than how it got there.
const unowned = await mk('Unowned', { summary: 'Somebody else owns this.' }, OTHER.user.id)
const created = [withNotes.id, lean.id, forPicker.id, unowned.id]
console.log(`fixtures: ${created.join(' ')}`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async (id) => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, id)
  }
  const shot = async (id, name) => {
    const el = await page.$(`[data-testid="lead-card-${id}"]`)
    if (!el) throw new Error(`shot: no card ${id}`)
    await el.screenshot({ path: `${OUT}${name}` })
  }

  // ── 1. R7 LIVE ────────────────────────────────────────────────────────
  say('1. R7: the timestamps a person actually sees')
  await page.setViewport({ width: 1920, height: 1100 })
  await go(withNotes.id)
  const r7 = await page.evaluate((x) => ({
    when: [...document.querySelectorAll(`[data-testid="lead-notes-${x}"] .ref-notes-when`)]
      .map((e) => e.textContent.trim()),
    sub: document.querySelector(`[data-testid="lead-sub-${x}"]`)?.textContent.trim(),
  }), withNotes.id)
  console.log(`  notes "when": ${JSON.stringify(r7.when)}`)
  console.log(`  card sub:     "${r7.sub}"`)
  check(r7.when.every((t) => /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(t)),
    'every notes timestamp is DD/MM/YY HH:MM:SS')
  check(!r7.when.some((t) => t.includes('T') || t.includes('Z')), 'no raw ISO on screen')
  check(/\d{2}\/\d{2}\/\d{2}/.test(r7.sub) && !/\d{4}-\d{2}-\d{2}/.test(r7.sub),
    'the card sub line is DD/MM/YY, not YYYY-MM-DD')

  // ── 2. R3 LIVE: the header line and the alignment ──────────────────────
  say('2. R3: the header line, and the note input against the Summary field')
  const rect = async (id, sel) => page.evaluate((x, s) => {
    const e = document.querySelector(s.replace('%', x)); if (!e) return null
    const b = e.getBoundingClientRect()
    return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height }
  }, id, sel)
  const title = await rect(withNotes.id, '[data-testid="lead-notes-%"] [data-testid="cd-notes-title"]')
  const hdr = await rect(withNotes.id, '[data-testid="lead-notes-%"] [data-testid="cd-notes-header-row"]')
  const addBtn = await rect(withNotes.id, '[data-testid="lead-notes-%"] [data-testid="cd-add-note-btn"]')
  console.log(`  NOTES title  top ${px(title?.top)}  header row top ${px(hdr?.top)}  Add note top ${px(addBtn?.top)}`)
  check(title && hdr && Math.abs(title.top - hdr.top) < 6, 'the title is ON the header row')
  check(title && addBtn && Math.abs(title.top - addBtn.top) < 8, 'Add note is on the same line as the title')
  await page.click(`[data-testid="lead-notes-${withNotes.id}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${withNotes.id}"] [data-testid="cd-new-note-input"]`,
    { timeout: 10000 })
  const noteIn = await rect(withNotes.id, '[data-testid="lead-notes-%"] [data-testid="cd-new-note-input"]')
  const sumIn = await rect(withNotes.id, '[data-testid="lead-summary-input-%"]')
  const delta = Math.round((noteIn?.top ?? 0) - (sumIn?.top ?? 0))
  console.log(`  note input top ${px(noteIn?.top)}   Summary input top ${px(sumIn?.top)}   DELTA ${delta}px  (Phase 0: 36px)`)
  check(Math.abs(delta) <= 4, `the note input aligns with the Summary field (delta ${delta}px)`)
  await shot(withNotes.id, 'lcuf-p1-notes-open-1920.png')
  await page.click(`[data-testid="lead-notes-${withNotes.id}"] [data-testid="cd-note-discard"]`)
  await shot(withNotes.id, 'lcuf-p1-notes-1920.png')

  // ── 3. R4 + R5 LIVE, at three widths ──────────────────────────────────
  say('3. R4 and R5: the sentence is gone, and what the card now measures')
  const P0 = { 1240: 335, 1920: 257, 3440: 257 }
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1000 })
    await page.reload({ waitUntil: 'networkidle0' })
    await go(lean.id)
    const card = await rect(lean.id, '[data-testid="lead-card-%"]')
    const empty = await rect(lean.id, '[data-testid="lead-notes-%"] [data-testid="cd-notes-empty"]')
    console.log(`  ${w}px  card ${px(card?.h)}  (Phase 0 ${P0[w]}px, delta ${Math.round((card?.h ?? 0) - P0[w])}px)`
      + `   "No notes yet." ${empty ? 'STILL PRESENT' : 'gone'}`)
    check(!empty, `${w}: the empty-state sentence is gone`)
    await shot(lean.id, `lcuf-p1-lean-${w}.png`)
  }

  // ── 4. R1 LIVE: the dropdown and the create control's geometry ────────
  say('4. R1: the type-ahead, measured at three widths')
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1100 })
    await page.reload({ waitUntil: 'networkidle0' })
    await go(forPicker.id)
    await page.click(`[data-testid="lead-qualify-${forPicker.id}"]`)
    await page.waitForSelector(`[data-testid="acct-picker-${forPicker.id}"]`, { timeout: 15000 })
    const sel = `[data-testid="acct-search-${forPicker.id}"]`
    const stepBefore = await rect(forPicker.id, '[data-testid="lead-account-step-%"]')
    await page.click(sel)
    await page.keyboard.type('e')
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="acct-list-${x}"]`),
      { timeout: 8000 }, forPicker.id)
    const m = await page.evaluate((x) => {
      const rb = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
        return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height } }
      const input = document.querySelector(`[data-testid="acct-search-${x}"]`)
      const create = document.querySelector(`[data-testid="acct-create-${x}"]`)
      const list = document.querySelector(`[data-testid="acct-list-${x}"]`)
      const opts = [...document.querySelectorAll(`[data-testid="acct-list-${x}"] [role="option"]`)]
      return { input: rb(input), create: rb(create), list: rb(list), n: opts.length,
        step: rb(document.querySelector(`[data-testid="lead-account-step-${x}"]`)),
        listPosition: list ? getComputedStyle(list).position : null }
    }, forPicker.id)
    const sameLine = m.create && m.input && Math.abs(m.create.top - m.input.top) < 14
    const toTheRight = m.create && m.input && m.create.left >= m.input.right - 2
    console.log(`  ${w}px  ${m.n} matches in ONE listbox (${px(m.list?.h)} tall, ${m.listPosition})`)
    console.log(`        input right ${px(m.input?.right)}   Create left ${px(m.create?.left)} top ${px(m.create?.top)} vs input top ${px(m.input?.top)}`)
    console.log(`        step height ${px(stepBefore?.h)} closed -> ${px(m.step?.h)} with ${m.n} matches showing`)
    check(sameLine, `${w}: Create is on the input's line`)
    check(toTheRight, `${w}: Create is to the RIGHT of the input`)
    check(m.listPosition === 'absolute', `${w}: the list is absolute, so opening it does not reflow the card`)
    // AND IT HANGS OFF THE INPUT. "absolute" alone is satisfied by a list
    // positioned against the viewport, which is where this one sat for one
    // build: 730px below the card, invisible to every check here and obvious
    // in the screenshot. The claim is ADJACENCY, so adjacency is what is
    // asserted - Verification 4's remedy turned into an assertion.
    const hangsOff = m.list && m.input
      && Math.abs(m.list.top - m.input.bottom) < 24
      && Math.abs(m.list.left - m.input.left) < 4
    check(!!hangsOff, `${w}: the list opens directly under the input`
      + ` (list top ${px(m.list?.top)} vs input bottom ${px(m.input?.bottom)})`)
    check(Math.abs((m.step?.h ?? 0) - (stepBefore?.h ?? 0)) < 6,
      `${w}: the step does not grow when ${m.n} matches appear`)
    if (w === 1920) await shot(forPicker.id, 'lcuf-p1-picker-1920.png')
  }

  // ── 5. THE DOOR, BOTH WAYS ────────────────────────────────────────────
  say('5. The door, both ways')
  await page.setViewport({ width: 1920, height: 1100 })
  await page.reload({ waitUntil: 'networkidle0' })
  await go(unowned.id)
  const doorState = async (id) => page.evaluate((x) => {
    const card = document.querySelector(`[data-testid="lead-card-${x}"]`)
    const d = (sel) => { const e = card.querySelector(sel); return e ? e.disabled : null }
    return {
      notMine: card.dataset.notMine,
      qualify: d(`[data-testid="lead-qualify-${x}"]`),
      addNote: d('[data-testid="cd-add-note-btn"]'),
      summarySave: d(`[data-testid="lead-summary-save-${x}"]`),
      // READ AFFORDANCES must survive: the expand rungs let somebody READ.
      show10: d('[data-testid="cd-notes-show-10"]'),
    }
  }, id)
  const off = await doorState(unowned.id)
  console.log(`  UNOWNED card  notMine=${off.notMine}  qualify=${off.qualify}  addNote=${off.addNote}  summarySave=${off.summarySave}`)
  check(off.notMine === 'true', 'the unowned card is marked not-mine')
  check(off.qualify === true, 'Qualify is disabled, so the picker is unreachable')
  check(off.addNote === true, 'Add note is disabled on an unowned lead')
  await shot(unowned.id, 'lcuf-p1-unowned-1920.png')
  await go(withNotes.id)
  const on = await doorState(withNotes.id)
  console.log(`  OWNED card    notMine=${on.notMine}  qualify=${on.qualify}  addNote=${on.addNote}  show10=${on.show10}`)
  check(on.notMine === 'false', 'the owned card is marked mine')
  check(on.qualify === false, 'Qualify is live on my own lead')
  check(on.addNote === false, 'Add note is live on my own lead')
  check(on.show10 === false, 'the expand rungs stay alive: they are READ affordances')

  // ── 6. THE DOOR AGAINST THE PICKER'S OWN MARKUP ───────────────────────
  say('6. The door swept over the picker itself')
  // The picker cannot be REACHED on an unowned lead, so the sweep is run
  // directly against its real markup on an owned one. That measures the claim
  // the unit test A11 makes structurally: nothing inside carries an exemption.
  await go(forPicker.id)
  await page.click(`[data-testid="lead-qualify-${forPicker.id}"]`)
  await page.waitForSelector(`[data-testid="acct-picker-${forPicker.id}"]`, { timeout: 15000 })
  await page.click(`[data-testid="acct-search-${forPicker.id}"]`)
  await page.keyboard.type('e')
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="acct-list-${x}"]`),
    { timeout: 8000 }, forPicker.id)
  const swept = await page.evaluate((x) => {
    const card = document.querySelector(`[data-testid="lead-card-${x}"]`)
    window.applyReadOnlyControls(card, true)
    const opts = [...card.querySelectorAll('[role="option"]')]
    const create = card.querySelector(`[data-testid="acct-create-${x}"]`)
    const input = card.querySelector(`[data-testid="acct-search-${x}"]`)
    const out = { options: opts.length, optionsLive: opts.filter((o) => !o.disabled).length,
      createLive: create ? !create.disabled : null, inputLive: input ? !input.disabled : null }
    window.applyReadOnlyControls(card, false)
    return out
  }, forPicker.id)
  console.log(`  swept notMine=true: ${swept.options} options, ${swept.optionsLive} still live; create live ${swept.createLive}; input live ${swept.inputLive}`)
  check(swept.options > 0, 'there were options to neutralise (the claim is not true by absence)')
  check(swept.optionsLive === 0, 'EVERY option is neutralised by the door')
  check(swept.createLive === false, 'Create is neutralised by the door')
  check(swept.inputLive === false, 'the search input is neutralised by the door')

  console.log(`\n${FAIL.length ? `FAILURES (${FAIL.length}):\n  ` + FAIL.join('\n  ') : 'ALL CHECKS PASSED'}`)
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
process.exit(FAIL.length ? 1 : 0)
