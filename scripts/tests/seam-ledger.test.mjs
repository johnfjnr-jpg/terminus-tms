// ── THE SHELL SEAM'S LEDGER ─────────────────────────────────────────────
//
// Round 8 Phase 2. This was `testbed-coupling.test.mjs`, and its Direction A -
// every file that reads frontend/test-bed-detail.js - RETIRED WITH THAT FILE:
// with the vanilla deleted the claim is vacuous, and a ledger that can only
// pass is not a ledger.
//
// DIRECTION B SURVIVES because it is not about that file. Verification 50: a
// seam census runs in both directions, and the direction nobody looks at is
// what the NEW code reaches back for. Every member of the seam is disposed of
// here, and a member added without a reason fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)

// ── DIRECTION B: WHAT THE REACT SURFACE REACHES BACK FOR ────────────────
//
// The direction Verification 50 says nobody looks at. Each of these is a
// C1-pattern seam: the shell owns the answer and a bundle cannot reach it.
const REACHES_BACK = {
  canEditFields: 'the ownership door, read at every edit attempt',
  usesWorkflow: 'whether the pre-workflow approve control may be clicked',
  attemptTransition: 'the stage transition, which stays the shell\'s',
  takeTestBedLanding: 'the stage a transition asks the next load to land on',
  currentUserId: 'the viewer, for the door\'s own comparison',
  setViewOwner: 'the record owner this view loaded, which the door reads. Round 8 '
    + 'Phase 1: whoever loads a record says who owns it, so no swap can retire '
    + 'the writer out from under the door',
  currentUserEmail: 'the note author',
  detailLoaded: 'the view has painted and is not pending',
  navigate: 'opening the Opportunity a conversion created',
  staleWriteHtml: 'the shell\'s one renderer for the 409 sentence',
  confirmDiscard: 'the shared unsaved-changes dialogue',
  requestChangeReason: 'the shared change-reason dialogue',
  getOppLoadedRevision: 'unused by this surface, declared by the seam',
  setContactReturnView: 'unused by this surface, declared by the seam',
  api: 'the shell\'s fetch wrapper, which owns the clock-skew retry',
}

test('every shell service the React tree consumes is in the ledger', () => {
  const svc = readFileSync(new URL('frontend-react/src/shell-services.ts', ROOT), 'utf8')
  const iface = svc.slice(svc.indexOf('export interface ShellServices {'),
    svc.indexOf('\n}\n', svc.indexOf('export interface ShellServices {')))
  const members = [...iface.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9_]*)\s*[(<:]/gm)].map((m) => m[1])

  assert.ok(members.length > 5, `only ${members.length} members parsed, so this is vacuous`)
  const undisposed = members.filter((m) => !(m in REACHES_BACK))
  assert.deepEqual(undisposed, [],
    'the React tree reaches back for these and the ledger does not say why: '
    + undisposed.join(', '))
})

test('and the shell really provides each one', () => {
  const app = readFileSync(new URL('frontend/app.js', ROOT), 'utf8')
  const html = readFileSync(new URL('frontend/index.html', ROOT), 'utf8')
  // Not every member is answered by app.js - some fall through to a default -
  // so this asserts the ones the Test Bed surface would BREAK without.
  const REQUIRED = ['canEditFields', 'detailLoaded', 'navigate', 'takeTestBedLanding']
  const missing = REQUIRED.filter((m) => !app.includes(m) && !html.includes(m))
  assert.deepEqual(missing, [],
    'the shell does not publish these: ' + missing.join(', '))
})
