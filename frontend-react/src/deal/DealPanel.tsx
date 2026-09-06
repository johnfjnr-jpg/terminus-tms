import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { useDealForm } from './useDealForm'
import { buildDealRows, money } from './rows'
import { catalogToRates } from '../../../src/lib/base-costs.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CENSUS, CATALOG_DISPLAYS, MILESTONE_INPUTS, CONTRACTOR_INPUTS, DEAL_SECTIONS } from './census'
import type { CensusInput } from './census'
import type { CatalogRates, Values, UiState } from './payload'
import { MARGIN_KEYS } from './payload'
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
import { VANILLA_SECTIONS, censusBySection, dirtyVanillaSections } from './sections'
import { PaymentTermsSection } from './section5'
import { PANELS, latchView, latchAllView, toggleAll, toggleOne } from './latch'
import { DealSummarySection, SummaryNotices } from './section4'
import { buildBasis } from './basis'
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
      const r = await shell.api<{ products?: object[], as_of?: string }>('GET', '/api/base-costs')
      if (!r.ok) throw new Error('The base cost catalog could not be loaded.')
      // THROUGH THE SAME READER THE VANILLA USES. The route returns
      // `{ as_of, products }` and the rates are DERIVED from the products by
      // catalogToRates; it does not return a `rates` key at all. Reading
      // `data.rates` gave {} against the real server, which prices every line
      // at $0 and says nothing about why. Verification 20.
      const { rates, missing, batches } = catalogToRates(r.data?.products ?? [])
      return { rates, missing, batches, asOf: r.data?.as_of ?? null }
    },
    staleTime: Infinity, retry: false,
  })
}

// Each contract gets its own input treatment, and the differences are the
// point rather than styling: what a person sees when a box is empty must match
// what the reader will do with it.
function CensusField({ field, value, rates, onChange, help }: {
  field: CensusInput
  value: string
  /** The vanilla's own help text, rendered as the dot INSIDE the label. */
  help?: string
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
    // htmlFor, not merely a wrapping label. The vanilla writes
    // `<label for="deal-factoring-ratePct">`, and those ids are in the adoption
    // list BECAUSE they are label[for] targets: with implicit labelling only,
    // the id stops being load-bearing and the next rename breaks nothing
    // visibly while breaking click-to-focus.
    <label className="deal-field" htmlFor={field.id}
      data-contract={field.contract} data-section={field.section}>
      <span className="deal-field-label">{field.label}
        {help ? <span className="help-dot" tabIndex={0} role="note" title={help} /> : null}
      </span>
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
  // SESSION ONLY, and that is the whole design: nothing about a latch reaches
  // the payload, so a reload brings everything back and there is no remembered
  // set for "show all" to return to.
  const [latched, setLatched] = useState<ReadonlySet<string>>(() => new Set<string>())

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
  const catalogData = catalog.data as {
    rates?: CatalogRates, missing?: string[],
    batches?: Record<string, { batch_label?: string, effective_from?: string }>, asOf?: string | null
  } | undefined
  const rates = (catalogData?.rates ?? {}) as CatalogRates
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
  const dirty = dirtyVanillaSections(payload, baseline)
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

  // ── THE LATCH VIEWS, through src/lib/latches.js ────────────────────────
  // ONE derivation, shared by the latch signal and by section 4. Two readers of
  // the same value drift; the catalog problem the latch warns about must be the
  // same one the panel shows.
  const basisView = buildBasis(catalogData?.batches ?? {}, catalogData?.missing ?? [],
    catalogData?.asOf ?? null, catalog.isError ? 'Base Cost Data could not be loaded.' : null,
    payload.bidCurrency)
  const latchInputs = {
    marginOverrides: Object.fromEntries(MARGIN_KEYS.map((k: string) => [k, values[`deal-margin-${k}`]])),
    rateValues: Object.fromEntries((['inSsExisting', 'inSsNew', 'inAqm', 'inHemir'])
      .map((k) => [k, values[`deal-${k}`]])),
    catalogProblem: !!basisView.warning,
  }
  const allView = latchAllView(latched, payload, latchInputs)
  const bySection = censusBySection()

  // A section's frame: the latch row, its title, the save that appears when the
  // section is dirty, and the latch button LAST, which is what keeps it at the
  // right-hand end of the row.
  const sectionFrame = (sec: { id: string, title: string, intake?: boolean, latchable: boolean },
    body: React.ReactNode) => {
    const v = sec.latchable
      ? latchView(PANELS.find((p) => p.id === sec.id)!, latched, payload, latchInputs)
      : null
    return (
      <section className={`deal-section${sec.intake ? ' deal-section--intake' : ''}${v?.latched ? ' is-latched' : ''}`}
        id={sec.id} key={sec.id} data-testid={sec.id}>
        <div className={`latch-row${sec.intake ? ' latch-row--intake' : ''}`}>
          <p className="section-title">{sec.title}</p>
          {sectionSave(sec.id)}
          {v ? (
            <button type="button" id={`latch-${sec.id}`} data-testid={`latch-${sec.id}`}
              className={`latch${v.signalled ? ' is-signalled' : ''}`}
              data-latch={sec.id} aria-controls={sec.id} aria-expanded={v.ariaExpanded}
              title={v.title} onClick={() => setLatched(toggleOne(latched, sec.id))}>{v.buttonText}</button>
          ) : null}
        </div>
        {body}
      </section>
    )
  }
  // THE VANILLA'S OWN HELP TEXT, not a paraphrase. It sits inside the label as
  // a dot, which is why it belongs to the field rather than to the section.
  const HELP: Record<string, string> = {
    'deal-recoveryMonths': 'The number of months over which the upfront capital is recovered from contract revenue.',
    'deal-factoring-ratePct': 'The monthly cost of factoring the hardware and installation spend. It both reduces margin and brings cash in earlier.',
    'deal-factoring-termMonths': 'How long the factoring runs. Rate multiplied by term is the total financing cost.',
  }
  const renderField = (id: string) => {
    const f = CENSUS.find((c) => c.id === id)
    if (!f) return null
    return <CensusField key={f.id} field={f} rates={rates} help={HELP[f.id]}
      value={values[f.id] ?? ''} onChange={(v) => setValue(f.id, v)} />
  }
  const censusFields = (sectionId: string) => (bySection[sectionId] ?? []).map((f) => (
    <CensusField key={f.id} field={f} rates={rates}
      value={values[f.id] ?? ''} onChange={(v) => setValue(f.id, v)} />
  ))
  const SECTION = Object.fromEntries(VANILLA_SECTIONS.map((s) => [s.id, s]))

  return (
    <div data-testid="deal-panel">
      <StatsStrip result={result as never} payload={payload} />

      {/* HIDING IS FOR THIS SESSION ONLY, and the note says so because a
          control that hides work has to say whether the hiding is saved. */}
      <div className="latch-all-row">
        <button type="button" id="latch-all" data-testid="latch-all"
          className={`latch latch-all${allView.signalled ? ' is-signalled' : ''}`}
          onClick={() => setLatched(toggleAll(latched))}>{allView.text}</button>
        <span className="field-note" id="latch-all-note">Hiding is for this session only. Nothing is saved and a reload brings everything back.</span>
      </div>

      {sectionFrame(SECTION['deal-sections-1-2'], (
        <>
          <div className="deal-intake-col">{censusFields('deal-sections-1-2')}</div>
          {/* The seven catalog readouts. A readonly input here is a DISPLAY of
              a rate, not a record of one, and the vanilla says so in those
              words. They sit in the intake section, where the vanilla keeps
              them. */}
          {CATALOG_DISPLAYS.map((d) => (
            <label className="deal-field" key={d.id}>
              <span className="deal-field-label">{d.label}</span>
              <input id={d.id} data-testid={d.id} readOnly value={money(rates[d.rate])} />
            </label>
          ))}
          <InstallationTab vis={installVisibility(ui)} />
          <ContractorGrid rows={CONTRACTOR_INPUTS} values={values}
            options={(i) => milestoneOptions(values[`deal-cm-${i}-label`])}
            onTyped={onContractorTyped}
            view={contractorReconciliation(values, lumpCost)} />
        </>
      ))}

      {sectionFrame(SECTION['deal-section-3'], (
        <>
          {censusFields('deal-section-3')}
          <StructureVisibilityRegions vis={structureVisibility(ui)} />
          <SwitchButton id="deal-grossUp-toggle" state={grossUpToggle(ui)}
            onToggle={() => setUi({ grossUp: !ui.grossUp })} />
          <select data-testid="ui-structure" value={ui.structure}
            onChange={(e) => setUi({ structure: e.target.value })}>
            <option value="twoPhase">Two phase</option>
            <option value="single">Single</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select data-testid="ui-installResp" value={ui.installResp}
            onChange={(e) => setUi({ installResp: e.target.value })}>
            <option>Client Own Installation Team</option>
            <option>Terminus Contractor - Per Unit</option>
            <option>Terminus Contractor - Lump Sum</option>
          </select>
        </>
      ))}

      {/* ── SECTION 4: DEAL SHEET SUMMARY ───────────────────────────────── */}
      {/* The matrix is the summary column's content, inside #deal-panel, which
          is the container the stylesheet targets. `deal-matrix` was a React
          invention with no rule anywhere in style.css. */}
      <DealSummarySection
        result={result as never}
        payload={payload}
        values={values}
        onMargin={setValue}
        install={installVisibility(ui)}
        basis={basisView}
        notices={<SummaryNotices n={{
          minCash: cashFlow ? (cashFlow.minCash ?? null) : null,
          minCashMonth: cashFlow ? (cashFlow.minCashMonth ?? 1) : 1,
          milestoneWarning: customerScheduleWarning(
            (payload.milestones ?? []) as { month?: number; usd?: number }[], oneOffPrice),
        }} />}
        matrix={
          computeError
            ? <p className="msg-error" data-testid="compute-error">{computeError}</p>
            : (
              <div data-testid="deal-results">
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
            )
        } />

      {sectionFrame(SECTION['deal-section-5'], (
        <>
          {censusFields('deal-section-5')}
          <PaymentTermsSection
            ui={ui} setUi={setUi} vis={structureVisibility(ui)}
            duration={payload.duration}
            renderField={renderField}
            milestoneGrid={
              <MilestoneGrid rows={MILESTONE_INPUTS} values={values}
                usdFor={(i) => milestoneUsdFor(values[`deal-ms-${i}-pct`], oneOffPrice)}
                onChange={setValue}
                warning={customerScheduleWarning(
                  (payload.milestones ?? []) as { month?: number; usd?: number }[], oneOffPrice)} />
            }
            yearSchedule={cashFlow
              ? <YearScheduleView schedule={buildYearSchedule(cashFlow, payload, ui.structure, ui.invoicing)} />
              : null}
            hybridSchedule={null} />
        </>
      ))}

      {sectionFrame(SECTION['deal-section-6'], (
        cashFlow ? (
          <CashFlowGrid months={cashFlow.rows.map((r) => r.m)}
            rows={buildCashFlowRows(cashFlow)} closing={closingCashText(cashFlow)}
            scrollRef={cashFlowRef} />
        ) : null
      ))}
    </div>
  )
}
