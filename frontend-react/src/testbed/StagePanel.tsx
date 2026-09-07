// ── THE STAGE PANEL ─────────────────────────────────────────────────────
//
// Round 7 Phase 2b. The rendering surface the B and C capabilities' logic has
// been waiting for: exit criteria, scoring, approvals and documents, all
// through the shared panel the eight stage tabs take turns in (T2).
import { useState } from 'react'
import { exitTickPayload, isTicked } from './exitCriteria'
import {
  levelsFor, awaitingReason, entryLocked, toggle, summarise,
  setScoreDraft, recordScore, type Criterion, type ScoreDraftState,
} from './scoring'
import { reasonRequired, reasonAccepted, type ScoreEntry } from './scoreReason'
import type { PanelId, PanelState } from './stageLoad'

export interface Criterion_ { field: string, label: string, value?: unknown }

/**
 * B: the exit-criteria list.
 *
 * A tick is a TIMESTAMP (B1). The list reads `isTicked`, which is the GATE's
 * own rule rather than a second reading of it (Verification 43).
 */
export function ExitCriteria({ stage, criteria, panel, onTick }: {
  stage: string
  criteria: readonly Criterion_[]
  panel: PanelState
  onTick: (payload: Record<string, string | null>) => void
}) {
  if (panel.error) {
    return <p className="empty-state" data-testid="tb-stage-exit-criteria-list">{panel.error}</p>
  }
  if (panel.pending || !panel.stage) {
    return <p className="empty-state" data-testid="tb-stage-exit-criteria-list">
      Loading {panel.pending ?? stage}...</p>
  }
  return (
    <div data-testid="tb-stage-exit-criteria-list" data-stage={panel.stage}>
      {criteria.length
        ? criteria.map((c) => {
          const met = isTicked(c.value)
          return (
            <div className={met ? 'tb-crit-row tb-crit-box--met' : 'tb-crit-row'}
              key={c.field} data-testid={`tb-crit-${c.field}`}>
              <input type="checkbox" checked={met} readOnly
                data-testid={`tb-crit-tick-${c.field}`}
                onClick={() => onTick(exitTickPayload(c.field, met, new Date().toISOString()))} />
              <span>{c.label}</span>
            </div>)
        })
        : <p className="empty-state">No exit criteria for this stage.</p>}
    </div>
  )
}

/**
 * C: the scoring card.
 *
 * P8: the card is HIDDEN until its own criteria are derived, so one stage can
 * never show another's while a fetch is in flight. The `hidden` attribute is
 * used rather than a class, and nothing gives that class a `display` - the
 * Round 5 finding that an attribute assertion is not a visibility assertion.
 */
export function ScoringCard({ card, criteria, series, onRecord }: {
  card: { hidden: boolean, stage?: string }
  criteria: readonly Criterion[]
  series: (key: string) => readonly ScoreEntry[]
  onRecord: (drafts: Record<string, string>, reasons: Record<string, string>) => void
}) {
  const [state, setState] = useState<ScoreDraftState>({ drafts: {}, recorded: new Set() })
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const blocking = awaitingReason(state.drafts, reasons, criteria, series)

  return (
    // NO DOM `id`. index.html still carries #tb-stage-scoring-card, and that
    // markup sits OUTSIDE any React mount container, so both would be in the
    // document at once and getElementById would return whichever came first -
    // the Reference bar's defect exactly. Caught by the standing detector
    // rather than by reading. The tree is addressed by data-testid throughout.
    <div className="pg-card" data-testid="tb-stage-scoring-card"
      hidden={card.hidden} data-stage={card.stage}>
      <div className="pg-card-title">Scoring</div>
      {criteria.map((c) => {
        const levels = levelsFor(c)
        const locked = entryLocked(state.recorded, c.criterion_key)
        const draft = state.drafts[c.criterion_key] ?? ''
        const needsReason = reasonRequired(Number(draft), levels, series(c.criterion_key))
        const sum = summarise(series(c.criterion_key))
        return (
          <div key={c.criterion_key} data-testid={`tb-score-${c.criterion_key}`}>
            <span>{c.name ?? c.criterion_key}</span>
            <select disabled={locked} value={draft}
              data-testid={`tb-score-select-${c.criterion_key}`}
              onChange={(e) => setState((s) => setScoreDraft(s, c.criterion_key, e.target.value))}>
              <option value="">--</option>
              {levels.map((l) => (
                <option key={l.value} value={String(l.value)}>{l.label ?? l.value}</option>))}
            </select>
            {needsReason
              ? <textarea data-testid={`tb-score-reason-${c.criterion_key}`}
                  value={reasons[c.criterion_key] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [c.criterion_key]: e.target.value }))} />
              : null}
            {/* C7: DISCLOSURE, not state. Nothing here reaches the record. */}
            <button type="button" data-testid={`tb-score-history-${c.criterion_key}`}
              onClick={() => setOpen((o) => toggle(o, c.criterion_key))}>
              {open.has(c.criterion_key) ? 'Hide' : 'History'} ({sum.count})
            </button>
            {open.has(c.criterion_key)
              ? <div data-testid={`tb-score-series-${c.criterion_key}`}>
                  {sum.latest?.reason ?? 'No reason recorded.'}</div>
              : null}
          </div>)
      })}

      {/* C5: the SAVE is blocked, and it names which criterion. */}
      <button type="button" data-testid="tb-score-record"
        disabled={!!blocking}
        onClick={() => {
          const keys = Object.keys(state.drafts)
          for (const k of keys) {
            const check = reasonAccepted(reasons[k] ?? '', series(k))
            const levels = levelsFor(criteria.find((c) => c.criterion_key === k))
            if (reasonRequired(Number(state.drafts[k]), levels, series(k)) && !check.ok) {
              setError(check.error ?? 'A reason is required.'); return
            }
          }
          setError(null)
          onRecord(state.drafts, reasons)
          setState((s) => recordScore(s, keys))
        }}>Record scores</button>
      {blocking
        ? <p className="msg-error" data-testid="tb-score-blocked">
            A reason is required at {blocking}.</p>
        : null}
      {error ? <p className="msg-error" data-testid="tb-score-error">{error}</p> : null}
    </div>
  )
}

/** The two panels that are pure reads, sharing the P3 pending/settled contract. */
export function ReadPanel({ panelId, panel, empty, children }: {
  /** Named panelId, not id: it is a data-testid, and a prop called `id` reads
      as a DOM id to the duplicate-id detector and to the next person. */
  panelId: PanelId
  panel: PanelState
  empty: string
  children?: React.ReactNode
}) {
  if (panel.error) return <p className="empty-state" data-testid={panelId}>{panel.error}</p>
  if (panel.pending || !panel.stage) {
    return <p className="empty-state" data-testid={panelId}>Loading {panel.pending}...</p>
  }
  return <div data-testid={panelId} data-stage={panel.stage}>{children ?? <p className="empty-state">{empty}</p>}</div>
}
