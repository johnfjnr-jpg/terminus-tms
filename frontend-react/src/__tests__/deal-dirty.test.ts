// ── B1 TO B7, THE FORM'S DIRTY MODEL ─────────────────────────────────────
//
// Derived from MIGRATION_ROUND_3_PHASE_0_REPORT.md item 5's enumeration, not
// from either implementation. Each test names the behaviour it is about, and
// several would pass against a cached-flag implementation on their own - which
// is why B2 has its own negative.
import { describe, test, expect } from 'vitest'
import {
  dealDirtyKeys, isDealFormDirty, dirtySections, sectionOfKey, captureSavedBaseline,
} from '../deal/dirty'
import { readDealPayload, pickSalespersonWritable } from '../deal/payload'
import type { UiState, Values } from '../deal/payload'

const RATES = { ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200, hoSafesight: 10, hoAqm: 8, hoHemir: 12 }
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const V: Values = {
  'deal-ssExisting': '10', 'deal-aqm': '4', 'deal-duration': '24',
  'deal-targetMargin': '30', 'deal-warrantyPct': '5', 'deal-gstPct': '9',
}
const payloadOf = (v: Values, ui: UiState = UI) => readDealPayload(v, ui, RATES)

describe('B1: dirty is a comparison against a baseline, computed', () => {
  test('a form matching its baseline is clean', () => {
    const p = payloadOf(V)
    expect(dealDirtyKeys(p, captureSavedBaseline(p))).toEqual([])
    expect(isDealFormDirty(p, captureSavedBaseline(p))).toBe(false)
  })

  test('a changed key is named', () => {
    const base = captureSavedBaseline(payloadOf(V))
    const after = payloadOf({ ...V, 'deal-gstPct': '7' })
    expect(dealDirtyKeys(after, base)).toEqual(['gstPct'])
  })

  // MEASURED, not guessed. A first draft asserted "> 20" and got 14, and the
  // 14 is the correct and more interesting answer: `changedKeys` treats a NULL
  // value as not differing from an ABSENT one, so with no baseline only the
  // keys carrying a real value are dirty. Twelve unset keys stay quiet.
  //
  // That matters beyond this test: it is why a fresh form does not present
  // itself as twenty-six pending changes.
  test('with NO baseline, only keys carrying a VALUE read dirty', () => {
    const dirty = dealDirtyKeys(payloadOf(V), null)
    expect(dirty).toEqual([
      'aqm', 'contractorMilestones', 'duration', 'factoring', 'grossUp', 'gstPct',
      'installResp', 'invoicing', 'marginOverrides', 'milestones', 'ssExisting',
      'structure', 'targetMargin', 'warrantyPct',
    ])
    // And the unset ones are quiet, which is the half worth naming.
    for (const k of ['ssNew', 'hemir', 'lumpSumCost', 'whtPct', 'bidCurrency', 'recoveryMonths']) {
      expect(dirty, `${k} is null and should not differ from absent`).not.toContain(k)
    }
  })
})

describe('B2: no cached flag - typing back to the original reads CLEAN', () => {
  // The negative that a cached boolean cannot pass. The vanilla deleted its
  // cache for exactly this: restore read the cache and the two drifted.
  test('change and change back is clean, with no clearing step in between', () => {
    const base = captureSavedBaseline(payloadOf(V))
    const away = payloadOf({ ...V, 'deal-gstPct': '7' })
    expect(isDealFormDirty(away, base)).toBe(true)
    const back = payloadOf({ ...V, 'deal-gstPct': '9' })
    expect(isDealFormDirty(back, base)).toBe(false)
  })

  test('the answer depends only on its arguments, so nothing can go stale', () => {
    const base = captureSavedBaseline(payloadOf(V))
    const away = payloadOf({ ...V, 'deal-gstPct': '7' })
    // Called repeatedly and interleaved: a memo keyed on less than the whole
    // payload would return a stale answer to one of these.
    expect(isDealFormDirty(away, base)).toBe(true)
    expect(isDealFormDirty(payloadOf(V), base)).toBe(false)
    expect(isDealFormDirty(away, base)).toBe(true)
  })
})

describe('B3: the baseline is the SALESPERSON-WRITABLE projection', () => {
  test('a catalog rate moving does not make the form dirty', () => {
    const base = captureSavedBaseline(payloadOf(V))
    // The rates are not salesperson-writable, so a different catalog cannot
    // dirty the form even though the raw payload changes.
    const other = readDealPayload(V, UI, { ...RATES, ssUnitCost: 9999 })
    expect(dealDirtyKeys(other, base)).toEqual([])
  })

  test('the baseline holds only owned keys', () => {
    const base = captureSavedBaseline(payloadOf(V))
    expect(Object.keys(base)).not.toContain('ssUnitCost')
    expect(Object.keys(base)).toContain('marginOverrides')
  })
})

describe('B4: a key maps to its section by id convention, with a prefix fallback', () => {
  test('an exact id resolves', () => {
    expect(sectionOfKey('gstPct')).toBe('risk')
    expect(sectionOfKey('ssExisting')).toBe('units')
    expect(sectionOfKey('duration')).toBe('structural')
  })

  test('THE PREFIX FALLBACK: a key with no single input still finds a section', () => {
    // `milestones` has no `deal-milestones` input; the fallback finds
    // `deal-ms-...`? No - it finds nothing, and that is the honest answer for
    // this key. The fallback is proved on a key that DOES have prefixed inputs.
    expect(sectionOfKey('margin')).toBe('structural')      // deal-margin-hwSs...
    expect(sectionOfKey('factoring-')).toBe('payment')     // deal-factoring-ratePct
  })

  test('an unknown key resolves to nothing rather than to a wrong section', () => {
    expect(sectionOfKey('notAFieldAnywhere')).toBeNull()
  })

  test('dirtySections names the sections holding a dirty key', () => {
    const base = captureSavedBaseline(payloadOf(V))
    const after = payloadOf({ ...V, 'deal-gstPct': '7', 'deal-ssExisting': '11' })
    expect([...dirtySections(after, base)].sort()).toEqual(['risk', 'units'])
  })

  test('and a clean form names no sections', () => {
    const p = payloadOf(V)
    expect([...dirtySections(p, captureSavedBaseline(p))]).toEqual([])
  })
})

describe('B7: captureSavedBaseline is the only clearer', () => {
  test('re-snapshotting after a change reads clean', () => {
    const base = captureSavedBaseline(payloadOf(V))
    const after = payloadOf({ ...V, 'deal-gstPct': '7' })
    expect(isDealFormDirty(after, base)).toBe(true)
    const recaptured = captureSavedBaseline(after)
    expect(isDealFormDirty(after, recaptured)).toBe(false)
  })

  test('and it snapshots the projection, not the raw payload', () => {
    const p = payloadOf(V)
    expect(captureSavedBaseline(p)).toEqual(pickSalespersonWritable(p))
  })
})
