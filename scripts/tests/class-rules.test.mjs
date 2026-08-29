// Every class name the markup references has a rule in the stylesheet, or is
// declared here as a JS hook. PURE: reads files, nothing else.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Round 39. `.btn-secondary` and `.msg-warn` were both found by LOOKING at a
// screenshot, two hours apart, both rendering as browser defaults. A class name
// asserting a style that does not exist cannot be falsified by anything: no
// test fails, no error is thrown, the element simply renders unstyled beside
// its correctly-styled neighbours.
//
// The business's instruction after the second one: twice is a class, scan for
// it. The scan found FIVE, of which one was live on the approval page.
//
// Same family as Architecture rule 9's fourth variant, a literal that cannot be
// falsified, and the reason this is a test rather than a rule to remember is
// Verification 16: prefer a step that runs to a mistake to avoid.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../frontend/', import.meta.url).pathname
const NAME = /^-?[A-Za-z_][A-Za-z0-9_-]*$/

// ── CLASSES WITH NO RULE ON PURPOSE ───────────────────────────────────────
//
// A class used only as a JS selector is legitimate and must not be styled into
// existence to satisfy a scan. Each is listed with what queries it, so a hook
// that loses its last query becomes a dead entry somebody can see.
const HOOKS = {
  'deal-tab-panel': 'opportunity-deal.js, switching the sub-tab panels',
  'lead-add-note-btn': 'app.js, the lead note composer',
  'lead-note-input': 'app.js, the lead note composer',
  'lead-note-input-wrap': 'app.js, the lead note composer',
  'opp-approval-feedback': 'app.js, the approval feedback line',
  'opp-crit-feedback': 'app.js, the exit-criterion feedback line',
  'opp-tab-current-dot': 'app.js, the current-stage dot on the Opportunity tabs',
  'tb-tab-current-dot': 'app.js, the current-stage dot on the Test Bed tabs',
  'tb-unit-field': 'test-bed-detail.js, the per-unit edit fields',
}

// ── AND A STRUCTURAL WRAPPER IS NOT A HOOK ────────────────────────────────
//
// Separate from HOOKS deliberately, because HOOKS claims "something queries
// this" and a wrapper is claiming the opposite: it carries no style, nothing
// queries it, and it exists to give the markup a name. Filing one under HOOKS
// would put a false claim in a list whose whole value is that its claims are
// checked, which is Verification 19 committed in the fix for Verification 19.
const WRAPPERS = {
  'sub-tab-panes': 'app.js, the container the generic tab mounter emits around its panes',
}

export function scanClasses(root = ROOT) {
  const css = readFileSync(root + 'style.css', 'utf8')
  const defined = new Set([...css.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]))
  const used = new Map()
  let dynamic = 0
  const add = (c, w) => { if (NAME.test(c)) { if (!used.has(c)) used.set(c, new Set()); used.get(c).add(w) } }
  // A class list containing an interpolation cannot be resolved statically, and
  // taking the readable half of it produces junk rather than coverage. Counted
  // and skipped, so the blind spot is visible rather than silent.
  const addList = (s, w) => { if (s.includes('${')) { dynamic++; return } for (const c of s.split(/\s+/)) if (c) add(c, w) }

  for (const f of readdirSync(root).filter((x) => /\.(html|js)$/.test(x))) {
    readFileSync(root + f, 'utf8').split('\n').forEach((line, i) => {
      const w = `${f}:${i + 1}`
      for (const m of line.matchAll(/\bclass="([^"]*)"/g)) addList(m[1], w)
      for (const m of line.matchAll(/\bclassName\s*=\s*(?:[^;]*?\?\s*)?['"`]([^'"`$]*)['"`]\s*(?::\s*['"`]([^'"`$]*)['"`])?/g)) {
        addList(m[1], w); if (m[2]) addList(m[2], w)
      }
      for (const m of line.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"`]([^'"`]+)['"`]/g)) addList(m[1], w)
    })
  }
  return { defined, used, dynamic }
}

test('every class the markup references has a rule, or is a declared hook', () => {
  const { defined, used } = scanClasses()
  // ── A NAMING PREFIX IS NOT AN UNSTYLED CLASS ──────────────────────────
  //
  // `.tb-matrix` has no rule and `.tb-matrix-cell`, `-head`, `-popup` and
  // `-hover` all do. The container is a namespace for its children, which is a
  // deliberate pattern here and not a missing rule. DETECTED rather than
  // allowlisted, so a new one needs no maintenance and an allowlist cannot rot.
  const isPrefix = (c) => [...defined].some((d) => d.startsWith(c + '-'))

  const missing = [...used.entries()]
    .filter(([c]) => !defined.has(c) && !(c in HOOKS) && !(c in WRAPPERS) && !isPrefix(c))
    .map(([c, where]) => `.${c}  (${[...where].slice(0, 2).join(', ')})`)
    .sort()
  assert.deepEqual(missing, [],
    'these class names have no rule in style.css and are not declared hooks:\n  ' + missing.join('\n  '))
})

test('the scan can SEE a class with no rule', () => {
  // Verification 17: a probe that cannot distinguish two states reports the
  // answer you wanted for a reason unrelated to the truth. Calibrated against
  // the real stylesheet rather than a synthetic one.
  const { defined } = scanClasses()
  assert.equal(defined.has('btn-secondary'), true, 'a class known present must be found')
  assert.equal(defined.has('definitely-not-a-real-class-xyz'), false, 'and one known absent must not')

  // And the extractor must pull a class out of each of the three forms.
  const forms = [
    '<div class="probe-alpha">',
    "el.className = 'probe-beta'",
    "el.classList.add('probe-gamma')",
  ]
  for (const [form, name] of forms.map((f, i) => [f, ['probe-alpha', 'probe-beta', 'probe-gamma'][i]])) {
    const hits = new Set()
    for (const m of form.matchAll(/\bclass="([^"]*)"/g)) hits.add(m[1])
    for (const m of form.matchAll(/\bclassName\s*=\s*['"`]([^'"`$]*)['"`]/g)) hits.add(m[1])
    for (const m of form.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"`]([^'"`]+)['"`]/g)) hits.add(m[1])
    assert.ok(hits.has(name), `the extractor missed ${name} in: ${form}`)
  }
})

test('every declared hook is actually queried, or the exemption is dead', () => {
  // The same shape as api-client's exempt-file check: an exemption nobody uses
  // is a claim that has stopped being true, and nothing else would notice.
  let js = ''
  for (const f of readdirSync(ROOT).filter((x) => x.endsWith('.js'))) js += readFileSync(ROOT + f, 'utf8')
  for (const c of Object.keys(HOOKS)) {
    assert.match(js, new RegExp(`['"\`][^'"\`]*\\.${c}\\b`),
      `.${c} is exempted as a JS hook and nothing queries it`)
  }
})
