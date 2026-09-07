// ── THE CONTACT SURFACE'S COUPLING LEDGER, BOTH WAYS ────────────────────
//
// Round 6 Phase 2. Verification 50: a seam census runs in BOTH directions, and
// the direction nobody looks at is what the NEW code reaches back for.
//
// Every entry is DISPOSED of: removed, refused, or kept with the reason
// written down. A file appearing here that is not in the ledger fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)
const SURFACE = 'contact-detail.js'

const walk = (dir) => readdirSync(new URL(dir + '/', ROOT), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`)
    : /\.(js|mjs|ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []))

// ── DIRECTION A: WHAT READS THE VANILLA ─────────────────────────────────
const LEDGER = {
  'scripts/tests/class-rules.test.mjs':
    'KEPT, AND IT IS THE RETIREMENT PRECONDITION. STATE_CLASSES exempts '
    + '.field-editing and the scan reads every .js in frontend/, loaded or not. '
    + 'Phase 0 sized the retirement by sandbox deletion and this is the ONE test '
    + 'that fails: that failure is the instruction to drop the entry, not a defect.',
  'scripts/tests/live-form.test.mjs':
    'KEPT, AND IT IS THE SWAP\'S OWN DETECTOR. It asserts the vanilla tag is '
    + 'absent from the live markup and present in the raw, which is what makes '
    + 'the one-line revert both possible and visible to the gate.',
  'scripts/round6/census-contact.mjs':
    'KEPT. The census\'s SECOND instrument parses the CD_* constants as evidence '
    + 'ABOUT the file rather than as a dependency on it. Retires with the file.',
  'scripts/round6/enumerate-retirement.mjs':
    'KEPT. Its default target, so Round 7 can size the retirement by sandbox '
    + 'deletion without being told the path.',
  'scripts/tests/contact-coupling.test.mjs':
    'THIS FILE. It names the surface because it is the ledger.',
}

test('the instrument can see a coupling at all', () => {
  // Verification 12: a scan that returns nothing looks exactly like a scan
  // that found nothing.
  const found = walk('scripts').filter((f) => {
    try { return readCode(new URL(f, ROOT)).includes(SURFACE) } catch { return false }
  })
  assert.ok(found.length > 0,
    'the scan found nothing at all, which means it did not run rather than that '
    + 'nothing is coupled')
})

test('the ledger accounts for every file that reads the vanilla Contact view', () => {
  const found = []
  for (const f of [...walk('scripts'), ...walk('frontend'), ...walk('src'),
    ...walk('frontend-react/src')]) {
    if (f === 'frontend/' + SURFACE) continue
    let code
    try { code = readCode(new URL(f, ROOT)) } catch { continue }
    if (code.includes(SURFACE)) found.push(f)
  }
  const unledgered = found.filter((f) => !(f in LEDGER))
  assert.deepEqual(unledgered, [],
    `these read frontend/${SURFACE} and are not in the ledger: ${unledgered.join(', ')}`)
})

// ── DIRECTION B: WHAT THE REACT SURFACE REACHES BACK FOR ────────────────
//
// The direction a one-way census cannot see. Verification 50's own instance
// was a form reaching into version state; here it is the shell.
const DECLARED_SEAM = [
  'api', 'currentUserEmail', 'detailLoaded', 'navigate',
  'setContactReturnView', 'staleWriteHtml',
]

test('the React Contact surface reaches for exactly the seam names it declares', () => {
  let used = new Set()
  for (const f of walk('frontend-react/src/contact')) {
    for (const m of readCode(new URL(f, ROOT)).matchAll(/\bshell\.([a-zA-Z]+)/g)) used.add(m[1])
  }
  assert.ok(used.size > 0, 'the scan found no seam call at all, so it did not run')
  assert.deepEqual([...used].sort(), [...DECLARED_SEAM].sort(),
    'the Contact surface reaches for a seam name it does not declare, or has '
    + 'stopped using one it does')
})

test('and it reads window DIRECTLY nowhere', () => {
  // shell-services is the only module allowed to touch window. A component
  // that reaches for it has re-created the coupling the seam exists to
  // contain, and there is no second place to look when the shell changes.
  for (const f of walk('frontend-react/src/contact')) {
    const code = readCode(new URL(f, ROOT))
    assert.ok(!/\bwindow\./.test(code), `${f} reads window directly, bypassing the seam`)
  }
})

test('and it does NOT read the vanilla module\'s lexical state, by name', () => {
  // Every one of these is `let` or `const` at the top level of a classic
  // script. Migration Round 2's rule: a bundle cannot read them, so a
  // reference to one is a mistake rather than a coupling to carry.
  const LEXICAL = ['cdContactId', 'cdContact', 'cdPayload', 'cdLoadedRevision',
    'cdReturnView', 'cdEdits', 'cdWired', 'cdCurrentBlocking', 'CD_ALL_FIELDS',
    'CD_COLUMN_FIELDS', 'CD_CONTACT_FIELDS', 'CD_ADDRESS_FIELDS', 'cdLinkInFlight',
    'cdNoteOpen', 'cdParkDirty', 'industriesCache']
  for (const f of walk('frontend-react/src/contact')) {
    const code = readCode(new URL(f, ROOT))
    for (const name of LEXICAL) {
      assert.ok(!new RegExp(`\\b${name}\\b`).test(code),
        `${f} names ${name}, which is lexical in a classic script and unreachable`)
    }
  }
})

// ── THE STRINGS LEDGER ──────────────────────────────────────────────────
//
// Verification 41: a pattern cannot tell a path being READ from a claim inside
// a data structure or a comment. Both are recorded, because only one of them
// can be re-pointed and the other has to be corrected by hand.
const STRINGS = {
  'frontend/app.js': 'PROSE. Comments describing the shared discard modal and the Park popup.',
  'frontend/index.html': 'PROSE, and it is the RESTORE INSTRUCTION - the commented tag itself.',
  'frontend/style.css': 'PROSE. A comment naming the file that owns a rule.',
  'frontend/test-bed-detail.js': 'PROSE. A comment comparing its own pattern to Contact\'s.',
  'src/routes/accounts.js': 'PROSE. A comment about where linking happens.',
  'src/routes/contacts.js': 'PROSE. Comments about which writes belong to which route.',
  'src/lib/stage-gate-fields.js': 'PROSE. The module comment naming the copy it replaced.',
  'frontend-react/src/contact/ContactHost.tsx': 'PROSE. Comments recording what the vanilla did and why this differs.',
  'frontend-react/src/shell-services.ts': 'PROSE. The C1 seam comment naming where cdReturnView lived.',
  'frontend-react/src/__tests__/contact-surface.test.tsx': 'PROSE. The derivation note.',
  'frontend-react/src/__tests__/contact-blocking.test.ts': 'PROSE. The derivation note.',
}

test('every STRING mention of the surface has a disposition', () => {
  const found = []
  for (const f of [...walk('scripts'), ...walk('frontend'), ...walk('src'),
    ...walk('frontend-react/src')]) {
    if (f === 'frontend/' + SURFACE) continue
    let raw
    try { raw = readFileSync(new URL(f, ROOT), 'utf8') } catch { continue }
    if (!raw.includes(SURFACE)) continue
    let stripped = ''
    try { stripped = readCode(new URL(f, ROOT)) } catch { stripped = raw }
    if (!stripped.includes(SURFACE)) found.push(f)
  }
  const unledgered = found.filter((f) => !(f in STRINGS))
  assert.deepEqual(unledgered, [],
    `these mention ${SURFACE} in prose and have no disposition: ${unledgered.join(', ')}`)
})
