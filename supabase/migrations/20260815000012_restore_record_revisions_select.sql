-- Reverts 20260815000011 - temporary block used to prove
-- PATCH /opportunities/:id's newly-added error check catches a real
-- fetch failure (confirmed: 500 "permission denied for table
-- record_revisions", zero data loss - verified by direct query before
-- this migration ran). Restoring exactly what was revoked, SELECT only.
grant select on public.record_revisions to authenticated;
