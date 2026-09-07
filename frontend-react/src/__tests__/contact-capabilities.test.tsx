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

describe('U and D: unqualify, delete, create', () => {
  test('U1 unqualify transitions and re-reads', async () => {
    status = 'Qualified'
    await mount()
    await click('cd-btn-unqualify')
    expect(calls.some((c) => c.path.includes('/transition')
      && (c.body as { to_stage: string })?.to_stage === 'Unqualified')).toBe(true)
  })

  test('U2 a dirty surface is asked first', async () => {
    status = 'Qualified'
    await mount()
    await act(async () => { must('display-city').click() })
    await type('input-city', 'KL')
    await click('cd-btn-unqualify')
    expect(discardAsks).toBe(1)
  })

  test('U3 it is not offered on a contact that is already Unqualified', async () => {
    await mount()
    expect($('cd-btn-unqualify')).toBeNull()
    expect($('cd-btn-qualify'), 'Qualify should be offered instead').not.toBeNull()
  })

  test('D1 delete returns to the RETURN VIEW, not a fixed list', async () => {
    status = 'Qualified'
    await mount()
    await click('cd-btn-delete')
    expect(calls.some((c) => c.m === 'DELETE')).toBe(true)
    expect(navigated.at(-1), 'a deleted contact went somewhere it did not come from').toBe('contacts')
  })

  test('D1 and an unqualified one returns to leads', async () => {
    await mount()
    await click('cd-btn-delete')
    expect(navigated.at(-1)).toBe('leads')
  })

  test('D2 a FAILED delete does nothing, which is what the vanilla does', async () => {
    await mount()
    reply = { '/contacts/c-1': { ok: false, status: 500, data: {} } }
    await click('cd-btn-delete')
    expect(navigated, 'a failed delete navigated anyway').toEqual([])
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
