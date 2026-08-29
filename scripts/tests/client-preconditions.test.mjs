// Every browser write that carries a payload states the revision it read.
// Round 38. Runs under `npm test` - source inspection, no browser, no database.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS IS A SOURCE SCAN
// ─────────────────────────────────────────────────────────────
//
// The server-side twin of this scan asserts that every appendRecordRevision
// call passes a precondition. It cannot see whether a REAL one arrives, because
// a route with no client sending expected_revision passes CLIENT_UNWIRED and
// satisfies it perfectly. That escape is what this round removed, and nothing
// in the suite could tell whether it stayed removed.
//
// A runtime test cannot cover it either. Every Test Bed and every Account in
// this system belongs to an owner the test account is not, so those routes
// answer 403 before reaching the write, and the browser paths that call them
// are unreachable from `npm run test:db` entirely.
//
// So the guarantee is made where the calls are: a PATCH that sends a payload
// must say which revision that payload was read at. A call that sends no
// payload is exempt, because it writes a column on `records` rather than a
// revision, and PATCH /accounts/:id with only parent_account_id is exactly
// that case.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const FRONTEND = 'frontend'

// The endpoints whose PATCH appends a record revision. /installer is
// deliberately absent: it updates a column on `records` and writes no revision.
const WRITES_A_REVISION = /`\/api\/(?:accounts|contacts|opportunities|test-beds)\/\$\{[^}]*\}(?:\/units\/\$\{[^}]*\})?`/

function files() {
  return readdirSync(join(ROOT, FRONTEND))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(FRONTEND, f))
}

/**
 * The argument text of a call, from its opening paren to the matching close.
 * Bracket-balanced rather than line-windowed, for the same reason the
 * server-side scan counts arguments: a comment or a nested literal must not
 * end the call early.
 */
function callText(text, openParenIndex) {
  let depth = 0
  for (let i = openParenIndex; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return text.slice(openParenIndex, i + 1)
    }
  }
  return text.slice(openParenIndex)
}

/**
 * A call that sends a payload, or spreads an object that may contain one, is
 * writing a revision and must state which one it expects.
 */
function sendsAPayload(argText) {
  return /payload|\.\.\./.test(argText)
}

function scan() {
  const offenders = []
  let checked = 0
  for (const file of files()) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    const CALL = /\bapi\('PATCH',\s*/g
    let m
    while ((m = CALL.exec(text)) !== null) {
      const open = text.lastIndexOf('(', m.index + 4)
      const args = callText(text, open)
      if (!WRITES_A_REVISION.test(args)) continue
      if (!sendsAPayload(args)) continue
      checked++
      if (!/expected_revision/.test(args)) {
        offenders.push(`${file}:${text.slice(0, m.index).split('\n').length}`)
      }
    }
  }
  return { offenders, checked }
}

test('every browser PATCH that sends a payload states the revision it read', () => {
  const { offenders, checked } = scan()
  assert.ok(checked > 0, 'the scan found no payload-writing PATCH calls, so it is measuring nothing')
  assert.deepEqual(offenders, [],
    'these writes can land on a record that moved since the screen read it:\n  ' + offenders.join('\n  '))
})

test('the scan can SEE a call that omits it, and does NOT flag a column-only write', () => {
  // Calibration in both directions. The negative case is the one that matters:
  // a scan that flagged every PATCH would be turned off within a round.
  const withIt = "api('PATCH', `/api/contacts/${id}`, { payload: { notes }, expected_revision: rev })"
  const without = "api('PATCH', `/api/contacts/${id}`, { payload: { notes } })"
  const columnOnly = "api('PATCH', `/api/accounts/${id}`, { parent_account_id: parentId })"
  const otherEndpoint = "api('PATCH', `/api/test-beds/${id}/installer`, { installer_account_id: a })"

  const argsOf = (src) => callText(src, src.indexOf('('))
  assert.equal(WRITES_A_REVISION.test(argsOf(withIt)) && sendsAPayload(argsOf(withIt))
    && /expected_revision/.test(argsOf(withIt)), true, 'a stated call must pass')
  assert.equal(WRITES_A_REVISION.test(argsOf(without)) && sendsAPayload(argsOf(without))
    && /expected_revision/.test(argsOf(without)), false, 'an unstated call must fail')
  assert.equal(sendsAPayload(argsOf(columnOnly)), false,
    'a column-only PATCH writes no revision and must not be flagged')
  assert.equal(WRITES_A_REVISION.test(argsOf(otherEndpoint)), false,
    '/installer writes a column on records, not a revision')
})

test('the two wrappers that PATCH on behalf of a caller supply it themselves', () => {
  // tbPatch and addContactNote are the only indirection between a control and
  // the write. The scan above reads their bodies like any other call site, so
  // this asserts the ONE property the scan cannot: that a caller reaching the
  // network through them cannot end up without a precondition.
  const tb = readFileSync(join(ROOT, 'frontend/test-bed-detail.js'), 'utf8')
  const app = readFileSync(join(ROOT, 'frontend/app.js'), 'utf8')
  const tbPatch = tb.slice(tb.indexOf('async function tbPatch('))
  const addNote = app.slice(app.indexOf('async function addContactNote('))
  assert.match(tbPatch.slice(0, 500), /expected_revision: tbLoadedRevision/)
  assert.match(tbPatch.slice(0, 700), /tbLoadedRevision = result\.data\.revision_number/,
    'a wrapper that sends a revision and never refreshes it would 409 on its own second write')
  assert.match(addNote.slice(0, 700), /expected_revision/)
})
