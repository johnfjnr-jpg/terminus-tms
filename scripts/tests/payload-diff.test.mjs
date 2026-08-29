// Dirty-by-comparison. Round 38, before the Phase 2 reshape.
// Runs under `npm test` - pure functions, no database, no DOM.
//
// These lock the two properties the event-inferred flag could not have:
// a control that does not change the payload cannot make it dirty, and a
// representation difference is not a change.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedKeys, payloadsDiffer, valuesDiffer } from '../../src/lib/payload-diff.js'

test('an unchanged form is not dirty', () => {
  const p = { ssExisting: 10, installResp: 'Client Own Installation Team', marginOverrides: { hwSs: 40 } }
  assert.deepEqual(changedKeys(p, { ...p }), [])
  assert.equal(payloadsDiffer(p, { ...p }), false)
})

test('a real edit is dirty, and names the key', () => {
  assert.deepEqual(changedKeys({ ssExisting: 11 }, { ssExisting: 10 }), ['ssExisting'])
  assert.deepEqual(changedKeys({ installResp: 'Terminus Contractor - Lump Sum' }, { installResp: 'Client Own Installation Team' }), ['installResp'])
})

// ─────────────────────────────────────────────────────────────
// Not-set is one state, or the form is dirty the moment it loads
// ─────────────────────────────────────────────────────────────

test('absent, null and empty string are one state', () => {
  for (const a of [undefined, null, '']) {
    for (const b of [undefined, null, '']) {
      assert.equal(valuesDiffer('duration', a, b), false,
        `${JSON.stringify(a)} vs ${JSON.stringify(b)} must not be a change`)
      assert.equal(valuesDiffer('customerLead', a, b), false,
        'the same must hold for a non-numeric key')
    }
  }
})

test('a record that never held a key is not dirty against a blank box', () => {
  // The load case. The record has no duration; the form renders a blank box,
  // which readPayload sends as null. If these differed, every Opportunity would
  // open dirty and taking a version would write a revision nobody asked for.
  assert.deepEqual(changedKeys({ duration: null, ssExisting: 4 }, { ssExisting: 4 }), [])
})

test('but a real zero IS a change from not-set', () => {
  // The discriminating half. If empties and zero were conflated, this would
  // pass silently and the whole distinction would be gone.
  assert.deepEqual(changedKeys({ targetMargin: 0 }, { targetMargin: null }), ['targetMargin'])
  assert.deepEqual(changedKeys({ targetMargin: null }, { targetMargin: 0 }), ['targetMargin'])
})

// ─────────────────────────────────────────────────────────────
// Representation is not change
// ─────────────────────────────────────────────────────────────

test('a stored numeric string equals the number the form produces', () => {
  // 159 such values are in record_revisions and no backfill was run, so this is
  // what stops every one of those records opening dirty.
  assert.deepEqual(changedKeys({ duration: 36 }, { duration: '36' }), [])
  assert.deepEqual(changedKeys({ targetMargin: 12.75 }, { targetMargin: '12.75' }), [])
})

test('object key order is not a change', () => {
  const a = { marginOverrides: { hwSs: 40, hwAqm: 20 } }
  const b = { marginOverrides: { hwAqm: 20, hwSs: 40 } }
  assert.deepEqual(changedKeys(a, b), [])
})

test('a nested change IS a change', () => {
  const a = { marginOverrides: { hwSs: 40 } }
  const b = { marginOverrides: { hwSs: 41 } }
  assert.deepEqual(changedKeys(a, b), ['marginOverrides'])
})

test('arrays compare by content and order', () => {
  assert.deepEqual(changedKeys({ milestones: [{ month: 1, usd: 5 }] }, { milestones: [{ month: 1, usd: 5 }] }), [])
  assert.deepEqual(changedKeys({ milestones: [{ month: 1, usd: 5 }] }, { milestones: [{ month: 2, usd: 5 }] }), ['milestones'])
})

// ─────────────────────────────────────────────────────────────
// The property the event-inferred flag could not have
// ─────────────────────────────────────────────────────────────

test('a control that does not change the payload cannot make it dirty', () => {
  // The version reason box is the case that produced the spurious revision. It
  // is not part of the payload at all, so no event it fires can appear here,
  // and it needs no per-control guard. Phase 2 adds controls to this panel and
  // they inherit the same property.
  const before = { ssExisting: 10, targetMargin: null }
  const afterTypingAReason = { ssExisting: 10, targetMargin: null }
  assert.deepEqual(changedKeys(afterTypingAReason, before), [],
    'typing outside the payload must not be a change, whatever events it fires')
})

test('a key dropped by the form counts as a change', () => {
  // The union of both key sets. A form that stopped sending a key it used to
  // send is a change, not an invisible no-op.
  assert.deepEqual(changedKeys({}, { installResp: 'Client Own Installation Team' }), ['installResp'])
})

test('changedKeys is sorted and complete', () => {
  const got = changedKeys({ ssNew: 1, aqm: 2, installResp: 'x' }, { ssNew: 0, aqm: 0, installResp: 'y' })
  assert.deepEqual(got, ['aqm', 'installResp', 'ssNew'])
})
