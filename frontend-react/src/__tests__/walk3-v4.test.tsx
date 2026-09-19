// ── V4: THE PROMPT IS THE HOST'S DECISION, NOT THE COMPONENT'S ──────────
//
// The behavioural claim - adding a note on the Contact raises no dialogue - is
// asserted at the HOST, in contact-capabilities.test.tsx, because that is where
// the decision is taken.
//
// What is asserted HERE is the contract that makes that possible: the component
// prompts only when a surface asks it to. Without this, "the Contact stopped
// passing the props" is a claim about one call site with nothing defending the
// shape it relies on.
//
// The measurement behind both is in the component's own comment: with a field
// genuinely dirty, accepting the dialogue and letting the note save leaves the
// edit on screen. The prompt warned about a loss that does not happen.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NotesHistory } from '../contact/NotesHistory'

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const typeNote = async (text: string) => {
  await act(async () => { $('cd-add-note-btn')!.click() })
  await settle()
  const box = $('cd-new-note-input') as HTMLTextAreaElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
  await act(async () => { $('cd-add-note-btn')!.click() })
  await settle()
}

describe('V4: the discard prompt belongs to the surface that writes', () => {
  test('with no prompt supplied, a note saves directly', async () => {
    const added: string[] = []
    act(() => {
      root.render(<NotesHistory notes={[]} onAdd={async (t) => { added.push(t); return true }} resetKey="c1" />)
    })
    await typeNote('a note from a surface that does not prompt')
    expect(added, 'the note did not save').toEqual(['a note from a surface that does not prompt'])
  })

  test('and a surface that DOES supply one still gets it, so the option is real', async () => {
    // The Test Bed still passes these, because its own write path has not been
    // measured. If this stopped working, removing the Contact's prompt would
    // have silently removed everyone's.
    let asked = 0
    const added: string[] = []
    act(() => {
      root.render(
        <NotesHistory notes={[]} onAdd={async (t) => { added.push(t); return true }} resetKey="c1"
          hasDirtyEdits onConfirmDiscard={(proceed) => { asked += 1; proceed() }} />)
    })
    await typeNote('a note from a surface that does prompt')
    expect(asked, 'the supplied prompt was ignored').toBe(1)
    expect(added).toEqual(['a note from a surface that does prompt'])
  })
})
