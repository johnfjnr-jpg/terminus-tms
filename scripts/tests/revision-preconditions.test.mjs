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
// that runs, and this repository has revision writers that cannot be exercised
// from the test account at all - every Test Bed and every Account belongs to a
// different owner, so those routes answer 403 before reaching the write.
//
// One such call site was in fact left without a precondition during this round
// and the whole database suite still passed 69/69, because nothing the suite
// runs touches PATCH /test-beds/:id. It would have thrown the first time the
// business opened a Test Bed.
//
// So the guarantee is made at the source rather than at runtime: every call is
// checked for a precondition token whether or not any test can reach it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { appendRecordRevision, APPEND_ONLY, CLIENT_UNWIRED } from '../../src/lib/record-revision.js'

const ROOT = new URL('../../', import.meta.url).pathname

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sourceFiles(join(dir, entry.name)))
    else if (entry.name.endsWith('.js')) out.push(join(dir, entry.name))
  }
  return out
}

// The tokens that count as stating a precondition: one of the two named
// escapes, or something that resolves to a revision number.
const STATES_A_PRECONDITION = /APPEND_ONLY|CLIENT_UNWIRED|expectedRevision/

test('every appendRecordRevision call states a precondition', () => {
  const files = sourceFiles('src').filter((f) => !f.endsWith('record-revision.js'))
  let calls = 0
  const unstated = []

  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (!line.includes('await appendRecordRevision(')) return
      calls++
      // The call may span several lines; read to its closing paren.
      const window = lines.slice(i, i + 10).join('\n')
      const upToClose = window.slice(0, window.indexOf(')\n') + 1 || window.length)
      if (!STATES_A_PRECONDITION.test(upToClose)) {
        unstated.push(`${file}:${i + 1}`)
      }
    })
  }

  assert.ok(calls > 0, 'the scan found no calls at all, so it is measuring nothing')
  assert.deepEqual(unstated, [],
    'these revision writers pass no precondition and will throw when they run:\n  ' + unstated.join('\n  '))
})

test('the scan can SEE an unstated call, or the test above proves nothing', () => {
  // Calibration. The same regex against a call that states nothing must fail to
  // match, otherwise the assertion above would pass over a real omission.
  const bad = '  const { error } = await appendRecordRevision(\n    db, id, patch, userId)\n'
  const good = '  const { error } = await appendRecordRevision(\n    db, id, patch, userId, [], APPEND_ONLY)\n'
  assert.equal(STATES_A_PRECONDITION.test(bad), false, 'an unstated call must not match')
  assert.equal(STATES_A_PRECONDITION.test(good), true, 'a stated call must match')
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
  await appendRecordRevision(db, 'id', {}, 'user', [], APPEND_ONLY)
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
    const sql = readFileSync(join(ROOT, dir, file), 'utf8').toLowerCase()
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
    const sql = readFileSync(join(ROOT, dir, file), 'utf8').toLowerCase()
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
