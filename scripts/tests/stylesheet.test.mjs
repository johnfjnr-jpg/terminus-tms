// Round 11 Phase 7 - invariants defending the stylesheet itself.
//
// Runs under `npm test` rather than `npm run test:db`: it reads a file and
// needs no database, no credentials and no fixtures, so it runs on any
// checkout. A check that requires a live database to run is a check that gets
// skipped.
//
// WHY THIS EXISTS AS A TEST RATHER THAN A HABIT. An undefined CSS custom
// property fails at computed-value time and the declaration is SILENTLY
// DROPPED - no error, no warning, no console message, and the element renders
// as though the rule had never been written.
//
// Round 10 Phase 7 found exactly this fault in its own new block, fixed that
// block, and did not sweep the file. `var(--line)` was already live in two
// places at that moment, introduced by 66f2aa6 in Round 9 Phase 6, so
// `.tb-doc-row` and `.tb-crit-row` each carried a `border-bottom` that had
// never rendered. It survived two more rounds of screenshots, because rows
// running together looks like a design choice: **opening the screenshot
// catches what looks wrong, not what looks deliberate.**
//
// The check is one grep against the definitions list and takes milliseconds.
// It was run by hand twice, which is the only reason the live instance
// surfaced at all, and a check run by hand when someone remembers is not a
// control.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cssPath = join(here, '..', '..', 'frontend', 'style.css')
const css = readCode(cssPath)

// Definitions: a custom property declared anywhere, at any indentation, in
// any selector block. Deliberately not scoped to `:root`, since a token
// defined on a narrower selector is still defined.
function definedProperties(source) {
  const defined = new Set()
  for (const m of source.matchAll(/(^|[{;\s])(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[2])
  return defined
}

// Usages: every var() reference, including ones carrying a fallback. A
// reference WITH a fallback is excluded deliberately - `var(--x, 12px)` is
// well defined whether or not --x exists, which is the whole point of the
// fallback syntax, so flagging it would train readers to ignore this check.
function usedProperties(source) {
  const used = new Map()
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
      if (m[2] === ',') continue
      if (!used.has(m[1])) used.set(m[1], [])
      used.get(m[1]).push({ line: i + 1, text: line.trim() })
    }
  })
  return used
}

test('STYLESHEET INVARIANT: every custom property used in style.css is defined in it', () => {
  const defined = definedProperties(css)
  const used = usedProperties(css)

  const undefinedRefs = []
  for (const [prop, sites] of used) {
    if (defined.has(prop)) continue
    for (const s of sites) undefinedRefs.push({ property: prop, line: s.line, declaration: s.text })
  }

  assert.deepEqual(undefinedRefs, [],
    `custom properties used but never defined. An undefined custom property fails at computed-value time and the DECLARATION IS SILENTLY DROPPED, so the rule renders as though it was never written:\n${JSON.stringify(undefinedRefs, null, 2)}\n\nDefined tokens are: ${[...defined].sort().join(', ')}`)
})
