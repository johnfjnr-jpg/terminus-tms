// ── R4: THE RED TOKEN, AND THE TEN SITES THAT BIND IT ────────────────────
//
// The Opportunity round, 2026-09-20, approved by John. Built on the amber
// pattern the walk 3 round set, for the same reason: a token is only real
// once something fails when a site stops binding it.
//
// THIS FILE ASSERTS THE REQUIREMENTS, NOT THE VALUE. A test asserting
// `--red: #e06c6c` would be a second reader of the stylesheet (Verification
// 20) and would pass on a red that had gone dim. The five requirements were
// written BEFORE any value was measured and are recorded at the token's own
// definition in style.css; they appear here as the numbers they turn into, so
// a later round may retune the red and will be told at once if the retune
// costs it its legibility.
//
// COMMENTS ARE STRIPPED BEFORE MATCHING (Verification 39). style.css now
// carries several paragraphs about this token, including the literal
// `rgba(242,100,100,.9)` it replaced and the hex itself, so a scan reading the
// raw file would be satisfied by the explanation rather than by the
// declaration. The calibration proves that by swapping the reader.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// `readFileSync` is imported and unused on the healthy path ON PURPOSE: the
// calibration swaps `readCode` for it to show the prose satisfying the scan.
// Removing it would disarm that injection.
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CSS_PATH = join(here, '..', '..', 'frontend', 'style.css')
const css = readCode(CSS_PATH)

const hexOf = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  return m ? m[1].toLowerCase() : null
}

// WCAG 2.x relative luminance and contrast, written out rather than imported,
// because the whole point is not to trust a number somebody typed.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (!d) return 0
  const h = mx === r ? 60 * (((g - b) / d) % 6)
    : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
  return (h + 360) % 360
}
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d) }

// ── THE TEN SITES, and the list ASSERTS ITS OWN COMPLETENESS ────────────
//
// Verification 19: a named list fails by SILENT OMISSION, so the count is
// checked against the bindings actually present rather than trusted. Six of
// these carried `rgba(242,100,100,.9)` and reached no token at all; three
// carried `var(--red, #e06c6c)`, duplicating the token's value as a fallback,
// which is what kept them invisible to the palette AND to the invariant that
// checks the palette, because that check deliberately excuses a fallback.
const RED_FAMILY = [
  '.auth-error',
  '.msg-error',
  // `input.input-invalid` REMOVED from the family, hygiene round 2026-09-21:
  // the rule is deleted because nothing applied it. The list asserts its own
  // completeness, so a member that no longer exists would fail this test
  // rather than pass it quietly, which is the list working.
  '.nlg-why',
  '.new-lead-table select[aria-invalid="true"]',
  '.tb-doc-feedback.err',
  '.stat-value--overdue',
]
// `.stat-value--overdue` binds twice, colour and border. The select rule also
// carried a `border-bottom: 1px solid var(--red)` BEFORE this round, which is
// the one site that was already healthy.
//
// WAS 3. `input.input-invalid` bound twice as well and contributed the third;
// its rule was deleted in the hygiene round because nothing applied it.
const EXTRA_BINDINGS = 2

test('R4 1: the red is defined, and once', () => {
  assert.ok(hexOf('red'), 'no --red definition found in style.css')
  const definitions = (css.match(/--red:\s*#[0-9a-fA-F]{6}/g) ?? []).length
  assert.equal(definitions, 1,
    `${definitions} definitions of --red: a second one is a second reader of the same value`)
})

test('R4 2: it lives in the BRAND PALETTE, beside --attention', () => {
  // It was defined 7,000 lines down, in a second `:root` minted when S5 found
  // it used at three sites and defined nowhere. Reachable and invisible.
  const palette = css.indexOf('--attention:')
  const redAt = css.indexOf('--red:')
  assert.ok(palette >= 0 && redAt >= 0, 'one of the two tokens is missing')
  assert.ok(Math.abs(redAt - palette) < 2000,
    'the red has drifted away from the palette block again, so a reader of the '
    + 'palette cannot see it')
})

test('R4 3: error TEXT on the dark ground meets WCAG AA', () => {
  const c = contrast(hexOf('red'), hexOf('dark'))
  assert.ok(c >= 4.5, `error text is ${c.toFixed(2)}:1 on --dark, below AA's 4.5:1`)
})

test('R4 4: an error BORDER meets WCAG 1.4.11 for a non-text indicator', () => {
  const c = contrast(hexOf('red'), hexOf('dark'))
  assert.ok(c >= 3, `an error border is ${c.toFixed(2)}:1, below 1.4.11's 3:1`)
})

test('R4 5: it is no LESS prominent than the literal it replaced', () => {
  // rgba(242,100,100,.9) over --dark composites to #dc5d5e, measured at
  // 4.71:1. The adoption must not cost those six sites contrast.
  const c = contrast(hexOf('red'), hexOf('dark'))
  assert.ok(c >= 4.71,
    `${c.toFixed(2)}:1 is DIMMER than the 4.71:1 of the rgba it replaced, so the `
    + 'six untokenised sites lost prominence rather than gaining it')
})

test('R4 6: it does not close the gap to --attention', () => {
  // Walk 3 derived --attention expressly to sit "nowhere near --red #e06c6c",
  // so that separation is already a decision of record. Red must not re-derive
  // it and must not shrink it. 37 degrees is what that ruling produced.
  const gap = hueGap(hexOf('red'), hexOf('attention'))
  assert.ok(gap >= 36.5,
    `${gap.toFixed(0)} degrees from --attention, closer than the separation `
    + 'walk 3 derived the attention token to have')
})

test('R4 7: and it reads as RED rather than orange or pink', () => {
  const h = hue(hexOf('red'))
  assert.ok(h >= 350 || h <= 10, `hue ${h.toFixed(0)} is outside the red band`)
})

test('R4 8: each of the ten sites binds --red', () => {
  const missing = RED_FAMILY.filter((sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rule = css.match(new RegExp(`${esc}\\s*(,[^{]*)?\\{([^}]*)\\}`))
    return !rule || !/var\(--red\)/.test(rule[2])
  })
  assert.deepEqual(missing, [], `these no longer carry the red: ${missing.join(', ')}`)
})

test('R4 9: and the list is complete, so a new site cannot hide', () => {
  // DERIVED from the list rather than typed, so adding a site to RED_FAMILY
  // moves the expected total with it and forgetting to add one turns this red.
  const bindings = (css.match(/var\(--red\)/g) ?? []).length
  assert.equal(bindings, RED_FAMILY.length + EXTRA_BINDINGS,
    `${bindings} --red bindings against ${RED_FAMILY.length} listed selectors `
    + `+ ${EXTRA_BINDINGS} second declarations`)
})

test('R4 10: no site reaches the red through a literal FALLBACK any more', () => {
  // A `var(--red, #e06c6c)` renders correctly and is invisible to the palette,
  // because the invariant that checks the palette deliberately excuses a
  // fallback. That is exactly how three of these sites stayed unseen.
  const fallbacks = (css.match(/var\(--red,\s*[^)]+\)/g) ?? [])
  assert.deepEqual(fallbacks, [],
    `${fallbacks.length} sites still carry a literal fallback: ${fallbacks.join(', ')}`)
})

test('R4 11: and no RED LITERAL survives outside the definition', () => {
  // The census that found these ten was derived from a SCAN rather than a word
  // list, classifying colour literals by HUE, so a site named danger or err
  // was found too. This is that census as a standing assertion.
  const TOK = /(?<!&)#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g
  const reds = (css.match(TOK) ?? []).filter((t) => {
    const m = /^#([0-9a-fA-F]{6})$/.exec(t)
    if (m) { const h = hue(t.toLowerCase()); return (h >= 350 || h <= 10) && t.toLowerCase() !== '#ffffff' }
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(t)
    if (!rgb) return false
    const [r, g, b] = [+rgb[1], +rgb[2], +rgb[3]]
    if (r === g && g === b) return false
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    const h = hue(hex)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    return (h >= 350 || h <= 10) && (mx - mn) / 255 > 0.25
  })
  assert.equal(reds.length, 1,
    `${reds.length} red literals in the stylesheet, expected only the --red `
    + `definition itself: ${reds.join(', ')}`)
})
