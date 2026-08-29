// The edit helper refuses to report success for an edit that did nothing.
// Round 39 close. PURE: a temp file, no database, no network.
//
// Verification 9: an invariant not proven capable of failing is not evidence.
// Every guard below is exercised by making it fire, not by asserting it exists.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { edit, beginBatch, endBatch, JOURNAL } from '../lib/edit.mjs'

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

test('the pre-commit hook is installed and is the one in the repository', () => {
  // A hook nobody wired up is a plan, not a guard. CLAUDE.md rule 30.
  const cfg = readFileSync(join(ROOT, '.git/config'), 'utf8')
  assert.match(cfg, /hooksPath\s*=\s*\.githooks/, 'core.hooksPath is not set to the tracked hooks')
  const hook = readFileSync(join(ROOT, '.githooks/pre-commit'), 'utf8')
  assert.match(hook, /COMMIT REFUSED/)
  assert.match(hook, /edit-journal\.json/)
})
