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
// `readFileSync` is imported and not used on the healthy path ON PURPOSE: the
// calibration swaps `readCode` for it to prove that reading this file RAW lets
// style.css's five paragraphs of prose ABOUT the retired token satisfy the scan
// (Verification 39). Removing it would disarm that injection.
import { readFileSync } from 'node:fs'
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

// ── THE V23 CLOSURE: ONE TOKEN OWNS THE FAMILY ──────────────────────────
//
// Ruled by John 2026-09-19. `--amber` was a second amber for the same family,
// at ten sites, failing R5 at 7.74:1. The closure is DELETION rather than an
// alias, because an alias leaves a colour NAME anybody can reach for.
//
// THE COMMENT STRIP IS LOad-BEARING HERE, more than anywhere else in this file:
// style.css carries five paragraphs of prose ABOUT `--amber`, deliberately kept
// as the record of what was retired. A raw scan would read every one of them as
// a live binding and this test could never pass (Verification 39).
const AMBER_FAMILY = [
  '.deal-basis-age.deal-catalog-stale',
  '.deal-basis-age.deal-catalog-undated',
  '.deal-schedule-off',
  '.pulse-stall',
  '.pulse-stall-title',
  '.rejected-banner',
  '.rejected-banner .label',
  '.write-refused',
  '.write-refused .label',
  '.cd-dirty',
  // ── THE THIRD AMBER, ruled 2026-09-19 ───────────────────────────────
  //
  // A hardcoded `rgba(224,130,74,...)` that no token ever reached, on a class
  // whose NAME is this token's own word. Composited over --dark it was 5.18:1,
  // which passes AA for text and fails R5 by a wide margin - so it was the
  // quietest member of the family and the one furthest from the rule.
  '.btn-attention',
  '.btn-attention:hover',
  '.msg-warning',
  // ── THE SHARED ANCHOR POPUP's LEVEL LABEL, R2 option B 2026-09-19 ────
  //
  // ADDED BECAUSE THIS TEST CAUGHT IT. The scoring round gave the shared popup
  // a level label in the attention amber and did not tell the list; the
  // completeness assertion went red on 19 bindings against 18 expected, and
  // the pre-commit hook refused the commit. That is the whole point of a list
  // that asserts its own completeness rather than one that merely enumerates.
  '.anchor-defn-l',
  // ── DEAL SHEET C1, 2026-09-22: THE STATEMENT'S UNDER-TARGET MARGIN ─────
  //
  // Two sites, and they are one decision said twice: the achieved margin
  // reads amber below target and green at or above, on the sticky strip and
  // on the RESULT line. John's option C mockup declares its own `--amber` and
  // its value is #EDB45A, which is this token - so nothing was minted, the
  // mockup had simply arrived at the estate's own amber.
  //
  // THE LIST REFUSED THE COMMIT UNTIL THEY WERE WRITTEN HERE, which is the
  // second time this round a completeness guard has caught an unrecorded
  // addition and the reason to keep writing them this way.
  //
  // The state names are `marginPresentation`'s - `on-target` and
  // `under-target` - not the mockup's `good` and `low`. One vocabulary for
  // one decision, and the calibrated owner of the comparison keeps it.
  '.stmt-v.under-target',
  '.stmt-margin-final.under-target',
  // C2: the modified-unsaved bar. The estate's one amber, for the estate's
  // one meaning - something needs attention - on a bar that exists only while
  // a change is unwritten.
  '.stmt-unsaved',
  '.stmt-unsaved-text',
  // ── R-EV2, 2026-09-24: A DRAWER BOX HOLDING A STORED OVERRIDE ──────────
  //
  // ADDED BECAUSE THIS TEST CAUGHT IT, for the third time in three rounds.
  // The effective-values round gave the statement's editors an override
  // treatment and did not tell the list; this went red at 24 bindings against
  // 23 expected and the hook refused the commit.
  //
  // The estate's one amber for the estate's one meaning: a figure somebody
  // chose, sitting among figures the calculator chose. The weight carries the
  // same meaning beside it, because the ruling is explicit that colour must
  // not be the only signal.
  '.stmt-edit-override',
]

// Most listed selectors carry ONE `var(--attention)`. `.btn-attention` carries
// THREE - a border, a colour and the glow's `color-mix`, which contains a
// `var(--attention)` of its own - so it contributes two beyond the one the list
// already counts for it. Derived from what the rule is for rather than read off
// the total: the button states itself three ways.
const EXTRA_BINDINGS = 2

test('R-V7 8: NO site binds --amber any more, and the token is gone', () => {
  const hits = [...css.matchAll(/var\(\s*--amber[^)]*\)/g)].map((m) => m[0])
  assert.deepEqual(hits, [], `still binding the retired token: ${hits.join(', ')}`)
  assert.doesNotMatch(css, /--amber\s*:/, '--amber is still DEFINED, so it can be reached for again')
})

// THE LIST ASSERTS ITS OWN COMPLETENESS (Verification 19): a named list fails
// by silent omission, so the count is checked against the bindings actually
// present rather than trusted. If somebody adds an eleventh attention site and
// not this row, the next test goes red rather than quietly covering nine.
test('R-V7 9: each of the ten retired sites now binds --attention', () => {
  const missing = AMBER_FAMILY.filter((sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rule = css.match(new RegExp(`${esc}\\s*(,[^{]*)?\\{([^}]*)\\}`))
    return !rule || !/var\(--attention\)/.test(rule[2])
  })
  assert.deepEqual(missing, [], `these no longer carry the attention treatment: ${missing.join(', ')}`)
})

test('R-V7 10: and the list is complete, so a new site cannot hide', () => {
  // Derived from the lists rather than typed, so adding a site to AMBER_FAMILY
  // moves the expected total with it and forgetting to add one turns this red.
  const bindings = (css.match(/var\(--attention\)/g) ?? []).length
  assert.equal(bindings, AMBER_FAMILY.length + EXTRA_BINDINGS + 3,
    `${bindings} --attention bindings against ${AMBER_FAMILY.length} listed sites `
    + `+ ${EXTRA_BINDINGS} second declarations + 3 from the unsaved cost treatment`)
})

// ── THE ALPHA SITES NEED THEIR OWN CHECK, and this is the half a `var()`
// count cannot see.
//
// Two of the third amber's declarations are TRANSLUCENT on purpose - a 40% glow
// and an 8% hover wash - so they cannot be a bare `var(--attention)` without
// losing what they are for. They derive from the token with `color-mix` instead,
// which keeps ONE source of truth: an `--attention-rgb` companion would be a
// second reader of the same value and would drift the first time either moved
// (Verification 20).
test('R-V7 11: the translucent sites DERIVE from the token, not from a literal', () => {
  for (const sel of ['.btn-attention', '.btn-attention:hover']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rule = css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`))
    assert.ok(rule, `${sel} has no rule`)
  }
  const mixes = (css.match(/color-mix\(in srgb, var\(--attention\)/g) ?? []).length
  assert.equal(mixes, 2,
    `expected the glow and the hover wash to derive from the token, found ${mixes}`)
})

// AND NO LITERAL OF THE RETIRED COLOUR SURVIVES ANYWHERE. A site can drift back
// to the hardcoded rgba without ever naming a token, which every test above is
// blind to.
test('R-V7 12: the hardcoded third amber is gone from the stylesheet', () => {
  const hits = [...css.matchAll(/rgba\(\s*224\s*,\s*130\s*,\s*74[^)]*\)/g)].map((m) => m[0])
  assert.deepEqual(hits, [], `the retired literal is still in the code: ${hits.join(', ')}`)
})
