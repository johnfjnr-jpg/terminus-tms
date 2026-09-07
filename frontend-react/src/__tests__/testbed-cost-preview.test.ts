// ── THE COST PREVIEW ─────────────────────────────────────────────────────
//
// Derived from the Phase 0 enumeration C1-C9, with the two findings it
// produced asserted as FIXED rather than carried.
import { describe, test, expect, vi } from 'vitest'
import {
  COST_INPUT_KEYS, PREVIEW_DEBOUNCE_MS, effectiveValue, costFieldsDirty,
  previewBody, createPreviewRunner,
} from '../testbed/costPreview'

const STORED = { ssUnitCost: '1000', safesightCameras: '10', testBedDuration: '12' }

describe('C1-C3: what the preview sends', () => {
  test('C1 thirteen keys, and they are the engine\'s not the screen\'s', () => {
    expect(COST_INPUT_KEYS).toHaveLength(13)
    expect(COST_INPUT_KEYS).toContain('testBedDuration')
    expect(COST_INPUT_KEYS).not.toContain('city')
  })

  test('C2 the debounce is preserved', () => {
    expect(PREVIEW_DEBOUNCE_MS).toBe(400)
  })

  test('C3 every key is sent, drafts over stored', () => {
    const body = previewBody({ ssUnitCost: '2000' }, STORED)
    expect(Object.keys(body).sort()).toEqual([...COST_INPUT_KEYS].sort())
    expect(body.ssUnitCost).toBe('2000')
    expect(body.safesightCameras).toBe('10')
  })
})

describe('T3 FIXED: a CLEARED field previews as cleared', () => {
  test('an emptied field is a VALUE, not an absence', () => {
    // The vanilla reads `draft || stored || ''`, so a draft of '' falls through
    // to the stored value and the preview prices a field just cleared.
    expect(effectiveValue('ssUnitCost', { ssUnitCost: '' }, STORED),
      'a cleared field fell back to its stored value').toBe('')
  })

  test('and only the ABSENCE of a draft falls through', () => {
    expect(effectiveValue('ssUnitCost', {}, STORED)).toBe('1000')
    expect(effectiveValue('ssUnitCost', { ssUnitCost: undefined }, STORED)).toBe('1000')
  })

  test('a zero is a value too, which `||` would also have lost', () => {
    expect(effectiveValue('ssUnitCost', { ssUnitCost: '0' }, STORED)).toBe('0')
  })

  test('and a cleared field makes the set DIRTY, so the preview runs', () => {
    expect(costFieldsDirty({ ssUnitCost: '' }, STORED)).toBe(true)
  })
})

describe('C5: dirtiness is by comparison', () => {
  test('a draft equal to the stored value is not dirty', () => {
    expect(costFieldsDirty({ ssUnitCost: '1000' }, STORED)).toBe(false)
  })
  test('no drafts at all is not dirty', () => {
    expect(costFieldsDirty({}, STORED)).toBe(false)
  })
  test('a non-cost field does not make it dirty', () => {
    expect(costFieldsDirty({ city: 'Anywhere' } as Record<string, string>, STORED)).toBe(false)
  })
})

describe('T2 FIXED: the request-ordering guard', () => {
  const runner = (post: (b: Record<string, string>) => Promise<{ ok: boolean, data?: unknown }>) => {
    const applied: Array<unknown | null> = []
    return { r: createPreviewRunner(post, (d) => applied.push(d)), applied }
  }

  test('LATEST WINS: a slow FIRST response does not overwrite a fast second', async () => {
    // The defect this exists for: the vanilla assigns unconditionally, so two
    // overlapping requests resolve last-to-ARRIVE rather than last-to-be-SENT.
    let n = 0
    const gates: Array<() => void> = []
    const { r, applied } = runner(() => {
      const mine = ++n
      return new Promise((resolve) => {
        gates.push(() => resolve({ ok: true, data: { which: mine } }))
      })
    })
    const a = r.runNow({ ssUnitCost: '2000' }, STORED)
    const b = r.runNow({ ssUnitCost: '3000' }, STORED)
    // Resolve the SECOND first, then the first - the overlap the debounce
    // cannot rule out.
    gates[1]()
    await b
    gates[0]()
    await a
    expect(applied, 'a stale response was applied over a newer one')
      .toEqual([{ which: 2 }])
  })

  test('a stale response is DROPPED, not merged', async () => {
    let n = 0
    const gates: Array<() => void> = []
    const { r, applied } = runner(() => {
      const mine = ++n
      return new Promise((resolve) => { gates.push(() => resolve({ ok: true, data: { which: mine } })) })
    })
    const a = r.runNow({ ssUnitCost: '2000' }, STORED)
    const b = r.runNow({ ssUnitCost: '3000' }, STORED)
    gates[1](); await b
    gates[0](); await a
    expect(applied).toHaveLength(1)
  })

  test('and a single request still applies, so the guard is not a wall', async () => {
    const { r, applied } = runner(async () => ({ ok: true, data: { fine: true } }))
    await r.runNow({ ssUnitCost: '2000' }, STORED)
    expect(applied).toEqual([{ fine: true }])
  })
})

describe('C6 and C5: refusal and return-to-stored', () => {
  test('C6 a REFUSED preview falls back to the stored breakdown', async () => {
    // THE REFUSAL CARRIES A BODY, and that is what makes this a test.
    //
    // Written first with `{ ok: false }` and no data, the injection that
    // removes the ok-check came back SILENT with zero failures: both the
    // guarded and unguarded forms produce null when there is nothing to
    // produce, so the assertion passed for a reason unrelated to the guard.
    //
    // A real refusal has a body - a 400 carries an error object - and rendering
    // it would put a wrong number on screen wearing the unsaved marker, which
    // is the whole of what C6 forbids.
    const applied: Array<unknown | null> = []
    const r = createPreviewRunner(
      async () => ({ ok: false, data: { error: 'bad input', total: 999999 } }),
      (d) => applied.push(d))
    await r.runNow({ ssUnitCost: '2000' }, STORED)
    expect(applied, 'a failed preview left a wrong number wearing the unsaved marker')
      .toEqual([null])
  })

  test('C5 going back to the stored values CLEARS the preview without asking the server', async () => {
    const post = vi.fn(async () => ({ ok: true, data: {} }))
    const applied: Array<unknown | null> = []
    const r = createPreviewRunner(post, (d) => applied.push(d))
    await r.runNow({ ssUnitCost: '1000' }, STORED)
    expect(post, 'a clean set still asked the server').not.toHaveBeenCalled()
    expect(applied).toEqual([null])
  })
})

describe('C4: a preview is NOT a save', () => {
  test('nothing in the preview path writes the record', async () => {
    // The only outbound call the runner can make is the one it is given, and
    // the surface passes it the calculate endpoint. Asserted here so a later
    // change that reached for a PATCH has to break this.
    const calls: string[] = []
    const r = createPreviewRunner(async () => { calls.push('calculate'); return { ok: true, data: {} } },
      () => {})
    await r.runNow({ ssUnitCost: '2000' }, STORED)
    expect(calls).toEqual(['calculate'])
  })
})
