#!/usr/bin/env node
// One command, no temp file, no import line.
//
//   node scripts/edit.mjs <file> <<'EDIT'
//   the exact text to find
//   @@REPLACE@@
//   the text to put there
//   EDIT
//
// ── WHY THIS EXISTS, AND IT IS NOT CONVENIENCE ─────────────────────────────
//
// scripts/lib/edit.mjs already refused an edit that did not land. It was
// bypassed within the hour of being written, by its own author, because the raw
// heredoc was one command and the helper needed a temp file, an absolute import
// path and three lines of ceremony. THE GUARD WORKED ONLY WHERE IT WAS USED,
// AND IT WAS USED ONLY WHERE IT WAS EASY.
//
// Measured across the six instances of a scripted edit reporting success while
// the file was unchanged: three were caught by construction and three by luck,
// and ALL THREE LUCKY ONES WERE RAW EDITS TO DOCUMENTS NOTHING EXECUTES.
//
// That is the whole risk rather than a footnote about markdown, and it is the
// business's sentence:
//
//   A FAILED CODE EDIT BREAKS A TEST.
//   A FAILED DOCUMENTATION EDIT DELETES AN ARGUMENT, SILENTLY, FOR EVER.
//
// Nothing runs DESIGN_PRINCIPLES.md. No ReferenceError, no test count, no gate.
// This is the only thing that will ever catch a failed edit there, so it has to
// be the SHORTER path or it will lose to the heredoc again.
//
// The same afternoon produced the other form of it: a deferred item that
// existed only in a chat message and was retrieved by accident. A decision that
// does not land in the file is a decision that did not happen, and nobody finds
// out.
//
// ── SEMANTICS ──────────────────────────────────────────────────────────────
//
// One edit per invocation, and the invocation IS the batch: it opens the
// journal, performs the edit, and clears the journal only if the edit landed. A
// failure leaves an entry and .githooks/pre-commit refuses the commit, so a
// broken edit cannot reach a message describing a change the file does not
// carry.
//
// The anchor must appear EXACTLY ONCE. Zero is an anchor that moved, which is
// how five of the six failed; more than one is ambiguous and guessing which is
// how a fix lands in the wrong place.
import { readFileSync } from 'node:fs'
import { beginBatch, edit, endBatch } from './lib/edit.mjs'

const args = process.argv.slice(2)
const sepArg = args.find((a) => a.startsWith('--sep='))
const raw = args.includes('--raw')
const file = args.find((a) => !a.startsWith('--'))
const SEP = sepArg ? sepArg.slice('--sep='.length) : '@@REPLACE@@'

if (!file) {
  console.error(`Usage: node scripts/edit.mjs <file> <<'EDIT'
old text
${SEP}
new text
EDIT

  --sep=XXX   use a different separator line (default ${SEP})
  --raw       do not strip the heredoc's own surrounding newlines`)
  process.exit(1)
}

let stdin = ''
try {
  stdin = readFileSync(0, 'utf8')
} catch {
  console.error('Nothing on stdin. The anchor and replacement are read from stdin, separated by a line containing only ' + SEP)
  process.exit(1)
}

// The separator must be its own line, so an anchor containing the token inline
// does not split the input somewhere nobody intended.
const lines = stdin.split('\n')
const at = lines.reduce((acc, l, i) => (l.trim() === SEP ? acc.concat(i) : acc), [])
if (at.length !== 1) {
  console.error(at.length === 0
    ? `No separator line. Put a line containing only ${SEP} between the anchor and the replacement.`
    : `The separator ${SEP} appears ${at.length} times on its own line. It must appear exactly once; use --sep= to pick another.`)
  process.exit(1)
}

let oldText = lines.slice(0, at[0]).join('\n')
let newText = lines.slice(at[0] + 1).join('\n')
if (!raw) {
  // A heredoc contributes one newline before the separator and one at the end.
  // Stripping exactly one each keeps the obvious form working; --raw turns it
  // off for an edit that genuinely needs the trailing blank line.
  oldText = oldText.replace(/\n$/, '')
  newText = newText.replace(/\n$/, '')
}

if (!oldText) {
  console.error('The anchor is empty. An empty anchor would match everywhere.')
  process.exit(1)
}

beginBatch(`cli: ${file}`)
try {
  const r = edit(file, oldText, newText)
  endBatch()
  console.log(`landed in ${r.file}: ${r.bytesBefore} -> ${r.bytesAfter} bytes`)
} catch (e) {
  // The journal keeps the failed entry, so the pre-commit hook refuses until it
  // is dealt with. Failing loudly here is not enough on its own: the whole point
  // is that the NEXT commit cannot describe a change that did not happen.
  console.error(e.message)
  console.error('The edit journal now holds a failed entry, so a commit will be refused until this is fixed.')
  process.exit(1)
}
