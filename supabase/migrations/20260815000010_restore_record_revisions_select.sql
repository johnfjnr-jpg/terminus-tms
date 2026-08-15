-- Reverts 20260815000009 - that migration was a temporary, deliberate
-- block used to prove PATCH /test-beds/:id's newly-added error check
-- actually catches a real fetch failure (confirmed: 500 "permission
-- denied for table record_revisions", zero data loss - the fixed
-- record's single revision was untouched, verified by direct query
-- before this migration ran). Restoring exactly what was revoked, SELECT
-- only - not widening the grant beyond its prior state.
grant select on public.record_revisions to authenticated;
