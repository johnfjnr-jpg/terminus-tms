import { useRef, useState } from 'react'
import {
  rangeView, versionLabel, versionAuthor, versionWhen, approvalLine, trackLine,
  issueView, askView, reasonPrompt, EMPTY_STATE,
} from './model'
import type { DealVersion, PendingApproval } from './model'

// ── THE VERSION CARD ─────────────────────────────────────────────────────
//
// Round 4 Phase 1, BEHIND THE LINE: nothing registers this and the vanilla card
// is still live. It renders the eleven ids the vanilla owns, because app.js
// reaches two of them by id and the stylesheet targets the rest.
//
// ESCAPING IS COMPOSITION, not a function. The vanilla builds this list with
// innerHTML and calls escapeSheet on every interpolation; a reason carrying
// markup is text here because React puts it in a text node. There is no
// `escapeSheet` in this file and there must never be one: adding it would mean
// something is being built as markup again.

/**
 * What a request-in-flight reports back.
 *
 * PHASE 0'S SHARPEST FINDING drives this. `app.js` currently disables
 * #btn-request-pricing-approval and writes #pricing-approval-state directly by
 * id while a request is in flight. Against a React card those writes would be
 * overwritten by the next render, silently, and the button would re-enable
 * itself mid-request.
 *
 * So the card hands over an INTERFACE rather than its DOM: the requester says
 * when it starts and what happened, and the card owns both elements throughout.
 */
export interface AskReporter {
  onStart(): void
  /** An empty message means "done, and I have nothing to add". */
  onResult(message: string, ok: boolean): void
}

export interface VersionCardProps {
  versions: DealVersion[]
  pending: PendingApproval | null
  gateApplies: boolean
  onSave(reason: string): Promise<void> | void
  onIssue(): Promise<void> | void
  onRestore(id: string): Promise<void> | void
  onAsk(versionId: string, label: string, reporter: AskReporter): void
}

export function VersionCard({
  versions, pending, gateApplies, onSave, onIssue, onRestore, onAsk,
}: VersionCardProps) {
  const [range, setRange] = useState<number | 'all'>(5)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<{ text: string, ok: boolean } | null>(null)
  // The request's own state, owned here so a re-render cannot undo it.
  const [asking, setAsking] = useState(false)
  // ── AND THE SAVE HAS ONE TOO, WHICH IT DID NOT. Round 4, Phase 3 ───────
  //
  // The ask got an in-flight state in Phase 1 and the save did not, and the
  // asymmetry cost typed text. onSave runs a refusal check, a freeze that
  // SAVES the deal, a POST and then a full refetch, and only then does the
  // card clear the box. For that whole chain the box stayed editable and the
  // button stayed live, so a person starting their next reason had it wiped
  // by a clear belonging to the save before it.
  //
  // MEASURED, six saves on one page with the reason state logged: the state
  // began a cycle at 53 rather than 0 (the previous reason never cleared, so
  // typing appended to it) and dropped to 0 MID-TYPING twice, discarding
  // every character typed up to that point. 0, 5, 24, 38, 44 and 46
  // characters survived where 52 were typed.
  const [saving, setSaving] = useState(false)
  // ── THE RE-ENTRANCY GUARD IS A REF, NOT THE STATE ─────────────────────
  //
  // Found by calibration: removing `if (saving) return` changed nothing any
  // detector could see, because it cannot fire. Two clicks in one tick both
  // read the same stale `saving === false` from their own closure, and any
  // later click is already refused by `disabled={saving}`. The guard was
  // unreachable in both directions - present, reassuring, and doing nothing.
  //
  // A ref is written synchronously, so the second click of a same-tick pair
  // sees it. Verification 51: the injection that came back silent named a
  // claim nothing asserted, and this is what it was hiding.
  const savingRef = useRef(false)
  const [askState, setAskState] = useState<string | null>(null)

  const view = rangeView(versions, range)
  const issue = issueView(versions)
  const ask = askView(versions, pending, gateApplies)
  const prompt = reasonPrompt(versions.length)

  const save = async () => {
    // N1: a blank reason refuses and WRITES NOTHING, and the refusal is the
    // prompt's own, so the question and the complaint cannot drift apart.
    if (!reason.trim()) {
      setFeedback({ text: prompt.refusal, ok: false })
      document.getElementById('deal-version-reason')?.focus()
      return
    }
    // A second click during the chain would take a second version of the same
    // pricing, so the guard is a correctness one and not only a courtesy.
    if (savingRef.current) return
    savingRef.current = true
    const submitted = reason.trim()
    setSaving(true)
    // ── CLEARED AT SUBMIT, NOT AT THE END ─────────────────────────────────
    //
    // The box belongs to the NEXT version the moment this one is submitted.
    // Clearing here rather than after the chain removes both halves of the
    // defect at once: there is no stale reason for the next one to be typed
    // on top of, and no late clear arriving to wipe what was typed since.
    setReason('')
    try {
      await onSave(submitted)
      setFeedback({ text: 'Version taken.', ok: true })
    } catch (err) {
      // N3: a refused save gives the reason back, because the person has to be
      // able to try again with it - but ONLY into a box they have not already
      // started using, or the refusal would eat the next reason the way the
      // success used to.
      setReason((current) => (current === '' ? submitted : current))
      setFeedback({ text: (err as Error).message, ok: false })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const askNow = () => {
    if (!ask.askFor) return
    onAsk(ask.askFor.id, versionLabel(ask.askFor), {
      onStart: () => { setAsking(true); setAskState('') },
      onResult: (message, ok) => {
        setAsking(false)
        // A RESULT WITH NO MESSAGE OF ITS OWN releases the control and hands the
        // line back to the computed state. On the success path the requester has
        // nothing to say that the reloaded card will not say better: the request
        // is now open, and `askView` says which version is waiting.
        setAskState(message ? message : null)
        if (message) setFeedback({ text: message, ok })
      },
    })
  }

  return (
    <div className="pg-card" id="deal-version-panel">
      <div className="pg-card-head">
        <p className="pg-card-title">Versions</p>
        <div className={`view-toggle${view.toggleHidden ? ' hidden' : ''}`} id="deal-version-range">
          {([5, 10, 'all'] as const).map((r) => (
            <button key={String(r)} data-range={String(r)} type="button"
              className={String(range) === String(r) ? 'active' : ''}
              onClick={() => setRange(r)}>{r === 'all' ? 'All' : `Last ${r}`}</button>
          ))}
        </div>
      </div>

      <p className={`pg-item-note${view.noteHidden ? ' hidden' : ''}`}
        id="deal-version-range-note">{view.note}</p>

      <div id="deal-version-list">
        {view.shown.length === 0
          ? <p className="pg-item-note">{EMPTY_STATE}</p>
          : view.shown.map((v) => {
            const sections = v.sections ?? []
            const track = trackLine(v, pending)
            const approval = approvalLine(v)
            return (
              <div className="ds-row" key={v.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="ds-label">{versionLabel(v)}
                    {' '}
                    <span className="pg-item-note" style={{ display: 'inline' }}>
                      {v.status === 'issued' ? 'issued' : 'draft'}
                    </span>
                  </div>
                  <div className="pg-item-note">{v.reason}</div>
                  <div className="pg-item-note">{versionAuthor(v)} &middot; {versionWhen(v)}</div>
                  {approval ? <div className="pg-item-note">{approval}</div> : null}
                  {track ? <div className="pg-item-note">{track}</div> : null}
                  <div className="pg-item-note" title={sections.join(', ')}>
                    {sections.length} section{sections.length === 1 ? '' : 's'} recorded
                  </div>
                </div>
                {/* W6: every row, in every state. Nothing suppresses a restore. */}
                <div className="ds-value">
                  <button className="btn-text" type="button"
                    data-restore-version={v.id}
                    onClick={() => { void onRestore(v.id) }}>Restore</button>
                </div>
              </div>
            )
          })}
      </div>

      <div>
        <label className="label" htmlFor="deal-version-reason">{prompt.label}</label>
        <textarea id="deal-version-reason" rows={3} placeholder={prompt.placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)} />
        {/* F1: the three states are exclusive because the class is REPLACED. */}
        <p className={feedback ? (feedback.ok ? 'msg-success' : 'msg-error') : 'hidden'}
          id="deal-version-feedback">{feedback?.text ?? ''}</p>

        <div className="version-actions">
          <button className="btn-primary" type="button" id="btn-save-version"
            disabled={saving}
            onClick={() => { void save() }}>{saving ? 'Saving...' : 'Save version'}</button>
          <button type="button" id="btn-issue-version"
            className={`btn-secondary${gateApplies ? '' : ' hidden'}`}
            disabled={issue.disabled} title={issue.title}
            onClick={() => { void onIssue() }}>{issue.label}</button>
          <button type="button" id="btn-request-pricing-approval"
            className={`btn-secondary${ask.hidden ? ' hidden' : ''}`}
            disabled={asking || ask.disabled} title={ask.title}
            onClick={askNow}>{asking ? 'Requesting...' : ask.label}</button>
          <button className="btn-secondary" type="button" id="btn-open-approval">Approval view</button>
        </div>

        <p className={`pricing-approval-state${ask.hidden ? ' hidden' : ''}`}
          id="pricing-approval-state">
          {askState !== null ? askState : ask.state}
        </p>
        <p className="field-note">Taking a version saves the pricing first, so a version and the record can never disagree.</p>
      </div>
    </div>
  )
}
