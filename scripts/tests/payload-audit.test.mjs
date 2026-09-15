// ── R3: THE PAYLOAD DIFF THAT FEEDS THE AUDIT LOG ────────────────────────
//
// Notes and audit are two concerns. The route diffs what it actually holds
// against the patch and writes the structured change; these are the rules that
// diff has to follow, stated as claims rather than as a restatement of the
// implementation (Verification 47).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { auditChanges, hasAuditableChange, NOT_AUDITED, FIELDS_CHANGED }
  from '../../src/lib/payload-audit.js'

describe('auditChanges', () => {
  test('records only what CHANGED, not the whole patch', () => {
    // The Test Bed's batch save sends every key the surface owns, changed or
    // not. Logging the patch would record nine changes for a one-field save.
    const c = auditChanges({ city: 'KL', country: 'MY' }, { city: 'Jakarta', country: 'MY' })
    assert.deepEqual(Object.keys(c), ['city'])
    assert.deepEqual(c.city, { from: 'KL', to: 'Jakarta' })
  })

  test('a save that changes nothing is not auditable', () => {
    const c = auditChanges({ city: 'KL' }, { city: 'KL' })
    assert.equal(hasAuditableChange(c), false)
    assert.equal(hasAuditableChange(auditChanges({}, {})), false)
  })

  test('a number and its own text are the SAME value', () => {
    // A payload holds 4 where a form sends "4". Strict comparison would log a
    // change on every save of an untouched numeric field, for ever.
    assert.equal(hasAuditableChange(auditChanges({ n: 4 }, { n: '4' })), false)
    assert.equal(hasAuditableChange(auditChanges({ n: 4 }, { n: '5' })), true)
  })

  test('absence is recorded ONE way, whatever shape it arrived in', () => {
    // undefined, null and '' all mean "not recorded" on the screen, so the
    // audit must agree with the screen rather than expose three spellings.
    for (const empty of [undefined, null, '']) {
      const c = auditChanges({ x: empty }, { x: 'set' })
      assert.equal(c.x.from, null, `from ${JSON.stringify(empty)} did not normalise`)
    }
    const cleared = auditChanges({ x: 'was' }, { x: '' })
    assert.equal(cleared.x.to, null)
  })

  test('absent to absent is NOT a change', () => {
    // Otherwise every save of an untouched empty field writes an audit row
    // saying nothing happened.
    assert.equal(hasAuditableChange(auditChanges({ x: null }, { x: '' })), false)
    assert.equal(hasAuditableChange(auditChanges({}, { x: '' })), false)
  })

  test('NOTES ARE NEVER AUDITED, which is the whole point of the split', () => {
    const c = auditChanges({ notes: [{ text: 'old' }] }, { notes: [{ text: 'new' }, { text: 'old' }] })
    assert.equal(hasAuditableChange(c), false)
    assert.ok(NOT_AUDITED.has('notes'))
  })

  test('but a real change ALONGSIDE a note append still records', () => {
    // The paired positive: "notes are skipped" must not be satisfied by the
    // differ skipping everything (Verification 14).
    const c = auditChanges({ notes: [], city: 'KL' }, { notes: [{ text: 'n' }], city: 'Jakarta' })
    assert.deepEqual(Object.keys(c), ['city'])
  })

  test('objects compare by value, so an equal object is not a change', () => {
    assert.equal(hasAuditableChange(auditChanges({ o: { a: 1 } }, { o: { a: 1 } })), false)
    assert.equal(hasAuditableChange(auditChanges({ o: { a: 1 } }, { o: { a: 2 } })), true)
  })

  test('a key absent from the stored payload is a change TO it, from nothing', () => {
    const c = auditChanges({}, { city: 'Jakarta' })
    assert.deepEqual(c.city, { from: null, to: 'Jakarta' })
  })

  test('the action name is one constant, so both routes agree', () => {
    assert.equal(FIELDS_CHANGED, 'fields_changed')
  })
})
