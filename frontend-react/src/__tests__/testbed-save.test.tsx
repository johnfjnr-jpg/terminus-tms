// ── THE SAVE PATH, PER THE FIXED VANILLA SHAPE ──────────────────────────
import { describe, test, expect } from 'vitest'
import { buildPayload } from '../testbed/TestBedHost'
import { PAYLOAD_ONLY_KEYS } from '../testbed/descriptors'

describe('the payload a save sends', () => {
  test('ONLY-DIRTY: an untouched key is never in it', () => {
    expect(buildPayload({ city: 'KL' })).toEqual({ city: 'KL' })
  })

  test('THE TWO SERVER-COMPUTED KEYS CANNOT REACH IT', () => {
    // They are payload keys and not rows, so they can never be dirty - but a
    // later change that made them rows would send them, and the server rejects
    // every such save. Asserted rather than trusted to the render list.
    const out = buildPayload({ city: 'KL', estCostPerUnit: '5', indicativeCost: '9' })
    for (const k of PAYLOAD_ONLY_KEYS) expect(Object.keys(out)).not.toContain(k)
    expect(out).toEqual({ city: 'KL' })
  })

  test('a BUYER change does not ride the payload: it has its own route', () => {
    const out = buildPayload({ city: 'KL', 'buyer-Client Legal Buyer': 'c-1' })
    expect(out).toEqual({ city: 'KL' })
  })

  test('a CLEARED field is sent as the empty string, not dropped', () => {
    // The record reads absence as deletion, so a cleared field must be sent
    // rather than omitted - and it must be sent as what it is.
    expect(buildPayload({ city: '' })).toEqual({ city: '' })
  })

  test('nothing dirty builds nothing, so the host can refuse to send', () => {
    expect(Object.keys(buildPayload({}))).toHaveLength(0)
  })
})
