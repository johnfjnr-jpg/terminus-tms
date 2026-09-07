// ── ROUND 6 PHASE 1: THE CONTACT SURFACE ────────────────────────────────
//
// Derived from the Phase 0 census, its live second instrument, and the Qualify
// enumeration. `frontend/contact-detail.js` was not opened while writing these.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
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
const services: ShellServices = {
  api: (async (m: string, path: string, body?: unknown) => {
    if (path.includes('/industries')) return { ok: true, status: 200, data: INDUSTRIES }
    if (path.includes('/transition')) { transitions.push(body); return transitionReply }
    if (m === 'PATCH' && path.includes('/contacts/')) { patches.push(body); return { ok: true, status: 200 } }
    if (path.includes('/contacts')) return { ok: true, status: 200, data: [current] }
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
}

const mount = async (c = CONTACT) => {
  current = c
  patches = []; transitions = []; navigated = []
  transitionReply = { ok: true, status: 200, data: {} }
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<ShellProvider services={services}><ContactHost contact={c} /></ShellProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const e = $(id); if (!e) throw new Error(`no ${id}`); return e }
const editRow = async (name: string, value: string) => {
  await act(async () => { must(`display-${name}`).click() })
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

beforeEach(() => { document.body.innerHTML = '' })

describe('the rows', () => {
  test('every census field renders exactly one row', async () => {
    await mount()
    const rows = host.querySelectorAll('[data-key]')
    expect(rows).toHaveLength(CENSUS_FIELD_COUNT)
  })

  test('the LOOKUP shows the industry NAME, never the id', async () => {
    await mount()
    expect(must('display-industry').textContent, 'a UUID reached the screen').toBe('Aviation')
  })

  test('summary is a TEXTAREA, which only the live census could tell us', async () => {
    await mount()
    await act(async () => { must('display-summary').click() })
    expect(must('input-summary').tagName).toBe('TEXTAREA')
  })

  test('the name header carries the name row, with a door and a discard', async () => {
    await mount()
    expect(must('cd-header').querySelector('[data-key="name"]')).not.toBeNull()
    await act(async () => { must('display-name').click() })
    expect($('input-name')).not.toBeNull()
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
    expect(Object.keys(b.payload).sort()).toEqual(['city', 'notes'])
    expect(b.payload.city).toBe('Kuala Lumpur')
  })

  test('ONE note per save session, not one per field, and prepended', async () => {
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await editRow('postcode', '50000')
    await save()
    const b = patches[0] as { payload: { notes: Array<{ text: string }> } }
    expect(b.payload.notes).toHaveLength(2)
    expect(b.payload.notes[0].text).toMatch(/City changed/)
    expect(b.payload.notes[0].text).toMatch(/Postcode/)
    expect(b.payload.notes[1].text, 'the history was not preserved').toBe('older')
  })

  test('the note names the industry by NAME, not by id', async () => {
    await mount()
    await editRow('industry', 'i-2')
    await save()
    const b = patches[0] as { payload: { notes: Array<{ text: string }> } }
    expect(b.payload.notes[0].text).toContain('Aviation')
    expect(b.payload.notes[0].text).toContain('Maritime')
    expect(b.payload.notes[0].text, 'a UUID reached the notes history').not.toMatch(/i-[12]/)
  })

  test('the revision handshake rides the save, read off the RECORD', async () => {
    await mount()
    await editRow('city', 'Kuala Lumpur')
    await save()
    expect((patches[0] as { expected_revision: number }).expected_revision).toBe(7)
  })

  test('nothing dirty sends nothing', async () => {
    await mount()
    await act(async () => { must('display-city').click() })
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
