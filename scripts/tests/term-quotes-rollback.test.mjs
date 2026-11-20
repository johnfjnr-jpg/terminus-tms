// The TERM_QUOTES rollback is one self-contained file, and the definitions it
// restores are the source migrations' own text, byte for byte (TERM_QUOTES
// migration review, round 1, M3). Pure: reads files, touches no database.
//
// Two claims, and the second is the one a hand edit breaks:
//   1. every restored definition appears in the rollback EXACTLY as it stands
//      in its source migration today;
//   2. the rollback is exactly what the generator produces, so nothing was
//      added, removed or edited around those definitions by hand.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCKS, ROLLBACK_PATH, extractBlocks, renderRollback, slice } from '../gen-term-quotes-rollback.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const rollback = read(ROLLBACK_PATH)
const count = (hay, needle) => hay.split(needle).length - 1

// SQL line comments removed, so a sentence ABOUT a statement cannot stand in
// for the statement (Verification 39). The template's own statements carry no
// "--" inside a string.
const code = (sql) => sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')

test('every restored definition is its source migration\'s text, byte for byte', () => {
  const blocks = extractBlocks()
  for (const [name, spec] of Object.entries(BLOCKS)) {
    const src = read(spec.source)
    const block = blocks[name]
    assert.ok(block.length > spec.start.length + spec.end.length, `${name}: the slice is not empty`)
    assert.ok(block.startsWith(spec.start) && block.endsWith(spec.end), `${name}: the slice runs anchor to anchor`)
    assert.equal(count(src, block), 1, `${name}: the slice is in ${spec.source} exactly once`)
    assert.equal(count(rollback, block), 1, `${name}: the rollback carries ${spec.source}'s text exactly once, unaltered`)
  }
})

test('the rollback is exactly what the generator produces from the sources today', () => {
  assert.equal(rollback, renderRollback(),
    `${ROLLBACK_PATH} differs from the generator's output: it was edited by hand, or a source moved. Regenerate it`)
})

test('the slicer raises rather than returning less (Verification 12)', () => {
  assert.throws(() => slice('abc', { start: 'zz', end: 'c' }, 'x'), /start anchor not found/)
  assert.throws(() => slice('ab ab c', { start: 'ab', end: 'c' }, 'x'), /more than once/)
  assert.throws(() => slice('ab', { start: 'a', end: 'zz' }, 'x'), /end anchor not found/)
  assert.equal(slice('xx ab yy c zz c', { start: 'ab', end: 'c' }, 'x'), 'ab yy c')
})

test('one transaction, the term_quote refusal first, the schema reload last', () => {
  const c = code(rollback)
  const begin = c.indexOf('\nbegin;\n')
  const refusal = c.indexOf("raise exception 'rollback refused:")
  const notice = c.indexOf("raise notice 'rollback: %")
  const firstDrop = c.indexOf('\ndrop ')
  assert.ok(begin >= 0, 'opens its own transaction')
  assert.ok(refusal > begin && refusal < firstDrop, 'refuses on a term_quote row before it drops anything')
  // D3 (John 2026-11-20): the refusal counts term rows on LIVE records only,
  // and the fixture rows it will relabel are counted aloud before any drop.
  const block = c.slice(begin, firstDrop)
  assert.match(block, /if v_live > 0 then\s+raise exception 'rollback refused:/, 'the refusal is the live count\'s')
  assert.match(block, /select count\(\*\) into v_live[\s\S]*?r\.deleted_at is null\);/, 'the live count is scoped to live records')
  assert.match(block, /select count\(\*\) into v_fixture[\s\S]*?r\.deleted_at is not null\);/, 'the fixture count is scoped to soft-deleted records')
  assert.ok(notice > refusal && notice < firstDrop, 'the NOTICE comes after the refusal and before anything is dropped')
  assert.match(c, /notify pgrst, 'reload schema';\s*commit;\s*$/, 'ends with the schema reload, then commit')
  assert.equal(count(c, 'commit;'), 1, 'one commit')
  assert.match(c, /delete from supabase_migrations\.schema_migrations where version = '20261120000001';/, 'removes its ledger row')
})

test('the insert function\'s privileges are asserted equal across the rollback', () => {
  const c = code(rollback)
  assert.match(c, /create temp table tq_insert_fn_privileges as/)
  assert.match(c, /privileges changed across the rollback/)
  const assertAt = c.indexOf('privileges changed across the rollback')
  const dropTen = c.indexOf('drop function if exists public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text, text);')
  assert.ok(dropTen > assertAt, 'the ten-argument form is dropped only after the restored form\'s privileges are checked')
})
