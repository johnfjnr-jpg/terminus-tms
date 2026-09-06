import { useState } from 'react'
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
    try {
      await onSave(reason.trim())
      // N3: cleared on success ONLY. A refused save keeps what was typed,
      // because the person has to be able to try again with it.
      setReason('')
      setFeedback({ text: 'Version taken.', ok: true })
    } catch (err) {
      setFeedback({ text: (err as Error).message, ok: false })
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
          value={reason} onChange={(e) => setReason(e.target.value)} />
        {/* F1: the three states are exclusive because the class is REPLACED. */}
        <p className={feedback ? (feedback.ok ? 'msg-success' : 'msg-error') : 'hidden'}
          id="deal-version-feedback">{feedback?.text ?? ''}</p>

        <div className="version-actions">
          <button className="btn-primary" type="button" id="btn-save-version"
            onClick={() => { void save() }}>Save version</button>
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
