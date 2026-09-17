// ── TEST BED UNITS PHASE 1 (R1): A READ NEVER WRITES ────────────────────
//
// Opening the Installation and Commissioning tab used to POST /units/derive and
// create unit records (audit R1, reproduced live in Phase 0 P0.4: 0 -> 3 units
// with no click inside the tab). Deriving is the button's job alone.
//
// Through the REAL host, driven by the routes' own answers captured by
// scripts/testbed-units/capture-units.mjs: a bed with counts set, its empty units
// list, the derive answer, and the units list after. Every call the host makes is
// recorded, so "no write" is an assertion about requests, not about a callback.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import UNITS from './fixtures/units-live.json'
import SCORING from './fixtures/scoring-live.json'

const BED = UNITS.bedWithCounts as unknown as { id: string, owner_id: string, payload: Record<string, unknown> }
const INSTALL = 'Installation and Commissioning'

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const mount = async () => {
  const calls: Array<{ method: string, path: string }> = []
  let derived = false
  const api = (async (method: string, path: string) => {
    calls.push({ method, path })
    if (method === 'POST' && path === `/api/test-beds/${BED.id}/units/derive`) {
      derived = true
      return { ok: true, status: UNITS.derive.status, data: UNITS.derive.body }
    }
    if (path === `/api/test-beds/${BED.id}/units`) return { ok: true, status: 200, data: derived ? UNITS.unitsAfter : UNITS.unitsBefore }
    if (path === `/api/test-beds/${BED.id}`) return { ok: true, status: 200, data: BED }
    if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: SCORING.stageDefinitions }
    if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api']
  const services = shellServices({ currentUserId: () => BED.owner_id, api })
  act(() => { root.render(<ShellProvider services={services}><TestBedHost bed={BED as never} /></ShellProvider>) })
  await settle()
  return calls
}
const openInstall = async () => {
  await act(async () => { $(`tb-tab-btn-stage-${INSTALL}`)!.click() })
  await settle()
}
const writes = (calls: Array<{ method: string }>) => calls.filter((c) => c.method !== 'GET')

describe('R1: a read never writes', () => {
  test('opening the Installation tab sends NO write, and derive never fires', async () => {
    const calls = await mount()
    const before = calls.length
    await openInstall()
    // Both halves (Verification 14): the tab really opened and the units pane
    // really read the empty list, so the absence of a write is an absence from
    // a surface that could have made one.
    expect($('tb-stage-install-section')?.hidden, 'the install section did not open').toBe(false)
    expect(calls.slice(before).some((c) => c.method === 'GET'), 'opening the tab read nothing').toBe(true)
    expect(calls.filter((c) => c.path.endsWith('/units/derive')), 'opening the tab POSTed /units/derive').toHaveLength(0)
    expect(writes(calls), 'opening the tab sent a write').toHaveLength(0)
    expect($('tb-units-sub')?.textContent).toContain('3 planned, 0 built')
  })

  test('the tab offers the button when a count exceeds its units, and nothing is created yet', async () => {
    await mount()
    await openInstall()
    expect($('tb-units-derive')?.textContent).toBe('Create the missing units')
    expect($('tb-units-correction-text')?.textContent).toContain('3 units planned')
    expect($('tb-units-empty')).not.toBeNull()
  })

  test('the BUTTON derives: exactly one derive POST, and the pane shows the units the route returned', async () => {
    const calls = await mount()
    await openInstall()
    await act(async () => { $('tb-units-derive')!.click() })
    await settle()
    const derives = calls.filter((c) => c.method === 'POST' && c.path === `/api/test-beds/${BED.id}/units/derive`)
    expect(derives, 'the button did not derive exactly once').toHaveLength(1)
    expect(writes(calls)).toHaveLength(1)
    expect($('tb-units-sub')?.textContent).toContain(`3 planned, ${UNITS.unitsAfter.length} built`)
  })
})
