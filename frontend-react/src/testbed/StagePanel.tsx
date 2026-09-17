// ── THE STAGE PANEL ─────────────────────────────────────────────────────
//
// Round 7 Phase 2b. The rendering surface the B and C capabilities' logic has
// been waiting for: exit criteria, scoring, approvals and documents, all
// through the shared panel the eight stage tabs take turns in (T2).
import { useEffect, useState, type KeyboardEvent } from 'react'
import {
  readExitCriteria, visibleRequirements, isTickable, exitSummary,
  type ExitRequirement,
} from './exitCriteria'
import {
  levelsFor, awaitingReason, toggle, type Criterion, type ScoreDrafts,
} from './scoring'
import { reasonRequired, reasonAccepted, type ScoreEntry } from './scoreReason'
import { currentEntry } from './QualificationScore'
import type { PanelId, PanelState } from './stageLoad'

/** What a tick attempt came back with. `error: null` means refused with nothing to say (the door). */
export interface TickResult { ok: boolean, error?: string | null }

/**
 * B: THE EXIT-CRITERIA PANEL, Round A Phase 1.
 *
 * Renders the route's OBJECT, `{ from_stage, to_stage, blocking,
 * requirements[] }`. It rendered its empty branch on every stage for as long
 * as the React screen existed, because the object was cast to an array (audit
 * B3, reproduced live as P0.3: 14 requirements served, 0 shown).
 *
 * Behaviour, from the brief's 1.1-1.7 and the vanilla's recorded reasoning:
 *   1.1 the summary counts ALL requirements and names to_stage;
 *   1.2 met is the server's own `met`, never read off the payload;
 *   1.3 a row is tickable only for a labelled member of the four tick keys,
 *       and every other row is a computed, read-only row;
 *   1.4 process rows always show, data-entry rows only while unmet;
 *   1.5 tick writes an ISO timestamp, untick writes null, through the host's
 *       revision-carrying patch. NO QUEUE, by the brief's scale position: a
 *       rapid double tick answers 409 and reloads, which is a safe failure;
 *   1.6 a failed tick says so in the panel and leaves the row as it was;
 *   1.7 pending marks arrive in Phase 2.6, at the point named below.
 */
export function ExitCriteria({ stage, data, panel, onTick }: {
  stage: string
  data: unknown
  panel: PanelState
  onTick: (field: string, currentlyMet: boolean) => Promise<TickResult>
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  // ── A CONFIRMED TICK SHOWS BEFORE THE RECOMPUTE LANDS ──────────────────
  //
  // The vanilla measured this: click to visible tick was 1162ms, because the
  // row waited on a full re-read of every OTHER row. A row flips here only after
  // the server has ACCEPTED its own PATCH, so nothing is shown that the server
  // has not confirmed; what it no longer waits for is the recomputation. It is
  // a record of a confirmed write, never a derivation from the payload, and it
  // is dropped the moment a fresh response arrives, so the server's `met` is
  // what the row shows from then on. `data-met` never reads it.
  const [confirmed, setConfirmed] = useState<ReadonlyMap<string, boolean>>(new Map())
  useEffect(() => { setConfirmed(new Map()) }, [data])

  if (panel.error) {
    return <p className="empty-state" data-testid="tb-stage-exit-criteria-list">{panel.error}</p>
  }
  if (panel.pending || !panel.stage) {
    return <p className="empty-state" data-testid="tb-stage-exit-criteria-list">
      Loading {panel.pending ?? stage}...</p>
  }
  const res = readExitCriteria(data)
  const settled = (body: React.ReactNode) => (
    <div data-testid="tb-stage-exit-criteria-list" data-stage={panel.stage}>{body}</div>)
  // An unreadable answer is not an empty one, so it does not say "no criteria".
  if (!res) return settled(<p className="empty-state">Unable to load exit criteria.</p>)
  if (res.to_stage === null) {
    return settled(<p className="empty-state">
      This is the final stage - nothing further to exit toward.</p>)
  }
  if (!res.requirements.length) {
    return settled(<p className="empty-state">
      No exit criteria configured for {res.to_stage}.</p>)
  }

  const tick = async (field: string, currentlyMet: boolean) => {
    setFeedback(null)
    const r = await onTick(field, currentlyMet)
    if (r.ok) {
      setConfirmed((m) => new Map(m).set(field, !currentlyMet))
      return
    }
    // A failed write must not look like a success: the row is left exactly as
    // it was, and the reason is said where the click happened.
    if (r.error !== null) setFeedback(`Could not update: ${r.error ?? 'unknown error'}`)
  }

  const box = (met: boolean) => (
    <span className={met ? 'tb-crit-box tb-crit-box--met' : 'tb-crit-box'}>
      {met ? '✓' : ''}</span>)

  return settled(<>
    {/* The vanilla's own treatment for this line: `sub` with a 10px gap below. */}
    <p className="sub" style={{ marginBottom: 10 }} data-testid="tb-crit-summary">{exitSummary(res)}</p>
    {visibleRequirements(res.requirements).map((r: ExitRequirement, i) => {
      // 1.7: PHASE 2.6 APPLIES PENDING MARKS HERE, from the score-draft state
      // this panel will then render from - and never on a row whose server
      // `met` is true, which is why `data-met` carries only the server's value.
      if (isTickable(r)) {
        const field = r.field as string
        const shown = confirmed.get(field) ?? r.met
        return (
          <div key={`t-${field}`} className="tb-crit-row tb-crit-row--tickable"
            role="checkbox" aria-checked={shown} tabIndex={0}
            data-testid={`tb-crit-${field}`} data-field={field}
            data-met={r.met ? 'true' : 'false'}
            title={shown ? 'Tick to clear' : 'Tick to confirm'}
            onClick={() => { void tick(field, shown) }}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void tick(field, shown) }
            }}>
            {box(shown)}<span className="tb-crit-text">{r.label}</span>
          </div>)
      }
      // Computed: a document, an approval, a contact role, a score, or a
      // labelled field outside the tick keys. No role, no tab stop and no
      // handler, because a click here has nothing it may write.
      return (
        <div key={`c-${i}`} className="tb-crit-row tb-crit-row--computed"
          data-testid="tb-crit-computed" data-field={r.field ?? ''}
          data-met={r.met ? 'true' : 'false'}>
          {box(r.met)}<span className="tb-crit-text">{r.message ?? r.label}</span>
        </div>)
    })}
    <div className={feedback ? 'tb-doc-feedback err' : 'tb-doc-feedback'}
      data-testid="tb-crit-feedback" role="status">{feedback}</div>
  </>)
}

/**
 * C: the scoring card.
 *
 * P8: the card is HIDDEN until its own criteria are derived, so one stage can
 * never show another's while a fetch is in flight. The `hidden` attribute is
 * used rather than a class, and nothing gives that class a `display` - the
 * Round 5 finding that an attribute assertion is not a visibility assertion.
 */
export function ScoringCard({ card, criteria, series, scores, onDraft, onReason, onRecord }: {
  card: { hidden: boolean, stage?: string }
  criteria: readonly Criterion[]
  series: (key: string) => readonly ScoreEntry[]
  /** The drafts, held by StageTabs so the exit-criteria panel reads the same ones (2.6). */
  scores: ScoreDrafts
  onDraft: (key: string, value: string, awaiting: string | null) => void
  onReason: (key: string, value: string) => void
  /** 2.3: records the open stage's drafts; resolves to the message to show, or null. */
  onRecord: () => Promise<string | null>
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const state = scores
  const reasons = scores.reasons

  const blocking = awaitingReason(state.drafts, reasons, criteria, series)
  const anyDraft = criteria.some((c) => (state.drafts[c.criterion_key] ?? '') !== '')

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
        const locked = !!blocking && blocking !== c.criterion_key
        const draft = state.drafts[c.criterion_key] ?? ''
        const needsReason = reasonRequired(Number(draft), levels, series(c.criterion_key))
        const sum = { latest: currentEntry(series(c.criterion_key)), count: series(c.criterion_key).length }
        return (
          <div key={c.criterion_key} data-testid={`tb-score-${c.criterion_key}`}
            className="tb-score-row" data-criterion={c.criterion_key}
            data-entries={series(c.criterion_key).length}>
            <span>{c.name ?? c.criterion_key}</span>
            <select disabled={locked} value={draft}
              data-testid={`tb-score-select-${c.criterion_key}`}
              onChange={(e) => onDraft(c.criterion_key, e.target.value, blocking)}>
              <option value="">--</option>
              {levels.map((l) => (
                <option key={l.value} value={String(l.value)}>{l.label ?? l.value}</option>))}
            </select>
            {needsReason
              ? <textarea data-testid={`tb-score-reason-${c.criterion_key}`}
                  value={reasons[c.criterion_key] ?? ''}
                  onChange={(e) => onReason(c.criterion_key, e.target.value)} />
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
      {/* 2.3: nothing to send is not a request. The old button posted
          `{"entries":[]}` with no drafts at all (P0.1). */}
      <button type="button" data-testid="tb-score-record"
        disabled={!!blocking || !anyDraft || busy}
        onClick={() => {
          for (const c of criteria) {
            const k = c.criterion_key
            if ((state.drafts[k] ?? '') === '') continue
            const check = reasonAccepted(reasons[k] ?? '', series(k))
            if (reasonRequired(Number(state.drafts[k]), levelsFor(c), series(k)) && !check.ok) {
              setError(check.error ?? 'A reason is required.'); return
            }
          }
          setError(null)
          setBusy(true)
          void onRecord().then((msg) => { setError(msg); setBusy(false) })
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
