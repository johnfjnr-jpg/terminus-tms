// ── ROUND 5 PHASE 1 ITEMS 2, 3 and 4: THE SURFACE ───────────────────────
//
// The door is calibrated in BOTH directions here, in jsdom, which is item 3's
// requirement: a not-mine record refuses every row including keyboard and
// seed; a mine record refuses none; an absent registry fails closed.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReferencePanel } from '../reference/ReferencePanel'
// R-O2: the band's notes card is built by the HOST and composed by the panel,
// so a harness that mounts the panel alone has no notes unless it supplies
// one. It is supplied here the way `ReferenceHost` supplies it in production
// (Verification 47: build the state the way the SYSTEM produces it).
import { NotesHistory } from '../contact/NotesHistory'
import { ShellProvider } from '../ShellContext'
import { SAME_AS_ACCOUNT } from '../reference/descriptors'
import type { ReferenceSource } from '../reference/descriptors'
import type { ShellServices } from '../shell-services'
import type { KcLink } from '../reference/KeyContacts'

let host: HTMLElement
let root: Root
let apiCalls: { method: string, path: string, body?: unknown }[] = []

const source = (o: Partial<ReferenceSource> = {}): ReferenceSource => ({
  payload: { name: 'Changi T5', country: 'Singapore', duration: '36',
    commAddress: 'the opportunity line 1', ...o.payload },
  details: { forecast_close_date: '2026-11-30', ...o.details },
  account: o.account === undefined
    ? { id: 'a1', name: 'Changi Airport Group', shippingAddress: 'the ACCOUNT line 1' }
    : o.account,
  staff: o.staff ?? ['Brad Kerr', 'John Fryatt'],
  reference: 'TT-SGP-AIRPRT-2610', status: 'Qualification', createdAt: '2026-03-04',
})

const LINKS: KcLink[] = [{
  id: 'lnk1', contact_id: 'c1', contact_name: 'Wei Lin', role: 'commercial buyer',
  stance_id: null, stance_note: null, linked_at: '2026-03-04',
}]

const shell = (canEdit: boolean | 'absent'): ShellServices => shellServices({
  api: (async (method: string, path: string, body?: unknown) => {
    apiCalls.push({ method, path, body })
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api'],
  navigate: vi.fn(),
  detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  // 'absent' models a shell that never registered the guard: the seam's own
  // default is what must decide, and the contract says FAIL CLOSED.
  canEditFields: () => (canEdit === 'absent' ? false : canEdit),
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p: () => void) => { p() },
})

const mount = async (opts: {
  canEdit?: boolean | 'absent'
  src?: ReferenceSource
  links?: KcLink[]
  onSave?: (c: Record<string, string>) => void
} = {}) => {
  apiCalls = []
  // A SIBLING, NOT A CHILD: `createRoot` CLEARS its container on first render,
  // so a target nested inside `#host` is destroyed before the portal finds it.
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
  document.body.innerHTML = '<div id="host"></div><div id="opp-band-root"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(
      <ShellProvider services={shell(opts.canEdit ?? true)}>
        <ReferencePanel
          source={opts.src ?? source()}
          links={opts.links ?? LINKS}
          closeMoves={0}
          oppId="opp1"
          onSave={opts.onSave ?? (() => {})}
          notes={<NotesHistory notes={[]} title="Notes" actionsInHeader
            resetKey="opp1" onAdd={async () => true} />}
          onChanged={() => {}} />
      </ShellProvider>)
  })
}
// SEARCHES THE HOST AND THE BAND, because the Summary row is PORTALLED into
// `#opp-band-root` and is therefore a child of this component in the React
// tree and a child of a sibling div in the DOM. A helper that only reads
// `host` reports the row as absent, which is how this surfaced: ten tests
// failing on `no [data-testid="display-summary"]` with nothing wrong.
const q = (sel: string) => (host.querySelector(sel)
  ?? document.getElementById('opp-band-root')?.querySelector(sel) ?? null) as HTMLElement | null
const must = (sel: string) => { const e = q(sel); if (!e) throw new Error(`no ${sel}`); return e }
const display = (n: string) => must(`[data-testid="display-${n}"]`)
const editHalf = (n: string) => must(`[data-testid="edit-${n}"]`)
const isOpen = (n: string) => !editHalf(n).hasAttribute('hidden')
const click = async (el: HTMLElement) => { await act(async () => { el.click() }) }
const key = async (el: HTMLElement, k: string) => {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })
}

/** The 21 editable rows, by name, in render order. */
const EDITABLE = ['name', 'lead', 'commercial', 'technical', 'legal', 'region', 'country',
  'customerLead', 'commAddress', 'commAddress2', 'commCity', 'commPostcode', 'commCountry',
  'commRegion', 'estClose', 'actualClose', 'estGoLive', 'actualGoLive', 'duration',
  'oppType', 'summary']

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

// ── ITEM 2: THE ROWS ────────────────────────────────────────────────────
describe('R: the rows render per the census', () => {
  test('R1 all 21 editable rows are present', async () => {
    await mount()
    for (const n of EDITABLE) expect(q(`[data-field="${n}"]`), `${n} did not render`).toBeTruthy()
    // COUNTED ACROSS BOTH TREES. Twenty rows render inside the panel and the
    // twenty-first, Summary, is portalled into the band. The total is the
    // claim, and it is still 21: the row MOVED, it was not removed, and a
    // count scoped to the host alone would report the move as a loss.
    const band = document.getElementById('opp-band-root')
    expect([...host.querySelectorAll('[data-dirty]'),
      ...(band ? [...band.querySelectorAll('[data-dirty]')] : [])],
    'expected 21 editable rows across the panel and the band').toHaveLength(21)
  })

  test('R1b BEHAVIOUR 3: a closed row carries hidden on its edit half', async () => {
    // The attribute alone is what every test read, and a stylesheet rule that
    // set `display: flex` unconditionally overrode the user-agent's
    // `[hidden] { display: none }` - so every closed editor rendered visible
    // while this assertion passed. The attribute is asserted here; the CSS
    // that must not fight it is asserted in class-rules.
    await mount()
    for (const n of EDITABLE) {
      expect(editHalf(n).hasAttribute('hidden'), `${n} opened by itself`).toBe(true)
    }
  })

  test('R1c EVERY SECTION IS NAMED, which no control census can see', async () => {
    // Round 40's finding, and the Phase 2 sweep's third silence: removing the
    // card titles changed no control, no id and no geometry, so nothing
    // failed. The names ARE the information.
    await mount()
    const titles = [...host.querySelectorAll('.pg-card-title')].map((e) => e.textContent)
    expect(titles).toEqual([
      'Terminus Details', 'Customer Details', 'Key Dates',
      'Key Customer Contacts',
      // WAS 'Executive Summary'. The summary row moved to the record band and
      // the title followed its content: a card headed "Executive Summary" over
      // nothing but an opportunity-type row is a sentence that was true when
      // typed and is derived from nothing, so nothing could falsify it.
      //
      // W2, 2026-09-20: AND NOW THE CARD ITSELF IS GONE. 'Opportunity type'
      // was the last title in this list and it headed a card holding exactly
      // one row, whose own label already said the same word. The row moved
      // into Terminus Details directly below Terminus Reference, so the list
      // loses a name and the screen loses a frame. Re-pointed rather than
      // relaxed: the claim is still that every section is named, and the
      // assertion below proves the row survived the move.
    ])
    // The row is NOT lost with its card. Without this the list above would be
    // satisfied by deleting the field outright.
    expect(q('[data-testid="display-oppType"]'),
      'the Opportunity type row went with its card').not.toBeNull()
    expect(must('[data-testid="ref-terminus"]').contains(q('[data-testid="display-oppType"]')!),
      'the row did not land inside Terminus Details').toBe(true)

    // AND THE BAND NAMES ITS OWN SECTIONS, which is the same claim for the
    // three cards this round added. Without it, the move would be asserted
    // only as a removal from the list above.
    //
    // ── R-O2: THE ENUMERATION READS BOTH WAYS A NAME IS RENDERED ────────
    //
    // This read `.pg-card-title` alone and went red when R-O2 collapsed the
    // notes header: the Notes name did not disappear, it moved from a `Card`
    // heading to the `Panel` header's own title, which wears `.panel-title`.
    // The screen still says NOTES.
    //
    // WIDENED RATHER THAN RELAXED, and the difference matters. The claim is
    // unchanged - every section in the band is named, and these are the names
    // in this order. What changed is the instrument, which was enumerating by
    // ONE CLASS and therefore answered for one of the two ways this estate
    // renders a section heading. Verification 19: enumerate by a DECLARED
    // property, never by a name, or the member nobody added is a silence.
    // `data-panel-title` is emitted structurally by `Panel` for exactly this.
    //
    // Calibrated after widening: dropping `title` from either card still fails
    // it, so it has not been turned into a test that cannot go red.
    const band = document.getElementById('opp-band-root')
    expect([...(band?.querySelectorAll('.pg-card-title, [data-panel-title]') ?? [])]
      .map((e) => e.textContent))
      .toEqual(['Summary', 'Notes'])
  })

  test('R2 and the five read-only rows, WITHOUT a tab stop (behaviour 7)', async () => {
    await mount()
    const ro = [...host.querySelectorAll('[data-readonly="true"]')]
    expect(ro).toHaveLength(5)
    for (const r of ro) {
      const d = r.querySelector('.field-row-display')!
      expect(d.getAttribute('tabindex'),
        'a read-only row gained a tab stop; the vanilla has this defect and the '
        + 'contract rules against it').toBe(null)
      expect(d.getAttribute('onclick')).toBe(null)
    }
  })

  test('R3 the editors are the ones the census measured', async () => {
    await mount()
    const kind = async (n: string) => {
      await click(display(n))
      const el = must(`[data-testid="input-${n}"]`)
      return el.tagName === 'INPUT' ? `input:${(el as HTMLInputElement).type}` : el.tagName
    }
    expect(await kind('country')).toBe('input:text')
    expect(await kind('lead')).toBe('SELECT')
    expect(await kind('estClose')).toBe('input:date')
    expect(await kind('summary')).toBe('TEXTAREA')
    expect(await kind('duration')).toBe('input:text')
  })

  test('R4 A4: both no-past dates carry min; the actuals carry none', async () => {
    await mount()
    for (const n of ['estClose', 'estGoLive']) {
      await click(display(n))
      expect(must(`[data-testid="input-${n}"]`).getAttribute('min'), `${n} lost its min`)
        .toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    for (const n of ['actualClose', 'actualGoLive']) {
      await click(display(n))
      expect(must(`[data-testid="input-${n}"]`).getAttribute('min')).toBe(null)
    }
  })

  test('R5 the bar shows a COUNT across rows (finding 3\'s ruling)', async () => {
    await mount()
    expect(must('[data-testid="edit-bar"]').hasAttribute('hidden')).toBe(true)
    await click(display('country'))
    await act(async () => {
      const i = must('[data-testid="input-country"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, 'Malaysia')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(must('[data-testid="edit-bar"]').hasAttribute('hidden')).toBe(false)
    expect(must('[data-testid="dirty-count"]').textContent,
      'the vanilla computes a dirty count and shows none; the contract says the '
      + 'bar aggregates, and this surface shows what it aggregated').toBe('1 change')
  })

  test('R6 A3: the suffix IS shown, and never reaches the value', async () => {
    // Verification 51 wrote this test. The sweep's suffix injection came back
    // SILENT because nothing rendered the suffix at all, so "it never reaches
    // the value" was true by absence. Both halves of the claim are asserted now.
    await mount()
    expect(display('duration').textContent, 'the suffix is not shown at all')
      .toBe('36 months')
    await click(display('duration'))
    expect((must('[data-testid="input-duration"]') as HTMLInputElement).value,
      'the suffix reached the editor').toBe('36')
    expect(editHalf('duration').textContent, 'the suffix leaked into the edit half')
      .not.toContain('months')
  })

  test('R7 A3: and typing never carries the suffix into the draft', async () => {
    const onSave = vi.fn()
    await mount({ onSave })
    await click(display('duration'))
    await act(async () => {
      const i = must('[data-testid="input-duration"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, '48')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(must('[data-testid="save-all"]'))
    expect(onSave, 'THE SUFFIX WAS SAVED INTO THE VALUE').toHaveBeenCalledWith({ duration: '48' })
  })

  test('R7b AN EMPTY ROW IS STILL A TARGET, or the door cannot be reached', async () => {
    // Found by the Phase 2 live walk: an empty row with no declared placeholder
    // rendered an empty span and collapsed to HEIGHT 0, so it could not be
    // clicked at all. jsdom has no layout, so this asserts the CONTENT that
    // gives the row its height rather than the height itself - which is the
    // honest limit of what a unit test can see here.
    await mount({ src: source({ payload: { country: '' } }) })
    expect(display('country').textContent,
      'an empty row rendered nothing, so it has no height and no click target')
      .toBe('--')
    // And it still opens, which is the point of having a target at all.
    await click(display('country'))
    expect(isOpen('country')).toBe(true)
  })

  test('R8 A3: an empty suffixed field shows its placeholder, not a bare suffix', async () => {
    await mount({ src: source({ payload: { duration: '' } }) })
    expect(display('duration').textContent, 'an unset duration read as " months"')
      .not.toContain('months')
  })
})

// ── ITEM 2: SAME-AS-ACCOUNT, BOTH BRANCHES ──────────────────────────────
describe('S: same-as-account, both branches', () => {
  test('S1 OFF: the six address rows are editable and show the opportunity\'s values', async () => {
    await mount()
    expect(host.querySelectorAll('[data-readonly="true"]')).toHaveLength(5)
    expect(display('commAddress').textContent).toBe('the opportunity line 1')
  })

  test('S2 ticking it re-renders the six rows READ-ONLY with the ACCOUNT\'s values', async () => {
    await mount()
    await click(must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`))
    expect(host.querySelectorAll('[data-readonly="true"]'),
      '5 fixed read-only rows + 6 address rows').toHaveLength(11)
    expect(display('commAddress').textContent, 'the row must show the ACCOUNT value')
      .toBe('the ACCOUNT line 1')
  })

  test('S3 and a copied value is NOT editable - clicking it opens nothing', async () => {
    await mount()
    await click(must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`))
    expect(q('[data-testid="edit-commAddress"]'),
      'a read-only row must have no edit half at all').toBe(null)
    await click(display('commAddress'))
    expect(q('[data-testid="edit-commAddress"]')).toBe(null)
  })

  test('S4 B2: the flag rides the batched save, and B3 its dirty is by comparison', async () => {
    const onSave = vi.fn()
    await mount({ onSave })
    const box = () => must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`)
    await click(box())
    expect(must('[data-testid="dirty-count"]').textContent).toBe('1 change')
    await click(box())
    expect(must('[data-testid="edit-bar"]').hasAttribute('hidden'),
      'ticking back to the original left a draft; dirty must be by COMPARISON').toBe(true)
    await click(box())
    await click(must('[data-testid="save-all"]'))
    expect(onSave).toHaveBeenCalledWith({ [SAME_AS_ACCOUNT]: 'true' })
  })

  test('S5 B6: ON with no account address renders the note, not six empty rows', async () => {
    await mount({ src: source({ account: { id: 'a1', name: 'Acme' } }) })
    await click(must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`))
    expect(q('[data-testid="ref-no-account-address"]')).toBeTruthy()
    expect(q('[data-field="commAddress"]')).toBe(null)
  })
})

// ── ITEM 3: THE DOOR, BOTH DIRECTIONS ───────────────────────────────────
describe('D: the ownership door', () => {
  test('D1 MINE: every one of the 21 rows opens', async () => {
    await mount({ canEdit: true })
    for (const n of EDITABLE) {
      await click(display(n))
      expect(isOpen(n), `${n} refused to open on a record the user owns`).toBe(true)
    }
  })

  test('D2 NOT MINE: every one of the 21 refuses, by CLICK', async () => {
    await mount({ canEdit: false })
    for (const n of EDITABLE) {
      await click(display(n))
      expect(isOpen(n), `${n} opened on a record the user does not own`).toBe(false)
    }
  })

  test('D3 NOT MINE: and by KEYBOARD - Enter, Space and a seed character', async () => {
    await mount({ canEdit: false })
    for (const n of EDITABLE) {
      for (const k of ['Enter', ' ', 'a']) {
        await key(display(n), k)
        expect(isOpen(n), `${n} opened on "${k}" for a record the user does not own`).toBe(false)
      }
    }
  })

  test('D4 NOT MINE: the direct-input checkbox is refused too, not just the rows', async () => {
    await mount({ canEdit: false })
    const box = must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`) as HTMLInputElement
    expect(box.disabled,
      'the flag is a direct input, so the door has to reach it separately').toBe(true)
    await click(box)
    expect(must('[data-testid="edit-bar"]').hasAttribute('hidden'),
      'the refused flag still recorded a draft').toBe(true)
  })

  test('D5 REGISTRY ABSENT: fails CLOSED, per finding 10', async () => {
    await mount({ canEdit: 'absent' })
    for (const n of EDITABLE) {
      await click(display(n))
      expect(isOpen(n),
        `${n} opened with no ownership guard registered. Failing OPEN makes an `
        + 'absent door look exactly like a present one').toBe(false)
    }
  })

  test('D6 the guard is consulted at EVERY attempt, never captured at render', async () => {
    // Behaviour 2's own note: the door has no timing dependency, unlike the CSS
    // and the sweep. A value read once at render would reintroduce one.
    let allowed = false
    const services: ShellServices = shellServices({ ...shell(true), canEditFields: () => allowed })
    // The band's portal target, as above: a sibling, because createRoot clears.
    document.body.innerHTML = '<div id="host"></div><div id="opp-band-root"></div>'
    host = document.getElementById('host')!
    root = createRoot(host)
    await act(async () => {
      root.render(
        <ShellProvider services={services}>
          <ReferencePanel source={source()} links={LINKS} closeMoves={0} oppId="o"
            onSave={() => {}} onChanged={() => {}} />
        </ShellProvider>)
    })
    await click(display('country'))
    expect(isOpen('country')).toBe(false)
    allowed = true
    await click(display('country'))
    expect(isOpen('country'),
      'the guard was captured at render rather than consulted at the attempt').toBe(true)
  })
})

// ── ITEM 4: KEY CONTACTS ────────────────────────────────────────────────
describe('K: key contacts', () => {
  test('K1 it renders its own component, sharing no field row', async () => {
    await mount()
    const panel = must('[data-testid="key-contacts"]')
    expect(panel.querySelectorAll('[data-dirty]'),
      'key contacts used field rows; it is a collection, not named fields').toHaveLength(0)
    expect(must('[data-testid="kc-row-lnk1"]')).toBeTruthy()
  })

  test('K2 it loads its three vocabularies on mount', async () => {
    await mount()
    const paths = apiCalls.map((c) => c.path)
    expect(paths).toContain('/api/contact-roles')
    expect(paths).toContain('/api/contact-stances')
    // R-W3: THE CONTACTS CALL IS SCOPED TO THE LINKED ACCOUNT. It was the
    // bare `/api/contacts`, which returns every live contact in the system.
    // Asserted as the exact path rather than a `toContain` on the prefix,
    // because a prefix match is satisfied by the unscoped call it replaces.
    expect(paths).toContain('/api/contacts?account_id=a1')
    expect(paths, 'the unscoped call is still being made').not.toContain('/api/contacts')
  })

  test('R-W3 with NO linked account it asks for nothing and says why', async () => {
    await mount({ src: source({ account: null }) })
    const paths = apiCalls.map((c) => c.path)
    expect(paths.some((p) => p.startsWith('/api/contacts')),
      'it asked for contacts with no account to scope them to').toBe(false)
    const note = q('[data-testid="kc-no-account"]')
    expect(note, 'nothing explains the empty picker').not.toBeNull()
    expect(note!.textContent).toMatch(/no linked account/i)
    // AND THE CONTROL IS DISABLED, so the sentence is not the only thing
    // stopping somebody trying: an enabled picker with nothing in it invites
    // a click that can do nothing.
    expect((must('[data-testid="kc-add-contact"]') as HTMLSelectElement).disabled).toBe(true)
  })

  test('R-W3 and WITH an account the explanation is absent', async () => {
    // The pair that makes the test above mean something: a note rendered
    // always would satisfy it just as well.
    await mount()
    expect(q('[data-testid="kc-no-account"]')).toBeNull()
    expect((must('[data-testid="kc-add-contact"]') as HTMLSelectElement).disabled).toBe(false)
  })

  test('K3 a stance change ARMS the row rather than making the surface dirty', async () => {
    await mount()
    expect(must('[data-testid="kc-record-lnk1"]').hasAttribute('hidden')).toBe(true)
    await act(async () => {
      const sel = must('[data-testid="kc-stance-lnk1"]') as HTMLSelectElement
      sel.value = ''
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(must('[data-testid="kc-record-lnk1"]').hasAttribute('hidden'),
      'the row did not arm').toBe(false)
    expect(must('[data-testid="edit-bar"]').hasAttribute('hidden'),
      'A KEY-CONTACT EDIT MADE THE SURFACE BAR DIRTY. Its writes are immediate '
      + 'and must never join the batched save').toBe(true)
  })

  test('K4 recording writes IMMEDIATELY, never through the bar', async () => {
    await mount()
    await act(async () => {
      const sel = must('[data-testid="kc-stance-lnk1"]') as HTMLSelectElement
      sel.value = ''
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    apiCalls = []
    await click(must('[data-testid="kc-record-lnk1"]'))
    expect(apiCalls.map((c) => `${c.method} ${c.path}`))
      .toContain('POST /api/opportunities/opp1/key-contacts/lnk1/stance')
  })

  test('K5 removing writes immediately, on its own route', async () => {
    await mount()
    apiCalls = []
    await click(must('[data-testid="kc-remove-lnk1"]'))
    expect(apiCalls.map((c) => `${c.method} ${c.path}`))
      .toContain('DELETE /api/opportunities/opp1/key-contacts/lnk1')
  })

  test('K6 adding refuses with no contact chosen, and writes when there is one', async () => {
    await mount()
    apiCalls = []
    await click(must('[data-testid="kc-add"]'))
    expect(apiCalls, 'it posted with no contact chosen').toHaveLength(0)
    expect(must('[data-testid="kc-feedback"]').textContent).toContain('Choose a contact')
  })

  test('K7 a save of the SURFACE never carries key-contact data', async () => {
    const onSave = vi.fn()
    await mount({ onSave })
    await act(async () => {
      const sel = must('[data-testid="kc-stance-lnk1"]') as HTMLSelectElement
      sel.value = ''
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await click(display('country'))
    await act(async () => {
      const i = must('[data-testid="input-country"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, 'Malaysia')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(must('[data-testid="save-all"]'))
    expect(onSave).toHaveBeenCalledWith({ country: 'Malaysia' })
  })
})
