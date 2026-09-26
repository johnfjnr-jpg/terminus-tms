import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { useDealForm } from './useDealForm'
import { buildDealRows, money } from './rows'
import { buildDealStatement } from './statement'
import { catalogToRates } from '../../../src/lib/base-costs.js'
import { resolveRates } from '../../../src/lib/rate-resolution.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CENSUS, CATALOG_DISPLAYS, MILESTONE_INPUTS, CONTRACTOR_INPUTS, DEAL_SECTIONS } from './census'
import type { CensusInput } from './census'
import type { CatalogRates, Values, UiState } from './payload'
import { MARGIN_KEYS, valuesFromPayload, uiFromPayload, pickSalespersonWritable, effectiveStructure } from './payload'
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
  SwitchButton, StatsStrip,
} from './panelParts'
import { dirtySections, captureSavedBaseline, SECTION_SAVE_TITLE } from './dirty'
import { makeSeam } from './seam'
import { CURRENCY_OPTIONS } from './currencies'
import { VANILLA_SECTIONS, censusBySection, dirtyVanillaSections } from './sections'
import { PaymentTermsSection } from './section5'
import { OpexTable } from './OpexTable'
import { opexRows } from '../../../src/lib/opex.js'
import { UnitCards, InstallationSection } from './intake'
import { StructuralTermsSection, CashFlowSection } from './section36'
import { PANELS, latchView, latchAllView, toggleAll, toggleOne } from './latch'
import { DealSummarySection, SummaryNotices } from './section4'
import { buildBasis } from './basis'
import type { DealFormSeam } from './seam'

// ── THE PANEL, LIVE AS OF SESSION F ──────────────────────────────────────
//
// SUPERSEDED, and the old note is kept because it says what the method was.
// Sessions A to E built this BEHIND THE LINE: the bundle registered nothing,
// no script tag had moved, and `frontend/opportunity-deal.js` was untouched
// and live, so the calculator could be proved against a screen nobody used.
//
// Session F swapped it. `main.tsx` registers `initOpportunityDealPanel`,
// `app.js` calls it during the record load exactly as it called the vanilla's,
// and the vanilla markup is hidden rather than deleted so restoring one script
// tag is the whole of the revert.
//
// WHAT IT IS: the census controls hold form state, the state feeds the PROVED
// reader, and the reader feeds the same src/lib functions the vanilla calls.
// The rows model carries the unfold ruling. The identity - every id and class
// anything outside the form depends on - is in `adopted-identity.ts` and is
// asserted against this render.

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
function CensusField({ field, value, rates, onChange, help, bare, options }: {
  /** A fixed list makes the control a select, as the vanilla's currencies are. */
  options?: readonly { value: string, label: string }[]
  field: CensusInput
  value: string
  /** The vanilla's own help text, rendered as the dot INSIDE the label. */
  help?: string
  /**
   * A table cell whose COLUMN HEADER is the label, as the per-unit install
   * rows are. The visible text is dropped and the accessible name moves to
   * aria-label, so the input keeps a name without repeating the header in
   * every row.
   */
  bare?: boolean
  rates: CatalogRates
  onChange(next: string): void
}) {
  const placeholder = field.placeholder
    // W4: a field narrow enough that the contract's own wording would be
    // clipped says its absence in the room it has.
    ?? (field.placeholderFromCatalog
    // THE CATALOG FIGURE AS A PLACEHOLDER, NEVER AS A VALUE. An empty box here
    // means "no override, use the catalog", so showing the catalog number as
    // the value would record a per-deal override of the catalog on every deal.
    ? `catalog: ${money(rates[field.placeholderFromCatalog])}`
    : field.contract === 'num' ? '0'
    : field.contract === 'numOrUndefined' ? 'no override'
    : 'not recorded')

  return (
    // htmlFor, not merely a wrapping label. The vanilla writes
    // `<label for="deal-factoring-ratePct">`, and those ids are in the adoption
    // list BECAUSE they are label[for] targets: with implicit labelling only,
    // the id stops being load-bearing and the next rename breaks nothing
    // visibly while breaking click-to-focus.
    <label className="deal-field" htmlFor={field.id}
      data-contract={field.contract} data-section={field.section}>
      {bare ? null : (
        <span className="deal-field-label">{field.label}{help ? ' ' : ''}
          {help ? (
            <span className="help-dot" tabIndex={0} role="note"
              aria-label={help} title={help}>?</span>
          ) : null}
        </span>
      )}
      {options ? (
        <select id={field.id} data-testid={field.id} value={value}
          aria-label={bare ? field.label : undefined}
          onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
      <input
        id={field.id}
        data-testid={field.id}
        aria-label={bare ? field.label : undefined}
        value={value}
        placeholder={placeholder}
        inputMode={field.contract === 'emptyToNull' ? undefined : 'decimal'}
        // NO COERCION HERE. The box writes exactly the string typed, `''`
        // included, and the reader's contract decides what `''` means for this
        // key. A trim or a Number() at this edge would flatten all four
        // contracts into one.
        onChange={(e) => onChange(e.target.value)}
      />
      )}
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
  // ── #btn-save-deal LIVES OUTSIDE THE REACT ROOT ────────────────────────
  //
  // It is in .form-actions, which the swap deliberately left as static markup
  // so the revert stays one line. React therefore reaches it the way the
  // vanilla did - by id - and the effect owns both halves the vanilla owned:
  // the disabled state, which is the only thing telling a person there is
  // anything to save, and the click.
  useEffect(() => {
    const btn = document.getElementById('btn-save-deal') as HTMLButtonElement | null
    if (!btn) return
    const onClick = () => { void saveRef.current() }
    btn.addEventListener('click', onClick)
    return () => btn.removeEventListener('click', onClick)
  }, [])

  const catalog = useCatalogRates()
  const catalogData = catalog.data as {
    rates?: CatalogRates, missing?: string[],
    batches?: Record<string, { batch_label?: string, effective_from?: string }>, asOf?: string | null
  } | undefined
  const rates = (catalogData?.rates ?? {}) as CatalogRates
  const form = useDealForm(initialValues, rates, testBedCost, initialUi)
  const { values, ui, setValue, setUi, setValues, payload, result, computeError, resolvedRates } = form

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

  // ONE SAVE PATH FOR ALL THREE ROUTES. The section buttons called an `onSave`
  // prop the mount never passed, so every one of them was inert; and
  // #btn-save-deal, which lives in .form-actions OUTSIDE the React root, was
  // wired by the vanilla and by nothing here. Both now go through the same save
  // the seam uses, so every route re-baselines identically.
  const saveNow = async () => {
    if (!onPersist) { onSave?.(latest.current.payload); return }
    await onPersist(pickSalespersonWritable(latest.current.payload))
    setBaseline(captureSavedBaseline(latest.current.payload))
    onSave?.(latest.current.payload)
  }
  const saveRef = useRef(saveNow)
  saveRef.current = saveNow

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
          //
          // THROUGH THE SHARED READER. This was an inline loop over CENSUS ids
          // keyed by `id.replace(/^deal-/, '')`, which restored neither the
          // milestone rows, the contractor rows, the margin overrides nor the
          // UI state - and mis-keyed `deal-lumpCost`, whose payload key is
          // `lumpSumCost`. A restore that quietly leaves the schedule behind
          // is the version machinery's whole point undone.
          setValues(valuesFromPayload(p as Record<string, unknown>))
          setUi(uiFromPayload(p as Record<string, unknown>))
      },
      recompute: () => latest.current.payload,
      currentVersionRejection: () => currentVersionRejection?.() ?? null,
      refreshVersionActions: () => refreshVersionActions?.(),
    })
  }
  useEffect(() => { if (seamRef.current) onSeamReady?.(seamRef.current) }, [onSeamReady])

  // ── ABOVE THE EARLY RETURN, WITH EVERY OTHER HOOK ──────────────────────
  //
  // Placed below it first, and the catalog's pending render then ran one hook
  // fewer than the settled one: React error #310, and the panel did not mount
  // at all. The suite did not catch it, because no test renders the pending
  // state - which is the same fault this file's own comment records from
  // Session A, arriving a second time.
  //
  // THE DISABLED STATE IS THE ONLY THING SAYING THERE IS ANYTHING TO SAVE, and
  // the vanilla drove it on every recompute. Written in an EFFECT rather than
  // during render: a render-phase DOM write runs twice under StrictMode.
  const isDirty = dirtyVanillaSections(payload, baseline).size > 0
  useEffect(() => {
    const btn = document.getElementById('btn-save-deal') as HTMLButtonElement | null
    if (btn) btn.disabled = !isDirty
  }, [isDirty])


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
        onClick={() => { void saveRef.current() }}>Save changes</button>
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

  // ── THE CUSTOMER USD MUST REACH THE STATE, NOT ONLY THE SCREEN ─────────
  //
  // Found by the Phase 3 walk's restore-fidelity check. `readMilestones` keeps
  // a row only when `usd > 0`, and it reads usd from VALUES. The customer USD
  // cell is computed for DISPLAY - `usdFor(i)` - and never entered the state,
  // so every customer milestone was dropped from the payload: a month and a
  // percentage typed in, and nothing recorded.
  //
  // The vanilla has no such gap because its JS WRITES the readonly input's
  // value, which its reader then reads back out of the DOM. Here the display
  // and the reader are two readers of one value, and this is what makes them
  // one: typing a percentage writes the dollars, exactly as the contractor
  // grid's round trip already did.
  const onMilestoneTyped = (id: string, v: string) => {
    setValue(id, v)
    const m = id.match(/^deal-ms-(\d+)-pct$/)
    // R-N1: THE DERIVED DOLLARS NO LONGER REACH THE STATE. This wrote
    // `deal-ms-i-usd` so `readMilestones` could keep the row and send the
    // figure, and that write is the whole defect: it happened only when a
    // percentage was typed, so any later change to the PRICE left the stored
    // dollars where they were while the cell moved. The percentage is what is
    // recorded now and the dollars are derived at every reader.
    if (m) { /* the USD cell is derived; nothing to write */ }
  }

  const rows = result ? buildDealRows(result as never, payload, ui.grossUp) : []
  const cashFlow = (result as { cashFlow?: CashFlow } | null)?.cashFlow ?? null
  const oneOffPrice = (result as { totals?: { oneOffPrice: number } } | null)?.totals?.oneOffPrice ?? 0
  const lumpCost = Number(payload.lumpSumCost ?? 0)

  // R-O4: ONE schedule for both slots. It already branches on the structure
  // internally, so the hybrid and non-hybrid panels are two places to RENDER
  // it rather than two things to compute.
  const schedule = cashFlow
    ? buildYearSchedule(cashFlow, payload, ui.structure, ui.invoicing)
    : null

  // ── THE LATCH VIEWS, through src/lib/latches.js ────────────────────────
  // ONE derivation, shared by the latch signal and by section 4. Two readers of
  // the same value drift; the catalog problem the latch warns about must be the
  // same one the panel shows.
  // COST_CALC_AUDIT.md F4: the per-KEY absence, read from the resolver that
  // already computes it rather than derived a second time here. A product row
  // present with a null install or hosting column is invisible to `missing`,
  // and the line it feeds still prices at $0.
  const absentRateKeys = resolveRates(payload, catalogData?.rates ?? {})
    .absent.map((l: { key: string }) => l.key)
  const basisView = buildBasis(catalogData?.batches ?? {}, catalogData?.missing ?? [],
    catalogData?.asOf ?? null, catalog.isError ? 'Base Cost Data could not be loaded.' : null,
    payload.bidCurrency, absentRateKeys)
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
    // ── R2d: THE EIGHT STRUCTURAL TERMS NOTES ────────────────────────────
    //
    // These were visible `pg-item-note` rows under each field in
    // section36.tsx. They are the same text, moved verbatim, into the map that
    // already drives the help-dot pattern - so the deal form has ONE way of
    // explaining a field rather than two. The two DYNAMIC readouts that also
    // use pg-item-note (achieved margin's `against target`, and the per-product
    // hardware notes) are untouched: they report a value, they do not explain
    // a field.
    'deal-targetMargin': 'Seeds the margin on every pricing line. Margin on price, not markup on cost.',
    'deal-warrantyPct': 'Replacement unit provision, applied across total units.',
    'deal-duration': 'The contract term. A longer term spreads fixed costs and usually lifts margin, but we carry the hosting cost for longer.',
    'deal-bidCurrency': 'The currency our costs are held in. Defaults to USD, the currency of the Base Cost Data.',
    'deal-proposalCurrency': 'The currency the customer is quoted and invoiced in.',
    'deal-fxContingency': 'Uplift on the converted price to absorb exchange rate movement between proposal and contract. Zero when both currencies match.',
    'deal-whtPct': 'Deducted by the customer from the invoice.',
    'deal-gstPct': 'Added to the invoice, passed through to the tax authority.',
  }
  const renderField = (id: string, bare = false) => {
    const f = CENSUS.find((c) => c.id === id)
    if (!f) return null
    // The two currency fields are a FIXED LIST on the vanilla and were free
    // text here, which let a deal record a currency the shell does not know.
    const options = (id === 'deal-bidCurrency' || id === 'deal-proposalCurrency')
      ? CURRENCY_OPTIONS : undefined
    return <CensusField key={f.id} field={f} rates={rates} help={HELP[f.id]} bare={bare}
      options={options}
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

      {/* ── R-O3, WALK 4 2026-09-20: THE ORDER JOHN RULED ────────────────
          Structural Terms, Units and Installation, Payment Terms, Cash Flow,
          Deal Sheet, Versions.

          THE ORDER LIVES HERE, in this sequence of blocks, and nowhere else.
          VANILLA_SECTIONS in sections.ts is a list of four that LOOKS like
          the order and is not: it drives latching and dirty state, and it
          does not contain the Deal Sheet at all, which is how the sheet sat
          third on screen while that list held four entries. Anything reading
          that list as the order is reading a different fact.

          AND NOTHING GUARDED THIS BEFORE. Three assertions read like order
          guards and every one reads ids inside the retired deal-form-vanilla
          block, so they would have stayed green whichever order the live
          sections ended in. scripts/walk4/probe-section-order.mjs is the
          detector now, and those three are dispositioned in its header. */}
      {sectionFrame(SECTION['deal-section-3'], (
        <>
          <StructuralTermsSection renderField={renderField} payload={payload}
            achievedMargin={(result as { achievedMargin?: number } | null)?.achievedMargin}
            grossUpToggle={
              <SwitchButton id="deal-grossUp-toggle" state={grossUpToggle(ui)}
                onToggle={() => setUi({ grossUp: !ui.grossUp })} />
            } />
          {censusFields('deal-section-3')}
        </>
      ))}

      {sectionFrame(SECTION['deal-sections-1-2'], (
        <>
          <section className="deal-intake-col" id="deal-section-1">
            <p className="section-title">Units Required</p>
            <UnitCards renderField={renderField} />
            {censusFields('deal-sections-1-2')}
          </section>
          <InstallationSection
            vis={installVisibility(ui)}
            group={(result as { groups?: { installGroup?: never } } | null)?.groups?.installGroup}
            payload={payload}
            renderField={renderField}
            installResp={ui.installResp}
            onInstallResp={(v) => setUi({ installResp: v })}
            contractorGrid={
              <ContractorGrid rows={CONTRACTOR_INPUTS} values={values}
                options={(i) => milestoneOptions(values[`deal-cm-${i}-label`])}
                onTyped={onContractorTyped}
                // R-N1: the base the amounts derive from, so the grid holds
                // percentages and shows dollars rather than storing both.
                base={lumpCost}
                view={contractorReconciliation(values, lumpCost)} />
            } />
          {/* The seven catalog readouts. A readonly input here is a DISPLAY of
              a rate, not a record of one, and the vanilla says so in those
              words. They sit in the intake section, where the vanilla keeps
              them. */}
          {/* HIDDEN, as the vanilla holds them: these are the catalog figures
              the calculator reads, not fields anybody fills. Six extra boxes on
              screen is what the comparison against the vanilla found. */}
          {CATALOG_DISPLAYS.map((d) => (
            <label className="deal-field hidden" key={d.id}>
              <span className="deal-field-label">{d.label}</span>
              <input id={d.id} data-testid={d.id} readOnly value={money(rates[d.rate])} />
            </label>
          ))}
        </>
      ))}

      {sectionFrame(SECTION['deal-section-5'], (
        <>
          {censusFields('deal-section-5')}
          {/* ── R-O4: THE HYBRID PANEL IS WIRED ────────────────────────────
              `hybridSchedule` was `null`, so the hybrid's right-hand panel
              rendered its two invoicing radio buttons and nothing else: no
              hosting year rows, no total, and not the note saying hosting sits
              outside the milestones.

              NOTHING HAD TO BE BUILT TO FIX IT. `buildYearSchedule` already
              returns `kind: 'hybrid'` when the structure is hybrid, counting
              hosting ONLY because hardware is milestone-driven there and would
              otherwise be double counted, and `YearScheduleView` already has
              the matching branch. The two were simply never joined, and the
              literal `null` is why no test could fail: there was no wrong
              output to assert against, only an absence.

              ── AND THE PARAGRAPH THAT STOOD HERE WAS TRUE WHEN WRITTEN AND
                 FALSE WHEN READ. IT IS THE SECOND OF THE TWO FALSE COMMENTS
                 THE F3 RULING NAMES. It said:

                 "ONE SCHEDULE, COMPUTED ONCE, READ TWICE. The two slots are
                 two PLACES on the screen, not two derivations - the hybrid
                 group and the non-hybrid group are mutually exclusive, so
                 exactly one of them renders."

              The first sentence was always right. THE MUTUAL EXCLUSION WAS
              TRUE OF THE SCREEN R-O4 DESCRIBED and stopped being true one
              round later: R-PT2 moved the non-hybrid schedule out of
              `#deal-top-schedule-row`, which was hidden under Hybrid, into the
              content column, which is not. Two slots that had been exclusive
              by their containers became exclusive by nothing at all, and
              nothing in this comment could notice.

              A structural claim inherited from the screen it was written about
              is Architecture 9's shape: code built for a screen that then
              changed, with the difference that a comment keeps asserting.

              F5/F3 RULED, OPTION A, 2026-09-26: ONE PROP. There is no second
              slot to be exclusive with, and `section5` gates both places on
              one `hybridOn` expression, so the arrangement cannot drift apart
              again without a test failing. */}
          <PaymentTermsSection
            ui={ui} setUi={setUi}
            vis={structureVisibility({ ...ui, structure: effectiveStructure(ui) })}
            duration={payload.duration}
            // R-OX2 and R-OX3: built from the deal's OWN result, so the table
            // and the sheet cannot disagree about what this deal charges.
            opex={<OpexTable
              rows={result ? opexRows(result, payload, resolvedRates) : []}
              values={values} onValue={setValue} />}
            renderField={renderField}
            milestoneGrid={
              <MilestoneGrid rows={MILESTONE_INPUTS} values={values}
                // R-W12: ONE SOURCE, BOTH GRIDS. The contractor grid two
                // sections above is handed the same builder with the same
                // stored value, so the two can never offer different names.
                options={(i) => milestoneOptions(values[`deal-ms-${i}-label`])}
                usdFor={(i) => milestoneUsdFor(values[`deal-ms-${i}-pct`], oneOffPrice)}
                // N1: the base the total is taken against, the same one the
                // cells derive from.
                base={oneOffPrice}
                onChange={onMilestoneTyped}
                warning={customerScheduleWarning(
                  (payload.milestones ?? []) as { month?: number; usd?: number }[], oneOffPrice)} />
            }
            yearSchedule={schedule ? <YearScheduleView schedule={schedule} /> : null} />
        </>
      ))}

      {sectionFrame(SECTION['deal-section-6'], (
        <CashFlowSection
          hasFlow={!!cashFlow && cashFlow.rows.length > 0}
          closing={cashFlow ? closingCashText(cashFlow) : '--'}
          grid={cashFlow
            ? <CashFlowGrid months={cashFlow.rows.map((r) => r.m)}
                rows={buildCashFlowRows(cashFlow)} scrollRef={cashFlowRef} />
            : null} />
      ))}
      {/* ── SECTION 4: DEAL SHEET SUMMARY ───────────────────────────────── */}
      {/* The matrix is the summary column's content, inside #deal-panel, which
          is the container the stylesheet targets. `deal-matrix` was a React
          invention with no rule anywhere in style.css. */}
      <DealSummarySection
        result={result as never}
        // C1: built from the SAME result the matrix is built from, so the two
        // presentations read one derivation rather than two.
        statement={result
          ? buildDealStatement(result as never, payload, ui.grossUp, catalogData?.batches ?? {})
          : null}
        // ── C2: THE SEAM IS THE FORM'S OWN STORE ───────────────────────
        //
        // Not a second one. An edit in a drawer calls the same `setValue` the
        // pricing cards call, so the statement, the strip and the old panels
        // are three readers of one value rather than three copies kept in
        // step - which is R-N1 at the interaction layer and the reason a
        // change shows up in all three without anything listening.
        //
        // SAVE IS THE PANEL'S OWN SAVE, the one `#btn-save-deal` fires, so a
        // write from here is the same next-revision write as a write from
        // anywhere else. RESET re-reads the baseline through
        // `valuesFromPayload`, which is the same hydrate a fresh load uses.
        seam={{
          values,
          onValue: setValue,
          dirty: dirty.size > 0,
          onSave: () => { void saveRef.current() },
          onReset: () => { if (baseline) setValues(valuesFromPayload(baseline)) },
        }}
        saved={baseline ? valuesFromPayload(baseline) : {}}
        payload={payload}
        values={values}
        onMargin={setValue}
        hostingPriceMode={ui.hostingPriceMode}
        onHostingPriceMode={(mode) => setUi({ hostingPriceMode: mode })}
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

    </div>
  )
}
