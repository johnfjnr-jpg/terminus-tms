// ── THE DOOR, RECORD-READ, ON EVERY DOORED SURFACE ──────────────────────
//
// Round 8 Phase 1. The door reads `owner_id` against the session; the
// `is-not-mine` class survives as PRESENTATION and decides nothing.
//
// FOUR INPUT METHODS, because Round 7's own Phase 0b measured the vanilla door
// as PRESENTATIONAL: the mouse was blocked by CSS and the keyboard was not, so
// a refused row took focus and opened. A door asserted only against a click
// would have passed on that surface.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import { canEditRecord, notMine } from '../../../src/lib/ownership.js'
import { TestBedPanel } from '../testbed/TestBedPanel'
import { ContactPanel } from '../contact/ContactPanel'
import { ReferencePanel } from '../reference/ReferencePanel'
import { AccountView } from '../account/AccountView'

let host: HTMLElement
let root: Root
let ownerId: string | null = 'me'
const VIEWER = 'me'

/** The door as the shell computes it: from the record, never from a class. */
const services = (): ShellServices => shellServices({
  canEditFields: () => canEditRecord(ownerId, VIEWER),
  currentUserId: () => VIEWER,
  api: (async (_m: string, path: string) => {
    if (path.includes('/contacts')) return { ok: true, status: 200, data: [] }
    if (path.startsWith('/api/accounts/')) {
      return { ok: true, status: 200, data: { id: 'a-1', reference_code: 'AC-1', payload: { name: 'Acme' } } }
    }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api'],
})

const render = async (node: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={services()}>{node}</ShellProvider>
      </QueryClientProvider>)
  })
  for (let i = 0; i < 20 && !host.querySelector('.field-row [data-testid^="display-"]'); i++) {
    await act(async () => { await Promise.resolve() })
  }
}

const rows = () => ([...host.querySelectorAll('.field-row [data-testid^="display-"]')] as HTMLElement[])
  .filter((d) => d.closest('[data-readonly="true"]') === null)
const openCount = () => host.querySelectorAll('.field-row [data-testid^="display-"][hidden]').length

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  ownerId = VIEWER
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const SURFACES: Array<{ name: string, node: () => React.ReactNode }> = [
  { name: 'Test Bed', node: () => (
    <TestBedPanel source={{ payload: { name: 'Bed', city: 'KL' }, staff: [] }}
      contacts={[]} buyers={{}} onSave={() => {}} />) },
  { name: 'Contact', node: () => (
    <ContactPanel source={{ payload: { name: 'Ana', email: 'a@b.c' }, industryId: null, industries: [] }}
      blocking={null} accountName={null} onSave={() => {}} />) },
  { name: 'Reference tab', node: () => (
    <ReferencePanel source={{ payload: { name: 'Deal', city: 'KL' }, details: {}, account: null,
      staff: [], reference: 'OP-1', status: 'Qualification', createdAt: null }}
      links={[]} closeMoves={null} oppId="o-1" onSave={() => {}} onChanged={() => {}} />) },
  { name: 'Account', node: () => <AccountView accountId="a-1" navToken={1} /> },
]

describe('the door reads the record, on every consuming surface', () => {
  for (const s of SURFACES) {
    test(`${s.name}: an OWNED record refuses nothing`, async () => {
      ownerId = VIEWER
      await render(s.node())
      expect(rows().length, `${s.name} rendered no rows, so this asserts nothing`)
        .toBeGreaterThan(0)
      await act(async () => { rows()[0].click() })
      expect(openCount(), `${s.name}: the owner could not open a row`).toBeGreaterThan(0)
    })

    test(`${s.name}: an UNOWNED record refuses CLICK, ENTER, SPACE and SEED`, async () => {
      ownerId = 'somebody-else'
      await render(s.node())
      const all = rows()
      expect(all.length, `${s.name} rendered no rows`).toBeGreaterThan(0)

      // The four ways a row opens. Round 7 Phase 0b measured a door that
      // blocked the mouse and not the keyboard, so a click-only assertion
      // would have passed on a surface that was wide open.
      for (const d of all) {
        await act(async () => { d.click() })
        for (const key of ['Enter', ' ', 'x']) {
          await act(async () => {
            d.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
          })
        }
      }
      expect(openCount(), `${s.name}: ${openCount()} rows opened on a record that is not mine`)
        .toBe(0)
    })

    test(`${s.name}: and the door needs NO CLASS to refuse`, async () => {
      // THE PROPERTY THE RULING IS ABOUT. Round 7's defect was a door reading
      // `is-not-mine` whose writer a swap retired: the class was absent and the
      // door read open. Here nothing writes the class at all and the refusal
      // stands, because the answer comes from the record.
      ownerId = 'somebody-else'
      await render(s.node())
      expect(document.querySelector('.is-not-mine'),
        'a class was written, so this test is not measuring its absence').toBeNull()
      const all = rows()
      expect(all.length).toBeGreaterThan(0)
      for (const d of all) await act(async () => { d.click() })
      expect(openCount(),
        `${s.name}: with no is-not-mine class anywhere, ${openCount()} rows opened`)
        .toBe(0)
    })
  }

  test('the shared derivation is what every surface asked', () => {
    // The counterfactual for the whole file: if canEditRecord always answered
    // true, every refusal above would be measuring something else.
    expect(canEditRecord('somebody-else', VIEWER)).toBe(false)
    expect(canEditRecord(VIEWER, VIEWER)).toBe(true)
    expect(notMine(null, VIEWER)).toBe(false)
  })
})
