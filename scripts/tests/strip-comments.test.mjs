// The comment stripper, calibrated in BOTH directions. Round 41. PURE.
//
// CLAUDE.md Verification 39 asks for two things and the second is the one that
// is easy to skip: strip comments before matching, AND calibrate that the
// stripping keeps real code. A stripper that over-reaches turns every scan
// built on it into a silent false negative, which is the fault it exists to
// catch wearing the other hat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripJs, stripCss, stripHtml, stripSql, stripSh, stripComments, kindOf } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// ── DIRECTION ONE: it strips ───────────────────────────────────────────────

test('a comment mentioning an identifier does not satisfy a scan for it', () => {
  // The Round 41 fault, three times over, reduced to four lines. The raw text
  // matches in every case and the stripped text matches in none.
  const cases = [
    "// imports readSystemDefaults from '../lib/system-defaults.js'\nconst x = 1\n",
    "/* calls createUserClient(request) */\nconst y = 2\n",
    "const z = 3 // and then readSystemDefaults(db) supplies the initial values\n",
  ]
  const needles = ['system-defaults.js', 'createUserClient', 'readSystemDefaults(']
  for (const [i, src] of cases.entries()) {
    assert.ok(src.includes(needles[i]), `calibration: raw text must contain ${needles[i]}`)
    assert.ok(!stripJs(src).includes(needles[i]), `stripped text must not contain ${needles[i]}`)
  }
})

test('html and css comments strip too', () => {
  assert.ok(!stripHtml('<!-- <div id="deal-recoveryMonths"> -->\n<p>x</p>').includes('recoveryMonths'))
  assert.ok(!stripCss('/* .pg-margin { color: red } */\n.a { color: blue }').includes('pg-margin'))
})

// ── DIRECTION TWO: it keeps real code ──────────────────────────────────────

test('the hazards are code, not comments', () => {
  // Every one of these contains the character sequence that opens a comment,
  // and not one of them is a comment. A stripper that eats any of them makes
  // the scan built on it report a clean absence.
  const hazards = [
    ["a url in a string", `const u = 'https://example.test/x'\n`, 'https://example.test/x'],
    ["a regex containing a slash", `const r = /a\\/b/g\n`, 'a\\/b'],
    ["an unescaped slash in a character class", `const r = /[^/]+/\n`, '[^/]+'],
    ["a block-comment opener inside a regex", `const r = /\\/\\*/\n`, '\\/\\*'],
    ["a slash-slash inside a template literal", `const t = \`http://x\`\n`, 'http://x'],
    ["a template resuming after an interpolation", `const t = \`\${a}//keep\`\n`, '//keep'],
    ["division that is not a regex", `const q = total / count / 2\n`, 'total / count / 2'],
    ["a comment marker inside a double-quoted string", `const s = "/* not a comment */"\n`, '/* not a comment */'],
  ]
  for (const [name, src, must] of hazards) {
    assert.ok(stripJs(src).includes(must), `${name}: stripping removed real code`)
  }
})

test('stripping preserves every offset and line number', () => {
  // Blanking rather than deleting is what lets an instrument keep reporting
  // file:line against the stripped text.
  for (const rel of ['src/lib/deal-inputs.js', 'frontend/style.css', 'frontend/index.html']) {
    const src = readFileSync(ROOT + rel, 'utf8')
    const out = stripComments(src, kindOf(rel))
    assert.equal(out.length, src.length, `${rel}: length changed`)
    assert.equal(out.split('\n').length, src.split('\n').length, `${rel}: line count changed`)
    for (let i = 0; i < src.length; i++) {
      if (out[i] !== src[i]) assert.equal(out[i], ' ', `${rel}: offset ${i} became something other than a space`)
    }
  }
})

// The population is every file any instrument scans, not a sample of it:
// CLAUDE.md's collapsed null-reading rule asks for the calibration to run on
// the same population the claim covers.
const JS_FILES = [
  'src/lib/deal-inputs.js', 'src/lib/deal-calculator.js', 'src/lib/approval-page.js',
  'src/lib/rate-resolution.js', 'src/lib/system-defaults.js', 'src/lib/payload-diff.js',
  'src/lib/numeric-payload.js',
  'src/routes/opportunities.js', 'src/routes/deals.js', 'src/routes/deal-sheet-versions.js',
  'src/routes/contacts.js', 'src/routes/test-beds.js',
  'frontend/opportunity-deal.js', 'frontend/app.js',
]

test('stripped javascript still parses', () => {
  // The strongest available statement of "it keeps real code": hand the output
  // to the parser rather than asserting a string survived. node --check is a
  // separate implementation, which is the point.
  const dir = mkdtempSync(join(tmpdir(), 'strip-'))
  for (const rel of JS_FILES) {
    const src = readFileSync(ROOT + rel, 'utf8')
    const p = join(dir, rel.replace(/\//g, '_') + '.mjs')
    writeFileSync(p, stripJs(src))
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' })
    assert.equal(r.status, 0, `${rel}: stripped output does not parse\n${r.stderr}`)
  }
})

test('the parse check can fail', () => {
  // Verification 9. A parser that returned 0 on anything would make the test
  // above ceremony, so it is shown refusing.
  const dir = mkdtempSync(join(tmpdir(), 'strip-'))
  const p = join(dir, 'broken.mjs')
  writeFileSync(p, 'const a = (\n')
  assert.notEqual(spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' }).status, 0)
})

test('the inline script in index.html survives stripping', () => {
  const src = readFileSync(ROOT + 'frontend/index.html', 'utf8')
  const out = stripHtml(src)
  const bodies = (s) => [...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const before = bodies(src)
  const after = bodies(out)
  assert.equal(before.length, 1, 'population changed: index.html no longer has exactly one inline script')
  assert.equal(after.length, before.length)
  const dir = mkdtempSync(join(tmpdir(), 'strip-'))
  for (const [i, b] of after.entries()) {
    const p = join(dir, `inline${i}.mjs`)
    writeFileSync(p, b)
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' })
    assert.equal(r.status, 0, `inline script ${i} does not parse after stripping\n${r.stderr}`)
  }
})

// The drop is asserted EXACTLY, and against a second implementation. A naive
// "the count is unchanged" fails honestly here, because style.css really does
// discuss a rule inside a comment and index.html really does hold a commented
// out <datalist> and <script>. Counting what a flat regex finds inside comment
// delimiters is a different algorithm from the stripper's string-aware walk,
// so agreement between them is evidence rather than restatement.
// ── SQL AND SHELL, the two kinds added because instruments scan them ───────

test('sql comments strip and sql code survives', () => {
  assert.ok(!stripSql("-- create index on records(deleted_at)\nselect 1;\n").includes('create index'))
  assert.ok(!stripSql("/* nested /* deeper */ still a comment */\nselect 2;\n").includes('deeper'))
  // A dollar-quoted body is a string, and every migration defining a function
  // has one. A stripper that treats `--` inside it as a comment eats plpgsql.
  const body = "create function f() returns int as $$\n  -- this is inside the body\n  select 1;\n$$ language sql;\n"
  assert.ok(stripSql(body).includes('-- this is inside the body'), 'a dollar-quoted body is code')
  assert.ok(stripSql("select '-- not a comment' as t;\n").includes('-- not a comment'))
  assert.ok(stripSql("select 'it''s fine' -- gone\n").includes("it''s fine"))
})

test('every migration still parses as balanced sql after stripping', () => {
  // The population is every migration any instrument scans, which is all of
  // them: version-guard, revision-preconditions and system-defaults each walk
  // the directory.
  const dir = ROOT + 'supabase/migrations/'
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))
  assert.ok(files.length > 90, `population check: expected the whole migration directory, saw ${files.length}`)
  for (const f of files) {
    const src = readFileSync(dir + f, 'utf8')
    const out = stripSql(src)
    assert.equal(out.length, src.length, `${f}: length changed`)
    const q = (s) => (s.match(/\$\$/g) || []).length
    assert.equal(q(out), q(src), `${f}: a dollar quote was eaten`)
    const semis = (s) => (s.match(/;/g) || []).length
    assert.ok(semis(out) >= semis(src) - 20, `${f}: statements lost beyond what comments could hold`)
  }
})

test('shell comments strip and shell code survives', () => {
  assert.ok(!stripSh('# node scripts/verify-all.mjs\nnpm test\n').includes('verify-all'))
  assert.ok(stripSh('echo "a # inside a string"\n').includes('a # inside a string'))
  assert.ok(stripSh('echo ${VAR#prefix}\n').includes('${VAR#prefix}'), 'parameter expansion is code')
  assert.ok(stripSh('echo $#\n').includes('$#'), 'the argument count is code')
  assert.ok(stripSh('grep -c x file # count\n').includes('grep -c x file'))
})

test('the pre-commit hook keeps its commands after stripping', () => {
  const src = readFileSync(ROOT + '.githooks/pre-commit', 'utf8')
  const out = stripSh(src)
  assert.equal(out.length, src.length)
  const lines = (s) => s.split('\n').filter((l) => l.trim() && !/^\s*$/.test(l)).length
  assert.ok(lines(out) > 3, 'the hook lost its body')
  assert.ok(out.includes('edit-journal') || out.includes('JOURNAL'), 'the hook lost the journal check')
})

test('stripped css loses exactly the braces that were inside comments', () => {
  const src = readFileSync(ROOT + 'frontend/style.css', 'utf8')
  const out = stripCss(src)
  const inComments = [...src.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]).join('')
  const count = (s, re) => (s.match(re) || []).length
  assert.ok(count(src, /\{/g) > 500, 'population check: style.css should hold hundreds of rules')
  // ── THE EXPECTED COUNT IS DERIVED, NOT TYPED ──────────────────────────
  //
  // It read `assert.equal(count(inComments, /\{/g), 1)`. Round 41 wrote a CSS
  // comment quoting a one-line rule, the count became 2, and the suite failed
  // on the POPULATION CHECK rather than on anything about stripping. The
  // stripper was working perfectly.
  //
  // Architecture 9's fourth variant arriving from the test side: a literal
  // describing the file's contents, true when typed, falsified by an ordinary
  // edit to a different file. A hardcoded 1 makes "somebody quoted a rule in a
  // comment" indistinguishable from "the stripper ate a brace".
  //
  // Derived, the test asks its real question - stripping loses exactly the
  // braces that were inside comments and no others - and the population check
  // keeps its job by asserting there is at least one to lose, so the assertion
  // below can still fail.
  const openInComments = count(inComments, /\{/g)
  const closeInComments = count(inComments, /\}/g)
  assert.ok(openInComments >= 1, 'population check: style.css must hold a commented-out brace, or this test cannot fail')
  assert.equal(count(out, /\{/g), count(src, /\{/g) - openInComments, 'braces lost beyond the commented ones')
  assert.equal(count(out, /\}/g), count(src, /\}/g) - closeInComments, 'braces lost beyond the commented ones')
})

test('stripped html loses exactly the tags that were inside comments', () => {
  const src = readFileSync(ROOT + 'frontend/index.html', 'utf8')
  const out = stripHtml(src)
  const TAG = /<[a-zA-Z][^>]*>/g
  const inComments = [...src.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0]).join('')
  const count = (s) => (s.match(TAG) || []).length
  assert.ok(count(src) > 500, 'population check: index.html should hold hundreds of tags')
  // Derived for the same reason as the CSS case above, and pre-emptively: this
  // one still passed, because Round 41's markup comments happen to quote no
  // tags. It is the same literal waiting for the same edit. Build discipline 8,
  // fix the class rather than the instance the failure named.
  const tagsInComments = count(inComments)
  assert.ok(tagsInComments >= 1, 'population check: index.html must hold a commented-out tag, or this test cannot fail')
  assert.equal(count(out), count(src) - tagsInComments, 'elements lost beyond the commented ones')
})
