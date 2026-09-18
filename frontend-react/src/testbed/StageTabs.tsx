// ── THE STAGE-TAB SHELL ─────────────────────────────────────────────────
//
// Round 7 Phase 2b session 1. This is the surface the five LOGIC-ONLY
// capabilities render through, and building it is what connects them to the
// reach graph.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TB_TABS, isStageTab, stageOf, paneFor, landingTab, shouldClearFeedback,
  nextStageState,
} from './tabModel'
import {
  createStageLoader, PANEL_IDS, type PanelId, type PanelState, type Stage,
  type Fetched,
} from './stageLoad'
import { ExitCriteria, ScoringCard, ReadPanel, type TickResult } from './StagePanel'
import { readExitCriteria } from './exitCriteria'
import { UnitsPane, LockedCounts } from './UnitsPane'
import {
  applyDraft, applyReason, clearRecorded, recordOutcomeMessage, measurabilityAsked, NO_DRAFTS,
  type Criterion, type ScoreDrafts, type RecordOutcome,
} from './scoring'
import type { ScoreEntry } from './scoreReason'
import type { Unit } from './units'
import type { QueueDeps } from './unitQueue'

export interface StageTabsDeps {
  stages: readonly Stage[]
  documents: (stage: string) => Promise<Fetched>
  criteria: (stage: string) => Promise<Fetched>
  approvals: (stage: string) => Promise<Fetched>
  scoringCriteria: (stage: string) => readonly Criterion[]
  series: (key: string) => readonly ScoreEntry[]
  /** 1.5: one tick attempt. The host owns the write, the door and the refresh. */
  onTick: (field: string, currentlyMet: boolean) => Promise<TickResult>
  /** 2.3: records the given criteria's drafts, one entry at a time, in their order. */
  onRecordScores: (criteria: readonly Criterion[], scores: ScoreDrafts) => Promise<RecordOutcome>
  /** 2.4: one yes or no on its own route; resolves to the message to show, or null. */
  onMeasurability: (confirmed: boolean) => Promise<string | null>
  onDeriveUnits: () => Promise<void>
  /** L2: a locked count's correction, carrying the reason the server requires. */
  onCorrectCount?: (countKey: string, count: string, reason: string) => Promise<string | null>
  unitDeps: Omit<QueueDeps, 'onRowState'>
}

const emptyPanels = () => Object.fromEntries(
  PANEL_IDS.map((id) => [id, {} as PanelState])) as Record<PanelId, PanelState>

/** R3: the stage HAS documents when its own answer names at least one. */
export function hasDocuments(data: unknown): boolean {
  const d = data as { reference_docs?: unknown[], completable_documents?: unknown[] } | null
  return !!d && ((d.reference_docs?.length ?? 0) > 0 || (d.completable_documents?.length ?? 0) > 0)
}

/**
 * R1: the approver configured for each track on THIS Test Bed. The fields are
 * payload keys carrying a staff NAME (measured: `terminus_staff` has no
 * `user_id`, and `track_approvers` holds no test_bed row), so this is what the
 * record says rather than who the server would accept.
 */
export function approversOf(payload: Record<string, unknown> | undefined): Array<{ track: string, name: string }> {
  return [
    { track: 'Commercial', name: String(payload?.commercialAuthority ?? '').trim() },
    { track: 'Technical', name: String(payload?.technicalAuthority ?? '').trim() },
    { track: 'Legal', name: String(payload?.terminusLegalOwner ?? '').trim() },
  ]
}

export function StageTabs({ payload, units, landing, fresh, currentStage, nextStage, deps, reference, commercials, installSection, documents, approvals, closed, onNextStage, refreshToken, recordId, reloadToken }: {
  payload: Record<string, unknown>
  /**
   * R12: moves each time the HOST reloads its own record after a save. The
   * blocked list the shell wrote is cleared then and at no other time.
   */
  reloadToken?: number
  /**
   * The record these drafts belong to. The shell re-renders the Test Bed VIEW
   * rather than mounting a new one (Verification 47), but TestBedView keys the
   * host on `navToken ?? id`, so in production each navigation REMOUNTS this
   * component and the drafts start empty anyway. Measured in Round A Phase 4:
   * removing that key live made a blocked list follow the person to the next
   * record. The reset below therefore matters only to a caller that re-renders
   * the host directly, as the jsdom tests do; recorded rather than removed.
   */
  recordId?: string
  units: readonly Unit[]
  landing: string | null
  fresh: boolean
  currentStage: string
  nextStage: string | null
  deps: StageTabsDeps
  reference: React.ReactNode
  commercials: React.ReactNode
  installSection?: React.ReactNode
  /** M: the documents panel's own content, per stage. */
  documents?: (stage: string, data: unknown) => React.ReactNode
  /** A: the shared track list. */
  approvals?: (stage: string, data: unknown) => React.ReactNode
  /** Z: the terminal tab's content. */
  closed?: React.ReactNode
  /** X: the Next Stage action. T7 already decides enablement. */
  onNextStage?: () => void
  /**
   * F: RE-LOAD THE OPEN STAGE after a write that can change it.
   *
   * The vanilla's `refreshTbStagePanels` reloads documents and exit criteria
   * and NOT approvals - a deliberate scoping, since a document confirmation
   * cannot change an approval. THIS RE-RUNS THE WHOLE STAGE LOAD, which is a
   * recorded divergence rather than an oversight: there is ONE loader and one
   * path (Architecture 3), and a second partial one would agree with it today
   * and drift later. The cost is one extra GET on a panel that has not changed.
   */
  refreshToken?: number
}) {
  const [userPicked, setUserPicked] = useState(false)
  const [active, setActive] = useState<string>(() =>
    landingTab({ landing, fresh, userPicked: false, openTab: null }))
  const [panels, setPanels] = useState<Record<PanelId, PanelState>>(emptyPanels)
  const [card, setCard] = useState<{ hidden: boolean, stage?: string }>({ hidden: true })
  const [installVisible, setInstallVisible] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  // THE ROUTE'S OBJECT, carried as it arrived. This was `Criterion_[]` and the
  // response was cast into it, which is how every stage read "No exit criteria"
  // while the server sent 14 (P0.3). The panel reads it through its own guard.
  const [criteriaData, setCriteriaData] = useState<unknown>(null)
  const [terminal, setTerminal] = useState(false)
  const [panelData, setPanelData] = useState<{ documents: unknown, approvals: unknown }>(
    { documents: null, approvals: null })
  const lastTab = useRef<string | null>(null)

  // R12: the one clear this surface makes on the shell's element. The token
  // starts at 0 and the host moves it only from load(), which it calls only
  // after a write, so a mount or a tab change never reaches the clear.
  const blockedRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (reloadToken && blockedRef.current) blockedRef.current.innerHTML = ''
  }, [reloadToken])
  // THE SCORE DRAFTS, above both panels: the scoring card edits them and the
  // exit-criteria panel will read them for its pending marks (2.6). They survive
  // a tab switch, as the vanilla's did, and reset when the RECORD changes.
  const [scores, setScores] = useState<ScoreDrafts>(NO_DRAFTS)
  const [scoresFor, setScoresFor] = useState(recordId)
  if (scoresFor !== recordId) { setScoresFor(recordId); setScores(NO_DRAFTS) }

  // ── THE LOADER IS CREATED ONCE AND READS THE LATEST DEPS ─────────────
  //
  // It held ONE deps object, captured on first render. The stage list arrives
  // from a fetch, so on that first render it was EMPTY - and the terminal check
  // reads the last stage by sort order, so it could never be true and the
  // Closed tab rendered the ordinary panels for ever. Found by the live walk;
  // every jsdom test passes its stages in synchronously and could not see it.
  //
  // The loader must stay a single instance, because its P1 token is what orders
  // overlapping loads - recreating it per render would reset the token and
  // reintroduce the race. So the instance is stable and the DEPS are read
  // through a ref.
  const depsRef = useRef(deps)
  depsRef.current = deps
  const loader = useRef(createStageLoader({
    documents: (stage) => depsRef.current.documents(stage),
    criteria: (stage) => depsRef.current.criteria(stage),
    approvals: (stage) => depsRef.current.approvals(stage),
    get stages() { return depsRef.current.stages },
    onPanel: (id, s) => setPanels((p) => ({ ...p, [id]: s })),
    onScoringCard: setCard,
    onInstallSection: setInstallVisible,
    // No onDeriveUnits here (Test Bed units Phase 1, audit R1): opening a tab is
    // a read. `deps.onDeriveUnits` reaches ONLY the units pane's button, below.
  }))

  const activate = useCallback(async (key: string) => {
    // T6: clear on a tab CHANGE, never on a re-apply - a re-apply would erase
    // the message a failed score save writes before reloading.
    if (shouldClearFeedback(lastTab.current, key)) setFeedback(null)
    lastTab.current = key
    setActive(key)
    if (!isStageTab(key)) return
    const stage = stageOf(key) as string
    const r = await loader.current.open(stage)
    setTerminal(r.terminal)
    if (r.panels['tb-stage-exit-criteria-list'] !== undefined) {
      setCriteriaData(r.panels['tb-stage-exit-criteria-list'])
    }
    setPanelData({
      documents: r.panels['tb-stage-documents-section'] ?? null,
      approvals: r.panels['tb-stage-approval-row'] ?? null,
    })
  }, [])

  // The landing tab is re-derived on every RECORD change, not on mount: the
  // shell re-renders this view rather than mounting a new one, so a mount-keyed
  // effect would never run again (Verification 47's re-navigation clause).
  useEffect(() => {
    void activate(landingTab({ landing, fresh, userPicked, openTab: lastTab.current }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing, fresh, activate])

  // F1: only when a stage tab is open. Nothing to refresh on Reference, and
  // re-activating it would be a needless re-render.
  useEffect(() => {
    // NO `isStageTab` CLAUSE HERE, and its absence is measured rather than an
    // oversight: `activate` already returns before any fetch for a non-stage
    // tab, so the extra check removed nothing. Its injection came back SILENT
    // with zero failures, which is Verification 9's signature for a guard whose
    // removal changes nothing observable - dead or redundant, and both are
    // worse than absent because they suggest a protection that is not working.
    if (refreshToken === undefined || !lastTab.current) return
    void activate(lastTab.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const next = nextStageState({ currentStage, nextStage }, active)

  return (
    <div data-testid="tb-stage-tabs">
      {/* ── id="tb-detail-tabs" IS LOAD-BEARING, and the visual comparison
          is what found it. `.detail-tabs` is `display:flex` with the default
          nowrap; the WRAP lives in an ID rule that names this strip and the
          Opportunity's, added in Round 7 Phase 6 because ten stage tabs
          overflowed the viewport and cut the action group off entirely.
          Without the id the strip overflowed by 122px at 1240 - the exact
          defect that rule was written for, reintroduced by a swap.

          The id is safe here for the ApprovalView reason: createRoot owns
          #view-test-bed-detail and clears it, so the static #tb-detail-tabs is
          destroyed before this renders. Disposed of in no-duplicate-ids.

          The id rather than copying flex-wrap into a class, because two
          definitions of one layout rule agree today and drift later. */}
      <div className="detail-tabs" role="tablist" id="tb-detail-tabs"
        data-testid="tb-detail-tabs">
        {TB_TABS.map((t) => (
          <button key={t.key} type="button" role="tab"
            aria-selected={t.key === active}
            aria-controls={paneFor(t.key)}
            className={t.key === active ? 'detail-tab active' : 'detail-tab'}
            data-tb-tab={t.key}
            data-testid={`tb-tab-btn-${t.key}`}
            onClick={() => { setUserPicked(true); void activate(t.key) }}>
            {/* T3: the green dot marks the record's REAL stage, which is a
                different thing from the tab that is open. */}
            {isStageTab(t.key) && stageOf(t.key) === currentStage
              ? <span className="sa-dot tb-tab-current-dot"
                  data-testid={`tb-tab-dot-${t.key}`} />
              : null}
            {t.label}
          </button>))}

        {/* ── W3: NEXT STAGE IS ON THE TAB LINE ─────────────────────────
            It rendered on a line of its own below the strip. `.tb-tab-actions`
            is the estate's DECLARED position for a record-level action in a
            tab row - it is what the vanilla Test Bed had, and the Opportunity
            copied it from there with the reason written at its own site. So
            this is the position coming back rather than a new one, and the
            wrapper carries POSITION ONLY: margin-left auto, a flex box, a gap.

            THE BUTTON KEEPS NO CLASS, by John's ruling at the round open. It
            renders as a browser default here as it did below the strip, and
            "the two unstyled buttons" stays on the carried list rather than
            being closed in passing by a round scoped to repositioning.

            X4: T7 decides enablement and is injection-covered; this is the
            ACTION. But the LABEL is derived from the stage list, which arrives
            from a fetch, and with an empty list `nextStage` is null - so the
            first paint said "Final stage" on a record at Qualification.

            Found by LOOKING at the Phase 3 screenshot, not by any assertion:
            the button was present, disabled and correctly styled, and every
            check passed. Verification 45's shape - a state nobody wrote code
            for - and Verification 4's answer to it.

            The vanilla does the same thing for the same reason: its
            refreshTbNextStageButton returns before touching the button while
            tbNextStageState is null. */}
        {deps.stages.length > 0
          ? (
            <div className="tb-tab-actions" data-testid="tb-tab-actions">
              <button type="button" data-testid="tb-next-stage-btn" disabled={next.disabled}
                onClick={() => onNextStage?.()}>
                {next.label}
              </button>
            </div>)
          : null}
      </div>

      {/* The feedback stays BELOW the row and does not move with the button.
          The vanilla's own note says why: it is long free text, and placed
          inline in the row it pushed the buttons off-screen at 1920. */}
      {/* B5: THE ID IS BACK. The shell's attemptTransition writes the blocking
          list into document.getElementById('tb-next-stage-feedback') and returns
          silently when it is null, so without the id every refusal rendered
          nowhere (P0.4). The class is the vanilla's too: it carries the
          element's styling. The shell clears it at the top of the next
          transition attempt; nothing here clears it on a tab change (R8,
          vanilla parity). R12 adds ONE clear, on the host's own reload after a
          save, through reloadToken below: after a save the list can demand the
          very thing just recorded. The element has no React children, so
          React never renders over what the shell writes into it. */}
      <div id="tb-next-stage-feedback" className="tb-next-stage-feedback"
        data-testid="tb-next-stage-feedback" ref={blockedRef} />
      {feedback ? <p className="msg-error" data-testid="tb-tab-feedback">{feedback}</p> : null}

      {active === 'reference' ? <div data-testid="tb-tab-reference">{reference}</div> : null}
      {active === 'commercials' ? <div data-testid="tb-tab-commercials">{commercials}</div> : null}

      {isStageTab(active)
        ? (
          <div data-testid="tb-tab-stage-detail">
            <h3 data-testid="tb-stage-detail-heading">{stageOf(active)}</h3>

            {/* Z: the terminal tab renders the completed record INSTEAD of
                the panels, not beside them. */}
            {terminal
              ? closed
              : (
              <>
            {/* ── R1 and R2: ONE ROW, SCORING, DOCUMENTS, EXIT CRITERIA ────
                The panels were a full-width stack. They are now the estate's
                own column grid at a 430px minimum (style.css), which is the
                measured floor of the widest pair member plus the scoring card's
                414px control row: at 1240 and 1440 that yields scoring across
                the row with documents and exit criteria beside each other, and
                wider displays gain a column without a named breakpoint.
                The standalone approvals panel is gone; its track list is the
                exit criteria panel's closing section, which is where the
                approvals a gate asks for are read. */}
            <div className="tb-stage-panels-row" data-testid="tb-stage-panels-row">
            {/* Keyed on the record, so its disclosure state (open anchors,
                open history) does not follow the person to the next Test Bed. */}
            <ScoringCard card={card} key={recordId}
              measurability={measurabilityAsked(readExitCriteria(criteriaData))}
              onMeasurability={deps.onMeasurability}
              criteria={deps.scoringCriteria(stageOf(active) as string)}
              series={deps.series}
              scores={scores}
              onDraft={(key, value, awaiting) => setScores((s) => applyDraft(s, key, value, awaiting))}
              onReason={(key, value) => setScores((s) => applyReason(s, key, value))}
              onRecord={async () => {
                const shown = deps.scoringCriteria(stageOf(active) as string)
                const out = await deps.onRecordScores(shown, scores)
                // A recorded score stops being a draft; the rest stay for a retry.
                setScores((s) => clearRecorded(s, out.recorded))
                return recordOutcomeMessage(out, shown)
              }} />

            {/* R3: only where the stage HAS documents. The panel used to render
                on every stage, printing "No documents configured for this
                stage." on Qualification, which is the one stage this changes
                (Phase 0, P0.2). While the fetch is in flight nothing is known,
                so nothing is claimed: the panel appears when its answer does. */}
            {hasDocuments(panelData.documents)
              ? (
                <ReadPanel panelId="tb-stage-documents-section"
                  panel={panels['tb-stage-documents-section']}
                  empty="No documents required at this stage.">
                  {documents?.(stageOf(active) as string, panelData.documents)}
                </ReadPanel>)
              : null}

            <ExitCriteria stage={stageOf(active) as string}
              data={criteriaData}
              panel={panels['tb-stage-exit-criteria-list']}
              onTick={deps.onTick}
              approvers={approversOf(payload)}
              approvals={approvals?.(stageOf(active) as string, panelData.approvals)}
              approvalsPanel={panels['tb-stage-approval-row']}
              pending={new Set(Object.keys(scores.drafts).filter((k) => scores.drafts[k] !== ''))} />
            </div>


            {/* P6: a VISIBILITY toggle, not a re-render, so an in-progress
                edit survives switching away and back. */}
            <div data-testid="tb-stage-install-section" hidden={!installVisible}>
              {/* N1: the section is a COMPOSITION - TB_INSTALL_FIELDS is empty
                  in the vanilla, so there are no field rows of its own. */}
              {installSection}
              <LockedCounts payload={payload} units={units} />
              <UnitsPane payload={payload} units={units}
                deps={deps.unitDeps} onDerive={deps.onDeriveUnits}
                onCorrectCount={deps.onCorrectCount} />
            </div>
              </>)}
          </div>)
        : null}
    </div>
  )
}
