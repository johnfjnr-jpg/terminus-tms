// ── THE ACCOUNT SURFACE ──────────────────────────────────────────────────
//
// Derived from the Round 2 brief as amended and Phase 0's enumeration. NOT
// from AccountView.tsx and NOT from frontend/account-detail.js.
//
// The structure under test, as MEASURED in Phase 0 rather than as the brief
// first described it: 14 click-to-edit rows, 2 read-only rows (the parent
// account is one of them), 1 name-header editor that is not a row and has no
// tab stop. 17 elements.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

declare global {
  interface Window {
    api?: (m: string, p: string, b?: unknown) => Promise<unknown>
    navigate?: (v: string, id?: string) => void
    detailLoaded?: (v: string) => void
    canEditFields?: () => boolean
    loadAccountDetail?: (id: string) => void
  }
}

const ACCOUNT_ID = 'acct-1'
const STAFF = [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }]

const baseAccount = () => ({
  id: ACCOUNT_ID,
  reference_code: 'TT-SGP-TESTCO-001',
  created_at: '2026-03-01T00:00:00Z',
  parent_account_id: null as string | null,
  latest_revision_number: 7,
  payload: {
    name: 'Testco Pte Ltd', terminusLead: 'Ada Lovelace', websiteUrl: 'https://testco.example',
    billingAddress: '1 Raffles Place', billingAddress2: '', billingCity: 'Singapore',
    billingPostcode: '048616', billingCountry: 'Singapore', billingRegion: 'APAC',
    shippingAddress: '', shippingAddress2: '', shippingCity: '',
    shippingPostcode: '', shippingCountry: '', shippingRegion: '',
  } as Record<string, unknown>,
  contacts: [{ id: 'c1', status: 'Active', payload: { name: 'A Person' } }],
})

let host: HTMLElement
let root: Root
let account: ReturnType<typeof baseAccount>
let calls: { method: string; path: string; body?: unknown }[]
let loaded: string[]
let patchResponse: { ok: boolean; status?: number; data?: unknown } | null

function installShell() {
  calls = []; loaded = []; patchResponse = null
  account = baseAccount()
  window.canEditFields = () => true
  window.navigate = () => {}
  window.detailLoaded = (v: string) => { loaded.push(v) }
  window.api = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (method === 'GET' && path === `/api/accounts/${ACCOUNT_ID}`) return { ok: true, data: account }
    if (method === 'GET' && path === '/api/accounts') return { ok: true, data: [account, { id: 'acct-2', payload: { name: 'Parentco Holdings' } }] }
    if (method === 'GET' && path === '/api/terminus-staff') return { ok: true, data: STAFF }
    if (method === 'PATCH') {
      if (patchResponse) return patchResponse
      const b = body as { payload?: Record<string, unknown>; parent_account_id?: string }
      if (b.payload) { Object.assign(account.payload, b.payload); account.latest_revision_number! += 1 }
      if ('parent_account_id' in b) account.parent_account_id = b.parent_account_id ?? null
      return { ok: true, data: { revision_number: account.latest_revision_number } }
    }
    return { ok: false, status: 404, data: { error: 'not found' } }
  }
}

const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const el = $(id); if (!el) throw new Error(`no [data-testid="${id}"]`); return el }
const click = (el: HTMLElement) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const typeInto = (el: HTMLInputElement, v: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const choose = (el: HTMLSelectElement, v: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
  act(() => { setter.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })) })
}

async function mount() {
  document.body.innerHTML = `<div id="view-account-detail" class="wrap"></div>`
  host = document.getElementById('view-account-detail')!
  vi.resetModules()
  await import('../main')
  await act(async () => { window.loadAccountDetail!(ACCOUNT_ID) })
  await settle()
}

beforeEach(() => { installShell() })

// ─────────────────────────────────────────────────────────────────────────
describe('the surface renders the MEASURED structure', () => {
  test('14 click-to-edit rows, each with a tab stop', async () => {
    await mount()
    const editable = [...host.querySelectorAll('.field-row:not([data-readonly])')]
    expect(editable).toHaveLength(14)
    for (const r of editable) {
      expect(r.querySelector('.field-row-display')!.getAttribute('tabindex')).toBe('0')
    }
  })

  test('2 read-only rows, and the parent account is ONE OF THEM, not a separate widget', async () => {
    await mount()
    const ro = [...host.querySelectorAll('.field-row[data-readonly]')]
    expect(ro.map((r) => (r as HTMLElement).dataset.field).sort()).toEqual(['dateCreated', 'parentAccount'])
  })

  test('the name header is NOT a row, and has NO tab stop - preserved, not fixed', async () => {
    await mount()
    const h = must('display-name-header')
    expect(h.tagName).toBe('H1')
    expect(h.closest('.field-row')).toBeNull()
    // Phase 0 measured the vanilla header as having no tabindex. Giving it one
    // would be a behaviour change nobody asked for; first contact REPORTS.
    expect(h.hasAttribute('tabindex')).toBe(false)
  })

  test('17 elements in total: 14 + 2 + the header', async () => {
    await mount()
    const rows = host.querySelectorAll('.field-row').length
    expect(rows + 1).toBe(17)
  })

  test('three of the fourteen are selects, the rest inputs', async () => {
    await mount()
    const selects = [...host.querySelectorAll('.field-row select')]
      .map((s) => (s.closest('.field-row') as HTMLElement).dataset.field).sort()
    expect(selects).toEqual(['billingRegion', 'shippingRegion', 'terminusLead'])
  })

  test('the staff picker offers the staff the server returned', async () => {
    await mount()
    const opts = [...(must('input-terminusLead') as HTMLSelectElement).options].map((o) => o.value)
    expect(opts).toContain('Ada Lovelace')
    expect(opts).toContain('Grace Hopper')
  })
})

describe('the walk recipe, per element type', () => {
  test('a TEXT row: open, type, discard, reopen, type, save', async () => {
    await mount()
    click(must('display-billingCity'))
    typeInto(must('input-billingCity') as HTMLInputElement, 'Kuala Lumpur')
    click(must('discard-billingCity'))
    expect((must('input-billingCity') as HTMLInputElement).value).toBe('Singapore')
    typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    click(must('save-all'))
    await settle()
    const patch = calls.filter((c) => c.method === 'PATCH').at(-1)!
    expect((patch.body as { payload: Record<string, string> }).payload).toEqual({ billingCity: 'Jakarta' })
  })

  test('a SELECT row: open, choose, discard, reopen, choose, save', async () => {
    await mount()
    click(must('display-billingRegion'))
    choose(must('input-billingRegion') as HTMLSelectElement, 'Africa')
    click(must('discard-billingRegion'))
    expect((must('input-billingRegion') as HTMLSelectElement).value).toBe('APAC')
    choose(must('input-billingRegion') as HTMLSelectElement, 'Europe & UK')
    click(must('save-all'))
    await settle()
    const patch = calls.filter((c) => c.method === 'PATCH').at(-1)!
    expect((patch.body as { payload: Record<string, string> }).payload).toEqual({ billingRegion: 'Europe & UK' })
  })

  test('the NAME HEADER: open, type, discard, reopen, type, save - sharing the surface store', async () => {
    await mount()
    click(must('display-name-header'))
    typeInto(must('input-name-header') as HTMLInputElement, 'Renamed Co')
    expect(must('dirty-count').textContent).toBe('1 change')
    click(must('discard-name-header'))
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
    typeInto(must('input-name-header') as HTMLInputElement, 'Renamed Co')
    click(must('save-all'))
    await settle()
    const patch = calls.filter((c) => c.method === 'PATCH').at(-1)!
    expect((patch.body as { payload: Record<string, string> }).payload).toEqual({ name: 'Renamed Co' })
  })

  test('a READ-ONLY row refuses to open at all', async () => {
    await mount()
    click(must('display-dateCreated'))
    expect($('edit-dateCreated')).toBeNull()
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })
})

describe('the save path, preserved exactly', () => {
  test('ONLY dirty keys are sent, never the whole payload', async () => {
    await mount()
    click(must('display-billingCity')); typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    click(must('display-websiteUrl')); typeInto(must('input-websiteUrl') as HTMLInputElement, 'https://x.example')
    click(must('save-all')); await settle()
    const body = calls.filter((c) => c.method === 'PATCH').at(-1)!.body as { payload: Record<string, string> }
    expect(Object.keys(body.payload).sort()).toEqual(['billingCity', 'websiteUrl'])
  })

  test('expected_revision goes out, carrying the revision the screen loaded', async () => {
    await mount()
    click(must('display-billingCity')); typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    click(must('save-all')); await settle()
    const body = calls.filter((c) => c.method === 'PATCH').at(-1)!.body as { expected_revision: number }
    expect(body.expected_revision).toBe(7)
  })

  test('the 409 sentence is shown and the drafts are NOT cleared', async () => {
    await mount()
    click(must('display-billingCity')); typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    patchResponse = { ok: false, status: 409, data: { error: 'This Account changed since the screen loaded. Reload before saving.' } }
    click(must('save-all')); await settle()
    expect(must('acct-save-feedback').textContent).toMatch(/changed since the screen loaded/)
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  test('a blank name is REFUSED before any request is made', async () => {
    await mount()
    click(must('display-name-header'))
    typeInto(must('input-name-header') as HTMLInputElement, '   ')
    const before = calls.filter((c) => c.method === 'PATCH').length
    click(must('save-all')); await settle()
    expect(must('acct-save-feedback').textContent).toBe('Account Name is required.')
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(before)
  })

  test('a successful save clears the bar and re-reads the record', async () => {
    await mount()
    click(must('display-billingCity')); typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    click(must('save-all')); await settle()
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
    const gets = calls.filter((c) => c.method === 'GET' && c.path === `/api/accounts/${ACCOUNT_ID}`)
    expect(gets.length).toBeGreaterThan(1)
  })
})

describe('the parent link saves IMMEDIATELY and never joins the save bar', () => {
  test('linking PATCHes parent_account_id on its own, with no payload', async () => {
    await mount()
    click(must('parent-open'))
    typeInto(must('parent-search') as HTMLInputElement, 'Parent')
    click(must('parent-result-acct-2'))
    await settle()
    const patch = calls.filter((c) => c.method === 'PATCH').at(-1)!
    expect(patch.body).toEqual({ parent_account_id: 'acct-2' })
    expect((patch.body as Record<string, unknown>).payload).toBeUndefined()
  })

  test('and it does NOT touch the field drafts or the bar', async () => {
    await mount()
    click(must('display-billingCity')); typeInto(must('input-billingCity') as HTMLInputElement, 'Jakarta')
    click(must('parent-open'))
    typeInto(must('parent-search') as HTMLInputElement, 'Parent')
    click(must('parent-result-acct-2'))
    await settle()
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  test('the search excludes the account itself, so nothing can parent itself', async () => {
    await mount()
    click(must('parent-open'))
    typeInto(must('parent-search') as HTMLInputElement, 'Testco')
    expect($(`parent-result-${ACCOUNT_ID}`)).toBeNull()
  })
})

describe('the door is always open, as ruled', () => {
  test('every one of the 14 rows opens', async () => {
    await mount()
    const editable = [...host.querySelectorAll('.field-row:not([data-readonly])')] as HTMLElement[]
    for (const r of editable) {
      const key = r.dataset.field!
      click(must(`display-${key}`))
      expect(must(`edit-${key}`).hasAttribute('hidden'), `${key} refused to open`).toBe(false)
    }
  })

  test('and the shell answering false would shut every one of them', async () => {
    window.canEditFields = () => false
    await mount()
    click(must('display-billingCity'))
    expect(must('edit-billingCity').hasAttribute('hidden')).toBe(true)
  })
})

describe('detailLoaded fires on every exit path', () => {
  test('on success', async () => {
    await mount()
    expect(loaded).toContain('account-detail')
  })

  test('on a failing fetch, and the rows do not render', async () => {
    installShell()
    const realApi = window.api!
    window.api = async (m: string, p: string, b?: unknown) => {
      if (m === 'GET' && p === `/api/accounts/${ACCOUNT_ID}`) return { ok: false, status: 404, data: { error: 'account not found' } }
      return realApi(m, p, b)
    }
    await mount()
    expect(must('account-error').textContent).toBe('account not found')
    expect(host.querySelectorAll('.field-row')).toHaveLength(0)
    expect(loaded).toContain('account-detail')
  })

  test('when the container is missing entirely', async () => {
    installShell()
    vi.resetModules()
    await import('../main')
    document.body.innerHTML = ''
    await act(async () => { window.loadAccountDetail!(ACCOUNT_ID) })
    await settle()
    expect(loaded).toContain('account-detail')
  })
})
