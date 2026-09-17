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
import { TestBedPanelForTest } from '../testbed/TestBedPanelForTest'
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
        <TestBedPanelForTest source={SRC} onSave={() => {}} />
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
    let examined = 0
    for (const n of NAMES) {
      const d = display(n)
      if (!d) continue
      examined++
      await act(async () => { d.click() })
      if (isOpen(n)) opened++
    }
    // ── W6: THE POPULATION IS ASSERTED, NOT ASSUMED ────────────────────
    //
    // THE HOLE THIS CLOSES, and it was on the REFUSAL side only. D2 above
    // compares its count to NAMES.length, so a row that leaves the surface
    // turns it red. This one counted refusals and compared to ZERO - which
    // is satisfied by examining 27 rows, or 5, or none at all. A row moving
    // off the panel would have shrunk the refusal claim silently while the
    // test went on passing, and the refusal claim is the one that matters:
    // it is the claim that somebody else's record cannot be edited.
    //
    // Verification 17's population clause, and its own remedy moved from a
    // habit into the assertion: take the count first, then assert the rows
    // actually walked equal it.
    //
    // MEASURED BEFORE WRITING THIS, because the brief's premise was that the
    // Summary row had already fallen out of this population, 28 to 27. It
    // had not: all 28 names render a display row and `display-summary` is
    // one of them. The gap was never the count - it was that nothing here
    // could have TOLD you if it had been.
    expect(examined, 'the refusal test walked fewer rows than the surface has, '
      + 'so "nothing opened" is a statement about a population nobody named')
      .toBe(NAMES.length)
    expect(opened, `${opened} of ${examined} rows opened on a record that is not mine`).toBe(0)
  })

  // ── W6: THE SUMMARY ROW, BY NAME AND BY EVERY PATH ──────────────────
  //
  // WHY THIS ROW GETS ITS OWN BLOCK when D4 already covers all 28.
  //
  // D1 and D3 above exercise the four ENTRY PATHS - click, Enter, Space, a
  // seed character - against ONE sampled row, `city`, which is a plain text
  // input in an ordinary card. D2 and D4 cover all 28 rows but by CLICK
  // ALONE. So the crossing of "every path" with "this row" is unexercised
  // for 27 of the 28, and Summary is the one where that matters most:
  //
  //   it is the ONLY textarea among the 28, so it is the only row whose
  //   editor is a different element with a different entry behaviour; and
  //   it now renders in the top band rather than in a `.ref-cards` card,
  //   which is a different container from every row D4's click loop was
  //   written against.
  //
  // It is a WRITE CONTROL on somebody else's record, and the standing
  // instruction is that a write control is not left at "should be
  // protected".
  describe('W6: SUMMARY, the one textarea, on every path', () => {
    for (const [label, fire] of attempts) {
      test(`W6 ${label} is REFUSED on a record that is not mine`, async () => {
        canEdit = false
        await mount()
        const d = display('summary')
        expect(d, 'the Summary row does not render at all, so the refusal below '
          + 'would be true the way "no unicorn is in this room" is true').toBeTruthy()
        await act(async () => { fire(d!) })
        expect(isOpen('summary'),
          `${label} opened the Summary editor on somebody else's record`).toBe(false)
      })
    }

    // THE COUNTERFACTUAL, and without it every assertion above is satisfied
    // by a Summary row that never opens for anyone. Verification 14: an
    // assertion of the form "X is not reachable" needs a companion proving X
    // is reachable somewhere.
    for (const [label, fire] of attempts) {
      test(`W6 ${label} DOES open it on my own record`, async () => {
        canEdit = true
        await mount()
        await act(async () => { fire(display('summary')!) })
        expect(isOpen('summary'),
          `${label} did not open Summary even on my own record, so the refusal `
          + 'above measures a dead row rather than a closed door').toBe(true)
      })
    }

    test('W6 a refused Summary row is not a tab stop, and still READS', async () => {
      // The same pair A12 asserts for `city`. A refused row that keeps its
      // tab stop is a stop in the order that does nothing; a refused row
      // that stops rendering is a record somebody cannot read.
      canEdit = false
      await mount()
      expect(display('summary')!.getAttribute('tabindex'),
        'the refused Summary row is still a tab stop').toBeNull()
      expect(display('summary')!.textContent,
        'the refused Summary row stopped showing its value').toBeTruthy()
    })
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
