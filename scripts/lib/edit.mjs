// Every scripted edit asserts it actually changed the file, and a batch that
// did not fully land blocks the commit. Round 39 close, 2026-08-29.
//
// ── THE CLASS THIS CLOSES ──────────────────────────────────────────────────
//
// AN OPERATION REPORTED SUCCESS WITHOUT ANYONE VERIFYING IT DID ANYTHING.
// Third instance of one shape, and the business named it as a class rather
// than as three mistakes:
//
//   Milestone 5   PATCH /contacts/:id and PATCH /test-beds/:id, unchecked
//                 Supabase writes. Success returned, nothing stored.
//   Round 39      a scripted edit whose anchor had moved. The script died,
//                 the commit ran anyway, the message described a correction
//                 the file did not contain.
//   Round 39      the same again, an hour later, caught on the next check
//                 rather than at the moment.
//
// **The signature is identical every time: the message is truthful about the
// INTENT and false about the RESULT.** Vigilance has now failed at it twice
// in one round, by somebody who had just written the rule about it.
//
// The HTTP half was fixed with scripts/api-client.mjs, which throws unless a
// call names the status it expects and why. This is the same fix for edits.
//
// ── HOW IT FAILS LOUDLY ────────────────────────────────────────────────────
//
// Two independent things go wrong and each needs its own guard:
//
//   THE EDIT DID NOTHING. The anchor was not found, or was found and the
//   replacement produced identical bytes. Caught here, by re-reading the file
//   from disk after writing and comparing.
//
//   THE SCRIPT DIED PART-WAY AND THE COMMIT RAN ANYWAY. Nothing in the edit
//   helper can catch that, because it is not running any more. So the journal
//   is written BEFORE each edit and updated after, and the pre-commit hook
//   refuses on any entry that never reached `landed`.
//
// A crash therefore leaves a `pending` entry, which is exactly the state the
// hook exists to catch. Silence is not success.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join, isAbsolute } from 'path'

const ROOT = new URL('../../', import.meta.url).pathname
export const JOURNAL = join(ROOT, '.edit-journal.json')

function read() {
  if (!existsSync(JOURNAL)) return { label: null, edits: [] }
  try { return JSON.parse(readFileSync(JOURNAL, 'utf8')) } catch { return { label: 'UNREADABLE', edits: [] } }
}

function flush(j) {
  writeFileSync(JOURNAL, JSON.stringify(j, null, 2))
}

/** Start a batch. Clears the previous one, which the hook has already judged. */
export function beginBatch(label) {
  flush({ label, edits: [] })
}

/** Every edit in the batch landed. Only then may a commit proceed. */
export function endBatch() {
  const j = read()
  const bad = j.edits.filter((e) => e.status !== 'landed')
  if (bad.length) {
    throw new Error(`batch "${j.label}" has ${bad.length} edit(s) that did not land:\n  `
      + bad.map((e) => `${e.file}: ${e.status}${e.why ? ` (${e.why})` : ''}`).join('\n  '))
  }
  if (existsSync(JOURNAL)) unlinkSync(JOURNAL)
}

/**
 * Replace `oldText` with `newText` in `file`, exactly once, and PROVE it landed
 * by re-reading the file from disk.
 *
 * @param {string} file  path relative to the repository root
 * @param {string} oldText  must appear exactly once
 * @param {string} newText
 */
export function edit(file, oldText, newText) {
  const j = read()
  const entry = { file, status: 'pending', why: null }
  j.edits.push(entry)
  flush(j)

  const fail = (why) => {
    entry.status = 'failed'
    entry.why = why
    flush(j)
    throw new Error(`edit did not land in ${file}: ${why}`)
  }

  // isAbsolute first: join(ROOT, '/tmp/x') produces a path under the repository
  // and the edit then fails with "file does not exist", which is a correct
  // refusal for the wrong reason and sends you looking in the wrong place.
  const path = isAbsolute(file) ? file : join(ROOT, file)
  if (!existsSync(path)) fail('file does not exist')
  const before = readFileSync(path, 'utf8')

  const count = before.split(oldText).length - 1
  if (count === 0) fail('anchor not found, so the edit had nothing to change')
  if (count > 1) fail(`anchor appears ${count} times, so the edit is ambiguous`)
  if (oldText === newText) fail('replacement is identical to the anchor')

  // ── A FUNCTION REPLACEMENT, NEVER A STRING ONE ──────────────────────────
  //
  // String.prototype.replace treats `$` specially in a STRING replacement:
  // `$$` becomes a literal `$`, and `` $` ``, `$'`, `$&` and `$1` all expand.
  // Round 39: replacing text containing `${money(x)}` in a template literal
  // silently ate the leading dollar sign and wrote `${money(x)}` instead, so a
  // price rendered without its currency symbol.
  //
  // The guard below caught it, which is the whole point of the guard, and the
  // fix is to pass a function so the replacement is taken literally.
  writeFileSync(path, before.replace(oldText, () => newText))

  // THE POINT OF THE WHOLE FILE. Not "we called writeFileSync and it did not
  // throw": read it back and confirm the bytes on disk differ and carry the
  // new text. Verification 8, stated for a file instead of an HTTP write.
  const after = readFileSync(path, 'utf8')
  if (after === before) fail('file on disk is unchanged after the write')
  if (!after.includes(newText)) fail('file on disk does not contain the replacement')

  entry.status = 'landed'
  flush(j)
  return { file, bytesBefore: before.length, bytesAfter: after.length }
}
