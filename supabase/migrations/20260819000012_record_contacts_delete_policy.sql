-- Terminus TMS: a DELETE policy for record_contacts. Round 11 Phase 5,
-- 2026-08-19. Written idempotently per Architecture rule 7.
--
-- FOUND BY A DEFECT I WROTE, and the shape is one this project has recorded
-- repeatedly. record_contacts has carried SELECT and INSERT policies since
-- Milestone 3 and NO DELETE POLICY AT ALL, so a delete through a user client
-- is filtered by RLS to zero affected rows and returns NO ERROR. Two things
-- in Phase 5 relied on a delete succeeding:
--
--   1. PATCH /test-beds/:id/installer clears a Tech Team link that belonged
--      to the previous Installer's Account. It checked the delete's `error`,
--      which was null, and reported `cleared_tech_team` on that basis. The
--      link was still there.
--   2. POST /test-beds/:id/tech-team replaces an existing link by deleting
--      then inserting. The delete removed nothing, so links ACCUMULATED, and
--      two rows for the same (record_id, role) then made the
--      contact_role_linked branch's own .maybeSingle() return an error,
--      turning a working gate into a 500.
--
-- Both are the recorded unchecked-write shape: "a non-owner's update() is
-- filtered by RLS to zero affected rows rather than erroring", now confirmed
-- to apply to DELETE and to a case where the caller IS the owner but no
-- policy exists to permit the operation at all. The endpoints now check
-- affected rows rather than `error` alone; this migration gives them
-- something to affect.
--
-- Scoped exactly like the INSERT policy: the actor must own the parent
-- record. Deliberately not permitting deletion of a link on someone else's
-- record, and deliberately not keyed on created_by, since a record's owner
-- must be able to correct a link somebody else created on their record.
drop policy if exists "record_contacts_delete" on public.record_contacts;
create policy "record_contacts_delete" on public.record_contacts
  for delete using (
    auth.uid() = (select owner_id from public.records where id = record_id)
  );
