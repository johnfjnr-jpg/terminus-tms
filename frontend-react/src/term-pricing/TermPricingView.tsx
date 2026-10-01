// ── TERM PRICING: the standalone quote calculator ────────────────────────
//
// TERM_PRICING Phase 3 (John, 2026-10-01). Built from the approved mockup
// (prototypes/term-pricing/index.html) with approval changes A1 to A4, and
// WITHOUT the mockup-only elements (A2): no banner, no States card, no
// admin/salesperson toggle, no generated-by footer. Edit rights follow the
// signed-in user's system_roles row, which the route reports as `isAdmin`.
//
// THE CALCULATION RUNS HERE, IN THE ENGINE (src/lib/term-pricing.js), which is
// pure. The route serves the settings and the catalog costs as decimal
// strings; nothing on this screen does arithmetic on money.
//
// Margin means margin on price everywhere on this screen (R-TP4).

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import {
  priceQuote, termLadder, normaliseParams, formatMoney, formatPct,
} from '../../../src/lib/term-pricing.js'
import { buildParams } from '../../../src/lib/term-pricing-settings.js'

export const TERM_PRICING_KEY = ['term-pricing'] as const

const PRODUCTS = [
  { key: 'safesight', label: 'SafeSight' },
  { key: 'air_quality', label: 'AQ' },
  { key: 'hemir', label: 'HEMIR' },
] as const

// A4: the WHT choices as approved. The rate is the per-deal input the spec's
// section 2 names; the approved screen offers 0% and 10% two ways.
const WHT_OPTIONS = [
  { id: 'none', label: '0%', whtPct: null, whtGrossUp: false },
  { id: 'up', label: '10% gross-up', whtPct: '10', whtGrossUp: true },
  { id: 'borne', label: '10% borne', whtPct: '10', whtGrossUp: false },
] as const

type Settings = Record<string, unknown>
interface Costs { [product: string]: { hwCost: string; hostingMonthly: string; batchLabel: string; effectiveFrom: string } }
interface ServerState { settings: Settings; costs: Costs; isAdmin: boolean; updatedAt: string; asOf: string }

const money = (c: bigint) => formatMoney(c)
const pct = (r: { n: bigint; d: bigint }) => `${formatPct(r, 1)}%`
const vsAnchor = (saving: { n: bigint; d: bigint }, isAnchor: boolean) => {
  if (isAnchor) return { text: 'list', kind: 'list' }
  const s = formatPct(saving, 1)
  return s.startsWith('-') ? { text: `+${s.slice(1)}%`, kind: 'premium' } : { text: `−${s}%`, kind: 'saving' }
}
const isWhole = (s: string) => /^\d+$/.test(s.trim())
const isDecimal = (s: string) => /^\d+(\.\d+)?$/.test(s.trim())

export function TermPricingView({ navToken }: { navToken: number }) {
  const shell = useShell()
  const qc = useQueryClient()
  const { data, isError, error } = useQuery({
    queryKey: [...TERM_PRICING_KEY, navToken],
    queryFn: async () => {
      const r = await shell.api<ServerState & { error?: string }>('GET', '/api/term-pricing')
      if (!r.ok || !r.data) throw new Error(r.data?.error ?? `could not load term pricing (${r.status ?? 'network'})`)
      return r.data as ServerState
    },
  })

  // Inputs. The screen opens on the spec's base case, one SafeSight unit, so
  // the ladder and the quote are on screen from the first paint.
  const [units, setUnits] = useState<Record<string, string>>({ safesight: '1', air_quality: '0', hemir: '0' })
  const [term, setTerm] = useState<number>(36)
  const [structure, setStructure] = useState<'opex' | 'capex'>('opex')
  const [escalator, setEscalator] = useState('')
  const [gst, setGst] = useState('9')
  const [wht, setWht] = useState<(typeof WHT_OPTIONS)[number]['id']>('none')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const params = useMemo(() => {
    if (!data) return null
    try { return { ok: true as const, p: normaliseParams(buildParams(data.settings, data.costs)) } }
    catch (e) { return { ok: false as const, message: (e as Error).message } }
  }, [data])

  const result = useMemo(() => {
    if (!params?.ok) return null
    const bad = PRODUCTS.find((p) => units[p.key].trim() !== '' && !isWhole(units[p.key]))
    if (bad) return { error: `Units of ${bad.label} must be a whole number, 0 or more.` }
    if (escalator.trim() !== '' && !isDecimal(escalator)) return { error: 'The escalator must be a percentage, for example 3.' }
    if (gst.trim() !== '' && !isDecimal(gst)) return { error: 'GST must be a percentage, for example 9.' }
    const w = WHT_OPTIONS.find((o) => o.id === wht)!
    const input = {
      units: Object.fromEntries(PRODUCTS.map((p) => [p.key, units[p.key].trim() === '' ? 0 : Number(units[p.key])])),
      termMonths: term,
      paymentStructure: structure,
      escalatorPct: escalator.trim() === '' ? null : escalator.trim(),
      gstPct: gst.trim() === '' ? null : gst.trim(),
      whtPct: w.whtPct,
      whtGrossUp: w.whtGrossUp,
    }
    try {
      return { quote: priceQuote(input, params.p), ladder: termLadder(input, params.p) }
    } catch (e) {
      // The engine's refusals are written for a person (T17, T18 and A3).
      return { error: (e as Error).message }
    }
  }, [params, units, term, structure, escalator, gst, wht])

  if (isError) return <div className="wrap tp-view"><p className="tp-error" role="alert">{(error as Error).message}</p></div>
  if (!data || !params) return <div className="wrap tp-view"><p className="field-note">Loading term pricing...</p></div>

  const terms = params.ok ? params.p.terms : []
  const q = result && 'quote' in result ? result.quote : null
  const ladder = result && 'ladder' in result ? result.ladder : null
  const capex = structure === 'capex'

  return (
    <div className="wrap tp-view" data-testid="term-pricing">
      <div className="page-head">
        <h1>Term Pricing</h1>
        <p className="field-note">Longer contracts give the client a lower monthly fee; Terminus earns the 36-month profit on every term from 36 up. Margin is margin on price throughout.</p>
      </div>

      <section className="tp-card" aria-label="Inputs">
        <h2 className="tp-h2">Inputs</h2>
        <div className="tp-inputs">
          <div>
            <div className="tp-label">Units per product</div>
            <div className="tp-units">
              {PRODUCTS.map((p) => (
                <label key={p.key} className="tp-unit">
                  <span>{p.label}</span>
                  <input className="tp-num" inputMode="numeric" data-testid={`tp-units-${p.key}`} value={units[p.key]}
                    onChange={(e) => setUnits({ ...units, [p.key]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="tp-label">Term (months)</div>
            <div className="tp-seg" role="group" aria-label="Term">
              {terms.map((t) => (
                <button key={t} type="button" className={t === term ? 'on' : ''} aria-pressed={t === term}
                  data-testid={`tp-term-${t}`} onClick={() => setTerm(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="tp-label">Payment structure</div>
            <div className="tp-seg" role="group" aria-label="Payment structure">
              <button type="button" className={!capex ? 'on' : ''} aria-pressed={!capex} data-testid="tp-opex" onClick={() => setStructure('opex')}>OPEX monthly</button>
              <button type="button" className={capex ? 'on' : ''} aria-pressed={capex} data-testid="tp-capex" onClick={() => setStructure('capex')}>CAPEX hardware upfront</button>
            </div>
            <label className="tp-label tp-mt">Annual escalator %
              <input className="tp-num tp-pct" placeholder="none" data-testid="tp-escalator" value={escalator} onChange={(e) => setEscalator(e.target.value)} />
            </label>
          </div>
          <div>
            <label className="tp-label">GST %
              <input className="tp-num tp-pct" data-testid="tp-gst" value={gst} onChange={(e) => setGst(e.target.value)} />
            </label>
            <div className="tp-label tp-mt">WHT</div>
            <div className="tp-seg" role="group" aria-label="WHT">
              {WHT_OPTIONS.map((o) => (
                <button key={o.id} type="button" className={o.id === wht ? 'on' : ''} aria-pressed={o.id === wht}
                  data-testid={`tp-wht-${o.id}`} onClick={() => setWht(o.id)}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!params.ok && <p className="tp-error" role="alert">The settings cannot be priced: {params.message}</p>}
      {result && 'error' in result && (
        <section className="tp-card"><p className="tp-error" role="alert" data-testid="tp-error">{result.error}</p></section>
      )}

      {ladder && q && (
        <>
          <section className="tp-card" aria-label="Term ladder">
            <h2 className="tp-h2">Term ladder <span className="tp-hint">the same inputs at every term; select a row to quote it</span></h2>
            <table className="tp-table" data-testid="tp-ladder">
              <thead><tr>
                <th>Term</th>
                {capex ? <><th>Upfront</th><th>Monthly service fee (year 1)</th></> : <th>Monthly fee (year 1)</th>}
                <th>vs 36 months, this deal</th><th>TCV (net)</th><th>Margin on price</th>
              </tr></thead>
              <tbody>
                {ladder.map((r) => {
                  const v = vsAnchor(r.savingVsAnchor, r.isAnchor)
                  return (
                    <tr key={r.termMonths} className={`tp-ladder${r.termMonths === term ? ' on' : ''}`}
                      data-testid={`tp-ladder-${r.termMonths}`} aria-selected={r.termMonths === term}
                      onClick={() => setTerm(r.termMonths)}>
                      <td>{r.termMonths} months</td>
                      {capex
                        ? <><td>{money(r.upfrontCents!)}</td><td>{money(r.monthlyServiceCents!)}</td></>
                        : <td>{money(r.monthlyTotalCents)}</td>}
                      <td className={v.kind === 'saving' ? 'tp-saving' : v.kind === 'premium' ? 'tp-premium' : undefined}>{v.text}</td>
                      <td>{money(r.tcvNetCents)}</td>
                      <td>{pct(r.grossMargin)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="tp-card" aria-label="Quote">
            <h2 className="tp-h2">Quote <span className="tp-hint">{term} months, {capex ? 'CAPEX' : 'OPEX'}{q.monthlyTotalByYear.length > 1 && escalator.trim() && Number(escalator) !== 0 ? `, ${escalator.trim()}% annual escalator` : ''}</span></h2>
            <div className="tp-figures">
              <div><div className="tp-label">{capex ? 'Monthly service fee (year 1)' : 'Monthly total (year 1)'}</div>
                <div className="tp-v tp-lead" data-testid="tp-q-monthly">{money(capex ? q.capex!.monthlyServiceCents : q.monthlyTotalCents)}</div></div>
              {capex && <div><div className="tp-label">Upfront</div><div className="tp-v" data-testid="tp-q-upfront">{money(q.capex!.upfrontCents)}</div></div>}
              <div><div className="tp-label">TCV (net)</div><div className="tp-v" data-testid="tp-q-tcv">{money(q.tcvNetCents)}</div></div>
              <div><div className="tp-label">GST</div><div className="tp-v" data-testid="tp-q-gst">{money(q.tax.gstCents)}</div></div>
              <div><div className="tp-label">TCV incl. GST</div><div className="tp-v" data-testid="tp-q-tcvincl">{money(q.tax.tcvInclGstCents)}</div></div>
              <div><div className="tp-label">Margin on price</div><div className="tp-v" data-testid="tp-q-margin">{pct(q.grossMargin)}</div>
                <div className={`tp-chip${q.belowMarginFloor ? ' tp-flag' : ''}`} data-testid="tp-q-floor">
                  {q.belowMarginFloor ? 'Below' : 'Above'} the {formatPct(q.marginFloor, 1)}% floor</div>
                {q.marginAfterWht && <div className="tp-small" data-testid="tp-q-after-wht">Margin on price after WHT: {pct(q.marginAfterWht)}</div>}
              </div>
            </div>
            <div className="tp-split">
              <div>
                <div className="tp-label">{capex ? 'Pricing basis (OPEX fees)' : 'Product lines (bands count per line)'}</div>
                <table className="tp-table tp-lines">
                  <thead><tr><th>Line</th><th>Units</th><th>Fee / unit / mo</th><th>Monthly</th></tr></thead>
                  <tbody>
                    {q.lines.flatMap((l) => [
                      <tr key={l.product}><td>{PRODUCTS.find((p) => p.key === l.product)?.label ?? l.product}</td><td>{l.units}</td><td></td><td>{money(l.monthlyByYear[0])}</td></tr>,
                      ...l.bands.map((b) => (
                        <tr key={`${l.product}-${b.from}`} className="tp-band">
                          <td>units {b.to === null ? `${b.from}+` : `${b.from} to ${b.to}`} at {b.discountPct}% off</td>
                          <td>{b.units}</td><td>{money(b.feeByYear[0])}</td><td>{money(BigInt(b.units) * b.feeByYear[0])}</td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="tp-label">Profit</div>
                <table className="tp-table"><tbody>
                  <tr><td>TCV (net)</td><td>{money(q.tcvNetCents)}</td></tr>
                  <tr><td>Hardware and hosting cost</td><td>{money(q.totalCostCents)}</td></tr>
                  <tr><td>Gross profit</td><td>{money(q.grossProfitCents)}</td></tr>
                  <tr><td>WHT borne by Terminus</td><td>{money(q.tax.whtBorneCents)}</td></tr>
                </tbody></table>
              </div>
            </div>
          </section>

          <section className="tp-card" aria-label="Payment schedule">
            <h2 className="tp-h2">Payment schedule <span className="tp-hint">{capex ? 'hardware upfront, then a monthly service fee' : 'one invoice a month for the term'}</span></h2>
            <table className="tp-table" data-testid="tp-schedule">
              <thead><tr><th>When</th><th>Invoices</th><th>Net fee</th><th>Invoice (pre-GST)</th><th>GST</th><th>Invoice incl. GST</th>
                <th>{q.tax.whtBorneCents > 0n ? 'WHT borne' : q.tax.whtCents > 0n ? 'WHT (grossed up)' : 'WHT'}</th><th>Terminus receives</th></tr></thead>
              <tbody>
                {q.schedule.map((r) => (
                  <tr key={`${r.kind}-${r.fromMonth}`}>
                    <td>{r.kind === 'upfront' ? 'Upfront (hardware)' : `Months ${r.fromMonth} to ${r.toMonth}`}</td>
                    <td>{r.count}</td><td>{money(r.netCents)}</td><td>{money(r.invoiceCents)}</td><td>{money(r.gstCents)}</td>
                    <td>{money(r.invoiceInclGstCents)}</td><td>{money(r.whtCents)}</td><td>{money(r.receivedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tp-small tp-muted">{capex
              ? `Upfront ${money(q.capex!.upfrontCents)} plus the monthly service fees ties to TCV ${money(q.tcvNetCents)} exactly, the same TCV as OPEX; the upfront carries any rounding residue.`
              : `Net fees times months equal TCV ${money(q.tcvNetCents)} exactly. GST is added on top of each invoice; WHT applies to the fee before GST.`}</p>
          </section>
        </>
      )}

      <SettingsCard state={data} open={settingsOpen} onToggle={() => setSettingsOpen(!settingsOpen)}
        onSaved={() => qc.invalidateQueries({ queryKey: TERM_PRICING_KEY })} />
    </div>
  )
}

// ── SETTINGS: collapsed by default (Q5); editable only by an admin (R-TP6) ──

const PARAM_ROWS: Array<[string, string]> = [
  ['TERMS', 'Terms offered (months, comma separated)'],
  ['ANCHOR_TERM', 'List-price term (months)'],
  ['PROFIT_STEP', 'Extra profit per term step above the anchor, per unit'],
  ['HW_UPFRONT_MARGIN', 'Margin on the hardware price, CAPEX upfront (%)'],
  ['MARGIN_FLOOR', 'Whole-deal margin below this shows a flag (%)'],
  ['CURRENCY', 'Currency'],
]

type Draft = Record<string, string>

function draftFrom(s: Settings): Draft {
  const d: Draft = {
    TERMS: (s.TERMS as number[]).join(', '),
    ANCHOR_TERM: String(s.ANCHOR_TERM),
    PROFIT_STEP: String(s.PROFIT_STEP),
    HW_UPFRONT_MARGIN: String(s.HW_UPFRONT_MARGIN),
    MARGIN_FLOOR: String(s.MARGIN_FLOOR),
    CURRENCY: String(s.CURRENCY),
  }
  for (const [k, v] of Object.entries(s.ANCHOR_MARGIN as Record<string, string>)) d[`ANCHOR_MARGIN.${k}`] = v
  for (const [k, v] of Object.entries(s.SHORT_TERM_MARGIN as Record<string, string>)) d[`SHORT_TERM_MARGIN.${k}`] = v
  ;(s.VOLUME_BANDS as Array<{ from: number; discountPct: string }>).forEach((b, i) => { d[`BAND.${i}`] = b.discountPct })
  return d
}

/** The draft back to setting values, only for keys that changed. */
function changesFrom(s: Settings, d: Draft): Settings {
  const out: Settings = {}
  const terms = d.TERMS.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (isWhole(x) ? Number(x) : NaN))
  if (terms.join(',') !== (s.TERMS as number[]).join(',')) out.TERMS = terms
  if (d.ANCHOR_TERM !== String(s.ANCHOR_TERM)) out.ANCHOR_TERM = isWhole(d.ANCHOR_TERM) ? Number(d.ANCHOR_TERM) : d.ANCHOR_TERM
  for (const k of ['PROFIT_STEP', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY']) if (d[k].trim() !== String(s[k])) out[k] = d[k].trim()
  for (const k of ['ANCHOR_MARGIN', 'SHORT_TERM_MARGIN']) {
    const cur = s[k] as Record<string, string>
    const next = Object.fromEntries(Object.keys(cur).map((p) => [p, d[`${k}.${p}`].trim()]))
    if (Object.keys(cur).some((p) => cur[p] !== next[p])) out[k] = next
  }
  const bands = s.VOLUME_BANDS as Array<{ from: number; discountPct: string }>
  const nextBands = bands.map((b, i) => ({ from: b.from, discountPct: d[`BAND.${i}`].trim() }))
  if (bands.some((b, i) => b.discountPct !== nextBands[i].discountPct)) out.VOLUME_BANDS = nextBands
  return out
}

function SettingsCard({ state, open, onToggle, onSaved }: {
  state: ServerState; open: boolean; onToggle: () => void; onSaved: () => void
}) {
  const shell = useShell()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(state.settings))
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(draftFrom(state.settings)) }, [state.settings])

  const admin = state.isAdmin
  const changes = changesFrom(state.settings, draft)
  const dirty = Object.keys(changes).length > 0
  const field = (k: string, width = 'tp-set') => (
    <input className={`tp-num ${width}`} data-testid={`tp-set-${k}`} value={draft[k] ?? ''} disabled={!admin}
      onChange={(e) => { setDraft({ ...draft, [k]: e.target.value }); setMessage(null) }} />
  )

  async function save() {
    if (!admin || !dirty || saving) return
    setSaving(true)
    const r = await shell.api<{ error?: string }>('PUT', '/api/term-pricing/settings', { settings: changes })
    setSaving(false)
    if (!r.ok) { setMessage({ kind: 'error', text: r.data?.error ?? `The change was not saved (${r.status ?? 'network'}).` }); return }
    setMessage({ kind: 'ok', text: 'Saved. Every quote priced from now on uses these settings.' })
    onSaved()
  }

  return (
    <section className="tp-card" aria-label="Settings" data-testid="tp-settings">
      <h2 className="tp-h2">Settings <span className="tp-tag">admin</span>
        <button type="button" className="btn-ghost tp-toggle" aria-expanded={open} aria-controls="tp-settings-body"
          data-testid="tp-settings-toggle" onClick={onToggle}>{open ? 'Collapse' : 'Expand'}</button>
      </h2>
      {open && (
        <div id="tp-settings-body" data-testid="tp-settings-body">
          <p className="tp-small tp-muted">{admin
            ? 'You are an admin. A change applies to every quote priced after it is saved.'
            : 'Only an admin can change these. They are shown so every quote can be explained.'}</p>
          <div className="tp-settings-grid">
            <table className="tp-table"><thead><tr><th>Parameter</th><th>Key</th><th>Value</th></tr></thead>
              <tbody>{PARAM_ROWS.map(([k, d]) => (
                <tr key={k}><td>{d}</td><td className="tp-code">{k}</td><td>{field(k, k === 'TERMS' ? 'tp-set-wide' : 'tp-set')}</td></tr>
              ))}</tbody></table>
            <div>
              <table className="tp-table"><thead><tr><th>Product</th><th>Anchor margin %</th><th>Short-term margin %</th><th>HW cost / unit</th><th>Hosting / unit / mo</th></tr></thead>
                <tbody>{PRODUCTS.filter((p) => state.costs[p.key]).map((p) => (
                  <tr key={p.key}><td>{p.label}</td><td>{field(`ANCHOR_MARGIN.${p.key}`, 'tp-set-narrow')}</td><td>{field(`SHORT_TERM_MARGIN.${p.key}`, 'tp-set-narrow')}</td>
                    <td>{state.costs[p.key].hwCost}</td><td>{state.costs[p.key].hostingMonthly}</td></tr>
                ))}</tbody></table>
              <p className="tp-small tp-muted">Costs are read from Base Cost Data and are not edited here
                {Object.values(state.costs)[0] ? ` (${Object.values(state.costs)[0].batchLabel}, effective ${Object.values(state.costs)[0].effectiveFrom})` : ''}.</p>
              <table className="tp-table"><thead><tr><th>Volume band (units per product line)</th><th>Discount on the monthly fee %</th></tr></thead>
                <tbody>{(state.settings.VOLUME_BANDS as Array<{ from: number }>).map((b, i, a) => (
                  <tr key={b.from}><td>{i + 1 < a.length ? `${b.from} to ${a[i + 1].from - 1}` : `${b.from} and above`}</td><td>{field(`BAND.${i}`, 'tp-set-narrow')}</td></tr>
                ))}</tbody></table>
            </div>
          </div>
          {message && <p className={message.kind === 'error' ? 'tp-error' : 'tp-small'} role={message.kind === 'error' ? 'alert' : 'status'} data-testid="tp-settings-message">{message.text}</p>}
          {admin && (
            <div className="tp-save-row">
              <button type="button" className="btn-primary" data-testid="tp-settings-save" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving...' : 'Save settings'}</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
