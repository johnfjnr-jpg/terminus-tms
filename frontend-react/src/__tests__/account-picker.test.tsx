// ── R1: THE ACCOUNT PICKER ───────────────────────────────────────────────
//
// DERIVED FROM THE BRIEF, not from the component. R1 states: a single
// dropdown filtering per keystroke, replacing the button-spray, with the
// create-new control to the RIGHT of the input. Everything below follows from
// that sentence plus the door constraint Phase 1 measured before building.
import { describe, test, expect, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AccountPicker } from '../leads/AccountPicker'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'

const ACCOUNTS = [
  { id: 'a-1', name: 'Changi Holdings' },
  { id: 'a-2', name: 'Marina Port' },
  { id: 'a-3', name: 'Changi Logistics' },
]
const PATH = '/api/contacts/lead-9/qualify'

let host: HTMLElement
let root: Root
let posts: Array<{ path: string, body: unknown }> = []
let linked = 0
let cancelled = 0
let hold: (() => void) | null = null

const services: ShellServices = shellServices({
  api: (async (_m: string, path: string, body?: unknown) => {
    posts.push({ path, body })
    // A HELD PROMISE, so a second click happens while the first is genuinely
    // outstanding. Without it the re-entrancy guard is never exercised and
    // asserting it would be the tautology Round 4 deleted.
    if (hold) await new Promise<void>((r) => { hold = r })
    return { ok: true, status: 200 }
  }) as ShellServices['api'],
  navigate: vi.fn(), detailLoaded: vi.fn(),
  currentUserEmail: () => 'probe@example.invalid',
  confirmDiscard: (p: () => void) => { p() },
})

const mount = async () => {
  posts = []; linked = 0; cancelled = 0; hold = null
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <ShellProvider services={services}>
        <AccountPicker leadId="lead-9" accounts={ACCOUNTS} submitPath={PATH}
          onLinked={() => { linked++ }} onCancel={() => { cancelled++ }} />
      </ShellProvider>)
  })
}
const $ = (t: string) => host.querySelector(`[data-testid="${t}"]`) as HTMLElement | null
const must = (t: string) => { const e = $(t); if (!e) throw new Error(`no ${t}`); return e }
const type = async (v: string) => {
  const input = must('acct-search-lead-9') as HTMLInputElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, v)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const key = async (k: string) => {
  await act(async () => {
    must('acct-search-lead-9').dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })
}
const options = () => [...host.querySelectorAll('[role="option"]')] as HTMLButtonElement[]

describe('R1: a type-ahead dropdown, not a row of match boxes', () => {
  test('A1 nothing is listed until something is typed', async () => {
    await mount()
    expect($('acct-list-lead-9'), 'the list is open with an empty query').toBeNull()
    expect(options().length).toBe(0)
  })

  test('A2 it filters PER KEYSTROKE, and the list is one listbox', async () => {
    await mount()
    await type('Chang')
    // Both halves: the matches are there AND the non-match is not, so the
    // assertion cannot pass on a list that simply renders everything.
    expect(options().map((o) => o.textContent))
      .toEqual(['Changi Holdings', 'Changi Logistics'])
    expect(must('acct-list-lead-9').getAttribute('role')).toBe('listbox')
    await type('Changi H')
    expect(options().map((o) => o.textContent)).toEqual(['Changi Holdings'])
  })

  test('A3 CREATE IS TO THE RIGHT OF THE INPUT: same row, after it', async () => {
    await mount()
    // A QUERY THAT MATCHES, deliberately. The first version typed 'New Co',
    // which matches nothing, so the list never opened and the last assertion
    // here - that Create is NOT inside the results - was true by absence.
    // Verification 14: an "X is not in Y" needs Y to exist.
    await type('Changi')
    expect(options().length, 'the list must be OPEN for the next claim to mean anything').toBe(2)
    const row = host.querySelector('.acct-picker-row')!
    const kids = [...row.children]
    // jsdom has no geometry, so the DOM contract is asserted here and the
    // PIXELS are asserted in the browser probe at three widths. Both, because
    // neither alone is the claim R1 makes.
    expect(kids.indexOf(must('acct-search-lead-9'))).toBe(0)
    expect(kids.indexOf(must('acct-create-lead-9'))).toBe(1)
    // And it is NOT inside the results, which is where it used to live.
    expect(must('acct-list-lead-9').contains(must('acct-create-lead-9'))).toBe(false)
  })

  test('A4 Create is offered even when something matches', async () => {
    await mount()
    await type('Changi')
    expect(options().length).toBe(2)
    expect(($('acct-create-lead-9') as HTMLButtonElement).disabled).toBe(false)
  })

  test('A5 Create is disabled with nothing typed, rather than vanishing', async () => {
    await mount()
    expect(($('acct-create-lead-9') as HTMLButtonElement).disabled).toBe(true)
    expect(must('acct-create-lead-9').textContent).toBe('Create')
    await type('Willow')
    expect(must('acct-create-lead-9').textContent).toBe('Create "Willow"')
  })

  test('A6 choosing an option posts account_id to the QUALIFY path', async () => {
    await mount()
    await type('Marina')
    await act(async () => { options()[0].click() })
    expect(posts).toEqual([{ path: PATH, body: { account_id: 'a-2' } }])
    expect(linked).toBe(1)
  })

  test('A7 Create posts new_account_name, trimmed', async () => {
    await mount()
    await type('  Willowglen North  ')
    await act(async () => { must('acct-create-lead-9').click() })
    expect(posts).toEqual([{ path: PATH, body: { new_account_name: 'Willowglen North' } }])
  })

  test('A8 Escape cancels the step', async () => {
    await mount()
    await key('Escape')
    expect(cancelled).toBe(1)
  })

  test('A9 arrows move the highlight and Enter picks the highlighted one', async () => {
    await mount()
    await type('Changi')
    await key('ArrowDown')
    expect(options()[0].getAttribute('aria-selected')).toBe('true')
    await key('ArrowDown')
    expect(options()[1].getAttribute('aria-selected')).toBe('true')
    await key('Enter')
    expect(posts).toEqual([{ path: PATH, body: { account_id: 'a-3' } }])
  })

  test('A10 Enter with NOTHING highlighted does not link anything', async () => {
    // This writes an Account onto a lead and then qualifies it. Linking the
    // first match somebody never looked at is the wrong default.
    await mount()
    await type('Changi')
    await key('Enter')
    expect(posts).toEqual([])
  })

  test('A11 THE DOOR: the combobox attributes are on the INPUT and nowhere else', async () => {
    // Measured before building: NON_ACTION_SELECTOR exempts [aria-expanded]
    // and [aria-controls], and the door skips anything that closest()-matches
    // an exemption. An option or a Create button under such an ancestor would
    // stay LIVE on a lead somebody else owns.
    await mount()
    await type('Changi')
    const exempting = '[aria-expanded], [aria-controls]'
    expect(must('acct-search-lead-9').matches(exempting)).toBe(true)
    for (const el of [...options(), must('acct-create-lead-9')]) {
      expect(el.matches(exempting), `${el.dataset.testid} carries an exemption`).toBe(false)
      expect(el.closest(exempting), `${el.dataset.testid} is inside one`).toBeNull()
    }
  })

  test('A12 two clicks in one tick post ONCE', async () => {
    await mount()
    await type('Marina')
    hold = () => {}
    await act(async () => { options()[0].click(); options()[0].click() })
    expect(posts.length).toBe(1)
  })

  test('A13 a refusal shows its reason and does not report success', async () => {
    await mount()
    await type('Marina')
    const orig = services.api
    ;(services as { api: unknown }).api = async () => ({ ok: false, status: 409, data: { error: 'Already qualified.' } })
    await act(async () => { options()[0].click() })
    expect(must('acct-error-lead-9').textContent).toBe('Already qualified.')
    expect(linked).toBe(0)
    ;(services as { api: unknown }).api = orig
  })
})

// ── R3 + R8: THE NOTES HEADER LINE ───────────────────────────────────────
//
// Derived from R3: the title, `LATEST FIRST`, Add note and Discard all on the
// header line, and the constraint that NotesHistory has THREE consumers whose
// structure must not change.
import { NotesHistory } from '../contact/NotesHistory'

const mountNotes = async (props: Record<string, unknown> = {}) => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <NotesHistory notes={[]} onAdd={async () => true} hasDirtyEdits={false}
        onConfirmDiscard={(p: () => void) => { p() }} resetKey="k" {...props} />)
  })
}

describe('R3 + R8: the notes header on one line', () => {
  test('N-R3 given a title, it is the FIRST item on the header row', async () => {
    await mountNotes({ title: 'Notes', actionsInHeader: true })
    const row = must('cd-notes-header-row')
    expect(row.contains(must('cd-notes-title'))).toBe(true)
    expect(row.children[0]).toBe(must('cd-notes-title'))
    expect(must('cd-notes-title').textContent).toBe('Notes')
    // ALL FOUR ON THE LINE, which is what R3 asks for.
    expect(row.contains(must('cd-add-note-btn'))).toBe(true)
    expect(row.querySelector('.label')!.textContent).toBe('Latest first')
  })

  test('N-R3 the header row carries the SHARED header-line class', async () => {
    // The alignment is equal BY CONSTRUCTION: the Summary column uses the same
    // class, so neither column knows about the other's margins.
    await mountNotes({ title: 'Notes', actionsInHeader: true })
    expect(must('cd-notes-header-row').classList.contains('card-col-head')).toBe(true)
  })

  test('N-R3 WITHOUT the prop nothing changes: the frozen surfaces are untouched', async () => {
    // Lead Detail and the Test Bed pass no title. Both halves asserted, so
    // this cannot pass on a component that failed to render at all.
    await mountNotes()
    expect($('cd-notes-title'), 'a title appeared on a surface that asked for none').toBeNull()
    expect(must('cd-notes-header-row').classList.contains('card-col-head')).toBe(false)
    expect(must('cd-notes-header-row').querySelector('.label')!.textContent).toBe('Latest first')
  })

  test('N-R8 the header controls are CLASSED, not browser defaults', async () => {
    // F3: unclassed controls render as white browser defaults on a dark
    // screen. Every assertion the estate writes passes on them, which is why
    // this one is about the CLASS - Verification 7's replacement clause.
    await mountNotes({ title: 'Notes', actionsInHeader: true })
    expect(must('cd-add-note-btn').className).toContain('btn-sm')
    await act(async () => { must('cd-add-note-btn').click() })
    expect(must('cd-note-discard').className).toContain('btn-sm')
  })

  test('N-R4 an empty history renders no sentence, on the card too', async () => {
    await mountNotes({ title: 'Notes', actionsInHeader: true })
    expect($('cd-notes-empty')).toBeNull()
    expect(must('cd-notes-list').children.length).toBe(0)
  })
})
