-- Terminus TMS: a trigram index on record_revisions (payload->>'name').
--
-- F5_TEARDOWN_SCALE, ruling D3 REVERSED by John 2026-11-23: the index comes in.
--
-- WHY. Nothing indexes payload->>'name', so every tag filter on
-- record_revisions is a whole-table scan: tearDown's tag branch
-- (scripts/fixtures.mjs), the page-cap test's own enumeration, and the
-- create-from-any-contact probe's teardown scan. John measured the P1
-- statement in the SQL Editor at 4,054ms (parallel seq scan, all shared
-- hits) against the 8s statement_timeout the authenticator role carries,
-- which service_role requests through PostgREST inherit. A 60-term
-- whole-table count through PostgREST was cancelled at 8,296ms wall
-- (code 57014), so that 8s is the bound in force.
--
-- WHAT IT CHANGES. Nothing the filters say. A GIN index with gin_trgm_ops
-- serves LIKE and ILIKE on the indexed expression for any pattern holding at
-- least one trigram, prefix patterns included, so `payload->>name.ilike.tag%`
-- and `.like('payload->>name', 'tag %')` use it as written. The expression
-- below is the one PostgREST emits for `payload->>name`:
-- ("payload" ->> 'name'::text).
--
-- THE EXTENSION. pg_trgm is created in the `extensions` schema if absent.
-- If it is already installed in ANOTHER schema, `create extension if not
-- exists` would do nothing and `extensions.gin_trgm_ops` would not resolve,
-- so the DO block refuses first, by name, rather than failing on an opclass
-- lookup. Moving an installed extension is not this file's business.
--
-- THE LOCK. Plain CREATE INDEX, not CONCURRENTLY: CONCURRENTLY cannot run
-- inside a transaction block, and both the SQL Editor's multi-statement run
-- and `supabase db push` use one. Plain CREATE INDEX holds a SHARE lock on
-- record_revisions for the build, which blocks INSERTs (every record write
-- appends a revision) and lets reads through. Apply it when nothing writes.
--
-- Idempotent (Architecture 7): `if not exists` on both statements.
-- Not parse-checked: this session reaches Postgres only through PostgREST
-- (Build discipline 14). No self-recording ledger row (Architecture 10 as
-- corrected); record it separately after a by-hand apply.
-- Rollback: supabase/rollbacks/20261123000001_record_revisions_name_trigram_index.rollback.sql

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if v_schema is not null and v_schema <> 'extensions' then
    raise exception 'pg_trgm is installed in schema %, not extensions; this migration names extensions.gin_trgm_ops and stops rather than guess', v_schema;
  end if;
end
$$;

create extension if not exists pg_trgm with schema extensions;

create index if not exists record_revisions_payload_name_trgm_idx
  on public.record_revisions
  using gin ((payload ->> 'name') extensions.gin_trgm_ops);

-- Statistics on the new indexed expression, so the planner's estimate for a
-- tag filter comes from data rather than a default selectivity. ANALYZE is
-- legal inside a transaction block (VACUUM is not) and changes no row.
analyze public.record_revisions;
