// ── TWO FILES THAT DIFFER ONLY IN CASE ARE ONE FILE ON THIS MACHINE ─────
//
// Round 7 Phase 2b session 2, after the THIRD instance in two sessions:
// stageTabs.ts/StageTabs.tsx, useCases.ts/UseCases.tsx, and
// customerDocs.ts/CustomerDocs.tsx.
//
// The convention that produces it is a good one - a model module in camelCase
// beside its PascalCase component - so the answer is a detector rather than a
// rule nobody remembers at the moment of naming.
//
// WHY IT MATTERS BEYOND THE ANNOYANCE. macOS and Windows fold case, so
// TypeScript refuses the build with "differs from already included file name
// only in casing" and the fault is loud. A case-SENSITIVE host does not fold:
// there the two are genuinely different files, `import './CustomerDocs'`
// resolves to a different module than `import './customerDocs'`, and the
// failure arrives somewhere else entirely as a missing export. A hazard that
// is loud here and quiet in CI is exactly the kind worth asserting.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOTS = ['frontend-react/src', 'frontend', 'src', 'scripts']

const walk = (dir, base) => {
  let out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) out = out.concat(walk(`${dir}/${e.name}`, rel))
    else out.push(rel)
  }
  return out
}

const collisions = () => {
  const found = []
  for (const root of ROOTS) {
    const abs = fileURLToPath(new URL(`../../${root}/`, import.meta.url))
    const byLower = new Map()
    for (const rel of walk(abs, '')) {
      // Compare the path WITHOUT its extension: `foo.ts` and `Foo.tsx` are the
      // pair that collides at import time, and their full names differ.
      const stem = rel.replace(/\.[jt]sx?$|\.mjs$/, '')
      const k = stem.toLowerCase()
      const seen = byLower.get(k)
      if (seen && seen !== stem) found.push(`${root}: ${seen} vs ${stem}`)
      else byLower.set(k, stem)
    }
  }
  return found
}

test('the walk RUNS: it sees the files it is meant to compare', () => {
  // Verification 12. A walk that returns nothing reports the same clean result
  // as a tree with no collisions.
  const abs = fileURLToPath(new URL('../../frontend-react/src/testbed/', import.meta.url))
  const names = walk(abs, '')
  assert.ok(names.length > 10, `only ${names.length} files walked`)
  assert.ok(names.includes('CustomerDocsPanel.tsx'),
    'the walk cannot see a file that is definitely there')
})

test('no two source files differ only in case', () => {
  assert.deepEqual(collisions(), [],
    'these pairs are ONE file on a case-folding filesystem and TWO on a '
    + 'case-sensitive one: ' + collisions().join('; '))
})
