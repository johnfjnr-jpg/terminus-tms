// ── R-K: COMMIT AND MOVE, INSIDE A FIELD PANEL ───────────────────────────
//
// Derived from the RULING as written in WALK_3_BRIEF.md and recorded as a
// supersession in INTERACTION_STANDARDS.md Section 2, and from nothing else.
// The component was not consulted while writing this file, per the round
// method's rule that a test for a replacement comes from the contract: a test
// derived from the code agrees with the code.
//
//   within a field panel, Enter commits the open field and opens the next
//   field's editor; ArrowDown commits and moves down; ArrowUp commits and
//   moves up; at the panel's last field Enter commits and closes without
//   firing any record-wide save; Escape reverts per A3 unchanged.
//
// COMMITS MEANS THE DRAFT, NOT THE RECORD. Section 2's supersession says so in
// those words, so every test below that asserts a commit asserts the draft
// survived AND that nothing was saved.
//
// ── THE POSITIONS THIS FILE TAKES, where the ruling is silent ────────────
//
// P1  A MOVE WITH NO TARGET COMMITS AND CLOSES. The ruling names it for Enter
//     at the last field; the same answer is taken for ArrowDown at the last
//     field and ArrowUp at the first, because one rule covering every boundary
//     beats three and leaves no keystroke that does nothing at all.
// P2  THE ORDER IS THE PANEL'S DOM ORDER, NOT THE DESCRIPTOR ARRAY'S. On the
//     Commercials panel the rows are grouped into four cards and the
//     controller's `fields` is the whole record's field list, most of which is
//     on another tab. "The next field" is the next one the PERSON sees.
// P3  A PANEL DECLARES ITSELF with `data-field-panel`. Outside one the keys
//     are inert, exactly as they are today, so no surface changes behaviour
//     until it opts in - and the estate-wide reach of a document-wide query is
//     impossible rather than merely unexercised (CLAUDE.md Verification 20's
//     document-wide-selector clause).
// P4  A KEY THE EDITOR ITSELF USES IS NOT TAKEN FROM IT. Enter in a textarea
//     is a newline; arrows in a select choose the option and in a date input
//     step the segment. Declared per editor kind in one table, so a new editor
//     joins the table rather than being named in a condition.
// P5  THE KEYS ACT IN THE OPEN EDITOR. A closed row keeps today's behaviour:
//     Enter and Space open it, and an arrow is still not a seed and still does
//     not open it. Every keystroke of the ruled workflow after the first is
//     made from inside an editor, so the narrow reading covers it.
import { describe, test, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { useFieldRows, FieldRow, EditBar } from '../field-row'
import type { FieldDescriptor } from '../field-row'

declare global { interface Window { canEditFields?: () => boolean } }

// Four editable text rows, one read-only row between two of them, and the
// three editor kinds that keep their own keys.
const FIELDS: FieldDescriptor[] = [
  { name: 'ssCount', label: 'SafeSight cameras', value: '4', inputMode: 'numeric' },
  { name: 'aqCount', label: 'Air quality sensors', value: '2', inputMode: 'numeric' },
  { name: 'code', label: 'Reference', value: 'TB-0001', readOnly: true },
  { name: 'hemirCount', label: 'HEMIR sensors', value: '1', inputMode: 'numeric' },
  { name: 'ssCost', label: 'SafeSight unit cost', value: '100', inputMode: 'decimal' },
  { name: 'notes', label: 'Notes', value: 'one', editor: 'textarea' },
  { name: 'stage', label: 'Stage', value: 'a', options: ['a', 'b'] },
  { name: 'live', label: 'Go live', value: '2026-01-01', editor: 'date' },
]

let root: Root
let host: HTMLElement
const saved: Record<string, string>[] = []

/** The rows in the order given, inside a DECLARED panel. */
function Panel({ order, panel = true }: { order: string[]; panel?: boolean }) {
  const rows = useFieldRows(FIELDS)
  const body = order.map((n) => {
    const f = FIELDS.find((x) => x.name === n)!
    return <FieldRow key={n} field={f} rows={rows} />
  })
  return (
    <div>
      {panel
        ? <div data-field-panel="test">{body}</div>
        : <div>{body}</div>}
      <EditBar rows={rows} onSave={(c) => { saved.push(c) }} />
    </div>
  )
}

const ALL = FIELDS.map((f) => f.name)

const render = (node: React.ReactNode) => {
  act(() => { root.render(<ShellProvider services={shellServices}>{node}</ShellProvider>) })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => {
  const el = $(id)
  if (!el) throw new Error(`no element with data-testid="${id}"`)
  return el
}
const isOpen = (name: string) => !must(`edit-${name}`).hasAttribute('hidden')
const press = (el: HTMLElement, key: string, mods: Partial<KeyboardEventInit> = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods })) })
const pressIn = (name: string, key: string, mods: Partial<KeyboardEventInit> = {}) =>
  press(must(`input-${name}`), key, mods)
const open = (name: string) =>
  act(() => { must(`display-${name}`).dispatchEvent(new MouseEvent('click', { bubbles: true })) })

const type = (name: string, value: string) => {
  const el = must(`input-${name}`) as HTMLInputElement
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  saved.length = 0
  window.canEditFields = () => true
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

// ─────────────────────────────────────────────────────────────────────────
describe('R-K: Enter commits the open field and opens the next', () => {
  test('Enter closes this row and opens the next field\'s editor', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    pressIn('ssCount', 'Enter')
    expect(isOpen('ssCount')).toBe(false)
    expect(isOpen('aqCount')).toBe(true)
  })

  test('the next editor holds the focus, so the next keystroke is typing', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    pressIn('ssCount', 'Enter')
    expect(document.activeElement).toBe(must('input-aqCount'))
  })

  // THE NEGATIVE. A move that closed without keeping the draft would pass every
  // test above and lose the person's work, which is the whole of what "commits"
  // means here.
  // THE MOVE IS ASSERTED IN THE SAME TEST ON PURPOSE. Without the first two
  // lines this passes with the whole feature absent - the row simply stays
  // open, the draft is trivially still there, and the bar counts it. A check
  // that cannot fail while the thing is missing is not a check (CLAUDE.md
  // Verification 14), and this one read GREEN on the red-first run until the
  // move was asserted beside the survival.
  test('the draft SURVIVES the move, and the bar still counts it', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'Enter')
    expect(isOpen('ssCount')).toBe(false)
    expect(isOpen('aqCount')).toBe(true)
    expect(must('display-ssCount').textContent).toContain('9')
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  // The ruled workflow end to end, and the same caveat: typing into a row the
  // keyboard never opened would pass this, because a hidden input still takes
  // an input event. Each row is asserted OPEN before it is typed into.
  test('two fields entered by keyboard alone both reach the bar', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'Enter')
    expect(isOpen('aqCount')).toBe(true)
    type('aqCount', '7')
    pressIn('aqCount', 'Enter')
    // `code` is read-only, so it has no edit half to be open OR closed - which
    // is behaviour 7 and the reason the move must skip it rather than land on
    // it and refuse.
    expect($('edit-code')).toBe(null)
    expect(isOpen('hemirCount')).toBe(true)
    expect(must('dirty-count').textContent).toBe('2 changes')
  })
})

describe('R-K: ArrowDown and ArrowUp move', () => {
  test('ArrowDown commits and moves down', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'ArrowDown')
    expect(isOpen('ssCount')).toBe(false)
    expect(isOpen('aqCount')).toBe(true)
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  test('ArrowUp commits and moves up', () => {
    render(<Panel order={ALL} />)
    open('aqCount')
    type('aqCount', '7')
    pressIn('aqCount', 'ArrowUp')
    expect(isOpen('aqCount')).toBe(false)
    expect(isOpen('ssCount')).toBe(true)
    expect(must('dirty-count').textContent).toBe('1 change')
  })
})

describe('R-K: a read-only row is not a destination', () => {
  // `code` sits between aqCount and hemirCount and has no edit half at all, so
  // a move that counted it would land on nothing and read as a dead keystroke.
  test('the move SKIPS the read-only row', () => {
    render(<Panel order={ALL} />)
    open('aqCount')
    pressIn('aqCount', 'ArrowDown')
    expect(isOpen('hemirCount')).toBe(true)
  })
})

describe('R-K: the panel\'s boundaries', () => {
  test('Enter at the last field commits and closes', () => {
    render(<Panel order={['ssCount', 'aqCount']} />)
    open('aqCount')
    type('aqCount', '7')
    pressIn('aqCount', 'Enter')
    expect(isOpen('aqCount')).toBe(false)
    expect(isOpen('ssCount')).toBe(false)
    expect(must('dirty-count').textContent).toBe('1 change')
  })

  // The clause the ruling states explicitly, and it is the one a form would get
  // wrong: Enter in a form submits.
  test('Enter at the last field fires NO record-wide save', () => {
    render(<Panel order={['ssCount', 'aqCount']} />)
    open('aqCount')
    type('aqCount', '7')
    pressIn('aqCount', 'Enter')
    expect(saved).toEqual([])
  })

  test('no keystroke in the pass fires a record-wide save', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'Enter')
    type('aqCount', '7')
    pressIn('aqCount', 'ArrowDown')
    pressIn('hemirCount', 'ArrowUp')
    expect(saved).toEqual([])
  })

  // THE POSITIVE CASE FOR THE TWO ABSENCES ABOVE. `saved` empty is the reading
  // a broken harness gives too - a bar that never renders, an onSave never
  // wired - so the instrument is shown reaching a non-empty value on the same
  // surface before either zero is quoted (CLAUDE.md, before trusting a null
  // reading).
  test('and the bar CAN save, so an empty `saved` is a measurement', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    act(() => { must('save-all').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(saved).toEqual([{ ssCount: '9' }])
  })

  // P1.
  test('ArrowUp at the first field commits and closes', () => {
    render(<Panel order={['ssCount', 'aqCount']} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'ArrowUp')
    expect(isOpen('ssCount')).toBe(false)
    expect(must('dirty-count').textContent).toBe('1 change')
  })
})

describe('R-K: P2, the order is the PANEL\'S order', () => {
  // Rendered back to front. A move computed from the descriptor array would
  // send the person UP the screen on ArrowDown.
  test('ArrowDown follows what is on screen, not the descriptor array', () => {
    render(<Panel order={['ssCost', 'hemirCount', 'aqCount', 'ssCount']} />)
    open('hemirCount')
    pressIn('hemirCount', 'ArrowDown')
    expect(isOpen('aqCount')).toBe(true)
    expect(isOpen('ssCost')).toBe(false)
  })
})

describe('R-K: P3, outside a declared panel nothing changes', () => {
  test('Enter is inert where no panel is declared', () => {
    render(<Panel order={ALL} panel={false} />)
    open('ssCount')
    pressIn('ssCount', 'Enter')
    expect(isOpen('aqCount')).toBe(false)
  })

  test('ArrowDown is inert where no panel is declared', () => {
    render(<Panel order={ALL} panel={false} />)
    open('ssCount')
    pressIn('ssCount', 'ArrowDown')
    expect(isOpen('aqCount')).toBe(false)
  })
})

describe('R-K: P4, a key the editor itself uses is not taken from it', () => {
  test('Enter in a TEXTAREA stays a newline and does not move', () => {
    render(<Panel order={ALL} />)
    open('notes')
    pressIn('notes', 'Enter')
    expect(isOpen('notes')).toBe(true)
    expect(isOpen('stage')).toBe(false)
  })

  test('arrows in a SELECT stay the option choice and do not move', () => {
    render(<Panel order={ALL} />)
    open('stage')
    pressIn('stage', 'ArrowDown')
    expect(isOpen('stage')).toBe(true)
    expect(isOpen('live')).toBe(false)
  })

  // A MODIFIED KEY IS SOMEBODY REACHING FOR THE BROWSER OR THE CONTROL, not
  // for the next field. Cmd/Ctrl with an arrow is a jump-to-end everywhere
  // else on the machine, and Shift with one is a selection.
  test('a modified Enter or arrow does not move', () => {
    render(<Panel order={ALL} />)
    for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }]) {
      open('ssCount')
      pressIn('ssCount', 'Enter', mods)
      pressIn('ssCount', 'ArrowDown', mods)
      expect(isOpen('aqCount')).toBe(false)
      pressIn('ssCount', 'Escape')
    }
  })

  test('arrows in a DATE input stay the segment step and do not move', () => {
    render(<Panel order={ALL} />)
    open('live')
    pressIn('live', 'ArrowUp')
    expect(isOpen('live')).toBe(true)
  })

  // The other half of P4: a select still COMMITS on Enter, because Enter is not
  // one of the keys a select uses.
  test('Enter in a SELECT still commits and moves', () => {
    render(<Panel order={ALL} />)
    open('stage')
    pressIn('stage', 'Enter')
    expect(isOpen('stage')).toBe(false)
    expect(isOpen('live')).toBe(true)
  })
})

describe('R-K: A3 is unchanged, and P5 holds the closed row still', () => {
  test('Escape reverts and closes, and does not move', () => {
    render(<Panel order={ALL} />)
    open('ssCount')
    type('ssCount', '9')
    pressIn('ssCount', 'Escape')
    expect(isOpen('ssCount')).toBe(false)
    expect(isOpen('aqCount')).toBe(false)
    expect(must('dirty-count').textContent).toBe('0 changes')
  })

  // RE-POINTED from field-row.test.tsx's "a navigation key is not a seed",
  // deliberately and per the ruling: ArrowDown now MEANS something, and what it
  // means lives in the open editor. On a closed row it is still not a seed and
  // still does not open anything.
  test('ArrowDown on a CLOSED row is still not a seed and still opens nothing', () => {
    render(<Panel order={ALL} />)
    press(must('display-ssCount'), 'ArrowDown')
    expect(isOpen('ssCount')).toBe(false)
    expect(isOpen('aqCount')).toBe(false)
    expect(must('dirty-count').textContent).toBe('0 changes')
  })
})
