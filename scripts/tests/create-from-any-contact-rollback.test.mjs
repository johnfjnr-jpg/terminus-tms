// The CREATE_FROM_ANY_CONTACT rollback restores 20260908000003's
// create_opportunity_from_contact byte for byte (R2, the TERM_QUOTES M3
// method). Pure: reads files, touches no database.
//
// Three claims:
//   1. every restored definition is its source's text, exactly, and the comment
//      is WHOLE (R2: the Phase 0 draft truncated it at a ";" inside the string);
//   2. the rollback is exactly the generator's output, so nothing around those
//      definitions was edited by hand;
//   3. the migration it undoes changes exactly the two things R1 approved, so
//      the restore is restoring the right difference.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCKS, ROLLBACK_PATH, MIGRATION, extractBlocks, renderRollback } from '../gen-create-from-any-contact-rollback.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const rollback = read(ROLLBACK_PATH)
const migration = read(`supabase/migrations/${MIGRATION}_create_opportunity_from_any_visible_contact.sql`)
const count = (hay, needle) => hay.split(needle).length - 1
// SQL line comments removed, so a sentence ABOUT a statement cannot stand in
// for the statement (Verification 39). Applied to whole lines only.
const code = (sql) => sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
const plpgsqlCode = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

test('every restored definition is its source migration\'s text, byte for byte', () => {
  const blocks = extractBlocks()
  for (const [name, spec] of Object.entries(BLOCKS)) {
    const block = blocks[name]
    assert.ok(block.length > spec.start.length, `${name}: the slice is not empty`)
    assert.equal(count(read(spec.source), block), 1, `${name}: the slice is in ${spec.source} exactly once`)
    assert.equal(count(rollback, block), 1, `${name}: the rollback carries it exactly once, unaltered`)
  }
})

test('R2: the restored comment is the WHOLE literal, not cut at the ";" inside it', () => {
  const comment = extractBlocks().COMMENT
  assert.ok(comment.includes("'caller must OWN the source Contact; a non-owner is refused 42501.';"),
    'the comment ends with the source\'s whole last sentence and its closing quote')
  // Every single quote is paired: an unterminated literal has an odd count.
  assert.equal(count(comment, "'") % 2, 0, 'the comment\'s quotes are balanced')
})

test('the rollback is exactly what the generator produces from the source today', () => {
  assert.equal(rollback, renderRollback(),
    `${ROLLBACK_PATH} differs from the generator's output: it was edited by hand, or the source moved. Regenerate it`)
})

test('one transaction; the ledger row removed; the schema reload last', () => {
  const c = code(rollback)
  assert.ok(c.indexOf('\nbegin;\n') >= 0 && c.indexOf('\nbegin;\n') < c.indexOf('create or replace function'), 'opens its own transaction first')
  assert.match(c, /delete from supabase_migrations\.schema_migrations where version = '20261122000001';/)
  assert.match(c, /notify pgrst, 'reload schema';\s*commit;\s*$/)
  assert.equal(count(c, 'commit;'), 1)
})

test('R1: the migration changes exactly the owner check and the contact-keyed audit row, nothing else', () => {
  const fnOf = (sql) => {
    const at = sql.indexOf('create or replace function public.create_opportunity_from_contact(')
    assert.ok(at >= 0)
    return plpgsqlCode(sql.slice(at, sql.indexOf('\n$$;', at)))
  }
  const before = fnOf(read(BLOCKS.FUNCTION.source))
  const after = fnOf(migration)
  // The two removals are there before and gone after.
  assert.match(before, /if v_contact\.owner_id is distinct from auth\.uid\(\) then/)
  assert.doesNotMatch(after, /owner_id is distinct from/)
  assert.match(before, /\(p_contact_id, 'contact', 'created_opportunity'/)
  assert.doesNotMatch(after, /'created_opportunity'/)
  // Everything else is the same code: remove the two removals from BEFORE and
  // the comparison is exact, whitespace aside.
  const norm = (s) => s.replace(/\s+/g, ' ').trim()
  const beforeLessTwo = before
    .replace(/if v_contact\.owner_id is distinct from auth\.uid\(\) then[\s\S]*?end if;/, '')
    .replace(/\(p_contact_id, 'contact', 'created_opportunity', v_actor,\s*jsonb_build_object\('opportunity_id', v_opp\.id\)\),/, '')
  assert.equal(norm(after), norm(beforeLessTwo))
  for (const k of ['security invoker', 'set search_path = public']) assert.ok(after.includes(k), k)
  assert.equal(count(code(migration), 'grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;'), 1)
  assert.doesNotMatch(code(migration), /schema_migrations/, 'no self-recording ledger row (Architecture 10 as corrected)')
})
