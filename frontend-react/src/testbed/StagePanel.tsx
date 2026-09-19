// ── THE STAGE PANEL ─────────────────────────────────────────────────────
//
// Round 7 Phase 2b. The rendering surface the B and C capabilities' logic has
// been waiting for: exit criteria, scoring, approvals and documents, all
// through the shared panel the eight stage tabs take turns in (T2).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatTimestamp } from '../../../src/lib/format-dates.js'
import {
  readExitCriteria, visibleRequirements, isTickable, exitSummary,
  type ExitRequirement,
} from './exitCriteria'
import {
  levelsFor, awaitingReason, toggle, anchorSet, type Criterion, type ScoreDrafts,
} from './scoring'
import { reasonRequired, reasonAccepted, type ScoreEntry } from './scoreReason'
import { currentEntry } from './QualificationScore'
import { useShell } from '../ShellContext'
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
export function ExitCriteria({ stage, data, panel, onTick, pending, approvals, approvalsPanel, approvers }: {
  stage: string
  data: unknown
  panel: PanelState
  onTick: (field: string, currentlyMet: boolean) => Promise<TickResult>
  /** R1: the track list, which used to be a panel of its own beside this one. */
  approvals?: React.ReactNode
  approvalsPanel?: PanelState
  /** R1: the approver this Test Bed names per track, or an empty name. */
  approvers?: ReadonlyArray<{ track: string, name: string }>
  /**
   * 2.6: the fields a score DRAFT would satisfy, from the drafts the scoring
   * card edits. Rendered from state rather than by poking the DOM, so a
   * re-render cannot drop a mark or leave a stale one.
   */
  pending?: ReadonlySet<string>
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

  // ── R11: THE ESTATE'S CARD, BY ITS NAME ────────────────────────────────
  //
  // The round put this panel BESIDE the scoring card, which is a `pg-card`, and
  // the screenshots showed the mismatch the pairing created: a framed card with
  // two unframed columns hanging under it. The chrome is the class rather than
  // a new stylesheet rule copying its border and padding, because the estate
  // has a named treatment for this role and a copy is a second reader of it
  // arriving in the stylesheet (Verification 7).
  //
  // Applied on EVERY load state, not only the settled one, or the panel gains a
  // border when its fetch returns and the row reflows under the person.
  const card = (body: React.ReactNode, stage?: string) => (
    <div className="pg-card" data-testid="tb-stage-exit-criteria-list" data-stage={stage}>
      <div className="pg-card-title">Exit criteria</div>
      {body}
    </div>)

  if (panel.error) {
    return card(<p className="empty-state">{panel.error}</p>)
  }
  if (panel.pending || !panel.stage) {
    return card(<p className="empty-state">Loading {panel.pending ?? stage}...</p>)
  }
  const res = readExitCriteria(data)
  const settled = (body: React.ReactNode) => card(body, panel.stage)
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

  // ── 2.6 PENDING MARKS ─────────────────────────────────────────────────
  //
  // The panel shows what the SERVER has recorded, and a draft is not that. So a
  // draft is a DIFFERENT mark, never an early tick, and distinguishable without
  // colour three ways: a filled dot rather than a check, a dashed border, and
  // the word "unsaved". A row whose server `met` is true is NEVER marked,
  // whatever is drafted (the vanilla's structural guard: a revision drafted on
  // a scored criterion does not turn a confirmed row into an unsaved one).
  const isPending = (r: ExitRequirement) => !r.met && typeof r.field === 'string' && !!pending?.has(r.field)
  const box = (met: boolean, pend = false) => (
    <span className={met ? 'tb-crit-box tb-crit-box--met' : (pend ? 'tb-crit-box tb-crit-box--pending' : 'tb-crit-box')}>
      {met ? '✓' : (pend ? '●' : '')}</span>)
  const tag = (pend: boolean) => (pend
    ? <span className="tb-crit-pending-tag" data-testid="tb-crit-pending-tag">unsaved</span> : null)

  return settled(<>
    {/* The vanilla's own treatment for this line: `sub` with a 10px gap below. */}
    <p className="sub" style={{ marginBottom: 10 }} data-testid="tb-crit-summary">{exitSummary(res)}</p>
    {visibleRequirements(res.requirements).map((r: ExitRequirement, i) => {
      // 2.6 applies its pending marks below, from `pending`, and never on a row
      // whose server `met` is true: `data-met` carries only the server's value.
      const pend = isPending(r)
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
            {box(shown, pend && !shown)}<span className="tb-crit-text">{r.label}</span>{tag(pend && !shown)}
          </div>)
      }
      // Computed: a document, an approval, a contact role, a score, or a
      // labelled field outside the tick keys. No role, no tab stop and no
      // handler, because a click here has nothing it may write.
      return (
        <div key={`c-${i}`} className="tb-crit-row tb-crit-row--computed"
          data-testid="tb-crit-computed" data-field={r.field ?? ''}
          data-met={r.met ? 'true' : 'false'} data-pending={pend ? 'true' : undefined}>
          {box(r.met, pend)}<span className="tb-crit-text">{r.message ?? r.label}</span>{tag(pend)}
        </div>)
    })}
    <div className={feedback ? 'tb-doc-feedback err' : 'tb-doc-feedback'}
      data-testid="tb-crit-feedback" role="status">{feedback}</div>
    {/* ── R1: THE APPROVALS, AS THIS PANEL'S CLOSING SECTION ──────────────
        They were a panel of their own beside this one, which put the approvals
        a gate DEMANDS at arm's length from the rows demanding them. The list and
        its controls are unchanged; what moved is where it sits, and each track
        now says who this Test Bed names for it. The names are payload fields,
        so an empty one says so rather than rendering a blank. */}
    <div className="tb-stage-approvals" data-testid="tb-stage-approvals-section">
      <p className="label">Approvals</p>
      {(approvers ?? []).map((a) => (
        <p key={a.track} className="sub" data-testid={`tb-stage-approver-${a.track}`}>
          {a.track}: {a.name || 'no approver named'}
        </p>))}
      <ReadPanel panelId="tb-stage-approval-row"
        panel={approvalsPanel ?? {}}
        empty="No approvals at this stage.">{approvals}</ReadPanel>
    </div>
  </>)
}

/**
 * C: THE SCORING CARD, Round A Phase 2.
 *
 * Built from the brief's 2.4 and 2.5 and the vanilla's `renderTbScores` and
 * `applyTbScoreEntryLock` (`54001c5^:frontend/test-bed-detail.js:1759-1793,
 * 2139-2343`), read for behaviour and not translated.
 *
 * P8 (kept): HIDDEN until the stage's own criteria are derived, by the `hidden`
 * attribute, which no stylesheet overrides. And a stage asking for nothing
 * shows NO card, not an empty one (the vanilla's "no panel means no panel").
 *
 * NO DOM `id` on the card: index.html still carries #tb-stage-scoring-card
 * outside any mount container. The ids below (a reason box for its label, an
 * anchors region for its toggle's aria-controls) are per criterion key and
 * appear nowhere in index.html.
 */
export function ScoringCard({ card, criteria, series, scores, onDraft, onReason, onRecord, measurability, onMeasurability }: {
  card: { hidden: boolean, stage?: string }
  criteria: readonly Criterion[]
  series: (key: string) => readonly ScoreEntry[]
  /** The drafts, held by StageTabs so the exit-criteria panel reads the same ones (2.6). */
  scores: ScoreDrafts
  onDraft: (key: string, value: string, awaiting: string | null) => void
  onReason: (key: string, value: string) => void
  /** 2.3: records the open stage's drafts; resolves to the message to show, or null. */
  onRecord: () => Promise<string | null>
  /** 2.4: whether the open stage's requirements name measurabilityConfirmed. */
  measurability: boolean
  /** 2.4: saves a yes or no at once; resolves to the message to show, or null. */
  onMeasurability: (confirmed: boolean) => Promise<string | null>
}) {
  // DISCLOSURE, not state (C7): none of it reaches the record.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  // Three states per criterion: undefined (nobody decided, a pending draft
  // opens it), true, false. A decision outranks the default, and an explicit
  // close survives the next focus of the select (the vanilla's Round 28 guard).
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [measError, setMeasError] = useState<string | null>(null)
  const [measBusy, setMeasBusy] = useState(false)
  // FOCUS MOVES INTO THE REASON BOX once it exists. It is rendered only for a
  // pending draft, so focusing in the change handler would focus nothing; the
  // effect runs after the render that produces it.
  const [focusFor, setFocusFor] = useState<string | null>(null)
  const reasonBoxes = useRef<Record<string, HTMLTextAreaElement | null>>({})
  useEffect(() => {
    if (!focusFor) return
    const ta = reasonBoxes.current[focusFor]
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
    setFocusFor(null)
  }, [focusFor, scores])

  const blocking = awaitingReason(scores.drafts, scores.reasons, criteria, series)
  const blockingName = blocking ? (criteria.find((c) => c.criterion_key === blocking)?.name ?? blocking) : null
  const anyDraft = criteria.some((c) => (scores.drafts[c.criterion_key] ?? '') !== '')

  // ── R2 OPTION B: THIS CARD IS A CALLER ────────────────────────────────
  //
  // Everything about how the popup behaves - at most one, dismiss on commit,
  // centred then clamped, the 420px clamp - is the shared module's. What this
  // card supplies is the three things only it knows: which criterion, which
  // level, and the wording, which comes from the anchors it already resolves.
  const anchorBox = (key: string): HTMLElement | null =>
    cardRef.current?.querySelector(`[data-testid="tb-score-anchor-${key}"]`) ?? null

  const showAnchorFor = (key: string, value: string, el: HTMLElement) => {
    const c = criteria.find((x) => x.criterion_key === key)
    const set = anchorSet(c, c?.current_version)
    const wording = set[value] ?? ''
    const box = anchorBox(key)
    // R1: 2 and 4 have no anchor, so there is nothing to show and nothing is
    // invented. Asking is simply a no-op rather than an empty popup.
    if (!wording || !box) return
    shell.showAnchor({
      anchor: el, box, key, wording,
      label: (c?.levels ?? []).find((l) => String(l.value) === value)?.label ?? value,
      groupSelector: '.tb-score-levels',
    })
  }

  const commitLevel = (
    key: string, value: string, levels: { value: number }[],
    s: readonly ScoreEntry[], blocking: string | null, isBlocking: boolean,
  ) => {
    onDraft(key, value, blocking)
    // R6, inherited: committing clears the popup until a genuine re-entry.
    shell.dismissAnchor(key)
    if (value !== '' && (!blocking || isBlocking) && reasonRequired(Number(value), levels, s)) setFocusFor(key)
  }

  // ── R3: ARROWS WALK THE GROUP, WITH THE ANCHOR FOLLOWING ──────────────
  //
  // Per the R-K standard. Enter commits the focused number, Escape reverts per
  // A3, and the arrows move focus - which, because focus is what shows the
  // anchor, is what makes the wording follow without a second mechanism.
  const onLevelKey = (
    e: KeyboardEvent<HTMLElement>, key: string, value: string, levels: { value: number }[],
  ) => {
    if (e.key === 'Escape') { e.preventDefault(); onDraft(key, '', null); return }
    if (e.key === 'Enter' || e.key === ' ') return   // the click handler takes these
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = levels.findIndex((l) => String(l.value) === value)
    const next = levels[i + step]
    if (!next) return
    const el = cardRef.current?.querySelector<HTMLElement>(
      `[data-testid="tb-score-btn-${key}-${next.value}"]`)
    el?.focus()
  }
  const when = (at?: string) => formatTimestamp(at)

  const shell = useShell()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const measSeries = series('measurabilityConfirmed')
  const measCurrent = currentEntry(measSeries)

  return (
    <div className="pg-card" ref={cardRef} data-testid="tb-stage-scoring-card"
      hidden={card.hidden || (!criteria.length && !measurability)} data-stage={card.stage}>
      <div className="pg-card-title">Scoring</div>

      {/* ── W9: THE LOCK NOTE IS GONE, CONSOLIDATED ────────────────────────
          It said which criterion and why, at the top of the card, while the
          blocking row said the same thing again in its label and every other
          row said it a third time by being disabled. Three tellings of one
          state, none of them beside the rows they were about.
          The state is now carried where it happens: the blocking row is marked,
          and ONE line under it names the block for the rows it quietened. */}

      {measurability
        ? (
          <div className="tb-score-row" data-criterion="measurabilityConfirmed"
            data-testid="tb-score-measurability" data-entries={measSeries.length}>
            <div className="tb-score-head">
              <span className="tb-score-name">Can the proposed sensors capture what would be measured?</span>
              <span className={measCurrent ? 'tb-score-value' : 'tb-score-value tb-score-value--none'}
                data-testid="tb-measurability-value">
                {measCurrent ? (measCurrent.value ? 'Yes' : 'No') : 'Not confirmed'}</span>
              {/* Saves on choice; it is always offered empty, so it reads as
                  "confirm" or "change" rather than holding a value it has not sent. */}
              <select className="tb-score-select" aria-label="Measurability confirmation"
                data-testid="tb-measurability-select" value=""
                disabled={!!blocking || measBusy}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') return
                  setMeasError(null)
                  setMeasBusy(true)
                  void onMeasurability(v === 'yes').then((msg) => { setMeasError(msg); setMeasBusy(false) })
                }}>
                <option value="">{measCurrent ? 'Change...' : 'Confirm...'}</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {measCurrent
              ? (
                <div className="ref-notes-row tb-score-entry" data-testid="tb-measurability-entry">
                  <span className="ref-notes-when">{when(measCurrent.at)}</span>
                  <span className="ref-notes-author">{measCurrent.by ?? '--'}</span>
                  <span className="ref-notes-text">{measCurrent.value ? 'Yes' : 'No'} at {measCurrent.stage ?? ''}</span>
                </div>)
              : null}
            {measError ? <p className="msg-error" data-testid="tb-measurability-error">{measError}</p> : null}
          </div>)
        : null}

      {criteria.map((c) => {
        const key = c.criterion_key
        const name = c.name ?? key
        const levels = levelsFor(c)
        const s = series(key)
        const current = currentEntry(s)
        const draft = scores.drafts[key] ?? ''
        const isBlocking = blocking === key
        const required = draft !== '' && reasonRequired(Number(draft), levels, s)
        const open = expanded.has(key)
        const set = anchorSet(c, c.current_version)
        const wording = (value: number, description?: string | null) => set[String(value)] ?? description ?? ''

        // ── W7 AND W8a: ESCAPE REVERTS, AND RELEASES ───────────────────
        //
        // Ruling A3 (John, Leads round Phase 0, 2026-09-11, built in `daa90af`)
        // already says Escape reverts the focused field to its last saved
        // value. It lives in the FIELD ROW and has never reached this card,
        // whose controls are bespoke: this is a gap rather than a regression,
        // and the archaeology is in the phase report.
        //
        // Reverting a scoring draft IS dropping it: `applyDraft` with an empty
        // value deletes the draft AND its reason, so the recorded score stands
        // again and `awaitingReason` recomputes to null. That is W8a for free -
        // the lock is derived from the drafts, so removing the draft releases
        // it, and there is no second mechanism to keep in step.
        //
        // `preventDefault` and NOT `stopPropagation`, matching the field row's
        // own editors exactly: an Escape that reverts a field must not also
        // become an Escape that closes something a parent owns, and changing
        // what an element lets through is its own class of defect
        // (Verification 7's behaviour axis).
        //
        // With no draft this is a no-op by construction, because deleting an
        // absent key changes nothing. A recorded score cannot be destroyed by
        // pressing Escape at it.
        const revertOnEscape = (e: KeyboardEvent<HTMLElement>) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          onDraft(key, '', blocking)
        }
        return (
          <div key={key} data-testid={`tb-score-${key}`}
            className={isBlocking ? 'tb-score-row tb-score-row--blocking' : 'tb-score-row'}
            data-criterion={key} data-entries={s.length}
            data-blocking={isBlocking ? 'true' : undefined}>
            <div className="tb-score-head">
              <span className="tb-score-name">{name}</span>
              <span className={current ? 'tb-score-value' : 'tb-score-value tb-score-value--none'}
                data-testid={`tb-score-value-${key}`}>
                {current && current.value !== undefined ? String(current.value) : 'Not scored'}</span>
              {/* THE BLOCKING CRITERION KEEPS ITS OWN CONTROL: changing the level
                  is a legitimate way out of needing a reason. */}
              {/* ── R1: FIVE BUTTONS, AND THE ANCHOR AT THE POINT OF USE ──
                  The select is gone. Hover or focus on a number shows THAT
                  number's anchor through the SHARED popup (R2 option B), so
                  this card is a CALLER and not a second mechanism.

                  2 AND 4 RENDER AS BARE NUMBERS. Phase 0 measured ZERO anchor
                  rows at those scores on every test_bed criterion, so there is
                  nothing to show and nothing is invented for them - asking for
                  their wording simply shows nothing.

                  ── R3: ONE TAB STOP, NOT FIVE ────────────────────────────
                  A roving tabindex. Five buttons each taking a tab stop would
                  turn one criterion into five, and the ruling is that the tab
                  order is unbroken: the group is reached by Tab and walked by
                  arrows, which is what a radio group does and what the
                  Opportunity's own level row already does. */}
              <span className="tb-score-levels" role="radiogroup"
                aria-label={`${name} score`} data-testid={`tb-score-levels-${key}`}>
                {levels.map((l) => {
                  const v = String(l.value)
                  const chosen = draft !== '' ? draft === v : String(current?.value ?? '') === v
                  const roving = draft !== '' ? draft === v
                    : (String(current?.value ?? '') === v || (!current && String(levels[0]?.value) === v))
                  return (
                    <button type="button" key={v}
                      className={chosen ? 'tb-score-btn tb-score-btn--on' : 'tb-score-btn'}
                      data-testid={`tb-score-btn-${key}-${v}`}
                      data-criterion={key} data-level={v}
                      role="radio" aria-checked={chosen}
                      tabIndex={roving ? 0 : -1}
                      disabled={!!blocking && !isBlocking}
                      onMouseOver={(e) => showAnchorFor(key, v, e.currentTarget)}
                      onFocus={(e) => showAnchorFor(key, v, e.currentTarget)}
                      onMouseLeave={() => shell.hideAnchor()}
                      onBlur={() => shell.hideAnchor()}
                      onKeyDown={(e) => onLevelKey(e, key, v, levels)}
                      onClick={() => commitLevel(key, v, levels, s, blocking, isBlocking)}>
                      {l.label ?? l.value}
                    </button>)
                })}
              </span>
              {/* R2: the box the SHARED module positions and fills. The card
                  renders it and owns nothing about how it behaves. */}
              <span className="anchor-defn hidden" role="tooltip" aria-hidden="true"
                data-testid={`tb-score-anchor-${key}`} />


              {/* ── W4, John's walk, 2026-09-18: THE REASON IS PART OF SCORING ──
                  It opened at the BOTTOM of the row, below the definitions, in
                  a row whose right-hand half was empty: answering "why" meant
                  reading past the anchors to find the box. R2 gave this row the
                  full width of the panel strip, and this is what that width is
                  for.

                  In the HEAD, so it is beside the select it belongs to. The
                  definitions stay below: moving them up would put a long list
                  between one criterion and the next.

                  ── W6 AND W10: ONE SLOT, TWO OCCUPANTS ───────────────────
                  W6 puts the reason IMMEDIATELY right of the select, so the
                  history button moved below the head rather than sitting
                  between them. W10 gives the same slot to the RECORDED reason
                  when nothing is drafted: a reason is read where it was
                  written, and it used to render under the row instead. */}
              {draft !== ''
                ? (
                  <div className={isBlocking ? 'tb-score-reason tb-score-reason--needed' : 'tb-score-reason'}>
                    {/* NOT COLOUR ALONE: the label's words change too. W9 takes
                        the blocking wording OUT of here: the row is marked and
                        one line below it names the block, so this says what the
                        field is rather than restating the state a third time. */}
                    <label htmlFor={`tb-score-reason-${key}`} data-testid={`tb-score-reason-label-${key}`}>
                      {required ? 'Reason (required)' : 'Reason (optional)'}</label>
                    {/* ONE LINE, GROWING ONLY WHEN THE TEXT NEEDS IT (W6). The
                        height is set from the content's own scrollHeight, which
                        is the only thing that knows how many lines there are. */}
                    <textarea id={`tb-score-reason-${key}`} rows={1}
                      data-testid={`tb-score-reason-${key}`}
                      ref={(el) => {
                        reasonBoxes.current[key] = el
                        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
                      }}
                      value={scores.reasons[key] ?? ''}
                      onKeyDown={revertOnEscape}
                      onChange={(e) => {
                        e.target.style.height = 'auto'
                        e.target.style.height = `${e.target.scrollHeight}px`
                        onReason(key, e.target.value)
                      }} />
                  </div>)
                : current && (current.comment || current.reason)
                ? (
                  <div className="tb-score-current" data-testid={`tb-score-current-${key}`}>
                    {current.comment ? <span className="tb-score-current-text">{current.comment}</span> : null}
                    {current.reason ? <span className="tb-score-current-text"><em>Reason:</em> {current.reason}</span> : null}
                  </div>)
                : null}
            </div>

            {/* THE CURRENT ENTRY'S EXPLANATION moved INTO the head (W10): a
                reason is read where it was written. It rendered here, under the
                row, which is the one place the person who typed it never
                looked. */}

            {/* THE QUESTION, verbatim, outside the anchors: it labels the criterion.
                FIRST under the head, because it is about THIS criterion. The
                history control moved below it: opening the screenshot showed
                "SHOW HISTORY (2)" sitting between the score and the question it
                belongs to, which reads as an interruption. */}
            {c.asks ? <p className="tb-score-asks" data-testid={`tb-score-asks-${key}`}>{c.asks}</p> : null}

            {s.length > 1
              ? (
                <button type="button" className="btn-text" aria-expanded={open}
                  data-testid={`tb-score-history-${key}`}
                  onClick={() => setExpanded((o) => toggle(o, key))}>
                  {open ? 'Hide history' : `Show history (${s.length})`}</button>)
              : null}

            {/* ── R4: SHOW DEFINITIONS IS GONE ─────────────────────────
                Ruled 2026-09-19. The anchors are at the point of use now: hover
                or focus a number and that number's wording appears. A toggle
                that reveals all five below the row is the thing the point-of-use
                anchor replaces, and keeping both would be two ways to read the
                same wording.

                THE DATA AND THE ROUTE ARE UNTOUCHED, which the ruling is
                explicit about, and HISTORY ENTRIES STILL SHOW THEIR ANCHOR TEXT
                below - an old score keeps meaning what it meant. Only the
                toggle goes. */}



            {/* HISTORY, NEWEST FIRST, each entry resolved against its OWN anchor
                version, so an old score keeps meaning what it meant when the
                anchors are revised. */}
            {open
              ? (
                <div className="tb-score-history" data-testid={`tb-score-series-${key}`}>
                  {[...s].reverse().map((e, i) => {
                    const own = typeof e.value === 'number' ? anchorSet(c, e.anchorVersion)[String(e.value)] : undefined
                    return (
                      <div key={`${e.at ?? ''}-${i}`} className="ref-notes-row tb-score-entry" data-testid="tb-score-entry">
                        <span className="ref-notes-when">{when(e.at)}</span>
                        <span className="ref-notes-author">{e.by ?? '--'}</span>
                        <span className="ref-notes-text">
                          <strong>{String(e.value)}</strong>{e.stage ? ` at ${e.stage}` : ''}{' '}
                          <span className="sub">v{String(e.anchorVersion ?? '?')}</span>
                          {e.comment ? <><br />{e.comment}</> : null}
                          {e.reason ? <><br /><em>Reason: {e.reason}</em></> : null}
                          {own ? <><br /><span className="tb-score-entry-anchor">{own}</span></> : null}
                        </span>
                      </div>)
                  })}
                </div>)
              : null}

            {/* W9: ONE LINE, ONCE, naming the block for the rows it quietened.
                LAST in the row, because it is about what comes AFTER it: the
                old note said this at the top of the card, away from every row
                it concerned, and putting it above the criterion's own question
                read as an interruption when the screenshot was opened. */}
            {isBlocking
              ? <p className="tb-score-quieted" data-testid="tb-score-quieted-note">
                  The other criteria are waiting on the Reason for {name}.</p>
              : null}
          </div>)
      })}

      {/* 2.3: nothing to send is not a request. The old button posted
          `{"entries":[]}` with no drafts at all (P0.1). */}
      {criteria.length
        ? (
          /* ── R5: THE ESTATE'S TREATMENT, NOT A BROWSER DEFAULT ─────────
              Carried from the scoring round's close, which named it and left
              it: this control shipped with NO class at all, so the most
              prominent action on the scoring card rendered as a WHITE browser
              default on a dark screen. It was the only one of the three
              buttons in this file without a class.

              `btn-sm btn-primary` is what `Next Stage` wears on this same
              surface and what the walk-2 suite already asserts there, so the
              two primary actions on one card now read as the same kind of
              thing. It matters twice over because this control is disabled
              most of the time and `.btn-sm:disabled` carries a real treatment,
              where a bare disabled button is a grey default. */
          <button type="button" data-testid="tb-score-record" className="btn-sm btn-primary"
            disabled={!!blocking || !anyDraft || busy}
            onClick={() => {
              for (const c of criteria) {
                const k = c.criterion_key
                if ((scores.drafts[k] ?? '') === '') continue
                const check = reasonAccepted(scores.reasons[k] ?? '', series(k))
                if (reasonRequired(Number(scores.drafts[k]), levelsFor(c), series(k)) && !check.ok) {
                  setError(check.error ?? 'A reason is required.'); return
                }
              }
              setError(null)
              setBusy(true)
              void onRecord().then((msg) => { setError(msg); setBusy(false) })
            }}>Record scores</button>)
        : null}
      {error ? <p className="msg-error" data-testid="tb-score-error">{error}</p> : null}
    </div>
  )
}

/** The two panels that are pure reads, sharing the P3 pending/settled contract. */
export function ReadPanel({ panelId, panel, empty, title, children }: {
  /** Named panelId, not id: it is a data-testid, and a prop called `id` reads
      as a DOM id to the duplicate-id detector and to the next person. */
  panelId: PanelId
  panel: PanelState
  empty: string
  /**
   * R11: when given, the panel is one of the row's own cards and wears the
   * estate's `pg-card` with this as its eyebrow, on every load state.
   *
   * WITHOUT IT NOTHING CHANGES, deliberately. The other caller is the approval
   * track list INSIDE the exit criteria panel, which is a section of a card
   * rather than a card, and a card nested in a card is the mismatch this
   * ruling exists to remove rather than a second instance of it.
   */
  title?: string
  children?: React.ReactNode
}) {
  if (title) {
    return (
      <div className="pg-card" data-testid={panelId} data-stage={panel.stage}>
        <div className="pg-card-title">{title}</div>
        {panel.error
          ? <p className="empty-state">{panel.error}</p>
          : (panel.pending || !panel.stage)
              ? <p className="empty-state">Loading {panel.pending}...</p>
              : (children ?? <p className="empty-state">{empty}</p>)}
      </div>)
  }
  if (panel.error) return <p className="empty-state" data-testid={panelId}>{panel.error}</p>
  if (panel.pending || !panel.stage) {
    return <p className="empty-state" data-testid={panelId}>Loading {panel.pending}...</p>
  }
  return <div data-testid={panelId} data-stage={panel.stage}>{children ?? <p className="empty-state">{empty}</p>}</div>
}
