// Defaults are initial values, not fallbacks. Round 41 item 1. PURE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'fs'
import {
  DEFAULT_KEYS, initialPayload, validateRecoveryAgainstDuration, recoveryState,
  defaultsForStructureChange,
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

test('the factoring term is 12 on hybrid and follows recovery on two-phase', () => {
  // Ruling 5, and the two-phase half is what the old hardcoded Math.max(1, recov)
  // intended.
  assert.equal(initialPayload(D, { structure: 'hybrid' }).factoring?.termMonths, 12)
  assert.equal(initialPayload(D, { structure: 'twoPhase' }).factoring?.termMonths, 12)
  assert.equal(initialPayload({ ...D, recoveryMonths: 6 }, { structure: 'twoPhase' }).factoring?.termMonths, 6,
    'two-phase follows the recovery period, not the table')
  assert.ok(!('factoring' in initialPayload(D)), 'no structure known: the term is absent, not guessed')
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
  // creation paths plus the structure transition, NAMED, and a fourth fails
  // this test.
  //
  // The danger the original property guarded is unchanged too: a read from a
  // render or a recompute would turn this back into a fallback and nothing else
  // in the suite would notice, because the numbers would look right.
  const callers = []
  const walk = (dir) => {
    for (const f of readdirSync(ROOT + dir, { withFileTypes: true })) {
      if (f.isDirectory()) { walk(dir + f.name + '/'); continue }
      if (!f.name.endsWith('.js')) continue
      const text = readFileSync(ROOT + dir + f.name, 'utf8')
      const code = text.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
      if (/readSystemDefaults\s*\(/.test(code)) callers.push(dir + f.name)
    }
  }
  walk('src/')
  callers.sort()
  assert.deepEqual(callers, [
    'src/lib/system-defaults.js',   // where it is defined
    'src/routes/contacts.js',       // creation path A: qualify a contact
    'src/routes/opportunities.js',  // the structure transition, PATCH
    'src/routes/test-beds.js',      // creation path B: convert a test bed
  ], 'readSystemDefaults is called somewhere new. Adding a site is an amendment to '
   + 'the property recorded in system-defaults.js, not a convenience.')

  // The transition site is a SAVE path, so its narrowness is what keeps it an
  // initial value. Asserted on the route rather than trusted.
  const opp = readFileSync(ROOT + 'src/routes/opportunities.js', 'utf8')
  assert.match(opp, /if \('structure' in payload\) \{/,
    'the transition read must be gated on structure being sent at all')
  assert.match(opp, /defaultsForStructureChange\(before, \{ \.\.\.before, \.\.\.payload \}/)

  // BOTH creation paths, not one. A deal's starting state must not depend on
  // how it was made.
  for (const f of ['src/routes/contacts.js', 'src/routes/test-beds.js']) {
    const text = readFileSync(ROOT + f, 'utf8')
    assert.match(text, /const defaults = initialPayload\(await readSystemDefaults\(db\)\)/, `${f} does not read defaults`)
    assert.match(text, /\.\.\.defaults,/, `${f} does not write them into the first revision`)
  }
})

test('a conditional field gets its initial value on the structure transition', () => {
  const D2 = { recoveryMonths: 12, factoringTermMonths: 12 }
  const on = (before, after) => defaultsForStructureChange(before, { ...before, ...after }, D2)

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

  // The factoring term follows the same rule and the same split.
  assert.equal(on({}, { structure: 'hybrid' }).factoring?.termMonths, 12)
  assert.equal(on({}, { structure: 'twoPhase' }).factoring?.termMonths, 12, 'two-phase follows recovery')
  assert.equal(on({ recoveryMonths: 6 }, { structure: 'twoPhase' }).factoring?.termMonths, 6)
  assert.ok(!('factoring' in on({ factoring: { termMonths: 3 } }, { structure: 'hybrid' })),
    'a term somebody set is not overwritten')
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
  assert.deepEqual(defaultsForStructureChange(p, { ...p, targetMargin: 1 }, D2), {}, 'stays cleared')
  const away = { ...p, structure: 'hybrid' }
  const back = defaultsForStructureChange(away, { ...away, structure: 'twoPhase' }, D2)
  assert.equal(back.recoveryMonths, 12, 'and returns on the way back, by design')
})

test('the migration carries its own ledger row', () => {
  // Architecture 10. One paste, two statements.
  const files = readdirSync(ROOT + 'supabase/migrations').filter((f) => f.includes('system_defaults'))
  assert.equal(files.length, 1)
  const sql = readFileSync(ROOT + 'supabase/migrations/' + files[0], 'utf8')
  assert.match(sql, /insert into supabase_migrations\.schema_migrations \(version\)/)
  assert.match(sql, /on conflict \(version\) do nothing/)
  // Idempotent per Architecture 7.
  assert.match(sql, /create table if not exists/)
  assert.match(sql, /on conflict \(key\) do nothing/)
})
