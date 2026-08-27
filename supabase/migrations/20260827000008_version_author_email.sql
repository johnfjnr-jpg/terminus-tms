-- Terminus TMS: the author on a Deal Sheet version, readable. Round 37 Phase 4.
--
-- created_by and issued_by are uuids referencing auth.users, which the client
-- cannot resolve: the auth schema is not exposed through PostgREST, so a list
-- rendered from those columns can show a version's number, status, reason and
-- timestamp and not who took it.
--
-- "A version nobody can find is a version nobody can restore", and an author is
-- half of finding one during a bid review.
--
-- STORED AS TEXT BESIDE THE UUID, which is the convention this codebase already
-- uses for exactly this problem: assessment entries and the Notes History both
-- write `by: request.user.email` at the moment of the write. The uuid stays as
-- the referential truth and the email is what a person reads. It is a snapshot
-- of the address at the time, deliberately: a version records who took it then,
-- not who that account belongs to now.
alter table public.deal_sheet_versions
  add column if not exists created_by_email text;

alter table public.deal_sheet_versions
  add column if not exists issued_by_email text;

comment on column public.deal_sheet_versions.created_by_email is
  'The author''s email as it was at the moment the version was taken. Held '
  'beside created_by because auth.users is not readable from the client. A '
  'snapshot, not a live lookup: this records who took the version then.';
