// ── ONE HANDLER, WHICHEVER BANNER THE CLICK CAME FROM ────────────────────
//
// Round 41, 2026-09-03. decideRequest was bound to the STAGE banner's ids, and
// the pricing-approval banner calls the same handler. On that surface the
// pending state, the double-click guard and every refusal message were lost:
// `buttons` was empty and the message was written to an element that is not on
// the banner the person is looking at.
//
// THE SILENT REFUSAL IS THE HALF THAT MATTERS. A pricing decide that failed
// said nothing at all, which is very likely why the version-gate defect
// presented as "clicking does nothing".
//
// Both surfaces are measured for all three properties, because a fix proven on
// one banner is exactly the fault being repaired.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('decision-feedback')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const TAG = process.argv[2] ?? 'R41FB'

const { data: allSeats, error: seatErr } = await db.from('track_approvers')
  .select('user_id').eq('record_type', 'opportunity')
if (seatErr) throw seatErr
const otherUser = (allSeats ?? []).map((r) => r.user_id).find((u) => u !== session.user.id)
if (!otherUser) throw new Error('no second identity in track_approvers')

// TWO SURFACES, TWO FIXTURES. A review request at Proposal renders the pricing
// banner; a transition request at Solution Alignment renders the freeze banner.
const surfaces = []
for (const [kind, stage, toStage, host] of [
  ['review', 'Proposal', 'Evaluation', 'opp-review-banner'],
  ['transition', 'Solution Alignment', 'Proposal', 'opp-freeze-banner'],
]) {
  const { oppId } = await freshOpportunity(`${TAG}${kind === 'review' ? 'RV' : 'TX'}`)
  const { error: uErr } = await db.from('records').update({ status: stage }).eq('id', oppId)
  if (uErr) throw uErr
  const { data: rev, error: rvErr } = await db.from('record_revisions').select('revision_number')
    .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1).maybeSingle()
  if (rvErr) throw rvErr
  const { data: req, error: qErr } = await db.from('transition_requests').insert({
    record_id: oppId, record_type: 'opportunity', from_stage: stage, to_stage: toStage,
    kind, status: 'open', frozen_revision: rev.revision_number, requested_by: otherUser,
  }).select('id').single()
  if (qErr) throw qErr
  const { data: seats, error: sErr } = await db.from('track_approvers').insert(
    ['Commercial', 'Legal'].map((track) => ({
      record_type: 'opportunity', track, user_id: session.user.id, record_id: oppId,
    }))).select('id')
  if (sErr) throw sErr
  surfaces.push({ kind, stage, host, oppId, reqId: req.id, seatIds: (seats ?? []).map((r) => r.id) })
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]))
// The decide's own answer, so a missing message is never confused with a
// missing REFUSAL. Verification 14: a check that passes with nothing on either
// side is not a check, and one that fails with nothing on either side is not a
// finding.
const posts = []
page.on('response', async (r) => {
  if (r.url().includes('/approvals') && r.request().method() === 'POST') {
    posts.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 90)}`)
  }
})
await page.setViewport({ width: 1600, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

for (const s of surfaces) {
  const what = s.kind === 'review' ? 'pricing banner' : 'stage banner'
  await page.evaluate((id) => navigate('opportunity-detail', id), s.oppId)
  // Wait on the exact state the assertions read: a decision control INSIDE the
  // banner this surface owns. Counterfactual: the other surface's banner is
  // absent on this record, so the selector cannot be satisfied by the previous
  // record's panel. Verification 7.
  await page.waitForFunction(
    (host) => document.querySelectorAll(`#${host} [data-decision-track]`).length > 0,
    { timeout: 25000 }, s.host)

  // ── THE PENDING STATE AND THE DOUBLE-CLICK GUARD ──────────────────────
  // Measured SYNCHRONOUSLY: the guard runs before the handler's first await,
  // so a wait here would measure the state after the round trip instead.
  const onClick = await page.evaluate((host) => {
    const btns = [...document.querySelectorAll(`#${host} button`)]
    const approve = btns.find((b) => (b.getAttribute('onclick') ?? '').includes("'approved'"))
    approve.click()
    return {
      clickedDisabled: approve.disabled,
      clickedText: approve.textContent.trim(),
      allDisabled: btns.every((b) => b.disabled),
      buttonCount: btns.length,
    }
  }, s.host)
  record(`${what}: the clicked control says what it is doing`,
    onClick.clickedText === 'Approving...', `"${onClick.clickedText}"`)
  record(`${what}: the double-click window is guarded`,
    onClick.clickedDisabled && onClick.allDisabled,
    `${onClick.buttonCount} control(s), all disabled=${onClick.allDisabled}`)

  // ── THE SUCCESS PATH STILL RECORDS ────────────────────────────────────
  let row = null
  for (let i = 0; i < 30 && !row; i++) {
    const { data, error } = await db.from('approvals').select('track, decision, approver_id')
      .eq('request_id', s.reqId).eq('decision', 'approved').limit(1).maybeSingle()
    if (error) throw error
    row = data
    if (!row) await new Promise((r) => setTimeout(r, 400))
  }
  record(`${what}: the approval is recorded`,
    !!row && row.approver_id === session.user.id,
    row ? `${row.track} by the signed-in user` : 'NO ROW')

  // ── A REFUSAL IS VISIBLE, ON THIS BANNER ──────────────────────────────
  //
  // ── WAIT FOR THE PANEL TO SETTLE, NOT FOR THE ROW ─────────────────────
  //
  // The recorded row appears BEFORE done() finishes reloading the panel, so the
  // step above is a proxy for "the screen is ready" and not the thing itself.
  // Measured: the refusal click landed on controls still reading "Approving...",
  // disabled, pointer-events none, and did nothing at all - POST none - which
  // the probe then reported as a missing message. Verification 6, and the
  // fourth instance in this project of a wait on a proxy set earlier in the
  // same render.
  //
  // Counterfactual: mid-reload a control DOES read "Approving...", so this
  // condition is not already true in the state being waited out.
  await page.waitForFunction((host) => ![...document.querySelectorAll(`#${host} button`)]
    .some((b) => b.textContent.includes('Approving')), { timeout: 20000 }, s.host)

  // CONSTRUCTED SO THE SURFACE SURVIVES THE REFUSAL, which took three attempts
  // and the discarded two are the useful part of this comment.
  //
  // Flipping the request to be one the session user raised DOES refuse, and it
  // empties may_decide, so the banner returns with zero decision controls.
  // Moving the request's from_stage refuses too, and the banner hides its
  // controls for a request that no longer matches the record: measured, 0
  // controls, so there is nothing left to click and no refusal can be reached
  // through the screen at all.
  //
  // THE SEAT IS REVOKED INSTEAD, which is what actually happens to somebody
  // with the screen already open. The controls were rendered when the seat
  // existed, the request stays open and matching, and the click therefore
  // reaches the server and is refused there. No re-navigation, because a reload
  // is what would take the button away.
  // BOTH seats, not one. Revoking a single track and then clicking "the first
  // approve control" reaches a track that is still authorised, which answers
  // 200: the probe then measured an absent message on a decide that had
  // SUCCEEDED, and reported it as the defect it was written to catch.
  const { error: revokeErr } = await db.from('track_approvers')
    .delete().in('id', s.seatIds)
  if (revokeErr) throw revokeErr
  posts.length = 0
  const controlsNow = await page.evaluate((host) =>
    JSON.stringify([...document.querySelectorAll(`#${host} button`)]
      .filter((b) => (b.getAttribute('onclick') ?? '').includes("'approved'"))
      .map((b) => ({ t: b.textContent.trim().slice(0, 14), d: b.disabled,
                     pe: getComputedStyle(b).pointerEvents }))), s.host)
  await page.evaluate((host) => {
    const btns = [...document.querySelectorAll(`#${host} button`)]
    const approve = btns.find((b) => (b.getAttribute('onclick') ?? '').includes("'approved'"))
    if (!approve) throw new Error('no approve control left to refuse')
    approve.click()
  }, s.host)
  // THE BANNER FIRST, THE FLOOR IF THE BANNER IS GONE, and the probe reports
  // WHICH carried it. Both are correct outcomes and they are not the same
  // event: a refusal that leaves the surface standing belongs on it, and one
  // that dissolves its own surface still has to be readable somewhere.
  const shown = await page.waitForFunction((host) => {
    const inBanner = (document.querySelector(`#${host} [data-decision-feedback]`)?.innerText ?? '').trim()
    if (inBanner) return { where: 'the banner', text: inBanner }
    const onFloor = (document.getElementById('opp-decision-feedback')?.innerText ?? '').trim()
    if (onFloor) return { where: 'the floor', text: onFloor }
    return false
  }, { timeout: 15000, polling: 100 }, s.host).then((h) => h.jsonValue()).catch(() => null)
  record(`${what}: a REFUSED decide is VISIBLE, not silent`,
    !!shown && /not an approver/i.test(shown.text),
    shown ? `on ${shown.where}: "${shown.text.replace(/\s+/g, ' ').slice(0, 62)}"`
      : `NOTHING RENDERED (approve controls=${controlsNow}, POST: ${posts.join(' | ') || 'none'})`)
}

record('no page errors on either surface', pageErrors.length === 0,
  pageErrors.join(' | ') || 'none')

await browser.close()
for (const s of surfaces) {
  // The second seat is revoked mid-probe by design; delete() on a missing id
  // is not an error, so this stays a single enumerated teardown.
  const { error } = await db.from('track_approvers').delete().in('id', s.seatIds)
  if (error) throw error
  void 0
}
await tearDown()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
