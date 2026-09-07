// ── THE LINK-ACCOUNT PANEL ───────────────────────────────────────────────
//
// Derived from the Phase 0 enumeration and the Account parent-link precedent.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { LinkAccountPanel, findAccountMatches } from '../contact/LinkAccountPanel'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let posts: Array<{ path: string, body: unknown }> = []
let reply: { ok: boolean, status?: number, data?: unknown } = { ok: true, status: 200 }
let resolveNext: (() => void) | null = null

const ACCOUNTS = [
  { id: 'a-1', name: 'Changi Holdings' },
  { id: 'a-2', name: 'Marina Port' },
]

const services: ShellServices = {
  api: (async (_m: string, path: string, body?: unknown) => {
    posts.push({ path, body })
    // A HELD PROMISE, so a second click can be attempted while the first is
    // genuinely outstanding. Without it the guard is never actually exercised.
    if (resolveNext) await new Promise<void>((r) => { resolveNext = r })
    return reply
  }) as ShellServices['api'],
  navigate: vi.fn(), detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p: () => void) => { p() },
}

let linked = 0
let discardAsks = 0
const mount = async (hasDirtyEdits = false) => {
  posts = []; linked = 0; discardAsks = 0
  reply = { ok: true, status: 200 }
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <ShellProvider services={services}>
        <LinkAccountPanel
          contactId="c-1"
          accounts={ACCOUNTS}
          hasDirtyEdits={hasDirtyEdits}
          onConfirmDiscard={(proceed) => { discardAsks++; proceed() }}
          onLinked={() => { linked++ }} />
      </ShellProvider>)
  })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const e = $(id); if (!e) throw new Error(`no ${id}`); return e }
const click = async (id: string) => { await act(async () => { must(id).click() }) }
const type = async (v: string) => {
  await act(async () => {
    const i = must('cd-link-search') as HTMLInputElement
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(i, v)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => { document.body.innerHTML = ''; resolveNext = null })

describe('the search', () => {
  test('one substring definition, shared by both callers', () => {
    // The automatic open on a blocked qualify and the manual search must not
    // disagree about what "matches" means.
    expect(findAccountMatches('changi', ACCOUNTS).map((a) => a.id)).toEqual(['a-1'])
    expect(findAccountMatches('PORT', ACCOUNTS).map((a) => a.id)).toEqual(['a-2'])
    expect(findAccountMatches('   ', ACCOUNTS)).toEqual([])
    expect(findAccountMatches('nothing here', ACCOUNTS)).toEqual([])
  })

  test('the panel opens from a control and lists matches', async () => {
    await mount()
    await click('cd-btn-link-account')
    await type('changi')
    expect($('cd-link-a-1')).not.toBeNull()
    expect($('cd-link-a-2')).toBeNull()
  })

  test('no match offers CREATE, which is the same write not a second path', async () => {
    await mount()
    await click('cd-btn-link-account')
    await type('Brand New Co')
    await click('cd-link-create')
    expect(posts).toHaveLength(1)
    expect(posts[0].body).toEqual({ new_account_name: 'Brand New Co' })
  })
})

describe('the write', () => {
  test('linking lands IMMEDIATELY, on its own route', async () => {
    await mount()
    await click('cd-btn-link-account')
    await type('changi')
    await click('cd-link-a-1')
    expect(posts).toHaveLength(1)
    expect(posts[0].path).toContain('/link-account')
    expect(posts[0].body).toEqual({ account_id: 'a-1' })
    expect(linked, 'the surface was not told to reload').toBe(1)
  })

  test('a refusal is SHOWN and the panel stays open', async () => {
    await mount()
    reply = { ok: false, status: 400, data: { error: 'That Account is archived.' } }
    await click('cd-btn-link-account')
    await type('changi')
    await click('cd-link-a-1')
    expect(must('cd-link-error').textContent).toBe('That Account is archived.')
    expect($('cd-link-search'), 'the panel closed on a failure').not.toBeNull()
    expect(linked).toBe(0)
  })

  test('THE IN-FLIGHT GUARD IS REAL: a second click while outstanding sends nothing', async () => {
    // Round 4's finding applied: `if (inFlight) return` against STATE cannot
    // fire, because two clicks in one tick read the same stale closure value.
    // The promise is held open so the second click happens while the first is
    // genuinely in flight, which is the only way to exercise this at all.
    await mount()
    await click('cd-btn-link-account')
    await type('changi')
    resolveNext = () => {}
    await act(async () => {
      must('cd-link-a-1').click()
      must('cd-link-a-1').click()
    })
    expect(posts, 'a second request went out while the first was in flight').toHaveLength(1)
    await act(async () => { resolveNext?.(); resolveNext = null })
  })

  test('C6: the DIRTY path guards too, which the vanilla does not', async () => {
    // The vanilla checks the flag and then returns before setting it, so two
    // rapid clicks while dirty both open the discard dialogue.
    await mount(true)
    await click('cd-btn-link-account')
    await type('changi')
    resolveNext = () => {}
    await act(async () => {
      must('cd-link-a-1').click()
      must('cd-link-a-1').click()
    })
    expect(discardAsks, 'the discard dialogue was opened twice').toBe(1)
    await act(async () => { resolveNext?.(); resolveNext = null })
  })

  test('a dirty surface ASKS before linking, and links when told to', async () => {
    await mount(true)
    await click('cd-btn-link-account')
    await type('changi')
    await click('cd-link-a-1')
    expect(discardAsks).toBe(1)
    expect(posts).toHaveLength(1)
  })

  test('cancel closes and writes nothing', async () => {
    await mount()
    await click('cd-btn-link-account')
    await type('changi')
    await click('cd-link-cancel')
    expect($('cd-link-search')).toBeNull()
    expect(posts).toHaveLength(0)
  })
})
