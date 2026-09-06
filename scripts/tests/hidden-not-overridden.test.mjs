// ── ROUND 5 PHASE 3 ITEM 3: COMPUTED VISIBILITY, NOT ATTRIBUTE PRESENCE ─
//
// The shape this exists for, found twice in two days:
//
//   .field-row-edit { display: flex }
//
// A bare `display` declaration OVERRIDES the user-agent's
// `[hidden] { display: none }`, so an element the application has correctly
// marked hidden RENDERS. Every test that reads the ATTRIBUTE passes, because
// the attribute is set and correct - the defect is entirely in the cascade.
//
// It cost contract behaviour 3 (display and edit swap by visibility) and
// behaviour 2's second half (a hidden subtree is out of the tab order) at
// once, and it was found by looking at a screenshot rather than by any
// assertion.
//
// THE RULE: any selector the application hides with the `hidden` ATTRIBUTE
// must not be given a `display` by a rule that can win against it. Scoping
// with :not([hidden]) is the fix, and it is load-bearing rather than tidy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'

const css = readCode(new URL('../../frontend/style.css', import.meta.url))

/**
 * Classes this application hides with the `hidden` attribute rather than a
 * class. Each is a real site: the row's edit half, the shared edit bar, and
 * the version card's own action row.
 */
const HIDDEN_BY_ATTRIBUTE = [
  'field-row-edit',
  'field-row-display',
  'field-edit-bar',
  // Shared with the vanilla, which hides it by CLASS. The React Account name
  // header hides it by ATTRIBUTE, and that is the instance this caught.
  'ref-field-edit',
]

test('no rule gives a display to something the app hides with [hidden]', () => {
  const offenders = []
  for (const cls of HIDDEN_BY_ATTRIBUTE) {
    // Every top-level rule whose selector ENDS at this class - a descendant
    // selector like `.x .field-row-edit input` targets a child and is fine.
    const re = new RegExp(`^\\.${cls}((?:(?![,{])[^{])*)\\{([^}]*)\\}`, 'gm')
    for (const [, tail, body] of css.matchAll(re)) {
      if (!/(^|;)\s*display\s*:/.test(body)) continue
      if (/:not\(\[hidden\]\)/.test(tail)) continue
      offenders.push(`.${cls}${tail.trim()} { …display… }`)
    }
  }
  assert.deepEqual(offenders, [],
    'these rules set display on an element the application hides with the '
    + 'hidden ATTRIBUTE, so it renders while every attribute assertion passes: '
    + offenders.join(' | '))
})

test('and the scan can see a violation, or its zero means nothing', () => {
  // Calibration in the direction that matters: a clean result from a scan
  // never shown finding anything is indistinguishable from a broken scan.
  const violating = '.field-row-edit { display: flex; align-items: center; }'
  const re = /^\.field-row-edit((?:(?![,{])[^{])*)\{([^}]*)\}/gm
  const hits = [...violating.matchAll(re)]
  assert.equal(hits.length, 1, 'the pattern cannot match a known violation')
  assert.match(hits[0][2], /display\s*:/, 'the pattern does not see the display it is about')
  assert.ok(!/:not\(\[hidden\]\)/.test(hits[0][1]), 'the guard clause would be wrongly credited')

  // And the inverse: the scoped form must NOT be reported.
  const safe = '.field-row-edit:not([hidden]) { display: flex; }'
  const safeHits = [...safe.matchAll(/^\.field-row-edit((?:(?![,{])[^{])*)\{([^}]*)\}/gm)]
  assert.equal(safeHits.length, 1)
  assert.ok(/:not\(\[hidden\]\)/.test(safeHits[0][1]), 'the scoped form is not recognised as safe')
})
