-- Terminus TMS: what a lost deal records, Round 21 Phase 7
--
-- Four columns on opportunity_details, all written server-side. None is a
-- payload key, so none can be set through the salesperson PATCH path:
-- SALESPERSON_WRITABLE_KEYS governs payload keys and these are columns,
-- which is the "deliberately not writable from the client" property
-- OPPORTUNITY_DESIGN.md v1.2 asked for.
--
-- closed_lost_reason_id is a FOREIGN KEY on a uuid, decided in Phase 6 and
-- reasoned there: not a CHECK, because that would put the ten reasons in the
-- schema and make an eleventh a migration rather than a row; not the label
-- text, because a reason is a sentence the business will reword and Round 19
-- recorded what a text reference costs when the referent is renamed.
--
-- closed_lost_from_stage is TEXT and deliberately not a foreign key to
-- stage_definitions. It records the stage a deal died at, which must survive
-- that stage being renamed or removed: Round 20 renamed every Opportunity
-- stage and deleted four rows, and a lost deal from before that must still
-- say where it died. This is the one place a name rather than a reference is
-- correct, and it is correct for the opposite reason to the one above: the
-- referent is expected to change, and the record must NOT follow it.
--
-- The CHECK makes a half-recorded loss impossible to store. A lost deal
-- carrying no reason is a deal nobody can report on, which is the failure
-- this whole phase exists to prevent, so it is refused by the database
-- rather than only by the route.

alter table public.opportunity_details
  add column if not exists closed_lost_reason_id uuid references public.closed_lost_reasons(id);

alter table public.opportunity_details
  add column if not exists closed_lost_from_stage text;

alter table public.opportunity_details
  add column if not exists closed_lost_note text;

alter table public.opportunity_details
  add column if not exists closed_lost_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunity_details_closed_lost_complete'
  ) then
    alter table public.opportunity_details
      add constraint opportunity_details_closed_lost_complete
      check (
        (closed_lost_reason_id is null
          and closed_lost_from_stage is null
          and closed_lost_at is null)
        or
        (closed_lost_reason_id is not null
          and closed_lost_from_stage is not null
          and length(btrim(closed_lost_from_stage)) > 0
          and closed_lost_at is not null)
      ) not valid;

    alter table public.opportunity_details
      validate constraint opportunity_details_closed_lost_complete;
  end if;
end $$;

comment on column public.opportunity_details.closed_lost_from_stage is
  'The stage the deal was in when it was lost. TEXT, not a reference: it must '
  'survive that stage being renamed or removed, which Round 20 did to every '
  'Opportunity stage. The referent is expected to change and this must not '
  'follow it.';

comment on column public.opportunity_details.closed_lost_note is
  'Optional free text alongside the mandatory reason. Nullable on purpose: '
  'the reason is the reportable field and the note is the colour.';
