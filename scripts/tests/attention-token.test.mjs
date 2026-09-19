// ── R-V7: THE ATTENTION TOKEN, AND WHAT IT MUST CLEAR ────────────────────
//
// Walk 3, 2026-09-19. Closes DESIGN_PRINCIPLES.md open item 37.
//
// The value is DERIVED from six requirements, and this file asserts the
// requirements rather than the value - so a later round may retune the amber
// and will be told immediately if the retune costs it its legibility. A test
// asserting `--attention: #EDB45A` would be a second reader of the stylesheet
// (Verification 20) and would pass on a token that had gone dim.
//
// The requirements are written at the token's own definition in style.css and
// repeated here only as the numbers they turn into.
//
// COMMENTS ARE STRIPPED BEFORE MATCHING (Verification 39): style.css records
// every one of these rules in prose beside the rule it is about, so a scan
// reading the raw file would be satisfied by the explanation rather than by
// the declaration.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readCode(join(here, '..', '..', 'frontend', 'style.css'))

const hexOf = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  return m ? m[1].toLowerCase() : null
}

// WCAG 2.x relative luminance and contrast, written out rather than imported,
// because the whole point of the assertion is that it does not trust a value
// somebody typed.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ── THE INSTRUMENT IS SHOWN READING A KNOWN VALUE FIRST ─────────────────
// A contrast function that returned 21 for everything would satisfy every
// assertion below. These two are the estate's own published measurements,
// taken from --green-bright's note in style.css.
test('R-V7 0: the contrast instrument agrees with the estate\'s published numbers', () => {
  assert.equal(Math.round(ratio('#66cc99', '#1A1B23') * 100) / 100, 8.70)
  assert.equal(Math.round(ratio('#82EDB8', '#1A1B23') * 100) / 100, 12.05)
  // and it discriminates: a colour ON its own ground is 1:1.
  assert.equal(Math.round(ratio('#1A1B23', '#1A1B23') * 100) / 100, 1)
})

test('R-V7 1: --attention is defined, so no declaration using it is silently dropped', () => {
  assert.ok(hexOf('attention'), '--attention is not defined in :root')
})

test('R-V7 2: R1, the badge text clears WCAG AA on both grounds', () => {
  const a = hexOf('attention')
  for (const ground of ['#1A1B23', '#15161C']) {
    assert.ok(ratio(a, ground) >= 4.5,
      `--attention ${a} is ${ratio(a, ground).toFixed(2)}:1 on ${ground}, under 4.5:1`)
  }
})

test('R-V7 3: R2, the card border clears WCAG 1.4.11 for a non-text indicator', () => {
  const a = hexOf('attention')
  for (const ground of ['#1A1B23', '#15161C']) {
    assert.ok(ratio(a, ground) >= 3,
      `--attention ${a} is ${ratio(a, ground).toFixed(2)}:1 on ${ground}, under 3:1`)
  }
})

// R5 IS THE REQUIREMENT THAT DECIDED THE VALUE, and it is the one a retune
// would break first: an attention state quieter than the accent it replaced
// makes the marker less visible than the thing it improves on.
test('R-V7 4: R5, it is at least as prominent as the --green it replaced', () => {
  const a = hexOf('attention'), g = hexOf('green')
  assert.ok(ratio(a, '#1A1B23') >= ratio(g, '#1A1B23'),
    `--attention ${a} is ${ratio(a, '#1A1B23').toFixed(2)}:1 against --green ${g} at ${ratio(g, '#1A1B23').toFixed(2)}:1`)
})

test('R-V7 5: R4, it is not the error colour and not near it', () => {
  const a = hexOf('attention'), r = hexOf('red')
  assert.notEqual(a, r)
  // Hue distance, because "not the same hex" is satisfied by a red one shade off.
  const hue = (hex) => {
    const [R, G, B] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
    if (!d) return 0
    const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
    return ((h * 60) % 360 + 360) % 360
  }
  const gap = Math.abs(hue(a) - hue(r))
  assert.ok(Math.min(gap, 360 - gap) >= 25,
    `--attention ${a} and --red ${r} are only ${Math.min(gap, 360 - gap).toFixed(0)} degrees apart`)
})

// ── THE BINDING, WHICH IS WHAT R-V7 ASKED FOR ───────────────────────────
//
// The unsaved cost treatment is the badge AND the card border, and both were
// --green. A test naming only one of them would pass with the other still
// wearing the accent.
test('R-V7 6: the unsaved cost badge binds to --attention, not --green', () => {
  const rule = css.match(/\.tb-cost-unsaved\s*\{([^}]*)\}/)
  assert.ok(rule, '.tb-cost-unsaved has no rule at all')
  assert.match(rule[1], /border:\s*1px solid var\(--attention\)/)
  assert.match(rule[1], /color:\s*var\(--attention\)/)
  assert.doesNotMatch(rule[1], /var\(--green\)/,
    'the unsaved badge still wears the single accent somewhere in its rule')
})

test('R-V7 7: the unsaved cost CARD border binds to --attention, not --green', () => {
  const rule = css.match(/\.tb-cost-card-unsaved\s*\{([^}]*)\}/)
  assert.ok(rule, '.tb-cost-card-unsaved has no rule at all')
  assert.match(rule[1], /border-color:\s*var\(--attention\)/)
  assert.doesNotMatch(rule[1], /var\(--green\)/)
})
