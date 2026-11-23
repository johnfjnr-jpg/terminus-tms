-- ROLLBACK of 20261123000001_record_revisions_name_trigram_index.sql
--
-- Drops the index. No row depends on it and no data changes: every filter
-- that used it falls back to the whole-table scan it ran before.
--
-- THE EXTENSION IS DROPPED ONLY IF THIS MIGRATION CREATED IT. The pre-apply
-- check below records whether pg_trgm existed before the apply. If it did,
-- leave the second statement out. `drop extension` carries no CASCADE, so
-- if anything else has come to depend on pg_trgm it refuses rather than
-- removing that dependant.
--
--   pre-apply check, run BEFORE the migration and keep the answer:
--   select n.nspname from pg_extension e
--     join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
--   (no row: the migration creates it, so the rollback drops it)
--
-- Not parse-checked (Build discipline 14). Pasted as one file into the SQL
-- Editor; one transaction.

begin;

drop index if exists public.record_revisions_payload_name_trgm_idx;

-- Only if the pre-apply check returned no row:
drop extension if exists pg_trgm;

delete from supabase_migrations.schema_migrations where version = '20261123000001';

commit;
