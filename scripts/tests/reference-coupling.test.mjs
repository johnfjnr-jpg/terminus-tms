// ── ROUND 5 PHASE 2: THE REFERENCE TAB'S COUPLING LEDGER ────────────────
//
// BOTH WAYS, per Verification 41 as extended. The rule is not "the frontend
// callers were updated": the ENUMERATION is the instrument, and it covers
// probes, tests and scripts as well as screens, and STRINGS as well as
// asserted code - because a claim living in a data structure has the failure
// mode of a comment and the authority of code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)
const SURFACE = 'opportunity-reference.js'

const walk = (dir, out = []) => {
  for (const e of readdirSync(new URL(dir + '/', ROOT))) {
    const rel = dir + '/' + e
    if (statSync(new URL(rel, ROOT)).isDirectory()) {
      if (e === 'node_modules' || e === 'dist' || e === '.verify') continue
      walk(rel, out)
    } else if (/\.(mjs|js|ts|tsx)$/.test(e)) out.push(rel)
  }
  return out
}

// ── DIRECTION A: WHAT STILL READS THE VANILLA FILE ──────────────────────
//
// Every entry is DISPOSED of: removed, refused, or kept with the reason
// written down. A file appearing here that is not in the ledger fails.
const LEDGER = {
  'scripts/tests/opportunity-dates.test.mjs':
    'KEPT. Source-shape: it asserts the vanilla\'s date handling, which is still '
    + 'the live behaviour until this file retires. Re-points at the React '
    + 'descriptors when it does.',
  'scripts/tests/opportunity-headline.test.mjs':
    'KEPT. Source-shape and stylesheet: it reads the vanilla for the headline '
    + 'rename and asserts .is-not-mine CSS rules that still cover the vanilla '
    + 'markup, which stays in tree hidden.',
  'scripts/tests/reference-coupling.test.mjs':
    'THIS FILE. It names the surface because it is the ledger.',
  'scripts/tests/live-form.test.mjs':
    'KEPT, AND IT IS THE SWAP\'S OWN DETECTOR. It asserts the vanilla tag is '
    + 'absent from the live markup and present in the raw, which is what makes '
    + 'the one-line revert both possible and visible to the gate.',
  'scripts/round5/field-census.mjs':
    'KEPT. Phase 0 instrument: it parses the vanilla constants as the census\'s '
    + 'SECOND instrument. Evidence about the file, not a dependency on it.',
  'scripts/round5/seam-census.mjs':
    'KEPT. Phase 0 instrument: the boundary census reads the file by path.',
  'frontend/test-bed-detail.js':
    'KEPT, AND IT IS PROSE THAT LOOKS LIKE CODE. The mention is inside an HTML '
    + 'comment embedded in a JS template literal, so readCode - which strips JS '
    + 'comments - cannot see it. That is the stripper being right rather than '
    + 'wrong: <!-- --> inside a template literal is not a JS comment, and '
    + 'teaching it otherwise would risk eating real code (Verification 39\'s '
    + 'second half). Ledgered rather than filtered.',
}

test('the ledger accounts for every file that reads the vanilla Reference', () => {
  const found = []
  for (const f of [...walk('scripts'), ...walk('frontend'), ...walk('src'),
    ...walk('frontend-react/src')]) {
    if (f === 'frontend/' + SURFACE) continue
    let code
    try { code = readCode(new URL(f, ROOT)) } catch { continue }
    if (code.includes(SURFACE)) found.push(f)
  }
  // CALIBRATED: the scan must be able to see a file it knows reads the surface.
  assert.ok(found.length > 0,
    'the scan found nothing at all, which means it did not run rather than that '
    + 'nothing is coupled')
  const unledgered = found.filter((f) => !(f in LEDGER))
  assert.deepEqual(unledgered, [],
    `these read frontend/${SURFACE} and are not in the ledger: ${unledgered.join(', ')}`)
})

// ── DIRECTION B: WHAT THE REACT SURFACE READS FROM THE SHELL ────────────
//
// Verification 50: a seam census runs BOTH ways, and the direction nobody
// looks at is what the new code reaches back for.
test('the React Reference surface reaches for exactly the shell names it declares', () => {
  const files = walk('frontend-react/src/reference')
  assert.ok(files.length >= 4, `expected the reference module, found ${files.length} files`)
  const reached = new Set()
  for (const f of files) {
    for (const m of readCode(new URL(f, ROOT)).matchAll(/window\.([A-Za-z_$][\w$]*)/g)) {
      reached.add(m[1])
    }
  }
  // oppPatch is the shared write path (its 409 retry and revision handshake);
  // loadOpportunityDetail is how the surface asks the shell to re-render.
  // Everything else goes through the ShellServices seam, never through window.
  assert.deepEqual([...reached].sort(), ['loadOpportunityDetail', 'oppPatch'],
    'the React Reference surface reaches for a shell global it has not declared')
})

test('and it does NOT read the vanilla module\'s lexical state', () => {
  // refEdits, refPayload, ALL_EDITABLE_FIELDS and the rest are module-scope
  // `let`/`const` in a classic script: a bundle cannot read them at all, so a
  // reference to one is a mistake that would fail only at runtime.
  const src = walk('frontend-react/src/reference')
    .map((f) => readCode(new URL(f, ROOT))).join('\n')
  for (const name of ['refEdits', 'refPayload', 'refAccount', 'refOppDetails',
    'ALL_EDITABLE_FIELDS', 'kcRoles', 'kcStances', 'terminusStaffCache']) {
    assert.ok(!src.includes(name),
      `the React surface names ${name}, which is lexical in a classic script and `
      + 'unreachable from a bundle')
  }
})

// ── VERIFICATION 41'S STRINGS CLAUSE ────────────────────────────────────
//
// "Grep the name as a STRING, not only as an import or a path, and give each
// hit a disposition." The ENUMERATION is the instrument, so this is a ledger
// rather than a pattern: a mechanical rule cannot tell a path being read from
// a claim inside a data structure, which is the whole reason Round 2's
// STATE_CLASSES entry survived every scan that looked for callers.
const STRING_LEDGER = {
  'scripts/tests/live-form.test.mjs':
    'KEPT. The script tag itself, asserted absent from the live markup. It IS '
    + 'the detector for this swap being undone.',
  'scripts/tests/opportunity-headline.test.mjs':
    'KEPT. Three reads of the vanilla file by path, for the headline rename. '
    + 'Retires with the file.',
  'scripts/round5/field-census.mjs':
    'KEPT. Phase 0 instrument: it parses the vanilla constants as the census\'s '
    + 'second instrument. Evidence, not a coupling.',
  'scripts/round5/seam-census.mjs':
    'KEPT. Phase 0 instrument: the boundary census reads the file by path.',
  'scripts/tests/opportunity-dates.test.mjs':
    'KEPT. It reads the vanilla file by path for its date handling. Retires '
    + 'with the file.',
  'scripts/round5/inbound-and-coupled.mjs':
    'KEPT. Phase 0 instrument: the name IS its subject, so it appears as data '
    + 'by design. This is the one entry that looks like the fault it screens '
    + 'for, and the difference is that nothing reasons FROM it.',
}

test('every STRING mention of the surface has a disposition', () => {
  const hits = new Map()
  for (const f of [...walk('scripts'), ...walk('frontend-react/src'), ...walk('src')]) {
    if (f === 'scripts/tests/reference-coupling.test.mjs') continue
    const code = readCode(new URL(f, ROOT))
    for (const m of code.matchAll(/['\"`][^'\"`]*opportunity-reference[^'\"`]*['\"`]/g)) {
      if (!hits.has(f)) hits.set(f, [])
      hits.get(f).push(m[0].slice(0, 60))
    }
  }
  // CALIBRATED: a scan that finds nothing has not run.
  assert.ok(hits.size > 0,
    'the string scan found no mention at all, which means it did not run')
  const unledgered = [...hits.keys()].filter((f) => !(f in STRING_LEDGER)).sort()
  assert.deepEqual(unledgered, [],
    `these name the surface in a string with no disposition: ${unledgered.join(', ')}`)
})
