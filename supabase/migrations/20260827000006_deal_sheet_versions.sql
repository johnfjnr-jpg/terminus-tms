-- Terminus TMS: Deal Sheet versions. Round 37 Phase 3.
--
-- The artefact reviewed before a proposal is issued, saved deliberately, with
-- the reasoning that produced it.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT THE BUSINESS DECIDED, AND WHAT EACH DECISION COSTS HERE
-- ─────────────────────────────────────────────────────────────
--
-- MANUAL SAVE. Nothing here is written by a background path. record_revisions
-- already records every save automatically, and Round 37 Phase 0 established
-- that a version marked on top of that mechanism would inherit exactly the
-- automatic creation the business rejected. So this is its own table.
--
-- A REASON IS REQUIRED ON EVERY VERSION, enforced by a NOT NULL plus a length
-- CHECK rather than by the route alone. Their words: "the thinking about why
-- things have been adjusted is important." A diff between two number sets shows
-- what moved and cannot show why, and the why is what a bid review reads.
--
-- V0.1, V0.2 DURING DEVELOPMENT, V1 ON FIRST ISSUE. major = 0 means nothing has
-- been issued, which is why major is not defaulted to 1 and why the pair is
-- stored as two integers rather than a formatted string: "V0.10" sorts before
-- "V0.9" as text and after it as numbers, and the number is what is true.
--
-- A DRAFT BECOMES THE ISSUED VERSION. Issuing V0.4 relabels that row to V1, it
-- does not copy it to a new one, because a copy leaves two records of one fact.
-- That is why status lives on the row and issuing is an UPDATE.
--
-- ─────────────────────────────────────────────────────────────
-- A VERSION IS THE DEAL'S INPUTS PLUS THE BATCH, NOT A POINTER AT ONE
-- ─────────────────────────────────────────────────────────────
--
-- Established in Round 36 Phase 0 and recorded in DESIGN_PRINCIPLES.md: batches
-- carry the four catalog costs, the deal carries margins, warranty, currency
-- and contingency, and the same batch under different margins produces a
-- different price. A version pointing only at a batch is not reproducible.
--
-- So `inputs` holds the whole payload as jsonb, the same shape
-- record_revisions already uses, and it grows for free as tabs land. Round 37
-- Phase 2 measured what that currently covers: unit counts, per-line margins,
-- warranty percentage, both currencies, contingency, term, installation
-- responsibility, milestones, tax adjustments and payment structure. The only
-- input that exists nowhere is the separate-or-rolled-up warranty setting.
--
-- `rates` holds the resolved catalog figures AS THEY WERE READ, and batch_id
-- points at the row they came from. BOTH, deliberately. The pointer alone is
-- not enough because Round 37 Phase 0 measured that the table owner can still
-- edit a batch through the Supabase editor, RLS having no authority over the
-- owner; the values alone are not enough because then nothing records which
-- batch was used and the retracing the batches exist for is lost.
--
-- ─────────────────────────────────────────────────────────────
-- SECTIONS: WHAT EXISTED WHEN THE VERSION WAS TAKEN
-- ─────────────────────────────────────────────────────────────
--
-- Without this a V0.2 taken today and a V1 taken after Payment Terms lands are
-- indistinguishable in shape, and a reader of the older one cannot tell whether
-- the payment structure was blank or absent. That is the difference between an
-- incomplete record and a record of what was complete at the time.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT IMMUTABILITY MEANS HERE, AND WHAT IT IS ENFORCED BY
-- ─────────────────────────────────────────────────────────────
--
-- Round 36 Phase 1 left a blanket refusal policy on base_cost_batches unbuilt
-- because a policy on a table nothing points at proves nothing. This is the
-- round that creates the pointer, and it turns out the useful enforcement is
-- not a blanket USING (false) at all. Two things are enforced, and both are
-- verifiable only now:
--
--   1. AN ISSUED VERSION CANNOT BE CHANGED BY THE APPLICATION. The update
--      policy below is scoped `using (status = 'draft')`, so a draft is
--      editable and an issued row falls outside the policy and matches zero
--      rows. That is finer than USING (false), which would also have frozen
--      drafts, and it is the actual requirement.
--
--   2. A BATCH CANNOT BE DELETED WHILE A VERSION CITES IT. batch_id is a
--      foreign key with ON DELETE RESTRICT, which binds the TABLE OWNER too,
--      unlike every RLS policy in this schema. It is the first constraint in
--      this build that protects Base Cost Data from the Supabase editor, and
--      it exists only because there is now something pointing at it.
--
-- Neither stops an owner EDITING a batch in place. That is why `rates` stores
-- the resolved values beside the pointer.
--
-- There is no delete policy at all, for anyone: a version somebody chose to
-- take is the record that a decision was made, and drafts are superseded by the
-- next save rather than removed.

create table if not exists public.deal_sheet_versions (
  id           uuid        primary key default gen_random_uuid(),
  record_id    uuid        not null references public.records(id) on delete restrict,
  major        integer     not null check (major >= 0),
  minor        integer     not null check (minor >= 0),
  status       text        not null default 'draft' check (status in ('draft', 'issued')),
  reason       text        not null check (length(btrim(reason)) > 0),
  inputs       jsonb       not null default '{}',
  rates        jsonb       not null default '{}',
  sections     jsonb       not null default '[]',
  batch_id     uuid        references public.base_cost_batches(id) on delete restrict,
  created_by   uuid        not null references auth.users(id),
  created_at   timestamptz not null default now(),
  issued_by    uuid        references auth.users(id),
  issued_at    timestamptz,
  -- One version number per Opportunity. Without this two concurrent saves both
  -- read "latest is 0.3" and both write 0.4, and the numbering the business
  -- reads as a sequence quietly stops being one.
  unique (record_id, major, minor),
  -- An issued version records who issued it and when, or it is not evidence of
  -- anything. Enforced here rather than trusted to the route that sets it.
  constraint deal_sheet_versions_issued_complete check (
    (status = 'draft'  and issued_by is null and issued_at is null) or
    (status = 'issued' and issued_by is not null and issued_at is not null)
  )
);

comment on table public.deal_sheet_versions is
  'Deal Sheet versions: the artefact reviewed before a proposal is issued. '
  'Saved manually, never automatically, which is what separates this from '
  'record_revisions. A version is the deal inputs PLUS the resolved catalog '
  'rates PLUS a pointer at the batch they came from, because the same batch '
  'under different margins produces a different price. major = 0 means nothing '
  'has been issued yet.';

comment on column public.deal_sheet_versions.reason is
  'Why this version was taken and what changed. Required, and required in the '
  'schema rather than only in the route: a diff between two number sets shows '
  'what moved and cannot show why, and the why is what a bid review reads.';

comment on column public.deal_sheet_versions.sections is
  'Which sections of the Deal Sheet existed when this version was taken. '
  'Without it a version taken before a tab was built is indistinguishable from '
  'one taken after it where the operator left that tab blank.';

comment on column public.deal_sheet_versions.rates is
  'The catalog figures as they were resolved at capture. Held BESIDE batch_id, '
  'not instead of it: the pointer records which batch, and these record what it '
  'said, because the table owner can still edit a batch in place through the '
  'Supabase editor and RLS has no authority over the owner.';

alter table public.deal_sheet_versions enable row level security;

-- Team-wide read, matching every other record-scoped table in this schema.
drop policy if exists "deal_sheet_versions_select" on public.deal_sheet_versions;
create policy "deal_sheet_versions_select" on public.deal_sheet_versions
  for select using (auth.uid() is not null);

-- Insert as yourself, the same shape approvals and audit_log already use.
drop policy if exists "deal_sheet_versions_insert" on public.deal_sheet_versions;
create policy "deal_sheet_versions_insert" on public.deal_sheet_versions
  for insert with check (auth.uid() = created_by);

-- THE IMMUTABILITY RULE, and the reason it is not USING (false).
--
-- A draft is editable, because issuing one is an UPDATE that relabels it rather
-- than a copy that duplicates it. An issued row falls outside this policy, so
-- an update against it matches zero rows and changes nothing. USING (false)
-- would have frozen drafts too and made the relabel impossible.
--
-- The WITH CHECK half stops the escape route the USING half leaves open: without
-- it, a row could be updated while still a draft INTO a state this policy would
-- no longer allow it to leave, which is fine, but it could equally be flipped
-- back from issued to draft in the same statement that satisfies USING. Pinning
-- the post-image to the two legal shapes closes that.
drop policy if exists "deal_sheet_versions_update_draft" on public.deal_sheet_versions;
create policy "deal_sheet_versions_update_draft" on public.deal_sheet_versions
  for update
  using (auth.uid() is not null and status = 'draft')
  with check (status in ('draft', 'issued'));

-- No delete policy, for anyone. A version is the record that a decision was
-- made; drafts are superseded by the next save rather than removed.

create index if not exists deal_sheet_versions_record_idx
  on public.deal_sheet_versions (record_id, major desc, minor desc);
