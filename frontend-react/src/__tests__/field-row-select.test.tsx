// ── THE EDITOR SLOT, AND THE SELECT EDITOR ───────────────────────────────
//
// Derived from MIGRATION_FIELD_ROW_CONTRACT.md, its addendum, and the Round 2
// brief's rulings. NOT from editors.tsx.
//
// The slot exists because the contract says field-specific editors are
// "layered on the row, not part of it". These tests assert what that sentence
// MEANS operationally: what the row keeps, and what an editor structurally
// cannot reach.
import { describe, test, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { useFieldRows, FieldRow, EditBar, editorFor, editorTakesSeed, TextEditor, SelectEditor } from '../field-row'
import type { FieldDescriptor } from '../field-row'

declare global { interface Window { canEditFields?: () => boolean } }

const REGIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']
const FIELDS: FieldDescriptor[] = [
  { name: 'billingRegion', label: 'Region', value: 'APAC', options: REGIONS },
  { name: 'terminusLead', label: 'Terminus Lead', value: '', options: ['Ada', 'Grace'] },
  { name: 'city', label: 'City', value: 'Singapore' },
]

let root: Root
let host: HTMLElement
const saved: Record<string, string>[] = []

function Surface({ fields = FIELDS }: { fields?: FieldDescriptor[] }) {
  const rows = useFieldRows(fields)
  return (
    <div>
      {fields.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}
      <EditBar rows={rows} onSave={(c) => { saved.push(c) }} />
    </div>
  )
}

const render = (node: React.ReactNode) =>
  act(() => { root.render(<ShellProvider services={shellServices}>{node}</ShellProvider>) })
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const el = $(id); if (!el) throw new Error(`no [data-testid="${id}"]`); return el }
const sel = (name: string) => must(`input-${name}`) as HTMLSelectElement
const click = (el: HTMLElement) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const press = (el: HTMLElement, key: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })

const choose = (name: string, value: string) => {
  const el = sel(name)
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })) })
}

beforeEach(() => {
  saved.length = 0
  window.canEditFields = () => true
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

// ─────────────────────────────────────────────────────────────────────────
describe('the descriptor selects the editor, and a caller declares data not wiring', () => {
  test('options present means select; absent means text', () => {
    expect(editorFor({ name: 'a', label: 'A', value: '', options: REGIONS })).toBe(SelectEditor)
    expect(editorFor({ name: 'a', label: 'A', value: '' })).toBe(TextEditor)
  })

  test('an explicit editor overrides the shape', () => {
    expect(editorFor({ name: 'a', label: 'A', value: '', options: REGIONS, editor: 'text' })).toBe(TextEditor)
    expect(editorFor({ name: 'a', label: 'A', value: '', editor: 'select' })).toBe(SelectEditor)
  })

  test('a select row renders a select and a text row renders an input', () => {
    render(<Surface />)
    expect(sel('billingRegion').tagName).toBe('SELECT')
    expect(must('input-city').tagName).toBe('INPUT')
  })
})

describe('the select offers its options, and a way back to unset', () => {
  test('every declared option is offered', () => {
    render(<Surface />)
    const values = [...sel('billingRegion').options].map((o) => o.value)
    for (const r of REGIONS) expect(values).toContain(r)
  })

  // WITHOUT AN EMPTY OPTION A SELECT IS A ONE-WAY DOOR: once a value is chosen
  // there is no way back to unset, and "not recorded" stops being reachable
  // from the screen. Architecture 11's territory, arriving through an editor.
  test('and an empty option, so a set field can be CLEARED', () => {
    render(<Surface />)
    const values = [...sel('billingRegion').options].map((o) => o.value)
    expect(values[0]).toBe('')
  })

  test('clearing a set field makes it dirty and sends an empty value', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', '')
    expect(must('dirty-count').textContent).toBe('1 change')
    click(must('save-all'))
    expect(saved[0]).toEqual({ billingRegion: '' })
  })

  test('the select shows the current value, not a blank', () => {
    render(<Surface />)
    expect(sel('billingRegion').value).toBe('APAC')
  })
})

describe('the select participates in draft, dirty and discard IDENTICALLY', () => {
  test('choosing marks it dirty', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', 'Africa')
    expect(must('display-billingRegion').closest('.field-row')!.getAttribute('data-dirty')).toBe('true')
  })

  // Behaviour 1's own negative, on a select: choosing away and choosing back
  // reads CLEAN. A flag cannot pass this.
  test('choosing a value and choosing it BACK reads clean', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', 'Africa')
    expect(must('dirty-count').textContent).toBe('1 change')
    choose('billingRegion', 'APAC')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  test('discard restores the original into the select and is NOT a close', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', 'Africa')
    click(must('discard-billingRegion'))
    expect(sel('billingRegion').value).toBe('APAC')
    expect(must('edit-billingRegion').hasAttribute('hidden')).toBe(false)
  })

  test('a select and a text row aggregate into ONE bar', () => {
    render(<Surface />)
    click(must('display-billingRegion')); choose('billingRegion', 'Africa')
    click(must('display-city'))
    const el = must('input-city') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => { setter.call(el, 'Kuala Lumpur'); el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(must('dirty-count').textContent).toBe('2 changes')
    click(must('save-all'))
    expect(saved[0]).toEqual({ billingRegion: 'Africa', city: 'Kuala Lumpur' })
  })

  test('Escape closes a select row without discarding it', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', 'Africa')
    press(sel('billingRegion'), 'Escape')
    expect(must('edit-billingRegion').hasAttribute('hidden')).toBe(true)
    expect(must('dirty-count').textContent).toBe('1 change')
  })
})

describe('the seed character on a select: measured from the vanilla, not chosen', () => {
  // window.revealFieldControl seeds only a TEXTAREA or a text/number INPUT.
  // A select is excluded, and its own comment says why: "a select cannot hold
  // an arbitrary first character". So the row OPENS, the select is FOCUSED,
  // and the character is DISCARDED - the browser's type-ahead takes it from
  // there. Ported rather than improved.
  test('the slot reports that a select does not take a seed', () => {
    expect(editorTakesSeed({ name: 'a', label: 'A', value: '', options: REGIONS })).toBe(false)
    expect(editorTakesSeed({ name: 'a', label: 'A', value: '' })).toBe(true)
  })

  test('a keystroke OPENS the select row', () => {
    render(<Surface />)
    press(must('display-billingRegion'), 'A')
    expect(must('edit-billingRegion').hasAttribute('hidden')).toBe(false)
  })

  test('and the character does NOT become the value', () => {
    render(<Surface />)
    press(must('display-billingRegion'), 'A')
    expect(sel('billingRegion').value).toBe('APAC')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  // The contrast is the point: the same keystroke on a text row DOES land.
  test('while the same keystroke on a text row still lands, unchanged', () => {
    render(<Surface />)
    press(must('display-city'), 'Z')
    expect((must('input-city') as HTMLInputElement).value).toBe('Z')
  })
})

describe('what an editor structurally CANNOT do', () => {
  // ── IT CANNOT BYPASS THE DOOR ──────────────────────────────────────────
  // It is only ever mounted inside the row's edit half, and the row opens that
  // half through requestOpen. An editor holds no controller reference.
  test('with the door shut, no editor opens - select or text', () => {
    window.canEditFields = () => false
    render(<Surface />)
    click(must('display-billingRegion'))
    press(must('display-billingRegion'), 'Enter')
    press(must('display-billingRegion'), 'A')
    expect(must('edit-billingRegion').hasAttribute('hidden')).toBe(true)
    click(must('display-city'))
    expect(must('edit-city').hasAttribute('hidden')).toBe(true)
  })

  test('and a refused row leaves no draft, so the bar never sees it', () => {
    window.canEditFields = () => false
    render(<Surface />)
    press(must('display-billingRegion'), 'A')
    expect(sel('billingRegion').value).toBe('APAC')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
  })

  // ── IT CANNOT OWN DIRTY ────────────────────────────────────────────────
  // The editor receives `value` and `onChange`. Dirty is computed by the
  // controller from draft against the descriptor's value, so an editor that
  // reports the SAME value cannot manufacture a dirty state.
  test('an editor reporting the value it was given produces no dirt', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    choose('billingRegion', 'APAC')
    expect(must('edit-bar').hasAttribute('hidden')).toBe(true)
    expect(must('display-billingRegion').closest('.field-row')!.getAttribute('data-dirty')).toBe('false')
  })

  test('the row applies the declared guard, so an editor cannot smuggle a value past it', () => {
    const guarded: FieldDescriptor[] = [{ name: 'units', label: 'Units', value: '10', inputMode: 'numeric' }]
    render(<Surface fields={guarded} />)
    click(must('display-units'))
    const el = must('input-units') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => { setter.call(el, 'not a number'); el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect((must('input-units') as HTMLInputElement).value).toBe('10')
  })

  // ── IT CANNOT BE OPERATED WHILE THE ROW IS CLOSED ──────────────────────
  // The edit half carries `hidden`, and a hidden subtree is out of the tab
  // order by specification. jsdom computes no tab order, so the MECHANISM is
  // what is asserted, for both editors.
  test('a closed row keeps BOTH editors inside a hidden subtree', () => {
    render(<Surface />)
    expect(sel('billingRegion').closest('[hidden]')).not.toBeNull()
    expect(must('input-city').closest('[hidden]')).not.toBeNull()
  })

  test('and opening one row does not un-hide another row\'s editor', () => {
    render(<Surface />)
    click(must('display-billingRegion'))
    expect(sel('billingRegion').closest('[hidden]')).toBeNull()
    expect(must('input-city').closest('[hidden]')).not.toBeNull()
  })

  test('the editor is never REMOVED, only hidden, for a select as for text', () => {
    render(<Surface />)
    const before = sel('billingRegion')
    click(must('display-billingRegion'))
    press(sel('billingRegion'), 'Escape')
    expect(sel('billingRegion')).toBe(before)
  })
})

describe('behaviour 7 still holds with a slot: read-only has no editor at all', () => {
  test('a read-only select field renders no select and no tab stop', () => {
    const ro: FieldDescriptor[] = [{ name: 'region', label: 'Region', value: 'APAC', options: REGIONS, readOnly: true }]
    render(<Surface fields={ro} />)
    expect(must('display-region').hasAttribute('tabindex')).toBe(false)
    expect(host.querySelector('select')).toBeNull()
    expect($('edit-region')).toBeNull()
  })
})
