// ── ROUND 5 PHASE 1 ITEMS 2, 3 and 4: THE SURFACE ───────────────────────
//
// The door is calibrated in BOTH directions here, in jsdom, which is item 3's
// requirement: a not-mine record refuses every row including keyboard and
// seed; a mine record refuses none; an absent registry fails closed.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReferencePanel } from '../reference/ReferencePanel'
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

const shell = (canEdit: boolean | 'absent'): ShellServices => ({
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
})

const mount = async (opts: {
  canEdit?: boolean | 'absent'
  src?: ReferenceSource
  links?: KcLink[]
  onSave?: (c: Record<string, string>) => void
} = {}) => {
  apiCalls = []
  document.body.innerHTML = '<div id="host"></div>'
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
          onChanged={() => {}} />
      </ShellProvider>)
  })
}
const q = (sel: string) => host.querySelector(sel) as HTMLElement | null
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

beforeEach(() => { document.body.innerHTML = '' })

// ── ITEM 2: THE ROWS ────────────────────────────────────────────────────
describe('R: the rows render per the census', () => {
  test('R1 all 21 editable rows are present', async () => {
    await mount()
    for (const n of EDITABLE) expect(q(`[data-field="${n}"]`), `${n} did not render`).toBeTruthy()
    expect(host.querySelectorAll('[data-dirty]'), 'expected 21 editable rows').toHaveLength(21)
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
    const services: ShellServices = { ...shell(true), canEditFields: () => allowed }
    document.body.innerHTML = '<div id="host"></div>'
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
    expect(paths).toContain('/api/contacts')
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
