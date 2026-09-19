// ── R-K ON A SECOND LIVE SURFACE ─────────────────────────────────────────
//
// John ruled: one live keyboard pass on the CONTACT panel, the same probe as
// Commercials, read back from the database.
//
// ── THE MEASUREMENT THAT CHANGED WHAT THAT MEANS, reported rather than
// quietly worked around. THE CONTACT PANEL HAS EXACTLY ONE FieldRow ROW.
// `summary`, and nothing else: Personal Details and Address Details are a
// different component entirely, a grid of always-open inputs, not rows with a
// door. So there is no second field for a commit-and-move to move TO, and
// `summary` is a TEXTAREA, which by P4 keeps Enter for its newline and the
// arrows for its caret.
//
// R-K IS THEREFORE INERT ON THE CONTACT PANEL BY ITS OWN RULING, and a "pass"
// there would be a claim true by absence (Verification 14). Part A measures
// that and proves the inertness is the RULED behaviour rather than a failure.
// Part B then runs the real pass on the Test Bed REFERENCE panel, which is a
// genuine multi-row FieldRow panel and a different surface from Commercials.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates a Contact and a Test Bed.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-rk-second-surface.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-rk-second-surface.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshContact, freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin()
const TAG = 'w3rk2'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const recordState = async (id) => {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'revision')
  return { revision: rev[0]?.revision_number ?? 0, payload: rev[0]?.payload ?? {} }
}

const contact = await freshContact(TAG)
const tb = await freshTestBed(TAG)
console.log(`contact ${contact.contactId}\ntest bed ${tb.bedId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  // A wait that swallows its timeout, so a failure lands on the assertion that
  // names the claim rather than killing the probe one line above it.
  const settle = (fn, arg) => p.waitForFunction(fn, { timeout: 8000 }, arg).catch(() => false)
  const openIn = (view) => p.evaluate((v) => {
    const root = document.getElementById(v)
    return Array.from(root.querySelectorAll('.field-row[data-field]'))
      .filter((r) => { const e = r.querySelector('[data-testid^="edit-"]'); return e && !e.hasAttribute('hidden') })
      .map((r) => r.getAttribute('data-field'))
  }, view)

  // ══ PART A: THE CONTACT PANEL, MEASURED ════════════════════════════════
  console.log('  PART A: the Contact panel')
  await p.evaluate((id) => navigate('contact-detail', id), contact.contactId)
  await settle(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v?.querySelector('[data-testid="contact-panel"]')
      && !!v.querySelector('[data-testid="display-summary"]')
  })

  const cPanel = await p.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const el = v?.querySelector('[data-field-panel]')
    const rows = el ? Array.from(el.querySelectorAll('.field-row[data-field]:not([data-readonly])'))
      .map((r) => r.getAttribute('data-field')) : []
    const ta = !!v?.querySelector('[data-testid="edit-summary"] textarea')
    return { declared: el?.getAttribute('data-field-panel') ?? null, rows, summaryIsTextarea: ta,
      canEdit: window.canEditFields?.() }
  })
  console.log(`  ${JSON.stringify(cPanel)}`)
  check(cPanel.declared === 'contact', `the Contact panel declares itself (${cPanel.declared})`)
  check(cPanel.canEdit === true, 'and the record is one the user OWNS, so the door is open')
  // THE SCOPE FINDING, ASSERTED so it cannot be forgotten: if somebody later
  // routes Personal Details through FieldRow, this goes red and the contact
  // surface earns a real keyboard pass.
  check(cPanel.rows.length === 1 && cPanel.rows[0] === 'summary',
    `it holds exactly ONE openable row, so there is nothing to move to (${JSON.stringify(cPanel.rows)})`)
  check(cPanel.summaryIsTextarea === true,
    'and that row is a TEXTAREA, which by P4 keeps Enter and the arrows for itself')

  // The inertness is the RULED behaviour, so it is proved rather than assumed.
  await p.focus('[data-testid="display-summary"]')
  await p.keyboard.press('Enter')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-summary')
  const openedByEnter = await openIn('view-contact-detail')
  check(openedByEnter.includes('summary'), 'Enter on the CLOSED row still opens it, as it always did')

  const beforeVal = await p.$eval('[data-testid="input-summary"]', (e) => e.value)
  await p.keyboard.press('Enter')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const afterEnter = await p.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const ed = v.querySelector('[data-testid="edit-summary"]')
    const inp = v.querySelector('[data-testid="input-summary"]')
    return { stillOpen: ed ? !ed.hasAttribute('hidden') : null, value: inp?.value ?? null }
  })
  check(afterEnter.stillOpen === true,
    'and Enter INSIDE the textarea does NOT commit and close, which is P4 doing its job')
  check(afterEnter.value !== beforeVal && afterEnter.value.includes('\n'),
    'it inserted a newline instead, so the textarea kept the key R-K would have taken')
  await p.keyboard.press('Escape')

  await p.screenshot({ path: `${OUT}rk2-contact-${contact.contactId.slice(0, 8)}.png` })
  console.log(`  screenshot: ${OUT}rk2-contact-${contact.contactId.slice(0, 8)}.png\n`)

  // ══ PART B: THE TEST BED REFERENCE PANEL, THE REAL SECOND PASS ═════════
  console.log('  PART B: the Test Bed Reference panel')
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await settle(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-cards"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  })

  const rPanel = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const el = v?.querySelector('[data-field-panel="test-bed-reference"]')
    const rows = el ? Array.from(el.querySelectorAll('.field-row[data-field]:not([data-readonly])'))
      .map((r) => r.getAttribute('data-field')) : []
    return { declared: el?.getAttribute('data-field-panel') ?? null, rows }
  })
  console.log(`  order: ${rPanel.rows.join(' -> ')}`)
  check(rPanel.declared === 'test-bed-reference', `the Reference panel declares itself (${rPanel.declared})`)
  check(rPanel.rows.length >= 3, `and holds ${rPanel.rows.length} openable rows, so a pass has somewhere to go`)

  const before = await recordState(tb.bedId)
  console.log(`  record at revision ${before.revision} before a key of the pass is pressed`)

  // Two text rows the pass can type into, taken from the panel's own order.
  const typable = await p.evaluate((names) => names.filter((n) => {
    const v = document.getElementById('view-test-bed-detail')
    const row = v.querySelector(`.field-row[data-field="${n}"]`)
    const ed = row?.querySelector('[data-testid^="input-"]')
    return ed && ed.tagName === 'INPUT' && ed.type !== 'date' && ed.type !== 'checkbox'
  }), rPanel.rows)
  console.log(`  typable text rows: ${typable.join(', ')}`)
  check(typable.length >= 2, `at least two text rows to move between (${typable.length})`)

  // ── THE PAIR MUST BE ADJACENT AND BOTH TEXT, and the first version of this
  // probe was wrong about that in a way worth keeping.
  //
  // It took the first two TYPABLE rows and expected ArrowUp to come back. The
  // Reference panel's order is `name` then `terminusLead`, and `terminusLead`
  // is a STAFF PICKER - a select. Enter moved into it correctly, and ArrowUp
  // then did nothing, because by P4 the arrows in a select belong to the
  // OPTION LIST. The product was right and the assertion was wrong.
  //
  // It is also a real consequence worth stating rather than hiding: on a panel
  // that mixes text rows and selects, Enter walks the whole panel and the
  // ARROWS stop at the first select. That is P4 choosing the control's own
  // keys over the panel's, deliberately.
  const adjacent = (() => {
    for (let i = 0; i < rPanel.rows.length - 1; i++) {
      if (typable.includes(rPanel.rows[i]) && typable.includes(rPanel.rows[i + 1])) {
        return [rPanel.rows[i], rPanel.rows[i + 1]]
      }
    }
    return []
  })()
  check(adjacent.length === 2,
    `two ADJACENT text rows exist for the arrow pass (${JSON.stringify(adjacent)})`)
  const [a, z] = adjacent
  await p.focus(`[data-testid="display-${a}"]`)
  await p.keyboard.press('Enter')
  await settle((n) => document.activeElement?.getAttribute('data-testid') === `input-${n}`, a)
  check(await p.evaluate((n) => document.activeElement?.getAttribute('data-testid') === `input-${n}`, a),
    `Enter opened ${a} and put the caret in it`)

  await p.keyboard.press('End')
  await p.keyboard.type('X')
  await p.keyboard.press('Enter')
  await settle(() => true)
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const moved = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const open = Array.from(v.querySelectorAll('.field-row[data-field]'))
      .filter((r) => { const e = r.querySelector('[data-testid^="edit-"]'); return e && !e.hasAttribute('hidden') })
      .map((r) => r.getAttribute('data-field'))
    return { open, focus: document.activeElement?.getAttribute('data-testid') }
  })
  const next = z
  console.log(`  after Enter: ${JSON.stringify(moved)} (expected next = ${next})`)
  check(!moved.open.includes(a), `Enter CLOSED ${a}, committing its draft`)
  check(moved.open.includes(next), `and opened the next row on the panel, ${next}`)
  check(moved.focus === `input-${next}`, `with the caret in it (focus ${moved.focus})`)

  // ArrowUp back, which is the direction the unit suite cannot prove on a real
  // browser's own focus handling.
  await p.keyboard.press('ArrowUp')
  await settle((n) => document.activeElement?.getAttribute('data-testid') === `input-${n}`, a)
  const back = await openIn('view-test-bed-detail')
  check(back.includes(a) && !back.includes(next),
    `ArrowUp committed and moved back UP to ${a} (open ${JSON.stringify(back)})`)

  // ── NOT ESCAPE HERE, AND THE FIRST VERSION GOT THIS WRONG ─────────────
  //
  // ArrowUp lands back on the row that HOLDS the edit, and Escape reverts per
  // A3. Pressing it here discarded the very draft the read-back exists to
  // follow: the bar went to `0 changes`, the save bar is hidden at zero, and
  // the click that followed failed with "not clickable" - one mistake wearing
  // two costumes, and the second one reads like a layout defect.
  //
  // Enter is the right key: it commits and, having no further target it wants,
  // leaves the draft standing for the save.
  await p.keyboard.press('Enter')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const mid = await recordState(tb.bedId)
  check(mid.revision === before.revision,
    `no record-wide save fired across the pass: still revision ${mid.revision}`)

  const bar = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return v.querySelector('[data-testid="dirty-count"]')?.textContent?.trim() ?? null
  })
  console.log(`  the bar reads "${bar}"`)
  check(/1 change/.test(bar ?? ''), `and the bar holds the one commit as UNSAVED ("${bar}")`)

  await p.screenshot({ path: `${OUT}rk2-reference-${tb.bedId.slice(0, 8)}.png` })
  console.log(`  screenshot: ${OUT}rk2-reference-${tb.bedId.slice(0, 8)}.png`)

  // ── READ BACK FROM THE DATABASE, which is what the ruling asks for ─────
  // ── WHICH SAVE BUTTON? A document-wide selector answers for whatever is in
  // the DOM, and this page carries more than one.
  //
  // `p.click('[data-testid="save-all"]')` failed with "not clickable" while the
  // bar plainly read `1 change`. The cause was not the sticky bar and not the
  // scroll: the shell holds several screens resident at once, so the FIRST
  // match in the document is not this view's. Verification 25's too-wide
  // population, arriving in a click rather than in a count.
  //
  // So the button is found WITHIN this view, and the probe says which one it
  // pressed instead of trusting document order.
  const saves = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const all = Array.from(document.querySelectorAll('[data-testid="save-all"]'))
    return {
      inDocument: all.length,
      inView: all.filter((b) => v.contains(b)).length,
      clickable: all.map((b) => {
        const r = b.getBoundingClientRect()
        return { inView: v.contains(b), w: Math.round(r.width), h: Math.round(r.height),
          hidden: b.offsetParent === null, disabled: b.disabled }
      }),
    }
  })
  console.log(`  save controls: ${JSON.stringify(saves)}`)
  check(saves.inView >= 1, `this view has a save control of its own (${saves.inView} of ${saves.inDocument} in the document)`)

  const clicked = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const btn = Array.from(document.querySelectorAll('[data-testid="save-all"]'))
      .find((b) => v.contains(b) && b.offsetParent !== null && !b.disabled)
    if (!btn) return false
    btn.scrollIntoView({ block: 'center' })
    btn.click()
    return true
  })
  check(clicked, 'and it was reachable and enabled, so the click landed')
  await settle(() => {
    const v = document.getElementById('view-test-bed-detail')
    return (v.querySelector('[data-testid="dirty-count"]')?.textContent ?? '').startsWith('0')
  })
  const after = await recordState(tb.bedId)
  check(after.revision > before.revision, `Save DID write: revision ${before.revision} -> ${after.revision}`)
  console.log(`  ${a} in the database: ${JSON.stringify(after.payload[a])} (was ${JSON.stringify(before.payload[a])})`)
  check(String(after.payload[a] ?? '').endsWith('X') && after.payload[a] !== before.payload[a],
    `the keyboard-entered value reached the DATABASE (${JSON.stringify(after.payload[a])})`)
} finally {
  await b.close()
  console.log(`\n  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
