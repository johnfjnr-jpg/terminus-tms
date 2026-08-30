// Every revision writer states its precondition, and a migration that changes a
// function signature is smoke-tested against the OLD one. Round 38.
// Runs under `npm test` - source inspection and pure calls, no database.
//
// ─────────────────────────────────────────────────────────────
// WHY A SOURCE SCAN RATHER THAN RUNTIME COVERAGE
// ─────────────────────────────────────────────────────────────
//
// appendRecordRevision now THROWS when the precondition argument is omitted,
// which is the right shape: a forgotten argument is a bug in the caller, not a
// database error to be logged and swallowed. But a throw only fires on a path
// that runs, and `npm run test:db` reaches no route at all: every test in it
// talks to Postgres through the service key, so it never makes an HTTP request.
//
// One call site was in fact left without a precondition during this round and
// the whole database suite still passed 69/69, because nothing the suite runs
// touches PATCH /test-beds/:id. It would have thrown the first time the
// business opened a Test Bed.
//
// A CORRECTION, RECORDED RATHER THAN QUIETLY EDITED. This comment previously
// justified itself with "every Test Bed and every Account belongs to a
// different owner, so those routes answer 403 before reaching the write". That
// was a description of the DATA phrased as a permission boundary, and it was
// wrong: scripts/fixtures.mjs freshTestBed() now has the test account create
// its own Account and Test Bed, own both, and drive every one of those routes
// two-sided. Nothing stopped it. There was no fixture that made one.
//
// The source scan still earns its place, because a scan is cheap and standing
// where a probe is neither. But it is no longer the ONLY instrument, and the
// probe found within a minute a 500 on every PATCH /accounts/:id that this scan
// passed cleanly: the call had its six arguments and the identifier they named
// had never been imported.
//
// So the guarantee here is narrow and stated as such: every call is checked for
// a sixth argument whether or not any test can reach it. Whether the route
// WORKS is scripts/probe-preconditions.mjs's question.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { join } from 'node:path'
import { appendRecordRevision, SINGLE_KEY_RMW, CLIENT_UNWIRED } from '../../src/lib/record-revision.js'

const ROOT = new URL('../../', import.meta.url).pathname

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sourceFiles(join(dir, entry.name)))
    else if (entry.name.endsWith('.js')) out.push(join(dir, entry.name))
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// WHAT COUNTS AS STATING A PRECONDITION
// ─────────────────────────────────────────────────────────────
//
// Not "an accepted token appears near the call". That was this scan's first
// shape and it was wrong in two directions at once, both found the first time
// it met a call it had not been written against:
//
//   IT HELD A LIST OF VARIABLE NAMES. deals.js passes `revisionNumber`, which
//   was not on the list, so a correctly guarded call read as unguarded.
//
//   IT SEARCHED A TEN-LINE WINDOW. That call's sixth argument sits below a
//   ten-line comment, so widening the name list would not have fixed it either.
//
// Both are false alarms, and a scan that cries wolf gets widened until it stops
// asking anything. The token list was in fact widened before it was measured,
// which is the failure mode arriving on schedule.
//
// The real property is structural rather than lexical: appendRecordRevision
// takes the precondition as its SIXTH argument, so a call states one exactly
// when it has six. Count them by balancing brackets from the opening paren,
// ignoring comments and string literals. No name list, no window, and a new
// caller inventing a seventh variable name needs no edit here.

/**
 * Top-level argument count of a call whose '(' is at openParenIndex.
 * Returns 0 for an empty argument list.
 */
function countArguments(text, openParenIndex) {
  let depth = 0
  let args = 1
  let sawContent = false
  for (let i = openParenIndex; i < text.length; i++) {
    const c = text[i]
    const two = text.slice(i, i + 2)
    if (two === '//') { const nl = text.indexOf('\n', i); if (nl < 0) break; i = nl; continue }
    if (two === '/*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 1; continue }
    if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < text.length && text[i] !== c) { if (text[i] === '\\') i++; i++ }
      sawContent = true
      continue
    }
    if (c === '(' || c === '[' || c === '{') { depth++; if (depth > 1) sawContent = true; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) break; sawContent = true; continue }
    if (c === ',' && depth === 1) { args++; continue }
    if (!/\s/.test(c)) sawContent = true
  }
  return sawContent ? args : 0
}

test('every appendRecordRevision call passes a precondition argument', () => {
  const files = sourceFiles('src').filter((f) => !f.endsWith('record-revision.js'))
  let calls = 0
  const understated = []

  for (const file of files) {
    const text = readCode(join(ROOT, file))
    const CALL = /await appendRecordRevision\s*\(/g
    let m
    while ((m = CALL.exec(text)) !== null) {
      calls++
      const open = text.indexOf('(', m.index)
      const args = countArguments(text, open)
      if (args < 6) {
        const line = text.slice(0, m.index).split('\n').length
        understated.push(`${file}:${line} passes ${args} arguments; the precondition is the sixth`)
      }
    }
  }

  assert.ok(calls > 0, 'the scan found no calls at all, so it is measuring nothing')
  assert.deepEqual(understated, [],
    'these revision writers pass no precondition and will throw when they run:\n  ' + understated.join('\n  '))
})

test('the argument count can SEE a call that omits the precondition', () => {
  // Calibration in both directions, and against the two shapes that broke the
  // token scan: a comment carrying a comma, and commas nested inside literals.
  const four = 'await appendRecordRevision(db, id, patch, userId)'
  const six = 'await appendRecordRevision(db, id, patch, userId, [], SINGLE_KEY_RMW)'
  const commented = 'await appendRecordRevision(\n  db, id, patch, userId, [],\n  // a note, with a comma, below which the argument sits\n  revisionNumber)'
  const nested = 'await appendRecordRevision(db, id, { a: 1, b: 2 }, userId, [k, j], 7)'
  const empty = 'await appendRecordRevision()'
  assert.equal(countArguments(four, four.indexOf('(')), 4, 'an unstated call must count four')
  assert.equal(countArguments(six, six.indexOf('(')), 6, 'a stated call must count six')
  assert.equal(countArguments(commented, commented.indexOf('(')), 6, 'a comma in a comment is not an argument')
  assert.equal(countArguments(nested, nested.indexOf('(')), 6, 'a comma inside a literal is not top level')
  assert.equal(countArguments(empty, empty.indexOf('(')), 0, 'no arguments counts zero, not one')
})

test('omitting the precondition throws rather than defaulting to unprotected', async () => {
  const db = { rpc: async () => ({ data: null, error: null }) }
  await assert.rejects(
    () => appendRecordRevision(db, 'id', {}, 'user', []),
    /precondition is required/,
    'an omitted precondition must be a loud failure, not a silent blind write')
})

test('the named escapes and a revision number are all accepted', async () => {
  const seen = []
  const db = { rpc: async (_fn, args) => { seen.push(args.p_expected_revision); return { data: {}, error: null } } }
  await appendRecordRevision(db, 'id', {}, 'user', [], SINGLE_KEY_RMW)
  await appendRecordRevision(db, 'id', {}, 'user', [], CLIENT_UNWIRED)
  await appendRecordRevision(db, 'id', {}, 'user', [], 7)
  assert.deepEqual(seen, [null, null, 7],
    'both escapes send null; a revision number is sent as itself')
})

test('a nonsense precondition throws rather than being sent', async () => {
  const db = { rpc: async () => ({ data: {}, error: null }) }
  await assert.rejects(() => appendRecordRevision(db, 'id', {}, 'user', [], '7'), /whole number/)
  await assert.rejects(() => appendRecordRevision(db, 'id', {}, 'user', [], 1.5), /whole number/)
})

// ─────────────────────────────────────────────────────────────
// The migration incident, as a standing check
// ─────────────────────────────────────────────────────────────
//
// `create or replace function` REPLACES a function with the same signature and
// OVERLOADS one with a different signature, and adding a parameter changes the
// signature even when the parameter has a default. Round 38 added
// p_expected_revision with a default, both signatures then existed, and
// PostgREST answered PGRST203 "could not choose the best candidate function" to
// every existing caller. That is the whole application down, not one field, and
// it was caught only because the old signature happened to be called
// immediately afterwards.
//
// This test makes that call standing rather than incidental. It is a source
// check, so it runs in the pure suite and needs no database: a migration that
// changes a function's parameter list must be accompanied by an explicit DROP of
// the superseded signature.

test('a migration that adds a parameter to a function also drops the old signature', () => {
  const dir = 'supabase/migrations'
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.sql')).sort()
  const created = new Map()   // function name -> set of parameter-count signatures created
  const dropped = new Set()   // explicit "drop function name(args)" seen

  for (const file of files) {
    const sql = readCode(join(ROOT, dir, file)).toLowerCase()
    for (const m of sql.matchAll(/create or replace function\s+([a-z_.]+)\s*\(([^)]*)\)/g)) {
      const name = m[1]
      const params = m[2].split(',').filter((x) => x.trim()).length
      if (!created.has(name)) created.set(name, new Set())
      created.get(name).add(params)
    }
    for (const m of sql.matchAll(/drop function (?:if exists )?([a-z_.]+)\s*\(/g)) {
      dropped.add(m[1])
    }
  }

  assert.ok(created.size > 0, 'no functions found, so this scan is measuring nothing')

  const overloaded = []
  for (const [name, signatures] of created) {
    // More than one distinct parameter count means the later migration created
    // an OVERLOAD rather than a replacement.
    if (signatures.size > 1 && !dropped.has(name)) {
      overloaded.push(`${name} created with ${[...signatures].sort().join(' and ')} parameters, never dropped`)
    }
  }
  assert.deepEqual(overloaded, [],
    'these functions exist in more than one signature with no explicit drop, which is what\n' +
    'produced PGRST203 and took every caller down:\n  ' + overloaded.join('\n  '))
})

test('the overload scan can SEE an undropped overload', () => {
  // Calibration against the real history: append_record_revision WAS created
  // with two different parameter counts, so the scan must be finding it and
  // passing only because the drop is also present.
  const dir = 'supabase/migrations'
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.sql'))
  let counts = new Set()
  let sawDrop = false
  for (const file of files) {
    const sql = readCode(join(ROOT, dir, file)).toLowerCase()
    for (const m of sql.matchAll(/create or replace function\s+(public\.append_record_revision)\s*\(([^)]*)\)/g)) {
      counts.add(m[2].split(',').filter((x) => x.trim()).length)
    }
    if (/drop function (?:if exists )?public\.append_record_revision\s*\(/.test(sql)) sawDrop = true
  }
  assert.ok(counts.size > 1,
    'append_record_revision should appear with more than one parameter count in the history')
  assert.ok(sawDrop,
    'and the explicit drop should be there, which is the only reason the test above passes')
})
