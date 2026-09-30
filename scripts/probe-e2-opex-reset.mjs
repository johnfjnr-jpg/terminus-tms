// ── E2, E3 AND E4: THE RESET FROM THE CLICK ─────────────────────────────
//
// R-RS1 to R-RS4 driven in a browser on real OPEX deals the ROUTE saved, and
// read off the screen a person reads.
//
// ── WHY THE COUNTERFACTUAL IS FIRST ─────────────────────────────────────
//
// R-RS2's claim is an ABSENCE, and an absence is what a broken probe reports
// too (Verification 13). So the no-overrides deal is measured FIRST, and the
// same selector is then shown returning a control on the deal beside it. A
// null from `reset()` means something only because the instrument has been
// seen returning non-null on the same page in the same run.
//
// ── AND WHY "DISCARD RESTORES" IS NOT ASSERTED ──────────────────────────
//
// The brief's R-RS3 says the sticky Save/Discard bar governs and Discard
// restores the overrides. MEASURED: the Commercials surface has no Discard
// control, and `navigate()`'s discard guard covers assessment drafts only
// (app.js:359). Nothing prompts and nothing reverts in place.
//
// What makes the reset reversible is that it writes NOTHING until a save, so
// the assertion here is the one that is true: reload the record and the
// overrides are back, byte for byte, from the server. That is a stronger
// claim than a button press and it is the one the product actually offers.
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-e2-opex-reset.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin, handOver } from './fixtures.mjs'
import { api } from './api-client.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/opex-reset/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'OPEXRESET'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const FEE_KEYS = ['ss', 'aq', 'hemir']
const BASE = {
  paymentMode: 'opex', structure: 'single',
  ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
  duration: 60, warrantyPct: 0,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
  invoicing: 'monthly',
}
// THREE DEALS, because three claims need three different starting states and a
// fixture consumed by an earlier claim cannot serve a later one (Verification 7).
const DEALS = {
  //  overrides present, target 30
  A: { ...BASE, targetMargin: 30, opexUnitFees: { ss: 700 }, opexUnitMargins: { aq: 41 } },
  //  no overrides at all, same shape otherwise
  B: { ...BASE, targetMargin: 30 },
  //  E3: a DIFFERENT target margin, so the label is shown reading the deal
  C: { ...BASE, targetMargin: 41.5, opexUnitFees: { ss: 700 } },
}

const made = {}
for (const [name, payload] of Object.entries(DEALS)) {
  const { oppId } = await freshOpportunity(`${TAG}${name}`)
  const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { payload, expected_revision: rev })
  made[name] = oppId
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  /** Open a record's Commercials tab and wait on the OPEX table itself. */
  const open = async (oppId) => {
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"]'),
      { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  /** Everything the claims are about, read from within the panel, never the document. */
  const readState = () => p.evaluate((keys) => {
    const q = (s) => document.querySelector(s)
    const btn = q('[data-testid="deal-opex-reset"]')
    const cell = (id) => q(`[data-testid="${id}"]`)
    const cells = {}
    for (const k of keys) {
      for (const kind of ['opexfee', 'opexmargin']) {
        const id = `deal-${kind}-${k}`
        const el = cell(id)
        cells[id] = el ? { value: el.value, override: el.dataset.override } : null
      }
    }
    return {
      present: !!btn,
      label: btn ? (btn.textContent || '').trim() : null,
      icon: btn ? !!btn.querySelector('[data-testid="deal-opex-reset-icon"]') : null,
      cls: btn ? btn.className : null,
      cells,
      counts: {
        ssExisting: q('[data-testid="deal-ssExisting"]')?.value,
        ssNew: q('[data-testid="deal-ssNew"]')?.value,
        aqm: q('[data-testid="deal-aqm"]')?.value,
      },
      // VISIBLE dialogs, counted, not "is there a role=dialog in the document".
      //
      // index.html carries FIVE permanently-resident modal panels (new account,
      // park, account details, inline buyer, new test bed), so a document-wide
      // presence test answers for whatever the shell is holding rather than for
      // this click. The first version of this probe asserted presence and went
      // red on an ambient panel (Verification 25's too-wide population).
      // ── WHERE THE CONTROL SITS, AS A RELATION ──────────────────────
      //
      // The mockup settles two things and neither is a property of the
      // button: it is BELOW the table's closing rule, and its right edge
      // lines up with the table's. The first build satisfied every property
      // assertion - present, labelled, dressed, iconed, in the captured
      // region - while rendering ABOVE the table, because `.opex-tables` is
      // a grid that auto-placed an unplaced child into row 1.
      geometry: (() => {
        const t = q('[data-testid="deal-opex-table"]')
        const btn = q('[data-testid="deal-opex-reset"]')
        if (!t || !btn) return null
        const tr = t.getBoundingClientRect(), br = btn.getBoundingClientRect()
        return {
          belowBy: Math.round(br.top - tr.bottom),
          rightEdgeGap: Math.round(tr.right - br.right),
          sameColumn: br.left >= tr.left - 2,
        }
      })(),
      dialogs: [...document.querySelectorAll('[role="dialog"]')]
        .filter((d) => d.offsetParent !== null && d.getBoundingClientRect().height > 0).length,
      tableRows: document.querySelectorAll('[data-testid="deal-opex-table"] tbody tr').length,
    }
  }, FEE_KEYS)

  await p.setViewport({ width: 1920, height: 1200 })

  // ── R-RS2, THE COUNTERFACTUAL FIRST ──────────────────────────────────
  console.log('\n=== B: no overrides ===')
  await open(made.B)
  const noOv = await readState()
  check(noOv.tableRows > 0, 'the OPEX table rendered rows, so the surface is the one under test',
    `${noOv.tableRows} rows`)
  check(noOv.present === false, 'the control is ABSENT with no overrides stored')

  // ── AND THE SAME SELECTOR RETURNS ONE NEXT DOOR ──────────────────────
  console.log('\n=== A: a fee and a margin stored, target 30 ===')
  await open(made.A)
  const before = await readState()
  check(before.present === true,
    'the SAME selector returns the control on a deal that stores overrides')
  check(before.cells['deal-opexfee-ss']?.override === 'true',
    'and the stored fee row is dressed as an override before the click',
    JSON.stringify(before.cells['deal-opexfee-ss']))
  check(before.cells['deal-opexmargin-aq']?.override === 'true',
    'as is the stored margin on another row',
    JSON.stringify(before.cells['deal-opexmargin-aq']))

  // ── R-RS1: THE DRESS AND THE LABEL ───────────────────────────────────
  check(/Reset to target margin/i.test(before.label ?? ''), 'the label names the action',
    before.label)
  check(/\(30%\)/.test(before.label ?? ''), 'and carries THIS deal s target margin',
    before.label)
  check((before.cls ?? '').includes('btn-sm'), 'it wears the estate s outline dress', before.cls)
  check(before.icon === true, 'and carries the circular-arrow icon')

  // ── THE PLACEMENT THE MOCKUP SETTLES, AS A RELATION ──────────────────
  // P-RS1 (2) and (3), John's ruling 2026-09-30. Candidate B: the table and
  // the control share `.opex-fee-block`, which takes the grid placement, so
  // the control follows the table's last row rather than the card's foot.
  const g = before.geometry
  check(g !== null && g.belowBy >= 0 && g.belowBy <= 40,
    'the control sits WITHIN 40px BELOW the table, as candidate B draws it',
    g ? `${g.belowBy}px below the table s bottom edge` : 'no geometry')
  check(g !== null && g.sameColumn,
    'and inside the table s own column rather than beside it',
    g ? `left edge ${g.sameColumn ? 'at or right of' : 'LEFT OF'} the table s` : 'no geometry')

  // ── THE RIGHT EDGE, AT 1920 ONLY, AND THE SCOPE IS THE RULING'S ──────
  //
  // Measured at 1920 because that is the viewport this block runs at. IT IS
  // NOT ASSERTED AT 1240, and the reason is a finding rather than a
  // convenience: at 1240 the invoicing column collides with the fee table
  // (queued item Q1), so the table's measured right edge runs under it and
  // reads 77px wide of the control - IDENTICALLY IN BOTH PLACEMENT
  // CANDIDATES, which is how it was established to be the overprint and not
  // this control. John ruled the 1240 right-edge check out of scope while
  // that overprint stands. When Q1 lands, this assertion extends to 1240 and
  // the exclusion goes.
  check(g !== null && Math.abs(g.rightEdgeGap) <= 4,
    'right-aligned with the table s right edge AT 1920 (1240 out of scope, see Q1)',
    g ? `${g.rightEdgeGap}px inside it` : 'no geometry')

  // ── E4: THE APPROVED PICTURE, BOTH STATES, BOTH WIDTHS ───────────────
  //
  // The table is scrolled into view and CONFIRMED inside the captured region
  // before the shutter, because a capture of pure background passes every
  // programmatic check made against the live DOM (Verification 4).
  const shoot = async (name) => {
    for (const width of [1920, 1240]) {
      await p.setViewport({ width, height: 1200 })
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await p.evaluate(() => document.querySelector('[data-testid="deal-opex-table"]')
        ?.scrollIntoView({ block: 'center' }))
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const inView = await p.evaluate(() => {
        const t = document.querySelector('[data-testid="deal-opex-table"]')
        const rows = t?.querySelectorAll('tbody tr').length ?? 0
        const r = t?.getBoundingClientRect()
        if (!r) return { ok: false, rows }
        return { ok: r.top < window.innerHeight && r.bottom > 0 && r.height > 0, rows,
          top: Math.round(r.top), bottom: Math.round(r.bottom) }
      })
      check(inView.ok && inView.rows > 0,
        `the OPEX table ROWS are inside the captured region for ${name} at ${width}`,
        JSON.stringify(inView))
      await p.screenshot({ path: `${OUT}${name}-${width}.png` })
    }
    await p.setViewport({ width: 1920, height: 1200 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }
  await shoot('overrides-present')

  // ── R-RS3: THE CLICK ─────────────────────────────────────────────────
  console.log('\n=== the click ===')
  await p.evaluate(() => document.querySelector('[data-testid="deal-opex-reset"]')?.click())
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const after = await readState()

  for (const k of FEE_KEYS) {
    for (const kind of ['opexfee', 'opexmargin']) {
      const id = `deal-${kind}-${k}`
      check(after.cells[id]?.override !== 'true', `${id} no longer stores an override`,
        JSON.stringify(after.cells[id]))
    }
  }
  check(after.counts.ssExisting === before.counts.ssExisting
    && after.counts.ssNew === before.counts.ssNew
    && after.counts.aqm === before.counts.aqm,
    'the UNIT COUNTS are untouched',
    `${JSON.stringify(before.counts)} -> ${JSON.stringify(after.counts)}`)
  // Stated as a RELATION between two readings: the click opened no dialog. An
  // absolute "zero dialogs" would be a claim about the whole shell.
  check(after.dialogs === before.dialogs && after.dialogs === 0,
    'NO confirmation dialog stands between the click and the clear',
    `visible dialogs ${before.dialogs} before, ${after.dialogs} after`)

  // ── AND THE COUNTER IS SHOWN REACHING ONE ────────────────────────────
  //
  // A zero from an instrument never seen producing a non-zero is not a
  // measurement (Verification 13). The shell's own new-account modal is
  // revealed by removing `hidden` from its backdrop, counted, and put back -
  // so the reading above is a real zero rather than a broken selector.
  {
    const cal = await p.evaluate(() => {
      const back = document.getElementById('new-account-modal')
      if (!back) return null
      const was = back.classList.contains('hidden')
      back.classList.remove('hidden')
      const seen = [...document.querySelectorAll('[role="dialog"]')]
        .filter((d) => d.offsetParent !== null && d.getBoundingClientRect().height > 0).length
      if (was) back.classList.add('hidden')
      const back2 = [...document.querySelectorAll('[role="dialog"]')]
        .filter((d) => d.offsetParent !== null && d.getBoundingClientRect().height > 0).length
      return { seen, back2, restored: back.classList.contains('hidden') === was }
    })
    check(cal !== null && cal.seen > 0,
      'CALIBRATION: the dialog counter reaches a non-zero on a revealed modal',
      `counted ${cal?.seen}`)
    check(cal !== null && cal.back2 === 0 && cal.restored,
      'and returns to zero with the shell left exactly as it was',
      `after restore ${cal?.back2}, restored=${cal?.restored}`)
  }
  check(after.present === false, 'and the control has gone, having nothing left to clear')
  const shown = after.cells['deal-opexfee-ss']?.value ?? ''
  check(shown !== '' && !Number.isNaN(Number(shown)),
    'the rows RE-DERIVE rather than going blank', `fee cell reads "${shown}"`)
  check(shown !== before.cells['deal-opexfee-ss']?.value,
    'and the derived figure DIFFERS from the override it replaced',
    `${before.cells['deal-opexfee-ss']?.value} -> ${shown}`)

  await shoot('no-overrides')

  // ── R-RS4: NOTHING IS WRITTEN UNTIL A SAVE ───────────────────────────
  //
  // This is the honest form of the brief's "Discard restores": the record is
  // read back from the SERVER, so a reset that had quietly written would fail
  // here whatever the screen says.
  const stillStored = (await api('GET', `/opportunities/${made.A}`)).data?.payload
  check(stillStored?.opexUnitFees?.ss === 700,
    'the click wrote NOTHING: the server still holds the fee', JSON.stringify(stillStored?.opexUnitFees))
  check(stillStored?.opexUnitMargins?.aq === 41,
    'and still holds the margin', JSON.stringify(stillStored?.opexUnitMargins))

  await open(made.A)
  const reopened = await readState()
  check(reopened.present === true && reopened.cells['deal-opexfee-ss']?.override === 'true',
    'and reopening the record RESTORES the overrides from the server',
    JSON.stringify(reopened.cells['deal-opexfee-ss']))

  // ── NOW SAVE, AND READ IT BACK OVER HTTP ─────────────────────────────
  console.log('\n=== reset, then save ===')
  await p.evaluate(() => document.querySelector('[data-testid="deal-opex-reset"]')?.click())
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const saveBtn = await p.evaluate(() => {
    const el = [...document.querySelectorAll('[data-testid^="section-save-"]')]
      .find((e) => e.offsetParent !== null)
    if (el) { el.click(); return el.getAttribute('data-testid') }
    return null
  })
  check(!!saveBtn, 'a section save appeared because the reset made the form dirty', String(saveBtn))
  await p.waitForFunction(() => !document.querySelector('[data-testid^="section-save-"]'),
    { timeout: 25000 }).catch(() => {})
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))

  const saved = (await api('GET', `/opportunities/${made.A}`)).data?.payload
  check(Object.keys(saved?.opexUnitFees ?? {}).length === 0,
    'SAVED: no OPEX fee override persists', JSON.stringify(saved?.opexUnitFees))
  check(Object.keys(saved?.opexUnitMargins ?? {}).length === 0,
    'and no OPEX margin override persists', JSON.stringify(saved?.opexUnitMargins))
  check(saved?.ssExisting === 11 && saved?.ssNew === 10 && saved?.aqm === 9,
    'while the unit counts are saved unchanged',
    `${saved?.ssExisting}/${saved?.ssNew}/${saved?.aqm}`)

  // ── E3: A SECOND DEAL WITH A DIFFERENT TARGET ────────────────────────
  console.log('\n=== C: target 41.5 ===')
  await open(made.C)
  const other = await readState()
  check(other.present === true, 'the control is there on the second deal')
  check(/\(41\.5%\)/.test(other.label ?? ''),
    'and the label reads THAT deal s target, not a constant', other.label)
  check(!/\(30%\)/.test(other.label ?? ''), 'the first deal s 30 is nowhere in it', other.label)

  check(errs.length === 0, 'no page errors throughout', errs.join(' | '))
} finally {
  await b.close()
}

// ── THE NON-OWNER CHECK ────────────────────────────────────────────────
//
// Not that a stranger is refused, but that they are refused for OWNERSHIP,
// above this control, so a reset can never be what lets one through.
{
  const db = admin()
  const { data: someone } = await db.from('track_approvers')
    .select('user_id').eq('record_type', 'opportunity').limit(1).maybeSingle()
  if (!someone?.user_id) {
    check(false, 'a real second identity was available for the non-owner check',
      'no track_approvers row: the non-owner half did NOT run')
  } else {
    const { oppId: theirs } = await freshOpportunity(`${TAG}NB`)
    const theirRev = (await api('GET', `/opportunities/${theirs}`)).data?.latest_revision_number
    await handOver(theirs, someone.user_id)
    const refused = await api('PATCH', `/opportunities/${theirs}`,
      { payload: { ...BASE, targetMargin: 30, opexUnitFees: {}, opexUnitMargins: {} },
        expected_revision: theirRev },
      { expect: 403, because: 'a non-owner is refused on OWNERSHIP, above the reset' })
    check(refused?.status === 403, 'a NON-OWNER cannot save a reset at all', `status ${refused?.status}`)
    check(/another user|owner/i.test(String(refused?.data?.error ?? '')),
      'and is refused for OWNERSHIP, not by anything this round built',
      String(refused?.data?.error ?? '').slice(0, 70))
    await tearDown(`${TAG}NB`)
  }
}

for (const name of Object.keys(DEALS)) await tearDown(`${TAG}${name}`)

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} OPEX reset checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
