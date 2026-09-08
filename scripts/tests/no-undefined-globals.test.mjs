// ── NO IDENTIFIER IS READ THAT NOTHING DECLARES ─────────────────────────
//
// Round 8 Phase 3, from a defect the whole suite was blind to.
//
// Phase 2 deleted 953 lines of dead Test Bed view code. `tbLandOnStageAfterLoad`
// was among them, and Phase 0's per-name deletion had reported it dead -
// correctly, as far as any test could see. TWO LIVE CALLERS SURVIVED IT: the
// transition-landing hook writes it, and the C1 seam the React view reads takes
// it. Nothing exercises either, so all 21 gate stages were green and the browser
// threw `tbLandOnStageAfterLoad is not defined` on the first Test Bed open.
//
// A grep cannot answer this: the name is genuinely present, in the two places
// that USE it. What is missing is the DECLARATION.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { topLevelNames } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url)
const APP = 'frontend/app.js'

/** Identifiers app.js reads that it must therefore declare or receive. */
const AMBIENT = new Set([
  // The browser and the platform.
  'window', 'document', 'localStorage', 'location', 'navigator', 'console',
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'Promise', 'Math', 'JSON', 'Object', 'Array', 'Date',
  'String', 'Number', 'Boolean', 'Set', 'Map', 'Error', 'RegExp', 'Intl',
  'CustomEvent', 'Event', 'KeyboardEvent', 'FocusEvent', 'URL', 'URLSearchParams',
  'AbortController', 'crypto', 'structuredClone', 'queueMicrotask', 'globalThis',
  'HTMLInputElement', 'HTMLElement', 'Node', 'NodeFilter', 'FileReader', 'Blob',
  'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'alert', 'confirm', 'prompt', 'getComputedStyle', 'MutationObserver',
  // The one library the page loads before app.js.
  'supabase',
])

test('the scan RUNS: it sees app.js declarations and reads', () => {
  const code = readCode(new URL(APP, ROOT), 'js')
  assert.ok(code.length > 100000, `app.js read as ${code.length} chars`)
  assert.ok(topLevelNames(code).length > 100, 'no top-level names parsed')
})

test('every tb*/opp* identifier app.js READS is also DECLARED somewhere in it', () => {
  // Scoped to the two view-state families, which is where a retirement bites:
  // they are module-scope `let`s that a deletion can orphan while the callers
  // survive. A whole-file scope analysis would need a parser; this needs none
  // and covers the case that actually happened.
  const code = readCode(new URL(APP, ROOT), 'js')
  const declared = new Set(topLevelNames(code).map((n) => n.name))

  // ── READ, NOT ASSIGNED, AND THAT DISTINCTION IS THE RULE ─────────────
  //
  // app.js is a classic script and NOT strict, so `x = 1` on an undeclared
  // name silently creates a global - sloppy, and harmless. READING one throws.
  // Only the read can take the page down, so only the read is asserted.
  //
  // Measured on the real orphans: `tbFreshNavigation = true` and
  // `tbUserPickedTab = false` survived Phase 2's deletion as assignments and
  // the browser did not care; `tbLandOnStageAfterLoad` was READ and threw.
  const read = new Set()
  for (const m of code.matchAll(/\b((?:tb|opp)[A-Z][A-Za-z0-9_]*)\b/g)) {
    const name = m[1]
    // An assignment: the name, optional space, a single `=` not part of
    // `==`/`=>`/`>=`. Anything else that mentions it counts as a read.
    const assignedHere = new RegExp(`(^|[^.\\w])${name}\\s*=[^=>]`)
    const readSomewhere = new RegExp(
      `(^|[^.\\w])${name}\\s*(?![=\\s]*=[^=>])`, 'm')
    const uses = [...code.matchAll(new RegExp(`(^|[^.\\w])${name}\\b([^\\w]|$)`, 'g'))]
    const everyUseIsAnAssignment = uses.length > 0 && uses.every((u) => {
      const at = u.index + u[1].length
      const rest = code.slice(at + name.length, at + name.length + 4)
      return /^\s*=[^=>]/.test(rest)
    })
    void assignedHere; void readSomewhere
    if (!everyUseIsAnAssignment) read.add(name)
  }
  assert.ok(read.size > 10, `only ${read.size} view-state identifiers found`)

  const orphans = [...read].filter((n) =>
    !declared.has(n) && !AMBIENT.has(n)
    // Properties and seam members are reached through `window.` or a dot.
    && !new RegExp(`[.]${n}\\b`).test(code)
    // A `const`/`let` INSIDE a function is not a top-level name and is not an
    // orphan; the parser only sees the top level.
    && !new RegExp(`\\b(const|let|var)\\s+${n}\\b`).test(code))
  assert.deepEqual(orphans, [],
    'app.js reads these and declares them nowhere, so the browser throws on '
    + 'the first use while every test stays green: ' + orphans.join(', '))
})
