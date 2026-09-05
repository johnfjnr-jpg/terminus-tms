// ── THE FORM/VERSION SEAM AND THE SAVE ───────────────────────────────────
//
// Derived from Phase 0 item 2's measurement of what crosses between the deal
// form and the version machinery, and item 8's measurement of the save path.
// Not from either implementation.
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
  'deal-ssExisting': '10', 'deal-gstPct': '9',
  'deal-cm-0-usd': '5000', 'deal-cm-0-month': '3', 'deal-cm-1-usd': '2000', 'deal-cm-1-month': '0',
}

const sources = (over: Partial<Parameters<typeof makeSeam>[0]> = {}) => ({
  getValues: () => V, getUi: () => UI, getRates: () => RATES,
  populate: vi.fn(), recompute: vi.fn(() => 'recomputed'),
  currentVersionRejection: () => null, refreshVersionActions: vi.fn(),
  ...over,
})

describe('the seam exposes exactly what Phase 0 measured crossing', () => {
  test('the five form-facing members and the two outward feeds, and nothing else', () => {
    const seam = makeSeam(sources())
    expect(Object.keys(seam).sort()).toEqual([
      'catalogRates', 'oppCurrentVersionRejection', 'oppRefreshVersionActions',
      'populateForm', 'readContractorMilestones', 'readPayload', 'recompute',
    ])
  })

  // The reason box is version machinery living in the form's DOM. Phase 0 ruled
  // it should move to Round 4 rather than be proxied, so it must NOT appear.
  test('the version reason box is NOT proxied through the seam', () => {
    const seam = makeSeam(sources()) as unknown as Record<string, unknown>
    for (const k of Object.keys(seam)) expect(k.toLowerCase()).not.toContain('reason')
  })
})

describe('reads go through the PROVED reader', () => {
  test('readPayload returns exactly what the proved reader returns', () => {
    expect(makeSeam(sources()).readPayload()).toEqual(readDealPayload(V, UI, RATES))
  })

  test('readContractorMilestones keeps its own contract: amount-only, with incomplete', () => {
    const rows = makeSeam(sources()).readContractorMilestones() as { usd: number; incomplete: boolean }[]
    expect(rows).toHaveLength(2)
    // The row with an amount and NO month is carried, flagged, not dropped -
    // which is the row the schedule warning exists to surface.
    expect(rows.find((r) => r.usd === 2000)!.incomplete).toBe(true)
    expect(rows.find((r) => r.usd === 5000)!.incomplete).toBe(false)
  })

  test('catalogRates hands back the catalog the form priced against', () => {
    expect(makeSeam(sources()).catalogRates()).toEqual(RATES)
  })
})

describe('writes reach the form, in the measured order', () => {
  test('populateForm then recompute, both delegated', () => {
    const src = sources()
    const seam = makeSeam(src)
    const payload = { ssExisting: 12 }
    seam.populateForm(payload)
    expect(src.populate).toHaveBeenCalledWith(payload)
    expect(seam.recompute()).toBe('recomputed')
  })
})

describe('the outward feeds are supplied with identical semantics', () => {
  // app.js reads the rejection AT RENDER TIME rather than caching it, because
  // the versions load after the banner first runs and the answer changes when
  // they arrive. A seam that cached it would freeze the first answer.
  test('the rejection is asked afresh on every call', () => {
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

  test('and the catalog rates never reach the record', async () => {
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
    const body = patch.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['payload'])
    expect(body).not.toHaveProperty('expected_revision')
  })

  test('a refusal is returned unchanged for the caller to render', async () => {
    const patch = vi.fn(async (_id: string, _body: unknown) => ({ ok: false, status: 409, data: { error: 'stale' } }))
    const r = await saveDeal('opp-1', readDealPayload(V, UI, RATES), patch)
    expect(r).toEqual({ ok: false, status: 409, data: { error: 'stale' } })
  })
})
