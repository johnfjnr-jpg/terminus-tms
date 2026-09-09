// THE RETIRED VANILLA DEAL FORM IS FROZEN UNTIL IT IS RETIRED.
//
// frontend/index.html carries `#deal-form-vanilla`, a full duplicate of the
// deal form, beside `#deal-form-root` - the empty div React mounts into. The
// duplicate renders nothing. It parses, it serves, and it reads as
// authoritative.
//
// MEASURED, and this test exists because of it: an R2d edit converting the
// eight Structural Terms notes landed in the DEAD copy. The served HTML
// changed exactly as intended - 11 help-dots, 0 static note divs - source
// verification passed, and THE SCREEN DID NOT MOVE. It was caught only by a
// browser sweep disagreeing with the file.
//
// A silent absorption is what this converts into a loud failure. It is a
// TRIPWIRE, not the fix: retiring the duplicate is its own scoped change, and
// when that happens this test is deleted with it.
//
// The hash is over the block's own bytes, so a change ANYWHERE inside it fails,
// whoever makes it and whatever they were aiming at.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const HTML = new URL('../../frontend/index.html', import.meta.url).pathname

// A DIV WALK, NOT A COUNT. CLAUDE.md rule 33: balanced totals are consistent
// with any number of wrong pairings, so the closing tag is found by walking
// depth from the opening one.
export function extractBlock(src, openTag) {
  const start = src.indexOf(openTag)
  if (start === -1) return null
  let i = start + openTag.length
  let depth = 1
  const re = /<div\b[^>]*>|<\/div>/g
  re.lastIndex = i
  let m
  while ((m = re.exec(src))) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return src.slice(start, m.index + m[0].length)
  }
  return null
}

const src = readFileSync(HTML, 'utf8')
const block = extractBlock(src, '<div id="deal-form-vanilla">')

test('the retired vanilla deal form is still present and still inert', () => {
  assert.ok(block, '#deal-form-vanilla was not found. If it has been RETIRED, delete this test with it.')
  assert.ok(block.length > 1000, `#deal-form-vanilla is only ${block.length} bytes; expected the full duplicate`)
})

test('the retired vanilla deal form has not been edited', () => {
  const hash = createHash('sha256').update(block).digest('hex')
  const EXPECTED = process.env.VANILLA_DEAL_FORM_SHA ?? '3fb0d445b7239901e3c7e0633070fc02a89a4b7e7636972e91e522889abb7f21'
  assert.equal(hash, EXPECTED,
    'The retired vanilla deal form changed.\n'
    + '      It renders NOTHING: React mounts into #deal-form-root beside it.\n'
    + '      An edit here will pass source verification and change no screen.\n'
    + `      If this change is deliberate, update the recorded hash to ${hash}.`)
})
