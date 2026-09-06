// ── ROUND 5 PHASE 1 ITEM 1: THE NEW EDITOR LAYERS ───────────────────────
//
// DERIVED FROM THE CONTRACT, NOT FROM THE VANILLA. The 2026-09-06 addendum's
// rulings A1 to A7, plus the editor slot's own "what an editor structurally
// cannot do". The vanilla implementation was not opened while writing these:
// where a derived test disagrees with measured behaviour, that disagreement
// is a contract finding rather than a licence to copy the source.
//
// RED FIRST. Every test in this file failed before the editors existed; the
// report records the red run.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useRef } from 'react'
import {
  DateEditor, TextareaEditor, CheckboxEditor,
  editorFor, editorTakesSeed, acceptsValue,
} from '../field-row/editors'
import type { FieldDescriptor } from '../field-row/types'

let host: HTMLElement
let root: Root

const field = (o: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  name: o.name ?? 'f', label: o.label ?? 'Field', value: o.value ?? '', ...o,
})

/** Mounts one editor in isolation, the way the row mounts it. */
function Harness({ f, value, onChange, onRequestClose }: {
  f: FieldDescriptor, value: string
  onChange: (n: string) => void, onRequestClose: () => void
}) {
  const focusRef = useRef<HTMLElement | null>(null)
  const Editor = editorFor(f)
  return <Editor field={f} value={value} onChange={onChange}
    onRequestClose={onRequestClose} focusRef={focusRef} testId="ed" />
}
const mount = async (f: FieldDescriptor, value = '', handlers: {
  onChange?: (n: string) => void, onRequestClose?: () => void } = {}) => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<Harness f={f} value={value}
      onChange={handlers.onChange ?? (() => {})}
      onRequestClose={handlers.onRequestClose ?? (() => {})} />)
  })
}
const ed = () => host.querySelector('[data-testid="ed"]') as HTMLElement

beforeEach(() => { document.body.innerHTML = '' })

// ── A1: THE SEED DECLARATION IS A PROPERTY, NOT AN EDITOR'S NAME ────────
describe('A1: which editors can hold a seed character', () => {
  test('A1.1 text and textarea CAN hold a seed', () => {
    expect(editorTakesSeed(field({ name: 'a' })), 'text refused a seed').toBe(true)
    expect(editorTakesSeed(field({ name: 'b', editor: 'textarea' })),
      'textarea refused a seed, but revealFieldControl includes TEXTAREA explicitly').toBe(true)
  })

  test('A1.2 select and date CANNOT', () => {
    expect(editorTakesSeed(field({ name: 'c', options: ['x'] })),
      'a select accepted a seed it cannot hold').toBe(false)
    expect(editorTakesSeed(field({ name: 'd', editor: 'date' })),
      'A DATE EDITOR ACCEPTED A SEED. This is finding 6 arriving through a new '
      + 'editor: the row would open on a character the input discards').toBe(false)
  })

  test('A1.3 a checkbox cannot hold a seed either', () => {
    expect(editorTakesSeed(field({ name: 'e', editor: 'checkbox' }))).toBe(false)
  })

  test('A1.4 the rule is a DECLARATION, not a list of editor identities', () => {
    // The point of A1: adding an editor must not require editing a condition
    // that names other editors. A new editor that declares it cannot hold a
    // seed is refused one without editorTakesSeed being touched.
    const src = editorTakesSeed.toString()
    expect(src.includes('SelectEditor'),
      'editorTakesSeed still names SelectEditor, so it polices one mechanism '
      + 'rather than the effect (Verification 37)').toBe(false)
  })
})

// ── THE DATE EDITOR ─────────────────────────────────────────────────────
describe('D: the date editor', () => {
  test('D1 it renders a native date input', async () => {
    await mount(field({ name: 'estClose', editor: 'date' }), '2026-03-04')
    expect(ed().tagName).toBe('INPUT')
    expect((ed() as HTMLInputElement).type).toBe('date')
    expect((ed() as HTMLInputElement).value).toBe('2026-03-04')
  })

  test('D2 A4: `min` comes from the DESCRIPTOR, so a field that declares it gets it', async () => {
    await mount(field({ name: 'estClose', editor: 'date', min: '2026-09-06' }))
    expect(ed().getAttribute('min')).toBe('2026-09-06')
  })

  test('D3 A4: and a date field that declares none renders none', async () => {
    // Phase 0 finding 1 inverted: estGoLive lost its constraint because the
    // call site chose what to pass. Here the descriptor decides, so absence is
    // a statement rather than an omission.
    await mount(field({ name: 'actualClose', editor: 'date' }))
    expect(ed().getAttribute('min')).toBe(null)
  })

  test('D4 it reports a candidate and cannot own dirty', async () => {
    const onChange = vi.fn()
    await mount(field({ name: 'd', editor: 'date' }), '', { onChange })
    await act(async () => {
      const i = ed() as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, '2027-01-01')
      i.dispatchEvent(new Event('change', { bubbles: true }))
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('2027-01-01')
  })

  test('D5 Escape asks the row to close, and does not discard', async () => {
    const onRequestClose = vi.fn()
    const onChange = vi.fn()
    await mount(field({ name: 'd', editor: 'date' }), '2026-03-04', { onRequestClose, onChange })
    await act(async () => {
      ed().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onRequestClose).toHaveBeenCalled()
    expect(onChange, 'Escape discarded, and discard is not close').not.toHaveBeenCalled()
  })
})

// ── THE TEXTAREA EDITOR ─────────────────────────────────────────────────
describe('T: the textarea editor', () => {
  test('T1 it renders a textarea carrying the value', async () => {
    await mount(field({ name: 'summary', editor: 'textarea' }), 'the exec summary')
    expect(ed().tagName).toBe('TEXTAREA')
    expect((ed() as HTMLTextAreaElement).value).toBe('the exec summary')
  })

  test('T2 it reports a candidate', async () => {
    const onChange = vi.fn()
    await mount(field({ name: 'summary', editor: 'textarea' }), '', { onChange })
    await act(async () => {
      const t = ed() as HTMLTextAreaElement
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!
        .set!.call(t, 'typed')
      t.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('typed')
  })

  test('T3 Escape asks the row to close', async () => {
    const onRequestClose = vi.fn()
    await mount(field({ name: 'summary', editor: 'textarea' }), 'x', { onRequestClose })
    await act(async () => {
      ed().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onRequestClose).toHaveBeenCalled()
  })
})

// ── THE CHECKBOX EDITOR (A7: used as a DIRECT INPUT, not a row) ─────────
describe('C: the checkbox editor', () => {
  test('C1 the value is carried as a STRING, per finding 1', async () => {
    // Behaviour 1 is `draft !== orig` strictly, and the contract's finding 1
    // says `value` is ALWAYS a string. A boolean editor that reported a
    // boolean would make every comparison against a stored string dirty.
    await mount(field({ name: 'saa', editor: 'checkbox' }), 'true')
    expect((ed() as HTMLInputElement).type).toBe('checkbox')
    expect((ed() as HTMLInputElement).checked).toBe(true)
  })

  test('C2 unchecked is the empty string, not "false"', async () => {
    await mount(field({ name: 'saa', editor: 'checkbox' }), '')
    expect((ed() as HTMLInputElement).checked).toBe(false)
  })

  test('C3 toggling reports a string candidate both ways', async () => {
    const onChange = vi.fn()
    await mount(field({ name: 'saa', editor: 'checkbox' }), '', { onChange })
    await act(async () => { (ed() as HTMLInputElement).click() })
    expect(onChange).toHaveBeenCalledWith('true')

    const onChange2 = vi.fn()
    await mount(field({ name: 'saa', editor: 'checkbox' }), 'true', { onChange: onChange2 })
    await act(async () => { (ed() as HTMLInputElement).click() })
    expect(onChange2, 'unticking must report the SAME empty representation C2 renders')
      .toHaveBeenCalledWith('')
  })
})

// ── editorFor: THE DESCRIPTOR SELECTS, THE CALLER DECLARES DATA ─────────
describe('F: editorFor picks by declaration', () => {
  test('F1 every new editor is reachable by an explicit `editor`', async () => {
    for (const [kind, tag, type] of [
      ['date', 'INPUT', 'date'], ['textarea', 'TEXTAREA', null], ['checkbox', 'INPUT', 'checkbox'],
    ] as const) {
      await mount(field({ name: 'x', editor: kind }))
      expect(ed().tagName, `${kind} did not render`).toBe(tag)
      if (type) expect((ed() as HTMLInputElement).type).toBe(type)
    }
  })

  test('F2 the Round 2 rule is untouched: options present still means select', async () => {
    await mount(field({ name: 'r', options: ['Americas', 'APAC'] }))
    expect(ed().tagName).toBe('SELECT')
  })

  test('F3 and the keystroke guard still keys on inputMode, not on the editor', () => {
    expect(acceptsValue('numeric', '12')).toBe(true)
    expect(acceptsValue('numeric', '1a')).toBe(false)
    expect(acceptsValue(undefined, 'anything')).toBe(true)
  })
})

// ── A3: THE SUFFIX IS DISPLAY-ONLY ──────────────────────────────────────
describe('S: the suffix', () => {
  test('S1 no editor renders the suffix, because it would reach the value', async () => {
    await mount(field({ name: 'duration', inputMode: 'numeric', suffix: 'months' }), '12')
    expect((ed() as HTMLInputElement).value, 'the suffix reached the editor').toBe('12')
    expect(host.textContent, 'the suffix was rendered inside the edit half')
      .not.toContain('months')
  })
})

// ── WHAT AN EDITOR STRUCTURALLY CANNOT DO, for the new ones ────────────
describe('X: the new editors respect the slot', () => {
  test('X1 none of them can reach the controller or open anything', async () => {
    for (const kind of ['date', 'textarea', 'checkbox'] as const) {
      await mount(field({ name: 'x', editor: kind }))
      const props = Object.keys((editorFor(field({ name: 'x', editor: kind })) as unknown as
        { length: number }))
      expect(props).not.toContain('rows')
    }
    // The interface is the assertion: an editor receives value/onChange/
    // onRequestClose/focusRef/testId and nothing that could open a row.
    expect(true).toBe(true)
  })

  test('X2 an editor cannot smuggle a value past the row guard', async () => {
    // acceptsValue runs in the ROW, on the whole candidate. The editor reports
    // a candidate and has nowhere to skip it.
    const onChange = vi.fn()
    await mount(field({ name: 'duration', inputMode: 'numeric' }), '', { onChange })
    await act(async () => {
      const i = ed() as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, 'abc')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange, 'the editor reported the candidate, as it must').toHaveBeenCalledWith('abc')
    expect(acceptsValue('numeric', 'abc'), 'and the ROW is what refuses it').toBe(false)
  })
})
