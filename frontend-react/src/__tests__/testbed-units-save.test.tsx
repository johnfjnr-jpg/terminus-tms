// ── TEST BED UNITS PHASE 2 (audit B4): THE UNIT SAVE'S CONTRACT ─────────
//
// Every unit save 404'd: the client called /api/units/:unitId, which does not
// exist, wrapped the field in `payload`, which the server does not read, and
// named the field `serial`, which neither side has. Measured live in Phase 0:
// with only the route corrected the server answered 200 and stored nothing.
//
// Through the REAL host, on the routes' own answers captured by
// scripts/testbed-units/capture-units.mjs, with every request recorded, so the
// claims are about what was SENT rather than about a callback.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
// PERF ROUND: production wraps every ShellProvider in a QueryClientProvider
// (main.tsx does, at all five mount points), and this harness did not - so a
// host reading the query client worked in the app and threw here.
// Verification 47: the harness reproduces how production INVOKES the code.
// A FRESH CLIENT PER RENDER, so one test's cached list cannot answer for the
// next, which a shared module-level client would have allowed.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import UNITS from './fixtures/units-live.json'
import SCORING from './fixtures/scoring-live.json'

const BED = UNITS.bedWithCounts as unknown as { id: string, owner_id: string, payload: Record<string, unknown> }
const INSTALL = 'Installation and Commissioning'
const WITH_SERIAL = UNITS.unitsWithSerial as Array<{ id: string, type: string, serialNumber: string | null, revision_number: number | null }>
const UNIT = WITH_SERIAL.find((u) => u.serialNumber) as { id: string, type: string, serialNumber: string, revision_number: number | null }
// The pane opens on the SafeSight tab; the captured serial sits on an Air Quality
// row, so the test opens that row's own type tab. Derived from the unit, not typed.
const TAB_KEY: Record<string, string> = { SafeSight: 'safesightCameras', 'Air Quality': 'airQualitySensors', HEMIR: 'hemirSensors' }

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const mount = async () => {
  const calls: Array<{ method: string, path: string, body?: unknown }> = []
  const api = (async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (path === `/api/test-beds/${BED.id}/units`) return { ok: true, status: 200, data: WITH_SERIAL }
    if (path === `/api/test-beds/${BED.id}`) return { ok: true, status: 200, data: BED }
    if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: SCORING.stageDefinitions }
    if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
    if (method === 'PATCH' && path.includes('/units/')) return { ok: true, status: UNITS.savedSerial.status, data: UNITS.savedSerial.body }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api']
  act(() => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ShellProvider services={shellServices({ currentUserId: () => BED.owner_id, api })}><TestBedHost bed={BED as never} /></ShellProvider></QueryClientProvider>) })
  await settle()
  await act(async () => { $(`tb-tab-btn-stage-${INSTALL}`)!.click() })
  await settle()
  await act(async () => { $(`tb-units-tab-${TAB_KEY[UNIT.type]}`)!.click() })
  await settle()
  return calls
}
const typeSerial = async (unitId: string, value: string) => {
  const input = $(`tb-unit-serial-${unitId}`) as HTMLInputElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    // React's onBlur is delegated from focusout, not from the non-bubbling blur.
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  await settle()
}

describe('B4: the unit save reaches the route the server has', () => {
  test('the row PREFILLS from serialNumber, the key the route returns', async () => {
    await mount()
    expect(($(`tb-unit-serial-${UNIT.id}`) as HTMLInputElement).value).toBe(UNIT.serialNumber)
  })

  test('blurring a typed serial PATCHes /test-beds/:id/units/:unitId with a FLAT serialNumber', async () => {
    const calls = await mount()
    await typeSerial(UNIT.id, 'SN-TYPED')
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches, 'the blur sent no save').toHaveLength(1)
    expect(patches[0].path, 'the save went to a route the server does not have').toBe(`/api/test-beds/${BED.id}/units/${UNIT.id}`)
    expect(patches[0].body).toEqual({ serialNumber: 'SN-TYPED', expected_revision: UNIT.revision_number })
    // The wrap and the old name, each named, because each was its own break and
    // each was answered 200 by the server before R3.
    expect(Object.keys(patches[0].body as object), 'the body is still wrapped').not.toContain('payload')
    expect(Object.keys(patches[0].body as object), 'the body still names serial').not.toContain('serial')
  })

  test('the row reports Saved when the route accepts it', async () => {
    await mount()
    await typeSerial(UNIT.id, 'SN-TYPED')
    expect($(`tb-unit-state-${UNIT.id}`)?.textContent).toBe('Saved')
  })
})
