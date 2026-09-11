// ── THE DOOR READS THE RECORD ───────────────────────────────────────────
//
// Round 8 Phase 1. Ruled by John: the door reads `owner_id` against the
// session, not a CSS class - so the Round 7 failure mode, a door that looks
// shut and is open because a swap retired the class's writer, cannot recur.
//
// `is-not-mine` SURVIVES as presentation. What this asserts is that the door
// no longer depends on it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { notMine, canEditRecord, createViewOwners } from '../../src/lib/ownership.js'

const ROOT = new URL('../../', import.meta.url)

test('notMine needs ALL THREE: an owner, a viewer, and a difference', () => {
  assert.equal(notMine('a', 'b'), true)
  assert.equal(notMine('a', 'a'), false, 'the owner was locked out of their own record')
})

test('an absent id on either side is NOT not-mine, and that fails OPEN here', () => {
  // With nobody signed in, or a record with no owner, the question cannot be
  // answered - and answering "yes" would lock a record nobody owns. RLS is the
  // boundary; this stops work that will be refused.
  assert.equal(notMine(null, 'b'), false)
  assert.equal(notMine('a', null), false)
  assert.equal(notMine(undefined, undefined), false)
  assert.equal(notMine('', 'b'), false)
})

test('canEditRecord is the door s answer, and it is notMine inverted', () => {
  assert.equal(canEditRecord('a', 'a'), true)
  assert.equal(canEditRecord('a', 'b'), false)
  assert.equal(canEditRecord(null, 'b'), true, 'an unowned record refused every edit')
})

// ── THE PROPERTY THE RULING IS ABOUT ────────────────────────────────────
test('THE DOOR DOES NOT READ is-not-mine, so no swap can silently reopen it', () => {
  // Round 7's defect: app.js wrote the class inside the Test Bed's load path,
  // the swap retired that path, and the door - reading a class nobody set any
  // more - stayed open on somebody else's record. The banner was right and
  // every row was editable.
  const app = readCode(new URL('frontend/app.js', ROOT), 'js')
  const registry = app.slice(app.indexOf('const CAN_EDIT_BY_VIEW = {'))
  const body = registry.slice(0, registry.indexOf('\n}\n') + 3)

  assert.ok(body.length > 100, 'the registry did not parse, so this is vacuous')
  assert.doesNotMatch(body, /is-not-mine/,
    'CAN_EDIT_BY_VIEW still reads the is-not-mine class, so a swap that '
    + 'retires the class-s writer reopens the door silently')
  assert.doesNotMatch(body, /classList/,
    'the door reads a DOM class rather than the record')
})

test('THE REGISTER OVERWRITES, so a second record cannot answer as the first', () => {
  // The re-navigation defect this estate has measured on three surfaces, at
  // the door. An injection that stopped it overwriting came back SILENT with
  // zero failures, because the register lived in app.js where nothing outside
  // a browser could reach it - which is why it now lives in the module.
  const r = createViewOwners()
  r.set('v', 'alice')
  assert.equal(r.canEdit('v', 'alice'), true)
  r.set('v', 'bob')
  assert.equal(r.canEdit('v', 'alice'), false,
    'the register kept the first record-s owner, so the door answered for the wrong record')
  assert.equal(r.canEdit('v', 'bob'), true)
})

test('a view that has NEVER reported reads as unowned, which fails OPEN', () => {
  const r = createViewOwners()
  assert.equal(r.get('never'), null)
  assert.equal(r.canEdit('never', 'alice'), true)
  // And clearing returns it to that state rather than to the last owner.
  r.set('v', 'bob'); r.clear('v')
  assert.equal(r.canEdit('v', 'alice'), true, 'a cleared view kept its owner')
})

test('and EVERY doored view answers from the record, through one derivation', () => {
  const app = readCode(new URL('frontend/app.js', ROOT), 'js')
  const registry = app.slice(app.indexOf('const CAN_EDIT_BY_VIEW = {'))
  const body = registry.slice(0, registry.indexOf('\n}\n') + 3)
  const entries = [...body.matchAll(/'([\w-]+)':\s*\(\)\s*=>/g)].map((m) => m[1])
  assert.ok(entries.length >= 4, `only ${entries.length} views in the registry`)
  // ONE derivation. A second would be Verification 20 exactly, and the
  // stylesheet-era door had one per view.
  // PER VIEW, not "at least one". An injection replacing the Opportunity-s
  // entry with `() => true` came back silent against the weaker form.
  // A5, 2026-09-11: contact-detail JOINS the doored set. It was open by ruling
  // and John superseded that ruling for the Lead view; the supersession is
  // recorded in frontend/app.js with the old reasoning struck in place.
  const DOORED = ['test-bed-detail', 'opportunity-detail', 'contact-detail']
  for (const v of DOORED) {
    const m = body.match(new RegExp(`'${v}':\\s*\\(\\)\\s*=>\\s*([^,\\n]+)`))
    assert.ok(m, `${v} has no entry in the registry`)
    assert.match(m[1], /ownedByMe/,
      `${v} does not answer through the shared derivation: ${m[1]}`)
  }
  // And the open ones are open BY RULING, stated so the asymmetry is visible.
  //
  // ACCOUNT-DETAIL ONLY, since A5. Widening A5 to Account on the strength of a
  // sentence the two once shared is the inference this estate keeps being
  // caught by, so Account keeps its ruling and keeps this assertion.
  for (const v of ['account-detail']) {
    const m = body.match(new RegExp(`'${v}':\\s*\\(\\)\\s*=>\\s*([^,\\n]+)`))
    assert.ok(m && /true/.test(m[1]), `${v} is no longer open by ruling`)
  }
})

test('the class SURVIVES as presentation, and the stylesheet still uses it', () => {
  // The ruling removes the door-s dependence, not the treatment. Dimming alone
  // was measured insufficient once: everything looked grey and every control
  // still accepted input.
  const css = readCode(new URL('frontend/style.css', ROOT), 'css')
  assert.match(css, /\.is-not-mine input/, 'the read-only treatment is gone')
  assert.match(css, /pointer-events:\s*none/, 'the treatment dims without disabling')
})

test('ONE definition: the React tree reads the same module the shell does', () => {
  // Verification 20. Two readers of one value always drift, and the door is
  // where a drift is a security-shaped defect.
  const viewLoad = readFileSync(new URL('frontend-react/src/testbed/viewLoad.ts', ROOT), 'utf8')
  assert.match(viewLoad, /from '\.\.\/\.\.\/\.\.\/src\/lib\/ownership\.js'/,
    'the React tree defines its own notMine instead of reading the shared one')
  // THE PUBLICATION, not the import. Asserted on the import path first, and an
  // injection that deleted both `window.` assignments came back SILENT with
  // zero failures because the import line still matched - Verification 17, a
  // probe that fires and measures the wrong thing. app.js is a classic script:
  // an import nothing publishes is invisible to it.
  const html = readFileSync(new URL('frontend/index.html', ROOT), 'utf8')
  assert.match(html, /window\.canEditRecord\s*=/,
    'the shell does not publish the derivation, so app.js cannot read it')
  assert.match(html, /window\.createViewOwners\s*=/,
    'the shell does not publish the register factory, so the door has no record')
})
