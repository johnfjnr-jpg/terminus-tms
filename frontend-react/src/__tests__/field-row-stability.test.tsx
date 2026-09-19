// ── ROUND 5 PHASE 3: THE ROW IS NOT REBUILT WHILE SOMEBODY TYPES ────────
//
// The detector the Phase 2 defect needed and nobody had.
//
// A component declared INSIDE a render body gets a new type on every render,
// and React cannot reconcile two different types - so it unmounts and
// remounts the whole subtree. Measured on the live surface before the fix,
// typing "abcd" into the Executive Summary:
//
//   value  caret  sameDOMnode  editorMounts  editorUnmounts
//   a      0      false        1             1
//   ba     0      false        2             2
//   cba    0      false        3             3
//   dcba   0      false        4             4
//
// A fresh DOM node starts with its caret at 0, so every character landed in
// front of the last.
//
// WHY jsdom CAN CATCH THIS AND DID NOT: a caret needs layout and jsdom has
// none, but a MOUNT COUNT needs neither. The defect was invisible only
// because nothing counted. It is counted here.
//
// AND AN <input> HIDES IT. FieldRow's focus effect restores the caret to the
// end for an HTMLInputElement and not for a textarea, so text rows read
// perfectly while being remounted just as hard. Every editor kind is asserted,
// not only the one that happened to show a symptom.
import { describe, test, expect, beforeEach } from 'vitest'
import { shellServices } from './fixtures'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReferencePanel } from '../reference/ReferencePanel'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import type { ReferenceSource } from '../reference/descriptors'
import * as editors from '../field-row/editors'

let host: HTMLElement
let root: Root
const mounts: Record<string, number> = {}

/** Wraps an editor so a MOUNT is counted, without touching the editor itself. */
const counted = (name: string, Inner: editors.FieldEditor): editors.FieldEditor =>
  function Counted(props) {
    useEffect(() => { mounts[name] = (mounts[name] ?? 0) + 1 }, [])
    return <Inner {...props} />
  }

const source: ReferenceSource = {
  payload: { name: 'Changi T5', country: 'Singapore', duration: '36', summary: '' },
  details: { forecast_close_date: '2026-11-30' },
  account: { id: 'a1', name: 'Acme' },
  staff: ['Brad Kerr', 'John Fryatt'],
  reference: 'TT-1', status: 'Qualification', createdAt: '2026-03-04',
}
const services: ShellServices = shellServices({
  api: (async () => ({ ok: true, status: 200, data: [] })) as ShellServices['api'],
  navigate: () => {}, detailLoaded: () => {},
  getOppLoadedRevision: () => 1, canEditFields: () => true,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p: () => void) => { p() },
})

const mount = async () => {
  // `#opp-band-root` is where `ReferencePanel` PORTALS the record band, and
  // the Summary row lives in that band. In `index.html` the container is a
  // sibling of the React mount; here it is created INSIDE the host so these
  // tests' `host.querySelector` still reaches the row.
  //
  // THAT IS A DELIBERATE DIFFERENCE AND IT IS SAFE, because position is not
  // what this file measures. Where the band SITS relative to the chevron and
  // the tab row is a layout claim, asserted live by
  // `scripts/opportunity/probe-region-live.mjs` against the real document.
  // What these tests measure is behaviour: the draft store, the door and the
  // save, none of which the portal's target changes.
  // A SIBLING, NOT A CHILD, and the first attempt proved why: nesting it
  // inside `#host` looked tidier and `createRoot` CLEARS ITS CONTAINER on
  // first render, so the band's target was destroyed before the portal could
  // find it and all ten tests failed exactly as before. Production has it as
  // a sibling too.
  document.body.innerHTML = '<div id="host"></div><div id="opp-band-root"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <ShellProvider services={services}>
        <ReferencePanel source={source} links={[]} closeMoves={0} oppId="o"
          onSave={() => {}} onChanged={() => {}} />
      </ShellProvider>)
  })
}
const must = (sel: string) => {
  // The Summary row is PORTALLED into `#opp-band-root`, so it is a child of
  // this component in the React tree and a child of a sibling div in the DOM.
  // A lookup that only reads `host` reports it absent.
  const e = (host.querySelector(sel)
    ?? document.getElementById('opp-band-root')?.querySelector(sel) ?? null) as HTMLElement | null
  if (!e) throw new Error(`no ${sel}`); return e
}
/** One character, the way a keystroke arrives: a value change plus an input event. */
const typeOne = async (name: string, next: string) => {
  await act(async () => {
    const el = must(`[data-testid="input-${name}"]`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, next)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

// ── THE BAND'S CONTAINER, BECAUSE PRODUCTION HAS ONE ────────────────────
//
// `ReferencePanel` portals the record band into `#opp-band-root`, a div that
// `index.html` carries in the Opportunity's top region. The Summary row lives
// in that band, so a harness without the container renders it NOWHERE and
// eight tests here failed on `no [data-testid="display-summary"]`.
//
// THE FIX IS THE HARNESS, NOT A FALLBACK IN THE COMPONENT. Rendering the row
// inline when the container is missing would give the component two layouts
// and let every test pass against a shape production never has, which is the
// fixture-shaped-to-the-implementation fault. The harness reproduces how the
// code is INVOKED instead.
beforeEach(() => {
  document.body.innerHTML = ''
  const band = document.createElement('div')
  band.id = 'opp-band-root'
  document.body.appendChild(band)
})

describe('ST: the row survives typing', () => {
  test('ST1 the DOM node is the SAME node after every keystroke', async () => {
    await mount()
    await act(async () => { must('[data-testid="display-summary"]').click() })
    const first = must('[data-testid="input-summary"]')
    for (const v of ['a', 'ab', 'abc', 'abcd']) {
      await typeOne('summary', v)
      expect(must('[data-testid="input-summary"]'),
        'the editor was REPLACED mid-typing, which resets the caret and reverses '
        + 'the text on a control the browser does not restore').toBe(first)
    }
    expect((first as HTMLTextAreaElement).value).toBe('abcd')
  })

  test('ST2 and no OTHER row is rebuilt either', async () => {
    await mount()
    await act(async () => { must('[data-testid="display-country"]').click() })
    const other = must('[data-testid="display-name"]')
    for (const v of ['S', 'Si', 'Sin']) await typeOne('country', v)
    expect(must('[data-testid="display-name"]'),
      'typing in one row rebuilt an unrelated row').toBe(other)
  })

  test('ST3 the CARD is a stable component type, not one per render', async () => {
    // The mechanism itself. A card section replaced between renders is the
    // signature of a component declared inside a render body.
    await mount()
    const card = must('[data-testid="ref-terminus"]')
    await act(async () => { must('[data-testid="display-country"]').click() })
    await typeOne('country', 'Malaysia')
    expect(must('[data-testid="ref-terminus"]'),
      'the card subtree was remounted, so every editor inside it was too')
      .toBe(card)
  })

  test('ST4 EVERY editor kind survives, not only the one that showed a symptom', async () => {
    await mount()
    // text, select, date, textarea and the numeric text row.
    for (const [name, value] of [
      ['country', 'Malaysia'], ['lead', 'Brad Kerr'], ['actualClose', '2027-01-01'],
      ['summary', 'a summary'], ['duration', '48'],
    ] as const) {
      await act(async () => { must(`[data-testid="display-${name}"]`).click() })
      const node = must(`[data-testid="input-${name}"]`)
      await typeOne(name, value)
      expect(must(`[data-testid="input-${name}"]`), `${name} was replaced mid-typing`)
        .toBe(node)
    }
  })
})
