// UI STANDARDS - LEADS, Phase 0: the Leads card against INTERACTION_STANDARDS.
//
// READ-ONLY except its own fixtures.
//
// Sections 4 and 5 govern in-page dialogues and unsaved-changes. The card
// opens two. Section 5's own cited implementations are GONE - contact-detail.js
// was retired in the migration - so the standard is measured against the CARD
// rather than against the document's dead examples.
//
// Artefacts are `usl-p0-*` (Verification 44's lineage clause).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-conformance.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/usl/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const R = []
const check = (section, claim, ok, detail = '') => {
  R.push({ section, claim, ok })
  console.log(`  ${ok ? 'CONFORMS ' : 'DIVERGES '} [${section}] ${claim}${detail ? `   ${detail}` : ''}`)
}

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
    owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
    payload: { name: `usl0 ${label}`, company: 'Standards Co', source: 'Referral', ...payload },
    created_by: OWNER.user.id }).select().single(), `rev ${label}`)
  return r
}
// One fixture per claim group. Verification 7: a fixture consumed by an
// earlier claim cannot serve a later one, and the third-case test SAVES.
const dialogs = await mk('Dialogs', { summary: 'A summary.', address: '1 Way', city: 'Singapore' })
const thirdCase = await mk('ThirdCase', { summary: 'Original summary text.' })
const created = [dialogs.id, thirdCase.id]
console.log(`fixtures: ${created.join(' ')}\n`)

// ── VISIBILITY IS COMPUTED, NEVER READ OFF AN ATTRIBUTE ─────────────────
//
// The first version of this probe asked `!el.hidden` for the shared discard
// modal. That element is hidden by the `hidden` CLASS, so the IDL attribute
// reads FALSE whether it is showing or not, and three Section 5 checks
// reported CONFORMS on an element that was never displayed. Verification 4's
// own clause: an attribute assertion is not a visibility assertion.
const VISIBLE = `(sel) => {
  const e = document.querySelector(sel)
  if (!e) return false
  const s = getComputedStyle(e)
  if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
  const b = e.getBoundingClientRect()
  return b.width > 0 && b.height > 0
}`

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async (id) => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, id)
  }
  const visible = (sel) => page.evaluate(`(${VISIBLE})(${JSON.stringify(sel)})`)
  const active = () => page.evaluate(() => {
    const a = document.activeElement
    return a ? (a.dataset?.testid || a.id || a.tagName.toLowerCase()) : '(none)'
  })

  // CALIBRATE THE VISIBILITY HELPER before any claim rests on it. The shared
  // discard modal is the exact element the first version got wrong, so it is
  // the anchor: hidden by class now, shown by removing the class.
  const calHidden = await visible('#discard-confirm-modal')
  await page.evaluate(() => document.getElementById('discard-confirm-modal').classList.remove('hidden'))
  const calShown = await visible('#discard-confirm-modal')
  await page.evaluate(() => document.getElementById('discard-confirm-modal').classList.add('hidden'))
  console.log(`CALIBRATION  the discard modal reads hidden when hidden: ${calHidden === false}`)
  console.log(`             and visible when shown:                    ${calShown === true}`)
  if (calHidden !== false || calShown !== true) {
    console.log('CALIBRATION FAILED - the visibility helper is not evidence'); process.exit(1)
  }
  console.log('')

  // ═══ SECTION 4: focus trapping in in-page dialogues ═══════════════════
  console.log('=== SECTION 4: in-page dialogues (the card opens two) ===\n')
  for (const dlg of [
    { name: 'ADDRESS POPUP', open: (x) => `[data-testid="lead-address-${x}"]`,
      root: (x) => `[data-testid="address-popup-${x}"]`, first: (x) => `addr-address-${x}` },
    { name: 'NURTURE DIALOGUE', open: (x) => `[data-testid="lead-nurture-${x}"]`,
      root: () => '[data-testid="nurture-dialog"]', first: () => 'nurture-date' },
  ]) {
    await page.reload({ waitUntil: 'networkidle0' }); await go(dialogs.id)
    const opener = dlg.open(dialogs.id)
    await page.click(opener)
    await page.waitForSelector(dlg.root(dialogs.id), { timeout: 10000 })
    // 4a: focus moves to the panel's first focusable field on open.
    const focused = await active()
    check('4', `${dlg.name}: focus moves into the dialogue on open`,
      focused === dlg.first(dialogs.id), `focus is on "${focused}", expected "${dlg.first(dialogs.id)}"`)
    // 4b: Tab is confined to the dialogue's own controls.
    const inside = await page.evaluate(async (rootSel) => {
      const root = document.querySelector(rootSel)
      const seen = []
      for (let i = 0; i < 12; i++) {
        const a = document.activeElement
        seen.push(root.contains(a))
        // Tab must be driven by the browser, so this is done outside.
        if (!a) break
        break
      }
      return seen
    }, dlg.root(dialogs.id))
    let escaped = false
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const within = await page.evaluate((s) => {
        const r = document.querySelector(s)
        return !!r && r.contains(document.activeElement)
      }, dlg.root(dialogs.id))
      if (!within) { escaped = true; break }
    }
    check('4', `${dlg.name}: Tab is confined to the dialogue`, !escaped,
      escaped ? 'focus left the dialogue within 12 tabs' : 'focus stayed inside for 12 tabs')
    // 4c: Escape closes, and focus returns to the control that opened it.
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 400))
    const stillOpen = await page.evaluate((s) => !!document.querySelector(s), dlg.root(dialogs.id))
    check('4', `${dlg.name}: Escape closes it`, !stillOpen)
    if (!stillOpen) {
      const back = await active()
      const want = opener.replace(/^\[data-testid="|"\]$/g, '')
      check('4', `${dlg.name}: focus returns to the control that opened it`,
        back === want, `focus is on "${back}", expected "${want}"`)
    }
  }

  // ═══ SECTION 5: unsaved changes ═══════════════════════════════════════
  console.log('\n=== SECTION 5: unsaved changes ===\n')
  await page.reload({ waitUntil: 'networkidle0' }); await go(dialogs.id)
  await page.click(`[data-testid="lead-address-${dialogs.id}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${dialogs.id}"]`, { timeout: 10000 })
  const city = `[data-testid="addr-city-${dialogs.id}"]`
  await page.click(city); await page.keyboard.type('Dirtied')
  // 5a: a backdrop click while dirty is REFUSED, with a nudge.
  await page.evaluate((x) => {
    const bd = document.querySelector(`[data-testid="address-popup-${x}"]`)
    bd.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, dialogs.id)
  await new Promise((r) => setTimeout(r, 400))
  const afterBackdrop = {
    open: await visible(`[data-testid="address-popup-${dialogs.id}"]`),
    warn: await visible('.msg-warning'),
    attention: await visible('.btn-attention'),
  }
  check('5', 'ADDRESS POPUP: a backdrop click while dirty is refused', afterBackdrop.open)
  check('5', 'ADDRESS POPUP: and it nudges (.msg-warning / .btn-attention)',
    afterBackdrop.warn || afterBackdrop.attention,
    `msg-warning ${afterBackdrop.warn}, btn-attention ${afterBackdrop.attention}`)
  // 5b: an intentional leave while dirty opens the shared discard dialogue.
  if (afterBackdrop.open) {
    await page.click(`[data-testid="addr-close-${dialogs.id}"]`)
    await new Promise((r) => setTimeout(r, 500))
    const afterClose = {
      popup: await visible(`[data-testid="address-popup-${dialogs.id}"]`),
      confirm: await visible('#discard-confirm-modal'),
    }
    check('5', 'ADDRESS POPUP: Close while dirty asks before discarding',
      afterClose.confirm, afterClose.confirm ? '' : `it closed silently and the edit is gone (popup open ${afterClose.popup})`)
  }

  // 5c: THE THIRD CASE - an unrelated deliberate action clobbering a dirty
  // field elsewhere on the same card. Section 5 names this explicitly.
  await page.reload({ waitUntil: 'networkidle0' }); await go(thirdCase.id)
  const sum = `[data-testid="lead-summary-input-${thirdCase.id}"]`
  await page.click(sum); await page.keyboard.type(' EDITED BUT UNSAVED')
  const typed = await page.evaluate((s) => document.querySelector(s).value, sum)
  await page.click(`[data-testid="lead-notes-${thirdCase.id}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${thirdCase.id}"] [data-testid="cd-new-note-input"]`, { timeout: 8000 })
  await page.click(`[data-testid="lead-notes-${thirdCase.id}"] [data-testid="cd-new-note-input"]`)
  await page.keyboard.type('A note that triggers a reload')
  await page.click(`[data-testid="lead-notes-${thirdCase.id}"] [data-testid="cd-add-note-btn"]`)
  await new Promise((r) => setTimeout(r, 2500))
  const askedThen = await visible('#discard-confirm-modal')
  const summaryAfter = await page.evaluate((s) => document.querySelector(s)?.value ?? '(gone)', sum)
  check('5', 'THIRD CASE: adding a note asks before clobbering a dirty Summary',
    askedThen || summaryAfter === typed,
    `asked ${askedThen}; Summary was "${typed}" and is now "${summaryAfter}"`)

  // ═══ SECTION 6 + THE PRINCIPLE: what each action acts on ══════════════
  console.log('\n=== THE PRINCIPLE: what does each control act on, and where does it sit? ===\n')
  await page.reload({ waitUntil: 'networkidle0' }); await go(dialogs.id)
  const scopes = await page.evaluate((x) => {
    const card = document.querySelector(`[data-testid="lead-card-${x}"]`)
    const head = card.querySelector('.lead-card-head')
    const cols = [...card.querySelectorAll('.lead-card-col')]
    const where = (el) => {
      if (!el) return 'absent'
      if (head && head.contains(el)) return 'RECORD BAR (card head)'
      const c = cols.find((k) => k.contains(el))
      if (c) return `PANEL: ${(c.dataset.testid || '').replace(`-${x}`, '')}`
      return 'elsewhere'
    }
    const one = (tid) => {
      const el = card.querySelector(`[data-testid="${tid}"]`)
      return { tid, present: !!el, at: where(el) }
    }
    return [
      one(`lead-qualify-${x}`), one(`lead-nurture-${x}`), one(`lead-followup-btn-${x}`),
      one(`lead-address-${x}`), one(`lead-summary-save-${x}`),
      one('cd-add-note-btn'), one('cd-followup-save'),
    ]
  }, dialogs.id)
  const ACTS_ON = {
    'lead-qualify': 'the RECORD (advances it)', 'lead-nurture': 'the RECORD (advances it)',
    'lead-followup-btn': 'the FOLLOW-UP PANEL (reveals it)',
    'lead-address': 'the ADDRESS fields (opens their dialogue)',
    'lead-summary-save': 'the SUMMARY PANEL', 'cd-add-note-btn': 'the NOTES PANEL',
    'cd-followup-save': 'the FOLLOW-UP PANEL',
  }
  for (const s of scopes) {
    const key = s.tid.replace(/-[0-9a-f-]{36}$/, '')
    const acts = ACTS_ON[key] ?? '?'
    const recordScoped = acts.startsWith('the RECORD')
    const onBar = s.at.startsWith('RECORD BAR')
    const ok = s.present ? (recordScoped === onBar) : null
    console.log(`  ${ok === null ? 'absent   ' : ok ? 'CONFORMS ' : 'DIVERGES '} ${key.padEnd(20)} acts on ${acts.padEnd(34)} sits on ${s.at}`)
    if (s.present) R.push({ section: 'PRINCIPLE', claim: `${key} sits with its scope`, ok })
  }

  console.log('\n=== TALLY ===')
  const byS = {}
  for (const r of R) { (byS[r.section] ??= { ok: 0, no: 0 })[r.ok ? 'ok' : 'no']++ }
  for (const [s, v] of Object.entries(byS))
    console.log(`  Section ${s.padEnd(10)} conforms ${v.ok}, diverges ${v.no}`)
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
