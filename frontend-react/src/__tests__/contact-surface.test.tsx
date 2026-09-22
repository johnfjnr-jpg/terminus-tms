// ── ROUND 6 PHASE 1: THE CONTACT SURFACE ────────────────────────────────
//
// Derived from the Phase 0 census, its live second instrument, and the Qualify
// enumeration. `frontend/contact-detail.js` was not opened while writing these.
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
import { ContactHost, returnViewFor, WRITABLE_ELSEWHERE } from '../contact/ContactHost'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import { CENSUS_FIELD_COUNT } from '../contact/descriptors'

let host: HTMLElement
let root: Root
let patches: unknown[] = []
let transitions: unknown[] = []
let transitionReply: { ok: boolean, status?: number, data?: unknown } = { ok: true, status: 200, data: {} }
let navigated: string[] = []

const INDUSTRIES = [{ id: 'i-1', name: 'Aviation' }, { id: 'i-2', name: 'Maritime' }]

const CONTACT = {
  id: 'c-1',
  payload: {
    name: 'Ada Poh', company: 'Changi Holdings', jobRole: 'Head of Infrastructure',
    email: 'ada@example.invalid', mobile: '+65 9000 0001', linkedin: 'https://x/in/ada',
    source: 'Referral', address: '1 Fixture Street', address2: 'Level 2',
    city: 'Singapore', postcode: '018956', country: 'Singapore', region: 'APAC',
    summary: 'A fixture.', notes: [{ text: 'older', at: '2026-01-01T00:00:00.000Z', by: 'x' }],
  },
  industry_id: 'i-1',
  parent_record_id: null,
  status: 'Unqualified',
  account: null,
  latest_revision_number: 7,
}

let current = CONTACT
// R8: the two claims the calibration sweep found SILENT. Both are things the
// swap made true and nothing asserted - V51, the silent injection names a
// claim that is real, relied on, and tested nowhere.
let canEdit = true
let exitBlockers: Array<{ field: string, message?: string }> = []
const services: ShellServices = shellServices({
  api: (async (m: string, path: string, body?: unknown) => {
    if (path.includes('/industries')) return { ok: true, status: 200, data: INDUSTRIES }
    if (path.includes('exit-criteria')) return { ok: true, status: 200, data: { blocking: exitBlockers } }
    if (path.includes('/transition')) { transitions.push(body); return transitionReply }
    if (m === 'PATCH' && path.includes('/contacts/')) { patches.push(body); return { ok: true, status: 200 } }
    if (path.includes('/contacts')) return { ok: true, status: 200, data: [current] }
    return { ok: true, status: 200, data: {} }
  }) as ShellServices['api'],
  navigate: ((v: string) => { navigated.push(v) }) as ShellServices['navigate'],
  detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  canEditFields: () => canEdit,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p: () => void) => { p() },
})

const mount = async (c = CONTACT) => {
  current = c
  patches = []; transitions = []; navigated = []
  transitionReply = { ok: true, status: 200, data: {} }
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ShellProvider services={services}><ContactHost contact={c} /></ShellProvider></QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const e = $(id); if (!e) throw new Error(`no ${id}`); return e }
// R8: PUT A VALUE IN A FIELD, whichever way the field is rendered.
//
// The contract says nothing about display/edit rows: C6 to C11 are about what
// a save SENDS. This helper therefore expresses the requirement-level act -
// "the person put this value in this field" - and opens a display row first
// only where one exists. Summary is still a row; the other fourteen are the
// dense grid's always-open inputs.
const editRow = async (name: string, value: string) => {
  const display = $(`display-${name}`)
  if (display) await act(async () => { display.click() })
  await act(async () => {
    const i = must(`input-${name}`) as HTMLInputElement
    const proto = i.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : i.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(i, value)
    i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
const save = async () => { await act(async () => { must('save-all').click() }) }
/** The always-open inputs of the dense grid, and only those. */
const gridInputs = () => [...host.querySelectorAll<HTMLInputElement | HTMLSelectElement
  | HTMLTextAreaElement>('.lead-complete-cell input, .lead-complete-cell select, .lead-complete-cell textarea')]

// Reset BEFORE the test body, not inside `mount`: a test that sets the door
// shut then mounts would otherwise have its own setup overwritten by the
// thing it is setting up.
beforeEach(() => { document.body.innerHTML = ''; canEdit = true; exitBlockers = [] })

describe('the rows', () => {
  test('every census field renders exactly one row', async () => {
    await mount()
    const rows = host.querySelectorAll('[data-key]')
    expect(rows).toHaveLength(CENSUS_FIELD_COUNT)
  })

  // CONTRACT C2: a lookup field shows the NAME; an id never reaches the screen.
  //
  // Re-pointed at the requirement, not at the rendering. The old assertion
  // read a display row's textContent; the field is a picker now, so the name
  // is its SELECTED OPTION. Both halves are asserted, because "shows Aviation"
  // alone would pass on a screen that also printed the uuid somewhere.
  test('the LOOKUP shows the industry NAME, never the id', async () => {
    await mount()
    const sel = must('input-industry') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex]?.textContent, 'a UUID reached the screen').toBe('Aviation')
    expect(host.textContent).not.toMatch(/\bi-[12]\b/)
  })

  test('summary is a TEXTAREA, which only the live census could tell us', async () => {
    await mount()
    await act(async () => { must('display-summary').click() })
    expect(must('input-summary').tagName).toBe('TEXTAREA')
  })

  // P3 MOVED THE NAME, and this asserts the move rather than the old place.
  //
  // The ruled layout puts LEAD NAME in the header at 18pt as a HEADING. A
  // heading is not editable, and `name` is one of the 15 fields gated at
  // Qualify - so the row survives, inside Contact Details, and the heading
  // displays the same value. Both halves are asserted here: the look that was
  // ruled, and the capability that would otherwise have gone with it.
  //
  // "and a discard" has gone from the title because A1 removed the per-field
  // discard on all four surfaces. Escape is the revert now.
  // CONTRACT C4: the name appears as the screen's HEADING and REMAINS EDITABLE.
  // The heading is a display, not a substitute for the field.
  //
  // Re-pointed. The old version opened a collapsed card first, which was a
  // fact about the rendering rather than about the requirement - and the
  // rendering is what R8 changed. Both halves of C4 are still asserted, and
  // the second is asserted harder than before: the field must be editable,
  // which for an always-open input means present AND not disabled.
  test('the header shows the lead name, and the name is still EDITABLE', async () => {
    await mount()
    expect(must('cd-lead-name').textContent).toBe('Ada Poh')
    expect(must('cd-card-contact').querySelector('[data-key="name"]')).not.toBeNull()
    const input = must('input-name') as HTMLInputElement
    expect(input.disabled, 'the owner must be able to edit the name').toBe(false)
  })

  // CONTRACT C1, the other half: the heading DISPLAYS the same value the field
  // edits. One record, one source, read twice for two jobs - so a heading that
  // silently diverged from the field would be caught.
  test('and the heading shows the same value the field holds', async () => {
    await mount()
    expect((must('input-name') as HTMLInputElement).value)
      .toBe(must('cd-lead-name').textContent)
  })
})

// ── THE TWO CLAIMS THE CALIBRATION SWEEP FOUND SILENT ────────────────────
//
// Both were introduced by R8's swap and asserted by nothing. A silent
// injection is not a weaker result than a firing one, it is a different
// result: it names something true, relied on, and untested (V51).
describe('R8: the door, and the marks', () => {
  test('THE DOOR REACHES THE ALWAYS-OPEN INPUTS: a non-owner cannot edit', async () => {
    // The swap changed HOW the door arrives, not whether it does. A
    // display/edit row enforces ownership by refusing to OPEN; an always-open
    // input has no such moment, so the rule has to arrive as `disabled`. This
    // is the assertion that stops that wiring being dropped silently.
    canEdit = false
    await mount()
    // SCOPED TO THE GRID, deliberately. Summary is still a display/edit row,
    // and a row enforces the door by refusing to OPEN rather than by
    // disabling - its editor exists in the DOM, hidden, and is inert by a
    // different mechanism that its own tests cover. A selector wide enough to
    // catch it would be measuring two populations and reporting one number.
    const inputs = gridInputs()
    expect(inputs.length, 'the fields still RENDER, because reading is not editing')
      .toBeGreaterThanOrEqual(14)
    expect(inputs.filter((e) => !e.disabled),
      'a non-owner must not be able to edit any grid field').toHaveLength(0)
  })

  test('and for the OWNER every one of them is editable', async () => {
    // The counterfactual. Without this, the assertion above would pass on a
    // surface that disabled every field for everybody.
    await mount()
    const inputs = gridInputs()
    expect(inputs.filter((e) => !e.disabled).length).toBe(inputs.length)
  })

  // CONTRACT C23: the mode governs framing, THE SERVER governs marks.
  test('the server\'s outstanding list MARKS those fields, and only those', async () => {
    exitBlockers = [{ field: 'city' }, { field: 'industry_id' }]
    await mount()
    const marked = [...host.querySelectorAll('[data-testid^="cd-needs-"]')]
      .map((e) => e.getAttribute('data-testid')!.replace('cd-needs-', '')).sort()
    // `industry_id` is the GATE's name for it; this surface calls the field
    // `industry`, and the mapping is what makes the mark land on the right row.
    expect(marked).toEqual(['city', 'industry'])
  })

  test('and with nothing outstanding, nothing is marked', async () => {
    await mount()
    expect(host.querySelectorAll('[data-testid^="cd-needs-"]')).toHaveLength(0)
  })
})

describe('the save path', () => {
  test('only-dirty, and industry lifted to a COLUMN not a payload key', async () => {
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await editRow('industry', 'i-2')
    await save()
    expect(patches).toHaveLength(1)
    const b = patches[0] as { payload: Record<string, unknown>, industry_id: string }
    expect(b.industry_id, 'industry went through the payload, which the route rejects').toBe('i-2')
    // R3: `notes` is GONE from the save payload. It used to ride every save
    // because the client composed a change sentence into it.
    expect(Object.keys(b.payload).sort()).toEqual(['city'])
    expect(b.payload.city).toBe('Kuala Lumpur')
  })

  // ── R3: THE CLIENT DOES NOT AUTHOR THE AUDIT TRAIL ─────────────────────
  //
  // These three tests asserted the retired contract: one composed sentence
  // per save session, prepended into `payload.notes`, naming the industry by
  // name. That behaviour is not weakened, it is MOVED - the route diffs the
  // patch against the payload it actually holds and writes a structured
  // change to `audit_log` itself.
  //
  // So the claim here inverts: a field save must touch NOTES AT ALL, and the
  // stated negative is the specification. Paired below with the positive -
  // the human note path still writes - because "X is not in Y" needs a
  // companion asserting X exists somewhere (Verification 14).
  test('R3 a field save writes NO note, on any number of fields', async () => {
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await editRow('postcode', '50000')
    await save()
    const b = patches[0] as { payload: Record<string, unknown> }
    expect('notes' in b.payload,
      'the client is still composing an audit sentence into the notes history').toBe(false)
    expect(Object.keys(b.payload).sort()).toEqual(['city', 'postcode'])
  })

  test('R3 and no note even when the changed field is the industry COLUMN', async () => {
    await mount()
    await editRow('industry', 'i-2')
    await save()
    const b = patches[0] as { payload: Record<string, unknown>, industry_id: string }
    expect(b.industry_id).toBe('i-2')
    expect('notes' in b.payload, 'the industry change composed a note').toBe(false)
  })

  test('R3 THE HUMAN NOTE PATH STILL WRITES, and still prepends', async () => {
    // THE COMPANION POSITIVE. "A field save writes no note" is an assertion of
    // absence, and an absence is also what a broken notes path reports. This
    // is the half that stops the two readings looking alike (Verification 14).
    await mount()
    // `cd-add-note-btn` is BOTH the opener and, once open, the Save - the
    // card reuses the id rather than showing two Add note controls.
    await act(async () => { must('cd-add-note-btn').click() })
    const box = must('cd-new-note-input') as HTMLTextAreaElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!
        .set!.call(box, 'Called the site manager')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { must('cd-add-note-btn').click() })

    const b = patches.at(-1) as { payload: { notes: Array<{ text: string }> } }
    expect(b?.payload?.notes, 'the human note did not reach the payload').toBeTruthy()
    expect(b.payload.notes[0].text).toBe('Called the site manager')
    expect(b.payload.notes[1]?.text, 'the existing history was not preserved').toBe('older')
  })

  test('the revision handshake rides the save, read off the RECORD', async () => {
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await save()
    expect((patches[0] as { expected_revision: number }).expected_revision).toBe(7)
  })

  // CONTRACT C11: nothing dirty sends nothing.
  //
  // Re-pointed at the requirement. The old version OPENED a display row and
  // saved, which tested "opening is not editing" - true, and a fact about an
  // idiom that no longer exists here. The requirement underneath is that only
  // what MOVED is sent, so the sharper form is to touch the field and put the
  // same value back: dirty is `draft !== orig`, strictly, and this is the case
  // that separates a real comparison from a touched-flag.
  test('nothing dirty sends nothing, even after a field is touched', async () => {
    await mount()
    await editRow('city', 'Singapore')
    expect((must('input-city') as HTMLInputElement).value,
      'the field really was written, so this is not vacuous').toBe('Singapore')
    await save()
    expect(patches).toHaveLength(0)
  })

  test('legalEntity and followUpDate are NEVER sent by this surface', async () => {
    // A migration adds no renders: legalEntity is writable by the route and
    // rendered nowhere in the vanilla, so it is rendered nowhere here either.
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await save()
    const b = patches[0] as { payload: Record<string, unknown> }
    for (const k of WRITABLE_ELSEWHERE) expect(Object.keys(b.payload)).not.toContain(k)
    for (const k of WRITABLE_ELSEWHERE) expect($(`display-${k}`)).toBeNull()
  })
})

describe('the Qualify workflow', () => {
  const blocked = (fields: string[]) => ({
    ok: false, status: 422, data: { blocking: fields.map((field) => ({ field })) },
  })

  test('a clean qualify navigates to contacts and leaves no tint', async () => {
    await mount()
    await act(async () => { must('cd-btn-qualify').click() })
    expect(transitions).toEqual([{ to_stage: 'Qualified' }])
    expect(navigated).toEqual(['contacts'])
    expect(host.querySelectorAll('.field-blocked')).toHaveLength(0)
  })

  test('a 422 TINTS the blocked rows', async () => {
    await mount()
    transitionReply = blocked(['email', 'city'])
    await act(async () => { must('cd-btn-qualify').click() })
    const tinted = [...host.querySelectorAll('[data-key].field-blocked')].map((e) => (e as HTMLElement).dataset.key)
    expect(tinted.sort()).toEqual(['city', 'email'])
  })

  test('C2: a blocked INDUSTRY tints the Industry row', async () => {
    // The defect this round exists to fix. The gate says industry_id, the row
    // is called industry, and the vanilla matched one against the other.
    await mount()
    transitionReply = blocked(['industry_id'])
    await act(async () => { must('cd-btn-qualify').click() })
    const tinted = [...host.querySelectorAll('[data-key].field-blocked')].map((e) => (e as HTMLElement).dataset.key)
    expect(tinted, 'a person blocked on Industry is shown nothing').toEqual(['industry'])
  })

  test('parent_record_id tints the ACCOUNT CARD, not a row', async () => {
    await mount()
    transitionReply = blocked(['parent_record_id'])
    await act(async () => { must('cd-btn-qualify').click() })
    expect(must('cd-card-account').className).toContain('field-blocked')
    expect(host.querySelectorAll('[data-key].field-blocked')).toHaveLength(0)
  })

  test('AN UNPLACEABLE BLOCKER IS SAID OUT LOUD, never silently dropped', async () => {
    await mount()
    transitionReply = blocked(['somethingNobodyRenders'])
    await act(async () => { must('cd-btn-qualify').click() })
    expect(must('cd-save-feedback').textContent).toContain('somethingNobodyRenders')
  })

  test('resolving a blocked field CLEARS its tint, without re-attempting', async () => {
    await mount()
    transitionReply = blocked(['city'])
    await act(async () => { must('cd-btn-qualify').click() })
    expect(host.querySelectorAll('[data-key].field-blocked')).toHaveLength(1)
    const before = transitions.length
    current = { ...CONTACT, payload: { ...CONTACT.payload, city: 'Kuala Lumpur' } }
    await editRow('city', 'Kuala Lumpur')
    await save()
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(host.querySelectorAll('[data-key].field-blocked')).toHaveLength(0)
    expect(transitions.length, 'clearing re-attempted the transition, which would '
      + 'qualify the contact as a side effect of saving a field').toBe(before)
  })
})

describe('C1: the return view', () => {
  test('a Qualified contact returns to contacts, an unqualified one to leads', () => {
    expect(returnViewFor('Qualified')).toBe('contacts')
    expect(returnViewFor('Unqualified')).toBe('leads')
    expect(returnViewFor(null)).toBe('leads')
  })
})
