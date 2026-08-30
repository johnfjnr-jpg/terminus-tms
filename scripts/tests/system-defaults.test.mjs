// Defaults are initial values, not fallbacks. Round 41 item 1. PURE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'fs'
import { readCode } from '../lib/strip-comments.mjs'
import {
  DEFAULT_KEYS, initialPayload, validateRecoveryAgainstDuration, recoveryState,
  defaultsForConditionalFields,
  CONDITIONAL_KEYS,
  frozenTerms,
  frozenTermsSentences,
} from '../../src/lib/system-defaults.js'

const ROOT = new URL('../../', import.meta.url).pathname
const D = { targetMargin: 30, warrantyPct: 2, duration: 36, recoveryMonths: 12, factoringTermMonths: 12 }

test('a new deal carries the defaults in its own payload', () => {
  // The whole point of Architecture 11: after this, the numbers are ORDINARY
  // RECORDED FIGURES that a person can see, change or clear. Nothing consults
  // the defaults again.
  const p = initialPayload(D)
  assert.equal(p.targetMargin, 30)
  assert.equal(p.warrantyPct, 2)
  assert.equal(p.duration, 36)
})

test('a field that does not yet apply is ABSENT, not prefilled', () => {
  // recoveryMonths applies only to two-phase. Writing it into every new deal
  // would make its not-recorded path unreachable, which is the state the whole
  // round exists to make sayable.
  assert.ok(!('recoveryMonths' in initialPayload(D)), 'no structure known: recovery must be absent')
  assert.ok(!('recoveryMonths' in initialPayload(D, { structure: 'hybrid' })))
  assert.equal(initialPayload(D, { structure: 'twoPhase' }).recoveryMonths, 12)
})

test('the factoring term is never written at creation, whatever the structure', () => {
  // SUPERSEDED WITHIN THE ROUND, and the superseded version is named because
  // the premise failed rather than a preference changing (Verification 29).
  //
  // This test read "the factoring term is 12 on hybrid and follows recovery on
  // two-phase", asserting that creation wrote the term from the STRUCTURE. That
  // reproduced the old calculator fallback as a default instead of removing it,
  // and it used the wrong governing input: the approved applicability table
  // makes the term conditional on `factoring.enabled`, and a new opportunity
  // has no factoring block at all.
  //
  // So creation writes nothing for it, at any structure, and the transition
  // into enabled writes the admin default. Asserted at all four structures,
  // because "no structure known" alone would pass on a version that still
  // branched on structure.
  for (const structure of [undefined, 'single', 'twoPhase', 'hybrid']) {
    assert.ok(!('factoring' in initialPayload(D, { structure })),
      `creation wrote a factoring term at structure=${structure}`)
  }
  // And the recovery period, whose governing input IS the structure, is
  // unaffected: the two conditional fields must not have been collapsed into
  // one rule by the correction.
  assert.equal(initialPayload(D, { structure: 'twoPhase' }).recoveryMonths, 12)
  assert.ok(!('recoveryMonths' in initialPayload(D, { structure: 'hybrid' })))
})

test('every conditional key is excluded from the creation write', () => {
  // Verification 19: CONDITIONAL_KEYS is a name asserting a property, so the
  // property is measured. A key added to DEFAULT_KEYS and forgotten in
  // CONDITIONAL_KEYS would be silently prefilled onto every deal.
  const all = initialPayload(D)
  for (const key of CONDITIONAL_KEYS) {
    assert.ok(!(key in all), `${key} is listed as conditional and creation still writes it`)
  }
  const unconditional = DEFAULT_KEYS.filter((k) => !CONDITIONAL_KEYS.includes(k))
  assert.deepEqual(Object.keys(all).sort(), unconditional.sort(),
    'creation writes exactly the unconditional keys, no more and no fewer')
})

test('an unconfigured key produces an absent field, not a stand-in', () => {
  // An empty table yields a deal with nothing prefilled, which is legible.
  // A hardcoded stand-in would be the fallback this design removes.
  assert.deepEqual(initialPayload({}), {})
  const partial = initialPayload({ targetMargin: 25 })
  assert.deepEqual(Object.keys(partial), ['targetMargin'])
})

test('recovery period must not exceed the contract duration', () => {
  assert.equal(validateRecoveryAgainstDuration({ recoveryMonths: 12, duration: 36 }), null)
  assert.equal(validateRecoveryAgainstDuration({ recoveryMonths: 36, duration: 36 }), null, 'equal is allowed')
  assert.match(validateRecoveryAgainstDuration({ recoveryMonths: 48, duration: 36 }), /48 months and the contract runs for 36/)
  // Absence is not a violation: it is reported by the not-recorded path and
  // blocked at the version, which is a different control.
  assert.equal(validateRecoveryAgainstDuration({ duration: 36 }), null)
  assert.equal(validateRecoveryAgainstDuration({ recoveryMonths: 12 }), null)
})

test('the recovery state table, every row', () => {
  const s = (recoveryMonths, structure = 'twoPhase') => recoveryState({ structure, recoveryMonths })
  assert.equal(s(undefined).state, 'empty')
  assert.equal(s(undefined).blocksVersion, true)
  assert.equal(s(null).state, 'empty')
  assert.equal(s('').state, 'empty')

  assert.equal(s(0).state, 'zero')
  assert.equal(s(0).blocksVersion, true)

  assert.equal(s(1).state, 'short')
  assert.equal(s(11).state, 'short')
  assert.equal(s(11).blocksVersion, false, 'short warns and is allowed')
  assert.equal(s(11).needsAcknowledgement, true)

  assert.equal(s(12).state, 'normal')
  assert.equal(s(36).state, 'normal')
  assert.equal(s(12).message, null)

  // Hybrid is in the table too, per the business's state table.
  assert.equal(s(undefined, 'hybrid').state, 'empty')
  // Single has no recovery period of its own: the term IS the duration.
  assert.equal(s(undefined, 'single').state, 'not applicable')
  assert.equal(s(undefined, 'single').blocksVersion, false)
})

test('the short warning names the EXPOSURE, not the number', () => {
  // The business's wording decision: short recovery is good for us and hard on
  // the customer, and the risk is deliverability rather than arithmetic. A
  // message saying "recovery period is under 12 months" tells a salesperson
  // something they can already see.
  const m = recoveryState({ structure: 'twoPhase', recoveryMonths: 6 }).message
  assert.match(m, /large upfront invoice/)
  assert.match(m, /refuse the payment profile/)
  assert.match(m, /priced as though they accepted it/)
  assert.ok(!/under 12|less than 12/.test(m), 'the threshold is not the point')
})

test('the defaults are read only at SANCTIONED call sites, named here', () => {
  // THE PROPERTY THE WHOLE DESIGN RESTS ON, amended once and deliberately.
  //
  // It began as "read only at creation". That was right for unconditional
  // fields and impossible for conditional ones: recoveryMonths applies only to
  // two-phase and structure is not known at creation, absent on 502 of 562
  // opportunities, so the field could never receive an initial value and every
  // two-phase deal would reach the screen blank. Finding 1 surviving the round
  // that exists to close it.
  //
  // AMENDED, NOT WIDENED. The substance is unchanged: an initial value is
  // written when a field COMES INTO EXISTENCE, and for a conditional field that
  // is when its governing input selects it. So the sanctioned sites are the two
  // creation paths plus the conditional-field transition, NAMED.
  //
  // AMENDED A SECOND TIME, AND THE SECOND CLASS IS NOT A WRITE AT ALL. The
  // version freeze reads the defaults to RECORD WHICH ONE WAS IN FORCE, and
  // applies nothing. Without it, an admin changing a default silently rewrites
  // the provenance of every version already taken: a frozen 12 becomes an
  // override, or a typed 24 starts reading as the default.
  //
  // The two classes are listed separately below rather than merged into one
  // allowlist, because the property they satisfy is different and a merged list
  // would let a genuine fallback in under the wrong justification.
  //
  // The danger the original property guarded is unchanged: a read from a render
  // or a recompute would turn this back into a fallback and nothing else in the
  // suite would notice, because the numbers would look right.
  const callers = []
  const walk = (dir) => {
    for (const f of readdirSync(ROOT + dir, { withFileTypes: true })) {
      if (f.isDirectory()) { walk(dir + f.name + '/'); continue }
      if (!f.name.endsWith('.js')) continue
      const text = readCode(ROOT + dir + f.name)
      const code = text.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
      if (/readSystemDefaults\s*\(/.test(code)) callers.push(dir + f.name)
    }
  }
  walk('src/')
  callers.sort()
  // CLASS 1: sites that WRITE an initial value into a record.
  const WRITES_AN_INITIAL_VALUE = [
    'src/routes/contacts.js',       // creation path A: qualify a contact
    'src/routes/opportunities.js',  // the conditional-field transition, PATCH
    'src/routes/test-beds.js',      // creation path B: convert a test bed
  ]
  // CLASS 2: sites that RECORD which default was in force, and apply nothing.
  const RECORDS_THE_DEFAULT_IN_FORCE = [
    'src/routes/deal-sheet-versions.js',  // the version freeze
  ]
  assert.deepEqual(callers, [
    'src/lib/system-defaults.js',   // where it is defined
    ...[...WRITES_AN_INITIAL_VALUE, ...RECORDS_THE_DEFAULT_IN_FORCE].sort(),
  ].sort(), 'readSystemDefaults is called somewhere new. Adding a site is an amendment to '
   + 'the property recorded in system-defaults.js, naming which of the two classes it '
   + 'belongs to, not a convenience.')

  // The recording site applies nothing, which is what makes it a different
  // class rather than a fourth write. Asserted on the route.
  const ver = readCode(ROOT + 'src/routes/deal-sheet-versions.js')
  assert.match(ver, /terms: frozenTerms\(inputs, await readSystemDefaults\(db\)\)/,
    'the version freeze must pass the defaults to frozenTerms and nowhere else')
  assert.equal((ver.match(/readSystemDefaults\(/g) || []).length, 1,
    'exactly one call: a second one in this route would be a fallback wearing the freeze')

  // The transition site is a SAVE path, so its narrowness is what keeps it an
  // initial value. Asserted on the route rather than trusted.
  const opp = readCode(ROOT + 'src/routes/opportunities.js')
  assert.match(opp, /if \('structure' in payload \|\| 'factoring' in payload\) \{/,
    'the transition read must be gated on a governing input being sent at all')
  assert.match(opp, /defaultsForConditionalFields\(before, \{ \.\.\.before, \.\.\.payload \}/)

  // BOTH creation paths, not one. A deal's starting state must not depend on
  // how it was made.
  for (const f of ['src/routes/contacts.js', 'src/routes/test-beds.js']) {
    const text = readCode(ROOT + f)
    assert.match(text, /const defaults = initialPayload\(await readSystemDefaults\(db\)\)/, `${f} does not read defaults`)
    assert.match(text, /\.\.\.defaults,/, `${f} does not write them into the first revision`)
  }
})

test('a conditional field gets its initial value on its own governing transition', () => {
  const D2 = { recoveryMonths: 12, factoringTermMonths: 24 }
  const on = (before, after) => defaultsForConditionalFields(before, { ...before, ...after }, D2)

  // The transition into two-phase is when the field starts to exist.
  assert.equal(on({}, { structure: 'twoPhase' }).recoveryMonths, 12)
  assert.equal(on({ structure: 'hybrid' }, { structure: 'twoPhase' }).recoveryMonths, 12)

  // NOT on a save that leaves the structure alone. This is what keeps it an
  // initial value: a cleared recovery period stays cleared.
  assert.deepEqual(on({ structure: 'twoPhase' }, { targetMargin: 25 }), {})
  assert.deepEqual(on({ structure: 'twoPhase', recoveryMonths: null }, { targetMargin: 25 }), {},
    'a cleared field must not be refilled by an unrelated save')

  // NOT over a value somebody already set.
  assert.ok(!('recoveryMonths' in on({ recoveryMonths: 6 }, { structure: 'twoPhase' })))

  // NOT on a structure the field does not apply to.
  assert.ok(!('recoveryMonths' in on({}, { structure: 'hybrid' })))
  assert.ok(!('recoveryMonths' in on({}, { structure: 'single' })))

  // ── AND THE FACTORING TERM'S GOVERNING INPUT IS A DIFFERENT ONE ─────────
  //
  // Verification 24: the two defaults are 12 and 24 above, deliberately unequal,
  // so an assertion cannot pass by reading the wrong key.
  //
  // NOT the structure. The first version of this function keyed the term off
  // structure too, which wrote the term of a facility nobody had switched on.
  assert.ok(!('factoring' in on({}, { structure: 'hybrid' })),
    'a structure change must not write the term of a facility that is off')
  assert.ok(!('factoring' in on({}, { structure: 'twoPhase' })))

  // The transition into enabled is when the field starts to exist.
  assert.equal(on({}, { factoring: { enabled: true } }).factoring?.termMonths, 24)
  assert.equal(on({ factoring: { enabled: false } }, { factoring: { enabled: true } }).factoring?.termMonths, 24)
  assert.deepEqual(on({ factoring: { enabled: true } }, { factoring: { enabled: true, ratePct: 2 } }), {},
    'a save that leaves factoring on writes nothing')

  // The rest of the factoring block survives the write, or switching factoring
  // on would drop the rate and the method the same save carried.
  const kept = on({}, { factoring: { enabled: true, ratePct: 2, method: 'declining' } }).factoring
  assert.deepEqual(kept, { enabled: true, ratePct: 2, method: 'declining', termMonths: 24 })

  // NOT over a value somebody already set, and NOT on the way off.
  assert.ok(!('factoring' in on({}, { factoring: { enabled: true, termMonths: 3 } })))
  assert.deepEqual(on({ factoring: { enabled: true, termMonths: 6 } }, { factoring: { enabled: false, termMonths: 6 } }), {},
    'switching factoring off writes nothing, and must not clear the term somebody entered')
})

test('THE CONSEQUENCE: switching away and back re-applies the default', () => {
  // Stated rather than discovered. The field genuinely left the deal and
  // returned, so it is coming into existence again. Somebody who clears it and
  // toggles the structure twice gets 12 back, and that is the honest reading of
  // "when the field starts to exist" rather than an oversight.
  //
  // This test exists so the behaviour is a recorded decision. If it is ever
  // considered wrong, the fix is to record that the field was cleared, and this
  // test is where that change announces itself.
  const D2 = { recoveryMonths: 12, factoringTermMonths: 12 }
  let p = { structure: 'twoPhase', recoveryMonths: 12 }
  p = { ...p, recoveryMonths: null }                                    // cleared
  assert.deepEqual(defaultsForConditionalFields(p, { ...p, targetMargin: 1 }, D2), {}, 'stays cleared')
  const away = { ...p, structure: 'hybrid' }
  const back = defaultsForConditionalFields(away, { ...away, structure: 'twoPhase' }, D2)
  assert.equal(back.recoveryMonths, 12, 'and returns on the way back, by design')
})

test('a version freezes the term AND the default it was measured against', () => {
  // Round 41. The value is already in the version's inputs; what cannot be
  // recovered later is which default was in force, because an admin changing it
  // would silently rewrite the provenance of every version already taken.
  const D3 = { duration: 36, recoveryMonths: 12 }

  const dflt = frozenTerms({ duration: 36, recoveryMonths: 12 }, D3)
  assert.deepEqual(dflt.duration, { value: 36, default: 36, source: 'default' })
  assert.deepEqual(dflt.recoveryMonths, { value: 12, default: 12, source: 'default' })

  const over = frozenTerms({ duration: 48, recoveryMonths: 6 }, D3)
  assert.deepEqual(over.duration, { value: 48, default: 36, source: 'override' })
  assert.deepEqual(over.recoveryMonths, { value: 6, default: 12, source: 'override' })

  // Absent is its own state, not an override of nothing and not a zero.
  const none = frozenTerms({}, D3)
  assert.deepEqual(none.recoveryMonths, { value: null, default: 12, source: 'absent' })
  assert.deepEqual(frozenTerms({ recoveryMonths: '' }, D3).recoveryMonths.source, 'absent')
  assert.deepEqual(frozenTerms({ recoveryMonths: null }, D3).recoveryMonths.source, 'absent')

  // A term entered before any default was configured is an override with
  // nothing to compare against, and says so rather than reading as a default.
  assert.deepEqual(frozenTerms({ duration: 36 }, {}).duration, { value: 36, default: null, source: 'override' })

  // THE FREEZE IS OF THE MOMENT. The same deal against a moved default reads
  // differently, which is the whole reason the default is stored beside the
  // value rather than looked up later.
  assert.equal(frozenTerms({ duration: 36 }, { duration: 24 }).duration.source, 'override')
  assert.equal(frozenTerms({ duration: 36 }, { duration: 36 }).duration.source, 'default')
})

test('the frozen terms have a reader, and it says which is which', () => {
  // Verification 22: a field required of every version and read by nothing
  // teaches everybody that the content does not matter.
  const s = (frozen) => Object.fromEntries(frozenTermsSentences(frozen).map((x) => [x.key, x.sentence]))

  const d = s(frozenTerms({ duration: 36, recoveryMonths: 12 }, { duration: 36, recoveryMonths: 12 }))
  assert.match(d.duration, /36 months, the system default in force when this version was taken/)

  const o = s(frozenTerms({ duration: 48, recoveryMonths: 6 }, { duration: 36, recoveryMonths: 12 }))
  assert.match(o.duration, /48 months, entered on the deal in place of the system default of 36/)
  assert.match(o.recoveryMonths, /6 months, entered on the deal in place of the system default of 12/)

  const a = s(frozenTerms({ duration: 36 }, { duration: 36, recoveryMonths: 12 }))
  assert.match(a.recoveryMonths, /Recovery period was not recorded when this version was taken/)

  const n = s(frozenTerms({ duration: 36 }, {}))
  assert.match(n.duration, /No system default was configured at the time/)

  // One month is one month, not "1 months".
  assert.match(s(frozenTerms({ recoveryMonths: 1 }, { recoveryMonths: 12 })).recoveryMonths, /1 month,/)

  // Nothing frozen yields nothing, rather than a sentence about a freeze that
  // did not happen.
  assert.deepEqual(frozenTermsSentences(null), [])
})

test('the migration carries its own ledger row', () => {
  // Architecture 10. One paste, two statements.
  const files = readdirSync(ROOT + 'supabase/migrations').filter((f) => f.includes('system_defaults'))
  assert.equal(files.length, 1)
  const sql = readCode(ROOT + 'supabase/migrations/' + files[0])
  assert.match(sql, /insert into supabase_migrations\.schema_migrations \(version\)/)
  assert.match(sql, /on conflict \(version\) do nothing/)
  // Idempotent per Architecture 7.
  assert.match(sql, /create table if not exists/)
  assert.match(sql, /on conflict \(key\) do nothing/)
})
