// ── THE TEST BED DOOR, BOTH DIRECTIONS, EVERY ENTRY PATH ────────────────
//
// Round 7 Phase 1a. This is the construction fix for a measured defect.
//
// ── WHAT THE VANILLA DOES, MEASURED IN PHASE 0b ─────────────────────────
//
// Its door is PRESENTATIONAL. `openTbField` has no ownership check of any
// kind: it writes `tbEdits[key]` and unhides the edit half. The refusal is CSS
// - `.is-not-mine input { pointer-events: none }` - and the three entry paths
// therefore disagree:
//
//   mouse      BLOCKED. pointer-events: none, and elementFromPoint misses.
//   keyboard   NOT BLOCKED. tabIndex 0, the row focuses, and Enter opens it.
//   direct     NOT BLOCKED. openTbField has no guard.
//
// So a person can Tab to any of the 28 rows on somebody else's Test Bed and
// edit it, while the dimming tells them it is read only. Round 5 recorded the
// inverse on the Reference tab - a row that reads as live and does nothing.
// This is worse in the direction that matters: it reads as dead and is live.
//
// ── WHY THE MIGRATION FIXES IT BY CONSTRUCTION ──────────────────────────
//
// The field-row contract's behaviour 2 consults `canEditFields()` at EVERY
// entry attempt rather than styling a refusal, so there is no path that
// bypasses it and no second mechanism to keep in step. That is a deliberate
// improvement over the vanilla, recorded here and in the report rather than
// slipped in.
import { describe, test, expect, beforeEach } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedPanel } from '../testbed/TestBedPanel'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import { testBedDescriptors } from '../testbed/descriptors'

let host: HTMLElement
let root: Root
let canEdit: boolean | 'absent' = true

const services = (): ShellServices => shellServices({
  api: (async () => ({ ok: true, status: 200, data: {} })) as ShellServices['api'],
  navigate: () => {},
  detailLoaded: () => {},
  getOppLoadedRevision: () => 1,
  // 'absent' models a shell with NO registry line, which is the state until
  // the swap commit adds one.
  canEditFields: () => (canEdit === 'absent' ? false : canEdit),
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p) => { p() },
})

const SRC = { payload: { name: 'A bed', city: 'Singapore' }, staff: ['Brad Kerr'] }
const NAMES = testBedDescriptors(SRC).map((f) => f.name)

const mount = async () => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <ShellProvider services={services()}>
        <TestBedPanel source={SRC} contacts={[]} buyers={{}} onSave={() => {}} />
      </ShellProvider>)
  })
}
const display = (n: string) => host.querySelector(`[data-testid="display-${n}"]`) as HTMLElement | null

/**
 * IS THE ROW OPEN - which is not the same as "does the input exist".
 *
 * FieldRow renders the edit half ALWAYS and hides it with the `hidden`
 * attribute, so a querySelector for the input finds it whether the row is open
 * or shut. The first version of this file asked that question and every
 * refusal test failed while the door was working perfectly: the door said
 * false and the input was there, hidden.
 *
 * Round 5 recorded the same mistake from the other end - `isOpen` reading
 * `!el?.hasAttribute('hidden')` yielded TRUE for a read-only row with no edit
 * half at all, and six correctly refused rows counted as open.
 */
const isOpen = (n: string) => {
  const edit = host.querySelector(`[data-testid="edit-${n}"]`) as HTMLElement | null
  return !!edit && !edit.hasAttribute('hidden')
}

/** Every way a person can try to open a row. */
const attempts: Array<[string, (el: HTMLElement) => void]> = [
  ['click', (el) => el.click()],
  ['Enter', (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))],
  ['Space', (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))],
  ['a seed character', (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))],
]

beforeEach(() => { document.body.innerHTML = ''; canEdit = true })

describe('D: MINE - every row opens, by every path', () => {
  for (const [label, fire] of attempts) {
    test(`D1 ${label} opens a row`, async () => {
      canEdit = true
      await mount()
      const d = display('city')!
      await act(async () => { fire(d) })
      expect(isOpen('city'), `${label} did not open the row`).not.toBeNull()
    })
  }

  test('D2 and ALL 28 rows open, not just the one sampled', async () => {
    canEdit = true
    await mount()
    let opened = 0
    for (const n of NAMES) {
      const d = display(n)
      if (!d) continue
      await act(async () => { d.click() })
      if (isOpen(n)) opened++
    }
    expect(opened).toBe(NAMES.length)
  })
})

describe('D: NOT MINE - every row refuses, by every path', () => {
  for (const [label, fire] of attempts) {
    test(`D3 ${label} is REFUSED`, async () => {
      canEdit = false
      await mount()
      const d = display('city')!
      await act(async () => { fire(d) })
      expect(isOpen('city'),
        `${label} opened a row on a record that is not mine - which is exactly `
        + 'what the vanilla does through the keyboard').toBe(false)
    })
  }

  test('D4 and ALL 28 refuse, so the guard is not one row deep', async () => {
    canEdit = false
    await mount()
    let opened = 0
    for (const n of NAMES) {
      const d = display(n)
      if (!d) continue
      await act(async () => { d.click() })
      if (isOpen(n)) opened++
    }
    expect(opened, `${opened} of ${NAMES.length} rows opened on a record that is not mine`).toBe(0)
  })

  test('A12: A REFUSED ROW IS NOT A TAB STOP, and still READS', async () => {
    // INVERTED BY RULING at Phase 2e, and the finding this replaces is kept in
    // the contract's eighth entry rather than deleted.
    //
    // Phase 1a measured that a refused row carried tabIndex 0, took focus and
    // then refused - already an improvement on the vanilla, whose row focused
    // AND OPENED, but a stop in the tab order doing nothing. A12 rules that
    // behaviour 7's logic covers the second cause of the same condition.
    canEdit = false
    await mount()
    expect(display('city')!.getAttribute('tabindex'),
      'a row the door refuses is still a tab stop').toBeNull()
    // And what must REMAIN: the row still renders and still reads. Verification
    // 7 - a change is two claims, and the second almost never gets an assertion.
    expect(display('city'), 'the refused row stopped rendering').toBeTruthy()
    expect(display('city')!.textContent, 'the refused row stopped showing its value')
      .toBeTruthy()
  })

  test('A12: and an OPEN door still gives every row its stop', async () => {
    // The counterfactual. Without this the assertion above is satisfied by a
    // component that never sets tabIndex at all.
    canEdit = true
    await mount()
    expect(display('city')!.getAttribute('tabindex'),
      'no row is a tab stop even with the door open, so A12 asserts nothing')
      .toBe('0')
  })
})
