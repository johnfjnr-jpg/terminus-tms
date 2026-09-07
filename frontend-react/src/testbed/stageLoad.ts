// ── P: THE STAGE PANEL'S LOAD ───────────────────────────────────────────
//
// Round 7 Phase 2b, from the P enumeration. The three fetches run
// concurrently, each panel renders on its own response, and one token orders
// the whole thing.
export const PANEL_IDS = [
  'tb-stage-documents-section',
  'tb-stage-exit-criteria-list',
  'tb-stage-approval-row',
] as const

export type PanelId = typeof PANEL_IDS[number]

export interface PanelState { pending?: string, stage?: string, error?: string }
export interface Stage { stage_name: string, sort_order: number }
/**
 * Shaped from what the SHELL'S CLIENT returns, not from what a reader wants.
 * `data` is optional there, and a fixture that made it required would agree
 * with itself and disagree with the server (Verification 47).
 */
export interface Fetched<T = unknown> { ok: boolean, status?: number, data?: T }

export interface StageLoaderDeps {
  documents: (stage: string) => Promise<Fetched>
  criteria: (stage: string) => Promise<Fetched>
  approvals: (stage: string) => Promise<Fetched>
  stages: readonly Stage[]
  onPanel: (id: PanelId, state: PanelState) => void
  onScoringCard?: (state: { hidden: boolean, stage?: string }) => void
  onInstallSection?: (visible: boolean) => void
  onDeriveUnits?: () => void
}

export interface StageResult {
  terminal: boolean
  panelsVisible: boolean
  panels: Partial<Record<PanelId, unknown>>
}

const INSTALL_STAGE = 'Installation and Commissioning'
const FAILED = 'Could not load this stage. Reopen the tab to retry.'

export function createStageLoader(deps: StageLoaderDeps) {
  // P1: ONE token, taken at the top of a load and checked after every await.
  // Fast tab switches leave two loads in flight, and without this the OLDER
  // response resolves last and writes the wrong stage into the shared panel.
  let token = 0

  const open = async (stage: string): Promise<StageResult> => {
    const mine = ++token
    const current = () => mine === token

    /**
     * P4: TERMINAL IS DECIDED BY THE DATA, never by matching 'Closed'.
     * A record type whose last stage is named otherwise behaves the same.
     */
    const ordered = [...deps.stages].sort((a, b) => a.sort_order - b.sort_order)
    const terminal = ordered.length > 0
      && ordered[ordered.length - 1].stage_name === stage

    if (terminal) {
      deps.onInstallSection?.(false)
      // P5: the terminal branch returns before the three fetches, so the card
      // would carry no stage at all. Stamping it completes the contract on all
      // eight tabs rather than seven.
      deps.onScoringCard?.({ hidden: true, stage })
      return { terminal: true, panelsVisible: false, panels: {} }
    }

    // P6: a VISIBILITY toggle, not a re-render. The fields stay mounted, so
    // switching away and back cannot lose an in-progress edit.
    const isInstall = stage === INSTALL_STAGE
    deps.onInstallSection?.(isInstall)
    // P7: units are derived only for the stage that owns them. Deriving against
    // a hidden section would create records for a tab nobody opened.
    if (isInstall) deps.onDeriveUnits?.()

    // P3: SYNCHRONOUS, before any await. From this instant no panel is showing
    // the previous stage's content as though it were current.
    for (const id of PANEL_IDS) deps.onPanel(id, { pending: stage })
    // P8: hidden until this stage's own criteria are derived, so one stage can
    // never show another's while a fetch is in flight.
    deps.onScoringCard?.({ hidden: true, stage: undefined })

    const panels: Partial<Record<PanelId, unknown>> = {}
    const settle = async (id: PanelId, run: () => Promise<Fetched>) => {
      const r = await run()
      // Checked before ANY write: by the time a stale call would write, the
      // write itself is already stale.
      if (!current()) return
      if (!r.ok) { deps.onPanel(id, {}); return }
      panels[id] = r.data ?? null
      deps.onPanel(id, { stage })
    }

    // P2: CONCURRENTLY, each rendering on its own response. Sequentially these
    // summed to exactly how long the criteria panel took to stop showing the
    // previous stage's content.
    const running = [
      settle('tb-stage-documents-section', () => deps.documents(stage)),
      settle('tb-stage-exit-criteria-list', () => deps.criteria(stage)),
      settle('tb-stage-approval-row', () => deps.approvals(stage)),
    ]

    try {
      await Promise.all(running)
    } catch {
      // P9: a throw must not leave a panel pending - and only the CURRENT load
      // may clear it, or a stale failure wipes a newer load's state.
      if (!current()) return { terminal: false, panelsVisible: true, panels }
      for (const id of PANEL_IDS) {
        if (panels[id] !== undefined) continue
        deps.onPanel(id, { error: FAILED })
      }
      return { terminal: false, panelsVisible: true, panels }
    }

    if (current()) deps.onScoringCard?.({ hidden: false, stage })
    return { terminal: false, panelsVisible: true, panels }
  }

  return { open }
}
