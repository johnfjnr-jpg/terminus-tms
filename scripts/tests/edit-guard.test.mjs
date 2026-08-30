// The edit helper refuses to report success for an edit that did nothing.
// Round 39 close. PURE: a temp file, no database, no network.
//
// Verification 9: an invariant not proven capable of failing is not evidence.
// Every guard below is exercised by making it fire, not by asserting it exists.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync, statSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { edit, beginBatch, endBatch, JOURNAL } from '../lib/edit.mjs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

function scratch(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'tms-edit-'))
  const file = join(dir, 'target.txt')
  writeFileSync(file, contents)
  return { dir, file, rel: relative(ROOT, file) }
}

test('a landed edit changes the file on disk and clears the journal', () => {
  const s = scratch('alpha\nbeta\ngamma\n')
  try {
    beginBatch('landed')
    const r = edit(s.rel, 'beta', 'BETA')
    assert.equal(readFileSync(s.file, 'utf8'), 'alpha\nBETA\ngamma\n')
    assert.ok(r.bytesAfter >= r.bytesBefore)
    endBatch()
    assert.equal(existsSync(JOURNAL), false, 'a clean batch leaves nothing for the hook')
  } finally { rmSync(s.dir, { recursive: true, force: true }) }
})

test('an anchor that moved is a failure, not a silent no-op', () => {
  // THE ACTUAL FAULT, twice in one round: the anchor had moved, the script
  // died, and the commit went ahead describing a change the file did not carry.
  const s = scratch('alpha\nbeta\n')
  try {
    beginBatch('moved anchor')
    assert.throws(() => edit(s.rel, 'this text is not in the file', 'x'), /anchor not found/)
    assert.equal(readFileSync(s.file, 'utf8'), 'alpha\nbeta\n', 'the file is untouched')
    assert.throws(() => endBatch(), /did not land/, 'and the batch refuses to close')
  } finally { rmSync(s.dir, { recursive: true, force: true }); if (existsSync(JOURNAL)) rmSync(JOURNAL) }
})

test('an ambiguous anchor is refused rather than guessed', () => {
  const s = scratch('same\nsame\n')
  try {
    beginBatch('ambiguous')
    assert.throws(() => edit(s.rel, 'same', 'other'), /appears 2 times/)
  } finally { rmSync(s.dir, { recursive: true, force: true }); if (existsSync(JOURNAL)) rmSync(JOURNAL) }
})

test('a replacement identical to the anchor is refused', () => {
  // Otherwise the disk check passes trivially and the edit means nothing.
  const s = scratch('alpha\n')
  try {
    beginBatch('noop')
    assert.throws(() => edit(s.rel, 'alpha', 'alpha'), /identical to the anchor/)
  } finally { rmSync(s.dir, { recursive: true, force: true }); if (existsSync(JOURNAL)) rmSync(JOURNAL) }
})

test('a crashed batch leaves a pending entry for the hook to catch', () => {
  // Nothing inside the helper can catch a script that dies mid-way, because it
  // is not running any more. The journal is written BEFORE the edit for exactly
  // this: silence must not read as success.
  const s = scratch('alpha\n')
  try {
    beginBatch('crash')
    edit(s.rel, 'alpha', 'ALPHA')
    // Simulate the next edit having started and the process dying.
    const j = JSON.parse(readFileSync(JOURNAL, 'utf8'))
    j.edits.push({ file: 'somewhere.md', status: 'pending', why: null })
    writeFileSync(JOURNAL, JSON.stringify(j, null, 2))
    assert.throws(() => endBatch(), /somewhere\.md: pending/)
  } finally { rmSync(s.dir, { recursive: true, force: true }); if (existsSync(JOURNAL)) rmSync(JOURNAL) }
})

test('the CLI is a shorter path than a raw heredoc, or it loses to one', () => {
  // ── THE FINDING THAT BUILT IT ────────────────────────────────────────
  //
  // scripts/lib/edit.mjs was bypassed within the hour of being written, by its
  // own author, because a raw heredoc was one command and the helper needed a
  // temp file, an absolute import path and three lines of ceremony. THE GUARD
  // WORKED ONLY WHERE IT WAS USED, AND IT WAS USED ONLY WHERE IT WAS EASY.
  //
  // Measured across six instances: three caught by construction, three by luck,
  // and all three lucky ones were raw edits to documents nothing executes. A
  // failed code edit breaks a test. A failed documentation edit deletes an
  // argument, silently, for ever.
  //
  // So the CLI form is the guard for the category that holds the reasons, and
  // it only works if it stays the shorter path. This asserts the shape rather
  // than the speed: one command, stdin, no import, no temp file.
  const cli = readCode(join(ROOT, 'scripts/edit.mjs'))
  assert.match(cli, /readFileSync\(0, 'utf8'\)/, 'it must read the edit from stdin')
  assert.match(cli, /from '\.\/lib\/edit\.mjs'/, 'it must reuse the one implementation, not a second')
  assert.ok(!/mkdtemp|tmpdir/.test(cli), 'a temp file would make it the slower path again')
  assert.ok(statSync(join(ROOT, 'scripts/edit.mjs')).mode & 0o111, 'the CLI is not executable')
})

test('the hook and its installer are in the repository', () => {
  // ── WHAT THIS MAY AND MAY NOT ASSERT ──────────────────────────────────
  //
  // It used to read .git/config and require core.hooksPath = .githooks. That is
  // LOCAL GIT CONFIG, not a tracked file, so it passed on the machine that had
  // run `git config` and failed on every clean checkout, including CI. Written
  // within the hour of rule 25's population clause and falling straight through
  // it: 222 local passes never covered the clean-checkout population.
  //
  // A test in the repository can only assert what is IN the repository: the
  // hook exists, is executable, says what it should, and something in the repo
  // installs it. Whether a given machine has run that installer is a property
  // of the machine.
  // Read through the stripper as SHELL. A hook whose real check had been
  // commented out would otherwise still satisfy a scan for it, which is the
  // same fault in a language the stripper had to learn.
  const hook = readCode(join(ROOT, '.githooks/pre-commit'))
  assert.match(hook, /COMMIT REFUSED/)
  assert.match(hook, /edit-journal\.json/)
  assert.ok(statSync(join(ROOT, '.githooks/pre-commit')).mode & 0o111, 'the hook is not executable')

  // The installer, so a fresh clone gets the guard without anybody remembering.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.match(pkg.scripts.prepare ?? '', /hooksPath/,
    'npm has no prepare script installing the hook, so a clone would not have it')
})

test('every test file is named by a suite, so none can sit unrun', () => {
  // ROUND 39's INSTANCE, ARRIVING AGAIN IN ROUND 41 and caught the same way,
  // by a count. Nine new assertions were written, the suite went from 270 to
  // 271, and the file holding them was not in package.json at all. Round 39's
  // remedy was that any number describing a run is emitted by the run, which is
  // done and did not help: the run was honest about a population that was one
  // file short.
  //
  // The scripts are read rather than a list being maintained here, so a suite
  // renamed or split needs no edit and cannot rot.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const named = Object.values(pkg.scripts).join(' ')
  const files = readdirSync(join(ROOT, 'scripts/tests')).filter((f) => f.endsWith('.test.mjs'))
  assert.ok(files.length > 20, `population check: expected the test directory to hold the suite, saw ${files.length}`)
  const orphans = files.filter((f) => !named.includes(`scripts/tests/${f}`)).sort()
  assert.deepEqual(orphans, [],
    'these test files are in no npm script, so nothing runs them:\n  ' + orphans.join('\n  '))
})
