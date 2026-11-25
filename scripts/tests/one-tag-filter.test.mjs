// F5_TEARDOWN_SCALE ruling G3 (John, 2026-11-24): every tag filter in
// fixtures.mjs, teardown-scoping and its two calibrators goes through the one
// or-helper, scripts/lib/tag-filter.mjs. A direct like or ilike on
// payload->>name in those files fails here.
//
// WHY. After the switch to like (F1), a direct single-term like ordered by id
// alternated between the trigram index and a primary-key walk (min 116ms,
// about half of 20 samples at 300 to 680ms, one at 4,223ms). No fixture code
// issued that form, yet the INDEX guard was aimed at it and went red. A guard
// must time the statement the code runs (ruling G1).
//
// STRICTER THAN THE RULING'S LETTER, on purpose. The ruling names the direct
// form WITH ORDER BY id. This refuses the direct form whatever follows it: an
// ORDER BY can sit two lines down a chain, where a matcher can lose it, and
// these four files have no use for the direct form at all.
//
// Code is read with comments stripped (Verification 39), and each check is
// calibrated inside the test on built sources, both directions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJs } from '../lib/strip-comments.mjs'
import { tagOr } from '../lib/tag-filter.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Each file and the tagOr( uses it carries today, as a MINIMUM: a file that
// stopped calling the helper would make the absence checks vacuous.
const FILES = {
  'scripts/fixtures.mjs': 1,
  // One call, in the purge; the test body holds tagOr as an alias, `const or = tagOr`.
  'scripts/tests/teardown-scoping.test.mjs': 1,
  'scripts/f5-teardown-scale/calibrate-headroom-guard.mjs': 1,
  'scripts/f5-teardown-scale/calibrate-teardown-scoping.mjs': 3,
}
const DIRECT = /\.(i?like)\s*\(\s*['"`]payload->>name['"`]/g
const RAW = /payload->>name\.(i?like)\./g
export function offences(src) {
  const code = stripJs(src)
  return {
    direct: [...code.matchAll(DIRECT)].map((m) => m[0]),
    raw: [...code.matchAll(RAW)].map((m) => m[0]),
    uses: (code.match(/\btagOr\s*\(/g) ?? []).length,
  }
}

test('the one tag filter is a case-sensitive prefix like, in or-form', () => {
  assert.equal(tagOr(['a1deep-x', 'GATE']), 'payload->>name.like.a1deep-x%,payload->>name.like.GATE%')
})

// Assembled, so this file never carries the forms it hunts.
const P = ['payload', '->>', 'name'].join('')
test('the check is calibrated: a direct form or a raw filter string is caught, the helper passes', () => {
  const direct = `q.select('id').${'like'}('${P}', 'x%').order('id', { ascending: true })`
  const directI = `q.${'ilike'}("${P}", 'x%')`
  const raw = `const or = tags.map((t) => \`${P}.${'like'}.\${t}%\`).join(',')`
  assert.equal(offences(direct).direct.length, 1, 'direct like not caught')
  assert.equal(offences(directI).direct.length, 1, 'direct ilike not caught')
  assert.equal(offences(raw).raw.length, 1, 'a raw filter string not caught')
  const ok = offences('const or = tagOr(tags); q.select(\'id\').or(or)')
  assert.deepEqual([ok.direct.length, ok.raw.length, ok.uses], [0, 0, 1], 'the helper was refused')
  assert.equal(offences(`// q.${'like'}('${P}', 'x%')`).direct.length, 0, 'a comment was read as code')
})

for (const [file, min] of Object.entries(FILES)) {
  test(`every tag filter in ${file} goes through tagOr`, () => {
    const o = offences(readFileSync(join(ROOT, file), 'utf8'))
    assert.ok(o.uses >= min, `${file}: ${o.uses} tagOr( calls, expected at least ${min}; the checks below would be vacuous`)
    assert.deepEqual(o.direct, [], `${file} filters payload->>name directly. Use tagOr from scripts/lib/tag-filter.mjs: the direct form, ordered by id, can take a primary-key walk tearDown never runs.`)
    assert.deepEqual(o.raw, [], `${file} builds a payload->>name filter string by hand. Build it with tagOr, the one tag filter.`)
  })
}
