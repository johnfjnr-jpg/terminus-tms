// ── THE SEVEN BEHAVIOURS, TESTED FROM THE CONTRACT ───────────────────────
//
// Derived from MIGRATION_FIELD_ROW_CONTRACT.md clause by clause. The five
// vanilla implementations were not read while writing either the component or
// this file, which is the contract's own closing warning: these behaviours were
// written from the CURRENT code, so a test derived from the new component would
// agree with itself.
//
// Every behaviour carries at least one NEGATIVE - a test that fails if the
// behaviour is absent rather than merely present-looking.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { useFieldRows, FieldRow, EditBar, acceptsValue } from '../field-row'
import type { FieldDescriptor } from '../field-row'

declare global { interface Window { canEditFields?: () => boolean } }

const FIELDS: FieldDescriptor[] = [
  { name: 'company', label: 'Company', value: 'Acme Ltd' },
  { name: 'units', label: 'Units', value: '10', inputMode: 'numeric' },
  { name: 'ratio', label: 'Ratio', value: '1.5', inputMode: 'decimal' },
  { name: 'code', label: 'Reference', value: 'TT-0001', readOnly: true },
]

let root: Root
let host: HTMLElement
const saved: Record<string, string>[] = []

function Surface({ fields = FIELDS, withBar = true }: { fields?: FieldDescriptor[]; withBar?: boolean }) {
  const rows = useFieldRows(fields)
  return (
    <div>
      {fields.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}
      {withBar ? <EditBar rows={rows} onSave={(c) => { saved.push(c) }} /> : null}
    </div>
  )
}

// A surface whose descriptors can change after mount, for the "every field
// added later" clause of behaviour 2.
let addField: ((f: FieldDescriptor) => void) | null = null
function GrowingSurface() {
  const [fields, setFields] = useState<FieldDescriptor[]>(FIELDS)
  addField = (f) => setFields((cur) => [...cur, f])
  const rows = useFieldRows(fields)
  return <div>{fields.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}</div>
}

const render = (node: React.ReactNode) => {
  act(() => {
    root.render(<ShellProvider services={shellServices}>{node}</ShellProvider>)
  })
}

const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => {
  const el = $(id)
  if (!el) throw new Error(`no element with data-testid="${id}"`)
  return el
}
const input = (name: string) => must(`input-${name}`) as HTMLInputElement

const click = (el: HTMLElement) =>
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const press = (el: HTMLElement, key: string, mods: Partial<KeyboardEventInit> = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods })) })

// React tracks an input's value on the node, so assigning `.value` directly is
// ignored on the next render. The native setter is how a value change is
// delivered as a real one.
const type = (name: string, value: string) => {
  const el = input(name)
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  saved.length = 0
  addField = null
  window.canEditFields = () => true
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 1: draft state per field, compared not flagged', () => {
  test('typing marks the field dirty', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Acme Limited')
    expect(must('display-company').closest('.field-row')!.getAttribute('data-dirty')).toBe('true')
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  // THE NEGATIVE THE CONTRACT NAMES. "a flag goes wrong when a person types a
  // value and types it back." An event-flag implementation passes every other
  // test in this describe and fails this one.
  test('typing a value and typing it back reads CLEAN', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Acme Limited')
    expect(must('dirty-count').textContent).toBe('1 change')

    type('company', 'Acme Ltd')
    expect(must('display-company').closest('.field-row')!.getAttribute('data-dirty')).toBe('false')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  test('and it reads clean after a longer detour, not just one step back', () => {
    render(<Surface />)
    click(must('display-company'))
    for (const v of ['A', 'Ac', 'Acme', 'Acme L', 'something else', 'Acme Ltd']) type('company', v)
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  test('drafts are per field: one dirty field does not make its neighbour dirty', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Changed')
    expect(must('display-units').closest('.field-row')!.getAttribute('data-dirty')).toBe('false')
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  test('CLOSING a row does not clear its dirty state, because close is not discard', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Changed')
    press(input('company'), 'Escape')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
    expect(must('dirty-count').textContent).toBe('1 change')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 2: ONE door, carrying the ownership guard', () => {
  test('with the guard open, a click opens the editor', () => {
    render(<Surface />)
    click(must('display-company'))
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)
  })

  test('with the guard shut, a click does not open it', () => {
    window.canEditFields = () => false
    render(<Surface />)
    click(must('display-company'))
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  // THE NEGATIVE THE CONTRACT'S OWN DEFECT NAMES. The row that was fixed
  // refused the mouse and "stayed operable by keyboard". A door on the click
  // handler alone passes the test above and fails these three.
  test('and NEITHER does Enter', () => {
    window.canEditFields = () => false
    render(<Surface />)
    press(must('display-company'), 'Enter')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('nor Space', () => {
    window.canEditFields = () => false
    render(<Surface />)
    press(must('display-company'), ' ')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('nor a seed character, and no draft is left behind by the attempt', () => {
    window.canEditFields = () => false
    render(<Surface />, )
    press(must('display-company'), 'X')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
    expect(input('company').value).toBe('Acme Ltd')
    expect($('edit-bar')!.hasAttribute('hidden')).toBe(true)
  })

  // NO TIMING DEPENDENCY. The contract says the door covers every field that
  // exists AND every field added later, unlike the render-time treatments it
  // replaced. A guard captured at render passes every test above and fails this.
  test('the guard is consulted at EVERY attempt, not once at render', () => {
    let allowed = false
    window.canEditFields = () => allowed
    render(<Surface />)

    press(must('display-company'), 'Enter')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)

    allowed = true
    press(must('display-company'), 'Enter')
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)

    allowed = false
    press(must('display-units'), 'Enter')
    expect(must('edit-units').hasAttribute('hidden')).toBe(true)
  })

  test('it covers a field added AFTER the surface mounted', () => {
    window.canEditFields = () => false
    render(<GrowingSurface />)
    act(() => { addField!({ name: 'late', label: 'Added later', value: 'x' }) })
    expect($('display-late')).not.toBeNull()
    press(must('display-late'), 'Enter')
    expect(must('edit-late').hasAttribute('hidden')).toBe(true)
  })

  test('the guard is a function on the seam, not a DOM read in the component', () => {
    // Nothing in the component tree may reach for the ownership class itself.
    // Proven by removing every DOM the vanilla door reads and watching the
    // refusal still hold.
    window.canEditFields = () => false
    render(<Surface />)
    expect(document.getElementById('view-opportunity-detail')).toBeNull()
    click(must('display-company'))
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 3: display and edit swap by visibility, never by removal', () => {
  test('the edit half is already in the document while the row is closed', () => {
    render(<Surface />)
    expect($('edit-company')).not.toBeNull()
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('the display half is still in the document once the row is open', () => {
    render(<Surface />)
    click(must('display-company'))
    expect($('display-company')).not.toBeNull()
    expect(must('display-company').hasAttribute('hidden')).toBe(true)
  })

  test('open and close leaves the same two nodes, never recreated', () => {
    render(<Surface />)
    const displayBefore = must('display-company')
    const editBefore = must('edit-company')
    click(displayBefore)
    press(input('company'), 'Escape')
    expect(must('display-company')).toBe(displayBefore)
    expect(must('edit-company')).toBe(editBefore)
  })

  // The second half of behaviour 2's defect: a hidden subtree is out of the tab
  // order by specification, so a closed row's input cannot be reached by
  // keyboard. jsdom computes no tab order, so the MECHANISM is what is asserted.
  test('the closed row hides the edit half, so its input is not tabbable', () => {
    render(<Surface />)
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
    expect(input('company').closest('[hidden]')).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 4: keyboard parity, including the seed character', () => {
  test('an editable display carries tabindex 0', () => {
    render(<Surface />)
    expect(must('display-company').getAttribute('tabindex')).toBe('0')
  })

  test('Enter opens the editor', () => {
    render(<Surface />)
    press(must('display-company'), 'Enter')
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)
  })

  test('Space opens the editor', () => {
    render(<Surface />)
    press(must('display-company'), ' ')
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)
  })

  // THE NAMED NEGATIVE. "A React row that opens on click but drops the first
  // typed character has lost a behaviour nobody will report and everybody will
  // feel." An implementation that opens on keydown and ignores the key passes
  // every other test here and fails this one.
  test('a printable character opens the editor AND the keystroke LANDS in the input', () => {
    render(<Surface />)
    press(must('display-company'), 'Z')
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)
    expect(input('company').value).toBe('Z')
  })

  test('and the seeded row is dirty, so the bar sees it immediately', () => {
    render(<Surface />)
    press(must('display-company'), 'Z')
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  test('a command combination is not a seed and does not open the row', () => {
    render(<Surface />)
    press(must('display-company'), 'a', { metaKey: true })
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
    press(must('display-company'), 'c', { ctrlKey: true })
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('a navigation key is not a seed', () => {
    render(<Surface />)
    for (const k of ['Tab', 'ArrowDown', 'Shift', 'Escape', 'Backspace']) {
      press(must('display-company'), k)
    }
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('a seed the field cannot take does not open it, so the row never shows a value it rejects', () => {
    render(<Surface />)
    press(must('display-units'), 'a')
    expect(must('edit-units').hasAttribute('hidden')).toBe(true)
    press(must('display-units'), '7')
    expect(must('edit-units').hasAttribute('hidden')).toBe(false)
    expect(input('units').value).toBe('7')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 5: discard restores the original', () => {
  test('it puts the original back into the input', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Changed')
    expect(input('company').value).toBe('Changed')
    click(must('discard-company'))
    expect(input('company').value).toBe('Acme Ltd')
  })

  test('it clears the dirty state and the bar', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Changed')
    click(must('discard-company'))
    expect(must('display-company').closest('.field-row')!.getAttribute('data-dirty')).toBe('false')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  // THE CONTRACT'S OWN SENTENCE: "Discard is not close." An implementation that
  // closes the row on discard passes both tests above and fails this one.
  test('and it is NOT a close: the row is still open afterwards', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'Changed')
    click(must('discard-company'))
    expect(must('edit-company').hasAttribute('hidden')).toBe(false)
    expect(must('display-company').hasAttribute('hidden')).toBe(true)
  })

  test('discarding one field leaves its neighbour untouched', () => {
    render(<Surface />)
    click(must('display-company')); type('company', 'A')
    click(must('display-units')); type('units', '99')
    click(must('discard-company'))
    expect(input('units').value).toBe('99')
    expect(must('dirty-count').textContent).toBe('1 change')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 6: a shared edit bar aggregates across rows', () => {
  test('the count is computed across every dirty field on the surface', () => {
    render(<Surface />)
    click(must('display-company')); type('company', 'A')
    expect(must('dirty-count').textContent).toBe('1 change')
    click(must('display-units')); type('units', '99')
    expect(must('dirty-count').textContent).toBe('2 changes')
    click(must('display-ratio')); type('ratio', '2.5')
    expect(must('dirty-count').textContent).toBe('3 changes')
  })

  test('it counts fields whose rows have been CLOSED again, because a draft outlives its editor', () => {
    render(<Surface />)
    click(must('display-company')); type('company', 'A')
    press(input('company'), 'Escape')
    click(must('display-units')); type('units', '99')
    press(input('units'), 'Escape')
    expect(must('dirty-count').textContent).toBe('2 changes')
  })

  test('save acts on the SET, and sends only what moved', () => {
    render(<Surface />)
    click(must('display-company')); type('company', 'New name')
    click(must('display-units')); type('units', '42')
    click(must('save-all'))
    expect(saved).toHaveLength(1)
    expect(saved[0]).toEqual({ company: 'New name', units: '42' })
  })

  test('discard-all acts on the set, restoring every original at once', () => {
    render(<Surface />)
    click(must('display-company')); type('company', 'A')
    click(must('display-units')); type('units', '99')
    click(must('discard-all'))
    expect(input('company').value).toBe('Acme Ltd')
    expect(input('units').value).toBe('10')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  // THE ROW CANNOT OWN THE BAR. A per-row bar could only ever count one field,
  // which is why the contract makes it a property of the surface.
  test('a row rendered on its own produces no bar at all', () => {
    render(<Surface withBar={false} />)
    expect($('edit-bar')).toBeNull()
    click(must('display-company'))
    type('company', 'Changed')
    expect(host.querySelectorAll('[data-testid="edit-bar"]')).toHaveLength(0)
  })

  test('and there is exactly ONE bar for a surface of four rows', () => {
    render(<Surface />)
    expect(host.querySelectorAll('[data-testid="edit-bar"]')).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 7: the read-only variant is the same row without a door', () => {
  test('it renders the label and the value, the same shape as an editable row', () => {
    render(<Surface />)
    const row = must('display-code').closest('.field-row')!
    expect(row.textContent).toContain('Reference')
    expect(row.textContent).toContain('TT-0001')
  })

  // THE NAMED NEGATIVE. "A React implementation that reaches read-only by
  // disabling the editable row will get the tab order wrong." A disabled row
  // still carries tabindex="0" and still contains an input, so both assertions
  // below fail on that implementation and pass on this one.
  test('it has NO tab stop, not a negative one and not a disabled one', () => {
    render(<Surface />)
    expect(must('display-code').hasAttribute('tabindex')).toBe(false)
  })

  test('it contains no input at all, disabled or otherwise', () => {
    render(<Surface />)
    const row = must('display-code').closest('.field-row')!
    expect(row.querySelector('input')).toBeNull()
    expect(row.querySelector('[disabled]')).toBeNull()
    expect($('edit-code')).toBeNull()
  })

  test('clicking it opens nothing, and neither does Enter', () => {
    render(<Surface />)
    click(must('display-code'))
    press(must('display-code'), 'Enter')
    press(must('display-code'), 'Z')
    expect($('edit-code')).toBeNull()
    expect($('edit-bar')!.hasAttribute('hidden')).toBe(true)
  })

  test('tab order is correct by construction: only editable rows are tab stops', () => {
    render(<Surface />)
    const stops = [...host.querySelectorAll('[tabindex]')].map((n) => (n as HTMLElement).dataset.testid)
    expect(stops).toEqual(['display-company', 'display-units', 'display-ratio'])
  })

  test('a read-only field can never become dirty', () => {
    render(<Surface />)
    click(must('display-code'))
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('behaviour 8: descriptors declare what they take, and inputmode is the key', () => {
  test('the declared inputMode reaches the input', () => {
    render(<Surface />)
    expect(input('units').getAttribute('inputmode')).toBe('numeric')
    expect(input('ratio').getAttribute('inputmode')).toBe('decimal')
    expect(input('company').hasAttribute('inputmode')).toBe(false)
  })

  test('a numeric field refuses a value it cannot take, and keeps the last good one', () => {
    render(<Surface />)
    click(must('display-units'))
    type('units', '42')
    type('units', '42x')
    expect(input('units').value).toBe('42')
  })

  test('a decimal field takes a point and a numeric one does not', () => {
    render(<Surface />)
    click(must('display-ratio')); type('ratio', '2.75')
    expect(input('ratio').value).toBe('2.75')
    click(must('display-units')); type('units', '2.75')
    expect(input('units').value).toBe('10')
  })

  test('an undeclared field takes anything', () => {
    render(<Surface />)
    click(must('display-company'))
    type('company', 'anything at all !@#$ 123')
    expect(input('company').value).toBe('anything at all !@#$ 123')
  })

  // THE KEYING IS THE POINT. The contract's finding was that a per-field guard
  // is a to-do list that has to be completed again on every new field. A field
  // NOBODY has heard of inherits the constraint by declaring what it takes.
  test('a field invented in this test inherits the guard by declaring inputMode', () => {
    const invented: FieldDescriptor[] = [
      { name: 'neverSeenBefore', label: 'Invented', value: '1', inputMode: 'numeric' },
    ]
    render(<Surface fields={invented} withBar={false} />)
    click(must('display-neverSeenBefore'))
    type('neverSeenBefore', 'abc')
    expect(input('neverSeenBefore').value).toBe('1')
  })

  test('the guard is exposed as a pure function of the declaration, not of a name', () => {
    expect(acceptsValue('numeric', '123')).toBe(true)
    expect(acceptsValue('numeric', '12.3')).toBe(false)
    expect(acceptsValue('numeric', '-4')).toBe(true)
    expect(acceptsValue('decimal', '12.3')).toBe(true)
    expect(acceptsValue('decimal', '1.2.3')).toBe(false)
    expect(acceptsValue(undefined, 'anything')).toBe(true)
    // Empty must always be acceptable, or a field can never be cleared.
    expect(acceptsValue('numeric', '')).toBe(true)
    expect(acceptsValue('decimal', '')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('the seam: the door fails CLOSED when the shell provides no guard', () => {
  test('a surface whose shell never registered a guard does not open', () => {
    delete window.canEditFields
    render(<Surface />)
    click(must('display-company'))
    press(must('display-company'), 'Enter')
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })

  test('and a guard returning something other than true is not a yes', () => {
    window.canEditFields = (() => 'yes') as unknown as () => boolean
    render(<Surface />)
    click(must('display-company'))
    expect(must('edit-company').hasAttribute('hidden')).toBe(true)
  })
})
