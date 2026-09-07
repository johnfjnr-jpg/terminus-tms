// ── THE REST: the rendered half ─────────────────────────────────────────
//
// Round 7 Phase 2d session 3. One root, re-rendered.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ConvertPanel } from '../testbed/ConvertPanel'

let host: HTMLElement
let root: Root
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => { (q(id) as HTMLElement).click(); await Promise.resolve() })
}
const type = async (id: string, value: string) => {
  await act(async () => {
    const el = q(id) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = (over: Partial<Parameters<typeof ConvertPanel>[0]> = {}) => {
  const props = {
    onConvert: vi.fn(async () => ({ ok: true, data: { id: 'opp-9' }, error: null })),
    onOpen: vi.fn(),
    ...over,
  }
  act(() => { root.render(<ConvertPanel {...props} />) })
  return props
}

describe('X: the convert form', () => {
  test('X2 it is a DISCLOSURE: the trigger reveals it', async () => {
    mount()
    expect(q('tb-convert-form-wrap'), 'the form was open before anybody asked').toBeNull()
    await click('tb-convert-trigger')
    expect(q('tb-convert-form-wrap')).toBeTruthy()
  })

  test('X1 a blank name is refused BEFORE any request', async () => {
    const p = mount()
    await click('tb-convert-trigger')
    await click('tb-convert-submit')
    expect(p.onConvert, 'a blank conversion reached the server').not.toHaveBeenCalled()
    expect(q('tb-convert-feedback')?.textContent).toMatch(/Opportunity name is required/)
  })

  test('X1 a real name is trimmed and sent', async () => {
    const p = mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', '  New deal  ')
    await click('tb-convert-submit')
    expect(p.onConvert).toHaveBeenCalledWith({ opportunity_name: 'New deal' })
  })

  test('X2/X3 success hides the form and OFFERS the new record', async () => {
    const p = mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'New deal')
    await click('tb-convert-submit')
    expect(q('tb-convert-form-wrap'), 'the form stayed open after a conversion').toBeNull()
    expect(q('tb-convert-feedback')?.textContent).toMatch(/Opportunity created/)
    await click('tb-convert-view')
    expect(p.onOpen, 'the offer did not lead anywhere').toHaveBeenCalledWith('opp-9')
  })

  test('X3 nothing navigates on its own', async () => {
    const p = mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'New deal')
    await click('tb-convert-submit')
    expect(p.onOpen, 'the conversion navigated without being asked').not.toHaveBeenCalled()
  })

  test('a REFUSAL keeps the form open and shows the server\'s own sentence', async () => {
    mount({
      onConvert: vi.fn(async () => ({
        ok: false, data: null,
        error: 'This Test Bed has already been converted to an Opportunity',
      })),
    })
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'Second go')
    await click('tb-convert-submit')
    expect(q('tb-convert-feedback')?.textContent)
      .toMatch(/already been converted/)
    expect(q('tb-convert-form-wrap'),
      'a refused conversion closed the form, losing the typed name').toBeTruthy()
    expect((q('tb-opp-name') as HTMLInputElement).value).toBe('Second go')
    expect(q('tb-convert-view'), 'a refusal offered a record to view').toBeNull()
  })

  test('X4 cancel clears the name AND the feedback', async () => {
    mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'Typed')
    await click('tb-convert-submit')
    // Reopen after a success, then cancel: nothing from last time survives.
    await click('tb-convert-trigger')
    expect((q('tb-opp-name') as HTMLInputElement).value,
      'the previous name survived into a new attempt').toBe('Typed')
    await click('tb-convert-cancel')
    await click('tb-convert-trigger')
    expect((q('tb-opp-name') as HTMLInputElement).value).toBe('')
    expect(q('tb-convert-feedback'), 'the last attempt\'s message survived a cancel').toBeNull()
  })

  test('re-navigation: WITHOUT a key the open form follows the operator', async () => {
    // The shell re-renders rather than mounting, so local UI state persists by
    // design. This is the state the host's `key={bed.id}` exists to prevent,
    // asserted so the fix below is measured against a real failure rather than
    // against nothing.
    mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'Typed')
    act(() => { root.render(<ConvertPanel onConvert={vi.fn()} onOpen={vi.fn()} />) })
    expect(q('tb-convert-form-wrap'),
      'the form closed on its own, so the key below asserts nothing').toBeTruthy()
    expect((q('tb-opp-name') as HTMLInputElement).value).toBe('Typed')
  })

  test('re-navigation: a CHANGED key gives the second record a closed, empty form', async () => {
    mount()
    await click('tb-convert-trigger')
    await type('tb-opp-name', 'Typed')
    act(() => { root.render(<ConvertPanel key="tb-2" onConvert={vi.fn()} onOpen={vi.fn()} />) })
    expect(q('tb-convert-form-wrap'),
      'the second record inherited the first record\'s open form').toBeNull()
  })
})
