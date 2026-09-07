// ── ROUND 5 PHASE 2: THE HOST'S SAVE ────────────────────────────────────
//
// Written because the Phase 2 injection sweep's FOURTH silence named it: an
// injection that added a key to every save changed nothing any test could
// see. The surface tests assert what the panel HANDS to onSave; nothing
// asserted what the host then SENDS. Verification 51.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReferenceHost } from '../reference/ReferenceHost'
import { ShellProvider } from '../ShellContext'
import { SAME_AS_ACCOUNT } from '../reference/descriptors'
import type { ShellServices, ChangeReasonOptions } from '../shell-services'

let host: HTMLElement
let root: Root
let patches: { id: string, body: unknown }[] = []
let posts: { path: string, body: unknown }[] = []
let reasonOpts: ChangeReasonOptions | null = null
/** Per-test override for what a close-date POST answers. */
let closeDateReply: { ok: boolean, status?: number, data?: unknown } = { ok: true, status: 200, data: {} }
// THE RELOAD MUST ANSWER WITH THE RECORD UNDER TEST, not with a fixed one.
// Found by calibration: the no-stored-date fixture was defeated because the
// host reloads on mount and the stub answered with OPP every time, so `stored`
// was never null and the first-recording path was unreachable. Verification 47
// - a fixture the system could not produce tests nothing.
let currentOpp: typeof OPP

const OPP = {
  id: 'opp-1',
  payload: { name: 'Changi T5', country: 'Singapore', duration: '36' },
  opportunity_details: { forecast_close_date: '2026-11-30' },
  account: null,
  reference_code: 'TT-SGP-AIRPRT-1',
  status: 'Qualification',
  created_at: '2026-03-04T10:00:00.000Z',
}

const services: ShellServices = shellServices({
  api: (async (m: string, path: string, body?: unknown) => {
    if (path.includes('close-date-move')) { posts.push({ path, body }); return closeDateReply }
    if (path.includes('key-contacts')) return { ok: true, status: 200, data: [] }
    if (path.includes('terminus-staff')) return { ok: true, status: 200, data: [{ name: 'Brad Kerr' }] }
    return { ok: true, status: 200, data: currentOpp }
  }) as ShellServices['api'],
  navigate: vi.fn(), detailLoaded: vi.fn(),
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
  // CAPTURED, NOT EXECUTED. The dialogue is the shell's, so what this suite
  // can assert is exactly what the host HANDS it - which is the contract
  // between the two - and then drive onConfirm/onDone/onCancel by hand the
  // way the shell would.
  requestChangeReason: (opts: ChangeReasonOptions) => { reasonOpts = opts },
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p: () => void) => { p() },
})

const mount = async (opp: typeof OPP = OPP) => {
  currentOpp = opp
  patches = []
  posts = []
  reasonOpts = null
  closeDateReply = { ok: true, status: 200, data: {} }
  ;(window as unknown as { oppPatch: unknown }).oppPatch = async (id: string, body: unknown) => {
    patches.push({ id, body })
    return { ok: true, status: 200 }
  }
  ;(window as unknown as { loadOpportunityDetail: unknown }).loadOpportunityDetail = () => {}
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  await act(async () => {
    root.render(<ShellProvider services={services}><ReferenceHost opp={opp} /></ShellProvider>)
  })
}
const must = (sel: string) => {
  const e = host.querySelector(sel) as HTMLElement | null
  if (!e) throw new Error(`no ${sel}`); return e
}
const editRow = async (name: string, value: string) => {
  await act(async () => { must(`[data-testid="display-${name}"]`).click() })
  await act(async () => {
    const i = must(`[data-testid="input-${name}"]`) as HTMLInputElement
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
      .set!.call(i, value)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const save = async () => { await act(async () => { must('[data-testid="save-all"]').click() }) }

beforeEach(() => { document.body.innerHTML = '' })

describe('H: what the host actually sends', () => {
  test('H1 ONLY WHAT MOVED. An untouched key is never in the payload', async () => {
    await mount()
    await editRow('country', 'Malaysia')
    await save()
    expect(patches).toHaveLength(1)
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(Object.keys(body.payload).sort(),
      'the save carried a key nobody edited').toEqual(['country'])
    expect(body.payload.country).toBe('Malaysia')
  })

  test('H2 a numeric key is sent as a NUMBER, not an input\'s string', async () => {
    await mount()
    await editRow('duration', '48')
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload.duration, 'duration went as a string, which is the '
      + 'defect numeric-payload exists for').toBe(48)
  })

  test('H3 a cleared numeric key is sent as null, never as an empty string', async () => {
    await mount()
    await editRow('duration', '')
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload.duration).toBe(null)
  })

  test('H4 the same-as-account flag is sent as a BOOLEAN, not the string', async () => {
    await mount()
    await act(async () => { must(`[data-testid="input-${SAME_AS_ACCOUNT}"]`).click() })
    await save()
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(body.payload[SAME_AS_ACCOUNT], 'the checkbox\'s string representation '
      + 'reached the payload; the record stores a flag').toBe(true)
  })

  test('H5 A5: estClose is NOT sent through this payload', async () => {
    // It is opportunity_details.forecast_close_date and saves through the
    // close-date-move route, which is the one row whose write is not batched.
    await mount()
    await act(async () => { must('[data-testid="display-estClose"]').click() })
    await act(async () => {
      const i = must('[data-testid="input-estClose"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, '2027-01-31')
      i.dispatchEvent(new Event('change', { bubbles: true }))
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await save()
    // THE GUARD WAS `if (patches.length)`, and that is why the defect below it
    // survived a round. With estClose the only dirty field the host sent
    // NOTHING AT ALL, so the loop never ran and the assertion passed on an
    // empty body - true by absence, Verification 14. It now asserts the
    // positive too: the key is absent from the payload BECAUSE it went to its
    // own route, not because nothing was saved.
    for (const p of patches) {
      const body = p.body as { payload: Record<string, unknown> }
      expect(Object.keys(body.payload), 'estClose was sent through the generic '
        + 'payload, which is not the route that writes it').not.toContain('estClose')
    }
    // The default record HAS a stored date, so this is a MOVE and the route
    // call comes after the reason. Driving it is the point: the old version
    // stopped at "no payload key", which is equally true of a save that did
    // nothing at all.
    expect(reasonOpts, 'estClose was dropped: no payload key AND no route, '
      + 'which is what a person typing a date and pressing Save got').not.toBeNull()
    await reasonOpts!.onConfirm('Tender slipped')
    expect(posts, 'the date never reached its own route').toHaveLength(1)
    expect(posts[0].path).toContain('/close-date-move')
  })

  test('H6 nothing dirty sends nothing at all', async () => {
    await mount()
    await act(async () => { must('[data-testid="display-country"]').click() })
    await save()
    expect(patches, 'an untouched surface wrote to the record').toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// E: THE EST. CLOSE DATE WRITE PATH
// ─────────────────────────────────────────────────────────────────────────
//
// Round 6 Phase 0. Derived from the ROUTE'S measured contract - POST
// close-date-move with {date, reason?}, a reason required only for a move -
// and from closeDateNeedsReason, which the host imports from the same shared
// module the route does.
//
// Before this, estClose was `continue`d out of the payload and had no other
// path, so the row was fully editable and saving discarded what was typed.
describe('E: the Est. Close Date write path', () => {
  // The typed shape keeps forecast_close_date required, and a record that has
  // never had one is exactly the state under test - so it is widened here
  // rather than the fixture bent to fit the type.
  const NO_DATE = { ...OPP, opportunity_details: {} as { forecast_close_date?: string } } as typeof OPP

  const typeDate = async (v: string) => {
    await act(async () => { must('[data-testid="display-estClose"]').click() })
    await act(async () => {
      const i = must('[data-testid="input-estClose"]') as HTMLInputElement
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(i, v)
      i.dispatchEvent(new Event('change', { bubbles: true }))
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  test('E1 A FIRST RECORDING asks nothing and posts the date alone', async () => {
    // No stored date, so there is no move to explain. Requiring a reason here
    // is what made a walk type "First Recording" into the box.
    await mount(NO_DATE)
    await typeDate('2027-01-31')
    await save()
    expect(reasonOpts, 'a dialogue opened for a date nobody had set before').toBeNull()
    expect(posts).toHaveLength(1)
    expect(posts[0].path).toContain('/close-date-move')
    expect(posts[0].body).toEqual({ date: '2027-01-31' })
  })

  test('E2 A MOVE opens the dialogue and writes NOTHING until it is confirmed', async () => {
    await mount()
    await typeDate('2027-01-31')
    await save()
    expect(reasonOpts, 'a stored date was moved without asking why').not.toBeNull()
    expect(reasonOpts!.heading).toBe('Move Est. Close Date')
    expect(reasonOpts!.contextValue).toBe('2027-01-31')
    // NOT the vanilla's id. Measured live, two elements carried `ref-save-all`
    // - the vanilla's tab-action button sits outside the block the swap hides -
    // and getElementById returns the first, so focus went to the wrong one.
    expect(reasonOpts!.returnFocusTo, 'focus has nowhere to return to').toBe('ref-react-save-all')
    expect(posts, 'the date was written before the person gave a reason').toHaveLength(0)
    expect(patches, 'the payload was written before the date was settled').toHaveLength(0)
  })

  test('E3 confirming sends the date AND the reason', async () => {
    await mount()
    await typeDate('2027-01-31')
    await save()
    const r = await reasonOpts!.onConfirm('Customer pushed the tender')
    expect(r.ok).toBe(true)
    expect(posts[0].body).toEqual({ date: '2027-01-31', reason: 'Customer pushed the tender' })
  })

  test('E4 whatever else was dirty is saved in the SAME action', async () => {
    // A person pressed Save once. Needing a second press for the fields that
    // were not the date is the behaviour the vanilla deliberately avoided.
    await mount()
    await editRow('country', 'Malaysia')
    await typeDate('2027-01-31')
    await save()
    expect(patches, 'the rest was saved before the date was settled').toHaveLength(0)
    await reasonOpts!.onConfirm('Customer pushed the tender')
    await act(async () => { await reasonOpts!.onDone?.() })
    expect(patches, 'the other dirty field needed a second Save').toHaveLength(1)
    const body = patches[0].body as { payload: Record<string, unknown> }
    expect(Object.keys(body.payload)).toEqual(['country'])
  })

  test('E5 a REFUSED first recording lands where the person can see it', async () => {
    // There is no dialogue on this path, so the route's message has to reach
    // the surface feedback or it reaches nobody. Architecture 8: the failure
    // branch is exercised rather than assumed.
    await mount(NO_DATE)
    closeDateReply = { ok: false, status: 400, data: { error: 'date cannot be in the past' } }
    await typeDate('2020-01-01')
    await save()
    expect(host.textContent, 'the route refused and the screen said nothing')
      .toContain('date cannot be in the past')
    expect(patches, 'the payload was saved anyway after the date was refused').toHaveLength(0)
  })

  test('E6 a REFUSED move is handed back to the dialogue, which stays open', async () => {
    await mount()
    closeDateReply = { ok: false, status: 400, data: { error: 'reason is required' } }
    await typeDate('2027-01-31')
    await save()
    const r = await reasonOpts!.onConfirm('')
    expect(r.ok).toBe(false)
    expect(r.error, 'the dialogue was given no message to show').toBe('reason is required')
  })

  test('E7 CANCEL touches nothing', async () => {
    // Cancelling the reason for one field must not discard an unrelated edit.
    await mount()
    await editRow('country', 'Malaysia')
    await typeDate('2027-01-31')
    await save()
    reasonOpts!.onCancel?.()
    expect(posts, 'cancel wrote the date').toHaveLength(0)
    expect(patches, 'cancel saved the rest anyway').toHaveLength(0)
    expect((must('[data-testid="input-country"]') as HTMLInputElement).value,
      'cancel discarded an unrelated edit').toBe('Malaysia')
  })

  test('E8 an UNCHANGED date is not a move, so no dialogue opens', async () => {
    // The route answers 400 "date is unchanged" and closeDateChangeKind gives
    // it its own answer rather than folding it into move - so a person is not
    // asked to justify a change before being told there was not one.
    await mount()
    await typeDate('2026-11-30')
    await save()
    expect(reasonOpts, 'asked for a reason for a date that did not change').toBeNull()
  })
})
