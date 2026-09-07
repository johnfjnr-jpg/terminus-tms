// ── A12 ACROSS ALL FOUR CONSUMING SURFACES ──────────────────────────────
//
// Round 7 Phase 2e. A12 changes the SHARED field row, so the evidence has to be
// four-surface: the contract's own reason for holding it back was that it
// touches every consumer at once.
//
// It drives the real panels rather than FieldRow alone, because "the row drops
// its tab stop" is a claim about what a person meets on a screen.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import { TestBedPanel } from '../testbed/TestBedPanel'
import { ContactPanel } from '../contact/ContactPanel'
import { ReferencePanel } from '../reference/ReferencePanel'
import { AccountView } from '../account/AccountView'

let host: HTMLElement
let root: Root
let canEdit = true

const services = (): ShellServices => shellServices({
  canEditFields: () => canEdit,
  api: (async (_m: string, path: string) => {
    if (path.includes('/accounts/') && path.endsWith('/contacts')) {
      return { ok: true, status: 200, data: [] }
    }
    if (path.startsWith('/api/accounts/')) {
      return { ok: true, status: 200, data: { id: 'a-1', reference_code: 'AC-1', payload: { name: 'Acme' } } }
    }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api'],
})

const render = async (node: React.ReactNode) => {
  // A fresh client per render: AccountView fetches, and a shared cache would
  // serve the previous test's answer - which is the re-navigation defect this
  // estate has already measured once.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={services()}>{node}</ShellProvider>
      </QueryClientProvider>)
  })
  // Settle the fetch. Waiting on RENDERED ROWS rather than a fixed number of
  // microtasks, per Verification 6 - and the assertions below refuse an empty
  // surface, so a wait that returns early cannot read as a pass.
  for (let i = 0; i < 20 && !host.querySelector('[data-testid^="display-"]'); i++) {
    await act(async () => { await Promise.resolve() })
  }
}

/**
 * Every closed display half a surface renders, EXCLUDING the read-only ones.
 *
 * Behaviour 7 already says a read-only row has no tab stop, and the Reference
 * tab renders five. Counting them would make the door-open assertion fail for
 * a reason that has nothing to do with A12.
 */
const displays = () => ([...host.querySelectorAll('.field-row [data-testid^="display-"]')] as HTMLElement[])
  .filter((d) => d.closest('[data-readonly="true"]') === null)

/** And the read-only ones, so behaviour 7 can be asserted beside A12. */
const readOnlyDisplays = () => ([...host.querySelectorAll('.field-row [data-testid^="display-"]')] as HTMLElement[])
  .filter((d) => d.closest('[data-readonly="true"]') !== null)

/**
 * SCOPED TO `.field-row`, WHICH IS THE COMPONENT A12 CHANGES.
 *
 * The Account's name header is a hand-rolled display half rather than a
 * FieldRow, and Round 2 recorded its MISSING tab stop as a preserved behaviour
 * reported rather than quietly fixed. Counting it made the door-open assertion
 * fail for a reason that has nothing to do with A12 - Verification 33, a
 * measure whose shape decides what it can see. Asserted separately below so the
 * exclusion is a statement rather than a silence.
 */
const handRolled = () => ([...host.querySelectorAll('[data-testid^="display-"]')] as HTMLElement[])
  .filter((d) => d.closest('.field-row') === null)

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const SURFACES: Array<{ name: string, node: () => React.ReactNode }> = [
  {
    name: 'Test Bed',
    node: () => (
      <TestBedPanel source={{ payload: { name: 'Bed', city: 'KL' }, staff: [] }}
        contacts={[]} buyers={{}} onSave={() => {}} />),
  },
  {
    name: 'Contact',
    node: () => (
      <ContactPanel
        source={{ payload: { name: 'Ana', email: 'a@b.c' }, industryId: null, industries: [] }}
        blocking={null} accountName={null} onSave={() => {}} />),
  },
  {
    name: 'Reference tab',
    node: () => (
      <ReferencePanel
        source={{
          payload: { name: 'Deal', city: 'KL' }, details: {}, account: null,
          staff: [], reference: 'OP-1', status: 'Qualification', createdAt: null,
        }}
        links={[]} closeMoves={null} oppId="o-1"
        onSave={() => {}} onChanged={() => {}} />),
  },
  {
    name: 'Account',
    node: () => <AccountView accountId="a-1" navToken={1} />,
  },
]

describe('A12 on all four consuming surfaces', () => {
  for (const s of SURFACES) {
    test(`${s.name}: EVERY row is a tab stop when the door is open`, async () => {
      canEdit = true
      await render(s.node())
      const rows = displays()
      // The counterfactual first. Without it the refusal assertion below is
      // satisfied by a surface that renders no rows at all.
      expect(rows.length, `${s.name} rendered no rows, so this asserts nothing`)
        .toBeGreaterThan(0)
      const without = rows.filter((d) => d.getAttribute('tabindex') !== '0')
      expect(without.map((d) => d.getAttribute('data-testid')),
        `${s.name}: rows are not tab stops with the door OPEN`).toEqual([])
    })

    test(`${s.name}: NO row is a tab stop when the door refuses`, async () => {
      canEdit = false
      await render(s.node())
      const rows = displays()
      expect(rows.length, `${s.name} rendered no rows, so this asserts nothing`)
        .toBeGreaterThan(0)
      const stops = rows.filter((d) => d.getAttribute('tabindex') !== null)
      expect(stops.map((d) => d.getAttribute('data-testid')),
        `${s.name}: these rows are still tab stops on a record that is not mine`)
        .toEqual([])
    })

    test(`${s.name}: behaviour 7's read-only rows are never stops, door or no door`, async () => {
      for (const open of [true, false]) {
        canEdit = open
        await render(s.node())
        // THE ROW, not only its display half. Behaviour 7's variant has no
        // edit half at all, so a stop added to the WRAPPER is invisible to a
        // check that only reads the inner div - which is how the injection
        // that does exactly that came back silent.
        const rowsRO = readOnlyDisplays().map((d) => d.closest('.field-row') as HTMLElement)
        const stops = [...readOnlyDisplays(), ...rowsRO]
          .filter((d) => d && d.getAttribute('tabindex') !== null)
        expect(stops.length,
          `${s.name}: a read-only row is a tab stop with the door ${open ? 'open' : 'shut'}`)
          .toBe(0)
      }
    })

    test(`${s.name}: A12 does not reach hand-rolled displays, and does not claim to`, async () => {
      canEdit = true
      await render(s.node())
      const changed = handRolled().filter((d) => d.getAttribute('tabindex') !== null)
      expect(changed.map((d) => d.getAttribute('data-testid')),
        `${s.name}: A12 gave a tab stop to a display half that is not a FieldRow`)
        .toEqual([])
    })

    test(`${s.name}: and a refused row STILL READS`, async () => {
      // Verification 7: a change is two claims, and the second - what must
      // REMAIN - almost never gets an assertion.
      canEdit = false
      await render(s.node())
      const rows = displays()
      expect(rows.length).toBeGreaterThan(0)
      // NOT textContent: a `hidden` element keeps its text, so an injection
      // that hides every refused row came back silent with zero failures.
      // Verification 17 - the probe fired and could not tell the two apart.
      const unreadable = rows.filter((d) => d.hasAttribute('hidden') || !d.textContent?.trim())
      expect(unreadable.map((d) => d.getAttribute('data-testid')),
        `${s.name}: these refused rows are hidden or empty, so they no longer read`)
        .toEqual([])
    })
  }
})
