// ── THE FIVE CAPABILITIES ────────────────────────────────────────────────
//
// Derived from MIGRATION_CONTACT_CAPABILITIES.md - N1-N9, P1-P9, U1-U3,
// D1-D3, A1-A6 - which was written from the vanilla BEFORE any of this was
// built. The vanilla was not reopened while writing these.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ContactHost } from '../contact/ContactHost'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import { parkNoteText, prepend, note } from '../contact/notes'

let host: HTMLElement
let root: Root
let calls: Array<{ m: string, path: string, body?: unknown }> = []
let reply: Record<string, { ok: boolean, status?: number, data?: unknown }> = {}
let navigated: string[] = []
let discardAsks = 0
let status = 'Unqualified'
let notesOnRecord: Array<{ text: string, at: string, by: string }> = []

const ACCOUNTS = [{ id: 'a-1', payload: { name: 'Changi Holdings' } }]
const RECORD = () => ({
  id: 'c-1',
  payload: { name: 'Ada', company: 'Nowhere Co', notes: notesOnRecord },
  industry_id: null, parent_record_id: null, status,
  account: null, latest_revision_number: 4,
})

const services: ShellServices = shellServices({
  api: (async (m: string, path: string, body?: unknown) => {
    calls.push({ m, path, body })
    for (const [k, v] of Object.entries(reply)) if (path.includes(k)) return v
    if (path.includes('/industries')) return { ok: true, status: 200, data: [] }
    if (path.includes('/accounts')) return { ok: true, status: 200, data: ACCOUNTS }
    if (path.includes('/contacts')) return { ok: true, status: 200, data: [RECORD()] }
    return { ok: true, status: 200, data: {} }
  }) as ShellServices['api'],
  navigate: ((v: string) => { navigated.push(v) }) as ShellServices['navigate'],
  detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p) => { discardAsks++; p() },
})

const mount = async () => {
  calls = []; navigated = []; discardAsks = 0; reply = {}
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<ShellProvider services={services}><ContactHost contact={RECORD()} /></ShellProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const e = $(id); if (!e) throw new Error(`no ${id}`); return e }
const click = async (id: string) => { await act(async () => { must(id).click() }) }
const type = async (id: string, v: string) => {
  await act(async () => {
    const el = must(id) as HTMLInputElement
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const patches = () => calls.filter((c) => c.m === 'PATCH')

beforeEach(() => {
  document.body.innerHTML = ''; status = 'Unqualified'; notesOnRecord = []
})

describe('N: the notes history', () => {
  test('N1 empty says so; a note shows when, who and what, latest first', async () => {
    notesOnRecord = [
      { text: 'older', at: '2026-01-01T00:00:00.000Z', by: 'a@b.c' },
      { text: 'oldest', at: '2025-01-01T00:00:00.000Z', by: 'x@y.z' },
    ]
    await mount()
    expect($('cd-notes-empty')).toBeNull()
    expect(must('cd-note-0').textContent).toContain('older')
    expect(must('cd-note-0').textContent).toContain('a@b.c')
    expect(must('cd-note-1').textContent).toContain('oldest')
  })

  test('N1 an empty history says No notes yet', async () => {
    await mount()
    expect(must('cd-notes-empty').textContent).toBe('No notes yet.')
  })

  test('N2 ONE control: idle it opens, and open-and-empty it is DISABLED', async () => {
    await mount()
    expect($('cd-new-note-input')).toBeNull()
    await click('cd-add-note-btn')
    expect($('cd-new-note-input')).not.toBeNull()
    expect((must('cd-add-note-btn') as HTMLButtonElement).disabled,
      'the empty open state can reach the submit branch').toBe(true)
  })

  test('N2 and non-empty it submits', async () => {
    await mount()
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'Spoke to the client')
    expect((must('cd-add-note-btn') as HTMLButtonElement).disabled).toBe(false)
    await click('cd-add-note-btn')
    const p = patches().at(-1)!.body as { payload: { notes: Array<{ text: string }> } }
    expect(p.payload.notes[0].text).toBe('Spoke to the client')
  })

  test('N4 the note lands on the SAME list, prepended', async () => {
    notesOnRecord = [{ text: 'older', at: '2026-01-01T00:00:00.000Z', by: 'a@b.c' }]
    await mount()
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'New one')
    await click('cd-add-note-btn')
    const p = patches().at(-1)!.body as { payload: { notes: Array<{ text: string }> } }
    expect(p.payload.notes.map((n) => n.text)).toEqual(['New one', 'older'])
  })

  test('N5 it carries the revision handshake', async () => {
    await mount()
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'x')
    await click('cd-add-note-btn')
    expect((patches().at(-1)!.body as { expected_revision: number }).expected_revision).toBe(4)
  })

  test('N6 a 409 RELOADS and KEEPS the typed text', async () => {
    await mount()
    reply = { '/contacts/c-1': { ok: false, status: 409, data: { error: 'stale' } } }
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'Do not lose me')
    const before = calls.filter((c) => c.m === 'GET' && c.path.includes('/contacts')).length
    await click('cd-add-note-btn')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect((must('cd-new-note-input') as HTMLTextAreaElement).value,
      'the typed text was thrown away on a race').toBe('Do not lose me')
    expect(calls.filter((c) => c.m === 'GET' && c.path.includes('/contacts')).length,
      'a 409 did not reload, so a second click cannot land').toBeGreaterThan(before)
  })

  test('N7 a dirty surface is asked first', async () => {
    await mount()
    await act(async () => { must('display-city').click() })
    await type('input-city', 'Kuala Lumpur')
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'x')
    await click('cd-add-note-btn')
    expect(discardAsks, 'the add reloads, which would discard the open field').toBe(1)
  })

  test('N8 discard closes and clears', async () => {
    await mount()
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'abandoned')
    await click('cd-note-discard')
    expect($('cd-new-note-input')).toBeNull()
    await click('cd-add-note-btn')
    expect((must('cd-new-note-input') as HTMLTextAreaElement).value).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// P3: HOW MANY NOTES ARE SHOWN. Ruled: latest first, DEFAULT LAST 2,
// expandable to 10 and to All. P1 carried both as gaps - `notes.map(...)` had
// no slice and no expand control existed - so these are the assertions that
// close them.
describe('P3: the notes list shows the latest 2 and expands', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({
    text: `note ${i}`,
    // Descending, because the list is stored latest-first and the component
    // must not be re-sorting it.
    at: `2026-01-${String(28 - i).padStart(2, '0')}T00:00:00.000Z`,
    by: 'a@b.c',
  }))

  test('a fresh visit shows exactly the latest 2 of many', async () => {
    notesOnRecord = many(12)
    await mount()
    expect(must('cd-note-0').textContent).toContain('note 0')
    expect(must('cd-note-1').textContent).toContain('note 1')
    expect($('cd-note-2'), 'a third note rendered, so the default is not 2').toBeNull()
    expect(must('cd-notes-shown').textContent).toBe('Showing 2 of 12')
  })

  test('Last 10 shows ten, All shows every one, Latest 2 returns', async () => {
    notesOnRecord = many(12)
    await mount()
    act(() => { must('cd-notes-show-10').click() })
    expect(must('cd-note-9').textContent).toContain('note 9')
    expect($('cd-note-10'), 'an eleventh rendered under Last 10').toBeNull()

    act(() => { must('cd-notes-show-all').click() })
    expect(must('cd-note-11').textContent).toContain('note 11')
    expect(must('cd-notes-shown').textContent).toBe('Showing 12 of 12')

    act(() => { must('cd-notes-show-2').click() })
    expect($('cd-note-2'), 'Latest 2 did not collapse the list again').toBeNull()
  })

  test('with 2 or fewer notes there is NO expand control, because it would do nothing', async () => {
    notesOnRecord = many(2)
    await mount()
    expect(must('cd-note-1').textContent).toContain('note 1')
    expect($('cd-notes-expand'),
      'an expand control rendered with nothing behind the fold').toBeNull()
  })

  test('the newest note is still FIRST, so the slice is a window not a re-sort', async () => {
    notesOnRecord = many(5)
    await mount()
    // many() builds descending dates; note 0 is the newest.
    expect(must('cd-note-0').textContent).toContain('note 0')
    act(() => { must('cd-notes-show-all').click() })
    expect(must('cd-note-0').textContent).toContain('note 0')
    expect(must('cd-note-4').textContent).toContain('note 4')
  })
})

describe('P: the park form', () => {
  const openPark = async () => { await mount(); await click('cd-btn-park') }

  test('P1 both fields are required, each with its OWN sentence', async () => {
    await openPark()
    await click('cd-park-save')
    expect(must('cd-park-error').textContent).toBe('Follow-up date is required.')
    await type('cd-park-date', '2027-01-31')
    await click('cd-park-save')
    expect(must('cd-park-error').textContent).toBe('A reason for parking is required.')
  })

  test('P2 TWO writes in order, and the NOTE goes first', async () => {
    await openPark()
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    await click('cd-park-save')
    const patch = calls.findIndex((c) => c.m === 'PATCH')
    const move = calls.findIndex((c) => c.path.includes('/transition'))
    expect(patch).toBeGreaterThan(-1)
    expect(move).toBeGreaterThan(patch)
  })

  test('P3 the note reads as the business writes it', async () => {
    await openPark()
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    await click('cd-park-save')
    const p = patches().at(-1)!.body as { payload: { followUpDate: string, notes: Array<{ text: string }> } }
    expect(p.payload.followUpDate).toBe('2027-01-31')
    // P3 exactly: the reason is carried AS TYPED, with no punctuation added.
    expect(p.payload.notes[0].text).toBe('Contact parked. Follow up on 2027-01-31. Budget deferred')
  })

  test('P5 a failed transition reports IN THE FORM, which stays open', async () => {
    await openPark()
    reply = { '/transition': { ok: false, status: 400, data: { error: 'Cannot park from here.' } } }
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    await click('cd-park-save')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(must('cd-park-error').textContent).toBe('Cannot park from here.')
    expect($('cd-park-date'), 'the form closed on a failure').not.toBeNull()
  })

  test('P6 a BACKDROP click on a dirty form is REFUSED, and warns', async () => {
    await openPark()
    await type('cd-park-date', '2027-01-31')
    await act(async () => { must('cd-park-form').click() })
    expect($('cd-park-date'), 'an accidental dismissal closed the form').not.toBeNull()
    expect($('cd-park-unsaved-warning')).not.toBeNull()
  })

  test('P6 but CANCEL on a dirty form offers a real choice', async () => {
    await openPark()
    await type('cd-park-date', '2027-01-31')
    await click('cd-park-cancel')
    expect(discardAsks, 'Cancel discarded silently').toBe(1)
    expect($('cd-park-date')).toBeNull()
  })

  test('P7 a CLEAN form closes on either, with no warning', async () => {
    await openPark()
    await act(async () => { must('cd-park-form').click() })
    expect($('cd-park-date')).toBeNull()
    expect(discardAsks).toBe(0)
  })

  test('P8 the form CLOSES before the discard dialogue opens', async () => {
    // It is a fixed full-screen popup: leaving it open under the modal left
    // "Keep editing" pointing at a Save button nobody could reach.
    let formOpenWhenAsked: boolean | null = null
    await mount()
    await act(async () => { must('display-city').click() })
    await type('input-city', 'Kuala Lumpur')
    await click('cd-btn-park')
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    const original = services.confirmDiscard
    ;(services as { confirmDiscard: (p: () => void) => void }).confirmDiscard = (p) => {
      formOpenWhenAsked = !!$('cd-park-date')
      discardAsks++
      p()
    }
    await click('cd-park-save')
    ;(services as { confirmDiscard: (p: () => void) => void }).confirmDiscard = original
    expect(formOpenWhenAsked,
      'the park popup was still covering the screen when the dialogue opened').toBe(false)
  })
})

// ── R8, 2026-09-11: UNQUALIFY AND DELETE ARE REMOVED FROM THIS SCREEN ────
//
// Ruled by John as a LIFECYCLE RULE rather than a layout choice:
//
//   Leads are NOT deleted from the Lead screen at this stage.
//   The lifecycle is FORWARD-ONLY: created Unqualified, then Qualified or
//   Nurture. No transition back to Unqualified.
//
// ~~U1, U2, U3, D1, D2~~ asserted those capabilities and are INVERTED rather
// than deleted. A deleted test leaves the controls unguarded in both
// directions - nothing would notice them being restored, and "the vanilla had
// them" is exactly the argument that would restore them (Verification 23).
//
// D3 survives unchanged: creating a Test Bed or an Opportunity from a
// Qualified contact is untouched by R8.
describe('R8: the Lead screen offers neither Unqualify nor Delete', () => {
  test('an Unqualified lead has no Unqualify and no Delete control', async () => {
    status = 'Unqualified'
    await mount()
    expect($('cd-btn-unqualify'), 'Unqualify is back on the Lead screen').toBeNull()
    expect($('cd-btn-delete'), 'Delete is back on the Lead screen').toBeNull()
    expect($('cd-delete-section'), 'the delete section is back').toBeNull()
  })

  test('and a QUALIFIED lead has neither either, which is where they used to appear', async () => {
    // U3 only ever offered Unqualify on a NON-Unqualified record, so a test
    // checking the Unqualified case alone would pass against the old code too.
    status = 'Qualified'
    await mount()
    expect($('cd-btn-unqualify'), 'Unqualify is back on a Qualified lead').toBeNull()
    expect($('cd-btn-delete'), 'Delete is back on a Qualified lead').toBeNull()
  })

  test('no reverse-transition or delete request can be made from this screen', async () => {
    status = 'Qualified'
    await mount()
    const reverse = calls.filter((c) => c.m === 'DELETE'
      || (typeof c.body === 'object' && c.body !== null
        && (c.body as { to_stage?: string }).to_stage === 'Unqualified'))
    expect(reverse, 'the screen sent a reverse or delete request').toEqual([])
  })

  test('D3 create is offered ONLY on a Qualified contact', async () => {
    await mount()
    expect($('cd-create-section')).toBeNull()
    status = 'Qualified'
    await mount()
    expect($('cd-create-section')).not.toBeNull()
    expect($('cd-create-test-bed')).not.toBeNull()
    expect($('cd-create-opportunity')).not.toBeNull()
  })
})

describe('A: the account-details modal', () => {
  const blockOnAccount = () => {
    reply = {
      '/transition': {
        ok: false, status: 422,
        data: { blocking: [{ field: 'parent_record_id' }] },
      },
    }
  }

  test('A2 it opens automatically when the Account blocks and NOTHING matches', async () => {
    await mount()
    blockOnAccount()
    await click('cd-btn-qualify')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect($('account-details-modal'),
      'a blocked Account with no match left the person to find the form').not.toBeNull()
    expect((must('cd-account-details-name') as HTMLInputElement).value,
      'the company was not carried in').toBe('Nowhere Co')
  })

  test('A3 the name is required', async () => {
    await mount()
    blockOnAccount()
    await click('cd-btn-qualify')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    await type('cd-account-details-name', '')
    await click('account-details-save')
    expect(must('account-details-error').textContent).toBe('A name is required.')
  })

  test('A4 the reference number is not invented before the Account exists', async () => {
    await mount()
    blockOnAccount()
    await click('cd-btn-qualify')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(must('account-details-number').textContent).toBe('Not yet generated')
  })

  test('A2 creating IS the link, one write', async () => {
    await mount()
    blockOnAccount()
    await click('cd-btn-qualify')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    reply = {}
    await type('cd-account-details-name', 'Brand New Co')
    await click('account-details-save')
    const link = calls.find((c) => c.path.includes('/link-account'))
    expect(link, 'creating the Account did not link it').toBeTruthy()
    expect((link!.body as { new_account_name: string }).new_account_name).toBe('Brand New Co')
  })

  test('A6 backdrop click closes it', async () => {
    await mount()
    blockOnAccount()
    await click('cd-btn-qualify')
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { must('account-details-modal').click() })
    expect($('account-details-modal')).toBeNull()
  })
})

describe('the shared note writer', () => {
  test('prepend puts the new note first and keeps the rest', () => {
    const n = note('new', 'me', '2027-01-01T00:00:00.000Z')
    expect(prepend(n, [{ text: 'old', at: 'x', by: 'y' }]).map((x) => x.text)).toEqual(['new', 'old'])
    expect(prepend(n, undefined)).toHaveLength(1)
  })

  test('the park sentence is built in one place', () => {
    expect(parkNoteText('2027-01-31', 'Budget deferred'))
      .toBe('Contact parked. Follow up on 2027-01-31. Budget deferred')
  })
})
