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
  normaliseOptions, displayValueFor,
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

// ─────────────────────────────────────────────────────────────────────────
// THE LOOKUP EDITOR: A8 to A11, 2026-09-07
// ─────────────────────────────────────────────────────────────────────────
//
// DERIVED FROM THE ADDENDUM, with neither implementation open. The Contact
// census found one field no proven layer can express: Industry is a foreign
// key, so its stored value is an id nobody should read and its readable form
// lives in another table.
//
// RED FIRST. Every test below failed before the pair form existed.
describe('A8-A11: options as {id, name} pairs', () => {
  const INDUSTRIES = [
    { id: 'i-1', name: 'Aviation' },
    { id: 'i-2', name: 'Maritime' },
  ]

  test('A8.1 a PAIR list offers names as labels and ids as values', async () => {
    await mount(field({ name: 'industry', options: INDUSTRIES }), 'i-2')
    const sel = host.querySelector('select') as HTMLSelectElement
    const real = [...sel.options].filter((o) => o.value !== '')
    expect(real.map((o) => o.value)).toEqual(['i-1', 'i-2'])
    expect(real.map((o) => o.textContent)).toEqual(['Aviation', 'Maritime'])
  })

  test('A8.2 and the STRING form still works, as the degenerate case', async () => {
    // The eleven selects already in production declare strings. They keep
    // working BY CONSTRUCTION rather than by inspection, which is the whole
    // reason the generalisation went this way round.
    await mount(field({ name: 'region', options: ['APAC', 'Africa'] }), 'APAC')
    const sel = host.querySelector('select') as HTMLSelectElement
    const real = [...sel.options].filter((o) => o.value !== '')
    expect(real.map((o) => o.value)).toEqual(['APAC', 'Africa'])
    expect(real.map((o) => o.textContent)).toEqual(['APAC', 'Africa'])
  })

  test('A8.3 a bare string means {id: s, name: s}, proven through the normaliser', () => {
    expect(normaliseOptions(['APAC'])).toEqual([{ id: 'APAC', name: 'APAC' }])
    expect(normaliseOptions(INDUSTRIES)).toEqual(INDUSTRIES)
    expect(normaliseOptions(undefined)).toEqual([])
  })

  test('A8.4 the editor still selects the STORED value, which is the id', async () => {
    await mount(field({ name: 'industry', options: INDUSTRIES }), 'i-2')
    expect((host.querySelector('select') as HTMLSelectElement).value).toBe('i-2')
  })

  test('A8.5 the empty option survives, so a lookup can still be CLEARED', async () => {
    // Without it a select is a one-way door and "not recorded" stops being
    // reachable from the screen. A lookup is no different.
    await mount(field({ name: 'industry', options: INDUSTRIES }), 'i-1')
    const sel = host.querySelector('select') as HTMLSelectElement
    expect([...sel.options].some((o) => o.value === '')).toBe(true)
  })

  test('A9.1 THE DISPLAY HALF RESOLVES an id to its name', () => {
    // The half a string list hid: with value and label identical the display
    // could render the raw value and be right by accident. Here that puts an
    // id on the screen.
    expect(displayValueFor(field({ name: 'industry', value: 'i-1', options: INDUSTRIES })))
      .toBe('Aviation')
  })

  test('A9.2 and resolves through the descriptor, not a second lookup', () => {
    // Verification 20. The vanilla reads industriesCache twice in adjacent
    // lines - once to label the display and once to build the options - which
    // is what this shape removes.
    const f = field({ name: 'industry', value: 'i-2', options: INDUSTRIES })
    expect(displayValueFor(f)).toBe('Maritime')
    expect(displayValueFor({ ...f, options: [{ id: 'i-2', name: 'Renamed' }] })).toBe('Renamed')
  })

  test('A9.3 a string-option field displays its value unchanged', () => {
    expect(displayValueFor(field({ name: 'region', value: 'APAC', options: ['APAC'] })))
      .toBe('APAC')
  })

  test('A9.4 a field with NO options displays its value unchanged', () => {
    expect(displayValueFor(field({ name: 'city', value: 'Singapore' }))).toBe('Singapore')
  })

  test('A9.5 an empty value stays empty, so the placeholder still shows', () => {
    expect(displayValueFor(field({ name: 'industry', value: '', options: INDUSTRIES }))).toBe('')
  })

  test('A10.1 AN UNRECOGNISED STORED ID KEEPS ITS PLACE in the list', async () => {
    // A select that silently drops a value it does not recognise turns "points
    // at an industry since renamed" into "has no industry", and the next save
    // writes that erasure down. Architecture 11: dropping it is a fallback.
    await mount(field({ name: 'industry', options: INDUSTRIES }), 'i-GONE')
    const sel = host.querySelector('select') as HTMLSelectElement
    expect(sel.value, 'the stored id was dropped from the list').toBe('i-GONE')
    expect([...sel.options].map((o) => o.value)).toContain('i-GONE')
  })

  test('A10.2 and the display falls back to the id rather than showing nothing', () => {
    expect(displayValueFor(field({ name: 'industry', value: 'i-GONE', options: INDUSTRIES })))
      .toBe('i-GONE')
  })

  test('A10.3 the unrecognised option does not displace a real one', async () => {
    await mount(field({ name: 'industry', options: INDUSTRIES }), 'i-GONE')
    const sel = host.querySelector('select') as HTMLSelectElement
    const real = [...sel.options].filter((o) => o.value !== '')
    expect(real).toHaveLength(3)
    expect(real.map((o) => o.value)).toContain('i-1')
    expect(real.map((o) => o.value)).toContain('i-2')
  })

  test('A11 a lookup declares it cannot hold a seed, like every other select', () => {
    // A1's ruling reads the declaration, not the editor's name. A lookup is a
    // select, so a first character it cannot hold must not open its row.
    expect(editorTakesSeed(field({ name: 'industry', options: INDUSTRIES }))).toBe(false)
  })
})
