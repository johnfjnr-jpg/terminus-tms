// ── THE DEAL SHEET'S VERSION MACHINERY ───────────────────────────────────
//
// Split out of frontend/opportunity-deal.js at Migration Round 3, session D2c.
//
// NOT A PURE MOVE, and not claimed as one. D2's item-0 measurement found
// ELEVEN names crossing between the version machinery and the form, two of
// them behavioural: saveVersion called the form's save, and restoreVersion
// asked the form whether there was anything to lose. A pure relocation would
// have left both reaching into a file they no longer share a scope with.
//
// So this is a rewrite against the SEAM, and the seam is the point: this file
// runs against the vanilla form and against the React form unchanged, because
// it only ever talks to `window.dealFormSeam`.
//
//   freezeCurrentState()      saves if dirty, THEN returns what it froze
//   hasUnsavedChanges()       what restore asks before overwriting
//   readContractorMilestones()
//   populateForm(payload)
//   recompute()               returns the form's current payload
//
// WHAT MOVED WITH IT. `opportunityId` was module state shared with the form
// and is now an init parameter. `wired` was a shared wire-once flag and is now
// this file's own `versionsWired`. `updateDirtyState` has no successor at all:
// the form's dirty state is computed against a baseline rather than pushed, so
// there is nothing to tell.
//
// THE REASON BOX did not have to move. It was already inside the Versions card
// in index.html, immediately after #deal-version-list - the D2 report said it
// "lives in the form's DOM", and that was wrong.
import { changedKeys } from '/lib/payload-diff.js'
import { clearDealFeedback } from '/deal-feedback.js'
import { namedChangedKeys } from '/lib/version-pricing.js'
import { reasonPromptFor } from '/lib/version-reason.js'
import { scheduleReconciliation, refusalStatement } from '/lib/milestone-schedule.js'
import { resolveRates, frozenRates } from '/lib/rate-resolution.js'

// Set by init. The form owns the panel's lifecycle and hands these over, which
// is what makes the identity of the record a parameter rather than a global
// two files happen to agree about.
let oppId = null
let seam = null
let versionsWired = false

function escapeSheet(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// ── Deal Sheet versions (Round 37 Phase 3) ────────────────────────────────
//
// Saving is a deliberate act, so it is a button press and never a consequence
// of editing. Nothing on this tab autosaves.
let dealVersions = []

function versionLabel(v) {
  if (v.major === 0) return `V0.${v.minor}`
  return v.minor === 0 ? `V${v.major}` : `V${v.major}.${v.minor}`
}

async function loadVersions() {
  if (!oppId) return
  const r = await window.api('GET', `/api/opportunities/${oppId}/deal-sheet-versions`)
  dealVersions = r.ok && Array.isArray(r.data) ? r.data : []
  renderVersionList()
  // The prompt depends on whether any version exists, so it is set from the
  // same load that answers that, not guessed at wiring time.
  applyReasonPrompt()
}

// W4: how much of the history is on screen. Session state, not a preference:
// it resets per load like the latches, because it is a way of looking at THIS
// deal rather than a setting about all of them.
let versionRange = 5

// Exposed so app.js can re-run the actions once stage-approvals resolve: the
// approval control's visibility depends on oppStageTracks, which is loaded
// after this module first renders.
// ── THE CURRENT ISSUED MAJOR'S OWN STATE, FOR THE BANNER ─────────────────
//
// Fix 2, ruled 2026-09-04. A banner is a LIVE-STATUS surface: it says what is
// true NOW about the CURRENT version, and never narrates an event from a
// superseded one. At V3 a banner about V1's rejection is wrong by construction.
//
// So there is no recency window and no "most recent rejection". There is one
// question - is the version people are looking at rejected and unaddressed -
// and it is answered from the SAME approval state the Versions panel renders,
// which is now joined through the request rather than by revision coincidence.
//
// A rejection that has been responded to, by issuing or approving anything
// newer, is HISTORY. It belongs in the Versions panel and nowhere else.
window.oppCurrentVersionRejection = () => {
  const issued = (dealVersions ?? []).filter((v) => v.status === 'issued')
  if (!issued.length) return null
  // dealVersions is ordered major DESC, minor DESC, so the first issued row is
  // the current major - the same ordering every other reader here relies on.
  const current = issued[0]
  if (current?.approval?.state !== 'rejected') return null
  return {
    label: versionLabel(current),
    decidedAt: current.approval.decidedAt ?? null,
    revision: current.approval.revisionApproved ?? null,
  }
}

window.oppRefreshVersionActions = () => renderVersionList()

function renderVersionList() {
  const list = document.getElementById('deal-version-list')
  if (!list) return

  // THE CONTROL ONLY APPEARS WHEN IT WOULD DO SOMETHING. A range picker over
  // three versions is a control that cannot change what is on screen, and this
  // screen has enough of those.
  const rangeEl = document.getElementById('deal-version-range')
  const noteEl = document.getElementById('deal-version-range-note')
  const total = dealVersions.length
  rangeEl?.classList.toggle('hidden', total <= 5)
  rangeEl?.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', String(versionRange) === b.dataset.range)
  })

  const shown = versionRange === 'all' ? dealVersions : dealVersions.slice(0, Number(versionRange))
  // SAY WHAT IS NOT SHOWN. A truncated list that does not admit it reads as the
  // whole history, which is the same fault as a silent cap in a scan.
  const hiddenCount = total - shown.length
  if (noteEl) {
    noteEl.textContent = hiddenCount > 0
      ? `Showing ${shown.length} of ${total} versions. ${hiddenCount} older ${hiddenCount === 1 ? 'version is' : 'versions are'} not listed.`
      : (total > 5 ? `Showing all ${total} versions.` : '')
    noteEl.classList.toggle('hidden', !noteEl.textContent)
  }

  if (!dealVersions.length) {
    list.innerHTML = '<p class="pg-item-note">No versions saved yet. V0.1 is the first.</p>'
  } else {
    // Number, status, reason, AUTHOR, timestamp and what the version carried.
    // "A version nobody can find is a version nobody can restore", and during a
    // bid review the question is usually who took it and what it covered rather
    // than which number it got.
    //
    // sections is shown as a COUNT with the names on hover rather than a list,
    // because eight names per row would bury the reason, which is the thing the
    // business said matters most. It is shown at all because a version taken
    // before a tab existed and one taken after it where the operator left that
    // tab blank are otherwise indistinguishable.
    list.innerHTML = shown.map(v => {
      const when = new Date(v.issued_at ?? v.created_at)
      const who = (v.status === 'issued' ? v.issued_by_email : v.created_by_email) || 'unknown author'
      const sections = Array.isArray(v.sections) ? v.sections : []
      return `
      <div class="ds-row">
        <div style="min-width:0">
          <div class="ds-label">${escapeSheet(versionLabel(v))}
            <span class="pg-item-note" style="display:inline">${v.status === 'issued' ? 'issued' : 'draft'}</span>
          </div>
          <div class="pg-item-note">${escapeSheet(v.reason)}</div>
          <div class="pg-item-note">${escapeSheet(who)} &middot; ${escapeSheet(when.toISOString().slice(0, 16).replace('T', ' '))}</div>
          <div class="pg-item-note">${versionApprovalLine(v)}</div>
          <div class="pg-item-note">${versionTrackLine(v)}</div>
          <div class="pg-item-note" title="${escapeSheet(sections.join(', '))}">${sections.length} section${sections.length === 1 ? '' : 's'} recorded</div>
        </div>
        <div class="ds-value">
          <button class="btn-text" data-restore-version="${escapeSheet(v.id)}">Restore</button>
        </div>
      </div>`
    }).join('')
  }

  // Issue acts on the latest DRAFT. Disabled when there is none, rather than
  // offered and then refused, because a control that is always clickable and
  // sometimes errors teaches people to ignore its message.
  // ── THE TARGET COMES FROM WHAT HAS BEEN ISSUED. Round 41, V1/V2/V4 ──────
  //
  // It read `draft.major + 1`. Every draft has major 0, so every draft was
  // labelled "as V1", and after issuing one the button offered the NEXT
  // remaining draft as V1 again - which collided and surfaced the raw
  // constraint name.
  //
  // The label was never stale. It reported a wrong rule accurately, which is
  // why the stale-reader diagnosis did not fit: the two readers agreed and were
  // both wrong. The next major is a fact about the RECORD, not about the row.
  //
  // ── THE TARGET IS A DRAFT NEWER THAN THE LAST ISSUE ────────────────────
  //
  // Ruled after the seventh walk. "The latest draft" was not enough: a STRANDED
  // draft, saved before the last issue and never issued, is still the latest
  // once every newer one has been issued, and the control offered
  // "Issue V2.1 as V6" on a record whose pricing was nowhere near V2.1.
  //
  // A draft saved after V5 was issued is V5.1 - insert_deal_sheet_version takes
  // the highest (major, minor) and increments minor - so "newer than the last
  // issue" is major = the highest issued major. No timestamp needed.
  //
  // The list is ordered major DESC, minor DESC, so [0] of each is the highest.
  const issued = dealVersions.find(v => v.status === 'issued')
  const highestIssued = issued?.major ?? 0
  const draft = dealVersions.find(v => v.status === 'draft' && v.major === highestIssued)
  const nextMajor = highestIssued + 1
  const btn = document.getElementById('btn-issue-version')
  if (btn) {
    // NOTHING TO ISSUE IS ITS OWN STATE, and it names the act that fixes it.
    // "Issue latest draft" on a disabled button said what the control does and
    // not why it cannot; a person whose record has moved past V5 needs to be
    // told to save, because A SAVE DOES NOT CREATE A DRAFT and nothing else on
    // the screen says so.
    btn.disabled = !draft
    btn.textContent = draft ? `Issue ${versionLabel(draft)} as V${nextMajor}` : 'Save a new version to issue'
    btn.title = draft
      ? `Issues ${versionLabel(draft)} as V${nextMajor}. Earlier drafts can be restored, not issued.`
      : issued
        ? `V${highestIssued} is issued and there is no newer draft. Save the current pricing as a version, `
          + 'then issue it. Saving the record alone does not create a version.'
        : 'Save a version first. Saving the record alone does not create one.'
  }

  // ── MAIN: ASKING FOR SIGN-OFF IS ITS OWN ACT ──────────────────────────
  //
  // It needs an ISSUED version to point at, because an approval is held against
  // a major version rather than against the screen. The three states are
  // distinct and each names what to do next: nothing issued, one already
  // pending, or ready to ask.
  // ── U3/U4: ISSUING A MAJOR IS PROPOSAL-ONWARD ─────────────────────────
  //
  // Ruled 2026-09-04. Pricing stays a minor DRAFT until Proposal: a salesperson
  // saves V0.1, V0.2 freely, and V1 is an OFFICIAL act. Both official acts -
  // issue a major, request approval - begin at the same place, which is what
  // makes the rule one rule rather than two coincidences.
  //
  // The same predicate as the approval control, deliberately: the gate's own
  // answer rather than a stage name, so if the version gate ever moves stage
  // both controls follow it together and cannot disagree.
  const gateApplies = window.oppVersionGateApplies?.() !== false
  const issueBtn = document.getElementById('btn-issue-version')
  if (issueBtn) issueBtn.classList.toggle('hidden', !gateApplies)

  const ask = document.getElementById('btn-request-pricing-approval')
  const state = document.getElementById('pricing-approval-state')

  // ── HIDDEN BEFORE THE VERSION GATE BEGINS. Walk, 2026-09-03 ────────────
  //
  // A pricing approval can never succeed before Proposal, so the control and
  // its explanation are absent rather than disabled. Ruled: a control that
  // cannot act AT THIS STAGE is clutter, unlike one temporarily disabled for a
  // reason that clears where you stand.
  //
  // SAVE VERSION AND ISSUE STAY, at every stage. Pricing work early is
  // legitimate and only the approval request is Proposal-onward.
  //
  // The predicate is the gate's own answer via oppVersionGateApplies, not a
  // stage-name test, so this follows the configuration if the gate ever moves.
  if (ask) ask.classList.toggle('hidden', !gateApplies)
  if (state) state.classList.toggle('hidden', !gateApplies)
  if (ask && gateApplies) {
    const pending = window.oppPendingPricingApproval?.()
    if (pending) {
      ask.disabled = true
      ask.title = 'A pricing approval is already open on this Opportunity.'
      if (state) state.textContent = `${pending.label ?? 'A version'} is awaiting approval.`
    } else if (!issued) {
      ask.disabled = true
      ask.title = 'Issue a major version first: an approval is held against an issued version.'
      if (state) state.textContent = 'Issue a version before requesting approval.'
    } else if (issued.approval?.state === 'approved') {
      // ── ALREADY APPROVED. 2026-09-04 ─────────────────────────────────
      //
      // The control offered "Request approval of V3" on a version that was
      // already approved, and the earlier walk took it: a SECOND request was
      // raised on the approved V3, and the four disagreeing screens followed.
      //
      // DISABLED WITH THE REASON, not hidden. Ruled: an approved version is not
      // a stage where the act is meaningless - it is a state the person needs
      // to SEE, because "already approved" is the answer they came for.
      // Contrast the pre-Proposal case, which is hidden precisely because
      // nothing about the stage explains itself.
      //
      // The route refuses this too. The button is a convenience and the route
      // is the enforcement, which is Verification 41's lesson: hiding a control
      // is not a rule.
      ask.disabled = true
      ask.textContent = `Request approval of V${highestIssued}`
      ask.title = `V${highestIssued} is already approved. Issue a new major version if the price has changed.`
      if (state) state.textContent = `V${highestIssued} is already approved.`
    } else if (draft) {
      // ── U11: NOT WHILE THE PRICE HAS MOVED PAST THE ISSUED MAJOR ──────
      //
      // The walk found this control live on a record whose latest version was
      // the DRAFT V1.1. An approval attaches to an issued major, so the click
      // would have asked three people to sign off V1 while the screen showed
      // V1.1 - approving a price that is not the one on the table, which is the
      // exact fault the superseded-approval work exists to prevent, arriving
      // before the approval rather than after it.
      ask.disabled = true
      ask.title = `${versionLabel(draft)} is a draft newer than V${highestIssued}. `
        + 'Issue it, then ask for approval of the version people will be looking at.'
      if (state) {
        state.textContent = `${versionLabel(draft)} is a draft. Issue it before requesting approval, `
          + `or the approval would be of V${highestIssued} and not of the price on screen.`
      }
    } else {
      ask.disabled = false
      ask.title = `Ask Commercial, Technical and Legal to approve V${highestIssued} for issue.`
      ask.textContent = `Request approval of V${highestIssued}`
      if (state) state.textContent = ''
      ask.onclick = () => window.requestPricingApproval?.(issued.id, versionLabel(issued))
    }
  }
}

// The approval state, derived server-side and rendered as a sentence rather
// than a badge, because "approved at revision 12, superseded by 3 saves since"
// is the whole of what an approver needs and a coloured dot is not.
//
// APPROVED AND SUPERSEDED ARE DELIBERATELY NOT THE SAME SENTENCE. An approval
// that no longer describes the deal on screen is the one thing this display
// exists to stop being mistaken for control.
// ── U13: WHICH TRACKS, ON THE VERSION ITSELF ─────────────────────────────
//
// Ruled 2026-09-04. The approval state lived only in the banner, which shows
// the ONE request that is open. A version list that says "Not yet approved"
// beside four versions cannot tell anybody which of them three people are
// currently looking at, or which two tracks have already signed.
//
// READ FROM THE OPEN REQUEST, not from a second query. Same source the banner
// renders from, so the panel and the banner cannot disagree about a version's
// state - Verification 43, which this project has three instances of.
function versionTrackLine(v) {
  const pending = window.oppPendingPricingApproval?.()
  if (!pending || pending.frozen_version_id !== v.id) return ''
  const decided = new Map((pending.decisions ?? []).map((d) => [d.track, d]))
  const parts = (pending.required ?? []).map((t) => {
    const d = decided.get(t)
    const state = d ? (d.decision === 'approved' ? 'approved' : 'REJECTED') : 'waiting'
    return `${escapeSheet(t)} ${state}`
  })
  if (!parts.length) return ''
  return `Under approval since ${escapeSheet(formatDealDateTime(pending.requested_at))}`
    + ` &middot; ${parts.join(' &middot; ')}`
}

// The list's own formatter, so a timestamp here reads the same as one in the
// banner. Kept local rather than reaching into app.js, which does not export it.
function formatDealDateTime(dateStr) {
  if (!dateStr) return 'an unknown time'
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}, `
    + `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

function versionApprovalLine(v) {
  const a = v.approval ?? {}
  const at = a.revisionApproved
  switch (a.state) {
    // ── APPROVED MEANS THE PRICE HAS NOT MOVED. Round 41 ──────────────────
    //
    // "nothing has changed since" used to mean "no save has landed", which is
    // a claim about the record, not about the price. Ticking an exit criterion
    // broke an approval; the wording now says what is actually being asserted.
    case 'approved':
      return `Approved at revision ${at}, and the pricing has not changed since.`
    case 'superseded':
      return `SUPERSEDED. Approved at revision ${at}, and the pricing has changed since: `
        + `${namedChangedKeys(a.changedKeys)}. `
        + `Take a new version and have it approved.`
    case 'unknown':
      return `Approved at revision ${at}, but whether the pricing has moved since could `
        + `not be determined. Report this rather than reading it as approved.`
    case 'rejected':
      return `Rejected at revision ${at}.`
    case 'none':
      return 'Not yet approved.'
    case 'unapprovable':
      return 'Taken before versions recorded their revision, so it cannot be approved.'
    case 'inconsistent':
      return `Names revision ${at}, which this record has not reached. Report this.`
    default:
      return ''
  }
}

// ── THE REASON ASKS A DIFFERENT QUESTION ON A FIRST VERSION ──────────────
//
// CLAUDE.md Verification 22. The reason is required and now has a reader: the
// approval page renders it as prose beside the bridge showing what moved. That
// is what makes requiring it honest.
//
// It is still one field asking one question, and on a first version that
// question has no answer. "What changed, and why" against a deal that has never
// been priced invites "initial pricing", and somebody who types that on V0.1
// types "update" on V0.10. A required field decays into ceremony the moment it
// has nothing to say.
//
// So the prompt changes by context. A first version asks what the price is
// BASED ON, which is a real question with a real answer an approver needs; every
// later one asks what changed and why, which is what block 2 is measuring.
function reasonPrompt() {
  return reasonPromptFor(dealVersions.length)
}

function applyReasonPrompt() {
  const prompt = reasonPrompt()
  const label = document.querySelector('label[for="deal-version-reason"]')
  const box = document.getElementById('deal-version-reason')
  if (label) label.textContent = prompt.label
  if (box) box.placeholder = prompt.placeholder
}


function versionFeedback(msg, ok) {
  const el = document.getElementById('deal-version-feedback')
  if (!el) return
  el.textContent = msg || ''
  el.className = msg ? (ok ? 'msg-success' : 'msg-error') : 'hidden'
}

async function saveVersion() {
  clearDealFeedback()
  const reasonEl = document.getElementById('deal-version-reason')
  const reason = (reasonEl?.value ?? '').trim()

  // Required, and checked here so the user is told before a request is made.
  // The schema's NOT NULL and length CHECK are what make it true; this is what
  // makes it readable.
  if (!reason) {
    versionFeedback(reasonPrompt().refusal, false)
    reasonEl?.focus()
    return false
  }

  // ── A VERSION REFUSES A SCHEDULE THAT DOES NOT RECONCILE ─────────────
  //
  // Round 39, the business's split, and the two halves are deliberately
  // different because saving and versioning are different acts:
  //
  //   SAVE warns and does not block. A part-built schedule mid-drafting is
  //   legitimate and a save is not a commitment.
  //
  //   TAKING A VERSION REFUSES. A version is a commercial commitment and must
  //   not carry a payment schedule that does not match the contractor's price.
  //
  // Scoped to a schedule that EXISTS and does not sum: every installation type
  // except Lump Sum has no contractor schedule at all, and a refusal that fired
  // on those would fire on almost every deal.
  //
  // The server refuses this too. A client check tells somebody early; it is not
  // the control, because a control that only exists in a browser is not one.
  // ── THE BASE COMES FROM recompute(), NOT FROM freezeCurrentState() ────
  //
  // A FINDING, recorded in the D2c report. This refusal must run BEFORE any
  // save - refusing a version must not write - and `freezeCurrentState()` is
  // the only member that yields a payload, and it saves. So the ruled seven
  // had no pre-save reader for the contractor base.
  //
  // Position taken: `recompute()` returns the form's CURRENT PAYLOAD, in both
  // adapters. `restoreVersion` calls it for its side effect and ignores the
  // return, so nothing else is affected, and it makes the two adapters agree -
  // which they did not, the React one already returning the payload and the
  // vanilla returning the calculated result.
  const contractorRec = scheduleReconciliation(
    seam.readContractorMilestones(), Number(seam.recompute()?.lumpSumCost ?? 0))
  // W-C: incomplete FIRST, because a dateless row also makes the arithmetic
  // look wrong and "the schedule does not sum" would be the less useful of two
  // true sentences. The server checks both in the same order.
  if (contractorRec.hasSchedule && !contractorRec.issuable) {
    versionFeedback(contractorRec.incompleteStatement, false)
    return false
  }
  if (contractorRec.hasSchedule && !contractorRec.reconciles) {
    versionFeedback(refusalStatement(contractorRec, 'The contractor payment schedule'), false)
    return false
  }

  // ── SAVE FIRST, THEN VERSION. Round 38 Phase 1, the business's decision. ──
  //
  // Round 38 Phase 0 measured that the Deal Sheet is already live: it renders
  // through seam.recompute() from readPayload(), so it shows unsaved input, and a
  // version taken from it captured that unsaved input. Measured by intercepting
  // the POST: the body carried ssExisting 77 while the record had no ssExisting
  // at all and stood at revision 12.
  //
  // THAT MAKES A VERSION UNTRUSTWORTHY AS THE THING IT EXISTS TO BE. The
  // business asked for versions for "traceability of calculations used in
  // proposals", and a version citing figures the record never held is a
  // traceability record that cannot be checked against anything.
  //
  // So taking a version SAVES THE RECORD FIRST, and the two become one act. The
  // alternative considered and rejected was leaving them separate, which is
  // cleaner as code and permits exactly the disagreement versions exist to
  // prevent. The cost is one extra write.
  //
  // Only when there is something to save. A version taken with nothing dirty
  // needs no revision, because the record already holds what the screen shows,
  // and writing one anyway would put an empty revision in the history every
  // time somebody versioned twice.
  // ── ONE CALL, AND THE ORDER CANNOT BE GOT WRONG ───────────────────────
  //
  // This was `if (isDealFormDirty()) { const saved = await saveDeal() ... }`
  // followed by two separate reads of readPayload(). The seam folds all of it
  // into freezeCurrentState(), which saves if dirty and THEN returns what it
  // froze - so there is no way to obtain the payload except through the call
  // that saves it, and a version cannot be taken from an unsaved form.
  //
  // Only when there is something to save. A version taken with nothing dirty
  // needs no revision, because the record already holds what the screen shows,
  // and writing one anyway would put an empty revision in the history every
  // time somebody versioned twice. The seam's own dirty check does this.
  const alsoSaved = seam.hasUnsavedChanges()
  let frozen
  try {
    frozen = await seam.freezeCurrentState()
  } catch {
    // The form has already written its own reason where the form is. This says
    // what it means for the VERSION, which is the thing the user was actually
    // trying to do, where they are looking when they try it.
    versionFeedback('The pricing could not be saved, so no version was taken.', false)
    return false
  }

  // The version carries what was SAVED, including the catalog rates the screen
  // priced against, so the server can confirm they still agree with the catalog
  // rather than freezing whatever it resolves a moment later. A batch turning
  // over mid-session is the case that catches.
  //
  // Round 38: it also names the REVISION it was taken from, which is what makes
  // approving a version the same act as approving a revision.
  const pricedWith = frozenRates(resolveRates(frozen.payload, frozen.catalogRates))
  const r = await window.api('POST', `/api/opportunities/${oppId}/deal-sheet-versions`,
    { inputs: frozen.payload, reason, rates: pricedWith, expected_revision: window.getOppLoadedRevision() })

  if (!r.ok) {
    // The save and the version are two sequential writes, not one transaction.
    // If the version fails after the save succeeded, a revision exists and no
    // version does, and the user MUST be told both halves: the raw server error
    // alone reads as "nothing happened", and they would not know their pricing
    // is now saved. Observed by forcing this branch, not argued.
    const detail = r.data?.error ?? 'The version could not be saved.'
    versionFeedback(alsoSaved
      ? `Your pricing was saved, but the version was not taken: ${detail} Try taking the version again.`
      : detail, false)
    return false
  }
  reasonEl.value = ''
  await loadVersions()
  // Names both writes when both happened, because "Saved V0.1" alone would hide
  // a revision the user did not ask for and would be surprised to find later.
  //
  // ── "THE PRICING WAS ALREADY SAVED" IS GONE. Round 41, sixth walk V3 ────
  //
  // It was true and it read as an excuse. On the path where nothing was dirty,
  // that sentence was the only thing distinguishing the message from the other
  // branch, and a person who had just been told "no change since V0.3" by the
  // route and "the pricing was already saved" by a successful save had two
  // sentences about the same fact that appeared to disagree.
  //
  // What the second branch actually means is that the version was taken from
  // pricing already on the record, which is not news and does not need saying.
  versionFeedback(alsoSaved
    ? `Pricing saved, and ${versionLabel(r.data)} taken from it.`
    : `${versionLabel(r.data)} taken.`, true)
  return true
}

function wireApprovalLink() {
  const btn = document.getElementById('btn-open-approval')
  if (!btn || btn.dataset.wired) return
  btn.dataset.wired = '1'
  btn.addEventListener('click', () => {
    if (oppId) window.navigate('opportunity-approval', oppId)
  })
}

async function issueLatestDraft() {
  const draft = dealVersions.find(v => v.status === 'draft')
  if (!draft) return
  const r = await window.api('POST', `/api/deal-sheet-versions/${draft.id}/issue`)
  if (!r.ok) {
    versionFeedback(r.data?.error ?? 'The version could not be issued.', false)
    await loadVersions()
    return
  }
  await loadVersions()
  versionFeedback(`Issued ${versionLabel(r.data)}. It cannot be changed now.`, true)
}

// RESTORE OVERWRITES THE CURRENT PRICING, which is what makes it useful during
// a negotiation and what makes unsaved work a real risk.
//
// It uses openDiscardConfirm, the dialogue Round 28 built for the assessment
// panel and Round 34 extended, rather than a third pattern. That dialogue's own
// words are "discard unsaved changes", which is exactly what restoring does to
// them, so restore REFUSES-OR-DISCARDS rather than forcing a save first.
// Forcing a save would also write a revision the user never asked for, at the
// moment they are trying to go back.
async function restoreVersion(versionId) {
  const go = async () => {
    const r = await window.api('POST', `/api/deal-sheet-versions/${versionId}/restore`)
    if (!r.ok) {
      versionFeedback(r.data?.error ?? 'The version could not be restored.', false)
      return
    }
    seam.populateForm(r.data.inputs ?? {})
    seam.recompute()
    versionFeedback(`Restored ${r.data.label}. Nothing is saved until you press Save Changes.`, true)
  }

  // MEASURED, NOT ASSUMED, because the residual on restore was whether it warns
  // at all: it does, through the same discard dialogue the assessment panel
  // uses, and it now asks the comparison rather than a cached flag.
  if (seam.hasUnsavedChanges()) {
    window.openDiscardConfirm(go)
    return
  }
  await go()
}

// ── THE ENTRY POINT ──────────────────────────────────────────────────────
//
// Called by the form's own init, so there is one lifecycle rather than two
// files racing to notice the same record. The seam arrives here rather than
// being reached for, which is what lets either form supply it.
window.initOpportunityDealVersions = function ({ opportunityId, seam: formSeam }) {
  oppId = opportunityId
  seam = formSeam
  // W4: the range is a way of looking at THIS deal, so it resets with the deal.
  //
  // It used to be reset by the FORM's populateForm, which is the coupling
  // running the OTHER way - D2's measurement only asked what the version
  // machinery reaches into the form. Version-side state resets version-side.
  versionRange = 5
  versionsWired = false
  wireVersionControls()
  loadVersions()
  wireApprovalLink()
}

// The controls the version card owns. They were wired by the form's wireOnce,
// which is why the first split attempt threw "saveVersion is not defined": the
// listeners outlived the functions they named.
function wireVersionControls() {
  if (versionsWired) return
  versionsWired = true
  document.getElementById('btn-save-version')?.addEventListener('click', saveVersion)
  document.getElementById('btn-issue-version')?.addEventListener('click', issueLatestDraft)
  document.getElementById('deal-version-range')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-range]')
    if (!btn) return
    versionRange = btn.dataset.range === 'all' ? 'all' : Number(btn.dataset.range)
    renderVersionList()
  })
  document.getElementById('deal-version-list')?.addEventListener('click', (e) => {
    const id = e.target?.dataset?.restoreVersion
    if (id) restoreVersion(id)
  })
}
