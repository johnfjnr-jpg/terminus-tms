// ── THE SHARED SHELL: THE PRINCIPLE, S1 TO S5, AND SECTIONS 4 AND 5 ──────
//
// DERIVED FROM THE CONTRACT, not from the components. The claims come from
// the governing principle, John's S1 to S5, and INTERACTION_STANDARDS
// Sections 4 and 5 - not from reading Panel.tsx and writing down what it
// does, which is how a suite goes green on its first run and proves nothing.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Panel, PanelHeader } from '../ui/Panel'
import { SaveControl } from '../ui/SaveControl'
import { Modal, ModalClose } from '../ui/Modal'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let discardAsks = 0
let discardProceed: (() => void) | null = null
let confirmOpen = false

const services: ShellServices = shellServices({
  api: (async () => ({ ok: true, status: 200 })) as ShellServices['api'],
  navigate: vi.fn(), detailLoaded: vi.fn(),
  currentUserEmail: () => 'probe@example.invalid',
  // The SHELL owns the shared discard dialogue. Section 5 is explicit that it
  // is defined once and reused, "the strongest guarantee they can't drift
  // apart", so the test drives the seam rather than a second dialogue.
  confirmDiscard: (p: () => void) => { discardAsks++; discardProceed = p; confirmOpen = true },
})

beforeEach(() => {
  discardAsks = 0; discardProceed = null; confirmOpen = false
  document.body.innerHTML = '<div id="opener-outside"><button id="the-opener">open</button></div>'
    + '<div id="host"></div>'
  host = document.getElementById('host')!
  // `app.js` publishes this; the Modal's inert-guard reads it through window.
  ;(window as unknown as { discardConfirmIsOpen: () => boolean }).discardConfirmIsOpen =
    () => confirmOpen
})
const mount = async (node: React.ReactNode) => {
  root = createRoot(host)
  await act(async () => { root.render(<ShellProvider services={services}>{node}</ShellProvider>) })
}
const $ = (t: string) => document.querySelector(`[data-testid="${t}"]`) as HTMLElement | null
const must = (t: string) => { const e = $(t); if (!e) throw new Error(`no ${t}`); return e }
const key = async (k: string, shift = false) => {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true }))
  })
}

describe('THE PRINCIPLE: a panel cannot place its action anywhere but the header', () => {
  test('P1 a Panel renders a header, always - there is no headerless Panel', async () => {
    await mount(<Panel name="x" title="Summary" testid="p">body</Panel>)
    const head = host.querySelector('[data-panel-header]')
    expect(head, 'a Panel rendered without a header line').not.toBeNull()
    expect(head!.querySelector('[data-panel-title]')!.textContent).toBe('Summary')
  })

  test('P2 actions land INSIDE the header line, not in the body', async () => {
    // S1. The point of the shell: the only slot for an action is the header's,
    // so "Save below the field" is not a mistake a panel can make.
    await mount(
      <Panel name="x" title="Summary" testid="p"
        actions={<button type="button" className="btn-sm" data-testid="act">Save</button>}>
        <textarea data-testid="fld" />
      </Panel>)
    const head = host.querySelector('[data-panel-header]')!
    const body = host.querySelector('.panel-body')!
    expect(head.contains(must('act')), 'the action is not on the header line').toBe(true)
    expect(body.contains(must('act')), 'the action leaked into the body').toBe(false)
    expect(body.contains(must('fld'))).toBe(true)
  })

  test('P3 the header order is title, secondary, actions', async () => {
    // S2, asserted as an ORDER between three elements rather than as three
    // separate presence checks - a presence check passes on any arrangement.
    await mount(
      <PanelHeader title="Notes" secondary="Latest first"
        actions={<button type="button" data-testid="act">Add</button>} testid="h" />)
    const kids = [...host.querySelector('[data-panel-header]')!.children]
    expect(kids.map((k) => k.className)).toEqual(['panel-title', 'panel-secondary', 'panel-actions'])
  })

  test('P4 a Panel announces itself to the registry, structurally', async () => {
    // Verification 19: the conformance census must not depend on a
    // hand-written list, because a list fails silently on the member nobody
    // added. `data-panel` is emitted by the shell, so a panel joins the
    // population by existing.
    await mount(<Panel name="notes" title="Notes">b</Panel>)
    expect(host.querySelector('[data-panel="notes"]')).not.toBeNull()
  })
})

describe('S4: one definition of dirty', () => {
  const ctl = (dirty: boolean) => (
    <SaveControl dirty={dirty} onSave={() => {}} onDiscard={() => {}} testidBase="t" />)

  test('S4a Save is disabled when clean and enabled when dirty', async () => {
    await mount(ctl(false))
    expect((must('t-save') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { root.render(<ShellProvider services={services}>{ctl(true)}</ShellProvider>) })
    expect((must('t-save') as HTMLButtonElement).disabled).toBe(false)
  })

  test('S4b Discard appears only when there is something to revert', async () => {
    await mount(ctl(false))
    expect($('t-discard'), 'a Discard with nothing to discard').toBeNull()
    await act(async () => { root.render(<ShellProvider services={services}>{ctl(true)}</ShellProvider>) })
    expect($('t-discard')).not.toBeNull()
  })

  test('S4c Discard precedes Save in the tab order', async () => {
    await mount(ctl(true))
    const order = [...host.querySelectorAll('button')].map((b) => b.dataset.testid)
    expect(order).toEqual(['t-discard', 't-save'])
  })
})

describe('SECTION 4: the focus trap lives in the Modal, once', () => {
  const dlg = (dirty = false) => (
    <Modal title="T" testid="m" regionId="m-region" dirty={dirty} onClose={() => {}}
      footer={(rc) => (<>
        <button type="button" className="btn-sm" data-testid="m-save">Save</button>
        <ModalClose onRequestClose={rc} regionId="m-region" testid="m-close" />
      </>)}>
      <input data-testid="m-first" />
      <input data-testid="m-second" />
    </Modal>)

  test('S4-1 focus moves to the first focusable element on open', async () => {
    document.getElementById('the-opener')!.focus()
    await mount(dlg())
    expect(document.activeElement).toBe(must('m-first'))
  })

  test('S4-2 focus returns to the control that opened it on close', async () => {
    const opener = document.getElementById('the-opener')!
    opener.focus()
    await mount(dlg())
    expect(document.activeElement).not.toBe(opener)
    await act(async () => { root.unmount() })
    expect(document.activeElement).toBe(opener)
  })

  test('S4-3 Tab from the LAST element wraps to the first, not out of the dialogue', async () => {
    await mount(dlg())
    must('m-close').focus()
    await key('Tab')
    expect(document.activeElement).toBe(must('m-first'))
  })

  test('S4-4 Shift+Tab from the FIRST wraps to the last', async () => {
    await mount(dlg())
    must('m-first').focus()
    await key('Tab', true)
    expect(document.activeElement).toBe(must('m-close'))
  })

  test('S4-5 Escape closes it, by the same path as the dismiss control', async () => {
    let closed = 0
    await mount(
      <Modal title="T" testid="m" regionId="m-region" onClose={() => { closed++ }}
        footer={() => <button type="button" data-testid="m-x">x</button>}>
        <input data-testid="m-first" />
      </Modal>)
    await key('Escape')
    expect(closed).toBe(1)
  })
})

describe('SECTION 5: two mechanisms, deliberately different', () => {
  const dlg = (dirty: boolean, onClose = () => {}) => (
    <Modal title="T" testid="m" regionId="m-region" dirty={dirty} onClose={onClose}
      footer={(rc) => <ModalClose onRequestClose={rc} regionId="m-region" testid="m-close" />}>
      <input data-testid="m-first" />
    </Modal>)

  test('S5-1 a backdrop click while CLEAN closes immediately', async () => {
    let closed = 0
    await mount(dlg(false, () => { closed++ }))
    await act(async () => { must('m').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(closed).toBe(1)
  })

  test('S5-2 a backdrop click while DIRTY is refused AND nudges', async () => {
    // Phase 0 found the refusal working and SILENT, which is the one
    // combination Section 5 argues against: the person clicks, nothing
    // happens, and nothing says why. Both halves asserted.
    let closed = 0
    await mount(dlg(true, () => { closed++ }))
    expect(must('m-nudge').hidden, 'the nudge was showing before any click').toBe(true)
    await act(async () => { must('m').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(closed, 'the backdrop click was not refused').toBe(0)
    expect(must('m-nudge').hidden, 'refused SILENTLY - no nudge').toBe(false)
  })

  test('S5-3 an INTENTIONAL leave while dirty asks the SHARED dialogue first', async () => {
    let closed = 0
    await mount(dlg(true, () => { closed++ }))
    await act(async () => { must('m-close').click() })
    expect(discardAsks, 'it closed without asking - the data-loss path').toBe(1)
    expect(closed, 'it closed before the answer came back').toBe(0)
    await act(async () => { discardProceed!() })
    expect(closed).toBe(1)
  })

  test('S5-4 Escape while dirty takes the SAME path, not a second one', async () => {
    let closed = 0
    await mount(dlg(true, () => { closed++ }))
    await key('Escape')
    expect(discardAsks).toBe(1)
    expect(closed).toBe(0)
  })

  test('S5-5 while the shared dialogue is open this handler is INERT', async () => {
    // The document's own guard: one Escape must not fire both handlers in
    // the same tick.
    let closed = 0
    await mount(dlg(true, () => { closed++ }))
    await key('Escape')
    expect(discardAsks).toBe(1)
    await key('Escape')
    expect(discardAsks, 'a second Escape reached the modal while the confirm was open').toBe(1)
  })

  test('S5-6 the dismiss control names a REAL region, so its door exemption is true', async () => {
    // R3. The door exempts [aria-controls] by PRESENCE, so a pointer naming
    // nothing grants the exemption anyway.
    await mount(dlg(false))
    const target = must('m-close').getAttribute('aria-controls')!
    expect(document.getElementById(target), `aria-controls names "${target}", which does not exist`)
      .not.toBeNull()
  })
})
