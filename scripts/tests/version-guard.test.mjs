// Every column of deal_sheet_versions is accounted for by the relabel guard.
// Round 38. Runs under `npm test` - source inspection of the migrations.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS EXISTS: THE SAME FAULT, TWICE, ONE MIGRATION APART
// ─────────────────────────────────────────────────────────────
//
// deal_sheet_versions_immutable() constrains the draft-to-issued relabel by
// listing every column that must be identical on both sides. That list is
// complete for the columns that existed when it was written and silently
// incomplete the moment another is added.
//
// It has already happened once: 20260827000008 added created_by_email AFTER
// 20260827000007 wrote the list, so a relabel could rewrite a version's author
// and nothing would have failed. 20260827000009 exists only to fix that, and
// its own comment names the shape.
//
// Round 38 then added revision_number, which is worth more to an attacker of
// the invariant than the author was: a relabel able to move it could point an
// approval at a revision whose payload the version does not hold, which is the
// whole guarantee. It was added to the guard in the same migration.
//
// TWICE IS A CLASS. This test turns "remember to update the guard" into a
// failing build: every column is either GUARDED or in the small exempt set that
// the relabel legitimately writes, and a new column is in neither until someone
// decides which.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const DIR = 'supabase/migrations'

function migrations() {
  return readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith('.sql')).sort()
}

/** Every column deal_sheet_versions has ever been given, in migration order. */
function declaredColumns() {
  const cols = new Set()
  for (const file of migrations()) {
    const sql = readCode(join(ROOT, DIR, file))

    const create = sql.match(/create table if not exists public\.deal_sheet_versions\s*\(([\s\S]*?)\n\);/)
    if (create) {
      for (const line of create[1].split('\n')) {
        const m = line.match(/^\s{2}([a-z_]+)\s+[a-z]/)
        // Table-level constraints start with `constraint` or `unique`, and the
        // column pattern would otherwise swallow them.
        if (m && !['constraint', 'unique', 'primary', 'check', 'foreign'].includes(m[1])) cols.add(m[1])
      }
    }
    for (const m of sql.matchAll(/alter table public\.deal_sheet_versions\s+add column (?:if not exists )?([a-z_]+)/g)) {
      cols.add(m[1])
    }
  }
  return cols
}

/** The column list inside the LATEST definition of the guard function. */
function guardedColumns() {
  let latest = null
  for (const file of migrations()) {
    const sql = readCode(join(ROOT, DIR, file))
    if (/create or replace function public\.deal_sheet_versions_immutable\(\)/.test(sql)) latest = sql
  }
  assert.ok(latest, 'no definition of deal_sheet_versions_immutable() found, so this scan measures nothing')
  const guarded = new Set()
  for (const m of latest.matchAll(/NEW\.([a-z_]+)\s+is distinct from OLD\.\1/g)) guarded.add(m[1])
  return guarded
}

// What the relabel legitimately writes, each with the reason it is exempt.
// Adding a column here is a decision; forgetting one is a failure.
const EXEMPT = {
  id: 'the primary key. Not written by the relabel and not writable at all.',
  status: 'the relabel IS the status change.',
  major: 'the relabel renumbers. The trigger constrains it to OLD.major + 1 separately.',
  minor: 'the relabel renumbers. The trigger constrains it to 0 separately.',
  issued_by: 'null on a draft, set by the relabel. That is the transition.',
  issued_at: 'null on a draft, set by the relabel.',
  issued_by_email: 'null on a draft, set by the relabel.',
}

test('every deal_sheet_versions column is guarded or explicitly exempt', () => {
  const declared = declaredColumns()
  const guarded = guardedColumns()
  assert.ok(declared.size > 5, `only ${declared.size} columns found, so this scan is measuring nothing`)

  const unaccounted = [...declared].filter((c) => !guarded.has(c) && !(c in EXEMPT)).sort()
  assert.deepEqual(unaccounted, [],
    'these columns can be rewritten by the draft-to-issued relabel and nothing checks them.\n' +
    'Add each to the guard in a migration, or to EXEMPT here with the reason:\n  ' + unaccounted.join('\n  '))
})

test('the column named in this round is guarded, not exempt', () => {
  // The specific claim, stated separately so a future edit that quietly moved
  // revision_number into EXEMPT would fail rather than pass.
  assert.ok(guardedColumns().has('revision_number'),
    'a relabel able to move revision_number could point an approval at a revision '
    + 'whose payload the version does not hold')
})

test('the scan can SEE an unguarded column', () => {
  // Calibration against the real history. created_by_email was genuinely
  // unguarded for one migration; both it and revision_number are guarded now,
  // so the discriminating check is that a name in NEITHER set is reported.
  const declared = declaredColumns()
  const guarded = guardedColumns()
  assert.ok(declared.has('created_by_email') && guarded.has('created_by_email'),
    'the historically-missed column should now be found in both sets')

  const pretend = new Set([...declared, 'a_column_nobody_guarded'])
  const unaccounted = [...pretend].filter((c) => !guarded.has(c) && !(c in EXEMPT))
  assert.deepEqual(unaccounted, ['a_column_nobody_guarded'],
    'an unguarded, unexempt column must be reported')
})

test('every exempt column is real, so the exemption list cannot rot', () => {
  // An EXEMPT entry naming a column that no longer exists is a stale claim, and
  // a stale claim in an allowlist reads exactly like a considered decision.
  const declared = declaredColumns()
  const ghosts = Object.keys(EXEMPT).filter((c) => !declared.has(c))
  assert.deepEqual(ghosts, [], 'these exempt columns do not exist: ' + ghosts.join(', '))
})
