// ── L1, L2, L3: THE OPEX PANEL'S LAYOUT ─────────────────────────────────
//
// L1 the mode control becomes a labelled slider, the active side in the
// estate green. L2 the recovery radios are ABSENT under OPEX, not disabled,
// with one plain line in their place. L3 is geometry and is proved live.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

declare global { interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> } }

const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin', paymentMode: 'capex',
}
const VALUES: Values = {
  'deal-ssExisting': '20', 'deal-ssNew': '12', 'deal-aqm': '4', 'deal-hemir': '3',
  'deal-duration': '60', 'deal-targetMargin': '30', 'deal-warrantyPct': '2',
}
let host: HTMLElement
const mount = async (ui: Partial<UiState> = {}) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={VALUES} initialUi={{ ...UI, ...ui }} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const el = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no ${id}`); return e }

/* ── L1 IS SUPERSEDED BY F1, AND THE OLD ANCHORS ARE NAMED HERE ──────────
   L1a, L1b and L1d asserted a control that no longer exists: two
   `deal-mode-label-opex` / `deal-mode-label-capex` spans either side of a bare
   track, each carrying `data-active`, with the marking moving on a click.

   F1 (John's walk, 2026-09-25) makes the mode control the factoring toggle:
   one component, one dress, one size, the state named INSIDE the button. The
   flanking labels are what made the two controls different sizes, so they go.

   THE CLAIMS ARE RE-POINTED, NOT DROPPED. Each of the three said something
   worth keeping and says it about the new control below: the mode is legible,
   exactly one mode is shown, and a click moves it. What is genuinely gone is
   the ORDER claim (`OPEX, slider, CAPEX`), because there is no longer anything
   to be between. */
describe('L1, as superseded by F1: the mode control', () => {
  test('L1a: the control names the mode, and there are no flanking labels', async () => {
    await mount()
    expect(must('deal-payment-mode-toggle').textContent!.trim()).toBe('CAPEX')
    expect(el('deal-mode-label-opex')).toBeNull()
    expect(el('deal-mode-label-capex')).toBeNull()
  })

  test('L1b: exactly ONE mode is named, and it is the one in state', async () => {
    await mount()
    expect(must('deal-payment-mode-toggle').textContent!.trim()).toBe('CAPEX')
    await mount({ paymentMode: 'opex' })
    expect(must('deal-payment-mode-toggle').textContent!.trim()).toBe('OPEX')
  })

  test('L1c: it is a switch, keyboard reachable, and names itself', async () => {
    await mount()
    const s = must('deal-payment-mode-toggle')
    expect(s.tagName).toBe('BUTTON')
    expect(s.getAttribute('role')).toBe('switch')
    expect(s.getAttribute('aria-checked')).toBe('false')
    expect((s.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0)
    expect(s.hasAttribute('disabled')).toBe(false)
  })

  test('L1d: clicking it moves the mode and the label together', async () => {
    await mount()
    await act(async () => { must('deal-payment-mode-toggle').click() })
    expect(must('deal-payment-mode-toggle').getAttribute('aria-checked')).toBe('true')
    expect(must('deal-payment-mode-toggle').textContent!.trim()).toBe('OPEX')
  })
})

describe('L2: the recovery radios under OPEX', () => {
  // R-PT3, 2026-09-26: the list is now Two-phase and Hybrid. L2's claim is
  // about CAPEX showing radios at all, against OPEX showing none, and that is
  // untouched; the old anchor read `['single', 'twoPhase', 'hybrid']`.
  test('L2a: under CAPEX the radios are in the DOM', async () => {
    await mount()
    const radios = [...host.querySelectorAll('#deal-structure-toggle [data-structure]')]
      .map((e) => e.getAttribute('data-structure'))
    expect(radios).toEqual(['twoPhase', 'hybrid'])
  })

  test('L2b: under OPEX they are ABSENT, not disabled and not hidden', async () => {
    await mount({ paymentMode: 'opex' })
    // ABSENT is the claim. A hidden or disabled radio still answers a query,
    // still takes a tab stop in some states, and is what this ruling refuses.
    expect(host.querySelector('#deal-structure-toggle')).toBeNull()
    expect(host.querySelectorAll('[data-structure]')).toHaveLength(0)
  })

  // ── AMENDED MID-ROUND, John 2026-09-25: "drop the single phase text line" ─
  //
  // L2 as first ruled put one plain line where the radios had been. The line is
  // dropped: under OPEX the group goes and NOTHING stands in its place. The
  // assertion is kept rather than deleted, because "no radios" and "no
  // replacement either" are two claims and the second is the one a later round
  // could quietly undo.
  test('L2c: and NOTHING stands in their place', async () => {
    await mount({ paymentMode: 'opex' })
    expect(el('deal-opex-recovery-line')).toBeNull()
    expect(host.textContent).not.toContain('Single phase recovery over full term')
  })

  test('L2d: OPEX still prices as single phase with the radios gone', async () => {
    // The radios were the only place the structure was picked, so removing them
    // must not lose the value the payload carries.
    await mount({ paymentMode: 'opex' })
    expect(host.querySelector('#deal-opex-table')).not.toBeNull()
  })
})

// L3's geometry - side by side at 1440, stacked at 1240, tops equal - is the
// live probe's, and `scripts/opex-layout/probe-live.mjs` is where it is read.
describe('L3: which container holds the yearly table', () => {
  // GEOMETRY IS PROVED LIVE and cannot be proved here: jsdom has no layout, so
  // "side by side" and "top-aligned" are the browser probe's to assert.
  //
  // WHAT BELONGS HERE IS THE STRUCTURE, and a silent injection is why it
  // exists. Removing the yearly table from the OPEX row changed nothing in
  // either suite, because the only assertion about it lived in the live probe -
  // so the claim that the two tables are in ONE row had no detector a commit
  // could run.
  test('L3a: under OPEX the yearly table sits in the tables row', async () => {
    await mount({ paymentMode: 'opex' })
    const row = host.querySelector('#deal-opex-tables')
    expect(row).not.toBeNull()
    const slot = row!.querySelector('#deal-opex-year-slot')
    expect(slot, 'the yearly table is not in the row L3 puts it in').not.toBeNull()
    expect(slot!.children.length).toBeGreaterThan(0)
    expect(row!.querySelector('#deal-opex-table')).not.toBeNull()
  })

  test('L3b: and it is NOT also left where it was, which would be two of it', async () => {
    await mount({ paymentMode: 'opex' })
    const old = host.querySelector('#deal-year-schedule')
    expect(old?.children.length ?? 0).toBe(0)
  })

  // ── L3c IS SUPERSEDED BY R-PT2, and its reasoning is left here ─────────
  //
  // It asserted that under CAPEX the yearly table stays in
  // `#deal-top-schedule-row`, which was right when only the OPEX mode had a
  // content column to move it into.
  //
  // R-PT2 gives the panel a left rail and ONE content column, and rules that
  // the money starts at the top of the panel in BOTH modes. So the yearly table
  // moves out of that row under CAPEX too, and `#deal-year-schedule` is left an
  // empty container the schedule row's own layout still counts on.
  //
  // The claim underneath survives and is what this asserts now: the table is
  // rendered, exactly once, in the slot the mode calls for. `payment-rail`'s P6
  // and P7 carry the rest.
  test('L3c: under CAPEX it is in the content column, and rendered once', async () => {
    await mount()
    expect(host.querySelector('#deal-opex-year-slot')).toBeNull()
    expect((host.querySelector('#deal-capex-year-slot')?.children.length ?? 0)).toBeGreaterThan(0)
    // In the CONTENT COLUMN. The panel also renders the schedule into the
    // hybrid slot and hides whichever does not apply, which R-O4 rules
    // deliberate: one derivation, two places to render it.
    expect(host.querySelector('#deal-capex-year-slot')!
      .querySelectorAll('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]'))
      .toHaveLength(1)
  })
})
