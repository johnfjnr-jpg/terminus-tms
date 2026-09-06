// ── ROUND 5 PHASE 2: THE HOST'S SAVE ────────────────────────────────────
//
// Written because the Phase 2 injection sweep's FOURTH silence named it: an
// injection that added a key to every save changed nothing any test could
// see. The surface tests assert what the panel HANDS to onSave; nothing
// asserted what the host then SENDS. Verification 51.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReferenceHost } from '../reference/ReferenceHost'
import { ShellProvider } from '../ShellContext'
import { SAME_AS_ACCOUNT } from '../reference/descriptors'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let patches: { id: string, body: unknown }[] = []

const OPP = {
  id: 'opp-1',
  payload: { name: 'Changi T5', country: 'Singapore', duration: '36' },
  opportunity_details: { forecast_close_date: '2026-11-30' },
  account: null,
  reference_code: 'TT-SGP-AIRPRT-1',
  status: 'Qualification',
  created_at: '2026-03-04T10:00:00.000Z',
}

const services: ShellServices = {
  api: (async (_m: string, path: string) => {
    if (path.includes('key-contacts')) return { ok: true, status: 200, data: [] }
    if (path.includes('terminus-staff')) return { ok: true, status: 200, data: [{ name: 'Brad Kerr' }] }
    return { ok: true, status: 200, data: OPP }
  }) as ShellServices['api'],
  navigate: vi.fn(), detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
}

const mount = async () => {
  patches = []
  ;(window as unknown as { oppPatch: unknown }).oppPatch = async (id: string, body: unknown) => {
    patches.push({ id, body })
    return { ok: true, status: 200 }
  }
  ;(window as unknown as { loadOpportunityDetail: unknown }).loadOpportunityDetail = () => {}
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<ShellProvider services={services}><ReferenceHost opp={OPP} /></ShellProvider>)
  })
}
const must = (sel: string) => {
  const e = host.querySelector(sel) as HTMLElement | null
  if (!e) throw new Error(`no ${sel}`); return e
}
const editRow = async (name: string, value: string) => {
  await act(async () => { must(`[data-testid="display-${name}"]`).click() })
  await act(async () => {
    const i = must(`[data-testid="input-${name}"]`) as HTMLInputElement
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
      .set!.call(i, value)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const save = async () => { await act(async () => { must('[data-testid="save-all"]').click() }) }

beforeEach(() => { document.body.innerHTML = '' })

describe('H: what the host actually sends', () => {
  test('H1 ONLY WHAT MOVED. An untouched key is never in the payload', async () => {
    await mount()
    await editRow('country', 'Malaysia')
    await save()
    expect(patches).toHaveLength(1)
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(Object.keys(body.payload).sort(),
      'the save carried a key nobody edited').toEqual(['country'])
    expect(body.payload.country).toBe('Malaysia')
  })

  test('H2 a numeric key is sent as a NUMBER, not an input\'s string', async () => {
    await mount()
    await editRow('duration', '48')
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload.duration, 'duration went as a string, which is the '
      + 'defect numeric-payload exists for').toBe(48)
  })

  test('H3 a cleared numeric key is sent as null, never as an empty string', async () => {
    await mount()
    await editRow('duration', '')
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload.duration).toBe(null)
  })

  test('H4 the same-as-account flag is sent as a BOOLEAN, not the string', async () => {
    await mount()
    await act(async () => { must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`).click() })
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload[SAME_AS_ACCOUNT], 'the checkbox\'s string representation '
      + 'reached the payload; the record stores a flag').toBe(true)
  })

  test('H5 A5: estClose is NOT sent through this payload', async () => {
    // It is opportunity_details.forecast_close_date and saves through the
    // close-date-move route, which is the one row whose write is not batched.
    await mount()
    await act(async () => { must('[data-testid="display-estClose"]').click() })
    await act(async () => {
      const i = must('[data-testid="input-estClose"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, '2027-01-31')
      i.dispatchEvent(new Event('change', { bubbles: true }))
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await save()
    if (patches.length) {
      const body = patches[0].body as { payload: Record<string, unknown> }
      expect(Object.keys(body.payload), 'estClose was sent through the generic '
        + 'payload, which is not the route that writes it').not.toContain('estClose')
    }
  })

  test('H6 nothing dirty sends nothing at all', async () => {
    await mount()
    await act(async () => { must('[data-testid="display-country"]').click() })
    await save()
    expect(patches, 'an untouched surface wrote to the record').toHaveLength(0)
  })
})
