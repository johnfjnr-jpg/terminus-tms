#!/usr/bin/env node
// Generates the ONE self-contained rollback for
// supabase/migrations/20261120000001_term_quotes_versions_carry_a_kind.sql
// (TERM_QUOTES migration review, round 1, M3).
//
//   node scripts/gen-term-quotes-rollback.mjs           write the rollback file
//   node scripts/gen-term-quotes-rollback.mjs --check   exit 1 if it is stale
//
// The rollback is a TRACKED file, so a regeneration that lands it directly is
// an edit the journal guard has no entry for and the commit is refused. Route
// it through scripts/edit.mjs (whole old file as the anchor, the rendered text
// as the replacement), then run --check.
//
// WHY GENERATED. The rollback must put back definitions that live in earlier
// migrations, and it must be pasteable into the SQL Editor as one file, so it
// has to CARRY them. A copy typed by hand is a second reader that drifts
// (Verification 20); a copy SLICED from the source at generation time, and
// asserted byte-identical by scripts/tests/term-quotes-rollback.test.mjs, is
// the source.
//
// The slicer RAISES on an anchor it cannot find, or finds more than once,
// rather than returning a shorter file (Verification 12, the author's side).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const ROLLBACK_PATH = 'supabase/rollbacks/20261120000001_term_quotes_versions_carry_a_kind.rollback.sql'

// Each restored definition: the file it comes from, the text it begins with
// (which must occur exactly once there), and the text it ends with (the first
// occurrence after the start, included).
export const BLOCKS = {
  IMMUTABLE: {
    source: 'supabase/migrations/20261117000002_versions_freeze_their_figures.sql',
    start: 'create or replace function public.deal_sheet_versions_immutable()',
    end: '\n$$;',
  },
  INSERT_FN: {
    source: 'supabase/migrations/20260829000002_atomic_version_insert.sql',
    start: 'create or replace function public.insert_deal_sheet_version(',
    end: '\n$$;',
  },
  INSERT_COMMENT: {
    source: 'supabase/migrations/20260829000002_atomic_version_insert.sql',
    start: 'comment on function public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text) is',
    end: "';",
  },
  COST_BASIS: {
    source: 'supabase/migrations/20260829000007_cost_basis_moves_to_the_rates_column.sql',
    start: 'add constraint deal_sheet_versions_rates_have_cost_basis',
    end: 'not valid',
  },
}

export function slice(text, { start, end }, what) {
  const at = text.indexOf(start)
  if (at < 0) throw new Error(`${what}: start anchor not found`)
  if (text.indexOf(start, at + 1) >= 0) throw new Error(`${what}: start anchor occurs more than once`)
  const stop = text.indexOf(end, at + start.length)
  if (stop < 0) throw new Error(`${what}: end anchor not found after the start`)
  return text.slice(at, stop + end.length)
}

export function extractBlocks(read = (p) => readFileSync(join(ROOT, p), 'utf8')) {
  const out = {}
  for (const [name, spec] of Object.entries(BLOCKS)) out[name] = slice(read(spec.source), spec, name)
  return out
}

const TEN = 'public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text, text)'
const NINE = 'public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text)'

// ── D3 (John 2026-11-20): THE REFUSAL IS ABOUT LIVE RECORDS ─────────────
//
// Dropping kind relabels every term_quote row Commercials. On a LIVE record
// that misprices a real deal, so the rollback refuses. On a soft-deleted
// fixture record (a probe's, torn down by design) nothing reads it, so the
// rollback proceeds and says, before anything is dropped, how many it will
// relabel. Correlated EXISTS rather than a join: no FROM item to scope wrongly
// (build discipline 14(a)). ONE text, used by the rollback and by the
// calibration scripts below, so the calibration runs the rollback's own block.
export const REFUSAL_BLOCK = `do $$
declare
  v_live integer;
  v_fixture integer;
begin
  select count(*) into v_live from public.deal_sheet_versions v
   where v.kind = 'term_quote'
     and exists (select 1 from public.records r where r.id = v.record_id and r.deleted_at is null);
  if v_live > 0 then
    raise exception 'rollback refused: % term_quote version(s) on live records exist; dropping kind would relabel them Commercials',
      v_live;
  end if;
  select count(*) into v_fixture from public.deal_sheet_versions v
   where v.kind = 'term_quote'
     and exists (select 1 from public.records r where r.id = v.record_id and r.deleted_at is not null);
  raise notice 'rollback: % term_quote version(s) on soft-deleted fixture records will be relabelled Commercials when kind is dropped',
    v_fixture;
end $$;`

/**
 * D3's calibration, for running in the SQL Editor (this session has no
 * Postgres). Both scripts end in ROLLBACK, so nothing they do survives:
 *   live:    one fixture record with a term_quote version is made live inside
 *            the transaction, then the rollback's own refusal block runs; it
 *            must raise "rollback refused: 1".
 *   fixture: the WHOLE rollback with its commit replaced by rollback; it must
 *            print the NOTICE and reach its last statement.
 */
export function renderCalibration(b = extractBlocks()) {
  const live = `-- D3 CALIBRATION 1 OF 2: a live term row REFUSES. Run whole; it ends in rollback.
begin;
update public.records set deleted_at = null
 where id = (select v.record_id from public.deal_sheet_versions v where v.kind = 'term_quote' order by v.created_at limit 1);
${REFUSAL_BLOCK}
-- EXPECTED: ERROR  rollback refused: 1 term_quote version(s) on live records exist; ...
rollback;
`
  const full = renderRollback(b)
  const tail = "notify pgrst, 'reload schema';\n\ncommit;\n"
  if (!full.endsWith(tail)) throw new Error('calibration: the rollback no longer ends as expected')
  const fixture = `-- D3 CALIBRATION 2 OF 2: a fixture-only population PROCEEDS. The whole rollback,
-- ending in ROLLBACK instead of COMMIT, so the schema is unchanged afterwards.
-- EXPECTED: NOTICE  rollback: N term_quote version(s) on soft-deleted fixture records ...
-- and no error before the final rollback.
` + full.slice(0, full.length - tail.length) + 'rollback;\n'
  return { live, fixture }
}

export function renderRollback(b = extractBlocks()) {
  return `-- ROLLBACK for supabase/migrations/20261120000001_term_quotes_versions_carry_a_kind.sql.
-- GENERATED by scripts/gen-term-quotes-rollback.mjs. DO NOT EDIT BY HAND:
-- scripts/tests/term-quotes-rollback.test.mjs fails if this file differs from
-- what the generator produces from the source migrations today.
--
-- ONE SELF-CONTAINED FILE (review M3): paste the whole of it into the Supabase
-- SQL Editor and run it once. It opens and commits its own transaction, and it
-- deletes the ledger row itself (a rollback has no CLI path, so the reason
-- Architecture 10 keeps the ledger row out of a migration does not arise).
-- Not a migration: outside supabase/migrations so the CLI never applies it.
-- Run it together with a revert of the TERM_QUOTES code, because the version
-- route writes kind and every reader branches on it. Not parse-checked
-- (CLAUDE.md build discipline 14).
--
-- IT REFUSES IF ANY term_quote VERSION EXISTS ON A LIVE RECORD. Dropping the
-- column would leave such a row looking like a Commercials version, with no
-- rates.rates for calculateDeal to price from: every reader would misprice it
-- and nothing would say so. Decide what happens to those rows first. Rows on
-- soft-deleted (fixture) records are relabelled, and a NOTICE counts them
-- before anything is dropped (John's D3, 2026-11-20).
--
-- The three restored definitions below are SLICED VERBATIM from:
--   ${BLOCKS.IMMUTABLE.source}
--   ${BLOCKS.INSERT_FN.source} (the function and its comment)
--   ${BLOCKS.COST_BASIS.source} (the constraint)
--
-- The insert function's privileges are carried the way the migration carried
-- them: captured from the ten-argument form before it goes, and the rollback
-- RAISES unless the restored nine-argument form's owner and ACL are identical.
-- No GRANT or REVOKE is restated because the source has none.

begin;

${REFUSAL_BLOCK}

-- ── 5. THE CLOSED WON TRIGGER ────────────────────────────────────────────

drop trigger if exists deal_sheet_versions_closed_won_trg on public.deal_sheet_versions;
drop function if exists public.deal_sheet_versions_closed_won();

-- ── 3. THE IMMUTABILITY GUARD, AS ${BLOCKS.IMMUTABLE.source.split('/').pop()} LEFT IT ──

${b.IMMUTABLE}

-- ── 4. THE INSERT FUNCTION, NINE ARGUMENTS, AS ${BLOCKS.INSERT_FN.source.split('/').pop()} LEFT IT ──
--
-- Created beside the ten-argument form, which is then dropped, so for the
-- length of this transaction both exist, which no caller can observe.

drop table if exists pg_temp.tq_insert_fn_privileges;
create temp table tq_insert_fn_privileges as
  select p.proowner::regrole::text as owner,
         array(select a::text from unnest(coalesce(p.proacl, '{}'::aclitem[])) a order by 1) as acl,
         p.proacl is null as acl_is_default
    from pg_proc p
   where p.oid = coalesce(
           to_regprocedure('${TEN}'),
           to_regprocedure('${NINE}'));

do $$
begin
  if (select count(*) from tq_insert_fn_privileges) <> 1 then
    raise exception 'rollback: no insert_deal_sheet_version to carry privileges from';
  end if;
end $$;

${b.INSERT_FN}

${b.INSERT_COMMENT}

do $$
declare
  v_old tq_insert_fn_privileges;
  v_new_owner text;
  v_new_acl text[];
  v_new_default boolean;
begin
  select * into v_old from tq_insert_fn_privileges;
  select p.proowner::regrole::text,
         array(select a::text from unnest(coalesce(p.proacl, '{}'::aclitem[])) a order by 1),
         p.proacl is null
    into v_new_owner, v_new_acl, v_new_default
    from pg_proc p
   where p.oid = '${NINE}'::regprocedure;
  if v_new_owner is distinct from v_old.owner
  or v_new_acl is distinct from v_old.acl
  or v_new_default is distinct from v_old.acl_is_default then
    raise exception 'insert_deal_sheet_version privileges changed across the rollback: owner % -> %, acl % -> %. Nothing rolled back.',
      v_old.owner, v_new_owner, v_old.acl, v_new_acl;
  end if;
end $$;

drop table tq_insert_fn_privileges;

drop function if exists ${TEN};

-- ── 2. THE COST BASIS, AS ${BLOCKS.COST_BASIS.source.split('/').pop()} LEFT IT ──

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_rates_have_cost_basis;
alter table public.deal_sheet_versions
      ${b.COST_BASIS};

-- ── 1. THE KIND. AFTER 2 AND 3, WHICH REFERENCED IT ──────────────────────

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_kind_known;
alter table public.deal_sheet_versions drop column if exists kind;

-- ── THE LEDGER ROW ───────────────────────────────────────────────────────

delete from supabase_migrations.schema_migrations where version = '20261120000001';

-- ── POSTGREST ────────────────────────────────────────────────────────────
-- The insert function's signature changed back. Delivered at commit.

notify pgrst, 'reload schema';

commit;
`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = renderRollback()
  const path = join(ROOT, ROLLBACK_PATH)
  const calAt = process.argv.indexOf('--calibration')
  if (calAt >= 0) {
    const dir = process.argv[calAt + 1]
    if (!dir) { console.error('--calibration needs a directory'); process.exit(1) }
    const { live, fixture } = renderCalibration()
    writeFileSync(join(dir, 'd3-calibration-1-live-refuses.sql'), live)
    writeFileSync(join(dir, 'd3-calibration-2-fixture-proceeds.sql'), fixture)
    console.log(`wrote the two D3 calibration scripts to ${dir}`)
    process.exit(0)
  }
  if (process.argv.includes('--check')) {
    const now = readFileSync(path, 'utf8')
    if (now !== text) { console.error(`${ROLLBACK_PATH} is stale: regenerate it`); process.exit(1) }
    console.log(`${ROLLBACK_PATH} is current (${Buffer.byteLength(text)} bytes)`)
  } else {
    writeFileSync(path, text)
    const back = readFileSync(path, 'utf8')
    if (back !== text) { console.error('written file does not read back identical'); process.exit(1) }
    console.log(`wrote ${ROLLBACK_PATH} (${Buffer.byteLength(text)} bytes)`)
  }
}
