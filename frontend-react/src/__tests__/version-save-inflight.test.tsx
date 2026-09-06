// ── FINDING 1: THE BOX BELONGS TO THE NEXT VERSION AT SUBMIT ────────────
//
// Round 4, Phase 3. `onSave` runs a refusal check, a freeze that SAVES the
// deal, a POST and then a full refetch, and the card cleared the box only
// after all of it. For that whole chain the box held the reason that had just
// been sent, so a person starting the next one typed on top of it, and the
// trailing clear then wiped whatever they had typed.
//
// Measured on the real screen before the fix, six saves on one page with the
// reason state logged: a cycle began at 53 characters rather than 0, and the
// state dropped to 0 MID-TYPING twice. 0, 5, 24, 38, 44 and 46 characters
// survived where 52 were typed.
//
// THE FIX IS THE CLEAR'S POSITION, not a lock on the box. An earlier shape
// disabled the box for the duration, and calibration killed it: with the box
// disabled the only assertion that could fail was the one asserting the box
// was disabled, and it drops a person's keystrokes rather than keeping them.
//
// These tests hold the save OPEN, which is the only way to observe a state
// that exists solely while a promise is pending.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { VersionCard } from '../versions/VersionCard'
import { aVersion, resetVersionIds } from './version-fixtures'

let host: HTMLElement
let currentRoot: Root

const mount = async (p: {
  onSave?: (reason: string) => Promise<void> | void
  versions?: ReturnType<typeof aVersion>[]
} = {}) => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  currentRoot = createRoot(host)
  await act(async () => {
    currentRoot.render(
      <VersionCard
        versions={p.versions ?? []}
        pending={null}
        gateApplies
        onSave={p.onSave ?? (() => {})}
        onIssue={() => {}}
        onRestore={() => {}}
        onAsk={() => {}} />,
    )
  })
}
const must = (id: string) => {
  const e = host.querySelector(`#${id}`) as HTMLElement | null
  if (!e) throw new Error(`no #${id}`)
  return e
}
const box = () => must('deal-version-reason') as HTMLTextAreaElement
const btn = () => must('btn-save-version') as HTMLButtonElement
const type = async (v: string) => {
  await act(async () => {
    const t = box()
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!
      .set!.call(t, v)
    t.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
/** A save that does not settle until the test says so. */
const heldSave = () => {
  let release: () => void = () => {}
  let reject: (e: Error) => void = () => {}
  const calls: string[] = []
  const fn = (reason: string) => {
    calls.push(reason)
    return new Promise<void>((res, rej) => { release = () => res(); reject = (e) => rej(e) })
  }
  return { fn, calls, release: () => release(), reject: (e: Error) => reject(e) }
}

beforeEach(() => { resetVersionIds() })

describe('S: a save in flight', () => {
  test('S1: THE BOX IS EMPTY THE MOMENT THE SAVE IS SUBMITTED', async () => {
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the quote of 4 March')
    await act(async () => { btn().click() })

    expect(save.calls, 'the save did not start').toEqual(['the quote of 4 March'])
    expect(box().value, 'THE BOX STILL HELD THE REASON THAT HAD JUST BEEN SENT').toBe('')
    await act(async () => { save.release() })
    expect(box().value, 'the box did not stay empty after a successful save').toBe('')
  })

  test('S2: TEXT TYPED DURING THE SAVE SURVIVES IT', async () => {
    // The defect in the shape a person meets it. Before the fix the clear
    // belonging to the first save arrived after this text was typed and took
    // it with it.
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the first reason, which was submitted')
    await act(async () => { btn().click() })
    await type('the SECOND reason, typed while the first was still saving')
    await act(async () => { save.release() })

    expect(box().value, 'THE CLEAR ATE A REASON IT DID NOT SUBMIT')
      .toBe('the SECOND reason, typed while the first was still saving')
  })

  test('S3: the box stays editable, because a person may start the next one', async () => {
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the quote of 4 March')
    await act(async () => { btn().click() })
    expect(box().disabled, 'the box was locked, so keystrokes are dropped').toBe(false)
    await act(async () => { save.release() })
  })

  test('S4: the button is held, and says what it is doing', async () => {
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the quote of 4 March')
    expect(btn().disabled, 'the button was disabled before any save').toBe(false)

    await act(async () => { btn().click() })
    expect(btn().disabled, 'THE BUTTON STAYED LIVE DURING THE SAVE').toBe(true)
    expect(btn().textContent).toBe('Saving...')

    await act(async () => { save.release() })
    expect(btn().disabled, 'the button was never given back').toBe(false)
    expect(btn().textContent).toBe('Save version')
  })

  test('S5: TWO CLICKS IN ONE TICK take no second version', async () => {
    // The clicks are in ONE act deliberately. Separated by a re-render the
    // button is already disabled and nothing is being tested; in the same tick
    // both handlers run before any state update lands, which is the only case
    // the guard has to answer. A state-based guard cannot: both closures read
    // the same stale `saving === false`. The ref is written synchronously.
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the quote of 4 March')
    await act(async () => { btn().click(); btn().click(); btn().click() })
    expect(save.calls, 'ONE REASON TOOK MORE THAN ONE VERSION').toHaveLength(1)
    await act(async () => { save.release() })
  })

  test('S5b: and the box is cleared once, not once per click', async () => {
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the quote of 4 March')
    await act(async () => { btn().click(); btn().click() })
    expect(save.calls).toEqual(['the quote of 4 March'])
    await type('the next reason, started immediately')
    await act(async () => { save.release() })
    expect(box().value, 'a duplicated save ate the next reason')
      .toBe('the next reason, started immediately')
  })

  test('S6: a refusal gives the reason back, and frees the button', async () => {
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the reason that will be refused')
    await act(async () => { btn().click() })
    expect(box().value, 'the box was not cleared at submit').toBe('')

    await act(async () => { save.reject(new Error('the pricing could not be saved')) })
    expect(box().value, 'a refusal threw away what was typed')
      .toBe('the reason that will be refused')
    expect(btn().disabled, 'a refusal left the button held forever').toBe(false)
    expect(must('deal-version-feedback').textContent).toContain('could not be saved')
  })

  test('S7: a refusal does NOT restore over a reason already being typed', async () => {
    // The refusal's own version of S2. Giving the reason back is right into an
    // untouched box and wrong into one somebody has started using.
    const save = heldSave()
    await mount({ onSave: save.fn })
    await type('the reason that will be refused')
    await act(async () => { btn().click() })
    await type('a different reason, started while the first was in flight')
    await act(async () => { save.reject(new Error('refused by the server')) })

    expect(box().value, 'THE REFUSAL OVERWROTE A REASON SOMEBODY WAS TYPING')
      .toBe('a different reason, started while the first was in flight')
  })

  test('S8: a blank reason refuses without entering the in-flight state', async () => {
    const onSave = vi.fn()
    await mount({ onSave, versions: [aVersion()] })
    await act(async () => { btn().click() })
    expect(onSave, 'a blank reason still wrote').not.toHaveBeenCalled()
    expect(btn().disabled, 'the card held itself for a save it never started').toBe(false)
    expect(btn().textContent).toBe('Save version')
  })
})
