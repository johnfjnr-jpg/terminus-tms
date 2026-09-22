// ── THE FIVE CAPABILITIES ────────────────────────────────────────────────
//
// Derived from MIGRATION_CONTACT_CAPABILITIES.md - N1-N9, P1-P9, U1-U3,
// D1-D3, A1-A6 - which was written from the vanilla BEFORE any of this was
// built. The vanilla was not reopened while writing these.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
// PERF ROUND: production wraps every ShellProvider in a QueryClientProvider
// (main.tsx does, at all five mount points), and this harness did not - so a
// host reading the query client worked in the app and threw here.
// Verification 47: the harness reproduces how production INVOKES the code.
// A FRESH CLIENT PER RENDER, so one test's cached list cannot answer for the
// next, which a shared module-level client would have allowed.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContactHost } from '../contact/ContactHost'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import { parkNoteText, prepend, note } from '../contact/notes'

let host: HTMLElement
let root: Root
let calls: Array<{ m: string, path: string, body?: unknown }> = []
let reply: Record<string, { ok: boolean, status?: number, data?: unknown }> = {}
let navigated: string[] = []
/** R4: what reached the shell's own create flow, and with which kind. */
let created: Array<[string, string]> = []
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
  createFromContact: ((id: string, type: string) => { created.push([id, type]) }) as
    ShellServices['createFromContact'],
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
  calls = []; navigated = []; created = []; discardAsks = 0; reply = {}
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ShellProvider services={services}><ContactHost contact={RECORD()} /></ShellProvider></QueryClientProvider>)
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

  test('N1 an empty history says NOTHING - R4 supersedes "No notes yet."', async () => {
    // R4: the empty area already shows there are no notes. The sentence was
    // `.empty-state`, a PAGE-level style (40px vertical padding, centred)
    // used inside a 12px card column and measured at 101px.
    //
    // THIS SURFACE IS THE CONTACT, NOT THE CARD, and the assertion is here
    // deliberately: the removal reaches all three NotesHistory consumers, and
    // this test is the evidence it reached this one.
    await mount()
    // Both halves, per Verification 14: an assertion that a thing is ABSENT
    // passes just as well when the whole component failed to render, so the
    // container is asserted PRESENT and EMPTY rather than the sentence gone.
    expect($('cd-notes-empty'), 'the sentence is gone').toBeNull()
    expect(must('cd-notes-list'), 'the list itself still renders').not.toBeNull()
    expect(must('cd-notes-list').children.length, 'and it is empty').toBe(0)
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

  // ── SUPERSEDED BY V4, John's walk 3, 2026-09-19 ────────────────────────
  //
  // This read: "N7 a dirty surface is asked first", asserting `discardAsks` is
  // 1, on the premise that "the add reloads, which would discard the open
  // field."
  //
  // THE PREMISE IS FALSE, measured live rather than reasoned: `useFieldRows`
  // drops drafts only when the SUBJECT changes, and a reload of the same record
  // does not change it. Driven with a field genuinely dirty, accepting the
  // dialogue and letting the note save leaves the edit ON SCREEN and still
  // counted. The prompt asked a person to accept a loss that does not happen.
  //
  // Reproduced four other ways first, all clean: a fresh record, a field opened
  // but not typed in, a field typed then Escaped, and a second note. Only a
  // genuinely dirty field raised it, which is the condition this test names.
  //
  // Verification 29: a premise failed, so the decision is re-taken and the
  // superseded reasoning stays visible.
  test('V4 a dirty surface is NOT asked: a save never threatens a discard', async () => {
    await mount()
    await type('input-city', 'Kuala Lumpur')
    await click('cd-add-note-btn')
    await type('cd-new-note-input', 'x')
    await click('cd-add-note-btn')
    expect(discardAsks, 'saving a note asked to discard something').toBe(0)
    // PAIRED, so "nobody was asked" cannot be satisfied by nothing happening
    // (Verification 14): the note has to have been sent.
    const wrote = calls.some((c) => c.m === 'PATCH' && /\/api\/contacts\//.test(c.path))
    expect(wrote, 'the note did not save at all').toBe(true)
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
    // R-W1: the word "Showing" is gone and the count is on the header line.
    expect(must('cd-notes-shown').textContent).toBe('2 of 12')
  })

  test('Last 10 shows ten, All shows every one, Latest 2 returns', async () => {
    notesOnRecord = many(12)
    await mount()
    act(() => { must('cd-notes-show-10').click() })
    expect(must('cd-note-9').textContent).toContain('note 9')
    expect($('cd-note-10'), 'an eleventh rendered under Last 10').toBeNull()

    act(() => { must('cd-notes-show-all').click() })
    expect(must('cd-note-11').textContent).toContain('note 11')
    expect(must('cd-notes-shown').textContent).toBe('12 of 12')

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

  // ── R-P, walk 3 2026-09-19: P8's SAVE-PATH DIALOGUE IS GONE ───────────
  //
  // P8 was "the form CLOSES before the discard dialogue opens", and the
  // flushSync it required was a real fix for a real defect: the park form is a
  // fixed full-screen popup, so opening the dialogue underneath it left "Keep
  // editing" pointing at a Save button nobody could reach.
  //
  // MEASURED LIVE, with the park proved to have reached status Nurture from the
  // database: the field edit SURVIVES the park. `park` ends in
  // `setParkOpen(false); await load()`, a reload of the SAME record, and
  // `useFieldRows` drops drafts only when the SUBJECT changes.
  //
  // So there was no loss to warn about, and the whole sequence - the dialogue,
  // and the flushSync that existed only to get the popup out of its way - goes.
  // The assertion inverts rather than disappearing: nothing may ask.
  test('R-P: parking does NOT threaten a discard, because it loses nothing', async () => {
    await mount()
    // R8: as N7 - the input is always open now; the typing is what dirties.
    await type('input-city', 'Kuala Lumpur')
    await click('cd-btn-park')
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    const before = discardAsks
    await click('cd-park-save')
    expect(discardAsks - before,
      'parking threatened a discard that does not happen').toBe(0)
  })

  // ── THE NAG IS A WARNING, NOT AN ERROR. Ruled by John 2026-09-19 ──────
  //
  // Found by opening the walk 3 screenshot: the refusal of an accidental
  // backdrop dismissal rendered in RED, because it reached for `msg-error`,
  // while `msg-warning` sat two hundred lines away in the stylesheet.
  //
  // `.msg-warning` was WRITTEN FOR THIS EXACT CASE, on a different screen, in
  // August: its own comment says "this isn't a validation failure, it's a
  // warning against an accidental discard". The park form is the same
  // situation and picked the other class - two surfaces, one situation, two
  // treatments (Verification 20).
  //
  // Nothing is lost by the swap: measured, the two rules are identical except
  // for `color` - same font, size, letter-spacing and margin (Verification 7's
  // clause about a replaced treatment carrying the role's metrics).
  test('the dismissal refusal is a WARNING, not an error', async () => {
    await mount()
    await click('cd-btn-park')
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    // The ACCIDENTAL dismissal: a click on the backdrop itself, which the form
    // refuses outright rather than acting on.
    await act(async () => {
      must('cd-park-form').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const nag = must('cd-park-unsaved-warning')
    expect(nag.className, 'the refusal is wearing the error treatment').toContain('msg-warning')
    expect(nag.className, 'a refusal of an accidental dismissal is not a failure').not.toContain('msg-error')
    // The WORDING is unchanged, which the ruling is explicit about.
    expect(nag.textContent?.trim()).toBe('There is unsaved work here. Save and park, or cancel.')
  })

  // AND THE CANCEL PATH KEEPS ITS PROMPT, which is a DIFFERENT claim about a
  // DIFFERENT dirtiness: `leave()` reads the form's OWN date and reason, and
  // those really are thrown away. Asserted here so removing the save-path
  // dialogue cannot be read as removing both.
  test('R-P: but CANCEL still asks, because the form\'s own fields really are lost', async () => {
    await mount()
    await click('cd-btn-park')
    await type('cd-park-date', '2027-01-31')
    await type('cd-park-reason', 'Budget deferred')
    const before = discardAsks
    await click('cd-park-cancel')
    expect(discardAsks - before,
      'cancelling a filled-in park form discarded it without asking').toBe(1)
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

  // Re-pointed at the requirement, not the rendering. R4 made create ONE
  // control that opens the shell's own menu, so the two kinds live behind it.
  // What the requirement says is unchanged: create is offered only on a
  // contact, and both kinds are reachable.
  test('D3 create is offered ONLY on a Qualified contact', async () => {
    await mount()
    expect($('cd-create-section'), 'a lead is not offered create').toBeNull()
    expect($('cd-create'), 'not by the control either').toBeNull()
    status = 'Qualified'
    await mount()
    expect($('cd-create-section')).not.toBeNull()
    expect($('cd-create')).not.toBeNull()
  })

  test('D3 and BOTH kinds are reachable from that one control', async () => {
    status = 'Qualified'
    await mount()
    expect($('cd-create-test-bed'), 'the menu starts closed').toBeNull()
    await click('cd-create')
    expect($('cd-create-test-bed')).not.toBeNull()
    expect($('cd-create-opportunity')).not.toBeNull()
  })

  test('D3 and choosing a kind calls the SHELL\'S create flow, not a navigation', async () => {
    // The old buttons navigated to a list and created nothing. This asserts
    // the record and the kind both reach the shell's own mechanism.
    status = 'Qualified'
    await mount()
    await click('cd-create')
    await click('cd-create-opportunity')
    expect(created).toEqual([['c-1', 'opportunity']])
    expect(navigated, 'creating must not navigate anywhere').toEqual([])
  })

  test('D3 and the menu closes on Escape', async () => {
    status = 'Qualified'
    await mount()
    await click('cd-create')
    expect($('cd-create-menu')).not.toBeNull()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect($('cd-create-menu'), 'a menu that only closes by choosing is left open').toBeNull()
  })
})

// ── CONTACT-MODE FURNITURE ───────────────────────────────────────────────
//
// EVERY ONE OF THESE IS ASSERTED ON BOTH MODES, and that is the point rather
// than thoroughness: each change is a CONDITIONAL, and a test on one branch
// says nothing about the other. Verification 24 - a defaulted branch hides an
// incomplete change until a second value exercises it. The ruling is
// explicit that lead-mode must not move, so lead-mode is measured, not
// assumed.
describe('the surface is mode-aware, and the mode is the record\'s status', () => {
  test('R1 the title reads "Contact details" on a contact', async () => {
    status = 'Qualified'
    await mount()
    expect(must('cd-title').textContent).toBe('Contact details')
  })

  test('R1 and "Lead details" on a lead', async () => {
    await mount()
    expect(must('cd-title').textContent).toBe('Lead details')
  })

  test('R2 the status chip is GONE on a contact - being here implies it', async () => {
    status = 'Qualified'
    await mount()
    expect($('cd-status')).toBeNull()
  })

  test('R2 and a lead still shows its own chip', async () => {
    await mount()
    expect(must('cd-status').textContent).toBe('UNQUALIFIED')
  })

  test('R3 Nurture is GONE on a contact - it is a lead action', async () => {
    status = 'Qualified'
    await mount()
    expect($('cd-btn-park')).toBeNull()
  })

  test('R3 and a lead still has Nurture', async () => {
    await mount()
    expect($('cd-btn-park')).not.toBeNull()
  })

  // Verification 7's replacement clause, as an assertion rather than a
  // reminder to look: where the estate has a named treatment for the role,
  // that name is the contract. The vanilla's own markup carries these two
  // (frontend/index.html), the migration left them behind, and both rendered
  // as white browser defaults on a dark screen until a screenshot was opened.
  test('the stage controls carry the treatment the vanilla gave them', async () => {
    await mount()
    expect(must('cd-btn-qualify').className).toContain('btn-primary')
    expect(must('cd-btn-park').className).toContain('btn-ghost')
    status = 'Qualified'
    await mount()
    expect(must('cd-create').className).toContain('contact-create-trigger')
  })

  test('and a lead is still offered Qualify, which a contact is not', async () => {
    // Not a ruling - the counterfactual that stops the four changes above
    // being satisfied by a surface that renders nothing at all on one mode.
    await mount()
    expect($('cd-btn-qualify')).not.toBeNull()
    status = 'Qualified'
    await mount()
    expect($('cd-btn-qualify')).toBeNull()
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
