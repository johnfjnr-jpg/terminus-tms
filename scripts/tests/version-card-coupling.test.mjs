import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

// ── WHAT STILL READS THE SUPERSEDED VERSION CARD ─────────────────────────
//
// Round 4 Phase 2 swapped the card: the bundle registers
// `initOpportunityDealVersions`, the vanilla tag is commented in place, and the
// vanilla markup is hidden rather than deleted so the revert stays one line.
//
// THE FILE IS STILL ON DISK, AND THAT IS THE HAZARD - the same one Round 3
// recorded for the deal form, and before that Round 2 for account-detail.js. A
// test that reads it goes on passing while asserting nothing about the card
// anybody uses.
//
// The set is ENUMERATED and can only SHRINK. A new coupling fails here; a
// re-pointed one has to come off the list.
const DIR = new URL('./', import.meta.url)
const VANILLA = 'opportunity-deal-versions.js'

// Reads the name to assert its ABSENCE, or reads the file as a corpus. Both are
// the opposite of a coupling.
const NOT_COUPLINGS = new Set([
  'version-card-coupling.test.mjs',
  'live-form.test.mjs',
])

function coupledBlocks() {
  const out = []
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.test.mjs') || NOT_COUPLINGS.has(f)) continue
    const src = readCode(new URL(f, DIR))
    if (!src.includes(VANILLA)) continue
    const blocks = src.split(/\ntest\(/).slice(1).filter((b) => b.includes(VANILLA))
    if (!blocks.length) { out.push(`${f} :: <module level>`); continue }
    for (const b of blocks) {
      const m = b.match(/^'([^']+)'/) || b.match(/^"([^"]+)"/)
      out.push(`${f} :: ${m ? m[1] : '<unnamed>'}`)
    }
  }
  return out.sort()
}

// The set at the swap. One entry, and it is a MODULE-LEVEL read rather than a
// claim: adopted-identity.test.mjs reads the file to prove the deal FORM's
// adoption list still has a reader. It re-points when that list is regenerated.
const COUPLED = [
  'adopted-identity.test.mjs :: <module level>',
]

test('the instrument can see a coupling at all', () => {
  // Verification 13: the enumeration is evidence only once the scan has been
  // shown reaching a non-empty answer on the real tree.
  assert.ok(coupledBlocks().length > 0,
    'the scan found no coupled block, so the list below measures nothing')
})

test('NO NEW COUPLING to the superseded version card', () => {
  const added = coupledBlocks().filter((b) => !COUPLED.includes(b))
  assert.deepEqual(added, [],
    'these read frontend/opportunity-deal-versions.js, which the browser no longer loads:\n  '
    + added.join('\n  '))
})

test('and the list does not rot: every entry is still a real coupling', () => {
  const now = coupledBlocks()
  const gone = COUPLED.filter((b) => !now.includes(b))
  assert.deepEqual(gone, [],
    'these are re-pointed or renamed and must come off the list:\n  ' + gone.join('\n  '))
})
