// THE RETIRED VANILLA DUPLICATES ARE FROZEN UNTIL THEY ARE RETIRED.
//
// frontend/index.html carries full duplicates of three surfaces beside the
// empty divs React mounts into:
//
//   #deal-form-vanilla     beside  #deal-form-root
//   #deal-version-vanilla  beside  #deal-version-root
//   #ref-vanilla           beside  #ref-root
//
// They render nothing. They parse, they serve, and they read as authoritative.
//
// MEASURED, and this test exists because of it: an R2d edit converting the
// eight Structural Terms notes landed in #deal-form-vanilla. The served HTML
// changed exactly as intended, source verification passed, and THE SCREEN DID
// NOT MOVE. It was caught only by a browser sweep disagreeing with the file.
// R2b then found the same trap waiting in #ref-vanilla: the Opportunity stat
// strip and its `detail-testbed-cost` cell live there and never render.
//
// ── DISCOVERED, NOT NAMED ────────────────────────────────────────────────
//
// The blocks are found by their `-vanilla` id suffix rather than listed. A
// first draft named #deal-form-vanilla alone; enumerating structurally found
// THREE, and the third would have been missed. This round has now been caught
// three times by rules that name instances instead of describing shapes -
// `.btn-text`, `.help-dot`, and this - so the test discovers them.
//
// A TRIPWIRE, NOT THE FIX. Retiring the duplicates is its own scoped change,
// and when a block goes, its recorded hash goes with it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const HTML = new URL('../../frontend/index.html', import.meta.url).pathname
const src = readFileSync(HTML, 'utf8')

// A DIV WALK, NOT A COUNT. CLAUDE.md rule 33: balanced totals are consistent
// with any number of wrong pairings, so the closing tag is found by walking
// depth from the opening one.
export function extractBlock(text, openTag) {
  const start = text.indexOf(openTag)
  if (start === -1) return null
  let depth = 1
  const re = /<div\b[^>]*>|<\/div>/g
  re.lastIndex = start + openTag.length
  let m
  while ((m = re.exec(text))) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return text.slice(start, m.index + m[0].length)
  }
  return null
}

export const RECORDED = {
  'deal-form-vanilla': '3fb0d445b7239901e3c7e0633070fc02a89a4b7e7636972e91e522889abb7f21',
  'deal-version-vanilla': 'c9f6ec6ef74ed9f6c99fe4b7e1368e51a0435cfb58d9cd4026e0111ff36eb3e7',
  'ref-vanilla': 'fc72d56ef3f510e887bd5fdcbfdd718de8158e79cf1062c33608d934ddc010d9',
}

const found = [...src.matchAll(/id="([a-z-]+-vanilla)"/g)].map((m) => m[1])

test('every retired duplicate in the file is one this test knows about', () => {
  const unknown = found.filter((id) => !(id in RECORDED))
  assert.deepEqual(unknown, [],
    `A new retired duplicate appeared: ${unknown.join(', ')}.\n`
    + '      It renders nothing, and an edit landing in it changes no screen.\n'
    + '      Record its hash here, or retire it.')
})

for (const id of Object.keys(RECORDED)) {
  test(`${id} has not been edited`, () => {
    const block = extractBlock(src, `<div id="${id}">`)
    if (block === null) {
      assert.fail(`#${id} was not found. If it has been RETIRED, delete its entry from RECORDED.`)
    }
    const hash = createHash('sha256').update(block).digest('hex')
    assert.equal(hash, RECORDED[id],
      `The retired duplicate #${id} changed.\n`
      + '      It renders NOTHING: React mounts into the matching -root div beside it.\n'
      + '      An edit here passes source verification and changes no screen.\n'
      + `      If this change is deliberate, update the recorded hash to ${hash}.`)
  })
}
