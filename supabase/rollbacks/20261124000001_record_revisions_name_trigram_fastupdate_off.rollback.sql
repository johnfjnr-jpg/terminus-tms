-- ROLLBACK of 20261124000001_record_revisions_name_trigram_fastupdate_off.sql
--
-- Returns fastupdate to its default (on) and removes the ledger row. No row
-- changes. The flush cannot be undone and needs no undoing: the entries it
-- moved are in the main index, where a search finds them either way.
--
-- Not parse-checked (Build discipline 14). Pasted as one file into the SQL
-- Editor; one transaction.

begin;

alter index public.record_revisions_payload_name_trgm_idx reset (fastupdate);

delete from supabase_migrations.schema_migrations where version = '20261124000001';

commit;
