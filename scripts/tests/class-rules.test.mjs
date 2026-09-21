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
import { JSDOM } from 'jsdom'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../frontend/', import.meta.url).pathname
const NAME = /^-?[A-Za-z_][A-Za-z0-9_-]*$/

// ── CLASSES WITH NO RULE ON PURPOSE ───────────────────────────────────────
//
// A class used only as a JS selector is legitimate and must not be styled into
// existence to satisfy a scan. Each is listed with what queries it, so a hook
// that loses its last query becomes a dead entry somebody can see.
const HOOKS = {
  // deal-tab-panel went with the sub-tabs in Round 40 Phase 2. The exemption
  // outliving its last query is exactly what the third test below exists to
  // catch, and it caught this one within the minute.
  'lead-add-note-btn': 'app.js, the lead note composer',
  'lead-note-input': 'app.js, the lead note composer',
  'lead-note-input-wrap': 'app.js, the lead note composer',
  'opp-approval-feedback': 'app.js, the approval feedback line',
  'opp-crit-feedback': 'app.js, the exit-criterion feedback line',
  'opp-tab-current-dot': 'app.js, the current-stage dot on the Opportunity tabs',
  // R1: a BEHAVIOUR hook with nothing to style. One delegated listener strips
  // non-digits from anything carrying it, so the class exists to be queried and
  // deliberately carries no rule: a month is a whole number of months.
  'int-only': 'app.js, the delegated digits-only input listener',
  // ADDED ROUND 41, and it had never been declared because it never had to be.
  // The scan read style.css raw, and a comment four lines long at 3323 saying
  // "deliberately NOT a .detail-tab-panel" was enough to make the class look
  // defined. Reading through the stripper is what asked the question.
  'detail-tab-panel': 'app.js, the pane sweeps at 406, 477 and 1098',
}

// ── AND A STATE CLASS IS NEITHER ──────────────────────────────────────────
//
// A third category, and it is separate for the same reason WRAPPERS is: HOOKS
// claims "a selector queries this", and these are never queried. They are
// toggled onto an element by JavaScript to mark a state, and carry no styling
// on purpose. .field-editing's own revert is recorded in style.css at 2070.
//
// Filing one under HOOKS would pass the exemption check by luck or fail it by
// truth, and either way would put a false claim in a list whose value is that
// its claims are checked.
const STATE_CLASSES = {
  // CORRECTED, Round 2 Step C. This said "account-detail.js and
  // contact-detail.js". The Account surface is React as of Round 2, so half of
  // that sentence became false the moment the script tag went.
  //
  // NOTHING WOULD HAVE FAILED. It is a description inside a data structure,
  // used as documentation rather than asserted, so no test could catch it going
  // stale - the shape Phase 0 named as entry 5 and distinct from the ds-row
  // shape, which at least reads a file. Architecture 9's fourth variant living
  // inside a test.
  // RE-POINTED AGAIN, Round 6 Phase 2, and the correction is the whole
  // disposition: contact-detail.js is now UNLOADED, so nothing the browser
  // runs toggles this class at all. Measured across the loaded scripts -
  // app.js 0, test-bed-detail.js 0 - the three remaining toggles are in a file
  // no tag loads.
  //
  // The entry STAYS because the scan below reads every .js in the directory,
  // loaded or not, and the class is genuinely still toggled there. It goes
  // when the file does: Phase 0's sandbox deletion measured this as the ONE
  // test that fails on retirement, which is the instruction to remove it.
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
  const css = readCode(root + 'style.css')
  const defined = new Set([...css.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]))
  const used = new Map()
  let dynamic = 0
  const add = (c, w) => { if (NAME.test(c)) { if (!used.has(c)) used.set(c, new Set()); used.get(c).add(w) } }
  // A class list containing an interpolation cannot be resolved statically, and
  // taking the readable half of it produces junk rather than coverage. Counted
  // and skipped, so the blind spot is visible rather than silent.
  const addList = (s, w) => { if (s.includes('${')) { dynamic++; return } for (const c of s.split(/\s+/)) if (c) add(c, w) }

  for (const f of readdirSync(root).filter((x) => /\.(html|js)$/.test(x))) {
    readCode(root + f).split('\n').forEach((line, i) => {
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
    .filter(([c]) => !defined.has(c) && !(c in HOOKS) && !(c in WRAPPERS) && !(c in STATE_CLASSES) && !isPrefix(c))
    .map(([c, where]) => `.${c}  (${[...where].slice(0, 2).join(', ')})`)
    .sort()
  assert.deepEqual(missing, [],
    'these class names have no rule in style.css and are not declared hooks:\n  ' + missing.join('\n  '))
})

test('no comment swallows a tag, and the five sections are siblings', () => {
  // ── THE MEASURE THAT COULD NOT SEE IT. CLAUDE.md rule 33 ────────────
  //
  // Round 40 Phase 2 rebuilt the tab by slicing and reassembling markup, and
  // the slice cut a comment in half. The opener was left at the end of one
  // section and its `-->` landed inside the next, so the comment SWALLOWED
  // section 3's closing tag and sections 4 and 5 became CHILDREN of section 3.
  //
  // Nothing caught it. The div-balance check counted <div> and </div> inside
  // comments and reported zero. Every element was in the DOM, so an id probe
  // passed. The layout measurement passed too, because nested sections still
  // have increasing tops and still stack. It was found by reading the raw
  // markup while moving something else.
  //
  // Two assertions, because the first alone would not have caught it either:
  // the comment structure, and the resulting PARENTAGE.
  const html = readCode(ROOT + 'index.html')

  let pos = 0
  const swallowed = []
  for (;;) {
    const a = html.indexOf('<!--', pos)
    if (a < 0) break
    const b = html.indexOf('-->', a)
    if (b < 0) { swallowed.push('an unterminated comment'); break }
    const body = html.slice(a, b)
    if (/<\/?(section|div|table|tbody|tr|td)\b/.test(body)) {
      swallowed.push(`a comment at offset ${a} contains a tag: ${body.slice(0, 60).replace(/\s+/g, ' ')}`)
    }
    pos = b + 3
  }
  assert.deepEqual(swallowed, [], 'a comment is swallowing markup:\n  ' + swallowed.join('\n  '))

  // ── AND A STRAY --> OUTSIDE ANY COMMENT ──────────────────────────────
  //
  // The check above missed a second instance an hour later, and the reason is
  // worth keeping. Inserting a block INSIDE an existing comment gives that
  // comment's opener a new, nearer `-->` to pair with. The pair then looks
  // valid and contains no tags, so the scan passes - while the ORIGINAL
  // comment's tail is left outside any comment and RENDERS AS TEXT ON THE PAGE.
  //
  // That is what happened: "safe first (opportunity-deal.js's own header
  // comment has the full dependency-check writeup)... -->" appeared under the
  // Save changes button, in the browser, in prose.
  //
  // The delimiters still BALANCED, 139 and 139. Counting them proves nothing;
  // what matters is that every `-->` is consumed by a pairing.
  let scan = 0
  const strays = []
  for (;;) {
    const a = html.indexOf('<!--', scan)
    const outside = html.slice(scan, a < 0 ? undefined : a)
    if (outside.includes('-->')) {
      const at = html.slice(0, scan + outside.indexOf('-->')).split('\n').length
      strays.push(`line ${at}: ${outside.slice(Math.max(0, outside.indexOf('-->') - 60), outside.indexOf('-->') + 3).replace(/\s+/g, ' ')}`)
    }
    if (a < 0) break
    const b = html.indexOf('-->', a)
    if (b < 0) break
    scan = b + 3
  }
  assert.deepEqual(strays, [], 'a --> sits outside any comment, so its opener was stolen:\n  ' + strays.join('\n  '))

  // Calibration: the scan can see one. Verification 17.
  const planted = '<!-- oops </section> -->'
  assert.ok(/<\/?(section|div)\b/.test(planted.slice(0, planted.indexOf('-->'))),
    'the scan cannot detect the thing it is scanning for')

  // ── WALK 8 ITEM 2: THE PARENTAGE WALK MOVES TO THE LIVE DOM ───────────
  //
  // This built a JSDOM of `index.html` and walked the deal form's section
  // parentage: sections 1 and 2 side by side inside an intake wrapper, 3 to 6
  // siblings of it. Every one of those elements lived inside
  // `#deal-form-vanilla`, which rendered NOTHING, so the walk was measuring a
  // structure no person could see. CLAUDE.md says so in as many words: the
  // green of this suite "is NOT evidence about the live deal form".
  //
  // The block is removed, so the claim has no subject HERE. It is not dropped:
  // it is asserted on the LIVE DOM in `scripts/walk8/probe-deal-whole.mjs`,
  // where the sections are the ones React renders and a person sees. That is
  // the only place the claim was ever checkable.
  //
  // THE COMMENT-SWALLOW HALF STAYS BELOW, because `index.html` still holds
  // comments and a runaway one can still eat a tag in what remains.
  const doc = new JSDOM(html).window.document
  const tab = doc.getElementById('opp-tab-commercial')
  assert.ok(tab, 'the Commercials panel must exist for its structure to be checked')
  assert.ok(!doc.getElementById('deal-form-vanilla'),
    'the retired #deal-form-vanilla block is back in the markup')
  assert.ok(doc.getElementById('deal-form-root'),
    'the deal panel has no container to mount into')
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
  for (const f of readdirSync(ROOT).filter((x) => x.endsWith('.js'))) js += readCode(ROOT + f)
  for (const c of Object.keys(HOOKS)) {
    assert.match(js, new RegExp(`['"\`][^'"\`]*\\.${c}\\b`),
      `.${c} is exempted as a JS hook and nothing queries it`)
  }
})

test('every declared state class is actually toggled, and carries no rule', () => {
  // Both halves, because the exemption makes two claims. A state class nothing
  // toggles is dead; a state class that has since acquired a rule is no longer
  // an exemption at all and should be removed from the list rather than left
  // shadowing a real definition.
  let js = ''
  for (const f of readdirSync(ROOT).filter((x) => x.endsWith('.js'))) js += readCode(ROOT + f)
  const { defined } = scanClasses()
  for (const c of Object.keys(STATE_CLASSES)) {
    assert.match(js, new RegExp(`classList\\.(?:add|remove|toggle)\\(\\s*['"\`]${c}['"\`]`),
      `.${c} is exempted as a state class and nothing toggles it`)
    assert.ok(!defined.has(c), `.${c} now has a rule in style.css, so the exemption is stale`)
  }
})

// ── THE MIGRATED ROW'S TWO STYLESHEET CLAIMS. Round 5 Phase 2 ───────────
//
// Both were SILENT in the Phase 2 injection sweep, which is Verification 51
// doing its job: the injections falsified something true, relied on, and
// asserted nowhere.

test('a closed row\'s editor is not forced visible by the stylesheet', () => {
  // The defect this exists for: a bare `display: flex` on .field-row-edit
  // OVERRIDES the user-agent's `[hidden] { display: none }`, so every closed
  // editor renders while the hidden ATTRIBUTE is correctly set - and every
  // test that reads the attribute passes. It breaks behaviour 3 and the tab
  // order behaviour 2 depends on.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  const rules = [...css.matchAll(/^\.field-row-edit([^{]*)\{([^}]*)\}/gm)]
  assert.ok(rules.length > 0, 'no .field-row-edit rule at all; the row is unstyled')
  for (const [, selectorTail, body] of rules) {
    if (!/display\s*:/.test(body)) continue
    assert.match(selectorTail, /:not\(\[hidden\]\)/,
      'a .field-row-edit rule sets display without excluding [hidden], so a '
      + 'closed row renders its editor and the tab order is wrong')
  }
})

test('the ownership treatment reaches the MIGRATED rows, not only the vanilla', () => {
  // app.js dims a non-owner's editable affordances through .is-not-mine. The
  // React rows carry their own class names by contract finding 11, so the
  // rule has to name them too - otherwise a not-owned record shows rows that
  // read as live while the door silently refuses every one.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.match(css, /\.is-not-mine \.field-row-display/,
    'the migrated field rows are not covered by the read-only treatment')
  assert.match(css, /\.is-not-mine \.ref-same-as-account/,
    'the same-as-account direct input is not covered by the read-only treatment')
})
