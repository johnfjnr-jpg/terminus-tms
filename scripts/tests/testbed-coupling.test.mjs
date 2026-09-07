// ── THE TEST BED SURFACE'S COUPLING LEDGER, BOTH WAYS ────────────────────
//
// Round 7 Phase 2e, the swap. Verification 50: a seam census runs in BOTH
// directions, and the direction nobody looks at is what the NEW code reaches
// back for.
//
// Every entry is DISPOSED of: removed, refused, or kept with the reason written
// down. A file appearing here that is not in the ledger fails, in either
// direction.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const SURFACE = 'test-bed-detail.js'

const walk = (dir) => readdirSync(new URL(dir + '/', ROOT), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`)
    : /\.(js|mjs|ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []))

// ── DIRECTION A: WHAT READS THE VANILLA ─────────────────────────────────
const LEDGER = {
  'frontend/app.js':
    'REFUSED. loadTestBedDetail now throws rather than going quiet, per '
    + 'Verification 41: a superseded path that goes on working is worse than one '
    + 'that breaks. Every caller was re-pointed to loadTestBedDetailOrSayWhyNot '
    + 'in this commit. The remaining mentions are the ownership sweep at :6520, '
    + 'the view id, and the dead render half - all retiring with the file at the '
    + 'shell round.',
  'scripts/tests/class-rules.test.mjs':
    'KEPT, AND IT IS THE RETIREMENT PRECONDITION, exactly as it was for '
    + 'contact-detail.js. The scan reads every .js in frontend/, loaded or not, '
    + 'so the entry fails when the file is deleted - and that failure is the '
    + 'instruction to drop the entry, not a defect.',
  'scripts/tests/test-bed-accounting.test.mjs':
    'KEPT, AND IT IS THE SWAP\'S OWN GATE. It parses the vanilla for its top-level '
    + 'names and asserts every one is claimed by an enumerated capability, and it '
    + 'holds BOTH populations - the file\'s 136 names and app.js\'s view names. '
    + 'Evidence ABOUT the file rather than a dependency on it. It is what held the '
    + 'swap back three times. Retires with the file.',
  'scripts/tests/testbed-coupling.test.mjs':
    'THIS FILE. It names the surface because it is the ledger.',
  'scripts/tests/live-form.test.mjs':
    'KEPT, AND IT IS THE SWAP\'S OWN DETECTOR. It asserts the vanilla tag is '
    + 'absent from the live markup and PRESENT in the raw, which is what makes '
    + 'the revert both possible and visible to the gate - and it asserts the '
    + 'door line, the refusal on the superseded path, and the landing accessor '
    + 'beside it, so none of the four can be dropped separately.',
  'scripts/round7/tb-swap-readiness.mjs':
    'KEPT. The view-population report, which reads the vanilla for line counts. '
    + 'Evidence about the file. Retires with it.',
  'scripts/round7/tb-app-surface.mjs':
    'KEPT. The first, REJECTED instrument - a regex classifier that was wrong in '
    + 'both directions and whose two numbers were never reported. Kept as the '
    + 'record of why the enumeration is declared rather than inferred.',
  'scripts/round7/inject-phase-2e.mjs':
    'KEPT. The swap\'s own calibration. It names the tag because one of its '
    + 'fifteen injections RESTORES it, which is how the live-form inversion is '
    + 'shown capable of failing. Retires with the file.',
  'scripts/round7/visual-tb.mjs':
    'KEPT. The three-width comparison, which loads the vanilla in the browser '
    + 'to capture it beside the React surface - which IS the load-order revert '
    + 'at runtime, and is what lets the comparison prove its two captures are '
    + 'of different implementations. Retires with the file.',
  'scripts/round7/tb-view-surface.mjs':
    'KEPT. The declared enumeration itself, and the accounting suite asserts '
    + 'against it. Retires with the file.',
  'scripts/tests/client-preconditions.test.mjs':
    'KEPT, AND IT IS A SECOND RETIREMENT PRECONDITION. It parses the vanilla '
    + 'for its client-side refusals - evidence ABOUT the file. Phase 0 sized the '
    + 'retirement by sandbox deletion and this is one of the four that fails.',
  'scripts/tests/cost-preview.test.mjs':
    'KEPT. It reads the vanilla\'s TB_COST_INPUT_KEYS against the route\'s body '
    + 'schema, which is the one-contract-one-caller check the preview depends on. '
    + 'It moves to the React descriptor list when the file retires.',
  'scripts/tests/opportunity-headline.test.mjs':
    'KEPT. It asserts the "Terminus Lead" label in the vanilla, from the rename '
    + 'round. Retires with the file; the React descriptors carry the label now.',
  'scripts/tests/contact-coupling.test.mjs':
    'PROSE ONLY, and disposed of in ITS ledger already: a comment comparing its '
    + 'own pattern to this surface\'s. Nothing to re-point.',
  'src/routes/contacts.js':
    'PROSE. A comment citing the vanilla\'s scale and values as the reason for '
    + 'carrying them over. Nothing asserted, nothing to re-point - and exactly '
    + 'the shape Verification 41 says to grep for as a STRING.',
  'src/routes/records.js':
    'PROSE. A comment naming the two places a chevron popup is rendered.',
  'src/routes/test-beds.js':
    'PROSE. Two comments citing the vanilla\'s own notes about the cost '
    + 'estimates. The route reads nothing from the file.',
}

test('the walk RUNS: it can see a file it is meant to scan', () => {
  const files = walk('scripts').concat(walk('frontend')).concat(walk('src'))
  assert.ok(files.length > 50, `only ${files.length} files walked`)
  assert.ok(files.includes('frontend/app.js'), 'the walk cannot see app.js')
})

test('every file that reads the vanilla surface is DISPOSED of', () => {
  const files = walk('scripts').concat(walk('frontend')).concat(walk('src'))
    .concat(walk('frontend-react/src'))
  const readers = files.filter((f) => {
    if (f === `frontend/${SURFACE}`) return false
    if (f.includes('node_modules') || f.includes('/dist/')) return false
    let text
    try { text = readFileSync(new URL(f, ROOT), 'utf8') } catch { return false }
    // The FILENAME, as a string, not only as a path - Verification 41's own
    // correction after a claim inside a data structure went unnoticed.
    return text.includes(SURFACE)
  })
  const undisposed = readers.filter((f) => !(f in LEDGER))
  assert.deepEqual(undisposed, [],
    'these files read the vanilla Test Bed surface and are not in the ledger: '
    + undisposed.join(', '))
})

test('and no ledger entry is DEAD: every disposed file still reads it', () => {
  const dead = []
  for (const f of Object.keys(LEDGER)) {
    let text
    try { text = readFileSync(new URL(f, ROOT), 'utf8') } catch { dead.push(`${f} (missing)`); continue }
    if (!text.includes(SURFACE)) dead.push(f)
  }
  assert.deepEqual(dead, [],
    'these ledger entries no longer read the surface, so the exemption is '
    + 'stale: ' + dead.join(', '))
})

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
