// ── THE FORM/VERSION SEAM, AS RULED ──────────────────────────────────────
//
// AMENDED, Round 3 D2b, and the amendment is the claim changing by ruling
// rather than a test bent to fit code.
//
// The previous version asserted the key set was EXACTLY the five members Phase
// 0 measured plus the two feeds. D2's item-0 measurement found eleven names
// crossing, two of them behavioural, so the interface was enforcing its own
// incompleteness. The exactness is KEPT - it is still a set equality, so an
// eighth member cannot be added quietly - and the set it is exact about has
// changed.
import { describe, test, expect, vi } from 'vitest'
import { makeSeam, saveDeal } from '../deal/seam'
import { readDealPayload, pickSalespersonWritable } from '../deal/payload'
import type { UiState, Values, CatalogRates } from '../deal/payload'

const RATES: CatalogRates = { ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200, hoSafesight: 10, hoAqm: 8, hoHemir: 12 }
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const V: Values = {
  'deal-ssExisting': '10', 'deal-gstPct': '9', 'deal-lumpCost': '200000',
  'deal-cm-0-usd': '5000', 'deal-cm-0-month': '3', 'deal-cm-1-usd': '2000', 'deal-cm-1-month': '0',
}
const cleanBaseline = () => pickSalespersonWritable(readDealPayload(V, UI, RATES))

type Src = Parameters<typeof makeSeam>[0]
const sources = (over: Partial<Src> = {}): Src => ({
  getValues: () => V, getUi: () => UI, getRates: () => RATES,
  getBaseline: () => cleanBaseline(),
  save: vi.fn(async (_p: Record<string, unknown>) => {}),
  populate: vi.fn((_p: Record<string, unknown>) => {}),
  recompute: vi.fn(() => 'recomputed'),
  currentVersionRejection: () => null,
  refreshVersionActions: vi.fn(),
  ...over,
})

describe('the seam is exactly the ruled set', () => {
  test('seven members, and nothing else', () => {
    expect(Object.keys(makeSeam(sources())).sort()).toEqual([
      'freezeCurrentState', 'hasUnsavedChanges', 'oppCurrentVersionRejection',
      'oppRefreshVersionActions', 'populateForm', 'readContractorMilestones', 'recompute',
    ])
  })

  // The reason box is version machinery living in the form's DOM. It moves
  // version-side in the split rather than being proxied.
  test('the version reason box is NOT proxied', () => {
    for (const k of Object.keys(makeSeam(sources()))) expect(k.toLowerCase()).not.toContain('reason')
  })

  // opportunityId became an init parameter and `wired` internal state. Neither
  // is an interface member, and their absence is asserted so a later session
  // cannot quietly reintroduce module state through the seam.
  test('opportunityId and wired are NOT members', () => {
    const keys = Object.keys(makeSeam(sources()))
    expect(keys).not.toContain('opportunityId')
    expect(keys).not.toContain('wired')
  })
})

describe('freezeCurrentState: THE ORDER IS THE POINT', () => {
  test('a DIRTY form is saved FIRST, then the saved payload is returned', async () => {
    // ── A DISCRIMINATING TRACE, NOT A TAUTOLOGY ─────────────────────────
    //
    // The first version pushed "save" inside the mock and "read" after the
    // await, then asserted ['save','read']. That CANNOT FAIL: the push after
    // an await always follows anything the awaited call did. Verification 17,
    // caught by asking what the assertion would do if the order were wrong.
    //
    // This traces the SOURCE calls instead. Reading the return calls getRates;
    // so does the dirty check. An implementation that built its return before
    // saving would put `save` LAST, and this asserts it is not.
    const trace: string[] = []
    const src = sources({
      getRates: () => { trace.push('read'); return RATES },
      getBaseline: () => ({ ...cleanBaseline(), gstPct: 999 }),
      save: vi.fn(async () => { trace.push('save') }),
    })
    const seam = makeSeam(src)
    const frozen = await seam.freezeCurrentState()

    expect(trace).toContain('save')
    expect(trace.lastIndexOf('read'), 'nothing was read AFTER the save, so the return predates it')
      .toBeGreaterThan(trace.indexOf('save'))
    expect(trace.indexOf('save'), 'the save happened before anything was read')
      .toBeGreaterThan(-1)
    expect(src.save).toHaveBeenCalledTimes(1)
    // What it returns is what the reader produces, and the save was given the
    // projection of the same thing.
    expect(frozen.payload).toEqual(readDealPayload(V, UI, RATES))
    expect((src.save as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toEqual(pickSalespersonWritable(readDealPayload(V, UI, RATES)))
  })

  test('a CLEAN form is not saved at all', async () => {
    const src = sources()
    await makeSeam(src).freezeCurrentState()
    expect(src.save).not.toHaveBeenCalled()
  })

  test('a form with no baseline yet is not dirty, so nothing is saved', async () => {
    const src = sources({ getBaseline: () => null })
    await makeSeam(src).freezeCurrentState()
    expect(src.save).not.toHaveBeenCalled()
  })

  // A version taken from a form whose save was refused would freeze a payload
  // the record does not hold. The throw is what stops that.
  test('a refused save THROWS rather than returning a frozen state', async () => {
    const src = sources({
      getBaseline: () => ({ ...cleanBaseline(), gstPct: 999 }),
      save: vi.fn(async () => { throw new Error('This Account changed since the screen loaded.') }),
    })
    await expect(makeSeam(src).freezeCurrentState()).rejects.toThrow('changed since the screen loaded')
  })

  test('it carries the contractor schedule and the rates it priced against', async () => {
    const frozen = await makeSeam(sources()).freezeCurrentState()
    expect(frozen.catalogRates).toEqual(RATES)
    expect(frozen.contractorMilestones).toHaveLength(2)
    // The dateless row is carried and flagged, not dropped.
    expect(frozen.contractorMilestones.find((r) => r.usd === 2000)!.incomplete).toBe(true)
  })

  // MEASURED, per the ruling: the version machinery's single num() call read
  // `deal-lumpCost`, a form input, so it folds into the return - and needs no
  // member, because lumpSumCost is already a payload key.
  test('the contractor base travels in the payload, so num needs no member', async () => {
    const frozen = await makeSeam(sources()).freezeCurrentState()
    expect(frozen.payload.lumpSumCost).toBe(200000)
    expect(Object.keys(makeSeam(sources()))).not.toContain('num')
  })
})

describe('hasUnsavedChanges: what restore asks before overwriting', () => {
  test('false when the form matches its baseline', () => {
    expect(makeSeam(sources()).hasUnsavedChanges()).toBe(false)
  })

  test('true when it does not', () => {
    expect(makeSeam(sources({ getBaseline: () => ({ ...cleanBaseline(), gstPct: 999 }) })).hasUnsavedChanges()).toBe(true)
  })

  test('and it is asked AFRESH, so a form that becomes dirty is seen', () => {
    let baseline = cleanBaseline()
    const seam = makeSeam(sources({ getBaseline: () => baseline }))
    expect(seam.hasUnsavedChanges()).toBe(false)
    baseline = { ...cleanBaseline(), gstPct: 999 }
    expect(seam.hasUnsavedChanges()).toBe(true)
  })
})

describe('the restore path', () => {
  test('populateForm then recompute, both delegated', () => {
    const src = sources()
    const seam = makeSeam(src)
    seam.populateForm({ ssExisting: 12 })
    expect(src.populate).toHaveBeenCalledWith({ ssExisting: 12 })
    expect(seam.recompute()).toBe('recomputed')
  })

  // updateDirtyState was a seam member in the vanilla because dirty was pushed.
  // Here it is COMPUTED on demand against the baseline, so there is nothing to
  // tell: the successor does not exist by construction, and this asserts it.
  test('updateDirtyState HAS NO SUCCESSOR: dirty is computed, not pushed', () => {
    const keys = Object.keys(makeSeam(sources()))
    expect(keys).not.toContain('updateDirtyState')
    // And the proof it is not needed: after a restore writes a payload and the
    // baseline follows it, the form reads CLEAN with nothing having been told.
    let baseline = cleanBaseline()
    const seam = makeSeam(sources({ getBaseline: () => baseline }))
    baseline = { ...cleanBaseline(), gstPct: 999 }
    expect(seam.hasUnsavedChanges()).toBe(true)
    baseline = cleanBaseline()                      // restore re-baselines
    expect(seam.hasUnsavedChanges()).toBe(false)    // no updateDirtyState call
  })
})

describe('the outward feeds', () => {
  test('the rejection is asked afresh on every call, never cached', () => {
    let answer: unknown = null
    const seam = makeSeam(sources({ currentVersionRejection: () => answer }))
    expect(seam.oppCurrentVersionRejection()).toBeNull()
    answer = { label: 'V2' }
    expect(seam.oppCurrentVersionRejection()).toEqual({ label: 'V2' })
  })

  test('refreshVersionActions is a call through, not a no-op', () => {
    const src = sources()
    makeSeam(src).oppRefreshVersionActions()
    expect(src.refreshVersionActions).toHaveBeenCalledTimes(1)
  })
})

describe('saveDeal: the projection through oppPatch, which keeps owning the write', () => {
  test('it sends the salesperson-writable projection, not the raw payload', async () => {
    const patch = vi.fn(async (_id: string, _body: unknown) => ({ ok: true }))
    const payload = readDealPayload(V, UI, RATES)
    await saveDeal('opp-1', payload, patch)
    expect(patch).toHaveBeenCalledWith('opp-1', { payload: pickSalespersonWritable(payload) })
  })

  test('and no catalog rate reaches the record', async () => {
    const patch = vi.fn(async (_id: string, _body: unknown) => ({ ok: true }))
    await saveDeal('opp-1', readDealPayload(V, UI, RATES), patch)
    const sent = (patch.mock.calls[0][1] as { payload: Record<string, unknown> }).payload
    for (const k of ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'hoSafesight', 'hoAqm', 'hoHemir']) {
      expect(Object.keys(sent), `${k} would be recorded as a per-deal override`).not.toContain(k)
    }
  })

  test('it adds no revision handling of its own: oppPatch owns that', async () => {
    const patch = vi.fn(async (_id: string, _body: unknown) => ({ ok: true }))
    await saveDeal('opp-1', readDealPayload(V, UI, RATES), patch)
    expect(Object.keys(patch.mock.calls[0][1] as object)).toEqual(['payload'])
  })

  test('a refusal is returned unchanged for the caller to render', async () => {
    const patch = vi.fn(async (_id: string, _body: unknown) => ({ ok: false, status: 409, data: { error: 'stale' } }))
    expect(await saveDeal('opp-1', readDealPayload(V, UI, RATES), patch))
      .toEqual({ ok: false, status: 409, data: { error: 'stale' } })
  })
})
