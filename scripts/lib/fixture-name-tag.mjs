// F5_TEARDOWN_SCALE ruling F1b (John, 2026-11-24). Pure checks behind
// scripts/tests/fixture-names-carry-tag.test.mjs.
//
// THE CLAIM. tearDown's tag branch, teardown-scoping's filters and purge, and
// the create-from-any-contact probe's scans match a fixture by a
// CASE-SENSITIVE prefix like on payload->>'name' (ruling F1). That finds a
// fixture only if its name BEGINS WITH THE TAG EXACTLY AS WRITTEN. Two routes
// break it, and each is checked:
//   1. a name built with anything before the tag, or with the tag transformed
//      (`${tag.toLowerCase()} Contact`, `'x ' + tag`, a variable);
//   2. a tag transformed on its way IN, at a fixture or teardown call
//      (`freshOpportunity(TAG.toUpperCase())`), so the name and the sweep
//      carry different spellings.
// Both read code with comments stripped (Verification 39).
import { stripJs } from './strip-comments.mjs'

// A fixture name: `${<tag variable>}` first, nothing inside the braces but
// the identifier, so a method call on the tag cannot pass.
export const TAG_IDENTS = ['tag', 'TAG', 't']
// The value runs to the end of the line: a template literal's own `}` must
// not end it, or `${tag}` reads as `${tag` and every name fails.
const NAME_KEY = /\b(name|opportunity_name)\s*:\s*([^\n]+)/g
const GOOD = new RegExp('^`\\$\\{(' + TAG_IDENTS.join('|') + ')\\}')

export function nameSites(src) {
  return [...stripJs(src).matchAll(NAME_KEY)].map((m) => ({ key: m[1], value: m[2].trim().slice(0, 80), ok: GOOD.test(m[2].trim()) }))
}

const CALL = /\b(tearDown|freshOpportunity|freshContact|freshAccount|freshTestBed|rememberTag|createRecord)\s*\(([^)]*)\)/g
const TRANSFORM = /\.(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase|normalize)\s*\(/
export function transformedCalls(src) {
  const out = []
  let n = 0
  for (const m of stripJs(src).matchAll(CALL)) { n++; if (TRANSFORM.test(m[2])) out.push(`${m[1]}(${m[2].trim().slice(0, 60)})`) }
  return { calls: n, transformed: out }
}
