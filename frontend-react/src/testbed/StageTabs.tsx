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
import { ExitCriteria, ScoringCard, ReadPanel, type Criterion_ } from './StagePanel'
import { UnitsPane, LockedCounts } from './UnitsPane'
import type { Criterion } from './scoring'
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
  onTick: (payload: Record<string, string | null>) => void
  onRecordScores: (drafts: Record<string, string>, reasons: Record<string, string>) => void
  onDeriveUnits: () => Promise<void>
  unitDeps: Omit<QueueDeps, 'onRowState'>
}

const emptyPanels = () => Object.fromEntries(
  PANEL_IDS.map((id) => [id, {} as PanelState])) as Record<PanelId, PanelState>

export function StageTabs({ payload, units, landing, fresh, currentStage, nextStage, deps, reference, commercials, installSection, documents, approvals, closed, onNextStage, refreshToken }: {
  payload: Record<string, unknown>
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
  const [criteriaRows, setCriteriaRows] = useState<Criterion_[]>([])
  const [terminal, setTerminal] = useState(false)
  const [panelData, setPanelData] = useState<{ documents: unknown, approvals: unknown }>(
    { documents: null, approvals: null })
  const lastTab = useRef<string | null>(null)

  const loader = useRef(createStageLoader({
    documents: deps.documents,
    criteria: deps.criteria,
    approvals: deps.approvals,
    stages: deps.stages,
    onPanel: (id, s) => setPanels((p) => ({ ...p, [id]: s })),
    onScoringCard: setCard,
    onInstallSection: setInstallVisible,
    onDeriveUnits: () => { void deps.onDeriveUnits() },
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
    if (r.panels['tb-stage-exit-criteria-list']) {
      setCriteriaRows(r.panels['tb-stage-exit-criteria-list'] as Criterion_[])
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
      <div className="detail-tabs" role="tablist" data-testid="tb-detail-tabs">
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
      </div>

      {/* X4: T7 decides enablement and is injection-covered. This is the
          ACTION, which had no wiring at all before Phase 2d. */}
      <button type="button" data-testid="tb-next-stage-btn" disabled={next.disabled}
        onClick={() => onNextStage?.()}>
        {next.label}
      </button>
      <div data-testid="tb-next-stage-feedback" />
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
            <ReadPanel panelId="tb-stage-documents-section"
              panel={panels['tb-stage-documents-section']}
              empty="No documents required at this stage.">
              {documents?.(stageOf(active) as string, panelData.documents)}
            </ReadPanel>

            <ExitCriteria stage={stageOf(active) as string}
              criteria={criteriaRows}
              panel={panels['tb-stage-exit-criteria-list']}
              onTick={deps.onTick} />

            <ReadPanel panelId="tb-stage-approval-row"
              panel={panels['tb-stage-approval-row']}
              empty="No approvals at this stage.">
              {approvals?.(stageOf(active) as string, panelData.approvals)}
            </ReadPanel>

            <ScoringCard card={card}
              criteria={deps.scoringCriteria(stageOf(active) as string)}
              series={deps.series}
              onRecord={deps.onRecordScores} />

            {/* P6: a VISIBILITY toggle, not a re-render, so an in-progress
                edit survives switching away and back. */}
            <div data-testid="tb-stage-install-section" hidden={!installVisible}>
              {/* N1: the section is a COMPOSITION - TB_INSTALL_FIELDS is empty
                  in the vanilla, so there are no field rows of its own. */}
              {installSection}
              <LockedCounts payload={payload} units={units} />
              <UnitsPane payload={payload} units={units}
                deps={deps.unitDeps} onDerive={deps.onDeriveUnits} />
            </div>
              </>)}
          </div>)
        : null}
    </div>
  )
}
