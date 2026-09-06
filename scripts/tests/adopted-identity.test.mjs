import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'

// ── THE ADOPTION LIST IS A CLAIM, SO IT IS CHECKED ───────────────────────
//
// frontend-react/src/deal/adopted-identity.ts says each name is there because
// something outside the form depends on it. A generated list nobody re-reads
// is Architecture 9's fourth variant waiting to happen: it was true when the
// generator ran, and nothing makes it stay true.

const ROOT = new URL('../../', import.meta.url)
const ts = readCode(new URL('frontend-react/src/deal/adopted-identity.ts', ROOT))
const css = readCode(new URL('frontend/style.css', ROOT))
const app = readCode(new URL('frontend/app.js', ROOT)).replace(/<!--[\s\S]*?-->/g, ' ')
// frontend/opportunity-deal-versions.js was deleted at the Round 5 close, so
// its corpus is empty rather than absent - the ids it once read are now read
// by the React card, which adopted-identity.ts already enumerates.
const ver = ''
const html = readCode(new URL('frontend/index.html', ROOT))

function listOf(name) {
  const m = ts.match(new RegExp(`export const ${name}: readonly string\\[\\] = \\[([\\s\\S]*?)\\n\\]`))
  assert.ok(m, `${name} is not in adopted-identity.ts`)
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}
const IDS = listOf('ADOPTED_IDS')
const CLASSES = listOf('ADOPTED_CLASSES')

// The panel region, so "referenced by other markup" is checked where it
// applies. Walked rather than sliced to a marker: readCode strips comments, so
// any comment used as an end anchor is gone by the time this runs.
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'col', 'area', 'base', 'embed', 'param', 'track', 'wbr'])
const panel = (() => {
  const start = html.indexOf('id="opp-tab-commercial"')
  assert.ok(start > 0, 'the panel anchor is gone; the census and this test both need re-pointing')
  const open = html.lastIndexOf('<', start)
  const tag = /<(\/?)(\w+)([^>]*)>/g
  tag.lastIndex = html.indexOf('>', start) + 1
  let depth = 1, m
  while ((m = tag.exec(html))) {
    const [, slash, name, attrs] = m
    if (VOID.has(name.toLowerCase()) || attrs.trim().endsWith('/')) continue
    depth += slash ? -1 : 1
    if (depth === 0) return html.slice(open, tag.lastIndex)
  }
  throw new Error('the commercial panel never closes')
})()

test('the list is non-empty and free of duplicates', () => {
  assert.ok(IDS.length > 0 && CLASSES.length > 0, 'the parse returned nothing, so nothing below is a check')
  assert.equal(new Set(IDS).size, IDS.length, 'a duplicate id')
  assert.equal(new Set(CLASSES).size, CLASSES.length, 'a duplicate class')
})

test('every adopted CLASS has a stylesheet rule or a reader outside the form', () => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const orphans = CLASSES.filter((c) => {
    const styled = new RegExp(`\\.${esc(c)}(?![\\w-])`).test(css)
    const read = new RegExp(`['"\`.]${esc(c)}(?![\\w-])`).test(app)
      || new RegExp(`['"\`.]${esc(c)}(?![\\w-])`).test(ver)
    return !styled && !read
  })
  assert.deepEqual(orphans, [], 'adopted classes nothing depends on any more')
})

test('every adopted ID has a rule, a reader, or a reference from the form markup', () => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const orphans = IDS.filter((id) => {
    const styled = new RegExp(`#${esc(id)}(?![\\w-])`).test(css)
    const read = new RegExp(`['"\`#]${esc(id)}(?![\\w-])`).test(app)
      || new RegExp(`['"\`#]${esc(id)}(?![\\w-])`).test(ver)
    // label[for], aria-labelledby, aria-controls: the class of dependency the
    // stated criterion could not see, and the one that breaks silently.
    const pointedAt = new RegExp(`(for|aria-labelledby|aria-controls|aria-describedby)="[^"]*\\b${esc(id)}\\b`).test(panel)
    return !styled && !read && !pointedAt
  })
  assert.deepEqual(orphans, [], 'adopted ids nothing depends on any more')
})

test('the six label[for] targets are present, by name', () => {
  // Named individually rather than counted. Round 40's calibration found that
  // renaming one input leaves a COUNT at six and the claim still false.
  for (const id of ['deal-aqm', 'deal-factoring-ratePct', 'deal-factoring-termMonths',
    'deal-hemir', 'deal-ssExisting', 'deal-ssNew']) {
    assert.ok(IDS.includes(id), `${id} is a label[for] target and is not in the adoption list`)
    assert.match(panel, new RegExp(`for="${id}"`), `${id} is no longer a label target; re-run the census`)
  }
})
