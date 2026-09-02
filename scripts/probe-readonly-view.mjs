// Another user's record is read only at load. Round 41 W1.
//
// ── WHAT IS MEASURED, AND IT IS NOT "THE BANNER IS THERE" ─────────────────
//
// The walk selected seven assessment scores and typed seven reasons on a record
// it did not own, and was refused per row at Record, seven times, after the
// work. So the claim is about what a person can DO, not about what is on the
// page: every input, textarea and select on the view must be non-interactive,
// and the reason must be stated once, at the top.
//
// CLAUDE.md Verification 27: pointer-events is the property a person
// experiences. Dimming alone is what the walk already had.
//
// TWO RECORDS, which is the whole instrument. A probe that only visited a
// record the session does not own would report "everything is locked" against a
// build that locks everything, including your own deals. Verification 17.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-readonly-view.mjs')
import { readFileSync, mkdirSync, statSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const OUT = new URL('../.verify/readonly/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// NOT MINE: owned by john@, and the dev session is john+test@.
// MINE: created by this session through the API, immediately before the run.
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const { freshOpportunity, tearDown, admin } = await import('./fixtures.mjs')
const { oppId: MINE } = await freshOpportunity('readonly-probe')

// ── AN APPROVER'S RECORD: NOT MINE, AND I MAY DECIDE ON IT ───────────────
//
// The decision half of this probe asserts nothing without a record where this
// identity is BOTH a non-owner AND server-authorised on a track. Neither
// existing fixture is that: one is mine, and the other has no open request, so
// the check read 0 of 0 and passed - the same false-pass shape as the "0 actions
// clickable" it replaced.
//
// Built rather than found: an opportunity handed to another owner, a review
// request raised BY that owner, and this session named as a Commercial approver
// scoped to this record alone.
const { oppId: APPROVING } = await freshOpportunity('readonly-approver')
const OTHER_OWNER = '75425a02-0000-0000-0000-000000000000'
let approverRowId = null
{
  const db = admin()
  const { data: owner } = await db.from('track_approvers')
    .select('user_id').eq('record_type', 'opportunity').limit(1).maybeSingle()
  const otherOwner = owner?.user_id ?? OTHER_OWNER
  // AT PROPOSAL, because a pricing approval collects the VERSION-SCOPED tracks
  // and those exist only from Proposal onward. Raised on Qualification ->
  // Solution Alignment the request opens with no tracks and renders no
  // controls, which is what the first version of this fixture did: it measured
  // 0 of 0 and reported the same false pass it was written to remove.
  await db.from('records').update({ owner_id: otherOwner, status: 'Proposal' }).eq('id', APPROVING)
  const { data: rev } = await db.from('record_revisions').select('revision_number')
    .eq('record_id', APPROVING).order('revision_number', { ascending: false }).limit(1).maybeSingle()
  const { data: req } = await db.from('transition_requests').insert({
    record_id: APPROVING, record_type: 'opportunity', from_stage: 'Proposal',
    to_stage: 'Evaluation', kind: 'review', status: 'open',
    frozen_revision: rev?.revision_number ?? 1, requested_by: otherOwner,
  }).select('id').single()
  void req
  const { data: seat } = await db.from('track_approvers').insert({
    record_type: 'opportunity', track: 'Commercial',
    user_id: session.user.id, record_id: APPROVING,
  }).select('id').single()
  approverRowId = seat?.id ?? null
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const rows = []

for (const width of [1240, 1920]) {
  for (const [label, id] of [['not mine', NOT_MINE], ['mine', MINE], ['approver', APPROVING]]) {
    await page.setViewport({ width, height: 900 })
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((rid) => navigate('opportunity-detail', rid), id)
    // Verification 7. The reference tab's display name is set by the record's
    // own render and is empty before it, and it differs between the two records.
    await page.waitForFunction(() => {
      const el = document.getElementById('ref-display-name') || document.getElementById('detail-company')
      return el && el.textContent.trim().length > 0
    }, { timeout: 25000 }).catch(() => {})

    const state = await page.evaluate(() => {
      const view = document.getElementById('view-opportunity-detail')
      const banner = document.getElementById('opp-readonly-banner')
      // ── ENUMERATED BY BEHAVIOUR, NOT BY TAG. 2026-09-02 ─────────────────
      //
      // This read `input, textarea, select` - THE SAME THREE TAGS THE CSS RULE
      // NAMES. The rule and the instrument that checks it shared one blind
      // spot, so the probe confirmed the rule against the rule's own
      // assumptions and reported green while eighteen elements that behave as
      // controls stayed live on another user's record.
      //
      // A div with an onclick that opens an editor is a control. It is now
      // counted as one, so a control added later in a shape nobody has thought
      // of yet is measured rather than missed.
      // ── THE THIRD CATEGORY, AND WHY "0 CLICKABLE" WAS A FALSE PASS ──────
      //
      // This probe reported "0 actions clickable on another user's record" and
      // called it a pass. An APPROVER IS ALWAYS A NON-OWNER, and approving is
      // the one action they exist to take, so a zero here was ALSO the state
      // where the approve controls had been disabled and nobody could sign off.
      // The measure could not tell a locked record from a broken one.
      //
      // It now measures three categories separately, and a pass requires all
      // three to be right at once:
      //
      //   blocked   Mark Closed Lost, Withdraw, Save changes - a non-owner
      //             must not reach them
      //   allowed   a decision control the SERVER authorised for this identity
      //   nav       tabs and back - must keep working, or a read-only record
      //             stops being readable
      const decisionControls = [...view.querySelectorAll('[data-decision-track]')]
      const decisionsUsable = decisionControls.filter(
        (el) => !el.disabled && getComputedStyle(el).pointerEvents !== 'none')
      const withdrawBtn = [...view.querySelectorAll('button')]
        .find((b) => /withdraw/i.test(b.textContent))
      const closeLostBtn = document.getElementById('opp-close-lost-btn')
      const formControls = [...view.querySelectorAll('input, textarea, select')]
      const editOpeners = [...view.querySelectorAll(
        '.ref-field-display, .cd-name-display, .deal-toggle, [role="switch"]')]
      const controls = [...formControls, ...editOpeners]
      // THE PROPERTY A PERSON EXPERIENCES, and it takes two questions now:
      // pointer-events stops a mouse, `disabled` and tabindex stop a keyboard,
      // and the reported defect went through the keyboard on a select that had
      // only the first.
      const interactive = controls.filter((el) => {
        if (getComputedStyle(el).pointerEvents === 'none'
          && (el.disabled === true || el.getAttribute('tabindex') === '-1')) return false
        return true
      })
      return {
        klass: view.classList.contains('is-not-mine'),
        bannerText: (banner?.textContent ?? '').trim(),
        controls: controls.length,
        formControls: formControls.length,
        editOpeners: editOpeners.length,
        interactive: interactive.length,
        firstInteractive: interactive[0]?.id || interactive[0]?.className || interactive[0]?.tagName || null,
        decisionControls: decisionControls.length,
        decisionsUsable: decisionsUsable.length,
        withdrawBlocked: withdrawBtn ? withdrawBtn.disabled === true : null,
        closeLostBlocked: closeLostBtn ? closeLostBtn.disabled === true : null,
      }
    })

    const file = `${OUT}readonly-${width}-${label.replace(' ', '-')}.png`
    const rect = await page.evaluate(() => {
      const b = document.getElementById('opp-readonly-banner')
      b.scrollIntoView({ block: 'start' })
      const r = b.getBoundingClientRect()
      return { x: 0, y: Math.max(0, r.y - 8), width: window.innerWidth,
        height: Math.min(window.innerHeight - Math.max(0, r.y - 8), Math.max(r.height, 40) + 260) }
    })
    await page.screenshot({ path: file, clip: rect })
    rows.push({ width, label, ...state, bytes: statSync(file).size })
  }
}

console.log('\n  ANOTHER USER\'S RECORD IS READ ONLY. Round 41 W1.\n')
console.log('  width  record     is-not-mine  controls  typeable  decisions usable  closeLost blocked')
for (const r of rows) {
  console.log(`  ${String(r.width).padEnd(6)} ${r.label.padEnd(10)} ${String(r.klass).padEnd(12)} ` +
    `${String(r.controls).padEnd(9)} ${String(r.interactive).padEnd(9)} ` +
    `${String(r.decisionsUsable + '/' + r.decisionControls).padEnd(17)} ${r.closeLostBlocked}`)
}

const fail = []
for (const width of [1240, 1920]) {
  const not = rows.find((r) => r.width === width && r.label === 'not mine')
  const mine = rows.find((r) => r.width === width && r.label === 'mine')
  const appr = rows.find((r) => r.width === width && r.label === 'approver')
  // THE DECISION HALF, on the record built for it. Absent controls are a
  // FAILURE here rather than a silent pass: 0 of 0 is what the old measure
  // reported while nobody could approve.
  if (!appr || appr.decisionControls === 0) {
    fail.push(`${width}: no server-authorised decision control was rendered, so the decision half measured nothing`)
  } else if (appr.decisionsUsable !== appr.decisionControls) {
    fail.push(`${width}: ${appr.decisionControls - appr.decisionsUsable} of ${appr.decisionControls} `
      + 'authorised decision controls are blocked on a record this identity does not own')
  }
  if (appr && appr.withdrawBlocked === false) {
    fail.push(`${width}: an approver can withdraw the requester's own request`)
  }
  if (!not.klass) fail.push(`${width}: another user's record does not carry is-not-mine`)
  if (mine.klass) fail.push(`${width}: YOUR OWN record carries is-not-mine`)
  if (not.controls < 20) fail.push(`${width}: only ${not.controls} controls found, so this may not have reached the view`)
  if (not.interactive !== 0) fail.push(`${width}: ${not.interactive} controls are still typeable on another user's record, first is ${not.firstInteractive}`)

  // ── THE THREE CATEGORIES, ASSERTED TOGETHER ──────────────────────────
  //
  // Each alone is satisfiable by a wrong screen: block everything and the
  // first passes while nobody can approve; allow everything and the third
  // passes while a non-owner closes the deal. Only the conjunction describes
  // a correct read-only record.
  if (not.closeLostBlocked === false) {
    fail.push(`${width}: a non-owner can click Mark Closed Lost`)
  }
  if (not.withdrawBlocked === false) {
    fail.push(`${width}: a non-owner can withdraw somebody else's request`)
  }
  // The decision half only asserts where a decision control is actually
  // rendered. Reported either way rather than passing silently, because an
  // absent control is the shape that made the old "0 clickable" a false pass.
  if (not.decisionControls > 0 && not.decisionsUsable !== not.decisionControls) {
    fail.push(`${width}: ${not.decisionControls - not.decisionsUsable} of `
      + `${not.decisionControls} server-authorised decision controls are blocked - `
      + 'an approver is always a non-owner and this is the one action they exist to take')
  }
  if (mine.interactive === 0) fail.push(`${width}: NOTHING is typeable on your own record either, so the lock is not discriminating`)
  if (!/belongs to another user/.test(not.bannerText)) fail.push(`${width}: the reason is not stated on the unowned record`)
  if (mine.bannerText) fail.push(`${width}: a read-only banner is showing on your own record`)
  if (not.bytes < 3000 || mine.bytes < 3000) fail.push(`${width}: a capture is under 3KB and is probably blank`)
}
console.log('')
if (fail.length) for (const f of fail) console.log('  FAILED  ' + f)
else console.log('  PASS  locked and stated on another user\'s record, untouched on your own, at both widths')
console.log(`\n  captures: ${OUT}\n`)
await browser.close()
// The track_approvers seat is residue the fixture tag cannot see: it is not a
// record, so tearDown does not reach it. Removed here and re-queried, because a
// stray approver seat would silently widen who may decide on a live record.
if (approverRowId) {
  const db = admin()
  await db.from('track_approvers').delete().eq('id', approverRowId)
  const { count } = await db.from('track_approvers')
    .select('id', { count: 'exact', head: true }).eq('id', approverRowId)
  if (count !== 0) console.log(`  WARNING: the probe's approver seat ${approverRowId} survived teardown`)
}
await tearDown()
process.exit(fail.length ? 1 : 0)
