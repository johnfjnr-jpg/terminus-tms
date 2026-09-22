// ── B6: THE CLIENT BUYER ROWS, THROUGH THE REAL HOST ─────────────────────
//
// Round A Phase 3, acceptance R5: selecting a contact fires POST
// /test-beds/:id/buyer-contacts; per-role feedback renders for that role; a
// linked role displays the contact's name read-only.
//
// EVERY RESPONSE is captured from the routes by
// scripts/testbed-core/capture-buyers.mjs: the Test Bed before and after a real
// link, the contacts list (this run's fixture contacts only, including one of
// ANOTHER Account), the real 201 body, and the real 422 and 404 bodies. Routes no
// claim here is about answer an empty-list stub.
//
// Behaviour is the vanilla's (`renderTbBuyerRows`, `linkTbBuyer` at 54001c5^),
// which R11 makes the authority.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
// PERF ROUND: production wraps every ShellProvider in a QueryClientProvider
// (main.tsx does, at all five mount points), and this harness did not - so a
// host reading the query client worked in the app and threw here.
// Verification 47: the harness reproduces how production INVOKES the code.
// A FRESH CLIENT PER RENDER, so one test's cached list cannot answer for the
// next, which a shared module-level client would have allowed.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import LIVE_JSON from './fixtures/buyers-live.json'
import { CLIENT_BUYER_ROLE_LABELS } from '../testbed/buyers'
import { shellServices as realShellServices } from '../shell-services'

interface Captured { status: number, body: Record<string, unknown>, request?: { role: string, contact_id: string } }
interface Bed { id: string, account_id: string, owner_id?: string, payload: Record<string, unknown>, buyer_contacts: Array<{ role: string, contact_id: string, name: string }> }
const LIVE = LIVE_JSON as unknown as {
  bedBefore: Bed, bedAfter: Bed
  contacts: Array<{ id: string, parent_record_id: string, payload: { name: string } }>
  linked: Captured
  refusals: Record<'foreignAccount' | 'deletedContact', Captured>
  ids: { own: string[], foreign: string, gone: string }
}
const ROLES = ['Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer']

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

type Sent = { method: string, path: string, body?: unknown }
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const mount = async (opts: {
  sent?: Sent[]
  onLink?: () => Captured | Promise<Captured>
  canEdit?: () => boolean
  bed?: Bed
  openNew?: ShellServices['openInlineBuyerContact']
} = {}) => {
  const sent = opts.sent ?? []
  let current: Bed = opts.bed ?? LIVE.bedBefore
  const services = shellServices({
    canEditFields: opts.canEdit ?? (() => true),
    currentUserId: () => current.owner_id ?? 'user-1',
    openInlineBuyerContact: opts.openNew ?? (() => true),
    api: (async (method: string, path: string, body?: unknown) => {
      sent.push({ method, path, body })
      if (method === 'POST' && path === `/api/test-beds/${current.id}/buyer-contacts`) {
        const c = await (opts.onLink ?? (() => LIVE.linked))()
        if (c.status < 300) current = LIVE.bedAfter
        return { ok: c.status < 300, status: c.status, data: c.body }
      }
      if (path === `/api/test-beds/${current.id}`) return { ok: true, status: 200, data: current }
      if (path === '/api/contacts') return { ok: true, status: 200, data: LIVE.contacts }
      if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
      return { ok: true, status: 200, data: [] }
    }) as ShellServices['api'],
  })
  act(() => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ShellProvider services={services}><TestBedHost bed={current} /></ShellProvider></QueryClientProvider>) })
  await settle()
  await act(async () => { $('tb-tab-btn-reference')!.click() })
  await settle()
  return sent
}
const choose = async (role: string, contactId: string) => {
  await act(async () => {
    const sel = $(`tb-buyer-select-${role}`) as HTMLSelectElement
    sel.value = contactId
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}
const links = (sent: Sent[]) => sent.filter((s) => s.method === 'POST' && s.path.endsWith('/buyer-contacts'))
const ownContacts = () => LIVE.contacts.filter((c) => c.parent_record_id === LIVE.bedBefore.account_id)

describe('an unlinked role: a select of THIS Account\'s contacts, under the vanilla\'s label', () => {
  test('every role offers exactly the bed\'s own Account\'s contacts, never another Account\'s', async () => {
    expect(LIVE.contacts.some((c) => c.parent_record_id !== LIVE.bedBefore.account_id),
      'the captured contacts are all of one Account, so the filter is not exercised').toBe(true)
    await mount()
    for (const role of ROLES) {
      const opts = [...($(`tb-buyer-select-${role}`) as HTMLSelectElement).options].slice(1)
      expect(opts.map((o) => o.value), role).toEqual(ownContacts().map((c) => c.id))
      expect(opts.map((o) => o.textContent)).toEqual(ownContacts().map((c) => c.payload.name))
      expect($(`tb-buyer-${role}`)!.querySelector('.field-row-label')!.textContent).toBe(CLIENT_BUYER_ROLE_LABELS[role])
    }
  })

  test('the labels are the vanilla\'s display names and the VALUES stay the gate\'s role strings', () => {
    expect(CLIENT_BUYER_ROLE_LABELS).toEqual({
      'Client Commercial Buyer': 'Comm. Buyer', 'Client Technical Buyer': 'Tech. Buyer', 'Client Legal Buyer': 'Legal Buyer' })
  })
})

describe('3.1 acceptance: selecting a contact WRITES, and the linked role reads as the name', () => {
  test('the choice fires POST /buyer-contacts with { role, contact_id }, at once, with no other click', async () => {
    const sent = await mount()
    const role = LIVE.linked.request!.role
    await choose(role, LIVE.linked.request!.contact_id)
    expect(links(sent).map((s) => s.body)).toEqual([{ role, contact_id: LIVE.linked.request!.contact_id }])
  })

  test('after the write the record is re-read and the role is READ-ONLY with the contact\'s name', async () => {
    const sent = await mount()
    const role = LIVE.linked.request!.role
    const reads = () => sent.filter((s) => s.path === `/api/test-beds/${LIVE.bedBefore.id}`).length
    const before = reads()
    await choose(role, LIVE.linked.request!.contact_id)
    expect(reads(), 'the record was not reloaded').toBeGreaterThan(before)
    const name = LIVE.bedAfter.buyer_contacts.find((b) => b.role === role)!.name
    expect($(`tb-buyer-linked-${role}`)?.textContent).toBe(name)
    expect($(`tb-buyer-select-${role}`), 'a linked role still offers a select, so a second link is one click away').toBeNull()
    expect($(`tb-buyer-${role}`)!.dataset.readonly).toBe('true')
    for (const other of ROLES.filter((r) => r !== role)) expect($(`tb-buyer-select-${other}`), other).toBeTruthy()
  })

  test('an empty choice sends nothing', async () => {
    const sent = await mount()
    await choose(ROLES[0], '')
    expect(links(sent)).toHaveLength(0)
  })

  test('the select is disabled while its own write is in flight', async () => {
    let release: (c: Captured) => void = () => {}
    const held = new Promise<Captured>((r) => { release = r })
    await mount({ onLink: () => held })
    await act(async () => {
      const sel = $(`tb-buyer-select-${ROLES[0]}`) as HTMLSelectElement
      sel.value = ownContacts()[0].id
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(($(`tb-buyer-select-${ROLES[0]}`) as HTMLSelectElement).disabled, 'a second choice could become a second link').toBe(true)
    await act(async () => { release(LIVE.refusals.foreignAccount) })
    await settle()
    expect(($(`tb-buyer-select-${ROLES[0]}`) as HTMLSelectElement).disabled).toBe(false)
  })
})

describe('3.1 acceptance: the refusal renders under THAT role, in the server\'s words', () => {
  for (const [name, key] of [['a contact of another Account (422)', 'foreignAccount'], ['a deleted contact (404)', 'deletedContact']] as const) {
    test(name, async () => {
      const refusal = LIVE.refusals[key]
      await mount({ onLink: () => refusal })
      const role = ROLES[1]
      await choose(role, ownContacts()[0].id)
      expect($(`tb-buyer-feedback-${role}`)?.textContent).toBe(refusal.body.error as string)
      for (const other of ROLES.filter((r) => r !== role)) expect($(`tb-buyer-feedback-${other}`), other).toBeNull()
      expect($(`tb-buyer-select-${role}`), 'the refused role stopped offering a choice').toBeTruthy()
    })
  }
})

describe('3.3 the door', () => {
  test('on a record you may not edit, a choice sends NOTHING', async () => {
    const sent = await mount({ canEdit: () => false })
    await choose(ROLES[0], ownContacts()[0].id)
    expect(links(sent), 'a link was sent for somebody else\'s record').toHaveLength(0)
  })

  test('on a record you may not edit, "+ New" does not open the modal (it creates a Contact before it links)', async () => {
    const openNew = vi.fn(() => true)
    await mount({ canEdit: () => false, openNew })
    await act(async () => { $(`tb-buyer-new-${ROLES[0]}`)!.click() })
    expect(openNew, 'the modal was opened for somebody else\'s record').not.toHaveBeenCalled()
  })
})

describe('3.2 the seam itself', () => {
  test('the seam calls the shell\'s modal as a TEST BED, with the bed, its Account and the role', () => {
    const w = window as unknown as { openInlineBuyerContactModal?: (...a: unknown[]) => void }
    const calls: unknown[][] = []
    w.openInlineBuyerContactModal = (...a: unknown[]) => { calls.push(a) }
    try {
      expect(realShellServices.openInlineBuyerContact('tb-9', 'acct-9', ROLES[1])).toBe(true)
      expect(calls, 'the modal was opened as another record type or with other arguments')
        .toEqual([['test_bed', 'tb-9', 'acct-9', ROLES[1]]])
    } finally { delete w.openInlineBuyerContactModal }
  })

  test('a shell that does not provide the modal is reported, not silently ignored', () => {
    expect(realShellServices.openInlineBuyerContact('tb-9', 'acct-9', ROLES[1])).toBe(false)
  })
})

describe('3.2 "+ New" goes through the shell\'s shared modal', () => {
  test('it opens the seam with this bed, its Account and the role', async () => {
    const openNew = vi.fn(() => true)
    await mount({ openNew })
    await act(async () => { $(`tb-buyer-new-${ROLES[2]}`)!.click() })
    expect(openNew).toHaveBeenCalledWith(LIVE.bedBefore.id, LIVE.bedBefore.account_id, ROLES[2])
  })
})

describe('a Test Bed with no linked Account', () => {
  test('says so, and offers nothing', async () => {
    await mount({ bed: { ...LIVE.bedBefore, account_id: null as unknown as string, account: null } as Bed })
    expect($('tb-buyers-no-account')?.textContent).toBe('No linked Account.')
    expect(host.querySelectorAll('[data-testid^="tb-buyer-select-"]')).toHaveLength(0)
  })
})
