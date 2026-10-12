// ── TERM PRICING: the standalone quote calculator ────────────────────────
//
// TERM_PRICING Phase 3 (John, 2026-10-01), rebuilt as THREE TABS by TP_TABS
// (John, 2026-10-11): 1 Pricing (the price, set by OPEX), 2 Payment terms (how
// the client pays it), 3 Quote (the read-only result). Built to the approved
// mockup, prototypes/term-pricing-tabs/ (five states; the HTML exports in
// html/<state>/ are the text reference, the PNGs the visual one). Content,
// structure, order, labels and behaviour are binding; type and colour are the
// estate's tokens (C13, as TP_CAPEX's C-13). Edit rights for the settings
// follow the signed-in user's system_roles row, which the route reports as
// `isAdmin`.
//
// SUPERSEDED, QUOTED NOT DELETED: the single page of TERM_PRICING Phase 3,
// TP_INPUTS ("deal terms first, tax below"), QUOTE_PANEL ("one panel") and
// TP_CAPEX's C-13 card layout (the "Price, set by OPEX" card, the Deal value
// card and the Rules card retire, T-6 and N10).
//
// THE CALCULATION RUNS HERE, IN THE ENGINE (src/lib/term-pricing.js), which is
// pure. The route serves the settings and the catalog costs as decimal
// strings; nothing on this screen does arithmetic on money.
//
// Margin means margin on price everywhere on this screen (R-TP4).

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import {
  priceQuote, capexAllocation, termLadder, normaliseParams, formatMoney, formatPct,
  validateBands, bandMarginGrid,
} from '../../../src/lib/term-pricing.js'
import type { CpiMode, Quote, AllocationPreview } from '../../../src/lib/term-pricing.js'
import { buildParams } from '../../../src/lib/term-pricing-settings.js'
// TP_CAPEX (C-11): the milestone names, defined once and shared with Commercials.
import { MILESTONE_NAMES } from '../../../src/lib/milestone-vocabulary.js'

export const TERM_PRICING_KEY = ['term-pricing'] as const

// v1.5 section 4.5: the ladder's per-camera column divides this product's
// line. The calculator names no product, so the screen says which is the camera.
const PER_CAMERA_PRODUCT = 'safesight'

// TP_TABS: "Air Quality", the mockup's word (html/1/Main.dc.html:56).
// SUPERSEDED, QUOTED NOT DELETED: `{ key: 'air_quality', label: 'AQ' }`.
const PRODUCTS = [
  { key: 'safesight', label: 'SafeSight' },
  { key: 'air_quality', label: 'Air Quality' },
  { key: 'hemir', label: 'HEMIR' },
] as const
const productLabel = (key: string) => PRODUCTS.find((p) => p.key === key)?.label ?? key

// ── SUPERSEDED, QUOTED NOT DELETED (B3, TERM_PRICING_2) ──────────────────
// A4's WHT presets, "0%", "10% gross-up" and "10% borne", are replaced by a
// typed rate and a separate Gross up switch, and (B4) an optional split
// between the hardware and the software-as-a-service lines. TP_TABS (T-3)
// makes the three a choice, None | Single rate | Split.

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
// A share as typed: "80", "33.3", never "80.0" (the mockup's "80%").
const sharePct = (r: { n: bigint; d: bigint }) => `${formatPct(r, 6).replace(/\.?0+$/, '')}%`
const vsAnchor = (saving: { n: bigint; d: bigint }, isAnchor: boolean) => {
  if (isAnchor) return { text: 'list', kind: 'list' }
  const s = formatPct(saving, 1)
  return s.startsWith('-') ? { text: `+${s.slice(1)}%`, kind: 'premium' } : { text: `−${s}%`, kind: 'saving' }
}
const isWhole = (s: string) => /^\d+$/.test(s.trim())
const isDecimal = (s: string) => /^\d+(\.\d+)?$/.test(s.trim())
const monthsText = (from: number, to: number) => (from === to ? `${from}` : `${from} to ${to}`)
const dash = (c: bigint) => (c === 0n ? '-' : money(c))

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
      const clamp = (s: number) => Math.max(min, Math.min(max, Math.floor(s * 4) / 4))
      let size = solve()
      // TP_CAPEX: a tile holds more than its figure, and the rest cannot shrink
      // with it: a label word such as "SUBSCRIPTION", a tag. So with the figure
      // size applied, each tile's WHOLE min-content (measured as the sweep
      // measures it) must fit its width, or the row wraps. A first fix checked
      // only the chip and left a case standing, because the chip was not what
      // failed.
      const contentFits = () => tiles.every((t) => {
        const now = t.getBoundingClientRect().width
        const w = t.style.width
        t.style.width = 'min-content'
        const need = t.getBoundingClientRect().width
        t.style.width = w
        return need <= now + 0.5
      })
      row.style.setProperty('--tp-fig', `${clamp(size)}px`)
      if (size < min || !contentFits()) {
        row.classList.add('tp-figures--wrap')
        size = solve()
      }
      size = clamp(size)
      row.style.setProperty('--tp-fig', `${size}px`)
      // Wrapped, the hairlines follow the grid: a rule under the first row and
      // none at a row's right end, so no line doubles against the card's own
      // border. CSS cannot count columns held in a variable, so the tiles are
      // marked here.
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

// ── TP_CAPEX: THE TAX-DETAIL SCHEDULE FITS ITS PANEL ─────────────────────────
// With "Show tax detail" on, the schedule carries up to nine columns, and how
// wide they run depends on the deal: the CPI, split WHT lines, gross-up and
// GST each widen a column. Fixed breakpoints were tried first (TP_CAPEX) and a
// case nobody had measured beat each one. So the table is FITTED, as TILE_FIT
// fits the tiles: full size when it fits; otherwise the padding narrows first,
// then the figure font steps down until it fits. The floor is 10px; a deal
// that needs less overflows and the sweep reports it. TP_TABS (T-5): the
// default four-column view is NOT fitted and keeps the standard figure size.
function useFittedSchedule(dep: unknown) {
  const ref = useRef<HTMLTableElement | null>(null)
  useLayoutEffect(() => {
    const t = ref.current
    const box = t?.parentElement
    if (!t || !box) return
    const fit = () => {
      const cs = getComputedStyle(box)
      const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      t.classList.remove('tp-schedule--tight')
      t.style.removeProperty('--tp-sched-fig')
      if (t.getBoundingClientRect().width <= room + 0.5) return
      t.classList.add('tp-schedule--tight')
      const td = t.querySelector('td')
      let size = td ? parseFloat(getComputedStyle(td).fontSize) : 13
      while (t.getBoundingClientRect().width > room + 0.5 && size > 10) {
        size = Math.max(10, size - 0.25)
        t.style.setProperty('--tp-sched-fig', `${size}px`)
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    let live = true
    fonts?.ready.then(() => { if (live) fit() }).catch(() => {})
    return () => { live = false; ro.disconnect() }
  }, [dep])
  return ref
}

type Tab = 'pricing' | 'payment' | 'quote'
type CapexAmount = 'hardware' | 'custom'
type CapexStructure = 'hybrid' | 'two_phase'
type WhtMode = 'none' | 'single' | 'split'
interface MilestoneDraft { key: string; month: string; share: string }
const MAX_MILESTONES = 5
// The screen's default Hybrid row, by NAME from the shared vocabulary (C-11).
// The engine never sees a name as a name (Q4): it receives this as a key.
const DEFAULT_MILESTONE: MilestoneDraft = { key: MILESTONE_NAMES[0], month: '0', share: '100' }
const CPI_MODES: Array<{ key: CpiMode; label: string }> = [
  { key: 'none', label: 'None' }, { key: 'published', label: 'Published CPI' }, { key: 'locked', label: 'Locked rate' },
]
const WHT_MODES: Array<{ key: WhtMode; label: string }> = [
  { key: 'none', label: 'None' }, { key: 'single', label: 'Single rate' }, { key: 'split', label: 'Split' },
]
// T-3: "Spread over" quick picks. Screen shortcuts, not pricing parameters
// (C12): the months input takes any whole number from 1 to the term, and the
// default of 12 is the spec's (section 6.2).
const SPREAD_PICKS = [6, 12, 18, 24, 36]
const TABS: Array<{ key: Tab; n: number; label: string }> = [
  { key: 'pricing', n: 1, label: 'Pricing' }, { key: 'payment', n: 2, label: 'Payment terms' }, { key: 'quote', n: 3, label: 'Quote' },
]

// One segmented choice, the estate's `.tp-seg`.
function Seg<K extends string>({ label, options, value, onChoose, testid }: {
  label: string; options: Array<{ key: NoInfer<K>; label: string; disabled?: boolean }>; value: K; onChoose(k: K): void; testid: string
}) {
  return (
    <div className="tp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className={value === o.key ? 'on' : ''} aria-pressed={value === o.key}
          disabled={o.disabled} data-testid={`${testid}-${o.key}`} onClick={() => onChoose(o.key)}>{o.label}</button>
      ))}
    </div>
  )
}

// A Payment terms section: its title and note on the left, its controls right.
function Sec({ title, note, children, testid }: { title: string; note?: string; children: ReactNode; testid: string }) {
  return (
    <section className="tp-sec" aria-label={title} data-testid={testid}>
      <div><div className="tp-sec-title">{title}</div>{note && <div className="tp-small tp-muted tp-sec-note">{note}</div>}</div>
      <div className="tp-sec-body">{children}</div>
    </section>
  )
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

  // T-1: every input lives HERE, in the view, so it survives switching tabs;
  // a tab's panel is rendered only while it is open.
  const [tab, setTab] = useState<Tab>('pricing')
  const [paymentSeen, setPaymentSeen] = useState(false)
  const [showTax, setShowTax] = useState(false)
  // The screen opens on the spec's base case, one SafeSight unit, so the
  // ladder and the price are on screen from the first paint.
  const [units, setUnits] = useState<Record<string, string>>({ safesight: '1', air_quality: '0', hemir: '0' })
  const [term, setTerm] = useState<number>(36)
  const [structure, setStructure] = useState<'opex' | 'capex'>('opex')
  // v1.6 (C-3, Q14): the CPI mode. The rate and the start year are shown for
  // Published and Locked and hidden under None, which ignores them.
  const [cpiMode, setCpiMode] = useState<CpiMode>('none')
  const [escalator, setEscalator] = useState('')
  // B6: the contract year the escalator first applies. The select offers 2 to
  // the term's last year, so a shorter term pulls the choice back inside it
  // (chooseTerm). One value feeds both the select and the engine.
  const [startYear, setStartYear] = useState(2)
  const [gst, setGst] = useState('9')
  // T-3: WHT is None | Single rate | Split. The typed rates are kept while
  // another mode is chosen (blank is 0, the blank-zero rule).
  const [whtMode, setWhtMode] = useState<WhtMode>('none')
  const [whtPct, setWhtPct] = useState('')
  const [grossUp, setGrossUp] = useState(false)
  const [whtHw, setWhtHw] = useState('')
  const [whtSaas, setWhtSaas] = useState('')
  // v1.6 (C-4, C-6): the CAPEX amount and how it is paid. Defaults: Hardware,
  // Milestones (Hybrid), one Contract start row at month 0, 100%; 12 months
  // for Monthly instalments (Two-phase).
  const [capexAmount, setCapexAmount] = useState<CapexAmount>('hardware')
  const [capexCustom, setCapexCustom] = useState('')
  const [capexStructure, setCapexStructure] = useState<CapexStructure>('hybrid')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([DEFAULT_MILESTONE])
  const [recovery, setRecovery] = useState('12')
  // N2: the settings card's own state, held here too so a draft survives a
  // switch of tab (T-1).
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  // TP_BANDS: a reload of the settings refreshes a draft only where it holds no
  // unsaved change, because saving one product's bands (ruling 0.5) now reloads
  // the settings while other edits may be open. SUPERSEDED, QUOTED NOT DELETED:
  // `useEffect(() => { if (data) setDraft(draftFrom(data.settings)) }, [data?.settings])`.
  const seenSettings = useRef<Settings | null>(null)
  useEffect(() => {
    if (!data) return
    const prev = seenSettings.current
    seenSettings.current = data.settings
    setDraft((d) => (d && prev && Object.keys(changesFrom(prev, d)).length ? d : draftFrom(data.settings)))
  }, [data?.settings])
  // TP_BANDS (TB-8): the band editor's product tab and one draft per product,
  // held here so they survive a switch of tab (T-1).
  const [bandProduct, setBandProduct] = useState<string>(PRODUCTS[0].key)
  const [bandDrafts, setBandDrafts] = useState<BandDrafts>({})
  useEffect(() => {
    if (data) setBandDrafts((d) => refreshBandDrafts(d, data.settings))
  }, [data?.settings])
  const chooseTerm = (t: number) => {
    setTerm(t)
    setStartYear((s) => Math.max(2, Math.min(s, lastYearOf(t))))
  }

  const params = useMemo(() => {
    if (!data) return null
    try { return { ok: true as const, p: normaliseParams(buildParams(data.settings, data.costs)) } }
    catch (e) { return { ok: false as const, message: (e as Error).message } }
  }, [data])

  const unitCounts = useMemo(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.key, units[p.key].trim() === '' ? 0 : Number(units[p.key])])),
    [units])
  const badUnits = PRODUCTS.find((p) => units[p.key].trim() !== '' && !isWhole(units[p.key]))

  // v1.6 (C-10), v1.7 (C2): the ladder is the OPEX Base row at every term,
  // from the units alone, whatever the payment basis.
  const ladderResult = useMemo(() => {
    if (!params?.ok || badUnits) return null
    try { return { ladder: termLadder({ units: unitCounts, perCameraProduct: PER_CAMERA_PRODUCT }, params.p) } }
    catch (e) { return { error: (e as Error).message } }
  }, [params, unitCounts, badUnits])

  // T-2, T-6: THE PRICE. The OPEX Base quote at the chosen term, from the
  // units alone, so nothing on Payment terms can move or refuse it. It feeds
  // the Pricing tab, the header strip and the CAPEX Hardware amount.
  const price = useMemo(() => {
    if (!params?.ok) return null
    if (badUnits) return { error: `Units of ${badUnits.label} must be a whole number, 0 or more.` }
    try { return { quote: priceQuote({ units: unitCounts, termMonths: term, paymentStructure: 'opex', cpiMode: 'none' }, params.p) } }
    catch (e) { return { error: (e as Error).message } }
  }, [params, unitCounts, badUnits, term])

  const capex = structure === 'capex'
  const result = useMemo(() => {
    if (!params?.ok || !price || 'error' in price) return null
    const cpiOn = cpiMode !== 'none'
    if (cpiOn && escalator.trim() !== '' && !isDecimal(escalator)) return { error: 'The CPI rate must be a percentage, for example 3.' }
    if (gst.trim() !== '' && !isDecimal(gst)) return { error: 'GST must be a percentage, for example 9.' }
    const whtFields: Array<[string, string]> = whtMode === 'split'
      ? [[whtHw, 'WHT on hardware'], [whtSaas, 'WHT on SaaS']]
      : whtMode === 'single' ? [[whtPct, 'WHT']] : []
    const badWht = whtFields.find(([v]) => v.trim() !== '' && !isDecimal(v))
    if (badWht) return { error: `${badWht[1]} must be a percentage, for example 10.` }
    const blankNull = (v: string) => (v.trim() === '' ? null : v.trim())
    // A whole number goes to the engine as a number; anything else goes as
    // typed, so the ENGINE's refusal (with its own reason) is what shows.
    const whole = (v: string) => (isWhole(v) ? Number(v) : v) as number
    const input = {
      units: unitCounts,
      termMonths: term,
      paymentStructure: structure,
      cpiMode,
      escalatorPct: cpiOn ? blankNull(escalator) : null,
      escalatorStartYear: startYear,
      gstPct: blankNull(gst),
      whtPct: whtMode === 'single' ? blankNull(whtPct) : null,
      whtGrossUp: whtMode !== 'none' && grossUp,
      whtSplit: whtMode === 'split',
      whtHwPct: whtMode === 'split' ? blankNull(whtHw) : null,
      whtSaasPct: whtMode === 'split' ? blankNull(whtSaas) : null,
      ...(capex ? {
        capexAmount,
        // Thousands separators are formatting, not the amount (C-4 keeps the
        // figure itself exactly as entered).
        capexCustom: capexAmount === 'custom' ? capexCustom.replace(/,/g, '').trim() : null,
        capexStructure,
        ...(capexStructure === 'hybrid'
          // T-4: a share not yet typed goes as blank, which the preview
          // reports as "no amount yet" and the quote refuses.
          ? { milestones: milestones.map((m) => ({ key: m.key, month: whole(m.month), sharePct: m.share.trim() })) }
          : { recoveryMonths: whole(recovery) }),
      } : {}),
    }
    try {
      if (!capex) return { quote: priceQuote(input, params.p) }
      // T-4: under CAPEX the allocation preview answers first; a complete
      // allocation carries the quote itself. Over 100%, the QUOTE's refusal
      // is the reason given, so the excess is named in the engine's words.
      const alloc = capexAllocation(input, params.p)
      if (alloc.quote) return { quote: alloc.quote, alloc }
      let refusal: string | null = null
      if (alloc.status === 'over') { try { priceQuote(input, params.p) } catch (e) { refusal = (e as Error).message } }
      return { alloc, refusal }
    } catch (e) {
      // The engine's refusals are written for a person (T17, T18, A3, G-C4).
      return { error: (e as Error).message }
    }
  }, [params, price, unitCounts, term, structure, capex, cpiMode, escalator, startYear, gst, whtMode, whtPct, grossUp, whtHw, whtSaas,
    capexAmount, capexCustom, capexStructure, milestones, recovery])

  const fitKey = useMemo(() => ({ result, tab, showTax }), [result, tab, showTax])
  const figuresRef = useFittedFigures(fitKey)
  const scheduleRef = useFittedSchedule(fitKey)

  if (isError) return <div className="wrap tp-view"><p className="tp-error" role="alert">{(error as Error).message}</p></div>
  if (!data || !params) return <div className="wrap tp-view"><p className="field-note">Loading term pricing...</p></div>

  const p0 = price && 'quote' in price ? price.quote : null
  const ladder = ladderResult && 'ladder' in ladderResult ? ladderResult.ladder : null
  const q: Quote | null = result && 'quote' in result ? result.quote ?? null : null
  const alloc: AllocationPreview | null = result && 'alloc' in result ? result.alloc ?? null : null
  const plan = q?.capex ?? null
  const rateShown = escalator.trim() === '' ? '0' : escalator.trim()
  const upliftShown = !!q && q.cpiUpliftCents !== 0n
  const hardwareValueCents = p0?.hardwareValueCents ?? null
  const anchorTerm = params.ok ? params.p.anchorTerm : 36

  // T-4 and T-3: the quote is READY when it prices. Otherwise one reason,
  // named, on the readiness card and on the blocked Next and Quote tab.
  const blankRow = capex && capexStructure === 'hybrid' ? milestones.findIndex((m) => m.share.trim() === '') : -1
  const notReady: string | null = !params.ok ? `The settings cannot be priced: ${params.message}`
    : !p0 ? (price && 'error' in price && price.error) || 'Enter at least one unit.'
    : result && 'error' in result ? result.error ?? 'The quote cannot be priced.'
    : alloc?.status === 'over' ? (result && 'refusal' in result && result.refusal) || 'The milestone shares total more than 100%.'
    : alloc && alloc.status === 'incomplete'
      ? (alloc.unallocated.cents > 0n || alloc.unallocated.share.n > 0n
        ? `Allocate the remaining ${sharePct(alloc.unallocated.share)} (${money(alloc.unallocated.cents)}) of CAPEX to a milestone.`
        : `Enter a share for row ${blankRow + 1}, or remove it.`)
    : null
  const ready = !notReady && !!q
  const pricingDone = !!p0
  const paymentDone = ready && paymentSeen
  const go = (t: Tab) => {
    if (t === 'quote' && !ready) return
    if (t === 'payment' || tab === 'payment') setPaymentSeen(true)
    setTab(t)
  }

  // D4 (John, 2026-10-06), N8: the schedule's subtitle states the treatment.
  const rateText = (v: string) => (v.trim() === '' ? '0' : v.trim())
  const treatment = grossUp ? 'grossed up' : 'borne'
  const whtTitle = whtMode === 'split'
    ? `, split WHT ${rateText(whtHw)}% hardware / ${rateText(whtSaas)}% SaaS, ${treatment}`
    : whtMode === 'single' && isDecimal(whtPct) && Number(whtPct) > 0 ? `, WHT ${whtPct.trim()}% ${treatment}` : ''
  const cpiText = `CPI ${cpiMode === 'locked' ? 'locked' : 'published'} ${rateShown}% from year ${startYear}`
  const cpiTitle = q && upliftShown ? `, ${cpiText}` : ''

  const setRow = (i: number, patch: Partial<MilestoneDraft>) => setMilestones(milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const usedElsewhere = (i: number, name: string) => milestones.some((m, j) => j !== i && m.key === name)
  const addRow = () => {
    if (milestones.length >= MAX_MILESTONES) return
    const next = MILESTONE_NAMES.find((n) => !milestones.some((m) => m.key === n)) ?? MILESTONE_NAMES[0]
    setMilestones([...milestones, { key: next, month: milestones[milestones.length - 1]?.month ?? '0', share: '' }])
  }
  const chooseCustom = () => {
    // The field starts from the hardware value the first time, so Custom
    // opens on a valid amount rather than on a refusal.
    if (capexCustom.trim() === '' && hardwareValueCents !== null) setCapexCustom(money(hardwareValueCents))
    setCapexAmount('custom')
  }
  const onLadderKey = (e: KeyboardEvent<HTMLTableRowElement>, t: number) => {
    // N1: the ladder row is the term's only selector, so it takes the keyboard.
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseTerm(t) }
  }

  // ── THE THREE PANELS ────────────────────────────────────────────────────

  const pricingPanel = (
    <>
      <div className="tp-grid">
        <div className="tp-main">
          <section className="tp-card tp-units-card" aria-label="Units" data-testid="tp-units">
            <div className="tp-units-row">
              <h2 className="tp-h2 tp-units-head">Units</h2>
              {PRODUCTS.map((p) => (
                <label key={p.key} className="tp-unit">
                  <span>{p.label}</span>
                  <input className="tp-num" inputMode="numeric" data-testid={`tp-units-${p.key}`} value={units[p.key]}
                    onChange={(e) => setUnits({ ...units, [p.key]: e.target.value })} />
                </label>
              ))}
            </div>
          </section>

          {!params.ok && <section className="tp-card"><p className="tp-error" role="alert">The settings cannot be priced: {params.message}</p></section>}
          {price && 'error' in price && <section className="tp-card"><p className="tp-error" role="alert" data-testid="tp-error">{price.error}</p></section>}
          {ladderResult && 'error' in ladderResult && !(price && 'error' in price) && (
            <section className="tp-card"><p className="tp-error" role="alert" data-testid="tp-ladder-error">{ladderResult.error}</p></section>
          )}

          {ladder && (
            <section className="tp-card" aria-label="Choose the term" data-testid="tp-ladder-card">
              <h2 className="tp-h2">Choose the term</h2>
              {/* v1.7 (C2): every column, whatever the payment basis.
                  SUPERSEDED, QUOTED NOT DELETED: v1.6's CAPEX ladder, Term and
                  "OPEX / cam / mo" only (C-10). */}
              <table className="tp-table" data-testid="tp-ladder">
                <thead><tr>
                  <th>Term</th><th>Monthly fee (yr 1)</th><th>SafeSight / cam / mo</th>
                  <th>vs {anchorTerm} months</th><th>Base TCV</th><th>Margin</th>
                </tr></thead>
                <tbody>
                  {ladder.map((r) => {
                    const v = vsAnchor(r.savingVsAnchor, r.isAnchor)
                    const on = r.termMonths === term
                    return (
                      <tr key={r.termMonths} className={`tp-ladder${on ? ' on' : ''}`} tabIndex={0}
                        data-testid={`tp-ladder-${r.termMonths}`} aria-selected={on}
                        onClick={() => chooseTerm(r.termMonths)} onKeyDown={(e) => onLadderKey(e, r.termMonths)}>
                        <td>{r.termMonths} months{on && <span className="tp-tick" aria-hidden="true"> ✓</span>}</td>
                        <td>{money(r.monthlyTotalCents)}</td>
                        <td data-testid={`tp-ladder-percam-${r.termMonths}`}>{r.perCameraCents === null ? '-' : money(r.perCameraCents)}</td>
                        <td className={v.kind === 'saving' ? 'tp-saving' : v.kind === 'premium' ? 'tp-premium' : undefined}>{v.text}</td>
                        <td>{money(r.tcvNetCents)}</td>
                        <td>{pct(r.grossMargin)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="tp-small tp-muted" data-testid="tp-ladder-note">Click a row to quote it. Longer terms lower the monthly fee and raise total profit.</p>
            </section>
          )}

          {p0 && (
            <section className="tp-card" aria-label="Price breakdown" data-testid="tp-breakdown-card">
              <div className="tp-card-head">
                {/* N11: the fees are year 1's, said so when a CPI applies. */}
                <h2 className="tp-h2" data-testid="tp-breakdown-head">Price breakdown · {term} months{cpiMode !== 'none' ? ' · year-1 fees' : ''}</h2>
                <span className="tp-small tp-muted tp-inline">Each band's discount applies only to the units inside it.</span>
              </div>
              {/* v1.7 (C1): every figure on a band row is the engine's.
                  SUPERSEDED, QUOTED NOT DELETED: QUOTE_PANEL's "Pricing by
                  product and band" with its List fee / unit column (N3). */}
              <table className="tp-table tp-lines tp-breakdown" data-testid="tp-breakdown">
                <thead><tr><th>Product</th><th>Band</th><th>Discount</th><th>Units</th><th>Fee / unit / mo</th><th>Monthly</th><th>Base TCV</th><th>Margin</th></tr></thead>
                <tbody>
                  {p0.lines.flatMap((l) => [
                    ...l.bands.map((b, i) => (
                      <tr key={`${l.product}-${b.from}`} data-testid={`tp-band-${l.product}-${b.from}`}>
                        <td>{i === 0 ? productLabel(l.product) : ''}</td>
                        <td>{b.to === null ? `${b.from}+` : `${b.from} to ${b.to}`}</td>
                        <td>{b.discountPct}%</td><td>{b.units}</td><td>{money(b.feeByYear[0])}</td>
                        <td>{money(b.monthlyCents)}</td><td>{money(b.tcvNetCents)}</td><td>{pct(b.grossMargin)}</td>
                      </tr>
                    )),
                    <tr key={l.product} className="tp-subtotal" data-testid={`tp-breakdown-${l.product}`}>
                      <td>{productLabel(l.product)} total</td><td></td><td></td><td>{l.units}</td><td></td>
                      <td>{money(l.monthlyByYear[0])}</td><td>{money(l.tcvNetCents)}</td><td>{pct(l.grossMargin)}</td>
                    </tr>,
                  ])}
                  <tr className="tp-subtotal tp-total" data-testid="tp-breakdown-total">
                    <td>Deal</td><td></td><td></td><td>{p0.lines.reduce((t, l) => t + l.units, 0)}</td><td></td>
                    <td>{money(p0.monthlyTotalCents)}</td><td>{money(p0.tcvNetCents)}</td><td>{pct(p0.grossMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}
        </div>

        <div className="tp-side">
          {p0 && (
            <section className="tp-card tp-price-card" aria-label="The price" data-testid="tp-price">
              <h2 className="tp-h2">The price <span className="tp-tag tp-tag-go" data-testid="tp-approval-tag">Approval</span></h2>
              <div className="tp-label">Base TCV</div>
              <div className="tp-v tp-big" data-testid="tp-p-base">{money(p0.tcvNetCents)}</div>
              <div className="tp-price-grid">
                <div><div className="tp-label">Monthly fee (yr 1)</div><div className="tp-v" data-testid="tp-p-monthly">{money(p0.monthlyTotalCents)}</div></div>
                <div><div className="tp-label">Term</div><div className="tp-v" data-testid="tp-p-term">{term} months</div></div>
                <div><div className="tp-label">Gross profit</div><div className="tp-v" data-testid="tp-p-profit">{money(p0.grossProfitCents)}</div></div>
                <div><div className="tp-label">Margin on price</div><div className="tp-v" data-testid="tp-p-margin">{pct(p0.grossMargin)}</div></div>
              </div>
              {/* N7: the floor status lives here now. */}
              <div className={p0.belowMarginFloor ? 'tp-chip tp-flag' : 'tp-ok tp-floor'} data-testid="tp-p-floor">
                {p0.belowMarginFloor ? `Below the ${formatPct(p0.marginFloor, 1).replace(/\.0$/, '')}% margin floor` : `✓ Above the ${formatPct(p0.marginFloor, 1).replace(/\.0$/, '')}% margin floor`}
              </div>
              <p className="tp-small tp-muted">This is the figure the deal is approved on. Payment terms change when the client pays, never this price.</p>
            </section>
          )}
        </div>
        <div className="tp-next-wrap">
          <button type="button" className="btn-primary tp-next" data-testid="tp-next-pricing" disabled={!pricingDone}
            onClick={() => go('payment')}>Next: Payment terms →</button>
        </div>
      </div>

      <SettingsCard state={data} open={settingsOpen} onToggle={() => setSettingsOpen(!settingsOpen)}
        draft={draft ?? draftFrom(data.settings)} setDraft={setDraft}
        onSaved={() => qc.invalidateQueries({ queryKey: TERM_PRICING_KEY })}
        bands={<BandEditor state={data} product={bandProduct} onProduct={setBandProduct}
          drafts={bandDrafts} setDrafts={setBandDrafts}
          onSaved={(next) => qc.setQueryData([...TERM_PRICING_KEY, navToken], next)} />} />
    </>
  )

  const breakdownHead = capexStructure === 'two_phase' ? 'CAPEX instalment' : 'CAPEX milestone'
  const instalment = alloc && alloc.structure === 'two_phase' ? alloc.rows : null
  const recoveryShown = isWhole(recovery) ? Number(recovery) : null

  const paymentPanel = (
    <div className="tp-grid">
      <div className="tp-main">
        <div className="tp-card tp-terms-card" data-testid="tp-terms">
          <Sec title="Payment basis" note={capex ? undefined : 'How the client pays the price set in Pricing.'} testid="tp-sec-basis">
            <div className="tp-inline-row">
              <Seg<'opex' | 'capex'> label="Payment basis" testid="tp-basis" value={structure} onChoose={setStructure}
                options={[{ key: 'opex', label: 'OPEX' }, { key: 'capex', label: 'CAPEX' }]} />
              {capex && <span className="tp-small tp-muted tp-inline">Part of the price paid earlier from a capital budget; the rest monthly.</span>}
            </div>
            {!capex && <p className="tp-small tp-muted"><b>OPEX</b>: one monthly fee for the whole term. <b>CAPEX</b>: part of the price paid earlier from a capital budget, the rest as a monthly subscription.</p>}
          </Sec>

          {/* T-3: under CAPEX only; ABSENT from the DOM under OPEX. */}
          {capex && (
            <>
              <Sec title="CAPEX amount" note="Default is the hardware value." testid="tp-sec-amount">
                <div className="tp-inline-row">
                  <Seg<CapexAmount> label="CAPEX amount" testid="tp-capex" value={capexAmount}
                    onChoose={(k) => (k === 'custom' ? chooseCustom() : setCapexAmount('hardware'))}
                    options={[{ key: 'hardware', label: `Hardware${hardwareValueCents === null ? '' : ` ${money(hardwareValueCents)}`}` }, { key: 'custom', label: 'Custom' }]} />
                  {capexAmount === 'custom' && (
                    <input className="tp-num tp-money" data-testid="tp-capex-amount" inputMode="decimal" aria-label="CAPEX amount, USD"
                      value={capexCustom} onChange={(e) => setCapexCustom(e.target.value)} />
                  )}
                </div>
                {alloc?.warnings.hardwareFundedCents != null && (
                  <div className="tp-warn" role="note" data-testid="tp-warn-funds">Below hardware cost ({money(alloc.hardwareCostCents)}): Terminus funds {money(alloc.warnings.hardwareFundedCents)} of hardware. The quote is allowed.</div>
                )}
              </Sec>

              <Sec title="How CAPEX is paid" testid="tp-sec-paid"
                note={capexStructure === 'hybrid' ? 'Milestones from the Commercials list.' : 'Spread over a set number of months, alongside the subscription.'}>
                {/* T-3: the term-pricing labels for the existing Two-phase and
                    Hybrid structures; engine names and Commercials' labels are
                    unchanged. */}
                <Seg<CapexStructure> label="How CAPEX is paid" testid="tp-capex" value={capexStructure} onChoose={setCapexStructure}
                  options={[{ key: 'two_phase', label: 'Monthly instalments' }, { key: 'hybrid', label: 'Milestones' }]} />
                {capexStructure === 'hybrid' ? (
                  <>
                    <table className="tp-table tp-milestones" data-testid="tp-milestones">
                      <thead><tr><th>Milestone</th><th>Month</th><th>Share</th><th>Amount</th><th aria-label="Remove"></th></tr></thead>
                      <tbody>
                        {milestones.map((m, i) => {
                          const row = alloc?.rows[i]
                          return (
                            <tr key={i} data-testid={`tp-ms-${i}`}>
                              <td>
                                <select className="tp-num tp-select tp-ms-key" data-testid={`tp-ms-key-${i}`} aria-label={`Milestone ${i + 1}`}
                                  value={m.key} onChange={(e) => setRow(i, { key: e.target.value })}>
                                  {MILESTONE_NAMES.map((n) => <option key={n} value={n} disabled={usedElsewhere(i, n)}>{n}</option>)}
                                </select>
                              </td>
                              <td><input className="tp-num tp-ms-month" inputMode="numeric" data-testid={`tp-ms-month-${i}`} aria-label={`Month of milestone ${i + 1}`}
                                value={m.month} onChange={(e) => setRow(i, { month: e.target.value })} /></td>
                              <td><span className="tp-pct-field"><input className="tp-num tp-ms-share" inputMode="decimal" data-testid={`tp-ms-share-${i}`} aria-label={`Share of milestone ${i + 1}, percent`}
                                value={m.share} onChange={(e) => setRow(i, { share: e.target.value })} /><span className="tp-muted">%</span></span></td>
                              {/* T-4: the amount shows as soon as the share is typed. */}
                              <td data-testid={`tp-ms-amount-${i}`}>{row && row.cents !== null ? money(row.cents) : '-'}
                                {alloc?.status === 'complete' && i === milestones.length - 1 && milestones.length > 1 && <span className="tp-small tp-muted tp-carries"> carries rounding</span>}</td>
                              <td>{milestones.length > 1 && (
                                <button type="button" className="btn-ghost tp-remove" data-testid={`tp-ms-remove-${i}`} aria-label={`Remove ${m.key}`}
                                  onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>✕</button>)}</td>
                            </tr>
                          )
                        })}
                        <tr className="tp-subtotal" data-testid="tp-ms-allocated">
                          <td>Allocated</td><td></td><td>{alloc ? sharePct(alloc.allocated.share) : '-'}</td><td>{alloc ? money(alloc.allocated.cents) : '-'}</td><td></td>
                        </tr>
                        {alloc?.status === 'incomplete' && (alloc.unallocated.cents > 0n || alloc.unallocated.share.n > 0n) && (
                          <tr className="tp-subtotal tp-amber" data-testid="tp-ms-remaining">
                            <td>Still to allocate</td><td></td><td>{sharePct(alloc.unallocated.share)}</td><td>{money(alloc.unallocated.cents)}</td><td></td>
                          </tr>
                        )}
                        {alloc?.status === 'over' && alloc.excess && (
                          <tr className="tp-subtotal tp-amber" data-testid="tp-ms-over">
                            <td>Over 100% by</td><td></td><td>{sharePct(alloc.excess.share)}</td><td>{money(alloc.excess.cents)}</td><td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="tp-inline-row tp-mt">
                      <button type="button" className="btn-ghost tp-add" data-testid="tp-ms-add" disabled={milestones.length >= MAX_MILESTONES}
                        onClick={addRow}>+ Add milestone ({milestones.length} of {MAX_MILESTONES})</button>
                      <span className="tp-small tp-muted tp-inline">Amounts calculate as you type each share.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tp-inline-row tp-mt">
                      <span className="tp-label tp-spread-label">Spread over</span>
                      <Seg label="Spread over" testid="tp-spread" value={String(recoveryShown ?? '')} onChoose={setRecovery}
                        options={SPREAD_PICKS.map((n) => ({ key: String(n), label: String(n), disabled: n > term }))} />
                      <input className="tp-num tp-ms-month" inputMode="numeric" data-testid="tp-capex-recovery" aria-label="Spread over, months"
                        value={recovery} onChange={(e) => setRecovery(e.target.value)} />
                      <span className="tp-small tp-muted tp-inline">months (1 to {term})</span>
                    </div>
                    {instalment && instalment.length > 0 && (
                      <div className="tp-inline-row tp-mt" data-testid="tp-capex-instalments">
                        <span className="tp-v tp-figure">{money(instalment[0].cents as bigint)}</span>
                        <span className="tp-small tp-muted tp-inline">{instalment.length === 1
                          ? 'in month 1'
                          : `a month for months 1 to ${instalment.length - 1} · month ${instalment.length} is ${money(instalment[instalment.length - 1].cents as bigint)} (carries the rounding)`}</span>
                      </div>
                    )}
                  </>
                )}
              </Sec>

              <Sec title="Monthly subscription" note="Calculated: the rest of the price." testid="tp-sec-subscription">
                {alloc ? (
                  <div className="tp-inline-row" data-testid="tp-subscription">
                    <span className="tp-v tp-figure">{money(alloc.baseFeeCents)}</span>
                    <span className="tp-small tp-muted tp-inline" data-testid="tp-subscription-note">({money(alloc.baseTcvCents)} − {money(alloc.capexCents)}) ÷ {term} months · month {term} is {money(alloc.lastBaseFeeCents)}</span>
                  </div>
                ) : <span className="tp-small tp-muted">-</span>}
                {alloc?.warnings.subscriptionBelowHosting && (
                  <div className="tp-warn" role="note" data-testid="tp-warn-hosting">The subscription of {money(alloc.baseFeeCents)} a month is below the deal's monthly hosting cost of {money(alloc.warnings.hostingMonthlyCents)}. The quote is allowed.</div>
                )}
              </Sec>

              <Sec title="Monthly breakdown" note="What the client is invoiced each month." testid="tp-sec-breakdown">
                {alloc?.breakdown && alloc.breakdownTotals ? (
                  <>
                    <table className="tp-table tp-lines" data-testid="tp-monthly">
                      <thead><tr><th>Months</th><th>{breakdownHead}</th><th>Subscription</th><th>Monthly invoice</th></tr></thead>
                      <tbody>
                        {alloc.breakdown.map((r) => (
                          <tr key={r.fromMonth} data-testid={`tp-monthly-${r.fromMonth}`}>
                            <td>{monthsText(r.fromMonth, r.toMonth)}{r.keys.length ? ` · ${r.keys.join(', ')}` : ''}</td>
                            <td>{dash(r.capexCents)}</td><td>{dash(r.subscriptionCents)}</td><td>{money(r.netCents)}</td>
                          </tr>
                        ))}
                        {alloc.status === 'incomplete' && alloc.unscheduledCents !== null && alloc.unscheduledCents > 0n && (
                          <tr className="tp-amber tp-subtotal" data-testid="tp-monthly-unscheduled">
                            <td>Not yet scheduled</td><td>{money(alloc.unscheduledCents)}</td><td></td><td>{money(alloc.unscheduledCents)}</td>
                          </tr>
                        )}
                        <tr className="tp-subtotal tp-total" data-testid="tp-monthly-total">
                          <td>Total</td><td>{money(alloc.breakdownTotals.capexCents)}</td><td>{money(alloc.breakdownTotals.subscriptionCents)}</td><td>{money(alloc.breakdownTotals.netCents)}</td>
                        </tr>
                      </tbody>
                    </table>
                    {/* C4: this breakdown is Base; the invoiced one is on Quote. */}
                    {upliftShown && <p className="tp-small tp-muted" data-testid="tp-monthly-cpi">Base figures, before the annual increase. The invoiced figures, with the CPI, are on Quote.</p>}
                  </>
                ) : <span className="tp-small tp-muted">-</span>}
              </Sec>
            </>
          )}

          <Sec title="Annual increase" testid="tp-sec-cpi"
            note={capex ? undefined : 'CPI uplift on the monthly fee. Never changes the approved price.'}>
            <div className="tp-inline-row">
              <Seg<CpiMode> label="Annual increase" testid="tp-cpi" value={cpiMode} onChoose={setCpiMode} options={CPI_MODES} />
              {cpiMode !== 'none' && (
                <>
                  {/* The placeholder is a value in the field's format, not prose.
                      I6: the disabled select keeps L2's dimmed border. */}
                  <label className="tp-label tp-inline-label">Rate %
                    <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-escalator" value={escalator} onChange={(e) => setEscalator(e.target.value)} />
                  </label>
                  {lastYearOf(term) >= 2 && (
                    <label className="tp-label tp-inline-label">From year
                      <select className="tp-num tp-pct2 tp-select" data-testid="tp-escalator-start" value={startYear}
                        disabled={!(isDecimal(escalator) && Number(escalator) !== 0)}
                        onChange={(e) => setStartYear(Number(e.target.value))}>
                        {Array.from({ length: lastYearOf(term) - 1 }, (_, i) => i + 2).map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </label>
                  )}
                </>
              )}
              {capex && <span className="tp-small tp-muted tp-inline">Applies to the subscription only.</span>}
            </div>
            {!capex && <p className="tp-small tp-muted" data-testid="tp-cpi-note">Published CPI: projected at an assumed rate. Locked rate: a negotiated fixed rate, written into the contract.</p>}
            {cpiMode !== 'none' && lastYearOf(term) < 2 && isDecimal(escalator) && Number(escalator) !== 0 && (
              <p className="tp-small tp-muted" data-testid="tp-escalator-none">A {term}-month term has no year 2, so the CPI has no effect.</p>
            )}
          </Sec>

          <Sec title="Tax" note="Applied to each invoice." testid="tp-sec-tax">
            <div className="tp-tax-grid">
              <span className="tp-label">GST</span>
              <span className="tp-inline-row"><input className="tp-num tp-pct2" data-testid="tp-gst" aria-label="GST, percent" value={gst} onChange={(e) => setGst(e.target.value)} /><span className="tp-small tp-muted tp-inline">%</span></span>
              <span className="tp-label">Withholding tax</span>
              <span className="tp-inline-row">
                <Seg<WhtMode> label="Withholding tax" testid="tp-wht" value={whtMode} onChoose={setWhtMode} options={WHT_MODES} />
                {whtMode === 'single' && (
                  <label className="tp-label tp-inline-label">WHT %
                    <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht" value={whtPct} onChange={(e) => setWhtPct(e.target.value)} />
                  </label>
                )}
                {whtMode === 'split' && (
                  <>
                    <label className="tp-label tp-inline-label">Hardware %
                      <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht-hw" value={whtHw} onChange={(e) => setWhtHw(e.target.value)} />
                    </label>
                    <label className="tp-label tp-inline-label">SaaS %
                      <input className="tp-num tp-pct2" placeholder="0" data-testid="tp-wht-saas" value={whtSaas} onChange={(e) => setWhtSaas(e.target.value)} />
                    </label>
                  </>
                )}
                {whtMode !== 'none' && <Switch id="tp-wht-grossup" on={grossUp} label="Gross up" onToggle={() => setGrossUp(!grossUp)} />}
              </span>
            </div>
            {/* N10: the one rule from the retired Rules card that needs saying
                here, said only when Split is chosen. */}
            {whtMode === 'split' && (
              <p className="tp-small tp-muted" data-testid="tp-split-note">{capex
                ? `Split WHT: hardware rate on CAPEX payments up to the hardware value${hardwareValueCents === null ? '' : ` (${money(hardwareValueCents)})`}; any CAPEX above that, and all subscription, at the SaaS rate.`
                : 'Split WHT: each invoice carries a hardware line and a SaaS line, each with its own rate.'}</p>
            )}
          </Sec>
        </div>
      </div>

      <div className="tp-side">
        <section className="tp-card" aria-label="What the client pays" data-testid="tp-pays">
          <h2 className="tp-h2">What the client pays</h2>
          {!capex ? (
            <>
              <div className="tp-line"><span className="tp-label">{upliftShown ? 'Monthly fee (yr 1)' : 'Monthly fee'}</span><span className="tp-v" data-testid="tp-pays-monthly">{q ? money(q.monthlyTotalCents) : '-'}</span></div>
              <div className="tp-line"><span className="tp-label">Months</span><span className="tp-v">{term}</span></div>
            </>
          ) : (
            <>
              <div className="tp-line"><span className="tp-label">CAPEX</span><span className="tp-v" data-testid="tp-pays-capex">{!alloc ? '-'
                : instalment && instalment.length ? `${money(instalment[0].cents as bigint)} × ${instalment.length}` : money(alloc.capexCents)}</span></div>
              <div className="tp-line"><span className="tp-label">Subscription</span><span className="tp-v" data-testid="tp-pays-subscription">{alloc ? `${money(alloc.baseFeeCents)} × ${term}` : '-'}</span></div>
              {instalment && instalment.length && alloc?.breakdown && alloc.breakdown.length > 1 ? (
                <>
                  <div className="tp-line"><span className="tp-label">Months 1 to {instalment.length}</span><span className="tp-v">{money(alloc.breakdown[0].netCents)}</span></div>
                  {alloc.breakdown.find((r) => r.fromMonth === instalment.length + 1) && (
                    <div className="tp-line"><span className="tp-label">From month {instalment.length + 1}</span><span className="tp-v">{money(alloc.breakdown.find((r) => r.fromMonth === instalment.length + 1)!.netCents)}</span></div>
                  )}
                </>
              ) : null}
            </>
          )}
          <div className="tp-line tp-line-total"><span>Total</span><span className="tp-v" data-testid="tp-pays-total">{q ? money(q.finalTcvCents) : alloc ? money(alloc.baseTcvCents) : '-'}</span></div>
          <p className="tp-small tp-muted" data-testid="tp-pays-note">{q && upliftShown
            ? `Final TCV: Base TCV plus the CPI uplift of ${money(q.cpiUpliftCents)}${cpiMode === 'published' ? ', projected' : ''}.`
            : 'Equals Base TCV: no annual increase applied.'}</p>
        </section>
        {notReady && (
          <section className="tp-card tp-ready" role="note" aria-label="Quote not ready" data-testid="tp-ready">
            <div className="tp-ready-head">Quote not ready</div>
            <p className="tp-small tp-muted" id="tp-ready-reason" data-testid="tp-ready-reason">{notReady}</p>
          </section>
        )}
      </div>
      <div className="tp-next-wrap">
        <button type="button" className="btn-primary tp-next" data-testid="tp-next-payment" disabled={!ready}
          aria-describedby={notReady ? 'tp-ready-reason' : undefined} onClick={() => go('quote')}>Next: Quote →</button>
      </div>
    </div>
  )

  const taxHead = q ? (q.tax.whtBorneCents > 0n ? 'WHT borne' : q.tax.whtCents > 0n ? 'WHT (grossed up)' : 'WHT') : 'WHT'
  const capexNote = (() => {
    if (!plan) return ''
    if (plan.structure === 'two_phase') return `${money(plan.payments[0].cents)} a month, months 1 to ${plan.recoveryMonths}`
    if (plan.payments.length > 1) return `${plan.payments.length} milestones`
    const only = plan.payments[0]
    return `${only.key ?? MILESTONE_NAMES[0]}, month ${only.month}`
  })()

  const quotePanel = q && (
    <>
      {/* T-5: the headline tiles. T-6: Final TCV and the deal value appear
          here only, and only when a CPI is chosen. */}
      <div className="tp-figures tp-quote-tiles" ref={figuresRef} data-testid="tp-figures">
        <div><div className="tp-label">Base TCV <span className="tp-tag tp-tag-go" data-testid="tp-q-approval">Approval</span></div>
          <div className="tp-v tp-lead" data-testid="tp-q-base">{money(q.tcvNetCents)}</div>
          <div className={q.belowMarginFloor ? 'tp-chip tp-flag' : 'tp-small tp-muted'} data-testid="tp-q-margin">Margin {pct(q.grossMargin)}{q.belowMarginFloor ? `, below the ${formatPct(q.marginFloor, 1).replace(/\.0$/, '')}% floor` : ''}</div></div>
        {cpiMode !== 'none' && (
          <div><div className="tp-label">Final TCV {q.cpiMode === 'locked' && <span className="tp-tag tp-tag-go" data-testid="tp-q-deal-tag">Deal value</span>}</div>
            <div className="tp-v" data-testid="tp-q-final">{money(q.finalTcvCents)}</div>
            <div className="tp-small tp-muted" data-testid="tp-q-final-note">{cpiText}{cpiMode === 'published' ? ', projected' : ''}</div></div>
        )}
        {capex && plan && (
          <div><div className="tp-label">CAPEX</div>
            <div className="tp-v" data-testid="tp-q-capex">{money(plan.capexCents)}</div>
            <div className="tp-small tp-muted" data-testid="tp-q-capex-note">{capexNote}</div></div>
        )}
        <div><div className="tp-label">{capex ? 'Subscription (yr 1)' : 'Monthly fee (yr 1)'}</div>
          <div className="tp-v" data-testid="tp-q-monthly">{money(capex && plan ? plan.subscriptionByYear[0] : q.monthlyTotalCents)}</div>
          <div className="tp-small tp-muted">{upliftShown ? `a month, rising ${rateShown}% a year` : 'a month'}</div></div>
        <div><div className="tp-label">Cash in year 1</div>
          <div className="tp-v" data-testid="tp-q-cash1">{money(q.cashYear1Cents)}</div>
          <div className="tp-small tp-muted" data-testid="tp-q-cash1-note">{capex ? `OPEX would be ${money(q.opexCashYear1Cents)}` : 'months 1 to 12, before tax'}</div></div>
      </div>

      <div className={`tp-grid tp-grid-quote${showTax ? ' tp-grid-wide' : ''}`}>
        <section className="tp-card" aria-label="Payment schedule" data-testid="tp-schedule-card">
          <div className="tp-card-head">
            <h2 className="tp-h2">Payment schedule <span className="tp-hint" data-testid="tp-schedule-title">{term} months, {capex ? 'CAPEX' : 'OPEX'}{cpiTitle}{whtTitle}</span></h2>
            <Switch id="tp-tax-detail" on={showTax} label="Show tax detail" onToggle={() => setShowTax(!showTax)} />
          </div>
          {/* T-5: four columns by default at the standard figure size (three
              under OPEX, C3); the switch adds today's tax columns, and only
              that view is fitted to its panel. */}
          <table className={`tp-table tp-lines tp-schedule${showTax ? ' tp-schedule-fit' : ''}`} data-testid="tp-schedule" ref={showTax ? scheduleRef : undefined}>
            <thead><tr>
              <th>Months</th>
              {capex ? <><th>CAPEX</th><th>Subscription</th></> : <th>Monthly fee</th>}
              <th>Invoice</th>
              {showTax && <><th>Invoice (pre-GST)</th><th>GST</th><th>Invoice incl. GST</th><th>{taxHead}</th><th>Terminus receives</th></>}
            </tr></thead>
            <tbody>
              {q.schedule.flatMap((r) => [
                <tr key={`m-${r.fromMonth}`} data-testid={`tp-sched-${r.fromMonth}`}>
                  <td>{monthsText(r.fromMonth, r.toMonth)}</td>
                  {capex ? <><td>{dash(r.capexCents)}</td><td>{dash(r.subscriptionCents)}</td></> : <td>{money(r.netCents)}</td>}
                  <td>{money(r.netCents)}</td>
                  {showTax && <><td>{money(r.invoiceCents)}</td><td>{money(r.gstCents)}</td><td>{money(r.invoiceInclGstCents)}</td>
                    <td>{money(r.whtCents)}</td><td>{money(r.receivedCents)}</td></>}
                </tr>,
                // C-8, Q8, B4: with Split WHT on, an invoice carries a hardware
                // line and a SaaS line, each with its own WHT.
                ...(showTax ? (r.lines ?? []) : []).map((l) => (
                  <tr key={`m-${r.fromMonth}-${l.kind}`} className="tp-band" data-testid={`tp-sched-${r.fromMonth}-${l.kind}`}>
                    <td>{l.kind === 'hardware' ? 'Hardware line' : 'SaaS line'}</td>{capex ? <><td></td><td></td></> : <td></td>}
                    <td>{money(l.netCents)}</td><td>{money(l.invoiceCents)}</td><td>{money(l.gstCents)}</td>
                    <td>{money(l.invoiceInclGstCents)}</td><td>{money(l.whtCents)}</td><td>{money(l.receivedCents)}</td>
                  </tr>
                )),
              ])}
              <tr className="tp-subtotal tp-total" data-testid="tp-sched-total">
                <td>Total</td>
                {capex ? <><td>{money(q.tax.capexCents)}</td><td>{money(q.tax.subscriptionCents)}</td></> : <td>{money(q.tax.netCents)}</td>}
                <td>{money(q.tax.netCents)}</td>
                {showTax && <><td>{money(q.tax.invoicedCents)}</td><td>{money(q.tax.gstCents)}</td><td>{money(q.tax.tcvInclGstCents)}</td>
                  <td>{money(q.tax.whtCents)}</td><td>{money(q.tax.receivedCents)}</td></>}
              </tr>
            </tbody>
          </table>
          <p className="tp-small tp-muted" data-testid="tp-schedule-note">{showTax
            ? 'GST is added on top of each invoice; WHT applies to the invoice before GST. Total incl. GST = invoiced (with any gross-up) + GST.'
            : 'Tax detail adds GST, WHT and the amount received per invoice as extra columns.'}</p>
        </section>

        <section className="tp-card" aria-label="Profit" data-testid="tp-profit-card">
          <h2 className="tp-h2">Profit (on Base TCV)</h2>
          {/* N4 (amended): Product | Base TCV | Gross profit | Margin. Gross
              profit per product stays (John, 2026-10-09); units and cost go. */}
          <table className="tp-table tp-lines" data-testid="tp-profit">
            <thead><tr><th>Product</th><th>Base TCV</th><th>Gross profit</th><th>Margin</th></tr></thead>
            <tbody>
              {q.lines.map((l) => (
                <tr key={l.product} data-testid={`tp-profit-${l.product}`}>
                  <td>{productLabel(l.product)}</td><td>{money(l.tcvNetCents)}</td><td>{money(l.grossProfitCents)}</td><td>{pct(l.grossMargin)}</td>
                </tr>
              ))}
              <tr className="tp-subtotal tp-total" data-testid="tp-profit-total">
                <td>Deal</td><td>{money(q.tcvNetCents)}</td><td>{money(q.grossProfitCents)}</td><td>{pct(q.grossMargin)}</td>
              </tr>
            </tbody>
          </table>
          <div className="tp-line"><span className="tp-label">Gross profit</span><span className="tp-v" data-testid="tp-profit-gross">{money(q.grossProfitCents)}</span></div>
          {/* N5: the WHT Terminus bears, on the Base schedule, and what is
              left; the engine's own figures (Q4), shown when WHT is borne. */}
          {q.base.tax.whtBorneCents > 0n && (
            <>
              <div className="tp-line" data-testid="tp-profit-wht"><span className="tp-label">WHT borne by Terminus (whole deal)</span><span className="tp-v">{money(-q.base.tax.whtBorneCents)}</span></div>
              <div className="tp-line" data-testid="tp-profit-after-wht"><span className="tp-label">Gross profit after WHT{q.marginAfterWht ? `, margin ${pct(q.marginAfterWht)}` : ''}</span>
                <span className="tp-v">{money(q.grossProfitCents - q.base.tax.whtBorneCents)}</span></div>
            </>
          )}
          {upliftShown && (
            <div className="tp-line" data-testid="tp-profit-uplift"><span className="tp-label">CPI uplift (not in approval)</span><span className="tp-v">{money(q.cpiUpliftCents)}</span></div>
          )}
        </section>
      </div>
    </>
  )

  return (
    <div className="wrap tp-view" data-testid="term-pricing">
      {/* T-1: the header strip, on every tab. */}
      <div className="tp-head">
        <div>
          <h1>Term Pricing</h1>
          <p className="tp-small tp-muted tp-head-sub" data-testid="tp-head-sub">{params.ok ? params.p.currency : ''} before tax</p>
        </div>
        <div className="tp-head-figs">
          <div><div className="tp-label">Base TCV</div><div className="tp-v" data-testid="tp-head-base">{p0 ? money(p0.tcvNetCents) : '-'}</div></div>
          <div><div className="tp-label">Payment basis</div><div className="tp-head-basis" data-testid="tp-head-basis">{capex ? 'CAPEX' : 'OPEX'}</div></div>
        </div>
      </div>

      <div className="tp-tabs" role="tablist" aria-label="Term pricing">
        {TABS.map((t) => {
          const on = tab === t.key
          const done = !on && (t.key === 'pricing' ? pricingDone : t.key === 'payment' ? paymentDone : false)
          const blocked = t.key === 'quote' && !ready
          return (
            // "Done" is said in the tab's accessible name, not in hidden text:
            // a visually-hidden span still sits under the tick, and the overlap
            // sweep's first run counted it as ink there at every width.
            <button key={t.key} type="button" role="tab" id={`tp-tab-${t.key}`} aria-selected={on} aria-controls="tp-panel"
              aria-label={done ? `${t.label}, done` : undefined}
              aria-disabled={blocked || undefined} title={blocked && notReady ? notReady : undefined}
              className={`tp-tab${on ? ' on' : ''}${done ? ' done' : ''}${blocked ? ' blocked' : ''}`}
              data-testid={`tp-tab-${t.key}`} onClick={() => go(t.key)}>
              <span className="tp-tab-num" aria-hidden="true">{done ? '✓' : t.n}</span>{t.label}
            </button>
          )
        })}
      </div>

      <div id="tp-panel" role="tabpanel" aria-labelledby={`tp-tab-${tab}`} data-testid={`tp-panel-${tab}`}>
        {tab === 'pricing' && pricingPanel}
        {tab === 'payment' && paymentPanel}
        {tab === 'quote' && (quotePanel || (
          <section className="tp-card tp-ready" role="note" data-testid="tp-ready"><div className="tp-ready-head">Quote not ready</div>
            <p className="tp-small tp-muted">{notReady}</p></section>
        ))}
      </div>
    </div>
  )
}


// ── SETTINGS: collapsed by default (Q5); editable only by an admin (R-TP6) ──
// N2: at the bottom of the Pricing tab. The draft lives in the view (T-1).

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
  // TP_BANDS (ruling 0.5): the four band discount boxes retire; bands are edited
  // in the band editor only. SUPERSEDED, QUOTED NOT DELETED:
  // `(s.VOLUME_BANDS as ...).forEach((b, i) => { d[\`BAND.${i}\`] = b.discountPct })`.
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
  return out
}

function SettingsCard({ state, open, onToggle, onSaved, draft, setDraft, bands }: {
  state: ServerState; open: boolean; onToggle: () => void; onSaved: () => void; draft: Draft; setDraft: (d: Draft) => void
  bands: ReactNode
}) {
  const shell = useShell()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

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
            </div>
          </div>
          {message && <p className={message.kind === 'error' ? 'tp-error' : 'tp-small'} role={message.kind === 'error' ? 'alert' : 'status'} data-testid="tp-settings-message">{message.text}</p>}
          {admin && (
            <div className="tp-save-row">
              <button type="button" className="btn-primary" data-testid="tp-settings-save" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving...' : 'Save settings'}</button>
            </div>
          )}
          {bands}
        </div>
      )}
    </section>
  )
}


// ── VOLUME DISCOUNT BANDS: the per-product editor (TP_BANDS, spec v1.8) ────
//
// Built to prototypes/term-pricing-bands/term-pricing-bands.html: 4a (lines
// 28-90, six bands and a floor breach) and 4b (lines 114-145, a rule broken
// while typing). Content, rules and behaviour are binding; type and colour are
// the estate's tokens, as every Term Pricing surface (C13).
//
// TB-6: the rules are the ENGINE'S validateBands, run as the admin types; the
// server runs the same function and is the authority. TB-7: the margin check
// and the fee table are the engine's bandMarginGrid on the bands AS TYPED; this
// screen does no arithmetic on money. Ruling 0.5: Save bands saves the shown
// product's bands only. Ruling 0.7: a non-admin reads the same editor, disabled.
//
// NOT BUILT (ruling 0.4): 4b's "How bands differ by product (example)" card.

interface BandRow { from: string; discountPct: string }
interface StoredBand { from: number; discountPct: string }
type BandDrafts = Record<string, { rows: BandRow[]; base: StoredBand[] }>

const storedBands = (s: Settings) => (s.VOLUME_BANDS_BY_PRODUCT ?? {}) as Record<string, StoredBand[]>
/** A stored discount as the editor shows it, to one decimal (mockup 4a: "5.0"). */
const shownDiscount = (t: string) => (/^\d+$/.test(t) ? `${t}.0` : t)
/** A typed discount as it is stored: "5.0" is "5", as the seed writes it. */
const storedDiscount = (t: string) => t.trim().replace(/\.0$/, '')
const rowsFrom = (list: StoredBand[]): BandRow[] => list.map((b) => ({ from: String(b.from), discountPct: shownDiscount(b.discountPct) }))
const sameBands = (rows: BandRow[], list: StoredBand[] | undefined) => !!list && rows.length === list.length
  && rows.every((r, i) => r.from.trim() === String(list[i].from) && storedDiscount(r.discountPct) === storedDiscount(list[i].discountPct))

/** On a reload, a product's draft is refreshed only if it held no unsaved change. */
function refreshBandDrafts(prev: BandDrafts, s: Settings): BandDrafts {
  const out: BandDrafts = {}
  for (const [p, list] of Object.entries(storedBands(s))) {
    const d = prev[p]
    out[p] = d && !sameBands(d.rows, d.base) ? d : { rows: rowsFrom(list), base: list }
  }
  return out
}

const units = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const floorShown = (f: { n: bigint; d: bigint }) => formatPct(f, 1).replace(/\.0$/, '')
const MAX_BANDS_SHOWN = 6

function BandEditor({ state, product, onProduct, drafts, setDrafts, onSaved }: {
  state: ServerState; product: string; onProduct(p: string): void
  drafts: BandDrafts; setDrafts(f: (d: BandDrafts) => BandDrafts): void; onSaved(next: ServerState): void
}) {
  const shell = useShell()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; problems?: string[] } | null>(null)
  const admin = state.isAdmin
  const offered = PRODUCTS.filter((p) => state.costs[p.key] && storedBands(state.settings)[p.key])
  const stored = storedBands(state.settings)[product] ?? []
  const rows = drafts[product]?.rows ?? rowsFrom(stored)
  // The engine sees the discount as it would be STORED ("5.0" is "5"), so the
  // grid's labels read as the mockup's ("2 · 5%"); anything else, "5.25"
  // included, reaches the validator exactly as typed.
  const typed = rows.map((r, i) => ({ from: i === 0 ? '1' : r.from, discountPct: storedDiscount(r.discountPct) }))
  const v = validateBands(typed)
  const grid = useMemo(() => {
    try { return bandMarginGrid(product, typed, buildParams(state.settings, state.costs)) }
    catch (e) { return { ok: false as const, problems: [{ band: null, field: 'count' as const, message: (e as Error).message }] } }
  }, [product, JSON.stringify(typed), state])
  const dirty = !sameBands(rows, stored)
  const name = productLabel(product)

  const setRows = (next: BandRow[]) => {
    setDrafts((d) => ({ ...d, [product]: { rows: next, base: d[product]?.base ?? stored } }))
    setMessage(null)
  }
  const edit = (i: number, k: keyof BandRow, val: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: val } : r)))
  const add = () => setRows([...rows, { from: '', discountPct: rows[rows.length - 1]?.discountPct ?? '0.0' }])
  const remove = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const discard = () => { setDrafts((d) => ({ ...d, [product]: { rows: rowsFrom(stored), base: stored } })); setMessage(null) }

  async function save() {
    if (!admin || !dirty || !v.ok || saving) return
    setSaving(true)
    const bands = typed.map((b) => ({ from: b.from.trim(), discountPct: storedDiscount(b.discountPct) }))
    const r = await shell.api<ServerState & { error?: string; problems?: Array<{ message: string }> }>(
      'PUT', `/api/term-pricing/bands/${product}`, { bands })
    setSaving(false)
    if (!r.ok) {
      setMessage({ kind: 'error', text: r.data?.error ?? `The bands were not saved (${r.status ?? 'network'}).`,
        problems: r.data?.problems?.map((p) => p.message) })
      return
    }
    // The route answers with the state AFTER the write, so the screen takes it
    // as the stored state at once. Waiting for a refetch left the draft
    // compared with the bands it had just replaced, and Save and Discard read
    // enabled for that moment (found by probe-bands.mjs --admin).
    const saved = r.data?.settings ? storedBands(r.data.settings)[product] : undefined
    if (saved) setDrafts((d) => ({ ...d, [product]: { rows: rowsFrom(saved), base: saved } }))
    setMessage({ kind: 'ok', text: `Saved. Every quote priced from now on uses these ${name} bands.` })
    if (r.data?.settings) onSaved(r.data)
  }

  const problemAt = (i: number, field: string) => v.problems.some((p) => p.band === i + 1 && p.field === field)
  const fix = <div className="tp-small tp-muted tp-bands-fix">Fix the band rules to see the margin check.</div>
  const shownErrors = message?.kind === 'error' ? (message.problems?.length ? message.problems : [message.text]) : v.problems.map((p) => p.message)

  return (
    <section className="tp-bands" aria-label="Volume discount bands" data-testid="tp-bands">
      <div className="tp-bands-head">
        <div>
          {admin && <div className="tp-small tp-muted" data-testid="tp-bands-eyebrow">Term Pricing · Settings · Admin edits</div>}
          <h3 className="tp-h2">Volume discount bands</h3>
        </div>
        {admin && (
          <div className="tp-bands-actions">
            <button type="button" className="btn-ghost" data-testid="tp-bands-discard" disabled={!dirty || saving} onClick={discard}>Discard</button>
            <button type="button" className="btn-primary" data-testid="tp-bands-save" disabled={!dirty || !v.ok || saving} onClick={save}>{saving ? 'Saving...' : 'Save bands'}</button>
          </div>
        )}
      </div>
      {!admin && <p className="tp-small tp-muted" data-testid="tp-bands-readonly">Only an admin can change these.</p>}

      <div className="tp-inline-row tp-bands-product">
        <span className="tp-label tp-inline-label">Product</span>
        <Seg<string> label="Product" testid="tp-bands-product" value={product} onChoose={(p) => { onProduct(p); setMessage(null) }}
          options={offered.map((p) => ({ key: p.key, label: p.label }))} />
        <span className="tp-small tp-muted">Each product has its own bands. A band's discount applies only to the units inside it.</span>
      </div>

      <div className="tp-settings-grid tp-bands-grid">
        <div data-testid="tp-bands-editor">
          <div className="tp-sec-title">{name} bands</div>
          <table className="tp-table tp-bands-table">
            <thead><tr><th>Band</th><th>From</th><th>To</th><th>Discount</th><th aria-label="Remove" /></tr></thead>
            {/* "Remove" is the header's accessible name, not hidden text: a
                visually-hidden span still sits on the page as ink, and the
                overlap sweep's first run counted it over band 3 from 1600. */}
            <tbody>{rows.map((r, i) => {
              const to = v.rows[i]?.to
              return (
                <tr key={i} data-testid={`tp-bed-row-${i + 1}`}>
                  <td>{i + 1}</td>
                  <td>{i === 0
                    ? <span className="tp-v tp-bands-ro" data-testid="tp-bed-from-1">1</span>
                    : <input className="tp-num tp-set-narrow" aria-label={`Band ${i + 1} starts at`} data-testid={`tp-bed-from-${i + 1}`}
                        value={r.from} disabled={!admin} aria-invalid={problemAt(i, 'from') || undefined}
                        onChange={(e) => edit(i, 'from', e.target.value)} />}</td>
                  <td><span className="tp-v tp-bands-ro" data-testid={`tp-bed-to-${i + 1}`}>{to === null ? 'and above' : String(to)}</span></td>
                  <td><span className="tp-pct-field">
                    <input className="tp-num tp-set-narrow" aria-label={`Band ${i + 1} discount`} data-testid={`tp-bed-disc-${i + 1}`}
                      value={r.discountPct} disabled={!admin} aria-invalid={problemAt(i, 'discountPct') || undefined}
                      onChange={(e) => edit(i, 'discountPct', e.target.value)} /> %</span></td>
                  <td>{admin && i > 0 && (
                    <button type="button" className="btn-ghost tp-remove" aria-label={`Remove band ${i + 1}`} data-testid={`tp-bed-remove-${i + 1}`}
                      disabled={rows.length <= 2} onClick={() => remove(i)}>✕</button>
                  )}</td>
                </tr>
              )
            })}</tbody>
          </table>
          {shownErrors.length > 0 && (
            <div className="tp-bands-problems" role="alert" data-testid="tp-bands-problems">
              {shownErrors.map((m, i) => <p key={i} className="tp-error">{m}</p>)}
            </div>
          )}
          {admin && (
            <div className="tp-inline-row tp-mt">
              <button type="button" className="btn-ghost" data-testid="tp-bands-add" disabled={rows.length >= MAX_BANDS_SHOWN} onClick={add}>
                + Add band ({rows.length} of {MAX_BANDS_SHOWN})</button>
              <span className="tp-small tp-muted">You type where each band starts; "To" fills itself in.</span>
            </div>
          )}
          {v.ok && (
            <div className="tp-small tp-muted tp-bands-rules" data-testid="tp-bands-rules">
              Rules checked as you type:<br />
              · Band 1 always starts at 1.<br />
              · Each band starts above the one before it: no gaps, no overlaps.<br />
              · The last band runs to "and above".<br />
              · Discounts never fall as volume rises.<br />
              · 2 to 6 bands.
            </div>
          )}
          {message?.kind === 'ok' && <p className="tp-small" role="status" data-testid="tp-bands-message">{message.text}</p>}
        </div>

        <div className="tp-bands-check">
          <div data-testid="tp-bands-margin">
            <div className="tp-bands-check-head">
              <div className="tp-sec-title">Margin check · worst case per band</div>
              {grid.ok && <span className="tp-small tp-muted">Every unit at that band's fee · floor {floorShown(grid.floor)}%</span>}
            </div>
            {grid.ok ? (
              <>
                <table className="tp-table tp-bands-margins" data-testid="tp-bands-grid">
                  <thead><tr><th>Band</th>{grid.terms.map((t) => <th key={t}>{t}</th>)}</tr></thead>
                  <tbody>{grid.rows.map((r) => (
                    <tr key={r.band} data-testid={`tp-bgrid-row-${r.band}`}>
                      <td>{r.band} · {r.discountPct}%</td>
                      {r.cells.map((c) => (
                        <td key={c.termMonths} data-testid={`tp-bgrid-${r.band}-${c.termMonths}`} data-below={c.belowFloor ? 'true' : undefined}>
                          {c.belowFloor ? <span className="tp-chip tp-flag tp-bands-cell">{formatPct(c.margin, 1)}</span> : formatPct(c.margin, 1)}
                        </td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
                <div className="tp-small tp-muted">Margin on price, %, by term in months.</div>
              </>
            ) : fix}
          </div>
          {grid.ok && grid.breaches.length > 0 && (
            <div className="tp-warn" role="note" data-testid="tp-bands-warn">
              <b>{grid.breaches.length} term{grid.breaches.length === 1 ? ' breaches' : 's breach'} the {floorShown(grid.floor)}% floor.</b>{' '}
              {grid.breaches.map((b) => {
                const row = grid.rows[b.band - 1]
                const range = row.to === null ? `${units(row.from)} units and above` : `${units(row.from)} to ${units(row.to)} units`
                return `Band ${b.band} (${range}, ${row.discountPct}%) at ${b.termMonths} months: fee ${formatMoney(b.feeCents)}, margin ${formatPct(b.margin, 1)}%.`
              }).join(' ')}{' '}
              You can still save. A quote is flagged for approval only when its whole-deal margin falls below the floor.
            </div>
          )}
          <div data-testid="tp-bands-fees">
            <div className="tp-sec-title">Fee per unit per month · {name}</div>
            {grid.ok ? (
              <table className="tp-table tp-bands-fee-table" data-testid="tp-bands-fee-table">
                <thead><tr><th>Band</th>{grid.feeTerms.map((t) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>{grid.rows.map((r) => (
                  <tr key={r.band} data-testid={`tp-bfee-row-${r.band}`}>
                    <td>{r.band} · {r.discountPct}%</td>
                    {grid.feeTerms.map((t) => <td key={t} data-testid={`tp-bfee-${r.band}-${t}`}>{formatMoney(r.cells.find((c) => c.termMonths === t)!.feeCents)}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            ) : fix}
          </div>
        </div>
      </div>
    </section>
  )
}
