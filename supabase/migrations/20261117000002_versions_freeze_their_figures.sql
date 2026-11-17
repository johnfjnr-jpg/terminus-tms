-- FROZEN_FIGURES: a version freezes its figures at SUBMISSION, and a won deal
-- records its won version. John's Phase 0 sign-off, 2026-11-17 (R-FF1, R-FF4,
-- R-FF5). WRITTEN IN THE BUILD. John applies it before the push, wrapped in
-- begin/commit, with the ledger row recorded by hand as a separate statement.
--
-- ── WHAT IT DOES ─────────────────────────────────────────────────────────
--
-- 1. deal_sheet_versions.frozen_figures (jsonb): the approval page's version
--    blocks and the calculateDeal result they were read from, the engine
--    identifier and the batch ids, written by the server at submission.
-- 2. The immutability trigger, as drafted in Phase 0 and ruled: a submitted
--    row refuses every change, for every role; a draft carries no figures; the
--    draft -> submitted relabel MUST carry them and only the SERVICE ROLE may
--    write them. ADDED: the issuer must be the record's owner, because the
--    relabel now runs as the service role, which bypasses the owner-scoped RLS
--    update policy that enforced it before.
-- 3. A new INSERT trigger (ruled): no row is created already submitted or
--    carrying figures, for ANY role, the service role included. Every version
--    is born a draft.
-- 4. raise_transition_request: a raise into Closed Won DERIVES the won version
--    (the newest submitted version a request froze and approved) and freezes it
--    into frozen_version_id, ignoring any value supplied (Architecture 12: a
--    definer function derives; it does not accept).
--
-- Legacy submitted versions keep frozen_figures null and re-derive (R-FF6, no
-- backfill). Idempotent: add column if not exists, constraints dropped and
-- re-added by name, functions replaced, triggers dropped and re-created. Does
-- NOT write its own ledger row (Architecture 10, corrected 2026-09-08). Not
-- parse-checked here (CLAUDE.md rule 14). Rollback:
-- supabase/rollbacks/20261117000002_versions_freeze_their_figures.rollback.sql.

alter table public.deal_sheet_versions add column if not exists frozen_figures jsonb;

comment on column public.deal_sheet_versions.frozen_figures is
  'FROZEN_FIGURES R-FF1: what the approval page showed for this version at the moment it was submitted, '
  'written by the server in the submission itself and never changed: the page''s version blocks (ask, target, '
  'exposures, cost basis, frozen terms), the calculateDeal result they were read from, the engine identifier '
  '(commit and deal-calculator sha256) and the batch ids. Null on a draft, and on a version submitted before '
  '2026-11-17, which re-derives and says so (R-FF6). The approval page renders these and runs today''s engine '
  'as a check only (R-FF2). The audit-snapshot exception to "computed values are not stored" (DESIGN_PRINCIPLES '
  'section 3, rule 6).';

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_figures_only_when_issued;
alter table public.deal_sheet_versions add constraint deal_sheet_versions_figures_only_when_issued
  check (frozen_figures is null or status = 'issued');

create or replace function public.deal_sheet_versions_immutable()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  if OLD.status = 'issued' then
    raise exception
      'deal_sheet_versions: V%.% is issued and cannot be changed (id %)',
      OLD.major, OLD.minor, OLD.id
      using errcode = 'restrict_violation';
  end if;

  if NEW.status = 'draft' then
    if NEW.frozen_figures is not null then
      raise exception 'deal_sheet_versions: a draft carries no frozen figures (id %)', OLD.id
        using errcode = 'restrict_violation';
    end if;
    return NEW;
  end if;

  if NEW.major is distinct from OLD.major + 1 or NEW.minor is distinct from 0 then
    raise exception
      'deal_sheet_versions: issuing V%.% must produce V%.0, not V%.%',
      OLD.major, OLD.minor, OLD.major + 1, NEW.major, NEW.minor
      using errcode = 'restrict_violation';
  end if;

  if NEW.record_id        is distinct from OLD.record_id
  or NEW.reason           is distinct from OLD.reason
  or NEW.inputs           is distinct from OLD.inputs
  or NEW.rates            is distinct from OLD.rates
  or NEW.sections         is distinct from OLD.sections
  or NEW.batch_id         is distinct from OLD.batch_id
  or NEW.revision_number  is distinct from OLD.revision_number
  or NEW.created_by       is distinct from OLD.created_by
  or NEW.created_by_email is distinct from OLD.created_by_email
  or NEW.created_at       is distinct from OLD.created_at then
    raise exception
      'deal_sheet_versions: issuing may set the status, number, issuer and frozen figures only, and must not alter what the version records (id %)',
      OLD.id
      using errcode = 'restrict_violation';
  end if;

  -- R-FF1 and DESIGN_PRINCIPLES section 3 rule 1: the figures are the SERVER'S,
  -- computed at submission, never a client's. Required on every submission, and
  -- writable only by the service role, so neither the screen nor a direct
  -- PostgREST call can supply them.
  if NEW.frozen_figures is null then
    raise exception 'deal_sheet_versions: issuing must freeze the figures (id %)', OLD.id
      using errcode = 'restrict_violation';
  end if;
  if current_user <> 'service_role' then
    raise exception 'deal_sheet_versions: only the server may freeze figures (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;

  -- The relabel runs as the service role, which bypasses RLS, so the owner
  -- rule the update policy enforced is enforced here: the issuer must own the
  -- record. The route also says so in words before it gets here.
  select r.owner_id into v_owner from public.records r where r.id = NEW.record_id;
  if NEW.issued_by is distinct from v_owner then
    raise exception 'deal_sheet_versions: only the record''s owner may submit its version (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$;

create or replace function public.deal_sheet_versions_born_draft()
returns trigger
language plpgsql
as $$
begin
  if NEW.status is distinct from 'draft' or NEW.frozen_figures is not null then
    raise exception 'deal_sheet_versions: a version is created as a draft with no frozen figures; it is submitted by the server (record %)', NEW.record_id
      using errcode = 'restrict_violation';
  end if;
  return NEW;
end;
$$;

drop trigger if exists deal_sheet_versions_born_draft_trg on public.deal_sheet_versions;
create trigger deal_sheet_versions_born_draft_trg
  before insert on public.deal_sheet_versions
  for each row execute function public.deal_sheet_versions_born_draft();

create or replace function public.raise_transition_request(
  p_record_id         uuid,
  p_to_stage          text,
  p_kind              text default 'transition',
  p_frozen_version_id uuid default null
)
returns public.transition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_rec      record;
  v_rev      integer;
  v_required text[];
  v_immediate boolean := false;
  v_frozen   uuid := p_frozen_version_id;
  v_row      public.transition_requests%rowtype;
begin
  if v_caller is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_kind not in ('transition', 'review') then
    raise exception 'kind must be transition or review, got %', p_kind using errcode = 'PT400';
  end if;

  -- owner_id joins the columns this already reads. Derived, never accepted.
  select r.id, r.record_type, r.status, r.owner_id into v_rec
  from public.records r where r.id = p_record_id;
  if not found then
    raise exception 'no such record' using errcode = 'PT404';
  end if;

  -- THE CHECK THIS FUNCTION NEVER HAD. Before the stage checks, so a non-owner
  -- learns nothing about the record's state from the shape of the refusal.
  if v_rec.owner_id is distinct from v_caller then
    raise exception 'This record belongs to another user. You can view it, but only its owner can change it.'
      using errcode = '42501';
  end if;

  if v_rec.status = p_to_stage then
    raise exception 'record is already in %', p_to_stage using errcode = 'PT400';
  end if;

  select max(rr.revision_number) into v_rev
  from public.record_revisions rr where rr.record_id = p_record_id;
  if v_rev is null then
    raise exception 'this record has no revision to freeze' using errcode = 'PT400';
  end if;

  -- FROZEN_FIGURES R-FF4: a raise into Closed Won DERIVES the won version and
  -- ignores any supplied value (Architecture 12). The won version is the newest
  -- SUBMITTED version that a request froze and that request was APPROVED: the
  -- approval the pricing gate collected. Null when there is none, which the
  -- headline says in words.
  if p_to_stage = 'Closed Won' then
    select v.id into v_frozen
    from public.deal_sheet_versions v
    where v.record_id = p_record_id
      and v.status = 'issued'
      and exists (
        select 1 from public.transition_requests tr
        where tr.record_id = p_record_id and tr.status = 'approved' and tr.frozen_version_id = v.id
      )
    order by v.major desc, v.minor desc
    limit 1;
  end if;

  -- DERIVED, never accepted. The caller says where it wants to go; the database
  -- says what that costs.
  v_required := public.required_tracks_for(v_rec.record_type, v_rec.status);

  -- ONLY A TRANSITION COMPLETES ITSELF. A review request is a request for
  -- comment and has no completion condition of its own, so it stays open
  -- whatever the tracks say, and is closed by withdrawing it.
  v_immediate := (p_kind = 'transition' and coalesce(array_length(v_required, 1), 0) = 0);

  insert into public.transition_requests
    (record_id, record_type, from_stage, to_stage, kind, status,
     frozen_revision, frozen_version_id, requested_by, closed_by, closed_at, close_reason)
  values
    (v_rec.id, v_rec.record_type, v_rec.status, p_to_stage, p_kind,
     case when v_immediate then 'approved' else 'open' end,
     v_rev, v_frozen, v_caller,
     case when v_immediate then v_caller end,
     case when v_immediate then now() end,
     case when v_immediate then
       'No approval tracks are required to leave ' || v_rec.status || '. The exit criteria were met and the move was made when it was requested.'
     end)
  returning * into v_row;

  -- AFTER the insert, and only because the row went in already closed: the
  -- freeze reads `status = 'open'`, so an open row here would refuse this
  -- update.
  if v_immediate then
    update public.records
      set status = p_to_stage, updated_at = now()
      where id = v_rec.id;
  end if;

  return v_row;
end $$;

comment on function public.raise_transition_request(uuid, text, text, uuid) is
  'Raises a transition or review request. SECURITY DEFINER, so it asks for '
  'itself every question RLS would have asked: the caller must OWN the record, '
  'checked against owner_id read from the record rather than accepted as a '
  'parameter. Raises 42501 for a non-owner, the same code RLS raises, so the '
  'refusal reads identically wherever it came from. Added 2026-09-08 after a '
  'non-owner raised a request that auto-approved and moved the record. '
  'FROZEN_FIGURES R-FF4 (2026-11-17): a raise into Closed Won derives the won '
  'version (the newest submitted version an approved request froze) and ignores '
  'any p_frozen_version_id supplied.';

grant execute on function public.raise_transition_request(uuid, text, text, uuid) to authenticated;
