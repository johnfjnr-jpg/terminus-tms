// THE STRIP IS ONE ROW: the cells and the grid must agree on how many.
//
// `.stats-grid` is repeat(4, 1fr). The Test Bed header put FIVE cells in it, so
// the fifth wrapped and stranded "Contracted end" alone on a second row. Every
// assertion in the react suite passed on that layout, INCLUDING the one about
// order, because wrapping preserves DOM order and every check was about the
// cells. The column count is a property of the CLASS, in a stylesheet the
// component never mentions. It was found by opening the screenshot.
//
// IT LIVES HERE RATHER THAN IN THE REACT SUITE, and that is a measured
// decision, not a preference. The check needs to read two files, and node
// builtins inside the react program pull @types/node into the WHOLE program -
// deal-panel.test.tsx:233 records a round that went red when a suite doing
// exactly that was retired. Vite's `?raw` does not reach outside its root
// either. `scripts/tests/hidden-not-overridden.test.mjs` is the precedent: a
// stylesheet scan belongs in the pure suite.
//
// Verification 39, and this file is its own instance: the comment above the
// rule in style.css contains the string `repeat(4, 1fr)`, which is ALSO real
// code at style.css:1645. Both sources are comment-stripped before matching.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripCss, stripJs } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const css = stripCss(readFileSync(`${ROOT}frontend/style.css`, 'utf8'))
const ts = stripJs(readFileSync(`${ROOT}frontend-react/src/testbed/headerStats.ts`, 'utf8'))

function declaredColumns(sheet, cls) {
  const m = new RegExp(`\\.${cls}\\s*\\{[^}]*?grid-template-columns:\\s*([^;]+);`).exec(sheet)
  assert.ok(m, `no grid-template-columns on .${cls}`)
  // `repeat(N, ...)` is ONE token and N columns. Counting tokens would call
  // `repeat(4, 1fr)` two, which is a number that does not mean what this
  // function's name says.
  const rep = /^repeat\(\s*(\d+)\s*,/.exec(m[1].trim())
  if (rep) return Number(rep[1])
  return m[1].trim().split(/\s+/).length
}

function cellCount(src) {
  const open = src.indexOf('cells: [')
  assert.ok(open !== -1, 'no `cells: [` in headerStats.ts')
  // Walk to the matching bracket rather than counting: a count cannot see
  // nesting, which is rule 33's own lesson.
  let depth = 0
  let end = -1
  for (let i = src.indexOf('[', open); i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  assert.ok(end !== -1, 'unbalanced cells array')
  return (src.slice(open, end).match(/\{\s*label:/g) ?? []).length
}

test('the stripper keeps the rule and drops the prose describing it', () => {
  // Both directions, per Verification 39. `FIVE CELLS, NOT FOUR` appears ONLY
  // in the comment; `repeat(4, 1fr)` appears in BOTH the comment and the real
  // shared rule, so it is the wrong calibration string and is asserted as such.
  const raw = readFileSync(`${ROOT}frontend/style.css`, 'utf8')
  assert.ok(raw.includes('FIVE CELLS, NOT FOUR'), 'the prose anchor is gone; re-pick it')
  assert.ok(!css.includes('FIVE CELLS, NOT FOUR'), 'stripCss left comment prose in')
  assert.ok(css.includes('.stats-grid--testbed'), 'stripCss ate the rule it must keep')
  assert.ok(css.includes('repeat(4, 1fr)'), 'the shared .stats-grid rule is real code and must survive')
})

test('the Test Bed strip declares one column per cell', () => {
  const cells = cellCount(ts)
  assert.equal(cells, 5, 'headerStats no longer emits five cells; the grid must move with it')
  assert.equal(declaredColumns(css, 'stats-grid--testbed'), cells,
    'the Test Bed strip would WRAP: .stats-grid--testbed does not declare one column per cell')
})

test('the Opportunity strip it borrows from still declares four', () => {
  // The shared rule is what the Test Bed wrapped against. If it ever changes,
  // this says so rather than leaving the modifier looking arbitrary.
  assert.equal(declaredColumns(css, 'stats-grid'), 4,
    'the shared strip no longer declares four; the Test Bed modifier exists because it did')
})
