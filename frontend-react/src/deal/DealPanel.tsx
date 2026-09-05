import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { useDealForm } from './useDealForm'
import { buildDealRows, money } from './rows'
import { CENSUS, CATALOG_DISPLAYS, MILESTONE_INPUTS, CONTRACTOR_INPUTS, DEAL_SECTIONS } from './census'
import type { CensusInput } from './census'
import type { CatalogRates, Values, UiState } from './payload'

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

export function DealPanel({ initialValues, testBedCost = 0, initialUi }: {
  initialValues: Values
  testBedCost?: number
  initialUi?: UiState
}) {
  const catalog = useCatalogRates()
  const rates = ((catalog.data as { rates?: CatalogRates } | undefined)?.rates ?? {}) as CatalogRates
  const form = useDealForm(initialValues, rates, testBedCost, initialUi)
  const { values, ui, setValue, setUi, payload, result, computeError } = form

  if (catalog.isPending) return <p className="pg-item-note">Loading the cost catalog…</p>
  if (catalog.isError) {
    return <p className="msg-error" data-testid="catalog-error">
      {catalog.error instanceof Error ? catalog.error.message : 'The catalog could not be loaded.'}
    </p>
  }

  const rows = result ? buildDealRows(result as never, payload, ui.grossUp) : []

  return (
    <div data-testid="deal-panel">
      {DEAL_SECTIONS.map((section) => (
        <div className="deal-section" id={`deal-section-${section}`} key={section}>
          <div className="latch-row" data-testid={`latch-${section}`}>
            <span className="deal-section-title">{section}</span>
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

      <div className="deal-section" id="deal-section-milestones">
        {MILESTONE_INPUTS.map((m) => (
          <div className="deal-ms-row" key={m.row}>
            {[m.month, m.label, m.usd, m.pct].map((id) => (
              <input key={id} id={id} data-testid={id}
                value={values[id] ?? ''} onChange={(e) => setValue(id, e.target.value)} />
            ))}
          </div>
        ))}
      </div>
      <div className="deal-section" id="deal-section-contractor">
        {CONTRACTOR_INPUTS.map((m) => (
          <div className="deal-cm-row" key={m.row}>
            {[m.month, m.label, m.usd, m.pct].map((id) => (
              <input key={id} id={id} data-testid={id}
                value={values[id] ?? ''} onChange={(e) => setValue(id, e.target.value)} />
            ))}
          </div>
        ))}
      </div>

      {/* The latched choices the payload reads from uiState rather than a box. */}
      <div className="deal-section" id="deal-section-ui">
        <select data-testid="ui-structure" value={ui.structure}
          onChange={(e) => setUi({ structure: e.target.value })}>
          <option value="twoPhase">Two phase</option><option value="single">Single</option>
        </select>
        <select data-testid="ui-invoicing" value={ui.invoicing}
          onChange={(e) => setUi({ invoicing: e.target.value })}>
          <option value="annual">Annual</option><option value="milestones">Milestones</option>
        </select>
        <label><input type="checkbox" data-testid="ui-grossUp" checked={ui.grossUp}
          onChange={(e) => setUi({ grossUp: e.target.checked })} /> Gross up</label>
        <label><input type="checkbox" data-testid="ui-factoringEnabled" checked={ui.factoringEnabled}
          onChange={(e) => setUi({ factoringEnabled: e.target.checked })} /> PO factoring</label>
      </div>

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
