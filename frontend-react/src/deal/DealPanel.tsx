import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { useDealForm } from './useDealForm'
import { buildDealRows, money } from './rows'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CENSUS, CATALOG_DISPLAYS, MILESTONE_INPUTS, CONTRACTOR_INPUTS, DEAL_SECTIONS } from './census'
import type { CensusInput } from './census'
import type { CatalogRates, Values, UiState } from './payload'
import { buildCashFlowRows, closingCashText } from './cashflow'
import type { CashFlow } from './cashflow'
import { buildYearSchedule } from './schedule'
import {
  milestoneOptions, milestoneUsdFor, syncContractorRow,
  contractorReconciliation, customerScheduleWarning,
} from './milestones'
import {
  installVisibility, structureVisibility, grossUpToggle, factoringToggle,
} from './installation'
import {
  CashFlowGrid, YearScheduleView, MilestoneGrid, ContractorGrid,
  InstallationTab, SwitchButton, StructureVisibilityRegions, StatsStrip,
} from './panelParts'
import { dirtySections, captureSavedBaseline, SECTION_SAVE_TITLE } from './dirty'
import { makeSeam } from './seam'
import type { DealFormSeam } from './seam'

// ── THE PANEL, BEHIND THE LINE ───────────────────────────────────────────
//
// Session A. NOTHING REGISTERS THIS IN PRODUCTION: the bundle does not expose
// `initOpportunityDealPanel`, no script tag moved, and `frontend/opportunity-deal.js`
// is untouched and still live. The panel exists in the tree with tests only, so
// the calculator core can be built and proved against a screen nobody is using
// yet.
//
// WHAT IT IS FOR: the census controls hold form state, the state feeds the
// PROVED reader, and the reader feeds the same three src/lib functions the
// vanilla calls. The rows model carries the unfold ruling. Everything the panel
// still lacks - the grids, the schedules, dirty tracking, saving - is Session B.

export function useCatalogRates() {
  const shell = useShell()
  return useQuery({
    queryKey: ['base-costs'],
    queryFn: async () => {
      const r = await shell.api<{ products?: unknown[] }>('GET', '/api/base-costs')
      if (!r.ok) throw new Error('The base cost catalog could not be loaded.')
      return r.data
    },
    staleTime: Infinity, retry: false,
  })
}

// Each contract gets its own input treatment, and the differences are the
// point rather than styling: what a person sees when a box is empty must match
// what the reader will do with it.
function CensusField({ field, value, rates, onChange }: {
  field: CensusInput
  value: string
  rates: CatalogRates
  onChange(next: string): void
}) {
  const placeholder = field.placeholderFromCatalog
    // THE CATALOG FIGURE AS A PLACEHOLDER, NEVER AS A VALUE. An empty box here
    // means "no override, use the catalog", so showing the catalog number as
    // the value would record a per-deal override of the catalog on every deal.
    ? `catalog: ${money(rates[field.placeholderFromCatalog])}`
    : field.contract === 'num' ? '0'
    : field.contract === 'numOrUndefined' ? 'no override'
    : 'not recorded'

  return (
    <label className="deal-field" data-contract={field.contract} data-section={field.section}>
      <span className="deal-field-label">{field.label}</span>
      <input
        id={field.id}
        data-testid={field.id}
        value={value}
        placeholder={placeholder}
        inputMode={field.contract === 'emptyToNull' ? undefined : 'decimal'}
        // NO COERCION HERE. The box writes exactly the string typed, `''`
        // included, and the reader's contract decides what `''` means for this
        // key. A trim or a Number() at this edge would flatten all four
        // contracts into one.
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function DealPanel({
  initialValues, testBedCost = 0, initialUi, onSave,
  onPersist, onSeamReady, currentVersionRejection, refreshVersionActions,
}: {
  initialValues: Values
  testBedCost?: number
  initialUi?: UiState
  /** B6: a section save saves the WHOLE sheet, so there is one handler. */
  onSave?: (payload: Record<string, unknown>) => void
  /**
   * The write the seam performs when a version is taken from a dirty form.
   * Rejects with the refusal, which `freezeCurrentState` then throws.
   */
  onPersist?: (payload: Record<string, unknown>) => Promise<void>
  /** Handed the seam once it exists, so the version machinery can hold it. */
  onSeamReady?: (seam: DealFormSeam) => void
  currentVersionRejection?: () => unknown
  refreshVersionActions?: () => void
}) {
  const cashFlowRef = useRef<HTMLDivElement | null>(null)

  // ── markCashFlowScrollable, PORTED ──────────────────────────────────
  //
  // The class says whether the grid actually overflows, and the ResizeObserver
  // is what makes the answer keep up: the element gets its width when it is
  // REVEALED, when the window resizes, and when the detail panel opens beside
  // it. Measuring once at render would be right only on the first of those.
  useEffect(() => {
    const el = cashFlowRef.current
    if (!el) return
    const mark = () => el.classList.toggle('is-scrollable', el.scrollWidth > el.clientWidth + 1)
    mark()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(mark)
    ro.observe(el)
    return () => ro.disconnect()
  })
  const catalog = useCatalogRates()
  const rates = ((catalog.data as { rates?: CatalogRates } | undefined)?.rates ?? {}) as CatalogRates
  const form = useDealForm(initialValues, rates, testBedCost, initialUi)
  const { values, ui, setValue, setUi, setValues, payload, result, computeError } = form

  // B7: the baseline is captured at mount and re-captured on save. It is the
  // ONLY thing that clears dirty.
  const [baseline, setBaseline] = useState<Record<string, unknown> | null>(null)
  useEffect(() => { if (!baseline && result) setBaseline(captureSavedBaseline(payload)) },
    [baseline, result, payload])

  // ── EVERY HOOK ABOVE THE EARLY RETURNS ──────────────────────────────
  //
  // The seam's useRef/useEffect were first placed below them, where the
  // catalog's pending branch skipped them and React reported a change in hook
  // order across renders. Hooks run unconditionally or not at all.
  // ── THE SEAM, BUILT FROM LIVE READERS ─────────────────────────────────
  //
  // Every source is a function rather than a captured value, so the version
  // machinery holding this object cannot hold a stale form. `getBaseline` is
  // what makes hasUnsavedChanges answer about NOW rather than about the moment
  // the seam was made.
  const latest = useRef({ values, ui, rates, baseline, payload })
  latest.current = { values, ui, rates, baseline, payload }

  const seamRef = useRef<DealFormSeam | null>(null)
  if (!seamRef.current) {
    seamRef.current = makeSeam({
      getValues: () => latest.current.values,
      getUi: () => latest.current.ui,
      getRates: () => latest.current.rates,
      getBaseline: () => latest.current.baseline,
      save: async (p) => {
        if (!onPersist) return
        await onPersist(p)
        // B7: the save re-baselines, which is the only thing that clears dirty.
        setBaseline(captureSavedBaseline(latest.current.payload))
      },
      populate: (p) => {
        // RESTORE WRITES THE FORM AND RE-BASELINES IT. `updateDirtyState` has
        // no successor: dirty is computed against the baseline, so moving the
        // baseline with the values IS the whole of what the vanilla pushed.
        const next: Values = { ...latest.current.values }
        for (const f of CENSUS) {
          const key = f.id.replace(/^deal-/, '')
          const v = (p as Record<string, unknown>)[key]
          if (v !== undefined) next[f.id] = v === null ? '' : String(v)
        }
        setValues(next)
      },
      recompute: () => latest.current.payload,
      currentVersionRejection: () => currentVersionRejection?.() ?? null,
      refreshVersionActions: () => refreshVersionActions?.(),
    })
  }
  useEffect(() => { if (seamRef.current) onSeamReady?.(seamRef.current) }, [onSeamReady])


  if (catalog.isPending) return <p className="pg-item-note">Loading the cost catalog…</p>
  if (catalog.isError) {
    return <p className="msg-error" data-testid="catalog-error">
      {catalog.error instanceof Error ? catalog.error.message : 'The catalog could not be loaded.'}
    </p>
  }

  // ── B5 AND B6: SECTION SAVES ────────────────────────────────────────
  //
  // Created and destroyed BY NEED - a section save exists exactly when that
  // section holds a dirty key - and it saves the WHOLE deal sheet. It is a
  // scroll affordance so somebody editing one section does not have to travel
  // to the bottom, not a partial write, and its title says so.
  const dirty = dirtySections(payload, baseline)
  const sectionSave = (section: string) => (dirty.has(section)
    ? (
      <button type="button" className="btn-sm btn-primary section-save"
        data-testid={`section-save-${section}`} title={SECTION_SAVE_TITLE}
        onClick={() => onSave?.(payload)}>Save changes</button>
    )
    : null)

  // THE CONTRACTOR ROUND TRIP. Whichever side the person typed on decides which
  // one follows, and the sync runs against the value just entered rather than
  // the one in state, which has not been committed yet.
  const onContractorTyped = (i: number, side: 'pct' | 'usd', id: string, v: string) => {
    setValue(id, v)
    if (!id.endsWith('-pct') && !id.endsWith('-usd')) return
    const typed: 'pct' | 'usd' = id.endsWith('-pct') ? 'pct' : 'usd'
    const next = syncContractorRow({ ...values, [id]: v }, i, typed, lumpCost)
    if (next) setValue(next.id, next.value)
  }

  const rows = result ? buildDealRows(result as never, payload, ui.grossUp) : []
  const cashFlow = (result as { cashFlow?: CashFlow } | null)?.cashFlow ?? null
  const oneOffPrice = (result as { totals?: { oneOffPrice: number } } | null)?.totals?.oneOffPrice ?? 0
  const lumpCost = Number(payload.lumpSumCost ?? 0)

  return (
    <div data-testid="deal-panel">
      <StatsStrip result={result as never} payload={payload} />
      {DEAL_SECTIONS.map((section) => (
        <div className="deal-section" id={`deal-section-${section}`} key={section}>
          <div className="latch-row" data-testid={`latch-${section}`}>
            <span className="deal-section-title">{section}</span>
            {sectionSave(section)}
          </div>
          {CENSUS.filter((f) => f.section === section).map((f) => (
            <CensusField key={f.id} field={f} rates={rates}
              value={values[f.id] ?? ''} onChange={(v) => setValue(f.id, v)} />
          ))}
        </div>
      ))}

      {/* The seven catalog readouts. A readonly input here is a DISPLAY of a
          rate, not a record of one, and the vanilla says so in those words. */}
      <div className="deal-section" id="deal-section-catalog">
        {CATALOG_DISPLAYS.map((d) => (
          <label className="deal-field" key={d.id}>
            <span className="deal-field-label">{d.label}</span>
            <input id={d.id} data-testid={d.id} readOnly value={money(rates[d.rate])} />
          </label>
        ))}
      </div>

      {/* ── THE TWO MILESTONE GRIDS ─────────────────────────────────────── */}
      <div className="deal-section" id="deal-section-milestones">
        <div className="latch-row" data-testid="latch-milestones">
          <span className="deal-section-title">Payment milestones</span>
          {sectionSave('milestones')}
        </div>
        <MilestoneGrid rows={MILESTONE_INPUTS} values={values}
          usdFor={(i) => milestoneUsdFor(values[`deal-ms-${i}-pct`], oneOffPrice)}
          onChange={setValue}
          warning={customerScheduleWarning(
            (payload.milestones ?? []) as { month?: number; usd?: number }[], oneOffPrice)} />
      </div>

      <div className="deal-section" id="deal-section-contractor">
        <div className="latch-row" data-testid="latch-contractor">
          <span className="deal-section-title">Contractor milestones</span>
          {sectionSave('contractor')}
        </div>
        <ContractorGrid rows={CONTRACTOR_INPUTS} values={values}
          options={(i) => milestoneOptions(values[`deal-cm-${i}-label`])}
          onTyped={onContractorTyped}
          view={contractorReconciliation(values, lumpCost)} />
      </div>

      {/* ── THE INSTALLATION TAB ─────────────────────────────────────────── */}
      <InstallationTab vis={installVisibility(ui)} />
      <StructureVisibilityRegions vis={structureVisibility(ui)} />

      {/* The two switches, which are the same control and must look it. */}
      <div className="deal-section" id="deal-section-toggles">
        <SwitchButton id="deal-grossUp-toggle" state={grossUpToggle(ui)}
          onToggle={() => setUi({ grossUp: !ui.grossUp })} />
        <SwitchButton id="deal-factoring-toggle" state={factoringToggle(ui)}
          onToggle={() => setUi({ factoringEnabled: !ui.factoringEnabled })} />
      </div>

      <div className="deal-section" id="deal-section-ui">
        <select data-testid="ui-structure" value={ui.structure}
          onChange={(e) => setUi({ structure: e.target.value })}>
          <option value="twoPhase">Two phase</option>
          <option value="single">Single</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select data-testid="ui-invoicing" value={ui.invoicing}
          onChange={(e) => setUi({ invoicing: e.target.value })}>
          <option value="annual">Annual</option><option value="monthly">Monthly</option>
        </select>
        <select data-testid="ui-installResp" value={ui.installResp}
          onChange={(e) => setUi({ installResp: e.target.value })}>
          <option>Client Own Installation Team</option>
          <option>Terminus Contractor - Per Unit</option>
          <option>Terminus Contractor - Lump Sum</option>
        </select>
      </div>

      {/* ── THE CASH-FLOW GRID AND THE YEAR SCHEDULE ─────────────────────── */}
      {cashFlow ? (
        <div className="deal-section" id="deal-section-cashflow">
          <CashFlowGrid months={cashFlow.rows.map((r) => r.m)}
            rows={buildCashFlowRows(cashFlow)} closing={closingCashText(cashFlow)}
            scrollRef={cashFlowRef} />
          <YearScheduleView schedule={buildYearSchedule(cashFlow, payload, ui.structure, ui.invoicing)} />
        </div>
      ) : null}

      {/* ── THE RESULTS, UNDER THE UNFOLD RULING ────────────────────────── */}
      {computeError
        ? <p className="msg-error" data-testid="compute-error">{computeError}</p>
        : (
          <div className="deal-matrix" data-testid="deal-results">
            <div className="dm-row head">
              <div className="dm-label" />
              <div className="dm-cell">Hardware (USD)</div>
              <div className="dm-cell">Hosting (USD)</div>
              <div className="dm-cell">Installation (USD)</div>
              <div className="dm-cell">Total (USD)</div>
            </div>
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} data-testid={`dm-row-${i}`}
                className={['dm-row',
                  r.fullWidth ? 'dm-row--full' : '',
                  r.memo ? 'dm-row--memo' : '',
                  r.emphasis === 'sum' ? 'dm-row--sum' : '',
                  r.emphasis && r.emphasis !== 'sum' ? 'dm-row--lead' : ''].filter(Boolean).join(' ')}>
                <div className="dm-label">{r.label}</div>
                {r.fullWidth
                  ? <div className="dm-cell dm-cell--span">{r.total}</div>
                  : (<>
                    <div className="dm-cell">{r.hardware}</div>
                    <div className="dm-cell">{r.hosting}</div>
                    <div className="dm-cell">{r.installation}</div>
                    <div className="dm-cell dm-cell--total">{r.total}</div>
                  </>)}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
