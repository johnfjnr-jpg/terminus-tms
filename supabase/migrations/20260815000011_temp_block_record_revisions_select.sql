-- TEMPORARY, for real-failure-path testing only (2026-08-15, Milestone 6)
-- - reverted by the very next migration in this same session. Same
-- mechanism and purpose as 20260815000009/10 (Milestone 5): revokes the
-- authenticated role's table-level SELECT grant on record_revisions so
-- a user-scoped client's query fails with a real Postgres permission
-- error, without touching RLS or affecting supabaseAdmin. Purpose this
-- time: prove PATCH /opportunities/:id's newly-added revRowErr check
-- actually catches a real fetch failure, same standard as Milestone 5.
revoke select on public.record_revisions from authenticated;
