-- TEMPORARY, for real-failure-path testing only (2026-08-15) - reverted
-- by the very next migration in this same session. Revokes the
-- authenticated role's table-level SELECT grant on record_revisions, so
-- any user-scoped client's query against it fails with a real Postgres
-- permission error, without touching RLS policies and without affecting
-- supabaseAdmin (service_role has its own grants, unaffected by this).
-- Purpose: prove PATCH /test-beds/:id's newly-added revRowErr check
-- actually catches a real fetch failure and rejects the save, rather
-- than trusting the code by inspection alone.
revoke select on public.record_revisions from authenticated;
