// The commercial approval page. Round 38.
//
// A READ-ONLY SURFACE, and that changes how defaults are shown. The Commercials
// tab shows what WILL happen if you do nothing, so an unset field is a grey
// placeholder. This page shows what DID happen, so a default is a VALUE WITH ITS
// PROVENANCE: "30% (system default, set 29 August 2026)", never a blank and
// never a bare 30%. An approver is accepting an assumption somebody else made
// and cannot accept what they cannot see.
//
// NOTHING IS COMPUTED HERE. Every figure and every sentence comes from
// GET /api/opportunities/:id/approval-page, which assembles them through
// src/lib/approval-page.js. A second computation on this side would be a second
// path that agrees today.

let apprOppId = null

const money = (n) => (n == null ? '--' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }))
const pts = (n) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)} pts`
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const KEY_LABELS = {
  ssExisting: 'SafeSight, existing infrastructure', ssNew: 'SafeSight, new infrastructure',
  aqm: 'Air Quality units', hemir: 'HEMIR units', duration: 'Contract duration',
  recoveryMonths: 'Recovery months', invoicing: 'Invoicing', structure: 'Payment structure',
  milestones: 'Milestones', targetMargin: 'Target margin', marginOverrides: 'Per-line margins',
  installResp: 'Installation responsibility', lumpSumCost: 'Lump sum cost',
  warrantyPct: 'Warranty %', whtPct: 'Withholding tax %', gstPct: 'GST %',
  grossUp: 'Gross up', fxContingency: 'FX contingency', factoring: 'PO factoring',
  contractorMilestones: 'Contractor milestones', factoringRatePct: 'Factoring rate',
  ssUnitCost: 'SafeSight unit cost', aqUnitCost: 'Air Quality unit cost',
  hemirUnitCost: 'HEMIR unit cost', hoSafesight: 'SafeSight hosting', hoAqm: 'Air Quality hosting',
  hoHemir: 'HEMIR hosting', inSsExisting: 'SafeSight install, existing', inSsNew: 'SafeSight install, new',
  inAqm: 'Air Quality install', inHemir: 'HEMIR install',
  // The per-line margin keys. Without these the "below target" rows read
  // "hwSs 22%", which names an internal key at an approver.
  hwSs: 'SafeSight hardware', hwAqm: 'Air Quality hardware', hwHemir: 'HEMIR hardware',
  hwWarranty: 'Warranty', inLump: 'Installation, lump sum', inSsEx: 'SafeSight install, existing',
  inNone: 'Installation', hoSs: 'SafeSight hosting',
}
const label = (k) => KEY_LABELS[k] ?? k

// Catalog product identifiers are database values. An approver reads
// "SafeSight", not "safesight".
const PRODUCT_LABELS = { safesight: 'SafeSight', air_quality: 'Air Quality', hemir: 'HEMIR' }
const productLabel = (k) => PRODUCT_LABELS[k] ?? k

// The opening and closing rows FRAME the bridge, and framing is the whole
// reason it is a bridge rather than a list: an approver gets from one to the
// other by reading down. Bold alone did not carry that at 1240 - checked by
// looking, which is the only instrument for prominence - so the closing row
// takes a rule above it.
function row(left, right, note, cls = '') {
  return `<div class="ds-row${cls ? ` ${cls}` : ''}">
    <div style="min-width:0"><div class="ds-label">${left}</div>${note ? `<div class="pg-item-note">${note}</div>` : ''}</div>
    <div class="ds-value">${right}</div>
  </div>`
}

// ── 1. The ask ─────────────────────────────────────────────────────────────
function renderAsk(page) {
  const a = page.ask
  const v = a.version
  document.getElementById('appr-ask').innerHTML = `
    <p style="font-size:1.05rem;margin-bottom:14px">${esc(a.sentence)}</p>
    ${v ? row('Version', `${esc(v.label)} <span class="pg-item-note" style="display:inline">${esc(v.status)}</span>`,
      `Taken from revision ${v.revisionNumber} by ${esc(v.author ?? 'unknown author')}`) : ''}
    ${v?.reason ? `<div style="margin:14px 0 18px">
      <p class="label" style="margin-bottom:6px">Stated reason for this version</p>
      <p style="max-width:70ch">${esc(v.reason)}</p>
    </div>` : ''}
    ${row('Contract net', `$${money(a.contractNet)}`)}
    ${row('Total cost', `$${money(a.totalCost)}`)}
    ${row('Achieved margin', `${a.achievedMargin.toFixed(2)}%`)}
    ${row('Term', `${a.months} months`)}
    ${row('Units', String(a.units))}`
}

// ── 2. What moved it ───────────────────────────────────────────────────────
function renderMoved(page) {
  const m = page.moved
  const t = page.target
  const el = document.getElementById('appr-moved')

  // Target first: it applies whether or not there is a baseline.
  const targetBlock = `
    ${t.movedSentence ? `<p class="msg-warn" style="margin-bottom:10px">${esc(t.movedSentence)}
      <span class="pg-item-note" style="display:block">The same change appears as a step in the bridge below.
      That is not double counting: the step says what it did to the margin, this says what the margin is now measured against.</span></p>` : ''}
    ${row('Against target', `${t.gapPoints >= 0 ? 'above' : 'below'} by ${Math.abs(t.gapPoints).toFixed(2)} pts`,
      `Achieved ${t.achieved.toFixed(2)}% against target ${t.provenance ? esc(t.provenance.sentence) : `${t.target}%`}`)}
    ${t.linesBelowTarget.length ? t.linesBelowTarget.map((l) =>
      row(label(l.key), `${l.pct}%`, `${l.gapPoints.toFixed(0)} points below the deal's own target`)).join('') : ''}`

  if (!m.bridge) {
    // A STATED ABSENCE, NOT A GAP. A blank block reads as a rendering failure.
    el.innerHTML = `<p style="margin-bottom:14px">${esc(m.absence)}</p>${targetBlock}`
    return
  }

  const b = m.bridge
  const steps = b.steps.length
    ? b.steps.map((s) => row(
      esc(s.label),
      `${pts(s.marginPoints)} &nbsp; ${s.contractNet >= 0 ? '+' : '-'}$${money(Math.abs(s.contractNet))}`,
      changeNote(s))).join('')
    : '<p class="pg-item-note">Nothing has changed since that version was approved.</p>'

  el.innerHTML = `
    ${m.caveat ? `<p class="msg-error" style="margin-bottom:14px">${esc(m.caveat)}</p>` : ''}
    <p class="pg-item-note" style="margin-bottom:10px">Against ${esc(m.baseline.label)}, approved at revision ${m.baseline.revisionNumber}${m.baseline.approvedAt ? ` on ${esc(String(m.baseline.approvedAt).slice(0, 10))}` : ''}.</p>
    ${row('<strong>Opening</strong>', `<strong>${b.opening.marginPoints.toFixed(2)}%</strong> &nbsp; $${money(b.opening.contractNet)}`,
      `${esc(m.baseline.label)}, as approved`, 'appr-frame')}
    ${steps}
    ${b.reconciliation.reconciles
      ? (b.displayRounding
        ? row('Rounding', `${b.displayRounding >= 0 ? '+' : ''}${b.displayRounding.toFixed(2)} pts`,
          'The figures above are shown to two decimals and the exact ones are not. This is that difference, not a change in the deal.')
        : '')
      // NOT PRINTED AS ROUNDING. A leftover bigger than two-decimal display can
      // produce is an error wearing rounding's label, and a bridge that always
      // adds up is telling an approver nothing about whether it should.
      : `<p class="msg-error">This bridge does not reconcile. The steps leave
         ${b.displayRounding.toFixed(2)} points unaccounted for, against a rounding tolerance of
         ${b.reconciliation.tolerance}. Do not rely on the figures below; report this.</p>`}
    ${row('<strong>Closing</strong>', `<strong>${b.closing.marginPoints.toFixed(2)}%</strong> &nbsp; $${money(b.closing.contractNet)}`,
      `Total movement ${pts(b.total.marginPoints)}`, 'appr-frame appr-frame-close')}
    ${Math.abs(b.unexplained) > 1e-6
      ? `<p class="msg-error">${b.unexplained.toFixed(4)} points are unexplained. The bridge does not reconcile; do not rely on it.</p>` : ''}
    ${b.unassignedKeys.length
      ? `<p class="msg-warn">Changed and not accounted for by any step: ${b.unassignedKeys.map(esc).join(', ')}.</p>` : ''}
    <p class="pg-item-note" style="margin-top:12px">${esc(m.order)}</p>
    ${targetBlock}`
}

// A step can move ten keys at once - the whole catalog reprices together - and
// ten "from -> to" clauses in note-sized text is a wall that says less than a
// count does. Found by looking at the rendered page: the cost-basis row was
// three dense lines of the smallest text on screen, carrying the least
// information per line of anything in the block.
//
// Three named, then a count. The full list stays in the title attribute, so
// nothing is lost, it is just not shouted.
const CHANGE_CAP = 3
function changeNote(step) {
  const all = step.changes.map((c) => `${label(c.key)}: ${fmtVal(c.from)} \u2192 ${fmtVal(c.to)}`)
  const shown = all.slice(0, CHANGE_CAP).map(esc).join(' &middot; ')
  const rest = all.length - CHANGE_CAP
  return `<span title="${esc(all.join(' | '))}">${shown}${rest > 0 ? ` &middot; and ${rest} more` : ''}</span>`
}

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return 'not set'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ── 3. Exposures ───────────────────────────────────────────────────────────
function renderExposures(page) {
  document.getElementById('appr-exposures').innerHTML =
    `<p class="pg-item-note" style="margin-bottom:10px">Money at risk, not the percentages that produced it.
     A percentage is an input; the input screen already shows it.</p>`
    + page.exposures.map((e) => row(
      esc(e.label),
      `${e.amount < 0 ? '-' : ''}$${money(Math.abs(e.amount))} <span class="pg-item-note" style="display:inline">${e.bornByTerminus ? 'borne by Terminus' : 'not borne'}</span>`,
      `${esc(e.basis)}. ${esc(e.note)}`)).join('')
}

// ── 4. Cost basis and its age ──────────────────────────────────────────────
function renderCostBasis(page) {
  const c = page.costBasis
  document.getElementById('appr-costbasis').innerHTML = `
    <p class="pg-item-note" style="margin-bottom:10px">Resolved as at ${esc(c.asOf)}. ${esc(c.asOfRule)}
      A deal is only as current as its stalest input, so the oldest is first.</p>
    ${c.products.map((p) => row(
      `${esc(productLabel(p.product))}${p.band === 'stale' ? ' <span class="tag">stale</span>' : p.band === 'ageing' ? ' <span class="tag">ageing</span>' : ''}`,
      `${p.ageDays == null ? 'undated' : `${p.ageDays} days old`}`,
      `${esc(p.batchLabel ?? 'unlabelled batch')}, effective ${esc(String(p.effectiveFrom ?? '').slice(0, 10) || 'unknown')}. ${esc(p.bandMeaning ?? '')}`)).join('')}
    ${c.missingDetail.length
      ? c.missingDetail.map((m) => `<p class="${m.inUse ? 'msg-error' : 'pg-item-note'}">
          No current Base Cost batch for ${esc(productLabel(m.product))}.
          ${m.inUse
            ? `This deal carries ${m.units} of them, so those lines priced at ZERO cost. That is an absent cost, not a free product, and the margin on this page is higher than the deal will achieve.`
            : 'This deal carries none of them, so nothing on this page is affected by it.'}
        </p>`).join('')
      : '<p class="pg-item-note">Every product this deal uses has a current cost basis.</p>'}`
}

// ── 5. What is not recorded ────────────────────────────────────────────────
function renderNotRecorded(page) {
  const rows = page.notRecorded
  document.getElementById('appr-notrecorded').innerHTML = rows.length
    ? `<p class="pg-item-note" style="margin-bottom:10px">Every assumption being approved, with where it came from.
       A default is shown as a value and its provenance, never as a blank.</p>`
      + rows.map((r) => row(esc(label(r.key)), esc(r.sentence ?? '--'), esc(r.note))).join('')
    : '<p class="pg-item-note">Every field on this deal was set by a person. Nothing is running on a default.</p>'
}

window.loadApprovalPage = async function (oppId) {
  apprOppId = oppId
  const err = document.getElementById('appr-error')
  err.classList.add('hidden')
  const r = await window.api('GET', `/api/opportunities/${oppId}/approval-page`)
  if (!r.ok) {
    err.textContent = r.data?.error ?? 'The approval page could not be loaded.'
    err.classList.remove('hidden')
    return
  }
  const page = r.data
  document.getElementById('appr-title').textContent = page.ask.record.name ?? page.ask.record.reference ?? 'Opportunity'
  document.getElementById('appr-subtitle').textContent =
    `${page.ask.record.reference ?? 'no reference'} · ${page.ask.record.stage ?? ''} · at revision ${page.meta.revisionNumber}`

  const state = page.ask.version?.approval?.state
  document.getElementById('appr-state-tag').innerHTML = state
    ? `<span class="tag">${esc(state)}</span>` : ''

  renderAsk(page)
  renderMoved(page)
  renderExposures(page)
  renderCostBasis(page)
  renderNotRecorded(page)
}

document.getElementById('btn-back-from-approval')?.addEventListener('click', () => {
  if (apprOppId) window.navigate('opportunity-detail', apprOppId)
})
