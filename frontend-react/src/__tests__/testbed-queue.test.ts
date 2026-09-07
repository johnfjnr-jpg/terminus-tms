// ── Q, U, B, R: THE FOUR LOAD-BEARING BEHAVIOURS ────────────────────────
//
// Derived from MIGRATION_TEST_BED_CAPABILITIES.md's fourth addendum, written
// from the vanilla line by line before any of this existed.
//
// RED FIRST: every test here failed before the modules did.
import { describe, test, expect, vi } from 'vitest'
import { createUnitQueues } from '../testbed/unitQueue'
import { addUseCase, removeUseCase } from '../testbed/useCases'
import { exitTickPayload, isTicked } from '../testbed/exitCriteria'
import { reasonRequired, reasonAccepted } from '../testbed/scoreReason'

describe('Q: the per-row unit write queue', () => {
  const held = (rev: number) => ({ id: 'u-1', revision_number: rev })

  test('Q1 one queue PER ROW, so two rows do not serialise', async () => {
    const order: string[] = []
    const gates: Record<string, () => void> = {}
    const q = createUnitQueues({
      patch: async (unitId) => new Promise((res) => {
        gates[unitId] = () => { order.push(unitId); res({ ok: true, data: held(2) }) }
      }),
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: () => {},
    })
    const a = q.write('u-1', 'lat', '1')
    const b = q.write('u-2', 'lat', '2')
    // YIELD FIRST. The chain starts with Promise.resolve().then(...), so the
    // patch call - and the gate it registers - happens on a microtask. Opening
    // the gates synchronously reached for an undefined that had not been
    // created yet, which reads as the queue being broken and is the probe
    // being early. Verification 6's synchronous-read clause, in miniature.
    await new Promise((r) => setTimeout(r, 0))
    // u-2 resolves first: a per-row queue lets it, a global one would not.
    gates['u-2']!(); gates['u-1']!()
    await Promise.all([a, b])
    expect(order).toEqual(['u-2', 'u-1'])
  })

  test('Q2 two rapid writes to ONE row land IN ORDER, nothing coalesced', async () => {
    const sent: string[] = []
    const q = createUnitQueues({
      patch: async (_u, field, value) => { sent.push(`${field}=${value}`); return { ok: true, data: held(2) } },
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: () => {},
    })
    const a = q.write('u-1', 'lat', '1')
    const b = q.write('u-1', 'lat', '2')
    await Promise.all([a, b])
    expect(sent, 'a write was dropped or coalesced').toEqual(['lat=1', 'lat=2'])
  })

  test('Q3 THE REVISION IS READ AT EXECUTION, not at enqueue', async () => {
    // The defect this exists for: reading it at event time gives three rapid
    // writes the same number and refuses two.
    const revisions: Array<number | null> = []
    let current = held(1)
    const q = createUnitQueues({
      patch: async (_u, _f, _v, expected) => {
        revisions.push(expected)
        current = held((current.revision_number ?? 0) + 1)
        return { ok: true, data: current }
      },
      unitById: () => current,
      onUnit: (u) => { current = u as typeof current },
      onRowState: () => {},
    })
    const a = q.write('u-1', 'lat', '1')
    const b = q.write('u-1', 'lng', '2')
    const c = q.write('u-1', 'alt', '3')
    await Promise.all([a, b, c])
    expect(revisions, 'every queued write carried the revision from enqueue time')
      .toEqual([1, 2, 3])
  })

  test('Q3 a write racing a revision bump reads the FRESH revision', async () => {
    let current = held(1)
    const seen: Array<number | null> = []
    const q = createUnitQueues({
      patch: async (_u, _f, _v, expected) => { seen.push(expected); return { ok: true, data: current } },
      unitById: () => current,
      onUnit: () => {},
      onRowState: () => {},
    })
    const first = q.write('u-1', 'lat', '1')
    // Something else moves the record while the write is queued.
    current = held(9)
    await first
    await q.write('u-1', 'lng', '2')
    expect(seen[1], 'the second write carried a stale revision').toBe(9)
  })

  test('Q5 failures are keyed BY FIELD and outlive the burst', async () => {
    const states: Array<{ failures: string[] }> = []
    const q = createUnitQueues({
      patch: async (_u, field) => (field === 'lat'
        ? { ok: false, status: 400, data: { error: 'bad latitude' } }
        : { ok: true, data: held(2) }),
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: (_u, s) => { states.push({ failures: [...s.failures.keys()] }) },
    })
    await q.write('u-1', 'lat', 'nonsense')
    await q.write('u-1', 'lng', '2')
    // The SEQUENTIAL case: the longitude drains separately and must not erase
    // the latitude's refusal.
    expect(states.at(-1)!.failures, 'a later success erased an earlier refusal')
      .toEqual(['lat'])
  })

  test('Q5 and a later success on the SAME field clears it', async () => {
    let fail = true
    const states: Array<string[]> = []
    const q = createUnitQueues({
      patch: async () => (fail
        ? { ok: false, status: 400, data: { error: 'bad' } }
        : { ok: true, data: held(2) }),
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: (_u, s) => { states.push([...s.failures.keys()]) },
    })
    await q.write('u-1', 'lat', 'nonsense')
    fail = false
    await q.write('u-1', 'lat', '51.5')
    expect(states.at(-1)).toEqual([])
  })

  test('Q6 the row settles ONCE PER DRAIN, and names the FIRST failure', async () => {
    const messages: string[] = []
    const q = createUnitQueues({
      patch: async (_u, field) => ({ ok: false, status: 400, data: { error: `bad ${field}` } }),
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: (_u, s) => { if (s.pending === 0) messages.push(s.message) },
    })
    await Promise.all([q.write('u-1', 'lat', 'x'), q.write('u-1', 'lng', 'y')])
    expect(messages.at(-1), 'the row named the most recent failure, not the first')
      .toBe('bad lat')
  })

  test('Q7 a THROWN link does not break the chain', async () => {
    let n = 0
    const sent: string[] = []
    const q = createUnitQueues({
      patch: async (_u, field) => {
        n++
        if (n === 1) throw new Error('something else threw')
        sent.push(field)
        return { ok: true, data: held(2) }
      },
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: () => {},
    })
    await q.write('u-1', 'lat', '1')
    await q.write('u-1', 'lng', '2')
    expect(sent, 'a rejected link silently stopped every later write for the row')
      .toEqual(['lng'])
  })

  test('Q8 the row says Saving at enqueue and Saved when everything succeeded', async () => {
    const messages: string[] = []
    const q = createUnitQueues({
      patch: async () => ({ ok: true, data: held(2) }),
      unitById: () => held(1),
      onUnit: () => {},
      onRowState: (_u, s) => messages.push(s.message),
    })
    await q.write('u-1', 'lat', '1')
    expect(messages[0]).toBe('Saving')
    expect(messages.at(-1)).toBe('Saved')
  })

  test('Q4 the local unit is REPLACED by the response', async () => {
    const seen: unknown[] = []
    const q = createUnitQueues({
      patch: async () => ({ ok: true, data: { id: 'u-1', revision_number: 7, lat: '51.5' } }),
      unitById: () => held(1),
      onUnit: (u) => seen.push(u),
      onRowState: () => {},
    })
    await q.write('u-1', 'lat', '51.5')
    expect(seen).toEqual([{ id: 'u-1', revision_number: 7, lat: '51.5' }])
  })
})

describe('U: the use-case whole-list read-modify-write', () => {
  test('U1 add appends and sends the WHOLE array', () => {
    expect(addUseCase(['a'], 'b')).toEqual(['a', 'b'])
    expect(addUseCase(undefined, 'b')).toEqual(['b'])
  })

  test('U1 remove filters by index and sends the whole array', () => {
    expect(removeUseCase(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  test('U1 a blank addition is refused before any write', () => {
    expect(addUseCase(['a'], '   ')).toBeNull()
  })

  test('U3 THE CONCURRENT SHAPE: two adds from one read produce the same list', () => {
    // Both people read ["a"]. Without a precondition the second write silently
    // overwrites the first and one use case is lost; with it the second is
    // REFUSED. This asserts the shape the precondition exists to catch.
    const read = ['a']
    const mine = addUseCase(read, 'mine')
    const theirs = addUseCase(read, 'theirs')
    expect(mine).toEqual(['a', 'mine'])
    expect(theirs).toEqual(['a', 'theirs'])
    expect(mine, 'the two writes are not in conflict, so nothing needs a precondition')
      .not.toEqual(theirs)
  })

  test('U4 remove-by-INDEX is only correct against the list it was rendered from', () => {
    // If the list moved between render and click, the index is no longer the
    // row the person clicked. The precondition catches the record having moved;
    // it does not make the index right. A limit, recorded rather than fixed.
    const rendered = ['a', 'b', 'c']
    const moved = ['x', 'a', 'b', 'c']
    expect(removeUseCase(rendered, 0)).toEqual(['b', 'c'])
    expect(removeUseCase(moved, 0), 'the same click removes a different row')
      .toEqual(['a', 'b', 'c'])
  })
})

describe('B: the exit-criterion tick', () => {
  test('B1 a tick writes an ISO TIMESTAMP, never a boolean', () => {
    const at = '2026-09-07T12:00:00.000Z'
    const p = exitTickPayload('exitFoo', false, at)
    expect(p).toEqual({ exitFoo: at })
    expect(typeof p.exitFoo, 'a boolean was stored, which reads as PRESENT to the gate')
      .toBe('string')
  })

  test('B1 an untick writes null', () => {
    expect(exitTickPayload('exitFoo', true, '2026-09-07T12:00:00.000Z'))
      .toEqual({ exitFoo: null })
  })

  test('B2 WHY: `false` would read as ticked, and null does not', () => {
    // payload_field_required blocks only on undefined, null and '' - so a
    // stored `false` is PRESENT and opens the gate.
    expect(isTicked(false), 'a stored false read as unticked here but as PRESENT to the gate')
      .toBe(true)
    expect(isTicked(null)).toBe(false)
    expect(isTicked(undefined)).toBe(false)
    expect(isTicked('')).toBe(false)
    expect(isTicked('2026-09-07T12:00:00.000Z')).toBe(true)
  })
})

describe('R: the score reason', () => {
  // ── THE FIXTURE MUST CARRY THE THING THE BRANCH DISTINGUISHES ────────
  //
  // First written as {1: required, 3: not}, which a hardcoded `score <= 2`
  // answers identically - so the injection replacing the level lookup with
  // exactly that came back SILENT with zero failures. The fixture could not
  // tell "the level says so" from "the score is low".
  //
  // A HIGH LEVEL THAT REQUIRES A REASON is the real case CLAUDE.md records: a
  // migration set reason_required on a confirmation scale's CONFIRMED level,
  // because the business wants the licence reference written down. That is the
  // level the fixture was missing.
  const LEVELS = [
    { value: 1, label: 'Unknown', reason_required: true },
    { value: 2, label: 'Partial', reason_required: false },
    { value: 3, label: 'Confirmed', reason_required: true },
  ]

  test('R1 the LEVEL says whether a reason is required, not a hardcoded list', () => {
    expect(reasonRequired(1, LEVELS, [])).toBe(true)
    // The pair that separates the rules: a LOW level that needs none, and a
    // HIGH one that does. A score-threshold rule gets both of these wrong.
    expect(reasonRequired(2, LEVELS, []),
      'a low score required a reason its level does not ask for').toBe(false)
    expect(reasonRequired(3, LEVELS, []),
      'a high level that DECLARES reason_required was let through').toBe(true)
  })

  test('R2 and any REVISION requires one, whatever the level says', () => {
    expect(reasonRequired(2, LEVELS, [{ reason: 'first time' }])).toBe(true)
  })

  test('R2 a score with no level and no history requires nothing', () => {
    expect(reasonRequired(99, LEVELS, [])).toBe(false)
  })

  test('R4 A REPEATED REASON IS ACCEPTED, by ruling 2026-09-07', () => {
    // THE CLAIM CHANGED BY RULING AND THE TEST INVERTED WITH IT. Phase 1b
    // asserted the opposite here, having enumerated must-differ as a port on
    // the strength of Round 30 - a ruling made about the Opportunity
    // assessment panel. MEASURED: neither the client nor score-entry.js has
    // ever compared a reason to the one recorded.
    //
    // Round 7 is a migration, so a rule the vanilla does not have is a
    // behaviour change arriving inside a swap. The argument for must-differ is
    // unchanged and queued as an enhancement pending a business ruling; it is
    // not this round's to take.
    const series = [{ reason: 'because the licence lapsed' }]
    const r = reasonAccepted('because the licence lapsed', series)
    expect(r.ok, 'the repeated reason was refused, so must-differ is still live').toBe(true)
    expect(r.error).toBeUndefined()
  })

  test('R4 and the SERIES no longer decides anything about the text', () => {
    // The empty-reason refusal survives because it IS the vanilla's behaviour
    // at both score-entry sites. Nothing else reads the series.
    const series = [{ reason: 'newest' }, { reason: 'older' }]
    expect(reasonAccepted('newest', series).ok).toBe(true)
    expect(reasonAccepted('older', series).ok).toBe(true)
    expect(reasonAccepted('anything else', series).ok).toBe(true)
  })

  test('R4 an EMPTY reason is still refused, series or no series', () => {
    // Verification 14: the acceptance above must not be true by absence. This
    // is the case that proves reasonAccepted can still answer false at all.
    expect(reasonAccepted('   ', [{ reason: 'because the licence lapsed' }]).ok).toBe(false)
    expect(reasonAccepted('', []).ok).toBe(false)
    expect(reasonAccepted('  a real one  ', []).ok).toBe(true)
  })
})