// ── THE SCORING CAPABILITY AND UNITS ────────────────────────────────────
//
// Derived from the Phase 0b enumeration C1-C9 and S1-S7.
import { describe, test, expect } from 'vitest'
import {
  COUNT_KEY_TO_UNIT_TYPE, COUNT_KEY_FOR_UNIT_TYPE, unitShortfall, countIsLocked,
  TB_COUNT_KEYS, UNITS_ROUTE, DERIVE_ROUTE, UNIT_TYPE_FOR_TAB_KEY, unitsForTab,
} from '../testbed/units'
import {
  levelsFor, awaitingReason, toggle,
  SCORE_ROUTE, MEASURABILITY_ROUTE,
  applyDraft, clearRecorded, NO_DRAFTS, type Criterion,
} from '../testbed/scoring'
import SCORING_JSON from './fixtures/scoring-live.json'

describe('S: units', () => {
  const UNITS = [
    { id: 'u1', type: 'SafeSight' }, { id: 'u2', type: 'SafeSight' },
    { id: 'u3', type: 'HEMIR' },
  ]

  test('S5 the two mappings are PROVEN INVERSE, not maintained twice', () => {
    for (const [key, type] of Object.entries(COUNT_KEY_TO_UNIT_TYPE)) {
      expect(COUNT_KEY_FOR_UNIT_TYPE[type], `${type} does not map back`).toBe(key)
    }
    expect(Object.keys(COUNT_KEY_FOR_UNIT_TYPE))
      .toHaveLength(Object.keys(COUNT_KEY_TO_UNIT_TYPE).length)
  })

  test('S2 a count and its units can DISAGREE, and the gap is named', () => {
    const s = unitShortfall(
      { safesightCameras: '4', airQualitySensors: '0', hemirSensors: '2' }, UNITS)
    expect(s.total).toBe(6)
    expect(s.missing, '4 SafeSight planned with 2 built, 2 HEMIR with 1').toBe(3)
  })

  test('S2 the shortfall is clamped PER TYPE, not on the total', () => {
    // Three extra SafeSight units must not cancel out two missing HEMIR ones:
    // the correction offered is per type, so the total must not net off.
    const many = [...UNITS, { id: 'u4', type: 'SafeSight' }, { id: 'u5', type: 'SafeSight' }]
    const s = unitShortfall(
      { safesightCameras: '1', airQualitySensors: '0', hemirSensors: '3' }, many)
    expect(s.missing, 'a surplus of one type cancelled a shortfall of another').toBe(2)
  })

  test('S2 no units at all means everything planned is missing', () => {
    expect(unitShortfall({ safesightCameras: '5' }, []).missing).toBe(5)
  })

  test('S4 a count whose units exist is LOCKED', () => {
    expect(countIsLocked('safesightCameras', UNITS)).toBe(true)
    expect(countIsLocked('airQualitySensors', UNITS)).toBe(false)
  })

  test('S4 an unknown count key locks nothing', () => {
    expect(countIsLocked('nonsense', UNITS)).toBe(false)
  })
})

describe('C: scoring', () => {
  // THE ROUTE'S CRITERIA, captured. `k1`/`k2` hand-shaped levels stood here.
  // Captured Test Bed criteria carry the default levels: 1 and 2 require a
  // reason, 3 to 5 do not.
  const CRITERIA = SCORING_JSON.criteria as Criterion[]
  const [K1, K2] = CRITERIA.map((c) => c.criterion_key)
  const none = () => []

  test('C1 levels come from the criterion, and a bare one scores nothing', () => {
    expect(levelsFor(CRITERIA[0])).toEqual(CRITERIA[0].levels)
    expect(levelsFor(CRITERIA[0]).length).toBeGreaterThan(0)
    expect(levelsFor(undefined)).toEqual([])
    expect(levelsFor({ criterion_key: 'x' })).toEqual([])
  })

  // Levels read FROM the captured criterion, never typed: the first level the
  // route marks reason_required, and the first it does not.
  const needs = String(CRITERIA[0].levels!.find((l) => l.reason_required)!.value)
  const free = String(CRITERIA[0].levels!.find((l) => !l.reason_required)!.value)

  test('C5 the SAVE is blocked, and it names WHICH criterion', () => {
    expect(awaitingReason({ [K1]: needs }, {}, CRITERIA, none)).toBe(K1)
  })

  test('C5 a level that needs no reason does not block', () => {
    expect(awaitingReason({ [K1]: free }, {}, CRITERIA, none)).toBeNull()
  })

  test('C5 a reason given unblocks it', () => {
    expect(awaitingReason({ [K1]: needs }, { [K1]: 'because' }, CRITERIA, none)).toBeNull()
  })

  test('C5 whitespace is not a reason', () => {
    expect(awaitingReason({ [K1]: needs }, { [K1]: '   ' }, CRITERIA, none)).toBe(K1)
  })

  test('C5 a REVISION blocks even at a level that needs none', () => {
    const series = () => [{ reason: 'the first one' }]
    expect(awaitingReason({ [K2]: free }, {}, CRITERIA, series)).toBe(K2)
  })

  test('C5 a draft for something that is not a criterion is ignored', () => {
    expect(awaitingReason({ city: 'KL' }, {}, CRITERIA, none)).toBeNull()
  })

  // C6's "locks once recorded" test is REMOVED with `entryLocked` (Round A
  // Phase 2.3): the vanilla lock it misread is the awaiting-reason lock, which
  // testbed-scoring.test.tsx asserts in both directions.

  test('C7 anchors and history are DISCLOSURE: toggling returns a new set', () => {
    const a = new Set<string>()
    const b = toggle(a, 'k1')
    expect(b.has('k1')).toBe(true)
    expect(a.has('k1'), 'the original set was mutated, so this is state not disclosure')
      .toBe(false)
    expect(toggle(b, 'k1').has('k1')).toBe(false)
  })

  test('C8 measurability is a SECOND route, not a field on the score', () => {
    expect(SCORE_ROUTE('t-1')).toBe('/api/test-beds/t-1/scores')
    expect(MEASURABILITY_ROUTE('t-1')).toBe('/api/test-beds/t-1/measurability')
    expect(SCORE_ROUTE('t-1')).not.toBe(MEASURABILITY_ROUTE('t-1'))
  })

  // C9's `summarise` test is REMOVED with the helper (Round A Phase 2.2): it
  // asserted `series[0]` is the newest, which is false of the payload series
  // the server appends to. The one reducer is asserted against the server's own
  // entries in testbed-scoring.test.tsx.
})

describe('S: the unit resource and the tab map', () => {
  test('S1 the counts are PAYLOAD keys and the units are a SEPARATE resource', () => {
    for (const key of Object.keys(COUNT_KEY_TO_UNIT_TYPE)) {
      expect(TB_COUNT_KEYS, `${key} is not declared a payload count`).toContain(key)
    }
    expect(UNITS_ROUTE('t-1')).toBe('/api/test-beds/t-1/units')
  })

  test('S3 derive is its own route and is not the units read', () => {
    expect(DERIVE_ROUTE('t-1')).toBe('/api/test-beds/t-1/units/derive')
    expect(DERIVE_ROUTE('t-1')).not.toBe(UNITS_ROUTE('t-1'))
  })

  test('S7 the tab-to-type map is DERIVED from the counts, not written twice', () => {
    for (const [tab, type] of Object.entries(UNIT_TYPE_FOR_TAB_KEY)) {
      expect(COUNT_KEY_TO_UNIT_TYPE[tab], `tab ${tab} has no count`).toBe(type)
    }
    expect(Object.keys(UNIT_TYPE_FOR_TAB_KEY))
      .toHaveLength(Object.keys(COUNT_KEY_TO_UNIT_TYPE).length)
  })

  test('S7 a pane is per unit TYPE, so it filters the flat list', () => {
    const units = [{ id: 'a', type: 'HEMIR' }, { id: 'b', type: 'SafeSight' }]
    expect(unitsForTab('hemirSensors', units).map((u) => u.id)).toEqual(['a'])
    expect(unitsForTab('nonsense', units)).toEqual([])
  })
})

describe('C2: a score is a DRAFT until recorded', () => {
  const [a, b] = (SCORING_JSON.criteria as Criterion[]).map((c) => c.criterion_key)

  test('a recorded score CLEARS its draft and its reason; the other draft stays for a retry', () => {
    const s = clearRecorded({ drafts: { [a]: '2', [b]: '1' }, reasons: { [a]: 'x', [b]: 'y' } }, [a])
    expect(s.drafts).not.toHaveProperty(a)
    expect(s.reasons).not.toHaveProperty(a)
    expect(s.drafts[b], 'recording one criterion dropped another criterion draft').toBe('1')
    expect(s.reasons[b]).toBe('y')
  })

  test('clearing a draft drops its reason, so an abandoned reason is never sent later', () => {
    const s = applyDraft({ drafts: { [a]: '1' }, reasons: { [a]: 'why' } }, a, '', null)
    expect(s.drafts).not.toHaveProperty(a)
    expect(s.reasons).not.toHaveProperty(a)
  })

  test('the HANDLER refuses a draft while ANOTHER criterion awaits its reason, and takes the awaiting one', () => {
    expect(applyDraft(NO_DRAFTS, b, '3', a), 'a draft was taken past the lock').toBe(NO_DRAFTS)
    expect(applyDraft(NO_DRAFTS, a, '3', a).drafts[a]).toBe('3')
  })

  test('the draft state is not mutated in place', () => {
    const before = { drafts: {}, reasons: {} }
    applyDraft(before, a, '2', null)
    expect(before.drafts).toEqual({})
  })
})
