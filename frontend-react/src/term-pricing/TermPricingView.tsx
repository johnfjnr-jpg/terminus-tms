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

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import {
  priceQuote, termLadder, normaliseParams, formatMoney, formatPct, roundHalfUp,
} from '../../../src/lib/term-pricing.js'
import { buildParams } from '../../../src/lib/term-pricing-settings.js'

export const TERM_PRICING_KEY = ['term-pricing'] as const

const PRODUCTS = [
  { key: 'safesight', label: 'SafeSight' },
  { key: 'air_quality', label: 'AQ' },
  { key: 'hemir', label: 'HEMIR' },
] as const

// ── SUPERSEDED, QUOTED NOT DELETED (B3, TERM_PRICING_2) ──────────────────
// A4's WHT presets, "0%", "10% gross-up" and "10% borne", are replaced by a
// typed rate and a separate Gross up switch, and (B4) an optional split
// between the hardware and the software-as-a-service lines.

// The estate's own switch treatment (`.deal-toggle`, as panelParts' SwitchButton).
function Switch({ id, on, label, onToggle }: { id: string; on: boolean; label: string; onToggle(): void }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-testid={id}
      className={`btn-ghost deal-toggle${on ? ' is-on' : ''}`} onClick={onToggle}>{label}</button>
  )
}

const lastYearOf = (t: number) => Math.ceil(t / 12)


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

// ── TILE_FIT (John, 2026-10-06): ONE SHARED FIGURE SIZE FOR THE TILES ──────
// F1: the largest size at which the widest figure in the row fits its tile,
// padding included, applied to every tile alike. F2: the lead figure keeps its
// proportion. F3: never below the floor; if the row cannot fit at the floor,
// the tiles wrap to two rows of equal width instead. The cap, the floor and
// the lead ratio are CSS tokens on `.tp-figures`, read here, so the numbers
// live in one place and a test can plant a different one.
//
// A figure's width scales with its size, so each is measured once at a
// reference size in its own font and the fitting size is solved for, rather
// than searched. Recomputed when the figures, the tile count or the width
// change (a ResizeObserver on the row).
function useFittedFigures(dep: unknown) {
  const ref = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    const canvas = document.createElement('canvas').getContext('2d')
    const fit = () => {
      const cs = getComputedStyle(row)
      const token = (name: string, dflt: number) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : dflt }
      const max = token('--tp-fig-max', 18), min = token('--tp-fig-min', 13), lead = token('--tp-fig-lead-ratio', 22 / 18)
      const tiles = [...row.children] as HTMLElement[]
      const figs = tiles.map((t) => t.querySelector<HTMLElement>('.tp-v'))
      // Width of each figure per pixel of font size, in its own face.
      const per = figs.map((f) => {
        if (!f || !canvas) return 0
        const fcs = getComputedStyle(f)
        canvas.font = `${fcs.fontStyle} ${fcs.fontWeight} 100px ${fcs.fontFamily}`
        return (canvas.measureText(f.textContent ?? '').width / 100) * (f.classList.contains('tp-lead') ? lead : 1)
      })
      const solve = () => Math.min(...tiles.map((t, i) => {
        const tcs = getComputedStyle(t)
        const room = t.clientWidth - parseFloat(tcs.paddingLeft) - parseFloat(tcs.paddingRight)
        return per[i] > 0 ? room / per[i] : Infinity
      }))
      row.classList.remove('tp-figures--wrap')
      row.style.setProperty('--tp-fig-cols', String(Math.ceil(tiles.length / 2)))
      let size = solve()
      if (size < min) {
        row.classList.add('tp-figures--wrap')
        size = solve()
      }
      size = Math.max(min, Math.min(max, Math.floor(size * 4) / 4))
      row.style.setProperty('--tp-fig', `${size}px`)
      // Wrapped, the hairlines follow the grid: a rule under the first row and
      // none at a row's right end, so no line doubles against the card's own
      // border (seen in the first wrapped capture). CSS cannot count columns
      // held in a variable, so the tiles are marked here.
      const cols = Math.ceil(tiles.length / 2), wrapped = row.classList.contains('tp-figures--wrap')
      tiles.forEach((t, i) => {
        t.classList.toggle('tp-fig-top', wrapped && i < cols)
        t.classList.toggle('tp-fig-end', wrapped && (i + 1) % cols === 0)
      })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(row)
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    let live = true
    fonts?.ready.then(() => { if (live) fit() }).catch(() => {})
    return () => { live = false; ro.disconnect() }
  }, [dep])
  return ref
}

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
  // B6: the contract year the escalator first applies. The select offers 2 to
  // the term's last year, so a shorter term pulls the choice back inside it
  // (chooseTerm). One value feeds both the select and the engine.
  const [startYear, setStartYear] = useState(2)
  const [gst, setGst] = useState('9')
  // B3, B4: blank is 0 (the blank-zero rule).
  const [whtPct, setWhtPct] = useState('')
  const [grossUp, setGrossUp] = useState(false)
  const [whtSplit, setWhtSplit] = useState(false)
  const [whtHw, setWhtHw] = useState('')
  const [whtSaas, setWhtSaas] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const chooseTerm = (t: number) => {
    setTerm(t)
    setStartYear((s) => Math.max(2, Math.min(s, lastYearOf(t))))
  }

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
    const whtFields: Array<[string, string]> = whtSplit
      ? [[whtHw, 'WHT on hardware'], [whtSaas, 'WHT on SaaS']]
      : [[whtPct, 'WHT']]
    const badWht = whtFields.find(([v]) => v.trim() !== '' && !isDecimal(v))
    if (badWht) return { error: `${badWht[1]} must be a percentage, for example 10.` }
    const blankNull = (v: string) => (v.trim() === '' ? null : v.trim())
    const input = {
      units: Object.fromEntries(PRODUCTS.map((p) => [p.key, units[p.key].trim() === '' ? 0 : Number(units[p.key])])),
      termMonths: term,
      paymentStructure: structure,
      escalatorPct: blankNull(escalator),
      escalatorStartYear: startYear,
      gstPct: blankNull(gst),
      whtPct: whtSplit ? null : blankNull(whtPct),
      whtGrossUp: grossUp,
      whtSplit,
      whtHwPct: whtSplit ? blankNull(whtHw) : null,
      whtSaasPct: whtSplit ? blankNull(whtSaas) : null,
    }
    try {
      return { quote: priceQuote(input, params.p), ladder: termLadder(input, params.p) }
    } catch (e) {
      // The engine's refusals are written for a person (T17, T18 and A3).
      return { error: (e as Error).message }
    }
  }, [params, units, term, structure, escalator, startYear, gst, whtPct, grossUp, whtSplit, whtHw, whtSaas])
  // TILE_FIT: refits whenever the quote (its figures and tile count) changes.
  const figuresRef = useFittedFigures(result)

  if (isError) return <div className="wrap tp-view"><p className="tp-error" role="alert">{(error as Error).message}</p></div>
  if (!data || !params) return <div className="wrap tp-view"><p className="field-note">Loading term pricing...</p></div>

  const terms = params.ok ? params.p.terms : []
  const q = result && 'quote' in result ? result.quote : null
  const ladder = result && 'ladder' in result ? result.ladder : null
  const capex = structure === 'capex'
  // D4 (John, 2026-10-06): the title states the WHT treatment. One rate:
  // ", WHT 10% borne" or ", WHT 10% grossed up", nothing at 0. Split:
  // ", split WHT 5% hardware / 10% SaaS, grossed up" (or "borne"). The rates
  // are the inputs as typed, blank read as 0 (the blank-zero rule).
  const rateText = (v: string) => (v.trim() === '' ? '0' : v.trim())
  const treatment = grossUp ? 'grossed up' : 'borne'
  const whtTitle = whtSplit
    ? `, split WHT ${rateText(whtHw)}% hardware / ${rateText(whtSaas)}% SaaS, ${treatment}`
    : isDecimal(whtPct) && Number(whtPct) > 0 ? `, WHT ${whtPct.trim()}% ${treatment}` : ''

  return (
    <div className="wrap tp-view" data-testid="term-pricing">
      <div className="page-head">
        <h1>Term Pricing</h1>
        <p className="field-note">Longer contracts give the client a lower monthly fee; Terminus earns the 36-month profit on every term from 36 up. Margin is margin on price throughout.</p>
      </div>

      <section className="tp-card" aria-label="Inputs">
        <h2 className="tp-h2">Inputs</h2>
        {/* ── TP_INPUTS (John, 2026-10-03): DEAL TERMS FIRST, TAX BELOW ──────
            Built to the approved pictures, prototypes/term-pricing-inputs/.
            SUPERSEDED, QUOTED NOT DELETED: TERM_PRICING_2's two `.tp-half`
            wrappers holding four groups (units and term; structure and tax),
            with the tax controls stacked. Each section is now one row whose
            groups sit together from the left, under a small heading with a
            rule to its right (I1). */}
        <div className="tp-section-head">Deal terms</div>
        <div className="tp-row" data-testid="tp-deal-row">
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
            {/* B2: rows of five, in term order (12 to 60, then 72 to 120). */}
            <div className="tp-seg tp-terms" role="group" aria-label="Term">
              {terms.map((t) => (
                <button key={t} type="button" className={t === term ? 'on' : ''} aria-pressed={t === term}
                  data-testid={`tp-term-${t}`} onClick={() => chooseTerm(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="tp-label">Payment structure</div>
            <div className="tp-seg" role="group" aria-label="Payment structure">
              <button type="button" className={!capex ? 'on' : ''} aria-pressed={!capex} data-testid="tp-opex" onClick={() => setStructure('opex')}>OPEX monthly</button>
              <button type="button" className={capex ? 'on' : ''} aria-pressed={capex} data-testid="tp-capex" onClick={() => setStructure('capex')}>CAPEX hardware upfront</button>
            </div>
            {/* B6: a typed rate (blank is 0, no escalator) and the year it starts.
                The placeholder is a value in the field's format, not prose.
                I6: the disabled select keeps L2's dimmed border. */}
            <div className="tp-pair tp-mt">
              <label className="tp-label">Annual escalator %
                <input className="tp-num tp-pct" placeholder="0" data-testid="tp-escalator" value={escalator} onChange={(e) => setEscalator(e.target.value)} />
              </label>
              {lastYearOf(term) >= 2 && (
                <label className="tp-label">Starts in year
                  <select className="tp-num tp-pct tp-select" data-testid="tp-escalator-start" value={startYear}
                    disabled={!(isDecimal(escalator) && Number(escalator) !== 0)}
                    onChange={(e) => setStartYear(Number(e.target.value))}>
                    {Array.from({ length: lastYearOf(term) - 1 }, (_, i) => i + 2).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              )}
            </div>
            {lastYearOf(term) < 2 && isDecimal(escalator) && Number(escalator) !== 0 && (
              <p className="tp-small tp-muted" data-testid="tp-escalator-none">A {term}-month term has no year 2, so the escalator has no effect.</p>
            )}
          </div>
        </div>

        {/* TAX (I1 to I4): one row, GST | Split WHT | WHT field(s) | Gross up.
            Split WHT swaps one field for two IN THE SAME ROW, so the card
            keeps its height (I3). The inputs are two digits wide (I2). */}
        <div className="tp-section-head">Tax</div>
        <div className="tp-row tp-tax-row" data-testid="tp-tax-row">
          <label className="tp-label">GST %
            <input className="tp-num tp-pct2" data-testid="tp-gst" value={gst} onChange={(e) => setGst(e.target.value)} />
          </label>
          <Switch id="tp-wht-split" on={whtSplit} label="Split WHT" onToggle={() => setWhtSplit(!whtSplit)} />
          {whtSplit ? (
            <>
              <label className="tp-label">WHT on hardware %
                <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht-hw" value={whtHw} onChange={(e) => setWhtHw(e.target.value)} />
              </label>
              <label className="tp-label">WHT on SaaS %
                <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht-saas" value={whtSaas} onChange={(e) => setWhtSaas(e.target.value)} />
              </label>
            </>
          ) : (
            <label className="tp-label">WHT %
              <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht" value={whtPct} onChange={(e) => setWhtPct(e.target.value)} />
            </label>
          )}
          <Switch id="tp-wht-grossup" on={grossUp} label="Gross up" onToggle={() => setGrossUp(!grossUp)} />
        </div>
        <p className="tp-small tp-muted tp-tax-note" data-testid="tp-tax-note">
          WHT applies to each invoice line before GST. GST is added on top of every invoice.{whtSplit ? ' With Split WHT on, OPEX invoices carry a hardware line and a SaaS line.' : ''}
        </p>

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
                      onClick={() => chooseTerm(r.termMonths)}>
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
            <h2 className="tp-h2">Quote <span className="tp-hint">{term} months, {capex ? 'CAPEX' : 'OPEX'}{q.monthlyTotalByYear.length > 1 && escalator.trim() && Number(escalator) !== 0 ? `, ${escalator.trim()}% annual escalator from year ${startYear}` : ''}{whtTitle}</span></h2>
            <div className="tp-figures" ref={figuresRef} data-testid="tp-figures">
              <div><div className="tp-label">{capex ? 'Monthly service fee (year 1)' : 'Monthly total (year 1)'}</div>
                <div className="tp-v tp-lead" data-testid="tp-q-monthly">{money(capex ? q.capex!.monthlyServiceCents : q.monthlyTotalCents)}</div></div>
              {capex && <div><div className="tp-label">Upfront</div><div className="tp-v" data-testid="tp-q-upfront">{money(q.capex!.upfrontCents)}</div></div>}
              <div><div className="tp-label">TCV (net)</div><div className="tp-v" data-testid="tp-q-tcv">{money(q.tcvNetCents)}</div></div>
              {/* L1: with Gross up on, the tiles foot: TCV (net) + WHT gross-up +
                  GST = TCV incl. GST. The figure is the engine's, not a sum here. */}
              {grossUp && <div><div className="tp-label">WHT gross-up</div><div className="tp-v" data-testid="tp-q-grossup">{money(q.tax.grossUpCents)}</div></div>}
              <div><div className="tp-label">GST</div><div className="tp-v" data-testid="tp-q-gst">{money(q.tax.gstCents)}</div></div>
              <div><div className="tp-label">TCV incl. GST</div><div className="tp-v" data-testid="tp-q-tcvincl">{money(q.tax.tcvInclGstCents)}</div></div>
              <div><div className="tp-label">Margin on price</div><div className="tp-v" data-testid="tp-q-margin">{pct(q.grossMargin)}</div>
                <div className={`tp-chip${q.belowMarginFloor ? ' tp-flag' : ''}`} data-testid="tp-q-floor">
                  {q.belowMarginFloor ? 'Below' : 'Above'} the {formatPct(q.marginFloor, 1)}% floor</div>
                {q.marginAfterWht && <div className="tp-small" data-testid="tp-q-after-wht">Margin on price after WHT: {pct(q.marginAfterWht)}</div>}
              </div>
            </div>
            {/* ── QUOTE_PANEL (John, 2026-10-05): ONE PANEL ────────────────────
                Built to the approved pictures (prototypes/term-pricing-quote/).
                SUPERSEDED, QUOTED NOT DELETED: a two-column `.tp-split` of a
                "Product lines" table and a "Profit" table, then a separate
                Payment schedule card. Their content now lives only here, in
                Q1's order: tiles, pricing by product and band, profit by
                product, payment schedule. */}
            <div className="tp-label tp-section-label" data-testid="tp-pricing-head">{capex ? 'Pricing basis (OPEX fees, year 1)' : 'Pricing by product and band'}</div>
            <table className="tp-table tp-lines tp-pricing" data-testid="tp-pricing">
              <thead><tr><th>Product and band</th><th>Units</th><th>List fee / unit (USD)</th><th>Volume discount</th><th>Fee / unit (USD)</th><th>Monthly (USD)</th></tr></thead>
              <tbody>
                {q.lines.flatMap((l) => [
                  <tr key={l.product} className="tp-subtotal" data-testid={`tp-pricing-${l.product}`}>
                    <td>{PRODUCTS.find((p) => p.key === l.product)?.label ?? l.product}</td><td>{l.units}</td><td></td><td></td><td></td><td>{money(l.monthlyByYear[0])}</td>
                  </tr>,
                  ...l.bands.map((b) => (
                    <tr key={`${l.product}-${b.from}`} className="tp-band">
                      <td>units {b.to === null ? `${b.from}+` : `${b.from} to ${b.to}`}</td>
                      <td>{b.units}</td><td>{money(roundHalfUp(l.listFee, 2))}</td><td>{b.discountPct}%</td>
                      <td>{money(b.feeByYear[0])}</td><td>{money(BigInt(b.units) * b.feeByYear[0])}</td>
                    </tr>
                  )),
                ])}
                <tr className="tp-subtotal tp-total" data-testid="tp-pricing-total">
                  <td>Total per month</td><td>{q.lines.reduce((t, l) => t + l.units, 0)}</td><td></td><td></td><td></td><td>{money(q.monthlyTotalCents)}</td>
                </tr>
              </tbody>
            </table>
            {/* Q1(b): with an escalator, the fees above are year 1's. */}
            {q.monthlyTotalByYear.length > 1 && isDecimal(escalator) && Number(escalator) !== 0 && (
              <p className="tp-small tp-muted" data-testid="tp-escalator-note">
                Fees rise {escalator.trim()}% a year from year {startYear}.{capex ? ' The payment schedule shows each year\'s figures; under CAPEX the client pays hardware upfront and a monthly service fee instead.' : ''}
              </p>
            )}

            {/* Q2: per product from the engine (spec v1.4); WHT is never per product. */}
            <div className="tp-label tp-section-label">Profit by product</div>
            <table className="tp-table tp-lines" data-testid="tp-profit">
              <thead><tr><th>Product</th><th>Units</th><th>TCV (net)</th><th>Hardware and hosting cost</th><th>Gross profit</th><th>Margin on price</th></tr></thead>
              <tbody>
                {q.lines.map((l) => (
                  <tr key={l.product} data-testid={`tp-profit-${l.product}`}>
                    <td>{PRODUCTS.find((p) => p.key === l.product)?.label ?? l.product}</td><td>{l.units}</td>
                    <td>{money(l.tcvNetCents)}</td><td>{money(l.costCents)}</td><td>{money(l.grossProfitCents)}</td><td>{pct(l.grossMargin)}</td>
                  </tr>
                ))}
                <tr className="tp-subtotal tp-total" data-testid="tp-profit-total">
                  <td>Total</td><td>{q.lines.reduce((t, l) => t + l.units, 0)}</td>
                  <td>{money(q.tcvNetCents)}</td><td>{money(q.totalCostCents)}</td><td>{money(q.grossProfitCents)}</td><td>{pct(q.grossMargin)}</td>
                </tr>
                {q.tax.whtBorneCents > 0n && (
                  <>
                    <tr className="tp-quiet" data-testid="tp-profit-wht">
                      <td>WHT borne by Terminus (whole deal)</td><td></td><td></td><td></td><td>{money(-q.tax.whtBorneCents)}</td><td></td>
                    </tr>
                    {/* The one subtraction on this screen: the engine's own
                        definition of marginAfterWht's numerator (Q4), shown. */}
                    <tr className="tp-quiet" data-testid="tp-profit-after-wht">
                      <td>Gross profit after WHT</td><td></td><td></td><td></td><td>{money(q.grossProfitCents - q.tax.whtBorneCents)}</td><td>{q.marginAfterWht ? pct(q.marginAfterWht) : ''}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Q1(d): the payment schedule, rows and notes as before. */}
            <div className="tp-label tp-section-label">Payment schedule</div>
            <p className="tp-small tp-muted tp-schedule-hint">{capex ? 'hardware upfront, then a monthly service fee' : whtSplit ? 'one invoice a month, as a hardware line and a service line' : 'one invoice a month for the term'}</p>
            <table className="tp-table tp-lines tp-schedule" data-testid="tp-schedule">
              <thead><tr><th>When</th><th>Invoices</th><th>Net fee</th><th>Invoice (pre-GST)</th><th>GST</th><th>Invoice incl. GST</th>
                <th>{q.tax.whtBorneCents > 0n ? 'WHT borne' : q.tax.whtCents > 0n ? 'WHT (grossed up)' : 'WHT'}</th><th>Terminus receives</th></tr></thead>
              <tbody>
                {q.schedule.flatMap((r) => [
                  <tr key={`${r.kind}-${r.fromMonth}`} data-testid={`tp-sched-${r.kind}-${r.fromMonth}`}>
                    <td>{r.kind === 'upfront' ? 'Upfront (hardware)' : `Months ${r.fromMonth} to ${r.toMonth}${capex && whtSplit ? ' (service)' : ''}`}</td>
                    <td>{r.count}</td><td>{money(r.netCents)}</td><td>{money(r.invoiceCents)}</td><td>{money(r.gstCents)}</td>
                    <td>{money(r.invoiceInclGstCents)}</td><td>{money(r.whtCents)}</td><td>{money(r.receivedCents)}</td>
                  </tr>,
                  // B4: a split OPEX month is two invoice lines, each with its own WHT.
                  ...(r.lines ?? []).map((l) => (
                    <tr key={`${r.kind}-${r.fromMonth}-${l.kind}`} className="tp-band" data-testid={`tp-sched-${r.fromMonth}-${l.kind}`}>
                      <td>{l.kind === 'hardware' ? 'Hardware line' : 'SaaS line'}</td>
                      <td></td><td>{money(l.netCents)}</td><td>{money(l.invoiceCents)}</td><td>{money(l.gstCents)}</td>
                      <td>{money(l.invoiceInclGstCents)}</td><td>{money(l.whtCents)}</td><td>{money(l.receivedCents)}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
            <p className="tp-small tp-muted">{capex
              // D3 (John, 2026-10-06): today's sentence plus the picture's.
              ? `Upfront ${money(q.capex!.upfrontCents)} plus the monthly service fees ties to TCV ${money(q.tcvNetCents)} exactly, the same TCV as OPEX; the upfront carries any rounding residue. WHT is withheld per invoice, so it is shown for the whole deal, not per product.`
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
