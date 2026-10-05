// ── G9: ONE TOKEN PER ROLE, HELD AT SOURCE ──────────────────────────────
//
// The live probe measures what the browser painted, which is the claim. This
// guards the MECHANISM: the collapse cannot be undone by somebody reaching
// for the dimmer token again, and that is a source fact a test can hold
// without a browser.
//
// WHY `--muted-2` IS NO LONGER A TEXT COLOUR. Measured on the live screen at
// both widths: `rgba(242,242,240,0.32)` renders #5f6065 on `--dark` and
// #5c5c60 on `--black`, which are 2.73:1 and 2.72:1 - well under the 4.5:1
// this round was asked to reach. There is no alpha at which a THIRD dimness
// level clears 4.5 while staying meaningfully dimmer than `--muted`'s 0.5,
// so the tertiary text level cannot exist at this contrast requirement. It
// collapsed into `--muted` rather than being re-tuned.
//
// Comments are stripped before matching: this file's own explanation names
// the token, and prose must not satisfy a scan for code (Verification 39).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'

const css = readCode(new URL('../../frontend/style.css', import.meta.url))

test('G9 1: the stylesheet was read, so an absence below means something', () => {
  // Verification 12: a search that returns nothing may not have run.
  assert.ok(css.length > 100000, `only ${css.length} bytes of stripped CSS`)
  assert.match(css, /--muted-2:/, 'the token is gone entirely, so this guard is measuring nothing')
  assert.ok((css.match(/color: var\(--muted\)/g) ?? []).length > 40,
    'almost nothing binds --muted, so the collapse did not happen')
})

test('G9 2: no TEXT binds --muted-2, because it cannot clear 4.5:1', () => {
  const hits = [...css.matchAll(/color:\s*var\(--muted-2\)/g)].map((m) => m[0])
  assert.deepEqual(hits, [],
    `${hits.length} text colours still bind --muted-2, which measures 2.73:1 on --dark`)
})

test('G9 3: a field label is ONE role, so it is ONE colour', () => {
  // The two the walk named differ only by ancestor, and the live probe
  // asserts they COMPUTE the same. This holds the source side: the unit
  // card's label must not reintroduce a colour of its own that is dimmer
  // than the one the terms card inherits.
  // ── EVERY RULE, NOT THE FIRST ONE ───────────────────────────────────
  //
  // There are TWO `.unit-card label` blocks - an earlier one setting only a
  // margin, and the one that sets the colour. A regex taking the first match
  // asserted against the margin rule and passed while saying nothing, which
  // is Verification 19's silent omission arriving inside a guard.
  /* ── RE-POINTED BY R-SZ2, 2026-09-26, AND THE GUARD'S OWN SELF-CHECK IS
     WHAT CAUGHT IT. `.unit-card label` is gone: the merge renders the units
     inputs BARE, because a product is named once per row in its own cell, so
     there is no per-input label in that grid to carry a colour.

     THE ROLE DID NOT DISAPPEAR, IT MOVED TO THE CELL THAT NAMES THE ROW.
     `.ig-product` is what a reader sees as the name of a line of figures, and
     the claim is unchanged: it must not be dimmer than the colour the terms
     card inherits.

     The `assert.ok` above it is kept exactly as it was, and it is the reason
     this re-point happened deliberately rather than by the rule quietly
     matching nothing. */
  const rules = [...css.matchAll(/\.product-grid \.ig-product\s*\{([^}]*)\}/g)].map((m) => m[1])
  assert.ok(rules.length >= 1,
    '.product-grid .ig-product is gone, so the label role has no rule to check')
  const coloured = rules.filter((b) => /color:/.test(b))
  assert.equal(coloured.length, 1,
    `${coloured.length} of ${rules.length} .ig-product rules set a colour; exactly one should`)
  assert.match(coloured[0], /color:\s*var\(--white\)/,
    'the product name does not take the shared label colour')
})

// ── G9 4 and 5 (LABEL_CONTRAST, 2026-10-05): THE INLINE ROUTE ──────────────
//
// G9 2 scans style.css, and the estate still painted --muted-2 TEXT at 2.73:1
// through INLINE styles in cashflow.ts and panelParts.tsx (measured as painted
// by scripts/label-contrast/census.mjs). A rule naming one mechanism polices
// that mechanism (Verification 37): the effect is "no text in --muted-2",
// whatever route sets it. So the React source and the vanilla scripts are
// scanned too, comments stripped, for any COLOUR key bound to --muted-2.
//
// A fill is not text: app.js gives a stage dot `background:${dotColor}` and
// assigns that variable with `=`, so it does not match, and G9 5 proves it.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

// `color: 'var(--muted-2)'`, `labelColor: x ? 'var(--muted-2)' : ...`,
// `style="color:var(--muted-2)"`: a key ending in color or Color, a colon, then
// --muted-2 before the end of that value.
const INLINE_MUTED2 = /[cC]olor['"]?\s*:\s*[^,;}\n]*var\(--muted-2\)/g

test('G9 5: the inline matcher fires on every route and not on a fill (calibrated)', () => {
  for (const s of [
    "if (!r) return { value: '-', color: 'var(--muted-2)' }",
    "labelColor: opts.section ? 'var(--muted-2)' : 'var(--white)',",
    '<span className="ds-label" style={{ color: \'var(--muted-2)\' }}>Total</span>',
    '<p style="color:var(--muted-2)">x</p>',
  ]) assert.equal((s.match(INLINE_MUTED2) ?? []).length, 1, `missed: ${s}`)
  for (const s of [
    "const dotColor = st.state === 'current' ? 'var(--green)' : 'var(--muted-2)'",
    '<span class="sa-dot" style="background:${dotColor}"></span>',
    "border: '1px solid var(--muted-2)'",
  ]) assert.equal((s.match(INLINE_MUTED2) ?? []).length, 0, `fired on a non-text use: ${s}`)
})

test('G9 4: no inline TEXT colour binds --muted-2 in the React source or the vanilla scripts', () => {
  const root = new URL('../../', import.meta.url).pathname
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p) }
      else if (/\.(tsx?|js|mjs)$/.test(e.name)) files.push(p)
    }
  }
  walk(join(root, 'frontend-react/src'))
  for (const e of readdirSync(join(root, 'frontend'))) if (e.endsWith('.js')) files.push(join(root, 'frontend', e))
  // Verification 12: the walk reached the files the defect lived in.
  assert.ok(files.some((f) => f.endsWith('deal/cashflow.ts')) && files.some((f) => f.endsWith('frontend/app.js')),
    `the walk did not reach the files it guards (${files.length} files)`)
  const hits = []
  for (const f of files) {
    const code = readCode(f, 'js')
    for (const m of code.matchAll(INLINE_MUTED2)) hits.push(`${f.slice(root.length)}: ${m[0].slice(0, 80)}`)
  }
  assert.deepEqual(hits, [], `inline text colours bound to --muted-2, which paints 2.73:1:\n  ${hits.join('\n  ')}`)
})

