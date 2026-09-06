import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

// ── WHAT STILL READS THE SUPERSEDED FORM ─────────────────────────────────
//
// Round 3 Session F swapped the Commercials panel: `main.tsx` registers
// `initOpportunityDealPanel`, the `opportunity-deal.js` script tag is gone, and
// the vanilla markup is hidden rather than deleted so the revert is one line.
//
// THE FILE IS STILL ON DISK, AND THAT IS THE HAZARD. A test that reads it goes
// on passing while asserting nothing about the screen anybody uses - the exact
// shape Round 2 hit when `account-detail.js` was unloaded and its assertions
// kept reading it. Nothing fails; the claim simply stops being about anything.
//
// So the coupled set is ENUMERATED and can only SHRINK. A new coupling fails
// here; a re-pointed one has to come off the list, which is what stops the list
// rotting into a record of work already done.

const DIR = new URL('./', import.meta.url)
const VANILLA = 'opportunity-deal.js'

// Reads the file as a CORPUS - for its bytes, not for a claim about the screen.
// These are correct and stay: the stripper needs a large real file, and the
// structural walk needs the markup the revert would restore.
const CORPUS_READERS = new Set([
  'strip-comments.test.mjs',
  // This file names the path in its own prose and enumeration, which the scan
  // reads as a coupling. A scan that counts itself reports one finding it
  // created.
  'vanilla-coupling.test.mjs',
  // It names the tag to assert the file is NOT LOADED, which is the opposite
  // of a coupling. Caught here within minutes of being written, which is the
  // ledger doing its job - the exemption is the disposition, not a softening.
  'live-form.test.mjs',
])

function coupledBlocks() {
  const out = []
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.test.mjs') || CORPUS_READERS.has(f)) continue
    const src = readCode(new URL(f, DIR))
    for (const b of src.split(/\ntest\(/).slice(1)) {
      if (!b.includes(VANILLA)) continue
      const m = b.match(/^'([^']+)'/) || b.match(/^"([^"]+)"/)
      out.push(`${f} :: ${m ? m[1] : '<unnamed>'}`)
    }
  }
  return out.sort()
}

// The set as it stands at the swap. Every entry asserts something about the
// Commercials screen by reading the file the browser no longer loads.
const COUPLED = [
  'commercials-wiring.test.mjs :: FINDING 4: the scroll boundary announces itself, and only when there is one',
  'commercials-wiring.test.mjs :: THE HOSTING PERIOD travels with the figure, by one rule on both surfaces',
  'commercials-wiring.test.mjs :: THE SIGNPOST: it appears exactly when the rows it points at do',
  'commercials-wiring.test.mjs :: a margin box is read from the screen, and a blank one is not a zero',
  'commercials-wiring.test.mjs :: both renderings of achieved margin are painted from that one rule',
  'commercials-wiring.test.mjs :: closing cash is rendered through ONE reader, wherever it appears',
  'commercials-wiring.test.mjs :: every surface says the same thing about an unrecorded factoring term',
  'commercials-wiring.test.mjs :: no per-option note mechanism survives the removal',
  'commercials-wiring.test.mjs :: no rate box prefills a value nobody entered',
  'commercials-wiring.test.mjs :: nothing renders GST from a second read of the payload',
  'commercials-wiring.test.mjs :: price to customer is contract net plus GST, and GST has a row',
  'commercials-wiring.test.mjs :: the SHIPPED renderCatalogNotice writes the two spans and paints only the age',
  'commercials-wiring.test.mjs :: the merged panel renders every fact the census listed',
  'commercials-wiring.test.mjs :: the panel is ONE panel: the Result block and the matrix are gone',
  'milestone-schedule.test.mjs :: both grids and the server ask the same evaluator',
  'milestone-schedule.test.mjs :: the milestone list is the one the business gave',
  'milestone-schedule.test.mjs :: the percentage is an input and the dollars are computed from it',
  'opportunity-headline.test.mjs :: the stale-write message is one sentence, on both surfaces, with a control',
  'rate-resolution.test.mjs :: readPayload sends the box, never the catalog figure',
  'rate-resolution.test.mjs :: the server allowlist admits exactly the four, and refuses the six',
  'transition-requests.test.mjs :: V3: a version with no delta is refused, and the excuse wording is gone',
  'transition-requests.test.mjs :: V5: the factoring control is a switch, and states which state it is in',
  'transition-requests.test.mjs :: W-E: gross up takes the factoring treatment, and they are the same control',
  'transition-requests.test.mjs :: W-G: one control, one indicator, and it says which action it offers',
]

test('the instrument can see a coupling at all', () => {
  // Verification 13: a list this scan produced is only evidence once the scan
  // has been shown reaching a non-empty answer on the real tree.
  assert.ok(coupledBlocks().length > 0,
    'the scan found no coupled block, so the enumeration below measures nothing')
})

test('NO NEW COUPLING to the superseded form', () => {
  const now = coupledBlocks()
  const added = now.filter((b) => !COUPLED.includes(b))
  assert.deepEqual(added, [],
    'these read frontend/opportunity-deal.js, which the browser no longer loads:\n  ' + added.join('\n  '))
})

test('and the list does not rot: every entry is still a real coupling', () => {
  const now = coupledBlocks()
  const gone = COUPLED.filter((b) => !now.includes(b))
  assert.deepEqual(gone, [],
    'these are re-pointed or renamed and must come off the list:\n  ' + gone.join('\n  '))
})
