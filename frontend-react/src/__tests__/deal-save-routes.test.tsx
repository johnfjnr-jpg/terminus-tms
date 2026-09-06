// ── THE THREE SAVE ROUTES ────────────────────────────────────────────────
//
// Found by the Phase 3 walk, and both halves were live defects.
//
//   The section buttons called an `onSave` prop THE MOUNT NEVER PASSED, so
//   every one of them rendered and did nothing.
//   #btn-save-deal sits in .form-actions, OUTSIDE the React root, which the
//   swap deliberately left as static markup so the revert stays one line. The
//   vanilla wired it; React did not. It was permanently disabled.
//
// Together that left the panel with no way to save at all except through the
// version freeze, which reaches the seam by another path.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import type { UiState, Values } from '../deal/payload'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}
const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const V: Values = { 'deal-ssExisting': '40', 'deal-duration': '36', 'deal-targetMargin': '30' }

let host: HTMLElement
let persisted: Record<string, unknown>[]
const mount = async () => {
  persisted = []
  window.api = catalogApi()
  // The button the swap left as STATIC MARKUP, outside the root, exactly as
  // index.html holds it.
  document.body.innerHTML = '<div id="host"></div><div class="form-actions">'
    + '<button id="btn-save-deal" disabled>Save changes</button></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={V} initialUi={UI} testBedCost={0}
            onPersist={async (p) => { persisted.push(p) }} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const saveBtn = () => document.getElementById('btn-save-deal') as HTMLButtonElement
const dirtyIt = async (v = '48') => {
  const el = host.querySelector('[data-testid="deal-duration"]') as HTMLInputElement
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}

describe('the section save', () => {
  test('it PERSISTS, rather than rendering and doing nothing', async () => {
    await mount()
    await dirtyIt()
    const btn = host.querySelector('.section-save') as HTMLButtonElement
    expect(btn, 'no section save appeared, so nothing below is measured').not.toBeNull()
    await act(async () => { btn.click() })
    expect(persisted, 'the section save did not reach onPersist').toHaveLength(1)
  })

  test('and the save re-baselines, so the button goes away', async () => {
    await mount()
    await dirtyIt()
    await act(async () => { (host.querySelector('.section-save') as HTMLButtonElement).click() })
    expect(host.querySelectorAll('.section-save')).toHaveLength(0)
  })
})

describe('#btn-save-deal, which lives outside the React root', () => {
  test('it is DISABLED on a clean form and enabled by an edit', async () => {
    await mount()
    expect(saveBtn().disabled, 'a clean form offered a save').toBe(true)
    await dirtyIt()
    expect(saveBtn().disabled, 'the only thing saying there is anything to save').toBe(false)
  })

  test('and editing back disables it again', async () => {
    await mount()
    await dirtyIt()
    expect(saveBtn().disabled).toBe(false)
    await dirtyIt('36')
    expect(saveBtn().disabled).toBe(true)
  })

  test('clicking it persists, through the SAME path the section save uses', async () => {
    await mount()
    await dirtyIt()
    await act(async () => { saveBtn().click() })
    expect(persisted, 'the panel\'s primary save button did nothing').toHaveLength(1)
    expect(saveBtn().disabled, 'the save did not re-baseline').toBe(true)
  })

  test('the payload sent is the salesperson projection, not the raw payload', async () => {
    await mount()
    await dirtyIt()
    await act(async () => { saveBtn().click() })
    // The catalog rates are READ from the catalog, never written back as
    // per-deal overrides.
    expect(Object.keys(persisted[0])).not.toContain('ssUnitCost')
  })
})

// ── EVERY OWNED KEY REACHES A SECTION ────────────────────────────────────
//
// The gap this closes had no detector at all: eight of the twenty-six owned
// keys resolved to no section, so editing the lump sum cost, a margin override,
// the structure, the invoicing or any milestone row raised NO save button. The
// walk found it; nothing in the suite could have.
describe('the dirty mapping covers the payload', () => {
  test('every COMMERCIALS_OWNED_KEY resolves to a section that exists', async () => {
    const { COMMERCIALS_OWNED_KEYS } = await import('../deal/payload')
    const { sectionForPayloadKey, VANILLA_SECTIONS } = await import('../deal/sections')
    // Section 4 is not latchable and so is not in VANILLA_SECTIONS, but it is a
    // real section and the margin overrides live in it.
    const known = new Set([...VANILLA_SECTIONS.map((s) => s.id), 'deal-section-4'])
    const unmapped = COMMERCIALS_OWNED_KEYS.filter((k) => !sectionForPayloadKey(k))
    expect(unmapped, 'these keys raise no section save when they change').toEqual([])
    for (const k of COMMERCIALS_OWNED_KEYS) {
      expect(known.has(sectionForPayloadKey(k)!), `${k} names an unknown section`).toBe(true)
    }
  })

  test('and the instrument can see an unmapped key at all', async () => {
    const { sectionForPayloadKey } = await import('../deal/sections')
    // Verification 13: the empty list above is only evidence once this has
    // been shown returning null for something.
    expect(sectionForPayloadKey('aKeyNobodyHasEverHeardOf')).toBeNull()
  })
})

// ── THE CUSTOMER MILESTONE ROUND TRIP ────────────────────────────────────
//
// Found by the Phase 3 walk's restore-fidelity check, and it was a live defect:
// readMilestones keeps a row only when usd > 0 and reads usd from VALUES, but
// the customer USD cell was computed for DISPLAY only. A month and a percentage
// typed in, and nothing recorded.
describe('a customer milestone reaches the payload', () => {
  test('typing a percentage writes the dollars into the state, not only the cell', async () => {
    await mount()
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    const put = async (id: string, v: string) => {
      const el = host.querySelector(`[data-testid="${id}"]`) as HTMLInputElement
      expect(el, `no ${id}`).not.toBeNull()
      await act(async () => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
    }
    await put('deal-ms-0-month', '3')
    await put('deal-ms-0-pct', '30')
    const usd = (host.querySelector('[data-testid="deal-ms-0-usd"]') as HTMLInputElement).value
    expect(usd, 'the computed cell is empty, so the row cannot survive the reader').not.toBe('')

    await act(async () => { saveBtn().click() })
    const sent = persisted[0] as { milestones?: unknown[] }
    expect(sent.milestones, 'the milestone never reached the payload').toHaveLength(1)
    expect((sent.milestones![0] as { month: number, pct: number }).month).toBe(3)
    expect((sent.milestones![0] as { month: number, pct: number }).pct).toBe(30)
  })
})
